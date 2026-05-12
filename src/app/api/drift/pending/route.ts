import { NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceClient } from "@/lib/supabase-server";

export async function GET(): Promise<NextResponse> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const service = createServiceClient();
  const { data, error } = await service
    .from("drift_findings")
    .select("id, decision_summary, draft_update, source, source_external_id, detected_at")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .is("asana_item_id", null)
    .order("detected_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ findings: data ?? [] });
}
