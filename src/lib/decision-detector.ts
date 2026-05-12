import Anthropic from "@anthropic-ai/sdk";
import { createServiceClient } from "./supabase-server";
import { webpush } from "./push";
import { hybridAsanaSearch, type AsanaSearchResult } from "./search";
import type { AgencyDb } from "./agency-db";
import { decryptOrFallback } from "./crypto-storage";
import { aad } from "./crypto-aad";

const client = new Anthropic();

// ─── Layer 1: rules-based exclusion (free) ───────────────────────────────────

const SIGNAL_WORDS = [
  // English
  "confirmed","agreed","decided","let's go with","we're going with","moving to",
  "pushing to","pushed to","changing","will be","going ahead","approved",
  "locked in","final","scheduled for","set for","moved to","postponed","delayed",
  "cancelled","dropping","we chose","deadline is","due date is","launch is",
  // Romanian
  "am decis","am hotărât","mergem cu","mergem pe","am stabilit","confirmat",
  "mutat","schimbat","amânăm","mutăm","schimbăm","de acord","în regulă",
  "am ales","rămâne","termenul este","data este","lansăm","împingem",
  "vom merge","ne-am hotărât","aprobat","stabilit","bun mergem","ok mergem",
];

function isObviousNonDecision(text: string): boolean {
  const lower = text.toLowerCase().trim();
  const words = lower.split(/\s+/).filter(Boolean);

  if (words.length < 5) return true;

  // Pure question (short message that's only a question)
  if (words.length < 15 && lower.endsWith("?") && /^(when|what|how|can|could|would|is|are|do|does|did|will|who|where|why)\b/.test(lower)) {
    return true;
  }

  // Standalone acknowledgement only
  if (/^(ok|okay|thanks|thank you|got it|perfect|super|multumesc|da|bun|noted|sounds good)[.!\s]*$/i.test(lower)) {
    return true;
  }

  return false;
}

// ─── Layer 2: Haiku classification (~$0.0002/call) ───────────────────────────

const HAIKU_SYSTEM = `You classify messages for a marketing agency. Determine if a message contains a confirmed decision that changes a project deliverable, date, or scope.

Pay special attention to these signal words: ${SIGNAL_WORDS.join(", ")}.

Answer YES or NO only. No explanation.`;

async function classifyWithHaiku(text: string): Promise<boolean> {
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 5,
    system: [{ type: "text", text: HAIKU_SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: text }],
  });
  const answer = response.content[0].type === "text" ? response.content[0].text.trim() : "NO";
  return answer.toUpperCase().startsWith("YES");
}

// ─── Layer 3: Sonnet extraction (only on confirmed decisions) ─────────────────

const SONNET_SYSTEM = `You extract confirmed decisions from marketing agency messages and link them to the correct Asana task.

You will receive: the message text, and up to 5 candidate Asana tasks with their id, name, project, assignee, due date, and a snippet.

Return a JSON object with exactly these three fields:
{
  "decision_summary": "One sentence: what was decided (who, what changed, project name if mentioned)",
  "draft_update": "What to write in an Asana task comment to record this decision",
  "asana_item_id": <integer id of the matching task, or null if no candidate is a clear match>
}

Pick null over guessing. A weak match is worse than no match.
No markdown, no explanation. JSON only.`;

