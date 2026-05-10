import { requireWorkspace, isErrorResponse } from "@/lib/get-workspace";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

// Deletes all indexed data and disconnects the OAuth tokens for the affected tools.
// Keeps the user's account - they can reconnect and start fresh.
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
    await supabase.from("oauth_tokens").delete().eq("workspace_id", workspaceId).eq("user_id", userId).eq("provider", "google-gmail");
  }
  if (tool === "drive" || !tool) {
    await supabase.from("drive_embeddings").delete().eq("workspace_id", workspaceId).eq("user_id", userId);
    await supabase.from("drive_files").delete().eq("workspace_id", workspaceId).eq("user_id", userId);
    await supabase.from("sync_state").delete().eq("workspace_id", workspaceId).eq("user_id", userId).like("source", "drive%");
    await supabase.from("webhook_secrets").delete().eq("workspace_id", workspaceId).eq("user_id", userId).eq("provider", "drive");
    await supabase.from("oauth_tokens").delete().eq("workspace_id", workspaceId).eq("user_id", userId).eq("provider", "google-drive");
  }
  if (tool === "asana" || !tool) {
    await supabase.from("asana_embeddings").delete().eq("workspace_id", workspaceId).eq("user_id", userId);
    await supabase.from("asana_items").delete().eq("workspace_id", workspaceId).eq("user_id", userId);
    await supabase.from("sync_state").delete().eq("workspace_id", workspaceId).eq("user_id", userId).like("source", "asana%");
    await supabase.from("webhook_secrets").delete().eq("workspace_id", workspaceId).eq("user_id", userId).eq("provider", "asana");
    await supabase.from("oauth_tokens").delete().eq("workspace_id", workspaceId).eq("user_id", userId).eq("provider", "asana");
  }
  if (!tool) {
    const { data: member } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .maybeSingle();
    if (member?.role !== "owner" && member?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await supabase.from("summaries").delete().eq("workspace_id", workspaceId);
    await supabase.from("facts").delete().eq("workspace_id", workspaceId);
    await supabase.from("workspace_contexts").delete().eq("workspace_id", workspaceId);
  }

  return NextResponse.json({ ok: true });
}
