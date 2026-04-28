# Gerendo — Build Plan (Zero → 5 Paying Customers)

**Product name:** Gerendo
**Domain:** gerendo.com (using `app.gerendo.com` for the web app)
**Founder:** Gino, solo
**Sandbox customer:** QuickLeap
**Target customer:** 15–50 person marketing agencies that use Gmail + Google Drive + Asana + Google Meet (+ WhatsApp Business / Discord later)
**Differentiator:** Includes WhatsApp Business + Discord, agency-specific drift detection, self-serve OAuth onboarding
**Stack:** Next.js 15 + TypeScript + Tailwind + Supabase (Postgres + pgvector + Auth) + Nango (OAuth) + Anthropic API (Claude Haiku 4.5 default, Sonnet 4.6 escalation) + Vercel + Stripe
**Last updated:** 2026-04-27

---

## What Gerendo is

A unified intelligence layer that ingests an agency's tools (Gmail, Drive, Asana, Meet transcripts, WhatsApp Business, Discord) and lets the team:
- Ask any question about the agency's work in plain language and get answers with source citations
- Receive proactive insights ("Pescobar mentioned a deadline change in WhatsApp but the Asana task still has the old date")
- Onboard new team members in days instead of months by querying the company's full memory

**Closed loop, not dashboard.** The system actively monitors and surfaces — humans don't go check screens.

---

## Pitch lines

**1-sentence:**
> Gerendo turns your agency's scattered tools into a single brain your whole team can ask questions to.

**vs Glean:**
> Glean serves Fortune 1000. Gerendo serves the 15–50 person marketing agencies they ignore.

**vs Notion AI / Slack AI:**
> They're smart inside one tool. Gerendo reasons across all of them.

**Why now:**
> LLM costs dropped 10x. Small agencies can finally afford their own AI brain.

---

## Validation Gates (do not skip)

| Phase | Gate to advance |
|-------|-----------------|
| 0 → 1 | 4 of 7 agency conversations confirm the same pain |
| 1 → 2 | QuickLeap uses Gerendo 3+ times/week for 2 weeks |
| 2 → 3 | 2 of 3 design partners use it weekly + 1 says "I'd pay" |
| 3 → 4 | 5 paying customers, NPS ≥ 30, Sean Ellis ≥ 40% |
| 4 → 5 | Bootstrap vs raise decision made |
| 5 → 6 | 25 paying customers, €10k MRR |

If you miss a gate: **stop, reassess, fix the wedge.** Don't power through.

---

## Phase 0 — Validation (Weeks 1–3)

**Goal:** Confirm the problem before writing code.

### Week 1
- [ ] Buy/confirm `app.gerendo.com` subdomain points to Vercel placeholder
- [ ] Set up GitHub repo `gerendo-app` (private)
- [ ] Set up Notion or Linear workspace for Gerendo project tracking
- [ ] Build a 1-page landing at `gerendo.com` ("Coming soon" + waitlist email capture)
- [ ] Write the 1-page product brief (problem, target, v1 scope, why now) — see template in `BRIEF.md` (to draft)
- [ ] Make a list of 15–20 marketing agencies you have any path into (QuickLeap intros, LinkedIn, friends, Romanian/EU agency communities)

### Week 2
- [ ] Shadow QuickLeap for 2 days — observe Bogdan, Alex, George, Dragos at work. Document every "annoying" moment, every "where was that?" moment, every tool switch
- [ ] Send 15 outreach messages — warm intros first, then cold. Frame: "I'm a developer building an AI tool with an agency I work with. Looking to talk to 5 other agency owners to make sure I'm not building something only useful to us. 20 min, would love your perspective."
- [ ] Aim for **5 conversations scheduled** by end of week

### Week 3
- [ ] Hold 5–7 conversations. Don't pitch. Listen. Use the 7-question script from `INTERVIEW_SCRIPT.md` (to draft)
- [ ] After each call, write 3 bullets: top pain, current workaround, would-they-pay signal
- [ ] **Validation gate:** Tally results. Does at least 4/7 confirm the same shared pain?
  - ✅ Yes → proceed to Phase 1
  - ❌ No → rework wedge before building anything

