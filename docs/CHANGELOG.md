# Gerendo - Changelog

## 2026-05-14 (Security hardening — 8 audits + idempotency, encryption rollout closed)

Two-day cycle that took 4 phases of column encryption from "shipped and mostly tested" to "audited eight times by independent agents and verified clean." Full narrative in [docs/SECURITY_HARDENING_LOG.md](SECURITY_HARDENING_LOG.md) — the canonical reference for the next session.

**Encryption surface at close of cycle**
- **26 sensitive columns encrypted at rest** with AES-256-GCM, AAD-bound ciphertext, master key in Vercel env. Plaintext counterparts dropped from schema.
- Final additions today: `action_log.payload_before_enc` + `payload_after_enc` (audit 3 CRITICAL — Asana task names + decrypted draftUpdate comment text were leaking through the audit log JSONB).

**OAuth observability (audits 4-6)**
- New `ReauthorizeRequiredError` class thrown by `getGmailToken`/`getDriveToken`/`getAsanaToken` when refresh fails. Previously the routes silently returned the stale token and the user got generic 401s with no signal to reconnect.
- New `src/lib/oauth-errors.ts` with `reauthErrorToResponse` (401 + `{ error: "reauthorize_required", provider }`) and `logReauthNeeded` (structured `[oauth-reauth-needed]` line for webhooks). Wired into 17+ routes including drift accept, drift create-project, all sync routes, all 3 webhook handlers, all 3 webhook register routes, /api/settings/asana-defaults, /api/sync/summaries, /api/workspace/context/build, /api/drift/[id]/undo.
- `/api/ask` emits SSE `needs_reauth` events from the gmail init block and Asana tool handlers; chat client at `src/app/ask/page.tsx` maps them to toast notifications with provider names ("Gmail" / "Google Drive" / "Asana").
- Webhook handlers (asana/drive/gmail) detect `ReauthorizeRequiredError`, log structured signal, break out of the per-record loop to avoid log spam.

**Operational fixes (audits 3-5)**
- `workspaces.name_enc` self-heals when null — `/api/workspace/info` no longer 500s on a half-written 2-step insert.
- `conversations` GET filters `.not("title_enc", "is", null)` so one orphan can't poison the whole list.
- `instrumentation.ts` boot check validates `GERENDO_MASTER_KEY` at function cold-start; misconfigured deploys fail fast instead of 500'ing on first DB request.
- `action_log` rows insert with `status="pending"` and flip to `success`/`failed` only after the encrypted payload UPDATE lands. Inline sweep flips stale pending rows (>5min) to `failed`. No cron needed.
- `POST /conversations/[id]/messages` whitelists `role` to `{user, assistant, system}`. New migration `20260517` adds `CHECK (role IN ('user','assistant','system'))` at the DB level for defense-in-depth.
- Chat-message AAD now built from DB-canonical `created_at` (Postgres normalizes JS `Z`-form to `+00:00`-form, which broke the AAD on read). 2-step insert + read-back pattern.

**Drift idempotency (post-audit-7 commit c12047e)**
- `src/lib/action-log-idempotency.ts` with `getExistingActionTargetId` + `hasActionSucceeded`. Looks up action_log before each Asana mutation; reuses gids on retry. Both `drift/[id]/create-project` (4 checks: project / section / task / comment) and `drift/[id]/accept` (2 checks: update_task / comment) are now forward-only-idempotent. Partial-failure retries don't create duplicate Asana resources.

**Bug fixes triggered by the audits**
- Three routes silently 404'd on dropped plaintext columns (audit 2): drift accept, drift create-project, getDriveFileContent. All selected columns that Phase 3a/3b had dropped; `.maybeSingle()` swallowed PostgREST 42703 into null. Fixed.
- `extract-project-shape.ts` was logging 500 chars of raw Sonnet output to Vercel logs, leaking decrypted decisionSummary + draftUpdate. Removed.
- Drive sync error logs were echoing `file.name` (Phase 3a encrypted at rest). Replaced with `file.id`.
- Three dead `fts*` exports in `agency-db.ts` deleted (referenced RPCs that targeted dropped plaintext columns).

**Smoke test suite (durable, run before any encryption-touching change)**
- `scripts/verify-final.ts` — 24/24 plaintext columns confirmed dropped + Phase 4 round-trip.
- `scripts/test-app-encryption.ts` — full write/read round-trip for 12 column families.
- `scripts/test-action-log-enc.ts` — payload encryption + AAD tamper rejection.
- `scripts/test-idempotency-lookup.ts` — action_log idempotency lookups including undone-row exclusion.
- `scripts/sanity-decrypt.ts` — random-row decrypt across messages/embeddings/oauth_tokens.
- `scripts/check-prod-conv-msg.ts` — every conversation_message decrypts cleanly.

