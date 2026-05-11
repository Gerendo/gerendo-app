import { NextResponse } from "next/server";
import { requireWorkspace, isErrorResponse } from "@/lib/get-workspace";
import { createServiceClient } from "@/lib/supabase-server";
import { openAgencyDb } from "@/lib/agency-db";
import { embedTexts } from "@/lib/embed";
import { getGmailToken } from "@/lib/agency-db";
import { google } from "googleapis";
import { extractBody, getHeader } from "@/app/api/sync/gmail/route";

export const maxDuration = 300;

const BATCH = 50; // messages per run — stay well within 300s

export async function POST(): Promise<NextResponse> {
  const ctx = await requireWorkspace();
  if (isErrorResponse(ctx)) return ctx;
  const { workspaceId, userId } = ctx;

  const supabase = createServiceClient();

  // Find messages that have no corresponding embedding row
  const { data: messages, error } = await supabase
    .from("messages")
    .select("id, external_id, subject, sender")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("source", "gmail")
    .not("id", "in", `(select message_id from embeddings where workspace_id = '${workspaceId}')`)
    .order("received_at", { ascending: false })
    .limit(BATCH);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!messages?.length) return NextResponse.json({ backfilled: 0, remaining: 0 });

  // Try to get Gmail token to fetch real body content
  let gmail: ReturnType<typeof google.gmail> | null = null;
  try {
    const token = await getGmailToken(workspaceId, userId);
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: token });
    gmail = google.gmail({ version: "v1", auth });
  } catch {
    // No token — fall back to subject+sender only
  }

  const db = openAgencyDb(workspaceId, userId);
  const keywordTexts: string[] = [];
  const messageIds: number[] = [];

  for (const msg of messages) {
    let body = "";
    if (gmail) {
      try {
        const res = await gmail.users.messages.get({ userId: "me", id: msg.external_id, format: "full" });
        const headers = res.data.payload?.headers ?? [];
        body = extractBody(res.data.payload);
      } catch {
        // Fall back to subject+sender if fetch fails
      }
    }
    const text = body
      ? `${msg.subject}. From: ${msg.sender}. ${body}`.slice(0, 1500)
      : `${msg.subject}. From: ${msg.sender}.`;
    keywordTexts.push(text);
    messageIds.push(msg.id);
  }

  // Embed in batch
  let embeddings;
  try {
    embeddings = await embedTexts(keywordTexts);
  } catch (err: any) {
    return NextResponse.json({ error: `Voyage error: ${err.message}` }, { status: 500 });
  }

  // Store embeddings
  let stored = 0;
  for (let i = 0; i < messageIds.length; i++) {
    const { error: insertError } = await supabase.from("embeddings").insert({
      workspace_id: workspaceId,
      user_id: userId,
      message_id: messageIds[i],
      embedding: Array.from(embeddings[i]),
      keyword_text: keywordTexts[i],
      indexed_at: Date.now(),
    });
    if (insertError) {
      console.error(`[backfill] insert failed for message ${messageIds[i]}:`, insertError.message);
    } else {
      stored++;
    }
  }

  // Count remaining
  const { count } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("source", "gmail")
    .not("id", "in", `(select message_id from embeddings where workspace_id = '${workspaceId}')`);

  return NextResponse.json({ backfilled: stored, remaining: count ?? 0 });
}
