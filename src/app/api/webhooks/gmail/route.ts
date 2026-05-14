import { NextResponse } from "next/server";
import { google } from "googleapis";
import { createServiceClient } from "@/lib/supabase-server";
import { runGmailSyncForUser } from "@/app/api/sync/gmail/route";
import { detectDecisionsForUser } from "@/lib/decision-detector";
import { logReauthNeeded } from "@/lib/oauth-errors";

export const maxDuration = 300;

export async function POST(request: Request): Promise<NextResponse> {
  // Verify JWT from Google Pub/Sub
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const idToken = authHeader.slice(7);
  try {
    // Pub/Sub push JWT audience is the push endpoint URL, not the service account email.
    // Verify by decoding and checking the email claim matches our service account.
    const tokenInfoRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`
    );
    if (!tokenInfoRes.ok) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
    const tokenInfo = await tokenInfoRes.json();
    // Verify the token was issued for our service account
    if (tokenInfo.email !== process.env.PUBSUB_AUDIENCE) {
      console.error("[webhook/gmail] token email mismatch:", tokenInfo.email, "expected:", process.env.PUBSUB_AUDIENCE);
      return NextResponse.json({ error: "Invalid token audience" }, { status: 401 });
    }
  } catch (err: any) {
    console.error("[webhook/gmail] token verification failed:", err?.message);
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  // Parse Pub/Sub message
  let emailAddress: string;
  try {
    const body = await request.json();
    const decoded = Buffer.from(body.message?.data ?? "", "base64").toString("utf-8");
    const payload = JSON.parse(decoded);
    emailAddress = payload.emailAddress;
    if (!emailAddress) return NextResponse.json({ ok: true }); // ack malformed
  } catch {
    return NextResponse.json({ ok: true }); // ack parse errors
  }

  // Resolve workspace member by email. getUserByEmail would be ideal but isn't
  // exposed by @supabase/supabase-js admin API — use listUsers with a server-side
  // filter to avoid loading all pages unnecessarily.
  const supabase = createServiceClient();
  const { data: found } = await supabase.auth.admin.listUsers({ perPage: 1000, page: 1 });
  const user = found?.users?.find(u => u.email === emailAddress);
  if (!user) return NextResponse.json({ ok: true });

  const { data: member } = await supabase
    .from("workspace_members")
    .select("workspace_id, user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member) return NextResponse.json({ ok: true });

  const { workspace_id: workspaceId, user_id: userId } = member as { workspace_id: string; user_id: string };
  const now = Date.now();

  // Skip sync if Gmail API is rate limited - prevents hammering the API every 5 min
  const { data: rateLimitState } = await supabase
    .from("sync_state")
    .select("cursor")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("source", "gmail:rate_limit_until")
    .maybeSingle();
  if (rateLimitState?.cursor && Number(rateLimitState.cursor) > now) {
    return NextResponse.json({ ok: true });
  }

  // Debounce: 30s is enough to prevent concurrent syncs while still allowing
  // Gmail's history API propagation delay (webhook fires before message appears in history).
  const DEBOUNCE_MS = 30_000;
  const { data: lockState } = await supabase
    .from("sync_state")
    .select("last_synced_at")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("source", "gmail:webhook_lock")
    .maybeSingle();

  if (lockState?.last_synced_at && (now - new Date(lockState.last_synced_at).getTime()) < DEBOUNCE_MS) {
    return NextResponse.json({ ok: true });
  }

  // Set lock BEFORE running sync to prevent race condition with concurrent webhooks
  const { error: lockError } = await supabase.from("sync_state").upsert(
    { workspace_id: workspaceId, user_id: userId, source: "gmail:webhook_lock", last_synced_at: now, cursor: null },
    { onConflict: "workspace_id,user_id,source" }
  );
  if (lockError) return NextResponse.json({ ok: true }); // another request won the race

  // Webhook syncs only process INBOX + SENT - the daily cron handles remaining labels.
  try {
    await runGmailSyncForUser(workspaceId, userId, { labelsOnly: ["INBOX", "SENT"] });
  } catch (err: any) {
    if (!logReauthNeeded(err, `webhook/gmail workspace=${workspaceId}`)) {
      console.error("[webhook/gmail] gmail sync failed:", err?.message);
    }
  }

  // Run decision detection synchronously — webhook has 300s maxDuration, plenty of time
  try {
    await detectDecisionsForUser(workspaceId, userId);
  } catch (err: any) {
    console.error("[webhook/gmail] detection failed:", err?.message);
  }

  return NextResponse.json({ ok: true });
}
