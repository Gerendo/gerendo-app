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
- Editing source-of-truth (read-only on Gmail/Drive — Asana write-back is scoped to drift resolution only)
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

> **Last verified:** 2026-05-09. This section reflects the actual implemented schema (derived from `src/lib/agency-db.ts` and the sync routes), not the original design-doc intent. Keep it updated when schema changes.

Every table carries `workspace_id` and (where applicable) `user_id`. RLS policies enforce tenant and personal-data isolation.

---

### Tenancy and auth

```
workspaces
  id (uuid, PK)
  name (text)
  created_at

workspace_members        — join table: which users belong to which workspace
  id
  workspace_id (FK workspaces)
  user_id      (FK auth.users)
  role         ('admin' | 'member')

invite_tokens            — single-use invite links
  id
  token        (uuid, unique)
  workspace_id (FK workspaces)
  created_by   (user_id)
  used_by      (user_id, nullable — null means unused)
  expires_at
```

---

### Gmail

```
messages                 — one row per email message (metadata only, no body)
  id           (bigint, PK)
  workspace_id
  user_id
  source       ('gmail')
  external_id  (Gmail message ID — pointer back to Google)
  thread_id    (Gmail thread ID)
  sender       (From: header — email address + display name)
  subject      (Subject: header)
  mailbox      ('inbox' | 'sent')
  received_at  (epoch ms)
  synced_at    (epoch ms)
  UNIQUE (workspace_id, user_id, source, external_id)

embeddings               — one row per message, for search
  id           (bigint, PK)
  workspace_id
  message_id   (FK messages, UNIQUE)
  embedding    (float[] — 1024-dim Voyage vector)
  keyword_text (text — up to 1500 chars: "{subject}. From: {sender}. {body_start}")
               ⚠️  This stores the beginning of the email body as plain text.
               Design intent was "no raw text in DB"; this is a known deviation.
  indexed_at   (epoch ms)
```

**What `keyword_text` contains for Gmail:** the subject line, the sender address, and the first ~1500 characters of the decoded email body (HTML stripped). This is used for both FTS and as the text sent to Voyage for embedding.

**What is NOT stored:** the full email body. At query time, the Gmail API is called live with the stored `external_id` to fetch the full message.

---

### Google Drive

```
drive_files              — one row per Drive file (metadata only)
  id           (bigint, PK)
  workspace_id
  user_id
  external_id  (Google Drive file ID — pointer back to Drive)
  name         (file name)
  mime_type    ('application/vnd.google-apps.document' | 'spreadsheet' | 'presentation' | ...)
  web_view_link (Google Drive URL, nullable)
  synced_at

drive_embeddings         — one row per chunk of a Drive file
  id           (bigint, PK)
  workspace_id
  file_id      (FK drive_files)
  chunk_index  (int — position within the file)
  embedding    (float[] — 1024-dim Voyage vector)
  keyword_text (text — chunk of extracted file text)
  indexed_at
```

**What `keyword_text` contains for Drive:** a chunked slice of the exported file text (Google Docs exported as plain text, Sheets as CSV, Presentations as plain text). At query time, `getDriveFileContent` fetches up to 8000 chars from the Drive API live.

---

### Asana

```
asana_items              — one row per Asana task or project item
  id           (bigint, PK)
  workspace_id
  user_id
  external_id  (Asana task GID)
  name         (task title)
  project_name (parent project name)
  assignee     (assignee display name)
  due_date     (text)
  status       (task completion status)
  permalink_url (Asana task URL)
  synced_at

asana_embeddings         — one row per chunk of an Asana item
  id           (bigint, PK)
  workspace_id
  item_id      (FK asana_items)
  chunk_index
  embedding    (float[] — 1024-dim Voyage vector)
  keyword_text (text — task name + description + comments chunk)
  indexed_at
```

---

### Derived / AI-generated

```
summaries                — Claude-generated summary per message
  id
  workspace_id
  message_id   (FK messages)
  summary      (text — AI-written summary of the email)
  summarized_at

facts                    — structured facts extracted by Claude from messages
  id
  workspace_id
  message_id   (FK messages, nullable)
  type         (text — fact category, e.g. 'deadline', 'decision')
  subject      (text — what the fact is about)
  detail       (text — the fact content)
  client       (text — client name if extractable)
  extracted_at

workspace_contexts       — one pre-built context blob per workspace (used for prompt caching)
  id
  workspace_id (UNIQUE)
  context_text (text — distilled summary of all synced data, injected as cached prompt prefix)
  built_at
  sources_used (int — how many messages/files contributed)
  token_count
```

