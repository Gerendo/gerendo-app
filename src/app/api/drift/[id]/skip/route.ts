import { NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceClient } from "@/lib/supabase-server";
import { encryptForBytea } from "@/lib/crypto-storage";
import { aad } from "@/lib/crypto-aad";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const findingId = parseInt(id, 10);
  if (!Number.isFinite(findingId)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const service = createServiceClient();

  const { data: finding } = await service
    .from("drift_findings")
    .select("id, workspace_id, user_id, status, source, source_external_id")
    .eq("id", findingId)
    .maybeSingle();

  if (!finding) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (finding.user_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (finding.status !== "pending") {
    return NextResponse.json({ status: "already-resolved", finding_status: finding.status });
  }

  const resolutionNote = "skipped";
  await service
    .from("drift_findings")
    .update({
      status: "accepted",
      resolved_at: new Date().toISOString(),
      resolution_note: resolutionNote,
      resolution_note_enc: encryptForBytea(
        resolutionNote,
        aad.driftFindingsResolutionNote(
          finding.workspace_id as string,
          finding.user_id as string,
          finding.source as string,
          finding.source_external_id as string
        )
      ),
    })
    .eq("id", findingId);

  return NextResponse.json({ status: "skipped" });
}
