@AGENTS.md

# Gerendo SaaS — Claude Workspace Brain

Read this file at the start of every session. This repo is the **Gerendo SaaS product**, separate from the agency work at `~/Gerendo`.

---

## What Gerendo (the product) is

A unified intelligence layer that ingests a marketing agency's tools (Gmail, Google Drive, Asana, Meet transcripts, WhatsApp Business, Discord) and lets the team:
- Ask any question about the agency's work in plain language with cited sources
- Receive proactive insights ("Pescobar mentioned a deadline change in WhatsApp but the Asana task still has the old date")
- Onboard new hires in days instead of months by querying the company's full memory

**Closed loop, not dashboard.** The system actively monitors and surfaces — humans don't go check screens.

**Pitch (one-liner):** *Gerendo turns your agency's scattered tools into a single brain your whole team can ask questions to.*

**vs Glean:** Glean serves Fortune 1000. Gerendo serves the 15–50 person marketing agencies they ignore.

**vs Notion AI / Slack AI:** They're smart inside one tool. Gerendo reasons across all of them.

---

## Founder + status

- **Founder:** Gino, solo
- **Status:** Phase 0 — Validation (pre-code product side; landing infra live)
- **Already done:** GitHub repo (`Gerendo/gerendo-app`, private), Vercel deploy, `app.gerendo.com` live with SSL, default Next.js scaffold pushed
- **Now doing:** validation conversations + drafting `BRIEF.md`, `INTERVIEW_SCRIPT.md`, `OUTREACH_TEMPLATES.md`
- **Not yet doing:** writing app code. Phase 1 (MVP build) starts after 4/7 agency conversations confirm the same pain

See [docs/PLAN.md](docs/PLAN.md) for the full week-by-week build plan.

---

## Target customer

**15–50 person marketing agencies** that use Gmail + Google Drive + Asana + Google Meet (+ WhatsApp Business / Discord later).

**Geographic angle:** EU / Romanian / LatAm agencies where WhatsApp Business is the default client channel — US competitors ignore this.

**NOT the target:** QuickLeap-sized teams (too small). QuickLeap is the **sandbox/dogfood** account — real design partners come from outside.

---

## Marketing agency context (critical for product decisions)

Since the SaaS is built for agencies, every design call should pass through what agencies actually do:

- **The work is fragmented across tools.** Client briefs land in Gmail. Project plans live in Asana. Designs in Figma. Final assets in Drive. Calls happen in Meet/Zoom. Day-to-day client comms increasingly happen in **WhatsApp Business** (in EU/LatAm, this is non-negotiable).
- **Drift is the #1 pain.** A client says X in WhatsApp on Tuesday, the Asana task still says Y on Friday, the deck shows Z. Nobody owns reconciliation. This is the wedge.
- **Roles per agency:** PM (scopes, timelines, client questions), designer (Figma), developer (build), strategist (positioning). 1 PM may run 5+ clients in parallel.
- **Onboarding is brutal.** New hires lose 1–3 months learning where information lives. Searchable history of past projects = unlock.
- **Client confidentiality matters.** Agency A's data must never leak to Agency B's workspace, and inside one agency, personal Gmail of one user must never leak to another. **Multi-tenant + Row-Level Security from day 1.**
- **Agencies are price-sensitive.** Workspace pricing (€299–€1,499/mo) > per-seat for small teams. Easier to swallow.
- **They live in Asana / Notion / ClickUp / Monday.** Don't fight workflow tools — integrate.

Reference for the operational reality of one agency (QuickLeap): see `~/Gerendo/CLAUDE.md` and `~/Gerendo/Asana-Library/dev-sop/` for how agency work actually flows day-to-day.

---

## Tech stack (locked in)

