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

async function fetchAndStoreMessages(
  gmail: ReturnType<typeof google.gmail>,
  db: Awaited<ReturnType<typeof openAgencyDb>>,
  labelId: string,
  labelName: string,
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
    console.error(`[sync] ${labelName} list error:`, err?.message);
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

  for (const id of messageIds) {
    try {
      const msgRes = await gmail.users.messages.get({ userId: "me", id, format: "full" });
      const msg = msgRes.data;
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
      const keywordText = `${subject}. From: ${sender}. ${body}`.slice(0, 1500);

      messageRows.push({
        source: "gmail",
        externalId: id,
        threadId: msg.threadId ?? null,
        sender,
        subject,
        mailbox: labelName,
        receivedAt,
      });
      keywordTexts.push(keywordText);
    } catch {
      continue;
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

export async function runGmailSyncForUser(workspaceId: string, userId: string): Promise<{ synced: number }> {
  const token = await getGmailToken(workspaceId, userId);
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: token });
  const gmail = google.gmail({ version: "v1", auth });
  const db = openAgencyDb(workspaceId, userId);
  let totalSynced = 0;

  let labelsToSync: Array<{ id: string; name: string }> = SYSTEM_LABEL_IDS.map((id) => ({
    id,
    name: id.toLowerCase().replace("category_", ""),
  }));

  try {
    const labelsRes = await gmail.users.labels.list({ userId: "me" });
    const userLabels = (labelsRes.data.labels ?? [])
      .filter((l) => l.type === "user" && l.id && l.name)
      .map((l) => ({ id: l.id!, name: l.name! }));
    labelsToSync = [...labelsToSync, ...userLabels];
  } catch (err: any) {
    console.error("[sync] failed to fetch label list, using system labels only:", err?.message);
  }

  for (const label of labelsToSync) {
    const count = await fetchAndStoreMessages(gmail, db, label.id, label.name);
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
