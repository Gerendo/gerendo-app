## 19c0240 - chore: fix Voyage MCP sourcing and harden search_gerendo rule

**Author:** Tocki28  
**Date:** 2026-05-02 14:01

- MCP server now sources .env.local via set -a before starting node
- CLAUDE.md: mandatory search_gerendo blockquote at top of file

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## 9f9353d - chore: harden Voyage pipeline - auto-refresh git history, update context rules

**Author:** Tocki28  
**Date:** 2026-05-02 13:51

- Regenerate GIT_HISTORY.md before every index run (index.ts)
- Add full source inventory to HOW_THE_CLI_WORKS.md
- CLAUDE.md: pipeline-first context rule with file fallback
- docs/CHANGELOG.md: session log

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## 53934df - feat: add Voyage RAG pipeline and MCP server for semantic context retrieval

**Author:** Tocki28  
**Date:** 2026-05-02 13:36

- Add gerendo CLI (chunker, embedder, SQLite DB, index + ask commands)
- Add MCP server exposing search_gerendo tool for Claude Code integration
- Register MCP server and auto-index hook in .claude/settings.json
- Slim CLAUDE.md to hard rules only - all context via search_gerendo
- Add docs/HOW_THE_CLI_WORKS.md explaining the full RAG pipeline
- Add data/ and *.db to .gitignore

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---
## c946f7b - docs: slim CLAUDE.md and _notes.md, route history to CHANGELOG

**Author:** Tocki28  
**Date:** 2026-05-02 08:25

CLAUDE.md trimmed 192 -> 86 lines: kept operational essentials (stack,
architectural rules, conventions, ask-before list, session ritual).
Pitch / target customer / comparisons / validation gates moved to BRIEF
and PLAN. Loaded every turn so the savings compound.

_notes.md trimmed 106 -> 31 lines: keeps current state and open
questions only. Two prior session blocks moved into CHANGELOG.md.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>

---
## 0609038 - docs: log 2026-05-02 session (favicon, em-dash purge, two-way email aliases)

**Author:** Tocki28  
**Date:** 2026-05-02 08:21

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>

---
## 1da736a - copy: replace em dashes with single hyphens across marketing site

**Author:** Tocki28  
**Date:** 2026-05-02 07:27

Per founder preference, swap every — for - in titles, meta, and body copy
on the marketing site. Cleaner, less AI-sounding.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>

---
## 925146a - feat: add Gerendo favicon + finalize SEO metadata

**Author:** Tocki28  
**Date:** 2026-05-02 07:26

- Drop Gerendo-Favicon.png into both public dirs (marketing + app)
- Wire <link rel="icon"> in TanStack __root.tsx and Next.js layout.tsx
- Replace Lovable-default meta (title, og:image, twitter:site) with Gerendo branding
- Align homepage description with the "one brain / one OS" hero copy

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>

---
## 4a9fd3a - Remove sensitive credentials from Git

**Author:** Tocki28  
**Date:** 2026-05-01 07:30


---
## db6f092 - F5Bot automation added + Ermi name changed in email

**Author:** Tocki28  
**Date:** 2026-05-01 07:09


---
## 3f96d82 - update terms of use

**Author:** Tocki28  
**Date:** 2026-05-01 07:05


---
## 695f9de - update terms of use

**Author:** Tocki28  
**Date:** 2026-04-30 17:27


---
## eacd182 - update cookie policy

**Author:** Tocki28  
**Date:** 2026-04-30 17:20


---
## aa5191d - update cookie policy

**Author:** Tocki28  
**Date:** 2026-04-30 17:17


---
## 959d25f - update privacy policy

**Author:** Tocki28  
**Date:** 2026-04-30 16:58


---
## 8227207 - update privacy policy

**Author:** Tocki28  
**Date:** 2026-04-30 16:53


---
## 0a0fe0b - fix: regenerate package-lock.json for Lovable site

**Author:** Tocki28  
**Date:** 2026-04-29 23:13

Cloudflare uses `npm ci` which requires exact alignment between
package.json and package-lock.json. The Lovable export had a stale
lockfile (@lovable.dev/vite-tanstack-config 1.2.0 -> 1.4.3,
framer-motion missing entirely, etc.). Regenerated locally.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>

---
## 2c5805e - copy: welcome email — solo founder -> co-founder

**Author:** Tocki28  
**Date:** 2026-04-29 23:07

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>

---
## 7fa0818 - fix: drop bun.lockb so Cloudflare Pages uses npm

**Author:** Tocki28  
**Date:** 2026-04-29 23:04

Cloudflare auto-detects Bun when bun.lockb is present and runs
`bun install --frozen-lockfile` before any build command — failing
because the exported lockfile is in an outdated format. Removing it
makes Cloudflare fall back to npm via package-lock.json, which is
what we want.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>

---
## e2829fd - fix: lazy-init Resend client inside POST handler

**Author:** Tocki28  
**Date:** 2026-04-29 22:55

Top-level `new Resend(process.env.RESEND_API_KEY)` ran during Next's
build-time "collect page data" pass and threw because env vars aren't
populated until runtime on Vercel. Move client instantiation + env
reads inside the handler. Also returns a clean 500 if env is missing
in production instead of crashing the build.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>

---
## bbfa19f - fix: exclude agency-brain-ai-main from Next.js type-check

**Author:** Tocki28  
**Date:** 2026-04-29 22:50

Vercel's Next build was failing because TypeScript walked into the
Lovable subfolder, whose deps (framer-motion, etc.) aren't installed
at the repo root. The subfolder is its own self-contained project,
deployed separately by Cloudflare Pages.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>

---
## f701676 - feat: waitlist landing pages + Resend integration

**Author:** Tocki28  
**Date:** 2026-04-29 22:44

- Build Next.js waitlist at app.gerendo.com (Fraunces + Inter, warm-ink palette, italic G favicon)
- Add /api/waitlist route handler: Resend contacts.create + transactional welcome email
- Add CORS so cross-origin POST from gerendo.com works
- Add Lovable marketing site in agency-brain-ai-main/ (TanStack Start, targets Cloudflare Pages)
- Wire Lovable WaitlistDialog to POST to app.gerendo.com/api/waitlist
- Soften vapor security + AI claims to honest "we're building" framing
- Rename fictional client Pescobar -> Marengo in AskDemo
- Update .gitignore to handle nested deps + Vite build outputs

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>

---
## ed15ac5 - docs: add BRIEF.md, ARCHITECTURE.md; update notes + changelog

**Author:** Tocki28  
**Date:** 2026-04-28 18:21

- BRIEF.md v0: 1-page product brief with placeholders for drift story, why-now, why-us
- ARCHITECTURE.md v0: RAG data model, RLS pattern, ingest + retrieval pipelines, 6 milestones
- _notes.md + CHANGELOG.md: today's progress, decisions, open questions

---
## 1d3b3b0 - chore: trigger redeploy after repo visibility change

**Author:** Tocki28  
**Date:** 2026-04-28 18:16


---
## d430229 - docs: add CLAUDE.md, _notes.md, planning docs from venture brainstorm

**Author:** Tocki28  
**Date:** 2026-04-28 06:28

Sets up this repo as a self-contained Claude Code workspace for the Gerendo SaaS product. Includes target customer context, marketing agency operational reality, locked-in stack decisions, validation gates, and session management routines. Phase 0 — Validation; no app code yet.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>

---
## 5e26c7d - Initial commit from Create Next App

**Author:** Tocki28  
**Date:** 2026-04-28 06:09


---