---

### Auth and sync state

```
oauth_tokens             — stored OAuth credentials per provider per user
  id
  workspace_id
  user_id
  provider     ('google-gmail' | 'google-drive' | 'asana')
  access_token (text — live access token, refreshed automatically)
  refresh_token (text — used to get new access tokens)
  expires_at   (epoch ms)
  UNIQUE (workspace_id, user_id, provider)

sync_state               — cursor/checkpoint per sync job
  id
  workspace_id
  user_id
  source       ('gmail:INBOX' | 'gmail:SENT' | 'drive' | 'asana' | ...)
  last_synced_at (epoch ms)
  cursor       (text — provider-specific pagination token, e.g. Gmail historyId)
  UNIQUE (workspace_id, user_id, source)
```

---

### Privacy notes

| Category | Stored as plain text? | Where | Notes |
|---|---|---|---|
| Email subject line | Yes | `messages.subject` | Always stored, even without body |
| Email sender (address + display name) | Yes | `messages.sender` | From: header verbatim |
| First ~1500 chars of email body | Yes | `embeddings.keyword_text` | Includes subject + sender + body start concatenated |
| Full email body | No | - | Fetched live from Gmail API at query time |
| Drive file name | Yes | `drive_files.name` | |
| Drive file content (chunks) | Yes | `drive_embeddings.keyword_text` | |
| Full Drive file content | No | - | Fetched live from Drive API at query time (capped at 8000 chars) |
| Asana task name | Yes | `asana_items.name` | |
| Asana project name | Yes | `asana_items.project_name` | |
| Asana assignee name | Yes | `asana_items.assignee` | Display name as returned by Asana API |
| Asana task content (chunks) | Yes | `asana_embeddings.keyword_text` | |
| AI-written email summaries | Yes | `summaries.summary` | Derived, but contains information from email body |
| Extracted facts | Yes | `facts.detail` | Derived, structured — type/subject/detail/client |
| OAuth access + refresh tokens | Yes | `oauth_tokens.*` | Sensitive — grants access to user's Gmail/Drive/Asana |

> **Known deviations from "no raw text in DB" rule (CLAUDE.md):**
> 1. `messages.subject` and `messages.sender` - raw email metadata stored permanently on every sync
> 2. `asana_items.name`, `.project_name`, `.assignee` - raw Asana metadata stored permanently
> 3. `embeddings.keyword_text`, `drive_embeddings.keyword_text`, `asana_embeddings.keyword_text` - plain-text content snippets for hybrid search
> 4. `summaries.summary` and `facts.detail` - AI-derived text that encodes content from the original sources
>
> These are pragmatic choices that need to be resolved before customer onboarding if the privacy pitch is "your data never leaves your machine" or "no content stored in the cloud."

> [GINO: decide embedding dimension. Currently using Voyage-3 = 1024. Changing later requires re-embedding all documents. Lock this in before first customer.]

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

## Sync and webhook architecture

> **Last verified:** 2026-05-10. All three sources below are fully implemented.

### Sync is real-time, not polling

All three sources use push webhooks. Data is searchable within seconds of a change - the daily cron is a safety net only, not the primary sync mechanism.

| Source | Push latency | Time to searchable | Notes |
|---|---|---|---|
| Gmail | ~1-5s (Google Pub/Sub) | ~10-30s | Fastest - Pub/Sub is designed for low latency |
| Google Drive | ~5-30s (Drive push channel) | ~30-60s | Less consistent than Pub/Sub; Drive can batch notifications within the debounce window but `changes.list` picks up all of them in one call |
| Asana | ~5-15s (Asana webhooks) | ~15-30s | Per-task GID push; debounce prevents duplicate syncs on rapid edits to the same task |

The daily 3am cron (`/api/cron/sync`) catches anything missed due to Vercel timeouts, transient network errors, or Google retry exhaustion. In normal operation it syncs 0 new items.

### How each source gets triggered

