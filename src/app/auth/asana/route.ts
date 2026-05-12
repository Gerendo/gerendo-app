import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { getWorkspaceFromSession } from "@/lib/agency-db";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { cookies } from "next/headers";
import { encryptForBytea } from "@/lib/crypto-storage";
import { aad } from "@/lib/crypto-aad";

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(`${origin}/connect?asana_error=auth_failed`);
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("oauth_state_asana")?.value;
  cookieStore.delete("oauth_state_asana");
  if (!expectedState || state !== expectedState) {
    return NextResponse.redirect(`${origin}/connect?asana_error=auth_failed`);
  }

  const redirectUri = `${origin}/auth/asana`;

  const tokenRes = await fetch("https://app.asana.com/-/oauth_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.ASANA_CLIENT_ID!,
      client_secret: process.env.ASANA_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const tokens = await tokenRes.json();
  if (!tokens.access_token) {
    return NextResponse.redirect(`${origin}/connect?asana_error=token_failed`);
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);
  const ws = await getWorkspaceFromSession(user.id);
  if (!ws) return NextResponse.redirect(`${origin}/login`);
  const { workspaceId, userId } = ws;
  const serviceSupabase = createServiceClient();

  await serviceSupabase.from("oauth_tokens").upsert({
    workspace_id: workspaceId,
    user_id: userId,
    provider: "asana",
    access_token: tokens.access_token,
    access_token_enc: encryptForBytea(
      tokens.access_token,
      aad.oauthTokensAccessToken(workspaceId, userId, "asana")
    ),
    refresh_token: tokens.refresh_token ?? null,
    refresh_token_enc: tokens.refresh_token
      ? encryptForBytea(
          tokens.refresh_token,
          aad.oauthTokensRefreshToken(workspaceId, userId, "asana")
        )
      : null,
    expires_at: tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : null,
  }, { onConflict: "workspace_id,user_id,provider" });

  // Register Asana webhooks immediately on connect (fire-and-forget).
  // The daily cron also re-runs registration, so non-fatal if this fails.
  fetch(`${origin}/api/webhooks/asana/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.CRON_SECRET}`,
    },
    body: JSON.stringify({ workspaceId, userId }),
  }).catch(() => {});

  return NextResponse.redirect(`${origin}/connect?asana_connected=1`);
}