**Hooks refreshed**
- `.claude/hooks/encryption-rules.sh` (SessionStart): rewritten with current 26-column inventory + WRITE/READ patterns. Replaces the stale Phase 1+2 version.
- `.claude/hooks/check-encryption.sh` (PostToolUse): Pattern B now covers every dropped plaintext column with the correct `_enc` companion warning. Lookback tightened to stop at function boundaries — kills false positives that bled across `upsertSummary` / `getSummariesByMessageIds`.

**Audit commits**
- 1: 61901aa → 61701aa (chat-message AAD timestamp fix)
- 2: 745a8b2 (3 dropped-column-select routes)
- 3: 0d73fae (action_log enc + null self-heal + boot check + log leakage + dead exports)
- 4: 86dd909 (OAuth refresh + action_log status race + undo gap + role whitelist)
- 5: 2d15607 (oauth-errors helpers + SSE needs_reauth + 14 route mappings + role CHECK + sweep)
- 6: c79aa8b (chat client SSE handler + drift routes + webhook register)
- 7: explicit STOP recommendation; user shipped c12047e (idempotency) anyway
- 8: zero findings, confirmed clean

**Deferred (will not fix unless symptoms appear)**
1. `cachedKey` rotation runbook (audit 7 L1) — no code change; redeploy after rotating master key.
2. Chat double-submit cosmetic (audit 7 L2) — form already disabled while loading; triple-protected.
3. Idempotency reusing a manually-deleted-in-Asana gid (audit 8 L3) — surfaces as 502, no data corruption.

**Privacy claim now defensible**
- `/privacy` and `/security` pages already updated in c56009a. Google OAuth verification submission can now truthfully claim AES-256-GCM at-rest with operator-isolation (encryption enforces it, not just RLS).

## 2026-05-13 (Prompt engineering playbook expanded with eval pipeline + dataset rules)

**Prompt engineering playbook ([docs/PROMPT_ENGINEERING.md](PROMPT_ENGINEERING.md))**
- New section 7: 5-step eval pipeline mapped to our TS stack (datasets under `evals/<feature>/dataset.json`, runner scripts under `scripts/eval-<feature>.ts`, runs archived to `evals/<feature>/runs/<ts>.json`).
- New section 8: rules for building an eval dataset. Size and growth (2-3 cases dev, ~20 hand-crafted baseline, datasets only grow), hand-curate before generating, required schema (id/input/expected/notes), distribution rules (cover every class, language, length band, failure mode, no leakage with prompt examples), real-data anonymisation, when to start a new dataset, and an 8-item pre-flight checklist.
- New section 9: three grader types with rules for which to apply where. Code graders for classifiers + JSON output, Sonnet model graders for subjective quality (always asking strengths/weaknesses/reasoning/score together to avoid 6/10 default), human graders only for grader calibration and pre-launch sanity.
- New section 10: rollout plan. decision-detector Haiku classifier first, ask endpoint second, other four prompts adopt the harness later.
- TL;DR rewritten to cover both engineering and evaluation halves.

**No eval datasets created yet.** Datasets will be built per-feature following section 8 rules when each prompt is ready for evaluation.

**Enforcement wired in**
- New "Prompts (mandatory)" section in [CLAUDE.md](../CLAUDE.md) - any new or modified LLM prompt must follow the playbook (scaffold, iteration checklist, eval dataset rules, graders).
- Subagent delegation rule added to the same section: orchestrators must explicitly cite `docs/PROMPT_ENGINEERING.md` in any subagent prompt that could involve prompt-writing, so the playbook propagates through agent chains.
- Memory pointer in `~/.claude/projects/-Users-mingw-gerendo-app/memory/reference_prompt_engineering.md` tightened to mark the playbook as MANDATORY, so future sessions surface it before touching any prompt.

## 2026-05-11 (Push notifications + decision detection pipeline + embeddings fix)

