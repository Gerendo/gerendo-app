// Full audit: list every table, every text column, and a sample value.
// Identifies what's still plaintext after Phase 3b.

import { createClient } from "@supabase/supabase-js";

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Tables to inspect: all that touch user data + workspace metadata
  const tables = [
    "workspaces",
    "workspace_members",
    "workspace_settings",
    "workspace_contexts",
    "messages",
    "embeddings",
    "drive_files",
    "drive_embeddings",
    "asana_items",
    "asana_embeddings",
    "summaries",
    "facts",
    "oauth_tokens",
    "drift_findings",
    "action_log",
    "sync_state",
    "webhook_secrets",
    "push_subscriptions",
    "invite_tokens",
    "conversations",
    "chat_messages",
    "queries",
    "answers",
  ];

  for (const t of tables) {
    const { data, error } = await sb.from(t).select("*").limit(1).maybeSingle();
    if (error) {
      if (/relation .* does not exist/i.test(error.message)) continue;
      console.log(`-- ${t}: ${error.message.slice(0, 60)}`);
      continue;
    }
    if (!data) {
      console.log(`\n[${t}] (empty)`);
      continue;
    }
    console.log(`\n[${t}]`);
    for (const [col, v] of Object.entries(data)) {
      const t2 = typeof v;
      const isEnc = col.endsWith("_enc");
      const isOp = col === "id" || col.endsWith("_id") || col.endsWith("_at") || col === "synced_at";
      const tag = isEnc ? "ENC " : isOp ? "op  " : t2 === "string" ? "TEXT" : "    ";
      const sample = v === null ? "NULL" :
        t2 === "string" ? `"${(v as string).slice(0, 50)}"${(v as string).length > 50 ? "..." : ""}` :
        Buffer.isBuffer(v) ? `<bytea ${(v as Buffer).length}B>` :
        typeof v === "object" ? JSON.stringify(v).slice(0, 40) :
        String(v).slice(0, 40);
      console.log(`  [${tag}] ${col.padEnd(28)} ${sample}`);
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
