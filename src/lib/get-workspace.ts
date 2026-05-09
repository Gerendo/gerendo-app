import { createServerSupabaseClient } from "./supabase-server";
import { getWorkspaceFromSession } from "./agency-db";
import { NextResponse } from "next/server";

export type WorkspaceContext = {
  workspaceId: string;
  userId: string;
};

// Use in API routes. Returns workspace context or a 401 response.
export async function requireWorkspace(): Promise<WorkspaceContext | NextResponse> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const workspace = await getWorkspaceFromSession(user.id);
  if (!workspace) {
    return NextResponse.json({ error: "No workspace found. Please sign in again." }, { status: 401 });
  }

  return workspace;
}

export function isErrorResponse(val: WorkspaceContext | NextResponse): val is NextResponse {
  return val instanceof NextResponse;
}