**Push notification layer (full stack)**
- Installed `web-push`, generated VAPID keys, created `push_subscriptions` table
- Service worker (`public/sw.js`) with Yes/Edit/No action buttons and `skipWaiting`/`clients.claim`
- `POST /api/push/subscribe` and `DELETE` for managing browser subscriptions
- `POST /api/push/send` internal route (CRON_SECRET gated) for the detection pipeline
- `POST /api/push/test` for manual testing from settings
- `usePushNotifications` hook handles permission, SW registration, subscribe/unsubscribe
- Notifications section in Settings with Enable/Disable/Test buttons and browser-specific unblock instructions
- Fixed hydration mismatch (`Notification.permission === "default"` mapped to "prompt")
- Fixed Chrome silent replacement bug by using unique tag per test notification

**Decision detection pipeline**
- 3-layer classifier hooked into Gmail webhook via synchronous call after sync
- Layer 1: rules-based exclusion (short messages, pure questions, standalone acks) - free
- Layer 2: Haiku 4.5 classification with prompt caching (~$0.0002/call), EN+RO signal words
- Layer 3: Sonnet 4.6 extraction (max 3/trigger) returning `decision_summary` and `draft_update`
- Writes `drift_findings` row per detected decision
- Fires push notification to PM with Got it/Dismiss actions
- Fixed Gmail webhook debounce from 5min to 30s to handle Gmail history propagation delay
- Fixed Layer 1 stripping subject line when no body present (fallback to subject+sender)

**Embeddings root cause fix**
- Found bug: `Promise.all([embedTexts(), batchUpsertMessages()])` in stream sync meant if Voyage failed, messages stored without embeddings
- Fixed: embed first, then store messages only if embedding succeeds (both label sync and drafts sync)
- Added error logging to `upsertEmbedding` (was silently failing)
- Backfill route `POST /api/sync/embeddings-backfill` fetches real body from Gmail and creates missing embeddings (50/call)
- Re-index button added to Connect page for user-triggered backfill
- Daily cron at 4am runs backfill automatically for all Gmail users
- Reduced sync status poll from 5s to 15s, added 20min hard stop

**Other fixes**
- Fixed `url.parse()` deprecation warning: consolidated webpush into `src/lib/push.ts`
- Fixed Next.js 16 stylesheet precedence warning in layout

## 2026-05-02 (Engram extraction + search token optimization)

