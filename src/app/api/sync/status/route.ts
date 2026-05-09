import { NextResponse } from "next/server";
import { getOrCreateDefaultWorkspace } from "@/lib/agency-db";
import { createServiceClient } from "@/lib/supabase-server";

export async function GET(): Promise<NextResponse> {
  const { workspaceId } = await getOrCreateDefaultWorkspace();
  const supabase = createServiceClient();

  const { data } = await supabase
    .from("sync_jobs")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return NextResponse.json({ status: "idle" });

  return NextResponse.json({
    status: data.status,
    currentLabel: data.current_label,
    labelProgress: data.label_progress,
    totalSynced: data.total_synced,
    startedAt: data.started_at,
    finishedAt: data.finished_at,
  });
}
