// Phase 3a cleanup: encrypt the empty-string plaintext rows that the
// backfill script skipped by design. Empty strings round-trip fine through
// AES-GCM (29-byte blob). This unblocks Phase 3b's drop-plaintext step.

import { createClient } from "@supabase/supabase-js";
import { encryptForBytea } from "@/lib/crypto-storage";
import { aad } from "@/lib/crypto-aad";

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // asana_items.name (NOT NULL, 1 empty row)
  {
    const { data: rows } = await sb
      .from("asana_items")
      .select("id, workspace_id, user_id, external_id, name")
      .eq("name", "")
      .is("name_enc", null);
    for (const r of rows ?? []) {
      const ad = aad.asanaItemsName(r.workspace_id, r.user_id, r.external_id);
      const blob = encryptForBytea("", ad);
      const { error } = await sb.from("asana_items").update({ name_enc: blob }).eq("id", r.id);
      if (error) { console.error(`FAIL asana_items.name id=${r.id}: ${error.message}`); process.exit(1); }
      console.log(`OK   asana_items.name id=${r.id} encrypted empty string`);
    }
  }

  // asana_items.notes (nullable, 63 empty rows)
  {
    const { data: rows } = await sb
      .from("asana_items")
      .select("id, workspace_id, user_id, external_id")
      .eq("notes", "")
      .is("notes_enc", null);
    let n = 0;
    for (const r of rows ?? []) {
      const ad = aad.asanaItemsNotes(r.workspace_id, r.user_id, r.external_id);
      const blob = encryptForBytea("", ad);
      const { error } = await sb.from("asana_items").update({ notes_enc: blob }).eq("id", r.id);
      if (error) { console.error(`FAIL asana_items.notes id=${r.id}: ${error.message}`); process.exit(1); }
      n++;
    }
    console.log(`OK   asana_items.notes: encrypted ${n} empty rows`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
