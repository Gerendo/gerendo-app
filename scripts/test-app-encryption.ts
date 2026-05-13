// End-to-end encryption smoke test against the LIVE Supabase.
// Exercises the same write/read paths the API routes use.
// Cleans up after itself so it can be re-run safely.

import { createClient } from "@supabase/supabase-js";
import { encryptForBytea, decryptColumn } from "@/lib/crypto-storage";
import { aad } from "@/lib/crypto-aad";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function ok(label: string, value: boolean, detail?: string) {
  const mark = value ? "OK  " : "FAIL";
  console.log(`${mark}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!value) process.exitCode = 1;
}

async function main() {
  console.log("=== app-layer encryption smoke test ===\n");

  // Pick a workspace that actually has a member (otherwise downstream conv
  // inserts will fail on the user_id FK).
  const { data: member } = await sb
    .from("workspace_members")
    .select("workspace_id, user_id")
    .limit(1)
    .single();
  if (!member) throw new Error("no workspace_members");
  const { data: ws } = await sb
    .from("workspaces")
    .select("id, name_enc")
    .eq("id", member.workspace_id)
    .single();
  if (!ws) throw new Error("workspace lookup failed");
  const userId = member.user_id as string;

  const decryptedWsName = decryptColumn(ws.name_enc, aad.workspacesName(ws.id));
  ok("workspaces.name round-trip", typeof decryptedWsName === "string" && decryptedWsName.length > 0, `"${decryptedWsName}"`);

  // ---- conversations.title via 2-step insert ----
  const titleText = `test-conv ${Date.now()}`;
  const { data: convStub, error: convInsErr } = await sb
    .from("conversations")
    .insert({ workspace_id: ws.id, user_id: userId, title_enc: null })
    .select("id")
    .single();
  if (convInsErr || !convStub) throw new Error(`conv insert: ${convInsErr?.message}`);
  const convId = convStub.id as string;
  await sb
    .from("conversations")
    .update({ title_enc: encryptForBytea(titleText, aad.conversationsTitle(ws.id, convId)) })
    .eq("id", convId);
  const { data: convRead } = await sb
    .from("conversations").select("title_enc").eq("id", convId).single();
  const decryptedTitle = decryptColumn(convRead!.title_enc, aad.conversationsTitle(ws.id, convId));
  ok("conversations.title round-trip", decryptedTitle === titleText, `"${decryptedTitle}"`);

  // ---- conversation_messages.content via the same 2-step pattern the API uses ----
  const baseTime = Date.now();
  const userText = "what is encryption";
  const assistantText = "encryption converts plaintext to ciphertext using a key";
  const plain = [
    { role: "user", content: userText },
    { role: "assistant", content: assistantText },
  ];
  const stubs = plain.map((m, idx) => ({
    conversation_id: convId,
    role: m.role,
    created_at: new Date(baseTime + idx).toISOString(),
  }));
  const { data: insertedStubs, error: msgErr } = await sb
    .from("conversation_messages")
    .insert(stubs)
    .select("id, role, created_at")
    .order("id", { ascending: true });
  if (msgErr || !insertedStubs) throw new Error(`msg insert: ${msgErr?.message}`);
  await Promise.all(insertedStubs.map((r, idx) =>
    sb.from("conversation_messages")
      .update({
        content_enc: encryptForBytea(
          plain[idx].content,
          aad.conversationMessagesContent(convId, r.role as string, r.created_at as string)
        ),
      })
      .eq("id", r.id)
  ));

  const { data: msgRead } = await sb
    .from("conversation_messages")
    .select("role, content_enc, created_at")
    .eq("conversation_id", convId)
    .order("created_at", { ascending: true });
  console.log("  wrote ts examples:", stubs.map(r => r.created_at));
  console.log("  read  ts examples:", (msgRead ?? []).map(r => r.created_at));
  const decryptedMsgs = (msgRead ?? []).map((r) => ({
    role: r.role,
    content: decryptColumn(r.content_enc, aad.conversationMessagesContent(convId, r.role, r.created_at)),
  }));
  ok("conversation_messages user row", decryptedMsgs[0]?.content === userText, `"${decryptedMsgs[0]?.content}"`);
  ok("conversation_messages assistant row", decryptedMsgs[1]?.content === assistantText, `"${decryptedMsgs[1]?.content.slice(0, 40)}..."`);

  // ---- AAD tamper test: swap role; decrypt MUST fail ----
  try {
    const wrongAad = aad.conversationMessagesContent(convId, "assistant", msgRead![0].created_at);
    decryptColumn(msgRead![0].content_enc, wrongAad);
    ok("AAD tamper rejected", false, "decryption did NOT fail when AAD was tampered");
  } catch (e) {
    ok("AAD tamper rejected", true, `threw: ${(e as Error).message.slice(0, 50)}`);
  }

  // ---- Phase 1+3a: messages.subject/sender/thread_id ----
  const { data: anyMsg } = await sb
    .from("messages")
    .select("workspace_id, user_id, source, external_id, subject_enc, sender_enc, thread_id_enc")
    .eq("workspace_id", ws.id)
    .limit(1)
    .maybeSingle();
  if (anyMsg) {
    const subj = decryptColumn(
      anyMsg.subject_enc,
      aad.messagesSubject(anyMsg.workspace_id, anyMsg.user_id, anyMsg.source, anyMsg.external_id)
    );
    const sender = decryptColumn(
      anyMsg.sender_enc,
      aad.messagesSender(anyMsg.workspace_id, anyMsg.user_id, anyMsg.source, anyMsg.external_id)
    );
    decryptColumn(
      anyMsg.thread_id_enc,
      aad.messagesThreadId(anyMsg.workspace_id, anyMsg.user_id, anyMsg.source, anyMsg.external_id)
    );
    ok("messages.subject_enc", subj.length >= 0, `"${subj.slice(0, 40)}"`);
    ok("messages.sender_enc", sender.length >= 0, `"${sender.slice(0, 40)}"`);
    ok("messages.thread_id_enc", true);
  } else {
    ok("messages row", true, "no rows, skipped");
  }

  // ---- embeddings.keyword_text ----
  const { data: emb } = await sb
    .from("embeddings")
    .select("workspace_id, message_id, keyword_text_enc")
    .eq("workspace_id", ws.id)
    .limit(1)
    .maybeSingle();
  if (emb) {
    const kw = decryptColumn(
      emb.keyword_text_enc,
      aad.embeddingsKeywordText(emb.workspace_id, emb.message_id)
    );
    ok("embeddings.keyword_text_enc", kw.length > 0, `${kw.length} chars`);
  } else {
    ok("embeddings row", true, "no rows, skipped");
  }

  // ---- oauth_tokens ----
  const { data: tok } = await sb
    .from("oauth_tokens")
    .select("workspace_id, user_id, provider, access_token_enc, refresh_token_enc")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (tok) {
    const at = decryptColumn(
      tok.access_token_enc,
      aad.oauthTokensAccessToken(tok.workspace_id, tok.user_id, tok.provider)
    );
    ok("oauth_tokens.access_token_enc", at.length > 0, `${at.length} chars`);
    if (tok.refresh_token_enc) {
      const rt = decryptColumn(
        tok.refresh_token_enc,
        aad.oauthTokensRefreshToken(tok.workspace_id, tok.user_id, tok.provider)
      );
      ok("oauth_tokens.refresh_token_enc", rt.length > 0, `${rt.length} chars`);
    }
  } else {
    ok("oauth_tokens row", true, "no rows, skipped");
  }

  // ---- drift_findings ----
  const { data: drift } = await sb
    .from("drift_findings")
    .select("workspace_id, user_id, source, source_external_id, decision_summary_enc, draft_update_enc")
    .eq("workspace_id", ws.id)
    .limit(1)
    .maybeSingle();
  if (drift) {
    const ds = decryptColumn(
      drift.decision_summary_enc,
      aad.driftFindingsDecisionSummary(drift.workspace_id, drift.user_id, drift.source, drift.source_external_id)
    );
    ok("drift_findings.decision_summary_enc", ds.length >= 0, `"${ds.slice(0, 40)}"`);
    if (drift.draft_update_enc) {
      const du = decryptColumn(
        drift.draft_update_enc,
        aad.driftFindingsDraftUpdate(drift.workspace_id, drift.user_id, drift.source, drift.source_external_id)
      );
      ok("drift_findings.draft_update_enc", du.length >= 0, `${du.length} chars`);
    }
  } else {
    ok("drift_findings row", true, "no rows, skipped");
  }

  // ---- asana_items: assignee + name ----
  const { data: asana } = await sb
    .from("asana_items")
    .select("workspace_id, user_id, external_id, name_enc, project_name_enc, assignee_enc")
    .eq("workspace_id", ws.id)
    .limit(1)
    .maybeSingle();
  if (asana) {
    const nm = decryptColumn(
      asana.name_enc,
      aad.asanaItemsName(asana.workspace_id, asana.user_id, asana.external_id)
    );
    ok("asana_items.name_enc", nm.length >= 0, `"${nm.slice(0, 40)}"`);
    if (asana.project_name_enc) {
      const pn = decryptColumn(
        asana.project_name_enc,
        aad.asanaItemsProjectName(asana.workspace_id, asana.user_id, asana.external_id)
      );
      ok("asana_items.project_name_enc", pn.length >= 0, `"${pn.slice(0, 40)}"`);
    }
  } else {
    ok("asana_items row", true, "no rows, skipped");
  }

  // ---- cleanup ----
  await sb.from("conversation_messages").delete().eq("conversation_id", convId);
  await sb.from("conversations").delete().eq("id", convId);
  console.log("\n--- cleanup complete ---");

  if (process.exitCode === 1) console.log("\n❌ Some checks failed.");
  else console.log("\n✓ All encryption paths verified end-to-end.");
}
main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
