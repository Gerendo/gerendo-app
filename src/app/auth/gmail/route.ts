import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { getWorkspaceFromSession } from "@/lib/agency-db";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(`${origin}/connect?gmail_error=auth_failed`);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const redirectUri = `${origin}/auth/gmail`;

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
    return NextResponse.redirect(`${origin}/connect?gmail_error=token_failed`);
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
    provider: "google-gmail",
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? null,
    expires_at: tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : null,
  }, { onConflict: "workspace_id,user_id,provider" });

  return NextResponse.redirect(`${origin}/connect?gmail_connected=1`);
}
