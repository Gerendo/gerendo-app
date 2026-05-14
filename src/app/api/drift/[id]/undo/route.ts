import { NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceClient } from "@/lib/supabase-server";
import { getAsanaToken } from "@/lib/agency-db";
import { decryptColumn } from "@/lib/crypto-storage";
import { aad } from "@/lib/crypto-aad";

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
    .select("id, action_type, target_system, target_id, payload_before_enc")
    .eq("drift_finding_id", findingId)
    .eq("status", "success")
    .order("executed_at", { ascending: false });

  if (!logs?.length) {
    return NextResponse.json({ status: "nothing-to-undo" });
  }

  // Actions Gerendo cannot reverse via Asana API (no destructive endpoints
  // wired up; deletion of created projects/tasks/sections is a manual
  // operation the user must do in Asana). If any of these were logged, the
  // drift finding stays resolved — we don't pretend it's "pending" again.
  const NON_UNDOABLE: ReadonlySet<string> = new Set([
    "asana.create_project",
    "asana.create_section",
    "asana.create_task",
  ]);

  const token = await getAsanaToken(finding.workspace_id as string, user.id);
  const undone: number[] = [];
  const failed: Array<{ id: number; error: string }> = [];
  const nonUndoable: Array<{ id: number; action_type: string; target_id: string | null }> = [];

  for (const log of logs) {
    if (log.target_system !== "asana" || !log.target_id) continue;
    if (NON_UNDOABLE.has(log.action_type as string)) {
      nonUndoable.push({
        id: log.id as number,
        action_type: log.action_type as string,
        target_id: log.target_id as string,
      });
      continue;
    }
    try {
      if (log.action_type === "asana.update_task" && log.payload_before_enc) {
        const before = JSON.parse(
          decryptColumn(
            log.payload_before_enc,
            aad.actionLogPayloadBefore(log.id as number)
          )
        ) as AsanaBeforePayload;
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

  // Only revert the finding to "pending" when we actually undid the Asana
  // side-effect. If every log was non-undoable (create_*) or every undo
  // failed, the finding stays resolved so the user doesn't re-accept and
  // create duplicate projects/tasks.
  if (undone.length > 0) {
    await service
      .from("drift_findings")
      .update({ status: "pending", resolved_at: null, resolution_note_enc: null })
      .eq("id", findingId);
    return NextResponse.json({ status: "undone", undone, failed, nonUndoable });
  }
  if (nonUndoable.length > 0 && failed.length === 0) {
    return NextResponse.json({
      status: "no-op",
      reason: "Asana side-effects from create_* actions cannot be reverted automatically. Delete the created project/task/section in Asana if you want to roll back.",
      nonUndoable,
    });
  }
  return NextResponse.json({ status: "undone", undone, failed, nonUndoable });
}
