import { NextResponse } from "next/server";
import { google } from "googleapis";
import { createServiceClient } from "@/lib/supabase-server";
import { runGmailSyncForUser } from "@/app/api/sync/gmail/route";
import { runDriveSyncForUser } from "@/app/api/sync/drive/route";

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

  // Find user by email
  const supabase = createServiceClient();
  const { data: userData } = await supabase.auth.admin.listUsers();
  const user = userData?.users?.find(u => u.email === emailAddress);
  if (!user) return NextResponse.json({ ok: true });

  const { data: member } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member) return NextResponse.json({ ok: true });

  // Run Gmail sync, then kick off Drive sync in background
  try {
    await runGmailSyncForUser(member.workspace_id, user.id);
  } catch (err: any) {
    console.error("[webhook/gmail] gmail sync failed:", err?.message);
  }

  // Drive sync fire-and-forget - picks up new transcription files after meetings
  runDriveSyncForUser(member.workspace_id, user.id).catch((err: any) => {
    console.error("[webhook/gmail] drive sync failed:", err?.message);
  });

  return NextResponse.json({ ok: true });
}
