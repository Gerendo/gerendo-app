# Gerendo SaaS — Running Session Notes

Read this at the start of every session. Update it at the end of every session.

---

## Last session: 2026-04-28

### What got done
- Scaffolded Next.js 16 + TS + Tailwind 4 at `~/gerendo-app/`
- Created private GitHub repo: `Gerendo/gerendo-app`
- Deployed to Vercel (Hobby/Free tier)
- Configured custom domain `app.gerendo.com` — CNAME in Cloudflare DNS, SSL provisioned, valid configuration
- Cloudflare CNAME is **DNS-only (grey cloud)** — proxy must stay disabled for Vercel SSL to work
- Wrote workspace `CLAUDE.md` with full SaaS + marketing-agency context
- Copied planning docs from `~/Gerendo/Ventures/Gerendo/` into `~/gerendo-app/docs/`

### Current phase
**Phase 0 — Validation.** Infra is live but no app code yet (deliberate). We're validating the wedge before building.

---

## Open questions (pick up next session)

1. **Draft `docs/BRIEF.md`** — the 1-page product brief (problem, target, scope, why now, why-Gino). Highest-leverage next artifact. Becomes spine of outreach + landing copy + YC app.
2. **Draft `docs/INTERVIEW_SCRIPT.md`** — the 7 questions for Phase 0 outreach conversations.
3. **Draft `docs/OUTREACH_TEMPLATES.md`** — cold + warm message templates.
4. **Draft `docs/ARCHITECTURE.md`** — detailed Postgres schema, RLS policies, ingestion worker design (before any code in Week 4).
5. **Build the 15–20 agency contact list** for Phase 0 outreach (name, size, current tools, intro path, priority).
6. **Replace default Next.js page with "Coming Soon + waitlist email capture"** — only after BRIEF nails the positioning. Don't ship vague copy.
7. **Phase 0 start date** — when does Week 1 of outreach actually begin? Calendar time matters.

---

## Decisions locked in (do not relitigate)

- Subdomain split: `gerendo.com` = marketing (later), `app.gerendo.com` = product
- Repo lives at `~/gerendo-app/`, not under `~/Gerendo/` — different lifecycle from agency work
- Tech stack: Next.js 16, TS, Tailwind 4, Supabase, Nango, Anthropic, Vercel, Stripe, PostHog, Resend
- Multi-tenant + RLS from line 1 — never retrofit security
- Workspace pricing (€299–€1,499/mo), not per-seat
- QuickLeap = sandbox only. Real design partners come from outside QuickLeap

---

## Things to NOT do yet

- Don't write Supabase schema yet — wait for `ARCHITECTURE.md` draft
- Don't install shadcn/ui until first real UI need
- Don't activate Stripe billing — wait until Phase 3
- Don't do cold customer-discovery interviews Gino dreads — lean on warm intros + build-in-public

---

## Reference

- Full plan: [docs/PLAN.md](docs/PLAN.md)
- Original venture notes: [docs/_notes-original.md](docs/_notes-original.md)
- Changelog: [docs/CHANGELOG.md](docs/CHANGELOG.md)
- Agency operational context: `~/Gerendo/CLAUDE.md`