export async function extractWithSonnet(
  text: string,
  candidates: AsanaSearchResult[]
): Promise<{ summary: string; draftUpdate: string; asanaItemId: number | null }> {
  const candidateJson = JSON.stringify(
    candidates.map((c) => ({
      id: c.itemId,
      name: c.name,
      project: c.projectName,
      assignee: c.assignee,
      due: c.dueDate,
      snippet: c.snippet,
    })),
    null,
    2
  );
  const userContent = `<email>\n${text}\n</email>\n\n<asana_candidates>\n${candidateJson}\n</asana_candidates>`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 400,
    system: [{ type: "text", text: SONNET_SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userContent }],
  });
  const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "{}";

  const candidateIds = new Set(candidates.map((c) => c.itemId));
  try {
    const parsed = JSON.parse(raw);
    const rawId = parsed.asana_item_id;
    const asanaItemId =
      typeof rawId === "number" && Number.isInteger(rawId) && candidateIds.has(rawId) ? rawId : null;
    if (rawId != null && asanaItemId == null) {
      console.warn("[detector] sonnet returned asana_item_id not in candidates:", rawId);
    }
    return {
      summary: parsed.decision_summary ?? "Decision detected",
      draftUpdate: parsed.draft_update ?? raw,
      asanaItemId,
    };
  } catch {
    return { summary: "Decision detected", draftUpdate: raw, asanaItemId: null };
  }
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function detectDecisionsForUser(workspaceId: string, userId: string): Promise<void> {
  const supabase = createServiceClient();

  // Only proceed if user has push subscriptions — no point classifying otherwise
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (!subs?.length) return;

  // Get messages synced in the last 4 minutes, received in the last 7 days
  const fourMinsAgo = Date.now() - 4 * 60 * 1000;
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  const { data: messages } = await supabase
    .from("messages")
    .select("id, external_id, subject, sender")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .gte("synced_at", fourMinsAgo)
    .gte("received_at", sevenDaysAgo)
    .limit(30);

  if (!messages?.length) return;

  // Skip messages already detected
  const externalIds = messages.map((m) => m.external_id);
  const { data: existing } = await supabase
    .from("drift_findings")
    .select("source_external_id")
    .eq("workspace_id", workspaceId)
    .eq("source", "gmail")
    .in("source_external_id", externalIds);

  const alreadyDetected = new Set(existing?.map((f) => f.source_external_id) ?? []);
  const newMessages = messages.filter((m) => !alreadyDetected.has(m.external_id));
  if (!newMessages.length) return;

  // Get keyword texts
  const { data: embeddings } = await supabase
    .from("embeddings")
    .select("message_id, keyword_text, keyword_text_enc")
    .in("message_id", newMessages.map((m) => m.id));

  const textMap = new Map(
    embeddings?.map((e) => [
      e.message_id,
      decryptOrFallback(
        e.keyword_text_enc,
        e.keyword_text,
        aad.embeddingsKeywordText(workspaceId, e.message_id)
      ),
    ]) ?? []
  );
  let sonnetCallsUsed = 0;
  const MAX_SONNET_CALLS = 3; // cost guard per webhook trigger

  for (const message of newMessages) {
    // Use embedding keyword_text if available, otherwise fall back to subject + sender
    const keywordText = textMap.get(message.id) ?? `${message.subject}. From: ${message.sender}.`;
    if (!keywordText.trim()) continue;

    // Layer 1
    if (isObviousNonDecision(keywordText)) continue;

    // Layer 2
    let isDecision: boolean;
    try {
      isDecision = await classifyWithHaiku(keywordText);
    } catch (err) {
      console.error("[detector] Haiku error:", err);
      continue;
    }
    if (!isDecision) continue;

    // Layer 3
    if (sonnetCallsUsed >= MAX_SONNET_CALLS) break;
    sonnetCallsUsed++;

    // Fetch Asana candidates so Sonnet can pick the matching task at detect time.
    const db: AgencyDb = { supabase, workspaceId, userId };
    let candidates: AsanaSearchResult[] = [];
    try {
      candidates = await hybridAsanaSearch(keywordText, 5, db);
    } catch (err) {
      console.error("[detector] asana search error:", err);
    }

    let extracted: { summary: string; draftUpdate: string; asanaItemId: number | null };
    try {
      extracted = await extractWithSonnet(keywordText, candidates);
    } catch (err) {
      console.error("[detector] Sonnet error:", err);
      continue;
    }

    // Write finding
    const { data: finding, error: findingError } = await supabase
      .from("drift_findings")
      .insert({
        workspace_id: workspaceId,
        user_id: userId,
        source: "gmail",
        source_external_id: message.external_id,
        decision_summary: extracted.summary,
        draft_update: extracted.draftUpdate,
        asana_item_id: extracted.asanaItemId,
        status: "pending",
      })
      .select("id")
      .single();

    if (findingError || !finding) {
      console.error("[detector] insert finding error:", findingError?.message);
      continue;
    }

    const matched = extracted.asanaItemId
      ? candidates.find((c) => c.itemId === extracted.asanaItemId)
      : null;

    // Push notification
    const payload = JSON.stringify({
      title: matched ? `Decision on ${matched.name}` : "Decision detected",
      body: extracted.summary,
      tag: `gerendo-finding-${finding.id}`,
      actions: [
        { action: "confirm", title: "Got it" },
        { action: "dismiss", title: "Dismiss" },
      ],
      data: {
        findingId: finding.id,
        confirmUrl: `/api/drift/${finding.id}/accept`,
      },
    });

    await Promise.allSettled(
      subs.map((sub) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        )
      )
    );

  }
}
