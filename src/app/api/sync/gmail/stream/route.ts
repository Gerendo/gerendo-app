import { requireWorkspace, isErrorResponse } from "@/lib/get-workspace";
import { google } from "googleapis";
import { createServiceClient } from "@/lib/supabase-server";
import { openAgencyDb, batchUpsertMessages, batchUpsertEmbeddings, getSyncState, setSyncState, getGmailToken } from "@/lib/agency-db";
import { embedTexts } from "@/lib/embed";
import { getNangoGmailToken, extractBody, getHeader, SYSTEM_LABEL_IDS } from "../route";

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

async function runSyncJob(jobId: string, workspaceId: string, userId: string) {
  const supabase = createServiceClient();
  const db = openAgencyDb(workspaceId, userId);

    // In-memory state to avoid read-modify-write races
  const labelProgress: Record<string, { synced: number; total: number; status: string }> = {};
  let totalSynced = 0;

  async function updateJob(patch: object) {
    await supabase.from("sync_jobs").update(patch).eq("id", jobId);
  }

  async function pushProgress() {
    await supabase.from("sync_jobs").update({
      label_progress: labelProgress,
      total_synced: totalSynced,
    }).eq("id", jobId);
  }

  try {
    const token = await getGmailToken(workspaceId, userId);
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: token });
    const gmail = google.gmail({ version: "v1", auth });
    const gmailToken = token;

    // Only sync inbox and sent - promotions/social/updates are noise for agency use
    const labelsToSync: Array<{ id: string; name: string }> = [
      { id: "INBOX", name: "inbox" },
      { id: "SENT", name: "sent" },
    ];

    for (const l of labelsToSync) labelProgress[l.name] = { synced: 0, total: 0, status: "pending" };
    await updateJob({ current_label: labelsToSync[0]?.name, label_progress: labelProgress });

    for (const label of labelsToSync) {
      await updateJob({ current_label: label.name });

      const stateKey = `gmail:${label.id}`;
      const { cursor } = await getSyncState(db, stateKey);
      let messageIds: string[] = [];
      let newCursor = cursor;

      try {
        if (cursor) {
          const historyRes = await gmail.users.history.list({
            userId: "me", startHistoryId: cursor,
            historyTypes: ["messageAdded"], labelId: label.id, maxResults: BATCH_SIZE,
          });
          for (const h of historyRes.data.history ?? [])
            for (const m of h.messagesAdded ?? [])
              if (m.message?.id) messageIds.push(m.message.id);
          if (historyRes.data.historyId) newCursor = historyRes.data.historyId;
        } else {
          let pageToken: string | undefined;
          do {
            const listRes = await gmail.users.messages.list({
              userId: "me", maxResults: BATCH_SIZE, labelIds: [label.id], pageToken,
            });
            messageIds.push(...(listRes.data.messages ?? []).map((m: any) => m.id!).filter(Boolean));
            pageToken = listRes.data.nextPageToken ?? undefined;
          } while (pageToken);
          const profileRes = await gmail.users.getProfile({ userId: "me" });
          if (profileRes.data.historyId) newCursor = profileRes.data.historyId;
        }
      } catch {
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

      // Process in sub-batches using Gmail batch API (100 messages per HTTP request)
      for (let b = 0; b < messageIds.length; b += SUB_BATCH) {
        const batchIds = messageIds.slice(b, b + SUB_BATCH);
        const keywordTexts: string[] = [];
        const messageRows: Array<{
          source: string; externalId: string; threadId: string | null;
          sender: string; subject: string; mailbox: string; receivedAt: number;
        }> = [];

        // One HTTP request fetches all 100 messages at once
        const msgMap = await batchFetchMessages(gmailToken, batchIds);

        for (const id of batchIds) {
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
              sender, subject, mailbox: label.name, receivedAt,
            });
            keywordTexts.push(`${subject}. From: ${sender}. ${body}`.slice(0, 1500));
            labelProgress[label.name].synced += 1;
            totalSynced += 1;
          } catch { continue; }
        }
        await pushProgress();

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
            labelProgress[label.name].synced += messageRows.length;
            totalSynced += messageRows.length;
            await pushProgress();
          } catch (err: any) {
            console.error(`[sync] sub-batch failed for ${label.name}:`, err?.message);
          }
        }
      }

      labelProgress[label.name].status = "done";
      await pushProgress();

      if (newCursor) await setSyncState(db, stateKey, newCursor);
    }

    // Sync drafts
    await updateJob({ current_label: "drafts" });
    try {
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

export async function GET(): Promise<Response> {
  const _ws = await requireWorkspace(); if (isErrorResponse(_ws)) throw new Error("Not authenticated"); const { workspaceId, userId } = _ws;
  const supabase = createServiceClient();

  // Create a new sync job
  const { data: job } = await supabase
    .from("sync_jobs")
    .insert({ workspace_id: workspaceId, status: "running" })
    .select("id")
    .single();

  if (!job) {
    return Response.json({ error: "Failed to create sync job" }, { status: 500 });
  }

  // Kick off background job - does NOT await
  runSyncJob(job.id, workspaceId, userId);

  // Return immediately with job ID
  return Response.json({ jobId: job.id });
}
