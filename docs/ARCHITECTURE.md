# Gerendo — Architecture

*v0 draft — 2026-04-28. Living document. `[GINO: ...]` markers flag spots that need your input or a decision.*

---

## Goals

1. **Ask anything → cited answers** across Gmail, Drive, Asana, Meet transcripts, WhatsApp Business, Discord
2. **Multi-tenant from line 1** — Agency A's data never leaks into Agency B's queries; inside Agency A, personal Gmail of user X never leaks to user Y
3. **Cost-disciplined** — Haiku-first, prompt caching, per-workspace usage caps, retrieval keeps Claude's context small
4. **Self-serve onboarding** — connect a tool in <5 min via Nango OAuth, ingestion starts automatically

## Non-goals (v1)

- Real-time collaboration / chat between users
- Editing source-of-truth (read-only on Gmail/Asana/Drive — we don't write back yet)
- SOC 2 / SSO / enterprise compliance
- Mobile app (web-first)
- Custom embedding models (use off-the-shelf — Voyage / OpenAI / Cohere)

---

## High-level shape

```
[Nango OAuth] → [Integration sources]
       │
       ▼
[Ingest worker] ──► raw doc ──► chunker ──► embedder ──► Postgres (pgvector)
                                                              │
                                                              │  (per-workspace, RLS-enforced)
                                                              ▼
[Web UI: ask question] → [Retrieval] → top-K chunks ──► [Claude Haiku/Sonnet] ──► answer + citations
                                                              ▲
                                                              │
                                                       [Prompt cache]
```

Two background loops:
- **Ingest loop:** webhooks + polling pull new data from each source, embed it, write to Postgres
- **Drift loop:** scheduled job groups recent docs by client/topic, sends variants to Claude, surfaces contradictions

---

## Data model

Every table carries `workspace_id` and (where applicable) `user_id` and `is_shared`. RLS policies enforce visibility.

```
workspaces        — top-level tenant (one per agency)
  id, name, plan, created_at, query_quota_monthly

users             — members of a workspace
  id, workspace_id, email, role, created_at

sources           — connected tools (Gmail, Asana, Drive, etc.) per user/workspace
  id, workspace_id, user_id (nullable for shared), kind ('gmail'|'asana'|'drive'|'meet'|'whatsapp'|'discord'),
  is_shared, nango_connection_id, status, last_synced_at

documents         — a logical unit of content (an email, a task, a transcript, a WhatsApp thread)
  id, workspace_id, source_id, user_id (nullable for shared), is_shared,
  external_id, external_url, title, author, created_at_external, ingested_at,
  raw_content_ref (S3 / Supabase Storage path)

chunks            — sub-units of a document for retrieval
  id, document_id, workspace_id, user_id (nullable), is_shared,
  content (text), position, token_count, metadata (jsonb: speaker, timestamp, page, etc.)

embeddings        — vector for each chunk
  chunk_id (PK, FK), embedding vector(1024), model_version

queries           — log of every user query for cost + analytics + dogfooding
  id, workspace_id, user_id, question, retrieved_chunk_ids, model_used,
  input_tokens, output_tokens, cost_usd, latency_ms, created_at

drift_findings    — output of the drift loop
  id, workspace_id, topic_key (e.g. 'client:acme:launch_date'), severity,
  variants (jsonb: [{source, doc_id, value, timestamp}, ...]),
  llm_explanation, status ('open'|'dismissed'|'resolved'), created_at
```

> [GINO: decide embedding dimension. Voyage-3 = 1024 (default in schema above), OpenAI text-embedding-3-small = 1536, Cohere embed-v3 = 1024. Pick one and stick with it — changing later means re-embedding every document. Recommendation: Voyage-3 (best quality/€ ratio in 2025–2026 benchmarks).]

---

## Row-Level Security (the backbone)

Every table above gets RLS enabled. The core policy pattern:

```sql
-- Read policy on documents (and same shape on chunks, embeddings, sources, queries)
CREATE POLICY "user can read shared workspace docs and own personal docs"
  ON documents FOR SELECT
  USING (
    workspace_id = (auth.jwt() ->> 'workspace_id')::uuid
    AND (
      is_shared = true
      OR user_id = auth.uid()
    )
  );
```

Two non-negotiables:
1. **No app-layer-only filtering.** Every query that hits these tables is filtered by Postgres, not by application code. Bug in a Next.js route handler must not be able to leak data.
2. **Service-role queries are audited.** The ingest worker uses the service role to bypass RLS during writes — that code lives in one place, gets reviewed carefully, and never touches the request path.

> [GINO: confirm — Supabase Auth as the JWT issuer, with `workspace_id` as a custom claim set on login? Or do we want a join table `workspace_members(workspace_id, user_id)` and resolve workspace from the request context? Custom claim is faster; join table is more flexible. Default to custom claim until it pinches.]

---

## Ingest pipeline

For each source kind:

1. **Trigger** — Nango webhook (preferred) or polling cron (fallback for sources without webhooks)
2. **Fetch** — pull new/changed records since `last_synced_at`
3. **Normalize** — convert to a common `document` shape (title, author, body, external_url, created_at_external)
4. **Chunk** — strategy varies by source:
   - **WhatsApp message:** 1 message = 1 chunk (short)
   - **Email thread:** 1 message = 1 chunk, thread metadata on each
   - **Asana task:** description = 1 chunk; each comment = 1 chunk
   - **Meet transcript:** chunk by speaker turn, max ~500 tokens, 50-token overlap
   - **Drive doc:** chunk by section heading, max ~800 tokens, 100-token overlap
5. **Embed** — batch chunks, call Voyage API, write embeddings
6. **Index** — `pgvector` HNSW index on the `embedding` column for fast similarity search
7. **Idempotency** — `(source_id, external_id)` unique constraint on `documents` so re-runs don't duplicate

**Worker shape:** Vercel cron + serverless functions for v1. Move to a dedicated worker (Trigger.dev / Inngest / Supabase Edge Functions) once volume justifies it. Don't over-engineer day 1.

> [GINO: source priority order for v1? Plan says Gmail + Asana + Drive + Meet at v1, WhatsApp + Discord at v2. Confirm or reorder.]

---

## Retrieval pipeline (per query)

```
1. User asks a question (e.g. "What did Acme decide about the homepage hero?")
2. Embed the question (same model as docs)
3. SQL: SELECT chunks WHERE workspace_id = ? AND (RLS allows)
        ORDER BY embedding <=> query_embedding LIMIT 30
4. Hybrid: combine with BM25 keyword score on chunks.content
        — pgvector + Postgres full-text search, weighted blend
5. Filter / boost by metadata (client name, date range, source kind) if extractable from question
6. Rerank top 30 → top 8 with a cheap reranker (Voyage rerank-2 or Cohere)
7. Build the prompt:
     [System: Gerendo agency assistant, cite sources, be concrete]
     [Cached: workspace context, user role]   ← prompt caching here
     [Retrieved chunks, each tagged with doc_id + external_url]
     [User question]
8. Call Claude Haiku 4.5 by default
9. If answer confidence is low or question is complex, escalate to Sonnet 4.6
10. Return answer + citation list (each retrieved chunk's external_url)
11. Log the query (cost, tokens, chunks used) → queries table
```

**Why hybrid search, not pure vector:** vector similarity misses exact tokens. "Acme" the company name, an Asana task ID, a specific date — these need keyword match. Hybrid is cheap to do correctly with Postgres native primitives; not doing it costs precision.

**Why rerank:** retrieval recall is good with K=30, but precision is poor. A small reranker on top of similarity search is the cheapest precision win available.

---

## Drift detection (v1, simple)

Per the conversation: don't build a custom comparison engine yet. Instead:

1. **Scheduled job** (e.g. every 6 hours per active workspace)
2. Group recent docs by topic key — `(client, project, fact_type)` extracted from metadata
3. For each topic key with ≥2 sources contributing in the last N days:
   - Pull all variants (the actual chunks, with timestamp + source)
   - Send to Claude Sonnet with a prompt: *"These N statements all relate to {topic}. Are any of them contradictory? If yes, return a structured finding."*
4. Write findings to `drift_findings` table
5. Surface in UI as a feed; user can dismiss / mark resolved

**Limitations:** depends on Claude's judgment, not deterministic, will have false positives. Acceptable for v1 — design partners can tune the prompt with us. Upgrade to a structured comparison engine when volume / accuracy demands it.

> [GINO: which topic keys to extract first? Suggestion: client name + project name + one of {deadline, scope, deliverable_status, payment_amount}. Start narrow.]

---

## Cost discipline

Three controls, in order of impact:

1. **Prompt caching on every Claude call.** Cache the system prompt, workspace context, and user role. Re-pay only for the retrieved chunks + question.
2. **Haiku-first, escalate to Sonnet only when needed.** A simple classifier (or just question length / ambiguity heuristic) decides.
3. **Per-workspace monthly query quota** — enforced before the Claude call, not after. `queries.workspace_id COUNT this month >= plan.query_quota_monthly` → return "quota reached" UI.

Embeddings cost is negligible (~$0.02–$0.10 / 1M tokens with Voyage). Retrieval is essentially free. The LLM call dominates — that's where caps matter.

> [GINO: query quota per plan? PLAN.md mentions €299 / €699 / €1,499 tiers — pick query caps now (e.g. 1,000 / 5,000 / 25,000 monthly) so the math is concrete when designing the UI.]

---

## Milestones

Realistic Phase 1 → Phase 2 sequence. Each milestone is a working slice you can demo.

### M1 — Single-source RAG over Gmail (Week 4–5)
- Workspace + auth (Supabase)
- Nango Gmail OAuth, ingest one user's mailbox
- pgvector schema + RLS policies live
- Web UI: ask a question, get an answer with citations from Gmail
- **Demo target:** "What did Sarah email about the Acme launch last week?" → answer + 2 cited threads

### M2 — Add Asana + Drive (Week 6)
- Two more sources connected via Nango
- Hybrid search (vector + BM25)
- Reranker in the loop
- **Demo target:** cross-source query — "What's the latest on Acme's homepage?" pulls Gmail + Asana + Drive

### M3 — Multi-user workspace + sharing model (Week 7)
- Personal vs shared scope enforced via RLS (Gmail private, Asana shared)
- Invite flow for second/third user
- **Demo target:** Gino queries Gmail and only sees his own; Sarah queries Asana and sees the whole team's tasks

### M4 — Meet transcripts + drift loop (Week 8)
- Drive sync picks up Meet transcripts auto-saved by Workspace
- Drift detection scheduled job, findings UI
- **Demo target:** show one real drift finding from QuickLeap data

### M5 — Design partner onboarding (Week 9–10)
- Self-serve OAuth flow (no manual setup)
- Per-workspace query quotas + admin UI
- Usage analytics (PostHog)
- **Gate to Phase 2 advance:** QuickLeap uses Gerendo 3+ times/week for 2 weeks

### M6 — WhatsApp Business + Discord (Phase 2, Week 11–14)
- Meta Cloud API direct integration (not Nango — Nango doesn't cover this well)
- Discord bot
- These are the differentiators vs Glean/Notion AI; feature-flag gated until v1 is stable

---

## Open questions

1. **Embedding model** — Voyage-3 vs OpenAI vs Cohere. Default Voyage; needs final call before M1.
2. **Workspace identity** — JWT custom claim vs members-table lookup. Default custom claim.
3. **Storage for raw docs** — Supabase Storage vs S3. Default Supabase Storage (one less vendor).
4. **Reranker** — Voyage rerank-2 vs Cohere rerank-3. Either works; pick whichever the embedder is.
5. **WhatsApp ingestion model** — pull via Meta Cloud API (we host receiver) vs require agency to forward to Gerendo's number. The first is harder but doesn't change client-facing behavior; the second is simpler but visible to clients.
6. **Background worker platform** — Vercel cron is fine for M1–M3; need to decide for M4+ (Trigger.dev / Inngest / Supabase Edge / self-hosted).

---

## Reference

- Plan: [docs/PLAN.md](PLAN.md)
- Brief: [docs/BRIEF.md](BRIEF.md)
- Stack lock-ins: [CLAUDE.md](../CLAUDE.md)
