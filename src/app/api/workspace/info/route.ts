import { NextResponse } from "next/server";
import { requireWorkspace, isErrorResponse } from "@/lib/get-workspace";
import { createServiceClient } from "@/lib/supabase-server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { decryptColumn } from "@/lib/crypto-storage";
import { aad } from "@/lib/crypto-aad";

export async function GET(): Promise<NextResponse> {
  const _ws = await requireWorkspace();
  if (isErrorResponse(_ws)) return _ws;
  const { workspaceId } = _ws;

  const supabase = createServiceClient();
  const authSupabase = await createServerSupabaseClient();

  const { data: { user } } = await authSupabase.auth.getUser();

  const { data: workspaceRow } = await supabase
    .from("workspaces")
    .select("id, name_enc, created_at")
    .eq("id", workspaceId)
    .single();
  const workspace = workspaceRow
    ? {
        id: workspaceRow.id,
        name: decryptColumn(workspaceRow.name_enc, aad.workspacesName(workspaceRow.id)),
        created_at: workspaceRow.created_at,
      }
    : null;

  const { data: members } = await supabase
    .from("workspace_members")
    .select("user_id, role, joined_at")
    .eq("workspace_id", workspaceId)
    .order("joined_at", { ascending: true });

  // Get user metadata from auth.users for each member
  const memberProfiles = await Promise.all(
    (members ?? []).map(async (m) => {
      const { data } = await supabase.auth.admin.getUserById(m.user_id);
      return {
        userId: m.user_id,
        role: m.role,
        joinedAt: m.joined_at,
        name: data.user?.user_metadata?.full_name ?? data.user?.email?.split("@")[0] ?? "Unknown",
        email: data.user?.email ?? "",
        avatar: data.user?.user_metadata?.avatar_url ?? null,
        isYou: m.user_id === user?.id,
      };
    })
  );

  const [emailCount, driveCount, asanaCount] = await Promise.all([
    supabase.from("messages").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    supabase.from("drive_files").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    supabase.from("asana_items").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
  ]);

  return NextResponse.json({
    workspace,
    members: memberProfiles,
    currentUser: {
      id: user?.id,
      name: user?.user_metadata?.full_name ?? user?.email?.split("@")[0],
      email: user?.email,
      avatar: user?.user_metadata?.avatar_url ?? null,
    },
    emailCount: emailCount.count ?? 0,
    driveCount: driveCount.count ?? 0,
    asanaCount: asanaCount.count ?? 0,
  });
}
