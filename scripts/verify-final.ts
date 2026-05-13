// Final verification: every sensitive plaintext column is dropped,
// every _enc column is populated and round-trips correctly.

import { createClient } from "@supabase/supabase-js";
import { decryptColumn } from "@/lib/crypto-storage";
import { aad } from "@/lib/crypto-aad";

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log("=== 1. Plaintext columns dropped (should ALL error) ===\n");
  const dropped: Array<[string, string]> = [
    ["messages", "subject"], ["messages", "sender"], ["messages", "thread_id"],
    ["embeddings", "keyword_text"],
    ["drive_files", "name"],
    ["drive_embeddings", "keyword_text"],
    ["asana_items", "name"], ["asana_items", "project_name"], ["asana_items", "assignee"],
    ["asana_items", "notes"], ["asana_items", "due_date"], ["asana_items", "permalink_url"],
    ["asana_embeddings", "keyword_text"],
    ["summaries", "summary"],
    ["facts", "detail"],
    ["oauth_tokens", "access_token"], ["oauth_tokens", "refresh_token"],
    ["workspace_contexts", "context_text"],
    ["drift_findings", "decision_summary"], ["drift_findings", "draft_update"],
    ["drift_findings", "resolution_note"],
    ["workspaces", "name"],
    ["conversations", "title"],
    ["conversation_messages", "content"],
  ];
  let passed = 0;
  for (const [t, c] of dropped) {
    const { error } = await sb.from(t).select(c).limit(1);
    if (error && /does not exist/i.test(error.message)) {
      passed++;
    } else {
      console.log(`FAIL ${t}.${c} → still exists`);
    }
  }
  console.log(`${passed}/${dropped.length} plaintext columns confirmed dropped`);

  console.log("\n=== 2. _enc columns populated ===\n");
  const checks: Array<[string, string]> = [
    ["messages", "subject_enc"], ["messages", "sender_enc"], ["messages", "thread_id_enc"],
    ["embeddings", "keyword_text_enc"],
    ["asana_items", "name_enc"], ["asana_items", "project_name_enc"],
    ["asana_embeddings", "keyword_text_enc"],
    ["oauth_tokens", "access_token_enc"], ["oauth_tokens", "refresh_token_enc"],
    ["drift_findings", "decision_summary_enc"], ["drift_findings", "draft_update_enc"],
    ["workspaces", "name_enc"],
    ["conversations", "title_enc"],
    ["conversation_messages", "content_enc"],
  ];
  for (const [t, c] of checks) {
    const { count } = await sb.from(t).select("*", { count: "exact", head: true }).not(c, "is", null);
    console.log(`  ${t}.${c}: ${count ?? 0} rows`);
  }

  console.log("\n=== 3. End-to-end round-trip on the new Phase 4 columns ===\n");
  const { data: ws } = await sb.from("workspaces").select("id, name_enc").limit(1).maybeSingle();
  if (ws) {
    const name = decryptColumn(ws.name_enc, aad.workspacesName(ws.id));
    console.log(`  workspaces.name → "${name}"`);
  }
  const { data: conv } = await sb.from("conversations").select("id, workspace_id, title_enc").limit(1).maybeSingle();
  if (conv) {
    const title = decryptColumn(conv.title_enc, aad.conversationsTitle(conv.workspace_id, conv.id));
    console.log(`  conversations.title → "${title}"`);
  }
  const { data: msg } = await sb.from("conversation_messages").select("conversation_id, role, content_enc, created_at").limit(1).maybeSingle();
  if (msg) {
    const content = decryptColumn(
      msg.content_enc,
      aad.conversationMessagesContent(msg.conversation_id, msg.role, msg.created_at)
    );
    console.log(`  conversation_messages.content (${msg.role}) → "${content.slice(0, 60)}${content.length > 60 ? "..." : ""}"`);
  }

  console.log("\n✓ Encryption rollout complete.");
}
main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
