#!/usr/bin/env npx tsx
// One-shot reset: wipe all synced data + OAuth tokens + workspace settings so
// the next OAuth round-trip writes every row via the new encryption code path.
//
// KEEPS: auth.users, workspaces, workspace_members, invite_tokens, push_subscriptions.
// DELETES (in FK order):
//   action_log, drift_findings, summaries, facts,
//   embeddings, drive_embeddings, asana_embeddings,
//   messages, drive_files, asana_items,
//   workspace_contexts, webhook_secrets, sync_state, oauth_tokens, workspace_settings
//
// Usage:
//   npx tsx scripts/nuke-data.ts --confirm-i-want-to-nuke-everything

import { createClient } from "@supabase/supabase-js";

const CONFIRM_FLAG = "--confirm-i-want-to-nuke-everything";

if (!process.argv.includes(CONFIRM_FLAG)) {
  process.stderr.write(
    "REFUSED: this script wipes all synced data and OAuth tokens.\n" +
      `Pass ${CONFIRM_FLAG} to proceed.\n`
  );
  process.exit(2);
}

// FK dependency order: child tables first.
const TABLES_IN_ORDER = [
  "action_log",
  "drift_findings",
  "summaries",
  "facts",
  "embeddings",
  "drive_embeddings",
  "asana_embeddings",
  "messages",
  "drive_files",
  "asana_items",
  "workspace_contexts",
  "webhook_secrets",
  "sync_state",
  "oauth_tokens",
  "workspace_settings",
] as const;

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log("=== NUKE: wiping synced data + OAuth tokens ===\n");
  let totalDeleted = 0;
  for (const table of TABLES_IN_ORDER) {
    // Supabase JS .delete() requires a filter. .neq("id", null-uuid) matches
    // every row whose id is NOT the impossible value — i.e. all rows.
    // For tables keyed on uuid AND for bigint primary keys, this works.
    const { error, count } = await sb
      .from(table)
      .delete({ count: "exact" })
      .not("id", "is", null);
    if (error) {
      // Some tables don't have an "id" column (e.g. workspace_settings keys
      // on workspace_id). Fall back to "workspace_id" filter.
      if (/column .* does not exist/i.test(error.message) || /id .* does not exist/i.test(error.message)) {
        const { error: e2, count: c2 } = await sb
          .from(table)
          .delete({ count: "exact" })
          .not("workspace_id", "is", null);
        if (e2) {
          console.error(`FAIL ${table}: ${e2.message}`);
          process.exit(1);
        }
        console.log(`OK   ${table}: deleted ${c2 ?? 0} rows (via workspace_id filter)`);
        totalDeleted += c2 ?? 0;
        continue;
      }
      console.error(`FAIL ${table}: ${error.message}`);
      process.exit(1);
    }
    console.log(`OK   ${table}: deleted ${count ?? 0} rows`);
    totalDeleted += count ?? 0;
  }

  console.log(`\n✓ NUKE COMPLETE. Total rows deleted: ${totalDeleted}.`);
  console.log("Next: re-OAuth Gmail / Drive / Asana on app.gerendo.com");
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(3);
});