- **Frontend:** Next.js 16 + TypeScript + Tailwind 4 + shadcn/ui (to install when needed)
- **Backend/DB:** Supabase (Postgres + pgvector + Auth + Row-Level Security)
- **OAuth/integrations:** Nango (200+ pre-built connectors, free tier)
- **LLM:** Anthropic API — Claude Haiku 4.5 default, escalate to Sonnet 4.6 for hard queries, **prompt caching mandatory**
- **Hosting:** Vercel (frontend + serverless functions) + Supabase (backend/DB)
- **Payments:** Stripe (don't activate billing until Phase 3)
- **Analytics:** PostHog (free tier)
- **Email:** Resend (waitlist + transactional)

⚠️ **Next.js 16 has breaking changes from Next.js 15.** Read `node_modules/next/dist/docs/` (or fetch official docs) before writing any Next-specific code. Don't trust training-data muscle memory.

---

## Permission model (architectural backbone)

Two scopes for every piece of data:
- **Personal (user-scoped):** Gmail, personal calendar, DMs → only that user can query
- **Shared (workspace-scoped):** Asana tasks, Drive docs, WhatsApp Business inbox, Discord channels, Meet transcripts → whole team can query

Enforced via **Postgres Row-Level Security (RLS)**. App code can have bugs; RLS cannot leak data. Every table tagged with `workspace_id`, `user_id`, `is_shared`, `source`.

---

## Workspace structure

```
~/gerendo-app/
├── CLAUDE.md                  ← this file — update when anything changes
├── AGENTS.md                  ← Next.js 16 framework rules (auto-generated, don't edit core)
├── README.md                  ← public-facing repo readme
├── _notes.md                  ← running session notes; read at session start
├── docs/                      ← planning + product docs
│   ├── PLAN.md                ← full week-by-week roadmap, Phase 0 → 6
│   ├── BRIEF.md               ← (to draft) 1-page product brief
│   ├── INTERVIEW_SCRIPT.md    ← (to draft) Phase 0 interview questions
│   ├── OUTREACH_TEMPLATES.md  ← (to draft) cold + warm outreach copy
│   ├── ARCHITECTURE.md        ← (to draft) data model, RLS policies, ingestion design
│   └── CHANGELOG.md           ← session-by-session log of decisions/changes
├── src/                       ← Next.js app code
│   └── app/                   ← App Router (Next.js 16)
└── public/
```

---

## Conventions

- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`)
- **Branches:** main = always deployable. Feature branches off main.
- **Deploy:** every push to main → auto-deploys to Vercel → live on `app.gerendo.com`
- **Env vars:** in `.env.local` (gitignored), Vercel project settings for production
- **TypeScript:** strict mode on. No `any` without comment justifying it.
- **CSS:** Tailwind 4 utilities. Component-scoped CSS only when Tailwind can't express it.
- **Components:** shadcn/ui copied into `src/components/ui/` when added — read, don't blindly install.
- **No premature abstractions.** Three similar lines beats a wrong abstraction.

---

## Validation philosophy (do not skip)

| Phase | Gate to advance |
|-------|-----------------|
| 0 → 1 | 4 of 7 agency conversations confirm the same pain |
| 1 → 2 | QuickLeap uses Gerendo 3+ times/week for 2 weeks |
| 2 → 3 | 2 of 3 design partners use it weekly + 1 says "I'd pay" |
| 3 → 4 | 5 paying customers, NPS ≥ 30, Sean Ellis ≥ 40% |

If a gate is missed: **stop, reassess, fix the wedge.** Don't power through.

---

## Always ask before

- Installing dependencies (npm packages, CLI tools)
- Running destructive commands (delete, reset, force push)
- Making Supabase schema changes once data exists
- Deploying anything that changes auth, billing, or RLS policies
- Touching production env vars

---

## Session management

### Starting a new session
1. Read `_notes.md` (root) — running notes, open questions
2. Read `docs/PLAN.md` if context on roadmap is needed
3. Read latest entry in `docs/CHANGELOG.md`
4. Check git status + recent commits

### Saving state at session end
Update before closing:
1. `_notes.md` — open questions, decisions, what to pick up next
2. `docs/CHANGELOG.md` — log what changed today (date stamp)
3. Commit + push if there are code changes

### Context-length alerts
Warn Gino proactively after **2 major tasks** in one session. A major task = agent rewrite, schema change, integration build, validation milestone. Don't wait for him to notice — he won't.

---

## Cross-workspace reference

`~/Gerendo/` (the agency workspace) has:
- `CLAUDE.md` — agency operations, QuickLeap context, team
- `Asana-Library/dev-sop/` — WordPress build SOP (useful for understanding how an agency thinks; not used here)
- `Ventures/Gerendo/` — original planning docs that were copied into this repo's `docs/`

The agency workspace and this SaaS workspace have **different lifecycles** — keep them separate. Do not push agency client data into this repo.

---

## Auto behaviors

- On session start: read `_notes.md` automatically. Don't wait to be asked.
- On meaningful change: commit with a Conventional Commits message. Don't batch commits across unrelated work.
- Before any external API integration: fetch and read the official docs first.
- When delegating to a sub-agent (Explore, etc.): include relevant `docs/` content in the prompt — don't make the sub-agent re-discover it.

---

## Key reminders

- This is a **SaaS product**, not a client website. Ship the smallest working thing, validate, iterate.
- **Movement first** in Phase 0 — drafts of `BRIEF.md`, conversations, contact list. No app code yet.
- Multi-tenant + RLS from line 1 — never retrofit security.
- Cost discipline: Haiku-first, prompt caching, per-workspace usage caps before any LLM feature ships.
- QuickLeap is the lab, not the customer. Real customers are 15–50 person agencies outside QuickLeap.
