// Phase 2 final verification.
// 1. Confirm plaintext columns no longer exist (selecting them errors)
// 2. Confirm _enc columns still hold valid ciphertext
// 3. Round-trip decrypt still works
// 4. FTS RPCs are gone

import { createClient } from "@supabase/supabase-js";
import { decrypt, parseBytea } from "@/lib/crypto-storage";
import { aad } from "@/lib/crypto-aad";

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 1. Plaintext columns should be GONE — selecting them should error
  console.log("=== plaintext columns dropped (should ALL error) ===\n");
  const plaintextChecks: Array<[string, string]> = [
    ["messages", "subject"],
    ["embeddings", "keyword_text"],
    ["drive_embeddings", "keyword_text"],
    ["asana_embeddings", "keyword_text"],
    ["summaries", "summary"],
    ["facts", "detail"],
    ["oauth_tokens", "access_token"],
    ["oauth_tokens", "refresh_token"],
  ];
  for (const [table, col] of plaintextChecks) {
    const { error } = await sb.from(table).select(col).limit(1);
    if (error) {
      console.log(`OK   ${table}.${col} → selecting it errors (column dropped): "${(error.message || "").slice(0, 60)}..."`);
    } else {
      console.log(`FAIL ${table}.${col} → column STILL EXISTS, migration didn't run`);
    }
  }

  // 2. _enc columns still hold data
  console.log("\n=== _enc columns still present and populated ===\n");
  const encChecks: Array<[string, string]> = [
    ["messages", "subject_enc"],
    ["embeddings", "keyword_text_enc"],
    ["drive_embeddings", "keyword_text_enc"],
    ["asana_embeddings", "keyword_text_enc"],
    ["oauth_tokens", "access_token_enc"],
  ];
  for (const [table, col] of encChecks) {
    const { count } = await sb.from(table).select("*", { count: "exact", head: true }).not(col, "is", null);
    console.log(`     ${table}.${col}: ${count ?? 0} rows have ciphertext`);
  }

  // 3. Round-trip decrypt on a few rows
  console.log("\n=== round-trip decrypt sample ===\n");
  const { data: msgs } = await sb
    .from("messages")
    .select("id, workspace_id, user_id, source, external_id, subject_enc")
    .limit(3);
  for (const m of msgs ?? []) {
    try {
      const buf = parseBytea(m.subject_enc as Buffer | string);
      const decrypted = decrypt(
        buf,
        aad.messagesSubject(m.workspace_id, m.user_id, m.source, m.external_id)
      );
      console.log(`OK   messages id=${m.id} subject=${JSON.stringify(decrypted.slice(0, 50))}`);
    } catch (e) {
      console.log(`FAIL messages id=${m.id}: ${(e as Error).message}`);
    }
  }

  // 4. FTS RPCs are gone
  console.log("\n=== dead FTS RPCs dropped ===\n");
  for (const fn of ["fts_search_embeddings", "fts_search_drive", "fts_search_asana"]) {
    const { error } = await sb.rpc(fn, { p_workspace_id: "00000000-0000-0000-0000-000000000000", p_query: "x", p_limit: 1 });
    if (error && /not find the function|does not exist/i.test(error.message)) {
      console.log(`OK   ${fn}() → dropped`);
    } else {
      console.log(`?    ${fn}() → ${error?.message ?? "unexpected success"}`);
    }
  }

  console.log("\n✓ Phase 2 verification complete.");
}
main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
