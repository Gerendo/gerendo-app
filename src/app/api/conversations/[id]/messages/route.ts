import { NextResponse } from "next/server";
import { requireWorkspace, isErrorResponse } from "@/lib/get-workspace";
import { createServiceClient } from "@/lib/supabase-server";
import { encryptForBytea, decryptColumn } from "@/lib/crypto-storage";
import { aad } from "@/lib/crypto-aad";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const _ws = await requireWorkspace();
  if (isErrorResponse(_ws)) return _ws;
  const { userId } = _ws;
  const { id } = await params;

  const supabase = createServiceClient();

  const { data: conv } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await supabase
    .from("conversation_messages")
    .select("id, role, content_enc, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const decoded = (data ?? []).map((r) => ({
    id: r.id,
    role: r.role,
    content: decryptColumn(
      r.content_enc,
      aad.conversationMessagesContent(id, r.role, r.created_at)
    ),
    created_at: r.created_at,
  }));
  return NextResponse.json(decoded);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const _ws = await requireWorkspace();
  if (isErrorResponse(_ws)) return _ws;
  const { workspaceId, userId } = _ws;
  const { id } = await params;

  const { messages } = await req.json() as { messages: Array<{ role: string; content: string }> };
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "Messages required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: conv } = await supabase
    .from("conversations")
    .select("id, title_enc")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Set created_at explicitly so it is part of the AAD identity tuple. Space
  // them 1ms apart within the batch so each row's AAD is unique even if the
  // insert happens in the same millisecond.
  const baseTime = Date.now();
  const rows = messages.map((m, idx) => {
    const ts = new Date(baseTime + idx).toISOString();
    return {
      conversation_id: id,
      role: m.role,
      content_enc: encryptForBytea(
        m.content,
        aad.conversationMessagesContent(id, m.role, ts)
      ),
      created_at: ts,
    };
  });
  const { error } = await supabase.from("conversation_messages").insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Auto-title from first user message if conversation is still untitled.
  // After Phase 4 the title is encrypted, so we have to decrypt to check.
  const currentTitle = conv.title_enc
    ? decryptColumn(conv.title_enc as Buffer | string, aad.conversationsTitle(workspaceId, id))
    : "";
  if (currentTitle === "New chat" || currentTitle === "") {
    const firstUser = messages.find(m => m.role === "user");
    if (firstUser) {
      const newTitle = firstUser.content.trim().slice(0, 50) + (firstUser.content.length > 50 ? "..." : "");
      await supabase
        .from("conversations")
        .update({
          title_enc: encryptForBytea(newTitle, aad.conversationsTitle(workspaceId, id)),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
    }
  } else {
    await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", id);
  }

  return NextResponse.json({ ok: true });
}
