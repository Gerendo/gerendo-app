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
    const client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID);
    await client.verifyIdToken({
      idToken,
      audience: process.env.PUBSUB_AUDIENCE,
    });
  } catch {
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
  const { data: userData } = await supabase.auth.admin.getUserByEmail(emailAddress);
  if (!userData?.user) return NextResponse.json({ ok: true });

  const { data: member } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (!member) return NextResponse.json({ ok: true });

  // Run incremental sync - always ack even if sync fails
  try {
    await runGmailSyncForUser(member.workspace_id, userData.user.id);
  } catch (err: any) {
    console.error("[webhook/gmail] sync failed:", err?.message);
  }

  return NextResponse.json({ ok: true });
}
