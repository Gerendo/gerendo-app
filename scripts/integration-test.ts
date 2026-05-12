// End-to-end integration test for the encryption changes.
// Exercises the production write/read code paths (NOT the backfill script).
//
// What it does:
//   1. Picks an existing workspace + user (from oauth_tokens).
//   2. Inserts a test fact via the production insertFact() function.
//   3. Reads the row directly from Supabase, asserts BOTH detail and detail_enc
//      are populated and the bytea wire format is correct (\x prefix).
//   4. Re-reads via decryptOrFallback to confirm the decrypted value matches
//      the original plaintext.
//   5. Inserts a test summary via upsertSummary().
//   6. Reads via getSummariesByMessageIds() — the production decryption path.
//   7. Cleans up both test rows.
//
// All assertions are explicit. The script exits non-zero on first failure.

import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { insertFact, upsertSummary, getSummariesByMessageIds, type AgencyDb } from "@/lib/agency-db";
import { decrypt, parseBytea } from "@/lib/crypto-storage";
import { aad } from "@/lib/crypto-aad";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function ok(label: string): void {
  console.log(`OK   ${label}`);
}

async function main() {
  console.log("=== integration test: production write/read paths ===\n");

  // 1. Pick an existing workspace + user
  const { data: tokenRow, error: tokenErr } = await sb
    .from("oauth_tokens")
    .select("workspace_id, user_id")
    .limit(1)
    .maybeSingle();
  if (tokenErr || !tokenRow) throw new Error("no existing workspace/user to test with");
  const db: AgencyDb = { supabase: sb, workspaceId: tokenRow.workspace_id, userId: tokenRow.user_id };
  ok(`picked workspace=${tokenRow.workspace_id.slice(0, 8)}... user=${tokenRow.user_id.slice(0, 8)}...`);

  // 2. Insert test fact via production code
  const testDetail = `INTEGRATION TEST ${Date.now()} — body content that must encrypt round-trip cleanly. ✓ Romanian: Ștefan, emojis: ⚡🔐, newlines:\nhello\tworld.`;
  const testFact = {
    messageId: null,
    type: "integration-test",
    subject: "encryption-roundtrip",
    detail: testDetail,
    client: null,
  };
  await insertFact(db, testFact);
  ok("insertFact() returned without throwing");

  // 3. Inspect the inserted row directly
  const { data: factRow, error: factErr } = await sb
    .from("facts")
    .select("id, detail, detail_enc")
    .eq("workspace_id", db.workspaceId)
    .eq("type", "integration-test")
    .eq("subject", "encryption-roundtrip")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (factErr || !factRow) throw new Error(`could not re-read test fact: ${factErr?.message}`);
  ok(`re-read test fact id=${factRow.id}`);

  assert.equal(factRow.detail, testDetail, "plaintext detail should match what we inserted");
  ok("plaintext detail column matches input");

  assert.ok(factRow.detail_enc, "detail_enc must be non-null");
  ok("detail_enc column is populated");

  // 4. Verify the bytea wire format
  const encRaw = factRow.detail_enc as unknown;
  assert.ok(typeof encRaw === "string" || Buffer.isBuffer(encRaw), `detail_enc must be string or Buffer (got ${typeof encRaw})`);
  const encStr = typeof encRaw === "string" ? encRaw : encRaw.toString();
  if (typeof encRaw === "string") {
    assert.ok(encStr.startsWith("\\x"), `bytea string must start with \\x (got: ${JSON.stringify(encStr.slice(0, 10))})`);
    ok("bytea returned as \\x-prefixed hex string (correct wire format)");
  } else {
    ok("bytea returned as Buffer (also valid)");
  }

  // 5. Decrypt the bytea and verify round-trip
  const buf = parseBytea(encRaw as Buffer | string);
  assert.equal(buf[0], 0x01, `first byte should be version 0x01 (got 0x${buf[0].toString(16)})`);
  ok("version byte is 0x01");

  const aadStr = aad.factsDetail(db.workspaceId, null, "integration-test", "encryption-roundtrip");
  const decrypted = decrypt(buf, aadStr);
  assert.equal(decrypted, testDetail, "decrypted detail must equal original plaintext");
  ok("decrypt(detail_enc) === original plaintext (round-trip verified, including Romanian + emoji + newlines)");

  // 6. Now test the summary path (write via production, read via production)
  // Need a real message_id. Get any existing message.
  const { data: msgRow } = await sb
    .from("messages")
    .select("id")
    .eq("workspace_id", db.workspaceId)
    .limit(1)
    .maybeSingle();
  if (!msgRow) {
    console.log("SKIP summary test — no messages in this workspace");
  } else {
    const testSummary = `INTEGRATION TEST summary @ ${Date.now()} — must encrypt round-trip`;
    await upsertSummary(db, msgRow.id, testSummary);
    ok(`upsertSummary() wrote test summary for message_id=${msgRow.id}`);

    const summaries = await getSummariesByMessageIds(db, [msgRow.id]);
    assert.equal(summaries.length, 1, "should fetch exactly 1 summary");
    assert.equal(summaries[0].summary, testSummary, "decrypted summary must match original");
    ok("getSummariesByMessageIds() returned the correctly decrypted summary");

    // Cleanup summary
    await sb.from("summaries").delete().eq("workspace_id", db.workspaceId).eq("message_id", msgRow.id);
    ok("cleaned up test summary");
  }

  // 7. Cleanup test fact
  await sb.from("facts").delete().eq("id", factRow.id);
  ok("cleaned up test fact");

  console.log("\n✓ ALL INTEGRATION TESTS PASSED");
  process.exit(0);
}

main().catch((e) => {
  console.error("\nFAIL:", e.message || e);
  process.exit(1);
});
