// Cross-tenant integrity check. Verifies the embeddings tables' workspace_id
// always matches the parent table's workspace_id. If any mismatch, the
// AAD-on-read could theoretically leak content across tenants.

import { createClient } from "@supabase/supabase-js";

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Supabase JS doesn't expose raw SQL JOINs, but pg_meta does via .rpc.
  // Easier: use the .from(...).select with the relation syntax, then filter
  // in JS. Small dataset so this is fast.

  // Embeddings vs messages
  const { data: emb } = await sb
    .from("embeddings")
    .select("workspace_id, message_id, messages!inner(workspace_id)");
  const embMismatch = (emb ?? []).filter(
    (r: { workspace_id: string; messages: { workspace_id: string } | Array<{ workspace_id: string }> }) => {
      const msgWs = Array.isArray(r.messages) ? r.messages[0]?.workspace_id : r.messages.workspace_id;
      return r.workspace_id !== msgWs;
    }
  );

  // drive_embeddings vs drive_files
  const { data: drv } = await sb
    .from("drive_embeddings")
    .select("workspace_id, file_id, drive_files!inner(workspace_id)");
  const drvMismatch = (drv ?? []).filter(
    (r: { workspace_id: string; drive_files: { workspace_id: string } | Array<{ workspace_id: string }> }) => {
      const fileWs = Array.isArray(r.drive_files) ? r.drive_files[0]?.workspace_id : r.drive_files.workspace_id;
      return r.workspace_id !== fileWs;
    }
  );

  // asana_embeddings vs asana_items
  const { data: asn } = await sb
    .from("asana_embeddings")
    .select("workspace_id, item_id, asana_items!inner(workspace_id)");
  const asnMismatch = (asn ?? []).filter(
    (r: { workspace_id: string; asana_items: { workspace_id: string } | Array<{ workspace_id: string }> }) => {
      const itemWs = Array.isArray(r.asana_items) ? r.asana_items[0]?.workspace_id : r.asana_items.workspace_id;
      return r.workspace_id !== itemWs;
    }
  );

  console.log("=== cross-tenant integrity check ===\n");
  console.log(`embeddings vs messages:           ${emb?.length ?? 0} rows checked, ${embMismatch.length} mismatched`);
  console.log(`drive_embeddings vs drive_files:  ${drv?.length ?? 0} rows checked, ${drvMismatch.length} mismatched`);
  console.log(`asana_embeddings vs asana_items:  ${asn?.length ?? 0} rows checked, ${asnMismatch.length} mismatched`);

  const totalMismatch = embMismatch.length + drvMismatch.length + asnMismatch.length;
  console.log("");
  if (totalMismatch === 0) {
    console.log("✓ CLEAN — no cross-tenant drift, safe to proceed");
    process.exit(0);
  } else {
    console.log(`✗ FOUND ${totalMismatch} cross-tenant mismatches — DO NOT run null-plaintext`);
    if (embMismatch.length) console.log("  embeddings mismatches:", embMismatch.slice(0, 5));
    if (drvMismatch.length) console.log("  drive mismatches:", drvMismatch.slice(0, 5));
    if (asnMismatch.length) console.log("  asana mismatches:", asnMismatch.slice(0, 5));
    process.exit(1);
  }
}
main().catch((e) => { console.error("FATAL:", e); process.exit(2); });
