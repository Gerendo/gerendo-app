import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { getWorkspaceFromSession } from "@/lib/agency-db";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { cookies } from "next/headers";
import { encryptForBytea } from "@/lib/crypto-storage";
import { aad } from "@/lib/crypto-aad";

// Handles Google OAuth callback for Drive
export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(`${origin}/connect?drive_error=auth_failed`);
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("oauth_state_drive")?.value;
  cookieStore.delete("oauth_state_drive");
  if (!expectedState || state !== expectedState) {
    return NextResponse.redirect(`${origin}/connect?drive_error=auth_failed`);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const redirectUri = `${origin}/auth/drive`;

  // Exchange code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const tokens = await tokenRes.json();

  if (!tokens.access_token) {
    return NextResponse.redirect(`${origin}/connect?drive_error=token_failed`);
  }

  // Store tokens in Supabase
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
    provider: "google-drive",
    access_token: tokens.access_token,
    access_token_enc: encryptForBytea(
      tokens.access_token,
      aad.oauthTokensAccessToken(workspaceId, userId, "google-drive")
    ),
    refresh_token: tokens.refresh_token ?? null,
    refresh_token_enc: tokens.refresh_token
      ? encryptForBytea(
          tokens.refresh_token,
          aad.oauthTokensRefreshToken(workspaceId, userId, "google-drive")
        )
      : null,
    expires_at: tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : null,
  }, { onConflict: "workspace_id,user_id,provider" });

  // Register Drive push webhook immediately on connect (fire-and-forget).
  // The daily cron also renews it, so non-fatal if this fails.
  fetch(`${origin}/api/webhooks/drive/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.CRON_SECRET}`,
    },
    body: JSON.stringify({ workspaceId, userId }),
  }).catch(() => {});

  return NextResponse.redirect(`${origin}/connect?drive_connected=1`);
}
