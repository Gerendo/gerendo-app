import { createClient } from "@supabase/supabase-js";

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: tokens } = await sb
    .from("oauth_tokens")
    .select("provider, user_id, access_token, access_token_enc, refresh_token, refresh_token_enc, expires_at");
  console.log("=== oauth_tokens ===");
  for (const t of tokens ?? []) {
    console.log({
      provider: t.provider,
      user: (t.user_id as string).slice(0, 8),
      pt_at: t.access_token ? `${t.access_token.length}B` : "NULL",
      enc_at: t.access_token_enc ? "set" : "NULL",
      pt_rt: t.refresh_token ? `${t.refresh_token.length}B` : "NULL",
      enc_rt: t.refresh_token_enc ? "set" : "NULL",
      expires_at: t.expires_at,
    });
  }

  const { data: ws } = await sb.from("workspace_settings").select("*");
  console.log("\n=== workspace_settings ===");
  console.log(ws);

  const { data: hs } = await sb.from("webhook_secrets").select("provider, key, workspace_id, user_id");
  console.log("\n=== webhook_secrets ===");
  console.log(hs);
}
main().catch((e) => { console.error(e); process.exit(1); });
