import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { runDriveSyncForUser } from "@/app/api/sync/drive/route";
import { logReauthNeeded } from "@/lib/oauth-errors";

export const maxDuration = 300;

const DEBOUNCE_MS = 30_000;

export async function POST(request: Request): Promise<NextResponse> {
  // Google Drive push notifications use headers, not a signed body.
  // Verify the channel ID maps to a known registered channel.
  const channelId = request.headers.get("x-goog-channel-id");
  const resourceState = request.headers.get("x-goog-resource-state");

  if (!channelId) {
    return NextResponse.json({ error: "Missing channel ID" }, { status: 400 });
  }

  // sync/add/update/remove are real changes; "sync" is the initial handshake ping
  if (resourceState === "sync") {
    return NextResponse.json({ ok: true });
  }

  const supabase = createServiceClient();

  // Look up which workspace/user this channel belongs to.
  // secret holds the channelId (changes on each renewal); key is the stable "channel" row.
  const { data: channelRow } = await supabase
    .from("webhook_secrets")
    .select("workspace_id, user_id")
    .eq("provider", "drive")
    .eq("secret", channelId)
    .maybeSingle();

  if (!channelRow) {
    // Unknown channel - may have been re-registered with a new ID; ack to stop retries
    return NextResponse.json({ ok: true });
  }

  const { workspace_id: workspaceId, user_id: userId } = channelRow;

  // Debounce: Drive sends multiple notifications per file change
  const now = Date.now();
  const { data: lockState } = await supabase
    .from("sync_state")
    .select("last_synced_at")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("source", "drive:webhook_lock")
    .maybeSingle();

  if (lockState?.last_synced_at && (now - lockState.last_synced_at) < DEBOUNCE_MS) {
    return NextResponse.json({ ok: true });
  }

  await supabase.from("sync_state").upsert(
    { workspace_id: workspaceId, user_id: userId, source: "drive:webhook_lock", last_synced_at: now, cursor: null },
    { onConflict: "workspace_id,user_id,source" }
  );

  // Fire incremental sync - uses the changes.list cursor stored from previous run
  runDriveSyncForUser(workspaceId, userId).catch((err: any) => {
    if (logReauthNeeded(err, `webhook/drive workspace=${workspaceId}`)) return;
    console.error("[webhook/drive] sync failed:", err?.message);
  });

  return NextResponse.json({ ok: true });
}
