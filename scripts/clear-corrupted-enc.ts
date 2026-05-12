// One-off recovery: NULL all _enc columns. Used because the first backfill run
// stored JSON-wrapped Buffer garbage instead of real ciphertext (Supabase JS
// serialized the raw Buffer via Buffer.toJSON() before sending to bytea).
// Plaintext columns are NOT touched — they remain the source of truth until
// we re-run --mode encrypt with the fixed code.

import { createClient } from "@supabase/supabase-js";

const TARGETS = [
  ["embeddings", "keyword_text_enc"],
  ["drive_embeddings", "keyword_text_enc"],
  ["asana_embeddings", "keyword_text_enc"],
  ["summaries", "summary_enc"],
  ["facts", "detail_enc"],
  ["messages", "subject_enc"],
  ["oauth_tokens", "access_token_enc"],
  ["oauth_tokens", "refresh_token_enc"],
] as const;

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  for (const [table, col] of TARGETS) {
    // Supabase JS requires a filter on .update(). Match all rows where _enc is
    // currently non-null (the only ones that need clearing).
    const { error, count } = await sb
      .from(table)
      .update({ [col]: null }, { count: "exact" })
      .not(col, "is", null);
    if (error) {
      console.error(`FAIL ${table}.${col}: ${error.message}`);
      process.exit(1);
    }
    console.log(`OK   ${table}.${col}: cleared ${count ?? 0} rows`);
  }
  console.log("\nDone. Plaintext columns untouched.");
}
main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(2);
});
