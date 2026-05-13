import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  // New _enc cols should exist
  const r1 = await sb.from("action_log").select("id, payload_before_enc, payload_after_enc").limit(1);
  console.log("new schema:", r1.error ? `FAIL ${r1.error.message}` : "OK");

  // Old plaintext cols should not
  const r2 = await sb.from("action_log").select("payload_before").limit(1);
  console.log("old payload_before dropped:", r2.error?.code === "42703" ? "OK" : `UNEXPECTED ${JSON.stringify(r2.error)}`);
  const r3 = await sb.from("action_log").select("payload_after").limit(1);
  console.log("old payload_after dropped:", r3.error?.code === "42703" ? "OK" : `UNEXPECTED ${JSON.stringify(r3.error)}`);
}
main();
