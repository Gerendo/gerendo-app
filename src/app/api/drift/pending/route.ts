import { NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceClient } from "@/lib/supabase-server";
import { decryptColumn } from "@/lib/crypto-storage";
import { aad } from "@/lib/crypto-aad";

export async function GET(): Promise<NextResponse> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const service = createServiceClient();
  const { data, error } = await service
    .from("drift_findings")
    .select("id, workspace_id, user_id, decision_summary_enc, draft_update_enc, source, source_external_id, detected_at")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .is("asana_item_id", null)
    .order("detected_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const findings = (data ?? []).map((f: any) => ({
    id: f.id,
    decision_summary: decryptColumn(
      f.decision_summary_enc,
      aad.driftFindingsDecisionSummary(f.workspace_id, f.user_id, f.source, f.source_external_id)
    ),
    draft_update: decryptColumn(
      f.draft_update_enc,
      aad.driftFindingsDraftUpdate(f.workspace_id, f.user_id, f.source, f.source_external_id)
    ),
    source: f.source,
    source_external_id: f.source_external_id,
    detected_at: f.detected_at,
  }));

  return NextResponse.json({ findings });
}
