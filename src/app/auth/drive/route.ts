import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { getOrCreateDefaultWorkspace } from "@/lib/agency-db";

// Handles Google OAuth callback for Drive
export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
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
  const { workspaceId, userId } = await getOrCreateDefaultWorkspace();
  const supabase = createServiceClient();

  await supabase.from("oauth_tokens").upsert({
    workspace_id: workspaceId,
    user_id: userId,
    provider: "google-drive",
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? null,
    expires_at: tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : null,
  }, { onConflict: "workspace_id,user_id,provider" });

  return NextResponse.redirect(`${origin}/connect?drive_connected=1`);
}
