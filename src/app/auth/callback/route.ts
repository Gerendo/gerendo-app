import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createServiceClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`);
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  // Create workspace for new users on first login
  const service = createServiceClient();
  const { data: existing } = await service
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (!existing) {
    const name =
      data.user.user_metadata?.full_name ??
      data.user.email?.split("@")[0] ??
      "My Agency";

    const { data: workspace } = await service
      .from("workspaces")
      .insert({ name: `${name}'s Workspace` })
      .select("id")
      .single();

    if (workspace) {
      await service.from("workspace_members").insert({
        workspace_id: workspace.id,
        user_id: data.user.id,
        role: "admin",
      });
    }
  }

  return NextResponse.redirect(`${origin}/`);
}
