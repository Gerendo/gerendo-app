import { NextResponse } from "next/server";
import { requireWorkspace, isErrorResponse } from "@/lib/get-workspace";
import { createServiceClient } from "@/lib/supabase-server";

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
    .select("id, role, content, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const _ws = await requireWorkspace();
  if (isErrorResponse(_ws)) return _ws;
  const { userId } = _ws;
  const { id } = await params;

  const { messages } = await req.json() as { messages: Array<{ role: string; content: string }> };
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "Messages required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: conv } = await supabase
    .from("conversations")
    .select("id, title")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rows = messages.map(m => ({ conversation_id: id, role: m.role, content: m.content }));
  const { error } = await supabase.from("conversation_messages").insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Auto-title from first user message if still "New chat"
  if (conv.title === "New chat") {
    const firstUser = messages.find(m => m.role === "user");
    if (firstUser) {
      const title = firstUser.content.trim().slice(0, 50) + (firstUser.content.length > 50 ? "..." : "");
      await supabase.from("conversations").update({ title, updated_at: new Date().toISOString() }).eq("id", id);
    }
  } else {
    await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", id);
  }

  return NextResponse.json({ ok: true });
}
