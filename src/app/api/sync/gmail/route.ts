import { NextResponse } from "next/server";
import { Nango } from "@nangohq/node";
import { google } from "googleapis";
import { openAgencyDb, upsertMessage, upsertEmbedding, getSyncState, setSyncState } from "@/lib/agency-db";
import { embedTexts } from "@/lib/embed";

const MAX_MESSAGES = 100;

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
  const nango = new Nango({ secretKey });
  const { connections } = await nango.listConnections({ providerConfigKey: "google-mail" } as any);
  if (!connections || connections.length === 0) throw new Error("Gmail not connected");
  const connectionId = connections[0].connection_id;
  const connection = await nango.getConnection("google-mail", connectionId);
  return { token: (connection.credentials as any).access_token, connectionId };
}

export async function POST(): Promise<NextResponse> {
  const secretKey = process.env.NANGO_SECRET_KEY;
  if (!secretKey) return NextResponse.json({ error: "NANGO_SECRET_KEY not set" }, { status: 500 });

  let token: string;
  try {
    ({ token } = await getNangoGmailToken(secretKey));
  } catch (err) {
    return NextResponse.json({ error: "Gmail not connected. Connect via /connect first.", details: String(err) }, { status: 401 });
  }

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: token });
  const gmail = google.gmail({ version: "v1", auth });

  const db = openAgencyDb();
  const { cursor } = getSyncState(db, "gmail");

  let messageIds: string[] = [];
  let newCursor = cursor;

  try {
    if (cursor) {
      const historyRes = await gmail.users.history.list({
        userId: "me",
        startHistoryId: cursor,
        historyTypes: ["messageAdded"],
        maxResults: MAX_MESSAGES,
      });
      const history = historyRes.data.history ?? [];
      for (const h of history) {
        for (const m of h.messagesAdded ?? []) {
          if (m.message?.id) messageIds.push(m.message.id);
        }
      }
      if (historyRes.data.historyId) newCursor = historyRes.data.historyId;
    } else {
      const listRes = await gmail.users.messages.list({ userId: "me", maxResults: MAX_MESSAGES, q: "in:inbox" });
      messageIds = (listRes.data.messages ?? []).map((m) => m.id!).filter(Boolean);
      const profileRes = await gmail.users.getProfile({ userId: "me" });
      if (profileRes.data.historyId) newCursor = profileRes.data.historyId;
    }
  } catch (err: any) {
    if (err?.code === 401) return NextResponse.json({ error: "Gmail token expired. Reconnect via /connect." }, { status: 401 });
    return NextResponse.json({ error: "Gmail API error", details: String(err) }, { status: 502 });
  }

  if (messageIds.length === 0) {
    if (newCursor) setSyncState(db, "gmail", newCursor);
    return NextResponse.json({ synced: 0, message: "No new messages" });
  }

  const keywordTexts: string[] = [];
  const messageRows: Array<{
    source: string;
    externalId: string;
    threadId: string | null;
    sender: string;
    subject: string;
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
      const receivedAt = dateStr ? new Date(dateStr).getTime() : (msg.internalDate ? parseInt(msg.internalDate) : Date.now());
      const body = extractBody(msg.payload);

      // Use full body for embedding quality - not stored, only embedded
      const keywordText = `${subject}. From: ${sender}. ${body}`.slice(0, 1500);

      messageRows.push({ source: "gmail", externalId: id, threadId: msg.threadId ?? null, sender, subject, receivedAt });
      keywordTexts.push(keywordText);
    } catch {
      continue;
    }
  }

  if (messageRows.length === 0) return NextResponse.json({ synced: 0, message: "No messages could be fetched" });

  let embeddings: Float32Array[];
  try {
    embeddings = await embedTexts(keywordTexts);
  } catch (err) {
    return NextResponse.json({ error: "Voyage embedding failed", details: String(err) }, { status: 502 });
  }

  let synced = 0;
  for (let i = 0; i < messageRows.length; i++) {
    const messageId = upsertMessage(db, messageRows[i]);
    upsertEmbedding(db, messageId, embeddings[i], keywordTexts[i]);
    synced++;
  }

  if (newCursor) setSyncState(db, "gmail", newCursor);
  return NextResponse.json({ synced, total: messageIds.length });
}
