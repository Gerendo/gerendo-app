import { NextResponse } from "next/server";
import { google } from "googleapis";
import { createServiceClient } from "@/lib/supabase-server";
import { requireWorkspace, isErrorResponse } from "@/lib/get-workspace";
import { getGmailToken } from "@/lib/agency-db";

export const maxDuration = 60;

export async function POST(request: Request): Promise<NextResponse> {
  let workspaceId: string;
  let userId: string;

  const authHeader = request.headers.get("authorization");

  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    const body = await request.json();
    workspaceId = body.workspaceId;
    userId = body.userId;
    if (!workspaceId || !userId) {
      return NextResponse.json({ error: "Missing workspaceId or userId" }, { status: 400 });
    }
  } else {
    const _ws = await requireWorkspace();
    if (isErrorResponse(_ws)) return _ws;
    ({ workspaceId, userId } = _ws);
  }

  const topicName = process.env.GMAIL_PUBSUB_TOPIC;
  if (!topicName) {
    return NextResponse.json({ error: "GMAIL_PUBSUB_TOPIC not configured" }, { status: 500 });
  }

  let token: string;
  try {
    token = await getGmailToken(workspaceId, userId);
  } catch {
    return NextResponse.json({ error: "Gmail not connected" }, { status: 401 });
  }

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: token });
  const gmail = google.gmail({ version: "v1", auth });

  // Skip re-registration if there's already an active watch (expires > 1 hour from now)
  const supabase = createServiceClient();
  const { data: existing } = await supabase.from("webhook_secrets")
    .select("meta")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("provider", "gmail")
    .eq("key", "watch")
    .maybeSingle();
  if (existing?.meta?.expiration) {
    const expiresAt = Number(existing.meta.expiration);
    if (!isNaN(expiresAt) && expiresAt > Date.now() + 60 * 60 * 1000) {
      return NextResponse.json({ ok: true, skipped: true, expiration: expiresAt });
    }
  }

  let watchRes;
  try {
    watchRes = await gmail.users.watch({
      userId: "me",
      requestBody: { topicName, labelIds: ["INBOX"] },
    });
  } catch (err: any) {
    console.error("[webhook/gmail/register] Gmail watch failed:", err?.message);
    return NextResponse.json({ error: err?.message ?? "Gmail watch failed" }, { status: 502 });
  }

  const { historyId, expiration } = watchRes.data;

  const { error: upsertError } = await supabase.from("webhook_secrets").upsert({
    workspace_id: workspaceId,
    user_id: userId,
    provider: "gmail",
    key: "watch",
    secret: historyId ?? "",
    meta: { expiration, registeredAt: Date.now() },
  }, { onConflict: "workspace_id,user_id,provider,key" });

  if (upsertError) {
    console.error("[webhook/gmail/register] upsert failed:", upsertError.message, { workspaceId, userId });
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, expiration, workspaceId, userId });
}
