// Forward-only idempotency lookup against action_log. When a drift acceptance
// path runs multiple Asana mutations in sequence and one of them fails part-
// way through, the user reauthorizes or waits and retries the same finding.
// Without this check the retry produces duplicate sections, tasks, and
// comments (the project itself is deduped by findProjectByName, but the
// downstream steps have no equivalent). Each successful Asana action already
// writes an action_log row with target_id = the created Asana gid, so we just
// look it up before re-running the call.
//
// Why this is safe: action_log dedup keys on (drift_finding_id, action_type,
// status='success'). A finding can only be in a single in-flight acceptance
// at a time (drift_findings.status flips to 'accepted' on success), so there
// is no risk of collision across concurrent runs. Undo rows have status
// 'undone', filtered out, so re-acceptance after undo works correctly.

import type { SupabaseClient } from "@supabase/supabase-js";

export async function getExistingActionTargetId(
  service: SupabaseClient,
  driftFindingId: number,
  actionType: string
): Promise<string | null> {
  const { data } = await service
    .from("action_log")
    .select("target_id")
    .eq("drift_finding_id", driftFindingId)
    .eq("action_type", actionType)
    .eq("status", "success")
    .order("executed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.target_id as string | null) ?? null;
}

/**
 * Variant for actions where you only care whether the step already succeeded
 * (e.g. asana.add_comment — the comment story gid isn't reused, so the only
 * question is "did we comment yet").
 */
export async function hasActionSucceeded(
  service: SupabaseClient,
  driftFindingId: number,
  actionType: string
): Promise<boolean> {
  const { count } = await service
    .from("action_log")
    .select("id", { count: "exact", head: true })
    .eq("drift_finding_id", driftFindingId)
    .eq("action_type", actionType)
    .eq("status", "success");
  return (count ?? 0) > 0;
}
