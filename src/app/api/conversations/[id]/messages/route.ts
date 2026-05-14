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
    .not("content_enc", "is", null)
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
  // role is part of the conversationMessagesContent AAD identity tuple and
  // is rendered in chat history + filtered by downstream consumers
  // (system prompts, role==="user" guards). Whitelist it before insert so a
  // crafted client cannot inject an arbitrary string and confuse downstream
  // rendering or filters. AAD round-trips are self-consistent regardless,
  // so this is hygiene rather than encryption-correctness.
  const ALLOWED_ROLES = new Set(["user", "assistant", "system"]);
  for (const m of messages) {
    if (typeof m.role !== "string" || !ALLOWED_ROLES.has(m.role)) {
      return NextResponse.json(
        { error: `Invalid role "${m.role}". Must be one of: ${[...ALLOWED_ROLES].join(", ")}` },
        { status: 400 }
      );
    }
    if (typeof m.content !== "string") {
      return NextResponse.json({ error: "content must be a string" }, { status: 400 });
    }
  }

  const supabase = createServiceClient();

  const { data: conv } = await supabase
    .from("conversations")
    .select("id, title_enc")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Two-step insert so the AAD is built from the DB-canonical created_at.
  // Postgres normalises Date.toISOString() ("...Z") to "...+00:00" with
  // trailing zeros trimmed; if we hashed the JS form on write the GET path
  // would mis-authenticate when it reads the DB form back. Spacing rows 1ms
  // apart inside the batch keeps each row's AAD unique.
  const baseTime = Date.now();
  const stubs = messages.map((m, idx) => ({
    conversation_id: id,
    role: m.role,
    created_at: new Date(baseTime + idx).toISOString(),
  }));
  const { data: inserted, error: insErr } = await supabase
    .from("conversation_messages")
    .insert(stubs)
    .select("id, role, created_at")
    .order("id", { ascending: true });
  if (insErr || !inserted) {
    return NextResponse.json({ error: insErr?.message ?? "insert failed" }, { status: 500 });
  }

  const updates = inserted.map((r, idx) => ({
    id: r.id as number,
    content_enc: encryptForBytea(
      messages[idx].content,
      aad.conversationMessagesContent(id, r.role as string, r.created_at as string)
    ),
  }));
  const updateResults = await Promise.all(
    updates.map((u) =>
      supabase.from("conversation_messages").update({ content_enc: u.content_enc }).eq("id", u.id)
    )
  );
  const firstUpdErr = updateResults.find((r) => r.error)?.error;
  if (firstUpdErr) {
    return NextResponse.json({ error: firstUpdErr.message }, { status: 500 });
  }

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
