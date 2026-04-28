# Gerendo SaaS — Running Session Notes

Read this at the start of every session. Update it at the end of every session.

---

## Last session: 2026-04-28 (afternoon — docs + deploy unblock)

### What got done
- **Drafted [docs/BRIEF.md](docs/BRIEF.md)** — v0 of the 1-page product brief, with `[GINO: ...]` markers for the four spots that need Gino's input (drift story, "why now" lead angle, "why us", contact line)
- **Drafted [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — v0 covering RAG data model, RLS pattern, ingest pipeline, retrieval flow, drift detection (Claude-as-judge v1), cost discipline, 6 milestones (M1–M6) with concrete demo targets, 6 open questions
- **Resolved Vercel deploy block** — `app.gerendo.com` was stuck on first scaffold deploy because Hobby plan blocked deploys of org-owned private repos. Pivoted from repo-transfer (got stuck waiting on Tocki28 acceptance) to **making the repo public**. Deploy now works, push-to-deploy chain restored.
- **Disabled Vercel "Improve models with this project's data"** toggle — privacy hygiene before any real data lands.
- **Validated RAG architecture direction** with Gino — Gino described the right approach (embed on ingest, retrieve on query, send only relevant chunks to Claude). Added the four nuances he hadn't thought through (chunking, hybrid search, citations, RLS at vector layer).
- **New feature added: scope-creep detection.** Gino's idea — at project kickoff, capture the SOW/scope; flag any new client request (WhatsApp, Meet, email) that goes outside it. This is a specialization of drift detection, tied directly to agency margin. Will fold into ARCHITECTURE.md as a first-class feature next session.

### Current phase
**Phase 0 — Validation.** Infra fully unblocked. Docs spine is taking shape. Still no app code.

---

## Open questions (pick up next session)

1. **Fold scope-creep detection into ARCHITECTURE.md** as a first-class feature (separate from generic drift). Needs `project_scopes` table + scope-check step in ingest loop.
2. **Fill in the four `[GINO: ...]` markers in BRIEF.md** — drift story, why-now angle, why-us, contact line. Without these, BRIEF can't ship to outreach.
3. **Decide the 6 open questions in ARCHITECTURE.md** — embedding model (Voyage-3 default), workspace identity (JWT custom claim default), raw doc storage, reranker, WhatsApp ingestion model, background worker platform.
4. **Draft `docs/INTERVIEW_SCRIPT.md`** — 7 past-behavior questions for Phase 0 conversations (not hypothetical — Mom Test discipline).
5. **Draft `docs/OUTREACH_TEMPLATES.md`** — warm + cold templates, asking for 20 minutes of experience, no pitch.
6. **Build the 15–20 agency contact list** — name, size, current tools, intro path, priority. The bottleneck for Phase 0.
7. **Set Phase 0 Week 1 start date** — pick an actual Monday on the calendar.
8. **Replace default Next.js homepage with "Coming Soon + waitlist"** — only after BRIEF nails positioning.
9. **Make the repo private again** before Week 4 (when real schema/keys land). Currently public for build-in-public Phase 0 strategy.

---

## Decisions locked in (do not relitigate)

- Subdomain split: `gerendo.com` = marketing (later), `app.gerendo.com` = product
- Repo lives at `~/gerendo-app/`, not under `~/Gerendo/` — different lifecycle from agency work
- Tech stack: Next.js 16, TS, Tailwind 4, Supabase, Nango, Anthropic, Vercel, Stripe, PostHog, Resend
- Multi-tenant + RLS from line 1 — never retrofit security
- Workspace pricing (€299–€1,499/mo), not per-seat
- QuickLeap = sandbox only. Real design partners come from outside QuickLeap
- **GitHub repo public during Phase 0** for build-in-public + to bypass Vercel Hobby restriction. Flip private before Week 4.
- **Drift detection v1 = Claude-as-judge** (feed variants, ask if contradictory). Don't build custom comparison engine yet.
- **Scope-creep detection is the headline drift use case** — most valuable specialization, tied to agency margin.

---

## Things to NOT do yet

- Don't write Supabase schema yet — wait until M1 (Week 4–5)
- Don't install shadcn/ui until first real UI need
- Don't activate Stripe billing — wait until Phase 3
- Don't do cold customer-discovery interviews Gino dreads — lean on warm intros + build-in-public
- Don't replace the homepage until BRIEF.md is finalized — vague copy is worse than default scaffold

---

## Reference

- Full plan: [docs/PLAN.md](docs/PLAN.md)
- Product brief: [docs/BRIEF.md](docs/BRIEF.md)
- Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Original venture notes: [docs/_notes-original.md](docs/_notes-original.md)
- Changelog: [docs/CHANGELOG.md](docs/CHANGELOG.md)
- Agency operational context: `~/Gerendo/CLAUDE.md`
