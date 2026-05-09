import { requireWorkspace, isErrorResponse } from "@/lib/get-workspace";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

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

  await supabase.from("oauth_tokens")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("provider", provider);

  return NextResponse.json({ ok: true });
}
