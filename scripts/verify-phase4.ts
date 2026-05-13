import { createClient } from "@supabase/supabase-js";
import { decryptColumn } from "@/lib/crypto-storage";
import { aad } from "@/lib/crypto-aad";

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // workspaces
  const { data: ws } = await sb.from("workspaces").select("id, name, name_enc").limit(3);
  for (const r of ws ?? []) {
    const decrypted = decryptColumn(r.name_enc, aad.workspacesName(r.id));
    const ok = decrypted === r.name;
    console.log(`${ok ? "OK" : "FAIL"}   workspaces.name id=${r.id.slice(0, 8)} match=${ok} → "${decrypted}"`);
  }
  // conversations
  const { data: convs } = await sb.from("conversations").select("id, workspace_id, title, title_enc").limit(3);
  for (const r of convs ?? []) {
    const decrypted = decryptColumn(r.title_enc, aad.conversationsTitle(r.workspace_id, r.id));
    const ok = decrypted === r.title;
    console.log(`${ok ? "OK" : "FAIL"}   conversations.title id=${r.id.slice(0, 8)} match=${ok} → "${decrypted.slice(0, 40)}"`);
  }
  // conversation_messages
  const { data: msgs } = await sb.from("conversation_messages").select("id, conversation_id, role, content, content_enc, created_at").limit(3);
  for (const r of msgs ?? []) {
    const decrypted = decryptColumn(
      r.content_enc,
      aad.conversationMessagesContent(r.conversation_id, r.role, r.created_at)
    );
    const ok = decrypted === r.content;
    console.log(`${ok ? "OK" : "FAIL"}   conv_messages.content id=${r.id} role=${r.role} match=${ok} → "${decrypted.slice(0, 40)}"`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
