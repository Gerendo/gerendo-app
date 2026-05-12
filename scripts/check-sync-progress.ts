import { createClient } from "@supabase/supabase-js";

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const tables = [
    "messages",
    "embeddings",
    "drive_files",
    "drive_embeddings",
    "asana_items",
    "asana_embeddings",
  ];

  console.log("=== sync progress (live) ===\n");
  for (const t of tables) {
    const { count: total } = await sb.from(t).select("*", { count: "exact", head: true });
    let encryptedCount: number | null = null;
    if (t === "messages") {
      const r = await sb.from(t).select("*", { count: "exact", head: true }).not("subject_enc", "is", null);
      encryptedCount = r.count ?? 0;
    } else if (t === "embeddings" || t === "drive_embeddings" || t === "asana_embeddings") {
      const r = await sb.from(t).select("*", { count: "exact", head: true }).not("keyword_text_enc", "is", null);
      encryptedCount = r.count ?? 0;
    }
    if (encryptedCount !== null) {
      console.log(`${t.padEnd(20)} total=${total ?? 0}  encrypted=${encryptedCount}  ${total && encryptedCount && total === encryptedCount ? "✓ all encrypted" : ""}`);
    } else {
      console.log(`${t.padEnd(20)} total=${total ?? 0}`);
    }
  }

  // Cursor positions tell us if sync is still in flight
  const { data: cursors } = await sb
    .from("sync_state")
    .select("source, cursor, last_synced_at")
    .order("last_synced_at", { ascending: false });
  console.log("\n=== sync_state cursors (sync still active if last_synced_at < 1 min ago) ===");
  const now = Date.now();
  for (const c of cursors ?? []) {
    const age = c.last_synced_at ? Math.round((now - Number(c.last_synced_at)) / 1000) : -1;
    console.log(`  ${c.source.padEnd(30)} cursor=${(c.cursor ?? "").slice(0, 40).padEnd(40)} age=${age}s`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
