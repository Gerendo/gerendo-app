import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { requireWorkspace, isErrorResponse } from "@/lib/get-workspace";
import { getDriveToken } from "@/lib/agency-db";
import { reauthErrorToResponse } from "@/lib/oauth-errors";
import { google } from "googleapis";
import { safeEqual } from "@/lib/crypto";
import { randomUUID } from "crypto";

export const maxDuration = 60;

// Google Drive push channels expire after at most 7 days (604800s).
// We request 6 days so the cron renews with a 1-day buffer.
const CHANNEL_TTL_MS = 6 * 24 * 60 * 60 * 1000;

export async function POST(request: Request): Promise<NextResponse> {
  let workspaceId: string;
  let userId: string;

  const authHeader = request.headers.get("authorization");

  if (safeEqual(authHeader ?? "", `Bearer ${process.env.CRON_SECRET ?? ""}`)) {
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

  let token: string;
  try {
    token = await getDriveToken(workspaceId, userId);
  } catch (err) {
    const reauthRes = reauthErrorToResponse(err);
    if (reauthRes) return reauthRes;
    return NextResponse.json({ error: "Google Drive not connected" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const webhookUrl = `${appUrl}/api/webhooks/drive`;

  // Stop any existing channel before registering a new one to avoid duplicate notifications.
  // key="channel" is the stable row; secret stores the current channel ID; meta stores resource ID.
  const { data: existing } = await supabase
    .from("webhook_secrets")
    .select("key, secret, meta")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("provider", "drive")
    .eq("key", "channel")
    .maybeSingle();

  if (existing?.secret && (existing.meta as any)?.resourceId) {
    try {
      const stopAuth = new google.auth.OAuth2();
      stopAuth.setCredentials({ access_token: token });
      const stopDrive = google.drive({ version: "v3", auth: stopAuth });
      await stopDrive.channels.stop({
        requestBody: { id: existing.secret, resourceId: (existing.meta as any).resourceId },
      });
    } catch {
      // Non-fatal: channel may already be expired
    }
  }

  // Register a new changes.watch channel
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: token });
  const drive = google.drive({ version: "v3", auth });

  const channelId = randomUUID();
  const expiration = Date.now() + CHANNEL_TTL_MS;

  let resourceId: string;
  try {
    const res = await drive.changes.watch({
      pageToken: await getStartPageToken(drive),
      supportsAllDrives: false,
      includeItemsFromAllDrives: false,
      requestBody: {
        id: channelId,
        type: "web_hook",
        address: webhookUrl,
        expiration: String(expiration),
      },
    });
    resourceId = res.data.resourceId ?? "";
  } catch (err: any) {
    console.error("[drive/register] watch failed:", err?.message);
    return NextResponse.json({ error: err.message ?? "Watch registration failed" }, { status: 500 });
  }

  // Store using a stable key so renewal always overwrites the same row.
  // secret = current channelId (what Google sends in X-Goog-Channel-ID)
  // meta.resourceId = what Google needs to stop the channel
  await supabase.from("webhook_secrets").upsert({
    workspace_id: workspaceId,
    user_id: userId,
    provider: "drive",
    key: "channel",
    secret: channelId,
    meta: { expiration, resourceId, registeredAt: Date.now() },
  }, { onConflict: "workspace_id,user_id,provider,key" });

  return NextResponse.json({ ok: true, channelId, expiration });
}

async function getStartPageToken(drive: ReturnType<typeof google.drive>): Promise<string> {
  const res = await drive.changes.getStartPageToken({});
  return res.data.startPageToken ?? "1";
}
