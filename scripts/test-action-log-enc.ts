// End-to-end test for action_log encryption: write a row via the same
// 2-step pattern logAction() uses, read it back, decrypt, and clean up.

import { createClient } from "@supabase/supabase-js";
import { encryptForBytea, decryptColumn } from "@/lib/crypto-storage";
import { aad } from "@/lib/crypto-aad";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log("=== action_log encryption round-trip ===");

  // Need a real workspace + user
  const { data: member } = await sb
    .from("workspace_members")
    .select("workspace_id, user_id")
    .limit(1)
    .single();
  if (!member) throw new Error("no workspace_members");

  const payloadBefore = {
    due_on: "2026-06-01",
    name: "QA Tech Audit",
    notes: "Sensitive PII that must not leak into the audit log JSONB.",
    completed: false,
  };
  const payloadAfter = {
    story_gid: "fake-gid-12345",
    text: "Decision: ship this. Source: https://example.com/citation",
  };

  // Step 1: insert stub
  const { data: row, error: insErr } = await sb
    .from("action_log")
    .insert({
      workspace_id: member.workspace_id,
      drift_finding_id: null,
      action_type: "test.action_log_encrypt",
      target_system: "asana",
      target_id: "fake-target",
      executed_by: member.user_id,
      status: "success",
    })
    .select("id")
    .single();
  if (insErr || !row) throw new Error(`stub insert: ${insErr?.message}`);
  const id = row.id as number;

  // Step 2: encrypt + update
  const payloadBeforeEnc = encryptForBytea(JSON.stringify(payloadBefore), aad.actionLogPayloadBefore(id));
  const payloadAfterEnc = encryptForBytea(JSON.stringify(payloadAfter), aad.actionLogPayloadAfter(id));
  await sb
    .from("action_log")
    .update({ payload_before_enc: payloadBeforeEnc, payload_after_enc: payloadAfterEnc })
    .eq("id", id);

  // Read back + decrypt
  const { data: read } = await sb
    .from("action_log")
    .select("id, payload_before_enc, payload_after_enc")
    .eq("id", id)
    .single();
  const decBefore = JSON.parse(decryptColumn(read!.payload_before_enc, aad.actionLogPayloadBefore(id)));
  const decAfter = JSON.parse(decryptColumn(read!.payload_after_enc, aad.actionLogPayloadAfter(id)));

  const beforeOk = decBefore.notes === payloadBefore.notes && decBefore.due_on === payloadBefore.due_on;
  const afterOk = decAfter.text === payloadAfter.text;
  console.log(beforeOk ? "OK payload_before round-trip" : `FAIL payload_before: ${JSON.stringify(decBefore)}`);
  console.log(afterOk ? "OK payload_after round-trip" : `FAIL payload_after: ${JSON.stringify(decAfter)}`);

  // AAD tamper: try to decrypt before-blob with after-AAD; must fail.
  try {
    decryptColumn(read!.payload_before_enc, aad.actionLogPayloadAfter(id));
    console.log("FAIL AAD tamper not rejected");
  } catch {
    console.log("OK AAD tamper rejected");
  }

  // Cleanup
  await sb.from("action_log").delete().eq("id", id);
  console.log("cleanup complete");

  if (!beforeOk || !afterOk) process.exit(1);
}
main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