| Source | Real-time trigger | Incremental mechanism | Cron fallback | Debounce |
|---|---|---|---|---|
| Gmail | Google Pub/Sub push to `/api/webhooks/gmail` | `historyId` cursor in `sync_state` | Daily cron (`source=gmail`) | 30s per user (`gmail:webhook_lock`) |
| Google Drive | Drive push channel to `/api/webhooks/drive` | `changes.list` page token in `sync_state` (`drive:changes_page_token`) | Daily cron (`source=drive`) | 30s per user (`drive:webhook_lock`) |
| Asana | Asana webhooks to `/api/webhooks/asana` | Webhook fires per-task GID; `syncSingleAsanaTask` fetches the specific task | Daily cron (`source=asana`) | 15s per Asana workspace (`asana:webhook_lock:{asanaWsKey}`) |

### Gmail

**Registration:** `POST /api/webhooks/gmail/register` — calls Google Pub/Sub `watch`. Must be renewed before the watch expires (Google requires renewal every 7 days; cron runs `source=gmail-watch-renew` daily).

**Webhook receiver:** `/api/webhooks/gmail` — verifies the Pub/Sub JWT, decodes the base64 message to get `emailAddress`, looks up the user, debounces, then calls `runGmailSyncForUser` with `{ labelsOnly: ["INBOX", "SENT"] }`. Also fires Drive sync as fire-and-forget (in case a Meet transcript landed in Drive).

**Incremental sync:** `runGmailSyncForUser` uses the Gmail `historyId` cursor stored in `sync_state` (source key: `'gmail:INBOX'`, `'gmail:SENT'`, etc.). On first run (no cursor), it does a full label scan.

### Google Drive

**Registration:** `POST /api/webhooks/drive/register` — calls `drive.changes.watch` with a UUID channel ID and a 6-day TTL (Google max is 7 days). Stores `{ key: "channel", secret: channelId, meta: { resourceId, expiration } }` in `webhook_secrets`. Must be renewed before expiry; cron runs `source=drive-channel-renew` daily (checks expiry, re-registers if within 24h buffer).

**Webhook receiver:** `/api/webhooks/drive` — verifies the channel ID (`X-Goog-Channel-ID`) maps to a known `webhook_secrets.secret`, acks the initial `sync` handshake, debounces with `drive:webhook_lock`, then fires `runDriveSyncForUser` as fire-and-forget.

**Incremental sync:** `runDriveSyncForUser` uses `changes.list` with the page token stored in `sync_state` (key: `drive:changes_page_token`). On first run (no token), it does a full `files.list` scan and stores the `startPageToken` for future incremental runs. The `syncFile` helper is shared between full and incremental paths.

**Channel stop on delete:** when a user deletes their Drive data (`DELETE /api/workspace/delete-data?tool=drive`), the `webhook_secrets` row is deleted. On next renewal attempt, registration starts fresh.

### Asana

**Registration:** `POST /api/webhooks/asana/register` — iterates the user's Asana workspaces, calls `POST /api/1.0/webhooks` with a target URL of `/api/webhooks/asana?workspace_id=...&user_id=...&asana_ws={gid}`. Skips if already registered (checks `webhook_secrets` for that `provider=asana, key={asanaWs.gid}`). Must be re-run after OAuth connects.

**Known blocker:** BUG-007 - Asana OAuth won't complete until `https://app.gerendo.com/auth/asana` is added to the Asana developer console redirect URIs. Registration cannot happen until OAuth is fixed.

**Webhook receiver:** `/api/webhooks/asana` — handshake phase echoes back `X-Hook-Secret` and stores it. Event phase verifies HMAC-SHA256 signature, debounces (15s per Asana workspace), dedupes task GIDs, calls `syncSingleAsanaTask` per task. Heartbeats (empty events array) are acked silently.

**No cursor for Asana:** Asana pushes individual task GIDs on change, so there is no page-token-style cursor. The webhook handler processes the exact tasks that changed. The daily cron does a full project scan as a safety net.

### Cron schedule

Vercel cron config (`vercel.json`) should include:

```json
{ "path": "/api/cron/sync?source=gmail",              "schedule": "0 3 * * *" },
{ "path": "/api/cron/sync?source=drive",              "schedule": "0 3 * * *" },
{ "path": "/api/cron/sync?source=asana",              "schedule": "0 3 * * *" },
{ "path": "/api/cron/sync?source=gmail-watch-renew",  "schedule": "0 2 * * *" },
{ "path": "/api/cron/sync?source=drive-channel-renew","schedule": "0 2 * * *" }
```

All cron routes require `Authorization: Bearer {CRON_SECRET}`.

### webhook_secrets table

Used for both Pub/Sub (Gmail), push channels (Drive), and HMAC secrets (Asana):

