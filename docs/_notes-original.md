# Gerendo — Session Notes

Running log of decisions, open questions, and things to pick up next session.

---

## Decisions made (2026-04-27 → 2026-04-28)

### Strategy
- **Build Gerendo as a SaaS venture**, separate workstream from QuickLeap client work
- Triggered by YC RFS post on "AI operating system for companies" (closed-loop intelligence layer over company tools)
- **Target customer:** 15–50 person marketing agencies (NOT QuickLeap-sized — too small)
- **QuickLeap = sandbox/dogfood only.** Real design partners come from outside QuickLeap
- **Geographic angle:** EU/Romanian/LatAm agencies where WhatsApp Business is the default client channel (US competitors ignore this)

### Positioning
- Direct competitors: **Glean** (enterprise), **Onyx** (open-source DIY), **Dust** (tech startups). None target SMB marketing agencies
- Differentiator: WhatsApp Business + Discord + agency-specific drift detection + self-serve OAuth onboarding for SMB
- Pitch one-liner: *"Gerendo turns your agency's scattered tools into a single brain your whole team can ask questions to."*
- **NOT a dashboard** — active intelligence layer, push insights to Slack/email, not screens to stare at

### Naming + domain
- **Name = Gerendo** (no "Brain" / "AgencyBrain" suffix). Means something in Latin
- **Domain = gerendo.com** (already owned). Web app at `app.gerendo.com`
- The agency identity "Gerendo" has no brand built around it yet, so name reuse is fine
- ⚠️ Flag for Phase 3+: may need to split Gerendo-the-agency from Gerendo-the-SaaS for investor clarity, but not yet

### Tech stack (locked in)
- **Frontend:** Next.js 15 + TypeScript + Tailwind + shadcn/ui
- **Backend/DB:** Supabase (Postgres + pgvector + Auth + Row-Level Security)
- **OAuth/integrations:** Nango (200+ pre-built connectors)
- **LLM:** Anthropic API — Claude Haiku 4.5 default, escalate to Sonnet 4.6 for hard queries, prompt caching for cost
- **Hosting:** Vercel (frontend) + Supabase (backend)
- **Payments:** Stripe
- **Analytics:** PostHog (open source, free tier)

### v1 integrations (Phase 1, weeks 4–9)
1. **Gmail** — per-user scoped (user_id permission)
2. **Asana** — workspace-shared
3. **Google Drive** — workspace-shared, includes Google Meet transcripts (Stage 1: read transcripts auto-saved by Workspace Business+ to Drive — no Recall.ai needed yet)

### v2 integrations (Phase 2, weeks 10–16)
4. **WhatsApp Business** — via Meta Cloud API direct (free tier). QuickLeap has Business account → use as test
5. **Discord** — bot-based ingestion. Easy API. Useful for dev/internal team chat

### v3+ integrations (only when 3+ customers ask)
- Notion, Slack, HubSpot, ClickUp, Monday, Recall.ai (for non-Workspace meeting bots)

### Architecture decisions
- **Multi-tenant from day 1** — every row tagged `workspace_id`
- **Two-scope permission model:**
  - Personal data (Gmail) → tagged `user_id`, `is_shared=false`, only that user queries
  - Shared data (Asana, Drive, WhatsApp Business inbox, Discord, Meet transcripts) → `is_shared=true`, whole workspace queries
- **Postgres Row-Level Security (RLS)** enforces permissions at DB layer — app bugs cannot leak data
- **Self-serve OAuth onboarding** is the entire UX advantage over Onyx — customer clicks "Connect Gmail," done in 15 seconds. Founder never touches their account
- **Retrieval-time access control** — LLM never sees data the user shouldn't see (filtered before generation)

### Pricing (draft — will A/B test in Phase 3)
- **Starter:** €299/mo workspace, ≤10 users, 2,000 queries
- **Pro:** €699/mo workspace, ≤25 users, 10,000 queries
- **Scale:** €1,499/mo workspace, ≤50 users, 30,000 queries + WhatsApp/Discord
- Overage: €0.10/query
- Workspace pricing > per-seat for small agencies (easier to swallow)
- Cost model: ~€0.01/query at Haiku + caching → 90%+ gross margin at €299

### Validation philosophy
- **Sean Ellis test** at month 1 of paying users: "How would you feel if you could no longer use Gerendo?" Need 40%+ "very disappointed" = PMF signal
- Gates between every phase. **Don't power through a missed gate** — reassess wedge instead

### Acquisition strategy (Phase 3, weeks 17–26)
4 parallel channels — don't depend on any one:
1. Warm referrals from QuickLeap + design partners (highest ROI)
2. LinkedIn outreach — 25 personalized DMs/week
3. Build in public — 2x/week LinkedIn posts about building Gerendo
4. Agency communities — Demand Curve, BrightonSEO Slack, Romanian/EU agency networks

### Investor path
- Apply to YC the moment we hit 5 paying customers, even if undecided on bootstrap vs raise
- The YC RFS post that triggered this brainstorm is literally them inviting Gerendo's category in
- Backup VCs: Antler, Entrepreneur First, Seedcamp, Hoxton, Cherry, byFounders

---

## Open questions (pick up next session)

1. **Confirm `app.gerendo.com` subdomain setup** — is Cloudflare DNS pointing somewhere yet, or is the subdomain unconfigured?
2. **Draft `BRIEF.md`** — the 1-page product brief (problem, target, scope, why now, why-Gino). Most useful Phase 0 artifact
3. **Draft `INTERVIEW_SCRIPT.md`** — the 7 questions for Phase 0 outreach conversations
4. **Draft `OUTREACH_TEMPLATES.md`** — cold + warm message templates
5. **Draft `ARCHITECTURE.md`** — detailed data model, exact Postgres schema, RLS policies, ingestion worker design (before any code in Week 4)
6. **Decide: separate GitHub repo** (`gerendo-app`, private) or monorepo within ~/Gerendo? Probably separate — different lifecycle from agency work
7. **Pick the 15–20 agency contacts** for Phase 0 outreach. List by: name, size, current tools, intro path (warm/cold), priority
8. **Phase 0 start date** — when does Week 1 actually begin? Calendar time matters

---

## Things Gino said that shape future direction

- *"I don't want this to be like a service business; instead I want it to be like a scalable business"* → every architectural decision must pass the "1000 customers tomorrow" test
- *"who the fuck would like to just talk to me, a stranger, for 30-40 minutes"* → skip cold interviews, lean on warm intros + build-in-public + tiny free tools as lead magnets. Don't force a textbook customer-discovery process he hates
- *"I think only Onyx and Glen are closer to what I'm trying to build"* → competitive read is correct; the gap (SMB agencies + WhatsApp + self-serve) is real
- QuickLeap has WhatsApp Business → use as the test account for Meta Cloud API integration in Week 12
- QuickLeap doesn't really use Slack or Asana → confirms why they're a sandbox, not a real customer

---

## What I (Claude) saved this session

- [PLAN.md](PLAN.md) — full week-by-week build plan, Phase 0 → Phase 5
- [CHANGELOG.md](CHANGELOG.md) — session log
- [README.md](README.md) — entry point for future sessions
- Memory: `project_gerendo_saas.md` in `~/.claude/projects/-Users-mingw-Gerendo/memory/` — flagged in MEMORY.md index so future sessions know Gerendo SaaS is a separate workstream
