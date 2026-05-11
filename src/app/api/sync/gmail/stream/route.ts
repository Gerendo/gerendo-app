import { requireWorkspace, isErrorResponse } from "@/lib/get-workspace";
import { after } from "next/server";
import { google } from "googleapis";
import { createServiceClient } from "@/lib/supabase-server";
import { openAgencyDb, batchUpsertMessages, batchUpsertEmbeddings, getSyncState, setSyncState, getGmailToken } from "@/lib/agency-db";
import { embedTexts } from "@/lib/embed";
import { extractBody, getHeader } from "../route";

export const maxDuration = 300;

const BATCH_SIZE = 100;
const SUB_BATCH = 100; // Gmail batch API max

// Fetch up to 100 messages in a single multipart HTTP request
async function batchFetchMessages(token: string, ids: string[]): Promise<Map<string, any>> {
  const boundary = "batch_gerendo";
  const parts = ids.map((id) =>
    `--${boundary}\r\nContent-Type: application/http\r\n\r\nGET /gmail/v1/users/me/messages/${id}?format=full HTTP/1.1\r\n\r\n`
  );
  const body = parts.join("") + `--${boundary}--`;

  const res = await fetch("https://www.googleapis.com/batch/gmail/v1", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/mixed; boundary=${boundary}`,
    },
    body,
  });

  const text = await res.text();
  const responseBoundary = res.headers.get("content-type")?.match(/boundary=(.+)/)?.[1];
  if (!responseBoundary) return new Map();

  const result = new Map<string, any>();
  const sections = text.split(`--${responseBoundary}`).slice(1);

  for (const section of sections) {
    if (section.trim() === "--") break;
    const jsonMatch = section.match(/\{[\s\S]*\}/);
    if (!jsonMatch) continue;
    try {
      const msg = JSON.parse(jsonMatch[0]);
      if (msg.id) result.set(msg.id, msg);
    } catch { continue; }
  }

  return result;
}

async function runSyncJob(jobId: string, workspaceId: string, userId: string, selectedLabels: Array<{ id: string; name: string }>) {
  const supabase = createServiceClient();
  const db = openAgencyDb(workspaceId, userId);

  const labelProgress: Record<string, { synced: number; total: number; status: string }> = {};
  let totalSynced = 0;
  let gmailToken = "";

  async function updateJob(patch: object) {
    await supabase.from("sync_jobs").update(patch).eq("id", jobId);
  }

  async function pushProgress() {
    const { error } = await supabase.from("sync_jobs").update({
      label_progress: labelProgress,
      total_synced: totalSynced,
    }).eq("id", jobId);
    if (error) console.error("[sync] pushProgress failed:", error.message, error.code);
  }

  async function isCancelled(): Promise<boolean> {
    const { data } = await supabase.from("sync_jobs").select("status").eq("id", jobId).single();
    return data?.status === "cancelled";
  }

  // Fetch, embed, and store a batch of message IDs. Counts only once, after embedding succeeds.
  async function processBatch(ids: string[], labelName: string) {
    const msgMap = await batchFetchMessages(gmailToken, ids);
    const keywordTexts: string[] = [];
    const messageRows: Array<{
      source: string; externalId: string; threadId: string | null;
      sender: string; subject: string; mailbox: string; receivedAt: number;
    }> = [];

    for (const id of ids) {
      const msg = msgMap.get(id);
      if (!msg) continue;
      try {
        const headers = msg.payload?.headers ?? [];
        const sender = getHeader(headers, "from");
        const subject = getHeader(headers, "subject") || "(no subject)";
        const dateStr = getHeader(headers, "date");
        const receivedAt = dateStr ? new Date(dateStr).getTime()
          : msg.internalDate ? parseInt(msg.internalDate) : Date.now();
        const body = extractBody(msg.payload);
        messageRows.push({
          source: "gmail", externalId: id, threadId: msg.threadId ?? null,
          sender, subject, mailbox: labelName, receivedAt,
        });
        keywordTexts.push(`${subject}. From: ${sender}. ${body}`.slice(0, 1500));
      } catch { continue; }
    }

    if (messageRows.length === 0) return;

    try {
      const [embeddings, idMap] = await Promise.all([
        embedTexts(keywordTexts),
        batchUpsertMessages(db, messageRows),
      ]);
      const embItems = messageRows.map((row, i) => {
        const messageId = idMap.get(row.externalId);
        if (!messageId) return null;
        return { messageId, embedding: embeddings[i], keywordText: keywordTexts[i] };
      }).filter(Boolean) as Array<{ messageId: number; embedding: Float32Array; keywordText: string }>;
      await batchUpsertEmbeddings(db, embItems);
      labelProgress[labelName].synced += messageRows.length;
      totalSynced += messageRows.length;
      await pushProgress();
    } catch (err: any) {
      console.error(`[sync] batch failed for ${labelName}:`, err?.message);
    }
  }

  try {
    gmailToken = await getGmailToken(workspaceId, userId);
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: gmailToken });
    const gmail = google.gmail({ version: "v1", auth });

    // Use labels passed from the UI, fallback to inbox+sent
    const labelsToSync: Array<{ id: string; name: string }> = selectedLabels.length > 0
      ? selectedLabels
      : [{ id: "INBOX", name: "inbox" }, { id: "SENT", name: "sent" }];

    for (const l of labelsToSync) labelProgress[l.name] = { synced: 0, total: 0, status: "pending" };
    await updateJob({ current_label: labelsToSync[0]?.name, label_progress: labelProgress });

    for (const label of labelsToSync) {
      if (await isCancelled()) break;
      await updateJob({ current_label: label.name });
      // Brief pause between labels to avoid exhausting Gmail quota on large mailboxes
      await new Promise(r => setTimeout(r, 200));

      const stateKey = `gmail:${label.id}`;
      const { cursor } = await getSyncState(db, stateKey);
      let newCursor = cursor;

      if (cursor) {
        // Incremental: fetch only new messages via history API
        let messageIds: string[] = [];
        try {
          const historyRes = await gmail.users.history.list({
            userId: "me", startHistoryId: cursor,
            historyTypes: ["messageAdded"], labelId: label.id, maxResults: BATCH_SIZE,
          });
          for (const h of historyRes.data.history ?? [])
            for (const m of h.messagesAdded ?? [])
              if (m.message?.id) messageIds.push(m.message.id);
          if (historyRes.data.historyId) newCursor = historyRes.data.historyId;
        } catch (err: any) {
          console.error(`[sync] history list failed for ${label.name}:`, err?.message, err?.code);
          labelProgress[label.name] = { synced: 0, total: 0, status: "error" };
          await pushProgress();
          continue;
        }

        if (messageIds.length === 0) {
          labelProgress[label.name] = { synced: 0, total: 0, status: "done" };
          await pushProgress();
          if (newCursor) await setSyncState(db, stateKey, newCursor);
          continue;
        }

        labelProgress[label.name] = { synced: 0, total: messageIds.length, status: "syncing" };
        await pushProgress();

        for (let b = 0; b < messageIds.length; b += SUB_BATCH) {
          if (await isCancelled()) break;
          await processBatch(messageIds.slice(b, b + SUB_BATCH), label.name);
        }

      } else {
        // Full scan: process each page of IDs immediately so progress shows right away
        labelProgress[label.name] = { synced: 0, total: 0, status: "syncing" };
        await pushProgress();

        let pageToken: string | undefined;
        let listError = false;
        do {
          if (await isCancelled()) break;
          try {
            const listRes = await gmail.users.messages.list({
              userId: "me", maxResults: SUB_BATCH, labelIds: [label.id], pageToken,
            });
            const pageIds = (listRes.data.messages ?? []).map((m: any) => m.id!).filter(Boolean);
            pageToken = listRes.data.nextPageToken ?? undefined;
            if (pageIds.length > 0) await processBatch(pageIds, label.name);
            if (pageToken) await new Promise(r => setTimeout(r, 100));
          } catch (err: any) {
            console.error(`[sync] messages.list failed for ${label.name}:`, err?.message, err?.code);
            listError = true;
            break;
          }
        } while (pageToken);

        if (listError) {
          labelProgress[label.name].status = "error";
          await pushProgress();
          continue;
        }

        try {
          const profileRes = await gmail.users.getProfile({ userId: "me" });
          if (profileRes.data.historyId) newCursor = profileRes.data.historyId;
        } catch { /* non-fatal */ }
      }

      labelProgress[label.name].status = "done";
      await pushProgress();

      if (newCursor) await setSyncState(db, stateKey, newCursor);
    }

    // Sync drafts
    await updateJob({ current_label: "drafts" });
    try {
      labelProgress["drafts"] = { synced: 0, total: 0, status: "syncing" };
      let draftIds: string[] = [];
      let pageToken: string | undefined;
      do {
        const listRes = await gmail.users.drafts.list({ userId: "me", maxResults: BATCH_SIZE, pageToken });
        draftIds.push(...(listRes.data.drafts ?? []).map((d: any) => d.id!).filter(Boolean));
        pageToken = listRes.data.nextPageToken ?? undefined;
      } while (pageToken);

      for (let b = 0; b < draftIds.length; b += SUB_BATCH) {
        const batchIds = draftIds.slice(b, b + SUB_BATCH);
        const keywordTexts: string[] = [];
        const messageRows: Array<{
          source: string; externalId: string; threadId: string | null;
          sender: string; subject: string; mailbox: string; receivedAt: number;
        }> = [];

        for (const draftId of batchIds) {
          try {
            const draftRes = await gmail.users.drafts.get({ userId: "me", id: draftId, format: "full" });
            const msg = draftRes.data.message;
            if (!msg) continue;
            const headers = msg.payload?.headers ?? [];
            const sender = getHeader(headers, "from");
            const subject = getHeader(headers, "subject") || "(no subject)";
            const body = extractBody(msg.payload);
            messageRows.push({
              source: "gmail", externalId: `draft:${draftId}`, threadId: msg.threadId ?? null,
              sender, subject, mailbox: "drafts",
              receivedAt: msg.internalDate ? parseInt(msg.internalDate) : Date.now(),
            });
            keywordTexts.push(`DRAFT: ${subject}. From: ${sender}. ${body}`.slice(0, 1500));
          } catch { continue; }
        }

        if (messageRows.length > 0) {
          try {
            const [embeddings, idMap] = await Promise.all([
              embedTexts(keywordTexts),
              batchUpsertMessages(db, messageRows),
            ]);
            const embItems = messageRows.map((row, i) => {
              const messageId = idMap.get(row.externalId);
              if (!messageId) return null;
              return { messageId, embedding: embeddings[i], keywordText: keywordTexts[i] };
            }).filter(Boolean) as Array<{ messageId: number; embedding: Float32Array; keywordText: string }>;
            await batchUpsertEmbeddings(db, embItems);
            totalSynced += messageRows.length;
            labelProgress["drafts"] = { synced: (labelProgress["drafts"]?.synced ?? 0) + messageRows.length, total: draftIds.length, status: "syncing" };
            await pushProgress();
          } catch (err: any) {
            console.error(`[sync] drafts sub-batch failed:`, err?.message);
          }
        }
      }
    } catch (err: any) {
      console.error("[sync] drafts failed:", err?.message);
    }

    await updateJob({ status: "done", current_label: null, finished_at: new Date().toISOString() });

    // Rebuild workspace context in background
    fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/workspace/context/build`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ force: true }),
    }).catch(() => {});

  } catch (err: any) {
    console.error("[sync] job failed:", err?.message);
    await updateJob({ status: "error", finished_at: new Date().toISOString() });
  }
}

export async function GET(request: Request): Promise<Response> {
  const _ws = await requireWorkspace(); if (isErrorResponse(_ws)) throw new Error("Not authenticated"); const { workspaceId, userId } = _ws;
  const supabase = createServiceClient();

  // Parse selected labels from query param: ?labels=INBOX,SENT,MyLabel
  const { searchParams } = new URL(request.url);
  const labelsParam = searchParams.get("labels");
  const selectedLabels: Array<{ id: string; name: string }> = labelsParam
    ? labelsParam.split(",").map(id => ({ id, name: id.toLowerCase().replace("category_", "") }))
    : [];

  const { data: job } = await supabase
    .from("sync_jobs")
    .insert({ workspace_id: workspaceId, status: "running" })
    .select("id")
    .single();

  if (!job) {
    return Response.json({ error: "Failed to create sync job" }, { status: 500 });
  }

  after(runSyncJob(job.id, workspaceId, userId, selectedLabels));

  return Response.json({ jobId: job.id });
}
