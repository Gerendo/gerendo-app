/**
 * Throwaway backfill script: link existing pending drift_findings to their
 * matching asana_items by replaying the hybrid search + Sonnet pick.
 *
 * Usage:
 *   bun scripts/backfill-asana-item-id.ts          # defaults to ids 2 3 4
 *   bun scripts/backfill-asana-item-id.ts 2 3 4    # explicit ids
 *
 * Bun auto-loads .env.local — no dotenv needed.
 */

import { createServiceClient } from "../src/lib/supabase-server";
import { hybridAsanaSearch } from "../src/lib/search";
import { extractWithSonnet } from "../src/lib/decision-detector";
import type { AgencyDb } from "../src/lib/agency-db";

async function main(): Promise<void> {
  const argIds = process.argv.slice(2).map((a) => parseInt(a, 10)).filter((n) => Number.isInteger(n));
  const findingIds = argIds.length > 0 ? argIds : [2, 3, 4];

  console.log(`[backfill] processing finding ids: ${findingIds.join(", ")}`);

  const supabase = createServiceClient();

  for (const findingId of findingIds) {
    const { data: finding, error: findingErr } = await supabase
      .from("drift_findings")
      .select("id, workspace_id, user_id, decision_summary, source, source_external_id, asana_item_id, status")
      .eq("id", findingId)
      .maybeSingle();

    if (findingErr) {
      console.error(`[backfill] finding ${findingId} fetch error: ${findingErr.message}`);
      continue;
    }
    if (!finding) {
      console.log(`[backfill] finding ${findingId} not found, skipping`);
      continue;
    }

    if (finding.asana_item_id != null) {
      console.log(
        `[backfill] finding ${findingId} already has asana_item_id=${finding.asana_item_id}, skipping`
      );
      continue;
    }

    // Resolve keyword_text:
    //   drift_findings.source_external_id → messages.external_id (+ workspace) → messages.id → embeddings.keyword_text
    let keywordText: string | null = null;

    const { data: messageRow } = await supabase
      .from("messages")
      .select("id")
      .eq("workspace_id", finding.workspace_id)
      .eq("user_id", finding.user_id)
      .eq("external_id", finding.source_external_id)
      .maybeSingle();

    if (messageRow?.id != null) {
      const { data: embRow } = await supabase
        .from("embeddings")
        .select("keyword_text")
        .eq("message_id", messageRow.id)
        .maybeSingle();
      if (embRow?.keyword_text) {
        keywordText = embRow.keyword_text;
      }
    }

    if (!keywordText) {
      keywordText = finding.decision_summary;
      console.log(`[backfill] finding ${findingId} no embedding, falling back to decision_summary`);
    }

    const queryText: string = keywordText ?? finding.decision_summary;

    const db: AgencyDb = {
      supabase,
      workspaceId: finding.workspace_id,
      userId: finding.user_id,
    };

    let candidates;
    try {
      candidates = await hybridAsanaSearch(queryText, 5, db);
    } catch (err) {
      console.error(`[backfill] finding ${findingId} asana search error:`, err);
      continue;
    }

    const candidatesSummary = candidates
      .map((c) => `id:${c.itemId} name:${c.name}`)
      .join(", ");
    console.log(`[backfill] finding ${findingId} candidates: [${candidatesSummary}]`);

    if (candidates.length === 0) {
      console.log(`[backfill] finding ${findingId} → no match (no candidates)`);
      continue;
    }

    let extracted;
    try {
      extracted = await extractWithSonnet(queryText, candidates);
    } catch (err) {
      console.error(`[backfill] finding ${findingId} sonnet error:`, err);
      continue;
    }

    if (extracted.asanaItemId == null) {
      console.log(`[backfill] finding ${findingId} → no match (sonnet returned null)`);
      continue;
    }

    const matched = candidates.find((c) => c.itemId === extracted.asanaItemId);

    const { error: updateErr } = await supabase
      .from("drift_findings")
      .update({ asana_item_id: extracted.asanaItemId })
      .eq("id", findingId);

    if (updateErr) {
      console.error(`[backfill] finding ${findingId} update error: ${updateErr.message}`);
      continue;
    }

    console.log(
      `[backfill] finding ${findingId} → asana_item_id ${extracted.asanaItemId} (task: ${matched?.name ?? "?"})`
    );
  }
}

main().catch((err) => {
  console.error("[backfill] fatal:", err);
  process.exit(1);
});
