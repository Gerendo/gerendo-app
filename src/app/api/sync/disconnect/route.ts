import { requireWorkspace, isErrorResponse } from "@/lib/get-workspace";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { getAsanaToken } from "@/lib/agency-db";

const TOOL_PROVIDERS: Record<string, string> = {
  gmail: "google-gmail",
  drive: "google-drive",
  asana: "asana",
};

// Removes the OAuth token so the tool stops syncing.
// Does NOT delete indexed data - use /api/workspace/delete-data for that.
export async function POST(request: Request): Promise<NextResponse> {
  const _ws = await requireWorkspace();
  if (isErrorResponse(_ws)) return _ws;
  const { workspaceId, userId } = _ws;

  const { tool } = await request.json() as { tool: string };
  const provider = TOOL_PROVIDERS[tool];
  if (!provider) return NextResponse.json({ error: "Unknown tool" }, { status: 400 });

  const supabase = createServiceClient();

  // For Asana, try to deregister webhooks while we still have the token.
  // Best-effort: failures here are non-fatal since orphan webhooks fail open
  // once the token is gone, and Asana eventually deactivates them.
  if (tool === "asana") {
    try {
      const token = await getAsanaToken(workspaceId, userId);
      const targetMarker = `workspace_id=${workspaceId}`;
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
      // Non-fatal. Local cleanup still proceeds.
    }

    await supabase.from("webhook_secrets")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .eq("provider", "asana");
  }

  await supabase.from("oauth_tokens")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("provider", provider);

  return NextResponse.json({ ok: true });
}