**End of Phase 0 deliverables:** landing page live, waitlist started, 7 interview notes, validated wedge.

---

## Phase 1 — Solo MVP for QuickLeap (Weeks 4–9)

**Goal:** Build the smallest possible working product. Use QuickLeap as your lab.

### Week 4 — Tech foundation
- [ ] Create Supabase project (free tier)
- [ ] Set up Next.js 15 + TypeScript + Tailwind + shadcn/ui
- [ ] Deploy to Vercel at `app.gerendo.com`
- [ ] Set up Anthropic API account, store key in env
- [ ] Set up Nango account (free tier)
- [ ] Set up Stripe account (don't activate yet)
- [ ] Set up PostHog for product analytics
- [ ] Push initial commit, CI/CD live

### Week 5 — Auth, workspaces, team invites
- [ ] Implement Supabase Auth (email + Google OAuth login)
- [ ] Build `workspaces` table with `workspace_id`, name, owner
- [ ] Build `workspace_members` table with role (owner/admin/member)
- [ ] Implement workspace creation flow ("Create your agency workspace")
- [ ] Implement team invite flow (email invite → join workspace)
- [ ] Build basic UI shell: sidebar (workspace switcher), top nav, empty dashboard
- [ ] **Done = Gino can sign up, create "QuickLeap" workspace, invite Bogdan, Alex, George**

### Week 6 — Gmail integration
- [ ] Configure Nango with Gmail OAuth scope (`gmail.readonly`)
- [ ] Build "Connect Gmail" button → triggers OAuth flow
- [ ] Build ingestion worker: pull last 90 days of Gmail messages
- [ ] Build `messages` table tagged with `workspace_id`, `user_id`, `is_shared=false`, `source=gmail`
- [ ] Build chunking pipeline (split long emails into ~500-token chunks)
- [ ] Build embedding pipeline using OpenAI `text-embedding-3-small` or Voyage AI
- [ ] Store embeddings in `pgvector` column
- [ ] **Done = Gmail searchable via SQL similarity query**

### Week 7 — Asana integration + first chat UI
- [ ] Configure Nango with Asana OAuth
- [ ] Build "Connect Asana" button + ingestion worker
- [ ] Pull projects, tasks, comments → `tasks` table tagged `is_shared=true` (workspace-wide)
- [ ] Build embeddings for Asana content
- [ ] Build basic chat UI: input box, message list, streaming responses
- [ ] Build RAG endpoint: query → vector search → top 10 chunks → Anthropic API call → streamed answer with citations
- [ ] **Done = "What did Pescobar say about X?" returns a real answer with source links**

### Week 8 — Google Drive integration (incl. Meet transcripts)
- [ ] Configure Nango with Google Drive scope
- [ ] Build "Connect Drive" button + ingestion worker
- [ ] Pull docs, sheets, slides → extract text → chunk → embed
- [ ] Specifically detect Meet transcript docs (filename pattern + content marker) → tag as `source=meet_transcript`
- [ ] **Done = Drive docs and Meet transcripts queryable via chat**

### Week 9 — Permissions + polish
- [ ] Implement Postgres Row-Level Security (RLS) policies on all tables
- [ ] Enforce: user only sees their own Gmail + workspace-shared Asana/Drive
- [ ] Test permission boundaries: log in as Bogdan → confirm cannot see Gino's emails
- [ ] Add source citation links in chat responses (click source → opens Gmail/Asana/Drive in new tab)
- [ ] Add basic empty states, loading states, error handling
- [ ] Add PostHog events for: signup, workspace_created, integration_connected, question_asked, answer_received
- [ ] **Validation gate:** Does QuickLeap team use it 3+ times/week for 2 weeks straight?
  - ✅ Yes → proceed to Phase 2
  - ❌ No → iterate on UX before adding integrations

**End of Phase 1 deliverables:** live product, QuickLeap as active workspace, 3 integrations working, real usage data.

---

## Phase 2 — Closed Beta with 3 Design Partners (Weeks 10–16)

**Goal:** Prove the product works for someone other than QuickLeap.

### Week 10 — Recruit design partners
- [ ] Use QuickLeap's intros + Phase 0 conversation list to identify 8–10 candidates
- [ ] Send recruitment message: "Free for 3 months in exchange for honest feedback + permission to use as case study"
- [ ] Sign 3 design partners on a 1-page Design Partner Agreement (free access, weekly 30-min check-in, can quote them publicly)
- [ ] Pick agencies of varied size (e.g. 8-person, 20-person, 40-person)

### Week 11 — Self-serve onboarding flow
- [ ] Build signup → workspace setup → integration wizard ("Connect Gmail → Connect Drive → Connect Asana → Done")
- [ ] Build progress indicators during ingestion ("Reading 1,247 emails... 30% done")
- [ ] Build "First question" prompt suggestions on empty state
- [ ] Onboard partner #1 — measure: how long until they ask their first question?
- [ ] **Done = a stranger can go from landing page to first answer in <10 min without you on a call**

### Week 12 — WhatsApp Business integration
- [ ] Set up Meta Business account + Cloud API access (use QuickLeap's WhatsApp Business as test)
- [ ] Build webhook receiver for incoming WhatsApp messages
- [ ] Tag WhatsApp messages with `workspace_id`, `is_shared=true` (business inbox is team-shared)
- [ ] Embed + store in same vector DB
- [ ] Add WhatsApp setup wizard with screenshots (white-glove for first 3 customers if needed)

### Week 13 — Discord integration
- [ ] Build Discord bot OAuth flow (server admin invites Gerendo bot to their Discord)
- [ ] Bot listens to channels it's added to, ingests messages
- [ ] Tag with `workspace_id`, `is_shared=true`, `source=discord`
- [ ] **Done = Discord channel content queryable from chat**

### Week 14 — First closed-loop agent
- [ ] Build nightly cron job: scan last 24h of activity across all sources
- [ ] Use Claude Sonnet to detect "interesting" patterns: deadline changes, sentiment shifts, contradictions between channels
- [ ] Send digest to workspace owner via email or in-app notification: "3 things you should know today"
- [ ] **Done = product is now active, not just reactive**

### Weeks 15–16 — Pure iteration on partner feedback
- [ ] Weekly 30-min calls with each design partner
- [ ] Track top 3 complaints per partner in a public log
- [ ] Fix the most-mentioned issue each week
- [ ] **Validation gate:** Are 2 of 3 partners using weekly? Does at least 1 say "I'd pay for this"?
  - ✅ Yes → proceed to Phase 3
  - ❌ No → kill features that don't get used, double down on what does

**End of Phase 2 deliverables:** 4 active workspaces (QuickLeap + 3 partners), 5 integrations live, first agent shipped, testimonials captured.

---

## Phase 3 — First Paying Customers (Weeks 17–26)

**Goal:** 5 paying agencies. Real money. Even €1 counts as proof.

### Week 17 — Pricing + Stripe activation
- [ ] Decide pricing model. Default proposal:
  - **Starter:** €299/mo workspace, up to 10 users, 2,000 LLM queries/mo
  - **Pro:** €699/mo workspace, up to 25 users, 10,000 queries/mo
  - **Scale:** €1,499/mo workspace, up to 50 users, 30,000 queries/mo + WhatsApp/Discord
  - Overages: €0.10/query
- [ ] Build Stripe billing integration (subscriptions, checkout, customer portal)
- [ ] Build usage tracking dashboard (queries used / month, cost per workspace)
- [ ] Add per-workspace cost monitoring (alert if any workspace burns >€100 in API costs in a month)

### Week 18 — Convert design partners
- [ ] Have the conversation with each partner: "Free trial ends in 30 days. Want to continue at €299?"
- [ ] Goal: 1 of 3 says yes → first paying customer
- [ ] Capture quotes/testimonials from all 3 regardless

### Weeks 19–22 — Outbound + content
Run 4 parallel acquisition channels:

**Channel 1: Warm referrals (highest ROI)**
- [ ] Ask QuickLeap + design partners for 2 referrals each = 8 warm leads
- [ ] Convert: aim for 1–2 paying customers from this batch

**Channel 2: LinkedIn outreach**
- [ ] Send 25 personalized DMs/week to founders of 15–50 person marketing agencies
- [ ] Hook: "Saw [specific thing about their agency]. Built a tool that solves [specific pain]. 15-min demo?"
- [ ] Expected: ~5% reply rate → 5 demos/month → 1 customer/month

**Channel 3: Build in public**
- [ ] Post 2x/week on LinkedIn: lessons from building Gerendo, agency workflow tips, case studies
- [ ] Build personal brand as "the developer who builds AI for agencies"
- [ ] Inbound DMs start month 2–3

**Channel 4: Agency communities**
- [ ] Identify 3–5 communities (Demand Curve, BrightonSEO Slack, EU agency Facebook groups, Romanian agency network)
- [ ] Be helpful for 4 weeks before posting anything about Gerendo
- [ ] Post case study/launch in week 5

### Weeks 23–26 — Product polish for paying users
- [ ] Build admin/billing portal
- [ ] Build help docs site (`docs.gerendo.com`) with setup guides for each integration
- [ ] Build in-app onboarding tour (first-time user walkthrough)
- [ ] Improve Sean Ellis test infrastructure: in-app survey to all active users at day 30
- [ ] **Validation gate:** 5 paying customers, NPS ≥ 30, Sean Ellis ≥ 40%
  - ✅ Yes → Phase 4 decision
  - ❌ No → reassess wedge / pricing / product

**End of Phase 3 deliverables:** 5 paying customers, ~€1,500 MRR, validated PMF signal, captured metrics.

---

## Phase 4 — Investor Decision (Weeks 27–30)

**Goal:** Decide bootstrap vs raise. Both are valid.

### Path A: Bootstrap
- Stay solo or hire 1 contractor
- Aim: €10k MRR by month 12, €30k MRR by month 18
- Quit other client work when MRR > monthly expenses
- Outcome: Profitable lifestyle business, €300k–1M ARR in 3–5 years

### Path B: Raise pre-seed (€300k–€800k)
- Apply to **Y Combinator** (next batch deadline — write down date now, work backward)
- Also apply to: Antler, Entrepreneur First, Seedcamp, Hoxton Ventures, Cherry Ventures, byFounders
- Find angels in agency/martech space via LinkedIn / AngelList
- Need for application:
  - 1-min product demo video
  - 5+ paying customers with quotes
  - Metrics: MRR, retention curve, NPS, Sean Ellis %
  - Why-now (LLM cost drop), why-you (you live in agencies via QuickLeap)

### Decision criteria
| If… | Then… |
|-----|-------|
| You love the work + want full control + can survive 12 more months solo | Bootstrap |
| You want to move fast + hire team + go big + can handle dilution | Raise |
| You're unsure | Apply to YC anyway. Application clarifies thinking. Getting in changes life. Not getting in costs nothing. |

**Honest recommendation:** Apply to YC the moment you hit 5 paying customers, even if undecided.

---

## Phase 5 — Scale to 25 Customers (Months 8–12)

**Goal:** Prove the business is repeatable, not a fluke.

### Build during this phase
- [ ] More integrations only when 3+ customers ask: HubSpot, ClickUp, Slack, Notion, Monday
- [ ] More agents: weekly client status reports, proposal-vs-delivery checker, sentiment alerts
- [ ] Public API (so customers can build automations on top of Gerendo)
- [ ] Mobile-responsive web (no native app yet)
- [ ] Multi-language support (Romanian, Italian, Spanish — agency markets where you have an edge)

### Sales motion
- [ ] If raised: hire growth/sales person
- [ ] Content engine: weekly blog posts, comparison pages ("Gerendo vs Glean", "Gerendo vs Dust")
- [ ] SEO target: "AI knowledge management for agencies", "agency operating system"
- [ ] Paid LinkedIn ads to lookalikes of paying customers
- [ ] Cold email sequences (use Smartlead, Instantly)

### Goal at month 12
**25 paying customers, €7,500–15k MRR.** Threshold where investors get excited and you can confidently quit consulting forever.

---

## Phase 6 — What This Becomes (Year 2+)

At ~25 customers, decide direction:

1. **Stay agency-vertical** — deepen, become "the AgencyOS." Cap at €5–10M ARR, high margins
2. **Expand to adjacent verticals** — design studios, dev shops, consulting firms. Same product, broader market
3. **Go up-market** — bigger agencies → SMB → enterprise. Higher prices, longer sales cycles, bigger outcomes (Glean trajectory)

**Decide based on what you've learned by then. Don't decide now.**

---

## Architecture (high level)

```
[User clicks "Connect Gmail"]
        ↓
[Nango handles OAuth → returns access token]
        ↓
[Background worker pulls Gmail messages]
        ↓
[Chunk → embed → store in Postgres + pgvector]
[Tagged: workspace_id, user_id, is_shared, source]
        ↓
[User asks "What did client X say?"]
        ↓
[Backend filters by RLS permissions]
        ↓
[Vector search → top 10 chunks]
        ↓
[Anthropic API call (Haiku default, Sonnet for hard queries) with prompt cache]
        ↓
[Streamed answer with source citations]
```

### Permission model (critical)

Two scopes for every piece of data:
- **Personal (user-scoped):** Gmail, personal calendar, DMs → only that user can query
- **Shared (workspace-scoped):** Asana tasks, Drive docs, WhatsApp Business inbox, Discord channels, Meet transcripts → whole team can query

Enforced via **Postgres Row-Level Security**. App code can have bugs; RLS cannot leak data.

### Cost model (rough, per customer)

| Per query | Cost |
|-----------|------|
| Embedding 10k tokens of context | ~$0.0002 |
| Claude Haiku 4.5 generation (10k in / 700 out) | ~$0.014 |
| With prompt caching (cached preamble) | ~$0.005 |
| **Average cost per query** | **~$0.01** |

A heavy user: 50 queries/day × 22 days = 1,100/month = **~€11/user/month in API costs.**
A light user: 100 queries/month = **~€1/user/month.**

At €299 workspace pricing with 10 users averaging 200 queries/month each = 2,000 queries × €0.01 = **€20/month cost vs €299 revenue = 93% gross margin.** ✅

---

## Risks + Mitigations

| Risk | Mitigation |
|------|-----------|
| LLM costs spike with heavy users | Per-workspace usage caps, overage billing, route to Haiku by default |
| Big competitor (Notion, Asana) ships native version | Move fast, own the agency niche before they care, deepen WhatsApp + Discord + agency-specific agents |
| GDPR / data privacy concerns from EU agencies | Use EU-region Supabase, write a clear DPA, store data in EU only, no training on customer data |
| QuickLeap is too small to validate the product | Recruit 3 design partners of varied size in Phase 2 — don't rely solely on QuickLeap |
| Gino burns out solo | Hire 1 contractor at €5k MRR for ingestion/integration grunt work |
| WhatsApp API changes break integration | Use Meta Cloud API (official), monitor changelog, abstract behind connector layer |
| Customer acquisition is slower than expected | 4 parallel channels in Phase 3 — don't depend on any single one |

---

## What you do this week

1. Confirm `app.gerendo.com` subdomain is set up + Vercel placeholder live
2. Create GitHub repo `gerendo-app` (private)
3. Buy/configure analytics + email tools (PostHog, Resend, plus Notion or Linear for tracking)
4. Draft the 1-page product brief (we do this together — see `BRIEF.md` next)
5. List 15–20 agency contacts for Phase 0 outreach

That's it. No code yet. Movement first.

---

## Files to create alongside this plan

- `BRIEF.md` — 1-page product brief (problem, target, scope, why now)
- `INTERVIEW_SCRIPT.md` — the 7-question Phase 0 interview script
- `OUTREACH_TEMPLATES.md` — cold + warm message templates for Phase 0 + Phase 3
- `ARCHITECTURE.md` — detailed data model, RLS policies, ingestion pipeline
- `CHANGELOG.md` — log every meaningful change/decision per session
- `_notes.md` — running session notes, open questions, decisions
