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

  const watchRes = await gmail.users.watch({
    userId: "me",
    requestBody: { topicName, labelIds: ["INBOX"] },
  });

  const { historyId, expiration } = watchRes.data;

  const supabase = createServiceClient();
  await supabase.from("webhook_secrets").upsert({
    workspace_id: workspaceId,
    user_id: userId,
    provider: "gmail",
    key: "watch",
    secret: historyId ?? "",
    meta: { expiration, registeredAt: Date.now() },
  }, { onConflict: "workspace_id,user_id,provider,key" });

  return NextResponse.json({ ok: true, expiration });
}