| provider | key | secret | meta |
|---|---|---|---|
| `gmail` | `"watch"` | Gmail `historyId` | `{ expiration, registeredAt }` |
| `drive` | `"channel"` | current channel UUID | `{ resourceId, expiration, registeredAt }` |
| `asana` | Asana workspace GID | HMAC secret from Asana handshake | `{ registeredAt }` |

UNIQUE constraint: `(workspace_id, user_id, provider, key)`.

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

## Drift detection and closed-loop resolution

The core problem is not that PMs can't find drift - it's that reconciliation has friction, so it doesn't happen. Gerendo's job is to remove that friction entirely: detect a decision, propose the Asana update, let the PM confirm in one tap. No tab-switching, no dashboard to check.

---

### Decision detection pipeline

Three layers, cheapest first. Only messages that pass all three trigger a notification.

**Layer 1 - Rules-based pre-filter (free)**

Drop messages that are obviously not decisions, without any API call:
- Under 8 words with no date or deliverable mention
- Pure questions (starts with interrogative, ends with `?`)
- Standalone acknowledgements (`ok`, `thanks`, `got it`, `multumesc`, `super`, `perfect` alone)

Everything else passes to Layer 2. The filter is an exclusion list, not an inclusion list - this way novel phrasings never get dropped silently.

**Layer 2 - Haiku classification (~$0.0002/call)**

Send the message to Haiku 4.5 with a tight prompt: *"Is this a confirmed decision that changes a project deliverable, date, or scope? Answer YES or NO."*

The system prompt includes the workspace context (project names, client names, active Asana tasks) as a **cached prefix** - this block is paid once per 5-minute cache window, not per call.

To boost accuracy, the prompt notes signal words in both languages:

- **English:** `confirmed, agreed, decided, let's go with, we're going with, moving to, pushing to, pushed to, changing, will be, going ahead, approved, locked in, final, we'll go with, scheduled for, set for, moved to, postponed, delayed, cancelled, dropping, we chose, deadline is, due date is, launch is`
- **Romanian:** `am decis, am hotărât, mergem cu, mergem pe, am stabilit, confirmat, mutat, schimbat, amânăm, mutăm, schimbăm, de acord, în regulă, am ales, rămâne, termenul este, data este, lansăm, împingem, vom merge, ne-am hotărât, aprobat, stabilit, bun mergem, ok mergem`

Haiku returns YES → pass to Layer 3. NO → drop silently.

**Layer 3 - Sonnet extraction (only on YES)**

One Sonnet 4.6 call to extract structured output:
- What changed (deliverable, date, scope item)
- Which project/client it belongs to
- Best-match Asana task (from the cached task list)
- Draft Asana update text

This is the only expensive call, and it fires only on real decisions - estimated 3-5 times/day per active workspace.

---

### Cost model for this feature

| Layer | Calls/day (per workspace) | Cost/month |
|---|---|---|
| Layer 1 pre-filter | ~200 webhooks, all free | $0 |
| Layer 2 Haiku (after pre-filter) | ~30 | ~$0.18 |
| Layer 3 Sonnet (confirmed decisions) | ~4 | ~$0.60 |
| **Total** | | **~$0.80/workspace/month** |

Negligible at any pricing tier.

---

### Closed-loop resolution - the notification

When Layer 3 completes, Gerendo fires a push notification to the PM:

> **Acme confirmed the launch is moving to May 20. Update the Asana task from May 12?**
> `[Yes]` `[Edit]` `[No]`

Delivery surface:
- **Desktop:** browser push notification with action buttons (Chrome/Edge native - no tab required)
- **Mobile:** standard push notification with the same three actions
- **Future (v2):** WhatsApp bot message in the same thread where the decision came from

**Three resolution states:**

| Action | What happens |
|---|---|
| Yes | Asana task updated immediately, source comment added ("Updated via Gerendo - decision from Gmail, May 10") |
| Edit | PM rewrites the draft update text, then confirms - Gerendo writes the edited version |
| No | Alert dismissed, nothing written, logged as a false positive for future tuning |

Every Edit and No is a training signal. Task mismatches and wrong phrasings feed back into better entity resolution per workspace over time.

---

### Decision sources

Any ingest source can feed the decision pipeline. Priority order:

