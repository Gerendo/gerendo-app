#!/usr/bin/env npx tsx
// One-off round-trip decrypt sanity check.
// Reads random rows from live Supabase, decrypts the _enc column, asserts
// equality with plaintext. Read-only. No writes.

import { createClient } from "@supabase/supabase-js";
import { decrypt } from "@/lib/crypto-storage";
import { aad } from "@/lib/crypto-aad";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sb = createClient(url, key);

type Check = { table: string; column: string; row_id: string; ok: boolean; detail: string };

function asBuf(v: unknown): Buffer {
  if (Buffer.isBuffer(v)) return v;
  if (typeof v === "string") {
    if (v.startsWith("\\x")) return Buffer.from(v.slice(2), "hex");
    return Buffer.from(v, "base64");
  }
  throw new Error(`unexpected bytea shape: ${typeof v}`);
}

async function checkMessages(): Promise<Check[]> {
  const { data, error } = await sb
    .from("messages")
    .select("id, workspace_id, user_id, source, external_id, subject, subject_enc")
    .not("subject_enc", "is", null)
    .limit(3);
  if (error) throw error;
  return (data ?? []).map((r) => {
    try {
      const aadStr = aad.messagesSubject(r.workspace_id, r.user_id, r.source, r.external_id);
      const decrypted = decrypt(asBuf(r.subject_enc), aadStr);
      const ok = decrypted === r.subject;
      return {
        table: "messages",
        column: "subject",
        row_id: String(r.id),
        ok,
        detail: ok ? `"${r.subject.slice(0, 40)}..."` : `MISMATCH plaintext="${r.subject?.slice(0, 30)}" decrypted="${decrypted.slice(0, 30)}"`,
      };
    } catch (e) {
      return { table: "messages", column: "subject", row_id: String(r.id), ok: false, detail: `THREW: ${(e as Error).message}` };
    }
  });
}

async function checkEmbeddings(): Promise<Check[]> {
  const { data, error } = await sb
    .from("embeddings")
    .select("id, workspace_id, message_id, keyword_text, keyword_text_enc")
    .not("keyword_text_enc", "is", null)
    .limit(3);
  if (error) throw error;
  return (data ?? []).map((r) => {
    try {
      const aadStr = aad.embeddingsKeywordText(r.workspace_id, r.message_id);
      const decrypted = decrypt(asBuf(r.keyword_text_enc), aadStr);
      const ok = decrypted === r.keyword_text;
      return {
        table: "embeddings",
        column: "keyword_text",
        row_id: String(r.id),
        ok,
        detail: ok ? `${r.keyword_text.length} bytes match` : `MISMATCH plaintext_len=${r.keyword_text?.length} decrypted_len=${decrypted.length}`,
      };
    } catch (e) {
      return { table: "embeddings", column: "keyword_text", row_id: String(r.id), ok: false, detail: `THREW: ${(e as Error).message}` };
    }
  });
}

async function checkTokens(): Promise<Check[]> {
  const { data, error } = await sb
    .from("oauth_tokens")
    .select("id, workspace_id, user_id, provider, access_token, access_token_enc")
    .not("access_token_enc", "is", null);
  if (error) throw error;
  return (data ?? []).map((r) => {
    try {
      const aadStr = aad.oauthTokensAccessToken(r.workspace_id, r.user_id, r.provider);
      const decrypted = decrypt(asBuf(r.access_token_enc), aadStr);
      const ok = decrypted === r.access_token;
      return {
        table: "oauth_tokens",
        column: "access_token",
        row_id: `${r.provider}/${r.user_id.slice(0, 8)}`,
        ok,
        detail: ok ? `${r.access_token.length} bytes match` : `MISMATCH plaintext_len=${r.access_token?.length} decrypted_len=${decrypted.length}`,
      };
    } catch (e) {
      return { table: "oauth_tokens", column: "access_token", row_id: `${r.provider}/${r.user_id.slice(0, 8)}`, ok: false, detail: `THREW: ${(e as Error).message}` };
    }
  });
}

async function main() {
  console.log("=== round-trip decrypt sanity check ===\n");
  const checks: Check[] = [
    ...(await checkMessages()),
    ...(await checkEmbeddings()),
    ...(await checkTokens()),
  ];
  for (const c of checks) {
    const marker = c.ok ? "OK  " : "FAIL";
    console.log(`${marker} [${c.table}.${c.column}] row=${c.row_id} ${c.detail}`);
  }
  const failed = checks.filter((c) => !c.ok);
  console.log(`\n${checks.length} checks, ${checks.length - failed.length} passed, ${failed.length} failed.`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(2);
});
