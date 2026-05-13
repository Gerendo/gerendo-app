import { NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceClient } from "@/lib/supabase-server";
import { getAsanaToken } from "@/lib/agency-db";

type AsanaBeforePayload = {
  due_on?: string | null;
  name?: string;
  notes?: string;
  completed?: boolean;
};

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const findingId = parseInt(id, 10);
  if (!Number.isFinite(findingId)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const service = createServiceClient();

  // Verify the user owns this finding.
  const { data: finding } = await service
    .from("drift_findings")
    .select("id, user_id, workspace_id")
    .eq("id", findingId)
    .maybeSingle();
  if (!finding) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (finding.user_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { data: logs } = await service
    .from("action_log")
    .select("id, action_type, target_system, target_id, payload_before")
    .eq("drift_finding_id", findingId)
    .eq("status", "success")
    .order("executed_at", { ascending: false });

  if (!logs?.length) {
    return NextResponse.json({ status: "nothing-to-undo" });
  }

  const token = await getAsanaToken(finding.workspace_id as string, user.id);
  const undone: number[] = [];
  const failed: Array<{ id: number; error: string }> = [];

  for (const log of logs) {
    if (log.target_system !== "asana" || !log.target_id) continue;
    try {
      if (log.action_type === "asana.update_task" && log.payload_before) {
        const before = log.payload_before as AsanaBeforePayload;
        const res = await fetch(`https://app.asana.com/api/1.0/tasks/${log.target_id}`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            data: {
              due_on: before.due_on ?? null,
              ...(before.name !== undefined ? { name: before.name } : {}),
              ...(before.notes !== undefined ? { notes: before.notes } : {}),
              ...(before.completed !== undefined ? { completed: before.completed } : {}),
            },
          }),
        });
        if (!res.ok) throw new Error(`Asana PUT ${res.status}`);
      } else if (log.action_type === "asana.add_comment") {
        const res = await fetch(`https://app.asana.com/api/1.0/tasks/${log.target_id}/stories`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            data: { text: "[Gerendo] Previous decision update was undone by the user." },
          }),
        });
        if (!res.ok) throw new Error(`Asana POST ${res.status}`);
      } else {
        continue;
      }
      await service.from("action_log").update({ status: "undone" }).eq("id", log.id);
      undone.push(log.id as number);
    } catch (err: unknown) {
      failed.push({
        id: log.id as number,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  await service
    .from("drift_findings")
    .update({ status: "pending", resolved_at: null, resolution_note_enc: null })
    .eq("id", findingId);

  return NextResponse.json({ status: "undone", undone, failed });
}
