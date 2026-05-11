import { requireWorkspace, isErrorResponse } from "@/lib/get-workspace";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

export async function GET(): Promise<NextResponse> {
  const _ws = await requireWorkspace();
  if (isErrorResponse(_ws)) return _ws;
  const { workspaceId, userId } = _ws;
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
  const isStuck = data.status === "running" && startedAtMs && ageMs > 30 * 60 * 1000;
  const status = isStuck ? "done" : data.status;

  // total_synced in sync_jobs is unreliable (DB write can fail silently).
  // Always read the real count from the messages table so the progress bar is accurate.
  let totalSynced = data.total_synced ?? 0;
  if (data.status === "running" || !totalSynced) {
    const { count } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .eq("source", "gmail");
    if (count !== null) totalSynced = count;
  }

  return NextResponse.json({
    status,
    currentLabel: data.current_label,
    labelProgress: data.label_progress,
    totalSynced,
    startedAt: data.started_at,
    finishedAt: data.finished_at,
  });
}
