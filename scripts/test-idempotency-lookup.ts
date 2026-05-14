// End-to-end test for action_log idempotency lookups. Insert a couple of
// fake action_log rows, query via the same helpers the routes use, verify
// they return the expected target_ids. Clean up after itself.

import { createClient } from "@supabase/supabase-js";
import { getExistingActionTargetId, hasActionSucceeded } from "@/lib/action-log-idempotency";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log("=== action_log idempotency lookup ===");

  // Find a real finding to attach to (or pick any drift_finding_id; the column
  // is a FK so the row must exist).
  const { data: finding } = await sb.from("drift_findings").select("id").limit(1).maybeSingle();
  if (!finding) {
    console.log("no drift_findings; skipping (idempotency lookup needs a finding to FK to)");
    return;
  }
  const findingId = finding.id as number;

  // Find any workspace to attach the log row to
  const { data: member } = await sb.from("workspace_members").select("workspace_id, user_id").limit(1).single();
  if (!member) throw new Error("no workspace_members");

  // Insert fake success rows
  const fakeProjectGid = `idem-test-project-${Date.now()}`;
  const fakeTaskGid = `idem-test-task-${Date.now()}`;
  const inserts = [
    { action_type: "asana.create_project", target_id: fakeProjectGid, status: "success" as const },
    { action_type: "asana.create_task", target_id: fakeTaskGid, status: "success" as const },
    { action_type: "asana.add_comment", target_id: fakeTaskGid, status: "success" as const },
    // Plus an UNDONE row that must be ignored by the lookup
    { action_type: "asana.update_task", target_id: "idem-test-undone", status: "undone" as const },
  ];
  const { data: rows, error: insErr } = await sb.from("action_log").insert(
    inserts.map(r => ({
      workspace_id: member.workspace_id,
      drift_finding_id: findingId,
      action_type: r.action_type,
      target_system: "asana",
      target_id: r.target_id,
      executed_by: member.user_id,
      status: r.status,
    }))
  ).select("id");
  if (insErr || !rows) throw new Error(`insert: ${insErr?.message}`);

  // Test getExistingActionTargetId
  const projectLookup = await getExistingActionTargetId(sb, findingId, "asana.create_project");
  console.log(projectLookup === fakeProjectGid
    ? `OK create_project lookup → ${projectLookup}`
    : `FAIL create_project lookup → ${projectLookup} (expected ${fakeProjectGid})`);

  const taskLookup = await getExistingActionTargetId(sb, findingId, "asana.create_task");
  console.log(taskLookup === fakeTaskGid
    ? `OK create_task lookup → ${taskLookup}`
    : `FAIL create_task lookup → ${taskLookup}`);

  // Test hasActionSucceeded
  const commented = await hasActionSucceeded(sb, findingId, "asana.add_comment");
  console.log(commented ? "OK add_comment hasSucceeded" : "FAIL add_comment hasSucceeded");

  // Test that an UNDONE row is NOT returned
  const undoneLookup = await getExistingActionTargetId(sb, findingId, "asana.update_task");
  console.log(undoneLookup === null
    ? "OK undone row correctly excluded from lookup"
    : `FAIL undone row leaked: ${undoneLookup}`);

  // Test that a never-attempted action returns null
  const neverAttempted = await getExistingActionTargetId(sb, findingId, "asana.create_section");
  console.log(neverAttempted === null
    ? "OK never-attempted action returns null"
    : `FAIL never-attempted leaked: ${neverAttempted}`);

  // Cleanup
  await sb.from("action_log").delete().in("id", rows.map(r => r.id));
  console.log("cleanup complete");
}
main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
