# How the Gerendo CLI works

## The big picture

You have a workspace full of markdown files - docs, notes, memory files, everything. The problem: if you wanted Claude to answer a question using that context, you'd have to feed all of it into Claude every single time. That's slow and expensive because Claude is a large, expensive model that charges per token.

The CLI solves this with two phases: index once, query cheap.

---

## What is indexed

Every time the indexer runs, it refreshes and indexes the following sources:

**Repo root**
- `CLAUDE.md` - operational rules, stack, architectural constraints
- `AGENTS.md` - Next.js 16 breaking-changes warning
- `_notes.md` - current session state and open questions
- `README.md` - repo entry point

**`docs/`**
- `ARCHITECTURE.md` - RAG data model, RLS pattern, ingest pipeline, retrieval flow, 6-milestone roadmap
- `BRIEF.md` - 1-page product brief with founder fill-in markers
- `CHANGELOG.md` - full session history, decisions, what was built each session
- `FORUM_POSTS.md` - outreach / community posts
- `GIT_HISTORY.md` - full git log, regenerated fresh before every index run
- `HOW_THE_CLI_WORKS.md` - this file
- `INTERVIEW_SCRIPT.md` - Phase 0 validation interview script
- `MEMORY_LAYER.md` - memory-layer reframe (local-first, Gino as customer zero)
- `PLAN.md` - week-by-week build plan Phase 0 through Phase 5
- `README-original.md` - original scaffold readme (kept for reference)
- `_notes-original.md` - original session notes (kept for reference)

**`~/.claude/projects/.../memory/`**
- `MEMORY.md` - index of all memory files
- `feedback_marketing_decisions.md` - positioning and copy decisions
- `feedback_no_em_dashes.md` - no em dashes in any Gerendo prose
- `feedback_no_raw_text_in_db.md` - store only embeddings + pointers, never raw text
- `project_brand_tokens.md` - locked palette, fonts, wordmark, favicon spec
- `project_deployment_topology.md` - which domain serves what, from which platform
- `reference_resend.md` - Resend domain, audience, key permissions, From conventions
- `user_personas.md` - Andrei / Ermina personas, when to use each in copy

---

## Phase 1 - Indexing (runs when context changes)

The entire workspace gets fed into Voyage, a small cheap model whose only job is to convert text into numbers.

Voyage reads each chunk of your docs and produces a list of 512 numbers that represent the meaning of that chunk. That list of numbers is called an embedding. Chunks that mean similar things get similar numbers - they cluster together on a map.

Voyage stores nothing. It's stateless - just a converter. The map lives in your SQLite database on disk. You own it.

This phase runs once at the start, then again whenever something in your docs changes. When a file changes, the affected chunks get new embeddings and new points on the map. Everything else stays as-is.

---

## Phase 2 - Asking a question (runs every time you ask)

When you ask a question, Voyage converts that question into the same kind of 512-number embedding. Now your question is a point on the same map as all your docs.

The system finds the chunks whose points on the map are closest to your question's point. Closest = most relevant to what you asked.

Those chunks are pointers - they hold the file path and exact byte positions, not the raw text. The system reads the raw text fresh from disk using those pointers, then hands only that text to Claude.

Claude sees maybe 2,000 tokens of the most relevant context instead of 50,000 tokens of everything. It answers the question based only on what was retrieved.

---

## Why this is smart

```
Without RAG:   all 23 files → Claude every time   (slow, expensive, hits limits)
With RAG:      all 23 files → Voyage once          (cheap, builds the map)
               question     → Voyage               (finds the relevant 5 chunks)
               5 chunks     → Claude               (answers fast and cheap)
```

Voyage retrieval costs almost nothing. Claude only touches the relevant slice. The map is yours and stays on your machine.

---

## The raw text rule

The database never stores raw text - only the 512-number embedding and a pointer (file + byte range). When a chunk is needed, the system reads it live from disk. This means your files are always the source of truth. The database is just an index.

---

## The models

- **Voyage** (`voyage-3-lite`) - converts text to numbers. Stateless, cheap, fast. No language understanding, just geometry.
- **Claude Haiku** - answers the question from the retrieved context. Only runs once per question, on a small slice of your docs.

---

## Two ways to use it

There are two different entry points, and they use different APIs:

**`npm run gerendo:ask "question"`** - standalone CLI tool. Uses both Voyage (to find chunks) and Claude Haiku (to write the answer). Needs both `VOYAGE_API_KEY` and `ANTHROPIC_API_KEY` in `.env.local`. You run it, Haiku answers.

**MCP server (`mcp.ts`)** - runs inside Claude Code. Uses only Voyage to find and return the relevant passages. Claude Code itself does the answering - no separate Anthropic API call. Only needs `VOYAGE_API_KEY`.

The difference: `gerendo:ask` is a complete self-contained pipeline. The MCP server is just the retrieval half - it hands the passages to Claude Code and steps aside.

---

## Running gerendo:ask from VS Code terminal

Claude Code injects its own `ANTHROPIC_API_KEY` into every terminal it opens for its internal use. That key is scoped to Claude Code and cannot be used to make direct API calls from your code.

If you run `export ANTHROPIC_API_KEY=...` in the VS Code terminal it will not override Claude Code's injected key. Your key never makes it through.

The fix is to prefix the key inline for that one command:

```bash
ANTHROPIC_API_KEY=$(grep ANTHROPIC_API_KEY .env.local | cut -d= -f2-) VOYAGE_API_KEY=$(grep VOYAGE_API_KEY .env.local | cut -d= -f2-) npm run gerendo:ask "your question"
```

Or add both keys to `~/.zshrc` so they load before Claude Code starts:

```bash
export ANTHROPIC_API_KEY=your_full_key_here
export VOYAGE_API_KEY=your_full_key_here
```

Then restart your terminal. Keys in `~/.zshrc` load before Claude Code injects anything so they take priority.

---

## One-line summary

Voyage makes a map of your docs once. Every question finds its spot on that map, pulls the nearby raw text, and hands it to Claude. Claude never sees the whole workspace - only what's relevant.
