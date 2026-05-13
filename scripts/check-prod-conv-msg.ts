// Read every conversation_message in the DB and try to decrypt with the
// stored created_at as AAD input. If the production code wrote with a
// different format than the DB returns, we'll see failures.

import { createClient } from "@supabase/supabase-js";
import { decryptColumn } from "@/lib/crypto-storage";
import { aad } from "@/lib/crypto-aad";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data, error } = await sb
    .from("conversation_messages")
    .select("id, conversation_id, role, content_enc, created_at");
  if (error) throw error;

  let pass = 0, fail = 0;
  const failures: Array<{ id: number; created_at: string; err: string }> = [];
  for (const r of data ?? []) {
    try {
      const c = decryptColumn(
        r.content_enc,
        aad.conversationMessagesContent(r.conversation_id, r.role, r.created_at)
      );
      void c;
      pass++;
    } catch (e) {
      fail++;
      failures.push({ id: r.id, created_at: r.created_at, err: (e as Error).message.slice(0, 60) });
    }
  }
  console.log(`Total: ${data?.length ?? 0}, pass: ${pass}, fail: ${fail}`);
  if (failures.length > 0) {
    console.log("First 5 failures:");
    for (const f of failures.slice(0, 5)) console.log(`  id=${f.id} ts=${f.created_at} → ${f.err}`);
  }
}
main();
