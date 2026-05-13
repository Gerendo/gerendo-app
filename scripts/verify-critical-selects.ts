// Verify the three critical-bug selects actually succeed against live DB now.
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  console.log("=== drift_findings accept-route select ===");
  const r1 = await sb
    .from("drift_findings")
    .select("id, workspace_id, user_id, decision_summary_enc, draft_update_enc, asana_item_id, status, source, source_external_id")
    .limit(1);
  console.log(r1.error ? `FAIL ${r1.error.code} ${r1.error.message}` : `OK ${r1.data?.length} row(s)`);

  console.log("=== drift_findings create-project-route select ===");
  const r2 = await sb
    .from("drift_findings")
    .select("id, workspace_id, user_id, decision_summary_enc, draft_update_enc, asana_item_id, status, source, source_external_id")
    .limit(1);
  console.log(r2.error ? `FAIL ${r2.error.code} ${r2.error.message}` : `OK ${r2.data?.length} row(s)`);

  console.log("=== drive_files getDriveFileContent select ===");
  const r3 = await sb.from("drive_files").select("external_id, mime_type").limit(1);
  console.log(r3.error ? `FAIL ${r3.error.code} ${r3.error.message}` : `OK ${r3.data?.length} row(s)`);

  // For comparison, prove the OLD broken selects still fail:
  console.log("\n=== sanity: old broken selects must still fail ===");
  const o1 = await sb.from("drift_findings").select("decision_summary").limit(1);
  console.log(`old drift_findings.decision_summary → ${o1.error ? `expected fail: ${o1.error.code}` : "UNEXPECTEDLY OK"}`);
  const o2 = await sb.from("drive_files").select("name").limit(1);
  console.log(`old drive_files.name → ${o2.error ? `expected fail: ${o2.error.code}` : "UNEXPECTEDLY OK"}`);
}
main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
