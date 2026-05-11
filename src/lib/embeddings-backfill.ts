import { createServiceClient } from "./supabase-server";
import { openAgencyDb, getGmailToken } from "./agency-db";
import { embedTexts } from "./embed";
import { google } from "googleapis";
import { extractBody } from "@/app/api/sync/gmail/route";

const BATCH = 50;

export async function backfillEmbeddingsForUser(
  workspaceId: string,
  userId: string
): Promise<{ backfilled: number; remaining: number }> {
  const supabase = createServiceClient();

  const { data: messages } = await supabase
    .from("messages")
    .select("id, external_id, subject, sender")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("source", "gmail")
    .not("id", "in", `(select message_id from embeddings where workspace_id = '${workspaceId}')`)
    .order("received_at", { ascending: false })
    .limit(BATCH);

  if (!messages?.length) {
    return { backfilled: 0, remaining: 0 };
  }

  // Try to enrich with real body from Gmail
  let gmail: ReturnType<typeof google.gmail> | null = null;
  try {
    const token = await getGmailToken(workspaceId, userId);
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: token });
    gmail = google.gmail({ version: "v1", auth });
  } catch {
    // No token — use subject+sender fallback
  }

  const keywordTexts: string[] = [];
  const messageIds: number[] = [];

  for (const msg of messages) {
    let body = "";
    if (gmail) {
      try {
        const res = await gmail.users.messages.get({ userId: "me", id: msg.external_id, format: "full" });
        body = extractBody(res.data.payload);
      } catch {
        // Fall back silently
      }
    }
    const text = body
      ? `${msg.subject}. From: ${msg.sender}. ${body}`.slice(0, 1500)
      : `${msg.subject}. From: ${msg.sender}.`;
    keywordTexts.push(text);
    messageIds.push(msg.id);
  }

  const embeddings = await embedTexts(keywordTexts);

  let backfilled = 0;
  for (let i = 0; i < messageIds.length; i++) {
    const { error } = await supabase.from("embeddings").insert({
      workspace_id: workspaceId,
      user_id: userId,
      message_id: messageIds[i],
      embedding: Array.from(embeddings[i]),
      keyword_text: keywordTexts[i],
      indexed_at: Date.now(),
    });
    if (!error) backfilled++;
    else console.error(`[backfill] insert failed for message ${messageIds[i]}:`, error.message);
  }

  const { count } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("source", "gmail")
    .not("id", "in", `(select message_id from embeddings where workspace_id = '${workspaceId}')`);

  return { backfilled, remaining: count ?? 0 };
}
