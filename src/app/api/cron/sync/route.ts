import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { runGmailSyncForUser } from "@/app/api/sync/gmail/route";
import { runDriveSyncForUser } from "@/app/api/sync/drive/route";
import { runAsanaSyncForUser } from "@/app/api/sync/asana/route";

export const maxDuration = 300;

function isAuthorized(request: Request): boolean {
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(request: Request): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const source = searchParams.get("source");

  if (!source) {
    return NextResponse.json({ error: "Missing source param" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: members } = await supabase
    .from("workspace_members")
    .select("workspace_id, user_id");

  if (!members?.length) {
    return NextResponse.json({ ok: true, source, synced: 0 });
  }

  const results: Array<{ workspaceId: string; userId: string; result?: any; error?: string }> = [];

  for (const { workspace_id, user_id } of members) {
    try {
      if (source === "gmail") {
        const result = await runGmailSyncForUser(workspace_id, user_id);
        results.push({ workspaceId: workspace_id, userId: user_id, result });
      } else if (source === "drive") {
        const result = await runDriveSyncForUser(workspace_id, user_id);
        results.push({ workspaceId: workspace_id, userId: user_id, result });
      } else if (source === "asana") {
        const result = await runAsanaSyncForUser(workspace_id, user_id);
        results.push({ workspaceId: workspace_id, userId: user_id, result });
      } else if (source === "gmail-watch-renew") {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
        const res = await fetch(`${appUrl}/api/webhooks/gmail/register`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.CRON_SECRET}`,
          },
          body: JSON.stringify({ workspaceId: workspace_id, userId: user_id }),
        });
        results.push({ workspaceId: workspace_id, userId: user_id, result: await res.json() });
      }
    } catch (err: any) {
      console.error(`[cron/${source}] ${workspace_id}/${user_id}:`, err?.message);
      results.push({ workspaceId: workspace_id, userId: user_id, error: err?.message });
    }
  }

  return NextResponse.json({ ok: true, source, results });
}
