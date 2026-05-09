import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { getOrCreateDefaultWorkspace } from "@/lib/agency-db";

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
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

  const { workspaceId, userId } = await getOrCreateDefaultWorkspace();
  const supabase = createServiceClient();

  await supabase.from("oauth_tokens").upsert({
    workspace_id: workspaceId,
    user_id: userId,
    provider: "asana",
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? null,
    expires_at: tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : null,
  }, { onConflict: "workspace_id,user_id,provider" });

  return NextResponse.redirect(`${origin}/connect?asana_connected=1`);
}
