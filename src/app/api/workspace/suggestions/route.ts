import { NextResponse } from "next/server";
import { requireWorkspace, isErrorResponse } from "@/lib/get-workspace";
import { createServiceClient } from "@/lib/supabase-server";
import { decryptColumn } from "@/lib/crypto-storage";
import { aad } from "@/lib/crypto-aad";

export async function GET(): Promise<NextResponse> {
  const _ws = await requireWorkspace();
  if (isErrorResponse(_ws)) return _ws;
  const { workspaceId, userId } = _ws;

  const service = createServiceClient();

  // Detect connected tools to tailor suggestions.
  const { data: tokens } = await service
    .from("oauth_tokens")
    .select("provider")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .in("provider", ["google-gmail", "google-drive", "asana"]);
  const providers = new Set((tokens ?? []).map((t) => t.provider as string));
  const asanaConnected = providers.has("asana");
  const gmailConnected = providers.has("google-gmail");

  // Pull top Asana projects (recent activity) for personalization.
  let topProjectName: string | null = null;
  if (asanaConnected) {
    const { data: items } = await service
      .from("asana_items")
      .select("external_id, project_name_enc, modified_at")
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .not("project_name_enc", "is", null)
      .order("modified_at", { ascending: false })
      .limit(50);
    if (items?.length) {
      const counts = new Map<string, number>();
      for (const r of items) {
        const name = decryptColumn(
          r.project_name_enc as Buffer | string,
          aad.asanaItemsProjectName(workspaceId, userId, r.external_id as string)
        );
        if (!name) continue;
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }
      const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
      topProjectName = sorted[0]?.[0] ?? null;
    }
  }

  const chips: string[] = [];
  if (topProjectName) {
    chips.push(`Latest on ${topProjectName}?`);
  }
  if (asanaConnected) {
    chips.push("What is overdue in Asana?");
  }
  if (gmailConnected || asanaConnected) {
    chips.push("Decisions made this week?");
  }
  // Generic fallbacks if nothing connected yet.
  while (chips.length < 3) {
    const fallbacks = [
      "What are my last 5 emails?",
      "Summarize what is happening with my clients",
      "Any emails about invoices this week?",
    ];
    const next = fallbacks[chips.length];
    if (!next) break;
    chips.push(next);
  }

  return NextResponse.json({ chips: chips.slice(0, 3) });
}
