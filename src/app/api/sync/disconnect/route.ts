import { requireWorkspace, isErrorResponse } from "@/lib/get-workspace";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

const TOOL_TABLES: Record<string, { embeddings: string; items: string; provider: string }> = {
  gmail:  { embeddings: "embeddings",       items: "messages",     provider: "google-gmail" },
  drive:  { embeddings: "drive_embeddings", items: "drive_files",  provider: "google-drive" },
  asana:  { embeddings: "asana_embeddings", items: "asana_items",  provider: "asana" },
};

export async function POST(request: Request): Promise<NextResponse> {
  const _ws = await requireWorkspace();
  if (isErrorResponse(_ws)) return _ws;
  const { workspaceId, userId } = _ws;

  const { tool } = await request.json() as { tool: string };
  const tables = TOOL_TABLES[tool];
  if (!tables) return NextResponse.json({ error: "Unknown tool" }, { status: 400 });

  const supabase = createServiceClient();

  // Remove oauth token so sync stops
  await supabase.from("oauth_tokens")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("provider", tables.provider);

  // Remove all indexed data for this tool
  await supabase.from(tables.embeddings).delete().eq("workspace_id", workspaceId);
  await supabase.from(tables.items).delete().eq("workspace_id", workspaceId).eq("user_id", userId);

  // Remove sync state cursors
  await supabase.from("sync_state")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .like("source", `${tool === "gmail" ? "gmail" : tool}%`);

  // Remove webhook secret if gmail
  if (tool === "gmail") {
    await supabase.from("webhook_secrets")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .eq("provider", "gmail");
  }

  return NextResponse.json({ ok: true });
}
