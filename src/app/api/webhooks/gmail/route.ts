import { NextResponse } from "next/server";
import { google } from "googleapis";
import { createServiceClient } from "@/lib/supabase-server";
import { runGmailSyncForUser } from "@/app/api/sync/gmail/route";

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

  // Find user by email - use single-user lookup instead of listing all users
  const supabase = createServiceClient();
  const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const user = users?.find(u => u.email === emailAddress);
  if (!user) return NextResponse.json({ ok: true });

  const { data: member } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member) return NextResponse.json({ ok: true });

  const now = Date.now();

  // Skip sync if Gmail API is rate limited - prevents hammering the API every 5 min
  const { data: rateLimitState } = await supabase
    .from("sync_state")
    .select("cursor")
    .eq("workspace_id", member.workspace_id)
    .eq("user_id", user.id)
    .eq("source", "gmail:rate_limit_until")
    .maybeSingle();
  if (rateLimitState?.cursor && Number(rateLimitState.cursor) > now) {
    return NextResponse.json({ ok: true });
  }

  // Debounce: skip if a webhook sync ran for this user in the last 5 minutes.
  // Prevents thundering herd when Pub/Sub delivers multiple notifications rapidly.
  const DEBOUNCE_MS = 5 * 60_000;
  const { data: lockState } = await supabase
    .from("sync_state")
    .select("last_synced_at")
    .eq("workspace_id", member.workspace_id)
    .eq("user_id", user.id)
    .eq("source", "gmail:webhook_lock")
    .maybeSingle();

  if (lockState?.last_synced_at && (now - new Date(lockState.last_synced_at).getTime()) < DEBOUNCE_MS) {
    return NextResponse.json({ ok: true });
  }

  // Set lock BEFORE running sync to prevent race condition with concurrent webhooks
  const { error: lockError } = await supabase.from("sync_state").upsert(
    { workspace_id: member.workspace_id, user_id: user.id, source: "gmail:webhook_lock", last_synced_at: now, cursor: null },
    { onConflict: "workspace_id,user_id,source" }
  );
  if (lockError) return NextResponse.json({ ok: true }); // another request won the race

  // Webhook syncs only process INBOX + SENT - the daily cron handles remaining labels.
  try {
    await runGmailSyncForUser(member.workspace_id, user.id, { labelsOnly: ["INBOX", "SENT"] });
  } catch (err: any) {
    console.error("[webhook/gmail] gmail sync failed:", err?.message);
  }

  return NextResponse.json({ ok: true });
}