- Extracted the Voyage RAG pipeline into a standalone open source repo at github.com/Gerendo/engram. Engram is config-driven (engram.config.json), repo-agnostic, and includes an init wizard that wires the MCP server into any project's .claude/settings.json automatically.
- Changed `search_gerendo` (and Engram's `search_<name>`) to return pointers + 120-char previews only, instead of full chunk text. Reduces per-search token cost from ~4,000-5,000 tokens to ~200-300. Claude reads full content via the Read tool only when needed.
- Added Voyage token count and cost estimate to `engram:index` output.
- Added per-query cost breakdown to `engram:ask` output (input/output/cache write/cache read).
- Updated `docs/HOW_THE_CLI_WORKS.md` to reflect pointer-only search results and two-step retrieval flow.

## 2026-05-02 (Voyage pipeline hardening + context rules)

- Updated CLAUDE.md context rule: always query `search_gerendo` first, fall back to file reads only if pipeline returns nothing.
- Added `docs/GIT_HISTORY.md` - full git log exported as markdown, queryable via Voyage.
- Modified `src/gerendo-cli/index.ts` to regenerate `GIT_HISTORY.md` automatically before every index run so it never goes stale.
- Updated `docs/HOW_THE_CLI_WORKS.md` with a full inventory of every source indexed in the Voyage map (23 files across repo root, docs/, and memory/).

## 2026-05-02 (favicon, copy polish, two-way email)

- Favicon (italic G PNG) shipped on both sites. Wired in `__root.tsx` and `src/app/layout.tsx`. Commit `925146a`.
- Final SEO metadata on `__root.tsx` committed: title "Gerendo - One brain for your whole business", og:url, removed Lovable defaults.
- Em dash purge across `agency-brain-ai-main/src/`. Founder rule locked: no `—` in any Gerendo prose. Commit `1da736a`.
- Two-way email aliases. Cloudflare Routing inbound: `ermina@`, `contact@`, `privacy@`, `legal@`, `thankyou@` -> `tomagino28@gmail.com`. Gmail filters per alias. Gmail "Send mail as" via Resend SMTP (`smtp.resend.com:465`, user `resend`, password = API key, SSL, alias unchecked) so replies go out as the alias. Reply-from-same-address radio on. No Google Workspace needed.

## 2026-04-29 -> 2026-05-02 (waitlist sites live)

- Brand locked. Palette `#0E0F12` / `#F6F4EE` / `#E8A33D`. Fraunces (display) + Inter (body) + JetBrains Mono (Lovable site). Wordmark = "Gerendo" Fraunces 600 with amber dot. Standalone mark = italic Fraunces "G" in amber rounded square.
- `app.gerendo.com` built (Next.js 16 / Turbopack at repo root). Single waitlist landing. Vercel.
- `/api/waitlist` route: Resend `contacts.create` into General audience + `emails.send` welcome. CORS `*`. Lazy-init Resend client (env vars read inside handler so Vercel "collect page data" pass doesn't break).
- Marketing site at `agency-brain-ai-main/` (TanStack Start + Vite + Tailwind 4 + framer-motion). Cloudflare Pages, root dir `agency-brain-ai-main`, build `npm run build`, output `dist`. Live on `gerendo.com`.
- Lovable WaitlistDialog wired cross-origin to `https://app.gerendo.com/api/waitlist` via `WAITLIST_ENDPOINT` constant. One backend, two frontends.
- Fictional client renamed Pescobar -> Marengo in `AskDemo.tsx`.
- Homepage Security/AI sections softened to "we're building" framing. Dedicated `routes/security.tsx` and `routes/privacy.tsx` keep specific tech claims (TLS 1.3, AES-256, SOC 2 in progress) as aspirational architecture - founder's call.
- Resend domain verified for `gerendo.com` (DKIM/SPF on `send.gerendo.com`, no conflict with Cloudflare apex).
- Welcome email: From `Andrei from Gerendo <contact@gerendo.com>`, signed "Ermina here - co-founder behind Gerendo" (co-founder personas).

### Decisions locked in this stretch

- Subdomain split: `gerendo.com` = marketing (Cloudflare Pages), `app.gerendo.com` = product (Vercel).
- One repo, two deploys: Vercel on root (Next.js), Cloudflare Pages on `agency-brain-ai-main/` subdir (TanStack Start).
- Positioning leans generic ("your business" not "your agency"). Founder's call - watch for drift vs. CLAUDE.md original wedge focus.
- Skip third-party analytics. Cloudflare Web Analytics (cookieless) + GSC. No consent banner needed.

## 2026-04-28 (evening - docs + deploy unblock)

**Session: Drafted core Phase 0 docs (BRIEF, ARCHITECTURE), unblocked Vercel deploys, validated RAG direction.**

### Created
- [docs/BRIEF.md](BRIEF.md) v0 — 1-page product brief with `[GINO: ...]` markers (drift story, why-now, why-us, contact line)
- [docs/ARCHITECTURE.md](ARCHITECTURE.md) v0 — RAG data model, RLS pattern, ingest pipeline, retrieval flow, drift detection (LLM-as-judge), cost discipline, 6 milestones (M1–M6), 6 open questions

### Decided
- **GitHub repo flipped public** for Phase 0 — bypasses Vercel Hobby restriction on org-owned private repos, doubles as build-in-public marketing. Flip private before Week 4 when real schema/keys land.
- **Drift detection v1 = Claude-as-judge.** Feed variants from different sources, ask Claude to flag contradictions. Cheap, not deterministic, acceptable for v1. Custom comparison engine deferred.
- **Scope-creep detection added as first-class feature direction.** Gino's idea — capture SOW at kickoff, compare new client requests against baseline, flag out-of-scope asks. Specialization of drift, directly tied to agency margin. To be folded into ARCHITECTURE.md next session.
- **Vercel "Improve models with this project's data" toggle = OFF** as default privacy posture.
- **Embedding model default: Voyage-3 (1024 dim).** Pending final confirmation in ARCHITECTURE.md open questions.

### Discussed but deferred
- Filling in `[GINO: ...]` markers in BRIEF.md (4 spots)
- Resolving 6 open questions in ARCHITECTURE.md (embedding model, workspace identity, raw doc storage, reranker, WhatsApp ingestion model, background worker platform)
- INTERVIEW_SCRIPT.md and OUTREACH_TEMPLATES.md drafts
- Agency contact list (15–20 names)

### Did not do
- Repo transfer from `Gerendo` → `Tocki28` GitHub user. Started, got stuck waiting on Tocki28 acceptance (notification didn't surface). Aborted, made repo public instead — same outcome with less friction.
- Replace default Next.js homepage. Holding until BRIEF.md is finalized — don't ship vague copy.

### Next session should
1. Fold scope-creep detection into ARCHITECTURE.md
2. Fill in the four `[GINO: ...]` markers in BRIEF.md (with Gino's actual answers)
3. Draft INTERVIEW_SCRIPT.md and OUTREACH_TEMPLATES.md
4. Start building the 15–20 agency contact list

---

## 2026-04-28 (afternoon — infra setup)

**Session: Phase 0 infra spin-up. Moved from agency workspace into dedicated SaaS repo.**

### Created
- Local repo at `~/gerendo-app/` (outside `~/Gerendo/` — different lifecycle)
- Next.js 16 + TypeScript + Tailwind 4 scaffold (App Router, src dir)
- Private GitHub repo: `Gerendo/gerendo-app`
- Vercel project deployed (Hobby/Free tier)
- Custom domain `app.gerendo.com` — CNAME `app → 20ad62412142812b.vercel-dns-017.com.` in Cloudflare DNS, **DNS-only (proxy disabled)**, SSL valid
- `CLAUDE.md` with full SaaS + marketing-agency context for future sessions
- `docs/` folder seeded with PLAN, original notes, this CHANGELOG
- Root `_notes.md` for running session log

### Decided
- Confirmed subdomain split (`gerendo.com` marketing, `app.gerendo.com` product) after debating single-domain alternative
- Cloudflare proxy must stay **off (grey cloud)** for the Vercel CNAME — Vercel handles SSL/edge itself
- Stack updated: Next.js 16 (latest, replaces 15 in PLAN.md) — has breaking changes vs training data, AGENTS.md flags this

### Next session should
1. Draft `docs/BRIEF.md` (1-page product brief) — highest-leverage Phase 0 artifact
2. Replace default Next.js page with "Coming Soon + waitlist" landing
3. Build the 15–20 agency contact list for Phase 0 outreach
4. Set actual calendar date for Phase 0 Week 1 start

---

## 2026-04-28 (morning — original brainstorm)

**Session: Brainstorm + planning for the Gerendo SaaS venture (kicked off from YC RFS post on "AI OS for companies")**

### Created
- `Ventures/Gerendo/` folder — separate workstream from agency client work
- [PLAN.md](PLAN.md) — full week-by-week build plan from Phase 0 (validation) through Phase 5 (€10k MRR), ~12 months
- [_notes.md](_notes.md) — running session notes, decisions, open questions
- [README.md](README.md) — session entry point
- Memory file `project_gerendo_saas.md` (in `~/.claude/projects/-Users-mingw-Gerendo/memory/`) + MEMORY.md index entry

### Decided
- **Product:** Gerendo — multi-tenant SaaS, AI knowledge layer for marketing agencies
- **Target:** 15–50 person marketing agencies (EU/Romanian/LatAm angle via WhatsApp Business)
- **Domain:** gerendo.com, app at `app.gerendo.com`
- **Name:** Gerendo (no suffix). Reuses existing domain
- **Stack:** Next.js 15 + Supabase (Postgres + pgvector + Auth + RLS) + Nango (OAuth) + Anthropic API + Vercel + Stripe + PostHog
- **v1 integrations:** Gmail (per-user), Asana, Google Drive (incl. Meet transcripts auto-saved by Workspace)
- **v2 integrations:** WhatsApp Business (Meta Cloud API direct), Discord (bot)
- **QuickLeap:** sandbox/dogfood only, NOT a real customer (too small)
- **Pricing draft:** workspace-based €299 / €699 / €1,499 with query caps + €0.10 overages
- **Differentiator:** WhatsApp + Discord + agency-specific drift detection + self-serve OAuth onboarding (vs Onyx's DIY setup, Glean's enterprise-only focus)
- **Investor path:** apply to YC at 5 paying customers regardless of bootstrap/raise decision

### Discussed but deferred
- 1-page product brief (`BRIEF.md`) — to draft next session
- Interview script (`INTERVIEW_SCRIPT.md`) — to draft next session
- Outreach templates (`OUTREACH_TEMPLATES.md`) — to draft next session
- Detailed architecture doc (`ARCHITECTURE.md`) — to draft before Week 4 coding
- Whether Gerendo-the-agency and Gerendo-the-SaaS need to split brands later (Phase 3+ decision)

### Next session should
1. Confirm subdomain + GitHub repo are set up
2. Draft `BRIEF.md` together (most useful Phase 0 artifact)
3. List the 15–20 agency contacts for Phase 0 outreach
4. Set actual calendar date for Phase 0 Week 1 start
