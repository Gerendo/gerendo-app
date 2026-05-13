import { requireWorkspace, isErrorResponse } from "@/lib/get-workspace";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { google } from "googleapis";
import { openAgencyDb, upsertSummary, getGmailToken } from "@/lib/agency-db";
import { extractBody } from "@/app/api/sync/gmail/route";
import { decryptColumn } from "@/lib/crypto-storage";
import { aad } from "@/lib/crypto-aad";

export const maxDuration = 300;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(): Promise<NextResponse> {
  const _ws = await requireWorkspace(); if (isErrorResponse(_ws)) return _ws; const { workspaceId, userId } = _ws;

  let token: string;
  try {
    token = await getGmailToken(workspaceId, userId);
  } catch {
    return NextResponse.json({ error: "Gmail not connected" }, { status: 401 });
  }

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: token });
  const gmail = google.gmail({ version: "v1", auth });
  const db = openAgencyDb(workspaceId, userId);

  const BATCH = 50;

  // Find messages with no summary yet, most recent first
  const { data: rowsRaw } = await db.supabase
    .from("messages")
    .select("id, external_id, sender_enc, source, subject_enc, mailbox")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .not("id", "in", db.supabase.from("summaries").select("message_id").eq("workspace_id", workspaceId))
    .order("received_at", { ascending: false })
    .limit(BATCH);

  if (!rowsRaw || rowsRaw.length === 0) {
    return NextResponse.json({ summarized: 0, remaining: 0 });
  }

  const rows = rowsRaw.map((r) => ({
    id: r.id,
    external_id: r.external_id,
    sender: decryptColumn(
      r.sender_enc,
      aad.messagesSender(workspaceId, userId, r.source, r.external_id)
    ),
    mailbox: r.mailbox,
    subject: decryptColumn(
      r.subject_enc,
      aad.messagesSubject(workspaceId, userId, r.source, r.external_id)
    ),
  }));

  let summarized = 0;

  for (const row of rows) {
    try {
      const msgRes = await gmail.users.messages.get({ userId: "me", id: row.external_id, format: "full" });
      const body = extractBody(msgRes.data.payload);
      if (!body || body.length < 20) {
        await upsertSummary(db, row.id, `${row.subject} (no body content)`);
        summarized++;
        continue;
      }

      const input = `Email from: ${row.sender}\nSubject: ${row.subject}\nMailbox: ${row.mailbox}\n\nBody:\n${body.slice(0, 2000)}`;

      const res = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 150,
        system: [
          {
            type: "text",
            text: "Summarize this email in 1-2 sentences. Be specific: include who it's from, what it's about, and any key details (dates, amounts, decisions, action items). No filler phrases.",
            cache_control: { type: "ephemeral" } as any,
          },
        ],
        messages: [{ role: "user", content: input }],
      });

      const summary = res.content[0].type === "text" ? res.content[0].text.trim() : "";
      if (summary) {
        await upsertSummary(db, row.id, summary);
        summarized++;
      }
    } catch {
      continue;
    }
  }

  // Count remaining unsummarized
  const { count: remaining } = await db.supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .not("id", "in", db.supabase.from("summaries").select("message_id").eq("workspace_id", workspaceId));

  return NextResponse.json({ summarized, remaining: remaining ?? 0 });
}
