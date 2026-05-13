// Phase 4 backfill: encrypt existing workspaces.name, conversations.title,
// and conversation_messages.content into their new _enc columns.

import { createClient } from "@supabase/supabase-js";
import { encryptForBytea } from "@/lib/crypto-storage";
import { aad } from "@/lib/crypto-aad";

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 1. workspaces.name
  {
    const { data, error } = await sb
      .from("workspaces")
      .select("id, name")
      .is("name_enc", null);
    if (error) { console.error("workspaces select:", error); process.exit(1); }
    let n = 0;
    for (const r of data ?? []) {
      const name = (r.name as string | null) ?? "My Workspace";
      const blob = encryptForBytea(name, aad.workspacesName(r.id));
      const { error: upd } = await sb.from("workspaces").update({ name_enc: blob }).eq("id", r.id);
      if (upd) { console.error(`fail ws ${r.id}:`, upd); process.exit(1); }
      n++;
    }
    console.log(`workspaces.name: encrypted ${n} rows`);
  }

  // 2. conversations.title
  {
    const { data, error } = await sb
      .from("conversations")
      .select("id, workspace_id, title")
      .is("title_enc", null);
    if (error) { console.error(error); process.exit(1); }
    let n = 0;
    for (const r of data ?? []) {
      const title = (r.title as string | null) ?? "New chat";
      const blob = encryptForBytea(title, aad.conversationsTitle(r.workspace_id, r.id));
      const { error: upd } = await sb.from("conversations").update({ title_enc: blob }).eq("id", r.id);
      if (upd) { console.error(`fail conv ${r.id}:`, upd); process.exit(1); }
      n++;
    }
    console.log(`conversations.title: encrypted ${n} rows`);
  }

  // 3. conversation_messages.content
  {
    const BATCH = 500;
    let total = 0;
    while (true) {
      const { data, error } = await sb
        .from("conversation_messages")
        .select("id, conversation_id, role, content, created_at")
        .is("content_enc", null)
        .limit(BATCH);
      if (error) { console.error(error); process.exit(1); }
      if (!data || data.length === 0) break;
      for (const r of data) {
        const content = (r.content as string | null) ?? "";
        const blob = encryptForBytea(
          content,
          aad.conversationMessagesContent(r.conversation_id as string, r.role as string, r.created_at as string)
        );
        const { error: upd } = await sb
          .from("conversation_messages")
          .update({ content_enc: blob })
          .eq("id", r.id);
        if (upd) { console.error(`fail msg ${r.id}:`, upd); process.exit(1); }
        total++;
      }
      if (data.length < BATCH) break;
    }
    console.log(`conversation_messages.content: encrypted ${total} rows`);
  }

  console.log("\nDone.");
}
main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
