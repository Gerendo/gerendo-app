# Gerendo - Changelog

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