1. **Gmail** - already webhooking in real-time, highest volume
2. **Meet transcripts** - highest signal quality (decisions are explicit, speaker-attributed). Drive sync picks these up automatically since Meet saves transcripts to Drive. Same Layer 1-2-3 pipeline applies to the full transcript after a meeting ends.
3. **Google Drive** - email threads forwarded as docs, shared briefs with scope changes
4. **WhatsApp Business (v2)** - the ideal channel since the decision arrives and the confirmation returns in the same app

---

### Asana write-back

This is the only place Gerendo writes to an external source. Scoped narrowly:
- Only writes when the PM explicitly confirms (Yes or Edit path)
- Only updates `due_date` or appends to the task description/comments - never creates or deletes tasks
- Uses the user's own OAuth token (not a service account), so Asana audit log shows the PM's name
- Write is logged in a `drift_resolutions` table for workspace audit history

---

### Data model additions

```
drift_findings           — detected decision-class events awaiting PM review
  id
  workspace_id
  user_id
  source               ('gmail' | 'drive' | 'asana' | 'meet_transcript')
  source_external_id   (message/file ID in the source system)
  detected_at
  decision_summary     (text — what changed, as extracted by Sonnet)
  asana_item_id        (FK asana_items — best-match task)
  draft_update         (text — proposed Asana update text)
  status               ('pending' | 'confirmed' | 'edited' | 'dismissed')
  resolved_at
  resolution_note      (text — final text written to Asana, or dismiss reason)

push_subscriptions       — browser/mobile push endpoints per user
  id
  workspace_id
  user_id
  endpoint             (text — push service URL)
  p256dh               (text — encryption key)
  auth                 (text — auth secret)
  device_type          ('browser' | 'mobile')
  created_at
```

---

## Cost discipline

Three controls, in order of impact:

1. **Prompt caching on every Claude call.** Cache the system prompt, workspace context, and user role. Re-pay only for the retrieved chunks + question.
2. **Haiku-first, escalate to Sonnet only when needed.** A simple classifier (or just question length / ambiguity heuristic) decides.
3. **Per-workspace monthly query quota** — enforced before the Claude call, not after. `queries.workspace_id COUNT this month >= plan.query_quota_monthly` → return "quota reached" UI.

Embeddings cost is negligible (~$0.02–$0.10 / 1M tokens with Voyage). Retrieval is essentially free. The LLM call dominates — that's where caps matter.

> [GINO: query quota per plan? PLAN.md mentions €299 / €699 / €1,499 tiers — pick query caps now (e.g. 1,000 / 5,000 / 25,000 monthly) so the math is concrete when designing the UI.]

---

## Playbook notifications (Type 2)

Separate from task suggestions. When Gerendo detects that a client has expressed interest in a specific service or made a request that commonly requires expectation-setting, it fires a reminder to the PM with what they should communicate to the client.

**Example:** Client mentions they want SEO in an email.

> "Acme mentioned SEO. Remind them: SEO takes 3-6 months and site visits may temporarily drop before improving."
> `[Got it]` `[Dismiss]`

This is not a task. It's a communication nudge - Gerendo telling the PM what to say, at the exact moment it's relevant.

### Why this matters

Agencies repeat the same client education moments on every engagement. A new hire doesn't know to set these expectations. A senior PM under pressure forgets. Gerendo fires the reminder automatically when the trigger appears in any channel.

### How it works

Same detection pipeline as task notifications (Layers 1-2-3), but Layer 3 classifies the output as `playbook_trigger` instead of `decision`. Sonnet matches the message against a list of known trigger patterns and returns the associated reminder text.

### Playbook entries (v1 - hardcoded, editable in v2)

| Trigger | Reminder fired to PM |
|---|---|
| Client mentions SEO | "SEO takes 3-6 months. Warn client that visits may temporarily drop before improving." |
| Client asks for paid ads / PPC | "Remind client to set up conversion tracking before launch or results will be unmeasurable." |
| Client requests a full redesign | "Remind client to prepare all content and assets before dev starts, or the timeline will slip." |
| Client mentions a tight deadline | "Flag to client that a compressed timeline means reduced revision rounds. Get this in writing." |
| Client asks about social media growth | "Set expectation: organic growth is slow. Agree on a 90-day baseline before evaluating results." |

More entries added over time based on what agencies actually encounter. In v2, the agency can add and edit their own playbook entries via the settings UI.

### Resolution

- **Got it** - PM has seen the reminder, logged as acknowledged, no further action
- **Dismiss** - PM disagrees it's relevant, logged as a false positive

Both feed back into tuning the trigger matching accuracy.

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
