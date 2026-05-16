import { requireWorkspace, isErrorResponse } from "@/lib/get-workspace";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { getAsanaToken, getGmailToken, getDriveToken } from "@/lib/agency-db";
import { google } from "googleapis";

const TOOL_PROVIDERS: Record<string, string> = {
  gmail: "google-gmail",
  drive: "google-drive",
  asana: "asana",
};

// ---------------------------------------------------------------------------
// Per-connector helpers - data deletes first (idempotent), then webhook dereg
// (best-effort), then oauth_tokens deletion last. Order matters: if a step
// fails the caller can retry without forcing re-auth.
// ---------------------------------------------------------------------------

async function disconnectGmail(
  supabase: ReturnType<typeof createServiceClient>,
  workspaceId: string,
  userId: string
): Promise<void> {
  // 1. Delete indexed data (mirrors /api/workspace/delete-data exactly)
  await supabase.from("embeddings").delete().eq("workspace_id", workspaceId).eq("user_id", userId);
  await supabase.from("messages").delete().eq("workspace_id", workspaceId).eq("user_id", userId);
  await supabase.from("sync_state").delete().eq("workspace_id", workspaceId).eq("user_id", userId).like("source", "gmail%");

  // 2. Stop Gmail push watch (best-effort).
  // Gmail push uses Pub/Sub - there is no per-connection channel ID to stop.
  // Deleting the webhook_secrets row prevents re-sync; the Pub/Sub subscription
  // stops delivering once the token is revoked by Google after oauth_tokens deletion.
  // We still attempt watch.stop via the Gmail API if we can get a valid token,
  // so the Pub/Sub topic quota is freed immediately.
  try {
    const token = await getGmailToken(workspaceId, userId);
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: token });
    const gmail = google.gmail({ version: "v1", auth });
    await gmail.users.stop({ userId: "me" });
  } catch {
    // Non-fatal. The watch expires naturally (max 7 days); deleting the row below
    // ensures we stop processing any incoming Pub/Sub notifications.
  }

  // 3. Remove webhook metadata rows
  await supabase.from("webhook_secrets").delete().eq("workspace_id", workspaceId).eq("user_id", userId).eq("provider", "gmail");

  // 4. Remove OAuth token (last so retries above can still use it)
  await supabase.from("oauth_tokens").delete().eq("workspace_id", workspaceId).eq("user_id", userId).eq("provider", "google-gmail");
}

async function disconnectDrive(
  supabase: ReturnType<typeof createServiceClient>,
  workspaceId: string,
  userId: string
): Promise<void> {
  // 1. Delete indexed data (mirrors /api/workspace/delete-data exactly)
  await supabase.from("drive_embeddings").delete().eq("workspace_id", workspaceId).eq("user_id", userId);
  await supabase.from("drive_files").delete().eq("workspace_id", workspaceId).eq("user_id", userId);
  await supabase.from("sync_state").delete().eq("workspace_id", workspaceId).eq("user_id", userId).like("source", "drive%");

  // 2. Stop Drive push channel (best-effort).
  // secret = channelId, meta.resourceId = what Google needs to stop the channel.
  // Pattern matches /api/webhooks/drive/register/route.ts exactly.
  try {
    const { data: channelRow } = await supabase
      .from("webhook_secrets")
      .select("secret, meta")
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .eq("provider", "drive")
      .eq("key", "channel")
      .maybeSingle();

    if (channelRow?.secret && (channelRow.meta as Record<string, unknown>)?.resourceId) {
      const token = await getDriveToken(workspaceId, userId);
      const stopAuth = new google.auth.OAuth2();
      stopAuth.setCredentials({ access_token: token });
      const stopDrive = google.drive({ version: "v3", auth: stopAuth });
      await stopDrive.channels.stop({
        requestBody: {
          id: channelRow.secret,
          resourceId: String((channelRow.meta as Record<string, unknown>).resourceId),
        },
      });
    }
  } catch {
    // Non-fatal. Orphaned channels expire after at most 7 days.
  }

  // 3. Remove webhook metadata rows
  await supabase.from("webhook_secrets").delete().eq("workspace_id", workspaceId).eq("user_id", userId).eq("provider", "drive");

  // 4. Remove OAuth token (last so retries above can still use it)
  await supabase.from("oauth_tokens").delete().eq("workspace_id", workspaceId).eq("user_id", userId).eq("provider", "google-drive");
}

async function disconnectAsana(
  supabase: ReturnType<typeof createServiceClient>,
  workspaceId: string,
  userId: string
): Promise<void> {
  // 1. Delete indexed data (mirrors /api/workspace/delete-data exactly)
  await supabase.from("asana_embeddings").delete().eq("workspace_id", workspaceId).eq("user_id", userId);
  await supabase.from("asana_items").delete().eq("workspace_id", workspaceId).eq("user_id", userId);
  await supabase.from("sync_state").delete().eq("workspace_id", workspaceId).eq("user_id", userId).like("source", "asana%");

  // 2. Deregister Asana webhooks (best-effort).
  // Original logic preserved from the previous disconnect handler.
  const targetMarker = `workspace_id=${workspaceId}`;
  try {
    const token = await getAsanaToken(workspaceId, userId);
    const wsRes = await fetch("https://app.asana.com/api/1.0/workspaces", {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    const { data: asanaWorkspaces } = (await wsRes.json()) as { data?: Array<{ gid: string }> };

    for (const asanaWs of asanaWorkspaces ?? []) {
      const hookRes = await fetch(
        `https://app.asana.com/api/1.0/webhooks?workspace=${asanaWs.gid}&opt_fields=target`,
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } }
      );
      const { data: hooks } = (await hookRes.json()) as { data?: Array<{ gid: string; target: string }> };
      for (const hook of hooks ?? []) {
        if (hook.target?.includes(targetMarker)) {
          await fetch(`https://app.asana.com/api/1.0/webhooks/${hook.gid}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => {});
        }
      }
    }
  } catch {
    // Non-fatal. Orphan webhooks fail open once the token is gone and Asana
    // eventually deactivates them.
  }

  // 3. Remove webhook metadata rows
  await supabase.from("webhook_secrets").delete().eq("workspace_id", workspaceId).eq("user_id", userId).eq("provider", "asana");

  // 4. Remove OAuth token (last so retries above can still use it)
  await supabase.from("oauth_tokens").delete().eq("workspace_id", workspaceId).eq("user_id", userId).eq("provider", "asana");
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

// Removes all indexed data and disconnects the tool completely.
// Fulfills the UI promise: "This removes all indexed data for this tool."
export async function POST(request: Request): Promise<NextResponse> {
  const _ws = await requireWorkspace();
  if (isErrorResponse(_ws)) return _ws;
  const { workspaceId, userId } = _ws;

  const { tool } = (await request.json()) as { tool: string };
  const provider = TOOL_PROVIDERS[tool];
  if (!provider) return NextResponse.json({ error: "Unknown tool" }, { status: 400 });

  const supabase = createServiceClient();

  if (tool === "gmail") {
    await disconnectGmail(supabase, workspaceId, userId);
  } else if (tool === "drive") {
    await disconnectDrive(supabase, workspaceId, userId);
  } else if (tool === "asana") {
    await disconnectAsana(supabase, workspaceId, userId);
  }

  return NextResponse.json({ ok: true });
}
