import { requireWorkspace, isErrorResponse } from "@/lib/get-workspace";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

export async function POST(): Promise<NextResponse> {
  const _ws = await requireWorkspace();
  if (isErrorResponse(_ws)) return _ws;
  const { workspaceId } = _ws;

  const supabase = createServiceClient();

  await supabase
    .from("sync_jobs")
    .update({ status: "cancelled", finished_at: new Date().toISOString() })
    .eq("workspace_id", workspaceId)
    .eq("status", "running");

  return NextResponse.json({ ok: true });
}
