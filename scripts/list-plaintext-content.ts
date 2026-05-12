// Survey: which text columns currently store user content + PII?
// Excludes IDs, FKs, timestamps, enums.

import { createClient } from "@supabase/supabase-js";

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // pg_meta-style: query information_schema for text columns in our tables
  const tables = [
    "messages",
    "drive_files",
    "asana_items",
    "facts",
    "workspace_contexts",
    "drift_findings",
  ];

  for (const table of tables) {
    const { data, error } = await sb
      .from(table)
      .select("*")
      .limit(1)
      .maybeSingle();
    if (error) {
      console.log(`-- ${table}: ${error.message}`);
      continue;
    }
    if (!data) {
      console.log(`-- ${table}: no rows`);
      continue;
    }
    console.log(`\n=== ${table} ===`);
    for (const [col, v] of Object.entries(data)) {
      const t = typeof v;
      const sample = v === null ? "NULL" :
        t === "string" ? `"${(v as string).slice(0, 40)}"${(v as string).length > 40 ? "..." : ""}` :
        Buffer.isBuffer(v) ? `<bytea ${(v as Buffer).length}B>` :
        String(v).slice(0, 30);
      const tag = col.endsWith("_enc") ? "[ENC]" :
        col === "id" || col.endsWith("_id") || col.endsWith("_at") ? "[op]" :
        t === "string" ? "[text]" :
        "[?]";
      console.log(`  ${tag.padEnd(7)} ${col.padEnd(25)} = ${sample}`);
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
