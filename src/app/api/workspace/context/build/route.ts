import { requireWorkspace, isErrorResponse } from "@/lib/get-workspace";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { google } from "googleapis";
import { openAgencyDb, upsertWorkspaceContext, getWorkspaceContext, getGmailToken } from "@/lib/agency-db";
import { reauthErrorToResponse } from "@/lib/oauth-errors";
import { extractBody } from "@/app/api/sync/gmail/route";
import { decryptColumn } from "@/lib/crypto-storage";
import { aad } from "@/lib/crypto-aad";

export const maxDuration = 300;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const REBUILD_INTERVAL_MS = 24 * 60 * 60 * 1000;

export async function POST(req: Request): Promise<NextResponse> {
  const body = await req.json().catch(() => ({}));
  const force = body?.force === true;

  const _ws = await requireWorkspace(); if (isErrorResponse(_ws)) return _ws; const { workspaceId, userId } = _ws;

  const db = openAgencyDb(workspaceId, userId);

  if (!force) {
    const existing = await getWorkspaceContext(db);
    if (existing && Date.now() - existing.builtAt < REBUILD_INTERVAL_MS) {
      const ageH = Math.round((Date.now() - existing.builtAt) / 3600000);
      return NextResponse.json({ skipped: true, reason: `Context is ${ageH}h old, within 24h window. Pass force:true to rebuild.` });
    }
  }

  let gmail: any;
  try {
    const token = await getGmailToken(workspaceId, userId);
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: token });
    gmail = google.gmail({ version: "v1", auth });
  } catch (err) {
    const reauthRes = reauthErrorToResponse(err);
    if (reauthRes) return reauthRes;
    return NextResponse.json({ error: "Gmail not connected" }, { status: 401 });
  }

  const ninetyDaysAgo = Date.now() - 90 * 24 * 3600000;

  const { data: sentRowsRaw } = await db.supabase
    .from("messages")
    .select("id, external_id, sender_enc, source, subject_enc, received_at")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .ilike("mailbox", "sent")
    .gte("received_at", ninetyDaysAgo)
    .order("received_at", { ascending: false })
    .limit(30);

  const { data: receivedRowsRaw } = await db.supabase
    .from("messages")
    .select("id, external_id, sender_enc, source, subject_enc, received_at")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .ilike("mailbox", "inbox")
    .gte("received_at", ninetyDaysAgo)
    .order("received_at", { ascending: false })
    .limit(20);

  const decryptRow = (r: any) => ({
    id: r.id,
    external_id: r.external_id,
    sender: decryptColumn(
      r.sender_enc,
      aad.messagesSender(workspaceId, userId, r.source, r.external_id)
    ),
    received_at: r.received_at,
    subject: decryptColumn(
      r.subject_enc,
      aad.messagesSubject(workspaceId, userId, r.source, r.external_id)
    ),
  });

  const sentRows = (sentRowsRaw ?? []).map(decryptRow);
  const receivedRows = (receivedRowsRaw ?? []).map(decryptRow);
  const allRows = [...sentRows, ...receivedRows];

  if (allRows.length === 0) {
    return NextResponse.json({ error: "No emails found in the last 90 days. Sync emails first." }, { status: 400 });
  }

  const sentIds = new Set((sentRows ?? []).map((r) => r.id));
  const CONCURRENCY = 10;
  const emailDocs: string[] = [];

  for (let i = 0; i < allRows.length; i += CONCURRENCY) {
    const batch = allRows.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(async (row) => {
      try {
        const msgRes = await gmail.users.messages.get({ userId: "me", id: row.external_id, format: "full" });
        const body = extractBody(msgRes.data.payload);
        const date = new Date(row.received_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        const mailbox = sentIds.has(row.id) ? "SENT" : "RECEIVED";
        return `[${mailbox}] ${date} | Subject: ${row.subject} | From: ${row.sender}\n${body.slice(0, 500)}`;
      } catch {
        return null;
      }
    }));
    emailDocs.push(...results.filter(Boolean) as string[]);
  }

  if (emailDocs.length === 0) {
    return NextResponse.json({ error: "Could not fetch email bodies" }, { status: 500 });
  }

  const emailSample = emailDocs.join("\n\n---\n\n");

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1000,
    system: [
      {
        type: "text",
        text: `You are analyzing a sample of emails from a workspace to build a workspace intelligence profile.
Extract facts only - no speculation, no filler. Be specific and concrete.
If you don't have enough signal for a field, omit it rather than guess.`,
        cache_control: { type: "ephemeral" } as any,
      },
    ],
    messages: [
      {
        role: "user",
        content: `Analyze these ${emailDocs.length} emails and produce a workspace profile in this exact format:

WORKSPACE PROFILE
=================
Agency name: [name if discernible, else "unknown"]
What they do: [1-2 sentences on the type of work/business]
Owner/main user: [name and email of the person sending most emails]

ACTIVE CLIENTS (last 90 days):
- [Client name]: [what they're working on together, 1 line]
(list up to 8, omit if unclear)

KEY TEAM MEMBERS:
- [Name] ([role if known]): [email]
(list up to 6 internal people)

KEY EXTERNAL CONTACTS:
- [Name] at [Company]: [relationship/context]
(list up to 8)

ACTIVE PROJECTS:
- [Project name]: [status/context, 1 line]
(list up to 6)

TOOLS & PLATFORMS MENTIONED:
[comma-separated list of tools, software, platforms referenced]

INTERNAL TERMINOLOGY:
[any recurring internal terms, codenames, or abbreviations - 1 line each with meaning]

---

EMAIL SAMPLE:
${emailSample}`,
      },
    ],
  });

  const contextText = response.content[0].type === "text" ? response.content[0].text.trim() : "";
  if (!contextText) {
    return NextResponse.json({ error: "Synthesis produced empty output" }, { status: 500 });
  }

  const tokenCount = response.usage.input_tokens + response.usage.output_tokens;
  await upsertWorkspaceContext(db, contextText, emailDocs.length, tokenCount);

  return NextResponse.json({
    built: true,
    workspace_id: workspaceId,
    sources_used: emailDocs.length,
    token_count: tokenCount,
    preview: contextText.slice(0, 300) + "...",
  });
}

export async function GET(): Promise<NextResponse> {
  const _ws = await requireWorkspace(); if (isErrorResponse(_ws)) return _ws; const { workspaceId, userId } = _ws;
  const db = openAgencyDb(workspaceId, userId);
  const ctx = await getWorkspaceContext(db);

  if (!ctx) return NextResponse.json({ exists: false });

  const ageH = Math.round((Date.now() - ctx.builtAt) / 3600000);
  return NextResponse.json({
    exists: true,
    built_at: new Date(ctx.builtAt).toISOString(),
    age_hours: ageH,
    sources_used: ctx.sourcesUsed,
    context: ctx.contextText,
  });
}
