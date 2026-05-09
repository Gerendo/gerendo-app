import { requireWorkspace, isErrorResponse } from "@/lib/get-workspace";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

// Deletes all indexed data for the workspace (or a single tool).
// OAuth tokens are preserved - connected tools will re-sync from scratch on next run.
export async function POST(request: Request): Promise<NextResponse> {
  const _ws = await requireWorkspace();
  if (isErrorResponse(_ws)) return _ws;
  const { workspaceId, userId } = _ws;

  const { tool } = await request.json().catch(() => ({})) as { tool?: string };

  const supabase = createServiceClient();

  if (tool === "gmail" || !tool) {
    await supabase.from("embeddings").delete().eq("workspace_id", workspaceId).eq("user_id", userId);
    await supabase.from("messages").delete().eq("workspace_id", workspaceId).eq("user_id", userId);
    await supabase.from("sync_state").delete().eq("workspace_id", workspaceId).eq("user_id", userId).like("source", "gmail%");
    await supabase.from("webhook_secrets").delete().eq("workspace_id", workspaceId).eq("user_id", userId).eq("provider", "gmail");
  }
  if (tool === "drive" || !tool) {
    await supabase.from("drive_embeddings").delete().eq("workspace_id", workspaceId).eq("user_id", userId);
    await supabase.from("drive_files").delete().eq("workspace_id", workspaceId).eq("user_id", userId);
    await supabase.from("sync_state").delete().eq("workspace_id", workspaceId).eq("user_id", userId).like("source", "drive%");
  }
  if (tool === "asana" || !tool) {
    await supabase.from("asana_embeddings").delete().eq("workspace_id", workspaceId).eq("user_id", userId);
    await supabase.from("asana_items").delete().eq("workspace_id", workspaceId).eq("user_id", userId);
    await supabase.from("sync_state").delete().eq("workspace_id", workspaceId).eq("user_id", userId).like("source", "asana%");
    await supabase.from("webhook_secrets").delete().eq("workspace_id", workspaceId).eq("user_id", userId).eq("provider", "asana");
  }
  if (!tool) {
    await supabase.from("summaries").delete().eq("workspace_id", workspaceId);
    await supabase.from("facts").delete().eq("workspace_id", workspaceId);
    await supabase.from("workspace_contexts").delete().eq("workspace_id", workspaceId);
  }

  return NextResponse.json({ ok: true });
}
