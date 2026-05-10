import { NextResponse } from "next/server";
import { requireWorkspace, isErrorResponse } from "@/lib/get-workspace";
import { createInviteToken } from "@/lib/agency-db";
import { createServiceClient } from "@/lib/supabase-server";

export async function POST(): Promise<NextResponse> {
  const _ws = await requireWorkspace();
  if (isErrorResponse(_ws)) return _ws;
  const { workspaceId, userId } = _ws;

  const supabase = createServiceClient();
  const { data: member } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (member?.role !== "owner" && member?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const token = await createInviteToken(workspaceId, userId);
    return NextResponse.json({ token });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
