import { NextResponse } from "next/server";
import { requireWorkspace, isErrorResponse } from "@/lib/get-workspace";
import { backfillEmbeddingsForUser } from "@/lib/embeddings-backfill";

export const maxDuration = 300;

export async function POST(): Promise<NextResponse> {
  const ctx = await requireWorkspace();
  if (isErrorResponse(ctx)) return ctx;

  try {
    const result = await backfillEmbeddingsForUser(ctx.workspaceId, ctx.userId);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
