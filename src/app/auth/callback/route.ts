import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createWorkspaceForUser, getWorkspaceFromSession } from "@/lib/agency-db";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`);
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  // Create workspace for new users on first login.
  // Skip if redirecting to /join - the join flow adds them to the invited workspace instead.
  const isJoiningViaInvite = next.startsWith("/join");
  const existing = await getWorkspaceFromSession(data.user.id);
  if (!existing && !isJoiningViaInvite) {
    const name =
      data.user.user_metadata?.full_name ??
      data.user.email?.split("@")[0] ??
      "My Agency";
    await createWorkspaceForUser(data.user.id, `${name}'s Workspace`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
