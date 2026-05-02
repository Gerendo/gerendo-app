@AGENTS.md

# Gerendo SaaS - Workspace Brain

**Context rule:** Do not read markdown files to gather project context. Always call the `search_gerendo` MCP tool first. Voyage returns only the relevant passages. Read files only when editing them.

**One-liner:** Unified intelligence layer for 15-50 person marketing agencies. Closed loop, not dashboard.

**Founder:** Gino, solo. **Status:** Phase 0 (validation).

---

## Tech stack (locked)

- **Product app:** Next.js 16 + TS + Tailwind 4 + shadcn/ui at repo root → `app.gerendo.com` (Vercel)
- **Marketing site:** TanStack Start + Vite + framer-motion at `agency-brain-ai-main/` → `gerendo.com` (Cloudflare Pages)
- **Backend/DB:** Supabase (Postgres + pgvector + Auth + RLS)
- **Integrations:** Nango
- **LLM:** Anthropic - Haiku 4.5 default, Sonnet 4.6 for hard queries, prompt caching mandatory
- **Email:** Resend (sending) + Cloudflare Email Routing (inbound)
- **Payments:** Stripe (don't activate until Phase 3)
- **Analytics:** Cloudflare Web Analytics + Google Search Console

> Next.js 16 has breaking changes from 15. Read `node_modules/next/dist/docs/` or fetch official docs before writing Next-specific code.

---

## Architectural rules (do not relitigate)

- **Multi-tenant + RLS from line 1.** Every table tagged `workspace_id`, `user_id`, `is_shared`, `source`. Two scopes: personal (Gmail, DMs) and shared (Asana, Drive, WhatsApp Business, Meet). RLS enforces both.
- **One repo, two deploys.** Vercel on root, Cloudflare Pages on `agency-brain-ai-main/`.
- **No em dashes in any Gerendo prose** (titles, copy, emails, legal). Use `-`, comma, or period.
- **No raw text in DB.** Store only embeddings + pointers + hashes. Fetch raw live at query time.

---

## Conventions

- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`)
- **Branches:** `main` always deployable. Feature branches off main.
- **TypeScript:** strict. No `any` without a justifying comment.
- **CSS:** Tailwind 4 utilities. Component-scoped CSS only when Tailwind can't.
- **No premature abstractions.** Three similar lines beats a wrong abstraction.

---

## Always ask before

- Installing dependencies
- Destructive commands (delete, reset, force push)
- Supabase schema changes once data exists
- Anything touching auth, billing, or RLS policies
- Production env vars

---

## Session end

Append a block to `docs/CHANGELOG.md`. Commit + push if code changed.
