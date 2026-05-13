import { NextResponse } from "next/server";
import { requireWorkspace, isErrorResponse } from "@/lib/get-workspace";
import { createServiceClient } from "@/lib/supabase-server";
import { encryptForBytea, decryptColumn } from "@/lib/crypto-storage";
import { aad } from "@/lib/crypto-aad";

export async function GET(): Promise<NextResponse> {
  const _ws = await requireWorkspace();
  if (isErrorResponse(_ws)) return _ws;
  const { workspaceId, userId } = _ws;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("conversations")
    .select("id, workspace_id, title_enc, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const decoded = (data ?? []).map((r) => ({
    id: r.id,
    title: decryptColumn(
      r.title_enc,
      aad.conversationsTitle(r.workspace_id ?? workspaceId, r.id)
    ),
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
  return NextResponse.json(decoded);
}

export async function POST(req: Request): Promise<NextResponse> {
  const _ws = await requireWorkspace();
  if (isErrorResponse(_ws)) return _ws;
  const { workspaceId, userId } = _ws;

  const { title = "New chat" } = await req.json().catch(() => ({}));
  const supabase = createServiceClient();

  // Two-step insert: create row to get id, then encrypt+update title using id in AAD.
  const { data: row, error: insertError } = await supabase
    .from("conversations")
    .insert({ workspace_id: workspaceId, user_id: userId })
    .select("id, created_at, updated_at")
    .single();
  if (insertError || !row) {
    return NextResponse.json({ error: insertError?.message ?? "insert failed" }, { status: 500 });
  }

  const titleEnc = encryptForBytea(title, aad.conversationsTitle(workspaceId, row.id));
  const { error: updateError } = await supabase
    .from("conversations")
    .update({ title_enc: titleEnc })
    .eq("id", row.id);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    id: row.id,
    title,
    created_at: row.created_at,
    updated_at: row.updated_at,
  });
}
