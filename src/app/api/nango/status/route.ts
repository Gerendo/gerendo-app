import { requireWorkspace, isErrorResponse } from "@/lib/get-workspace";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import {  } from "@/lib/agency-db";

export async function GET(): Promise<NextResponse> {
  try {
    const _ws = await requireWorkspace(); if (isErrorResponse(_ws)) return _ws; const { workspaceId, userId } = _ws;
    const supabase = createServiceClient();

    const { data } = await supabase
      .from("oauth_tokens")
      .select("provider")
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .in("provider", ["google-gmail", "google-drive", "asana"]);

    const providers = new Set((data ?? []).map((r) => r.provider));
    return NextResponse.json({
      connected: providers.has("google-gmail"),
      driveConnected: providers.has("google-drive"),
      asanaConnected: providers.has("asana"),
    });
  } catch {
    return NextResponse.json({ connected: false, driveConnected: false });
  }
}
