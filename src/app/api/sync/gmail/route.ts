import { requireWorkspace, isErrorResponse } from "@/lib/get-workspace";
import { NextResponse } from "next/server";
import { google } from "googleapis";
import { openAgencyDb, upsertMessage, upsertEmbedding, getSyncState, setSyncState, getGmailToken } from "@/lib/agency-db";
import { embedTexts } from "@/lib/embed";

export const maxDuration = 300;

export const BATCH_SIZE = 100;

export const SYSTEM_LABEL_IDS = [
  "INBOX",
  "SENT",
  "STARRED",
  "IMPORTANT",
  "CATEGORY_PERSONAL",
  "CATEGORY_SOCIAL",
  "CATEGORY_PROMOTIONS",
  "CATEGORY_UPDATES",
  "CATEGORY_FORUMS",
];

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function decodeBody(data: string): string {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}

export function extractBody(payload: any): string {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) return decodeBody(payload.body.data);
  if (payload.mimeType === "text/html" && payload.body?.data) return stripHtml(decodeBody(payload.body.data));
  if (payload.parts) {
    for (const part of payload.parts) {
      const text = extractBody(part);
      if (text) return text;
    }
  }
  return "";
}

export function getHeader(headers: Array<{ name?: string | null; value?: string | null }>, name: string): string {
  return headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

export async function getNangoGmailToken(secretKey: string): Promise<{ token: string; connectionId: string }> {
  // Legacy - kept for any remaining references
  throw new Error("Use getGmailToken from agency-db instead");
}

const WEBHOOK_BATCH_SIZE = 100;

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

async function fetchAndStoreMessages(
  gmail: ReturnType<typeof google.gmail>,
  db: Awaited<ReturnType<typeof openAgencyDb>>,
  labelId: string,
  labelName: string,
  token: string,
): Promise<number> {
  const stateKey = `gmail:${labelId}`;
  const { cursor } = await getSyncState(db, stateKey);

  let messageIds: string[] = [];
  let newCursor = cursor;

  try {
    if (cursor) {
      const historyRes = await gmail.users.history.list({
        userId: "me",
        startHistoryId: cursor,
        historyTypes: ["messageAdded"],
        labelId,
        maxResults: BATCH_SIZE,
      });
      const history = historyRes.data.history ?? [];
      for (const h of history) {
        for (const m of h.messagesAdded ?? []) {
          if (m.message?.id) messageIds.push(m.message.id);
        }
      }
      if (historyRes.data.historyId) newCursor = historyRes.data.historyId;
    } else {
      let pageToken: string | undefined;
      do {
        const listRes = await gmail.users.messages.list({
          userId: "me",
          maxResults: BATCH_SIZE,
          labelIds: [labelId],
          pageToken,
        });
        const ids = (listRes.data.messages ?? []).map((m: any) => m.id!).filter(Boolean);
        messageIds.push(...ids);
        pageToken = listRes.data.nextPageToken ?? undefined;
      } while (pageToken);

      const profileRes = await gmail.users.getProfile({ userId: "me" });
      if (profileRes.data.historyId) newCursor = profileRes.data.historyId;
    }
  } catch (err: any) {
    const msg: string = err?.message ?? "";
    const retryMatch = msg.match(/Retry after (\S+)/);
    if (retryMatch) {
      const retryAt = new Date(retryMatch[1]).getTime();
      const waitMs = Math.max(0, retryAt - Date.now());
      if (waitMs > 0 && waitMs < 60_000) {
        await new Promise(r => setTimeout(r, waitMs + 500));
        try {
          return await fetchAndStoreMessages(gmail, db, labelId, labelName, token);
        } catch { return 0; }
      }
      await setSyncState(db, "gmail:rate_limit_until", String(retryAt));
    } else if (cursor) {
      // Non-rate-limit error on history.list = stale historyId (expires after ~7 days).
      // Clear cursor so next run falls back to messages.list and gets a fresh historyId.
      await setSyncState(db, stateKey, "");
    }
    console.error(`[sync] ${labelName} list error:`, msg);
    return 0;
  }

  if (messageIds.length === 0) {
    if (newCursor) await setSyncState(db, stateKey, newCursor);
    return 0;
  }

  const keywordTexts: string[] = [];
  const messageRows: Array<{
    source: string;
    externalId: string;
    threadId: string | null;
    sender: string;
    subject: string;
    mailbox: string;
    receivedAt: number;
  }> = [];

  for (let b = 0; b < messageIds.length; b += WEBHOOK_BATCH_SIZE) {
    const batchIds = messageIds.slice(b, b + WEBHOOK_BATCH_SIZE);
    const msgMap = await batchFetchMessages(token, batchIds);
    for (const id of batchIds) {
      const msg = msgMap.get(id);
      if (!msg) continue;
      try {
        const headers = msg.payload?.headers ?? [];
        const sender = getHeader(headers, "from");
        const subject = getHeader(headers, "subject") || "(no subject)";
        const dateStr = getHeader(headers, "date");
        const receivedAt = dateStr
          ? new Date(dateStr).getTime()
          : msg.internalDate
            ? parseInt(msg.internalDate)
            : Date.now();
        const body = extractBody(msg.payload);
        messageRows.push({
          source: "gmail",
          externalId: id,
          threadId: msg.threadId ?? null,
          sender,
          subject,
          mailbox: labelName,
          receivedAt,
        });
        keywordTexts.push(`${subject}. From: ${sender}. ${body}`.slice(0, 1500));
      } catch { continue; }
    }
  }

  if (messageRows.length === 0) return 0;

  let embeddings: Float32Array[];
  try {
    embeddings = await embedTexts(keywordTexts);
  } catch (err) {
    console.error(`[sync] ${labelName} embed error:`, err);
    return 0;
  }

  for (let i = 0; i < messageRows.length; i++) {
    const messageId = await upsertMessage(db, messageRows[i]);
    await upsertEmbedding(db, messageId, embeddings[i], keywordTexts[i]);
  }

  if (newCursor) await setSyncState(db, stateKey, newCursor);
  return messageRows.length;
}

export async function runGmailSyncForUser(
  workspaceId: string,
  userId: string,
  options?: { labelsOnly?: string[] }
): Promise<{ synced: number }> {
  const token = await getGmailToken(workspaceId, userId);
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: token });
  const gmail = google.gmail({ version: "v1", auth });
  const db = openAgencyDb(workspaceId, userId);
  let totalSynced = 0;

  let labelsToSync: Array<{ id: string; name: string }>;

  if (options?.labelsOnly) {
    labelsToSync = options.labelsOnly.map((id) => ({
      id,
      name: id.toLowerCase().replace("category_", ""),
    }));
  } else {
    labelsToSync = SYSTEM_LABEL_IDS.map((id) => ({
      id,
      name: id.toLowerCase().replace("category_", ""),
    }));
    // Cache user labels for 24h — labels.list was being called on every webhook fire
    const LABEL_CACHE_TTL = 24 * 60 * 60 * 1000;
    const { lastSyncedAt: labelsCachedAt, cursor: labelsJson } = await getSyncState(db, "gmail:labels_cache");
    const cacheValid = labelsCachedAt && (Date.now() - labelsCachedAt) < LABEL_CACHE_TTL && labelsJson;
    if (cacheValid) {
      try {
        const cached: Array<{ id: string; name: string }> = JSON.parse(labelsJson!);
        labelsToSync = [...labelsToSync, ...cached];
      } catch { /* ignore bad cache, fall through to fetch */ }
    }
    if (!cacheValid) {
      try {
        const labelsRes = await gmail.users.labels.list({ userId: "me" });
        const userLabels = (labelsRes.data.labels ?? [])
          .filter((l) => l.type === "user" && l.id && l.name)
          .map((l) => ({ id: l.id!, name: l.name! }));
        labelsToSync = [...labelsToSync, ...userLabels];
        await setSyncState(db, "gmail:labels_cache", JSON.stringify(userLabels));
      } catch (err: any) {
        console.error("[sync] failed to fetch label list, using system labels only:", err?.message);
      }
    }
  }

  for (const label of labelsToSync) {
    const count = await fetchAndStoreMessages(gmail, db, label.id, label.name, token);
    totalSynced += count;
  }

  return { synced: totalSynced };
}

export async function POST(): Promise<NextResponse> {
  const _ws = await requireWorkspace(); if (isErrorResponse(_ws)) return _ws; const { workspaceId, userId } = _ws;

  try {
    const result = await runGmailSyncForUser(workspaceId, userId);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Sync failed" }, { status: 500 });
  }
}
