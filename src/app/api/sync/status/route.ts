import { requireWorkspace, isErrorResponse } from "@/lib/get-workspace";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

export async function GET(): Promise<NextResponse> {
  const _ws = await requireWorkspace();
  if (isErrorResponse(_ws)) return _ws;
  const { workspaceId } = _ws;
  const supabase = createServiceClient();

  const { data } = await supabase
    .from("sync_jobs")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return NextResponse.json({ status: "idle" });

  // Treat stuck jobs as done: running for >5min with nothing synced, or >30min regardless
  const startedAtMs = data.started_at ? new Date(data.started_at).getTime() : 0;
  const ageMs = startedAtMs ? Date.now() - startedAtMs : 0;
  const isStuck = data.status === "running" && startedAtMs && (
    (ageMs > 5 * 60 * 1000 && !data.total_synced) ||
    ageMs > 30 * 60 * 1000
  );
  const status = isStuck ? "done" : data.status;

  return NextResponse.json({
    status,
    currentLabel: data.current_label,
    labelProgress: data.label_progress,
    totalSynced: data.total_synced,
    startedAt: data.started_at,
    finishedAt: data.finished_at,
  });
}
