@AGENTS.md

# Gerendo SaaS - Workspace Brain

This repo is **Gerendo SaaS** (the product), separate from `~/Gerendo/` (the agency). Don't mix.

**One-liner:** Unified intelligence layer for 15-50 person marketing agencies. Ingests Gmail / Drive / Asana / Meet / WhatsApp / Discord; team queries it in plain language with cited sources. Closed loop, not dashboard.

For the full pitch, comparisons, target customer, and validation gates -> [docs/BRIEF.md](docs/BRIEF.md). For roadmap and milestones -> [docs/PLAN.md](docs/PLAN.md). Read those when relevant; don't load them every turn.

**Founder:** Gino, solo. **Status:** Phase 0 (validation). See [_notes.md](_notes.md) for current state.

---

## Tech stack (locked)

- **Product app:** Next.js 16 + TS + Tailwind 4 + shadcn/ui (install only when needed) at repo root, deployed on Vercel as `app.gerendo.com`
- **Marketing site:** TanStack Start + Vite + framer-motion at `agency-brain-ai-main/`, deployed on Cloudflare Pages as `gerendo.com`
- **Backend/DB:** Supabase (Postgres + pgvector + Auth + RLS)
- **Integrations:** Nango
- **LLM:** Anthropic - Haiku 4.5 default, Sonnet 4.6 for hard queries, **prompt caching mandatory**
- **Email:** Resend (sending) + Cloudflare Email Routing (inbound forwarding)
- **Payments:** Stripe (don't activate until Phase 3)
- **Analytics:** Cloudflare Web Analytics (cookieless) + Google Search Console

> Next.js 16 has breaking changes from 15. Read `node_modules/next/dist/docs/` or fetch official docs before writing Next-specific code.

---

## Architectural rules (do not relitigate)

- **Multi-tenant + Row-Level Security from line 1.** Every table tagged `workspace_id`, `user_id`, `is_shared`, `source`. Two scopes: **personal** (Gmail, DMs - user only) and **shared** (Asana, Drive, WhatsApp Business, Meet - whole team). RLS enforces both.
- **One repo, two deploys.** Vercel on root, Cloudflare Pages on `agency-brain-ai-main/`.
- **No em dashes in any Gerendo prose** (titles, copy, emails, legal). Use `-`, comma, or period.

---

## Workspace layout

```
~/gerendo-app/
├── CLAUDE.md, AGENTS.md, _notes.md     ← read at session start
├── docs/                                ← BRIEF, PLAN, ARCHITECTURE, CHANGELOG, ...
├── src/app/                             ← Next.js (app.gerendo.com)
├── agency-brain-ai-main/                ← TanStack Start (gerendo.com)
└── public/                              ← Next.js static assets
```

---

## Conventions

- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`)
- **Branches:** `main` always deployable. Feature branches off main.
- **Deploy:** push to main -> auto-deploy.
- **Env vars:** `.env.local` (gitignored), Vercel project settings for prod.
- **TypeScript:** strict. No `any` without a justifying comment.
- **CSS:** Tailwind 4 utilities. Component-scoped CSS only when Tailwind can't.
- **shadcn/ui:** copy into `src/components/ui/` when added; read before installing.
- **No premature abstractions.** Three similar lines beats a wrong abstraction.

---

## Always ask before

- Installing dependencies
- Destructive commands (delete, reset, force push)
- Supabase schema changes once data exists
- Anything touching auth, billing, or RLS policies
- Production env vars

---

## Session ritual

**Start:** read `_notes.md`. Skim recent `docs/CHANGELOG.md` if needed. `git status` + recent commits.

**End:** update `_notes.md` (current state and open questions only - keep it short). Append session block to `docs/CHANGELOG.md`. Commit + push if code changed.

**Context alerts:** warn Gino after 2 major tasks in one session. A major task = agent rewrite, schema change, integration build, validation milestone.

---

## Cross-workspace pointer

`~/Gerendo/` is the agency workspace - different lifecycle. Don't push agency client data into this repo. Reference `~/Gerendo/CLAUDE.md` only when product decisions need agency operational context.
