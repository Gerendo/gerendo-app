# Gerendo - Memory Layer (working spec)

**Status:** working spec for the v0 build. Will evolve. Read [_notes.md](../_notes.md) and this doc at session start.

This doc supersedes the Phase 1 build path in [PLAN.md](PLAN.md) for v0 work. PLAN.md and [BRIEF.md](BRIEF.md) are not yet rewritten - the pitch is shifting and we'll re-true them after Step 1-3 are working.

---

## The reframe

Gerendo is **memory infrastructure for AI**, not a chat product, not a search tool, not "RAG over agency tools."

- The **map** (a structured, evolving model of you and your work) is the product.
- The **AI** (Claude, etc.) is the consumer of the map.
- The map starts from your own writing/notes/transcripts. External tools (Gmail, Drive, Asana) come later as additional sources feeding the same map.

Customer zero is Gino. The first data source is Gino's own context. Everything else is a copy-paste of the same pipeline pointed at a different source.

**Pitch (working):** *Gerendo is memory infrastructure for AI. It ingests where your context lives, maintains a structured map of you and your work, and serves it to any AI that asks. The AI brings reasoning. Gerendo brings memory.*

---

## Architecture (locked)

### Storage rule (the hard constraint)

**No raw text is persisted in Gerendo's DB. Ever.**

The DB stores only:
- **Embeddings** (vectors)
- **Pointers** to where the raw text lives (`source_type`, `source_id`/path, `byte_start`, `byte_end`)
- **Content hashes** to detect source mutation
- **Derived metadata** (the map: entities, events, summaries)

Raw bodies stay in the source system (your filesystem today, Gmail/Drive tomorrow). At query time we fetch live, hand to the LLM, discard.

If the DB leaks, the attacker gets a graph + vectors. Not your emails, not your notes.

### Two layers of memory

1. **Raw memory** - chunk-level vectors with pointers. "What did I write?"
2. **Structured memory (the map)** - LLM-extracted entities, events, relationships, summaries. "Who is X? What did I decide? What's open?"

Both live in the same DB. Queries hit both: structured first (precise), raw second (deep). The map's summaries *are* persisted - they're derived metadata, not raw content. The storage rule applies to source bodies, not derived facts.

### AI access boundary

The LLM sees raw content **only in transit**:
- During ingestion (extract entities/events, then discard)
- During a query when raw spans are fetched and handed in (then discard)

Never persisted on Gerendo's side.

### Schema sketch

```
chunks
  id | pointer_json | embedding | content_hash | indexed_at
  -- pointer_json: { source_type, source_id_or_path, byte_start, byte_end }
  -- NO text column

entities
  id | name | type | summary | embedding | last_seen_at

events
  id | summary | entity_ids[] | occurred_at
     | source_pointers[] | embedding
```

### Query flow

```
user question
   ↓
embed query
   ↓
vector search over chunks + entities + events
   ↓
top-K pointers + map summaries
   ↓
fetch raw byte spans from source (filesystem / Gmail / etc.)
   ↓
hand to Claude with map summaries + raw spans + question
   ↓
streamed answer with citations linking back to source
   ↓
raw spans discarded
```

---

## Build order

| Step | Source | Output |
|------|--------|--------|
| **1** | Own markdown (`CLAUDE.md`, `AGENTS.md`, `_notes.md`, `docs/*.md`, `MEMORY.md`) | Working `gerendo ask` CLI over Gino's static context |
| **2** | Claude Code conversation transcripts (`~/.claude/projects/<this-project>/`) | Past sessions queryable |
| **3** | Structured map extraction layer | Entities + events tables populated, queries hit map first |
| **4** | First external source (TBD - probably **not** Gmail; pick whichever has highest signal for Gino's day) | First real integration |
| **later** | Web app, multi-tenant, SaaS | The product PLAN.md describes |

---

## Locked defaults

| Decision | Choice |
|----------|--------|
| Runs where | Local laptop. Cloud later. |
| Language | TypeScript + Node (matches Next.js codebase) |
| DB | SQLite + `sqlite-vec` |
| Embedding model | Anthropic (`voyage-3` via Voyage AI is an option later if cost matters) |
| Front-end | Claude Desktop or Claude Code. No UI to build. |
| Ingestion AI access | Transient: LLM reads content during ingestion, extracts map, discards. Never persisted. |
| Structured map summaries | Persisted (derived metadata, not raw content) |

---

## Step 1 spec (next session)

**Goal:** working `gerendo ask "..."` CLI that answers questions about Gino's existing markdown context, with citations, without ever storing the text.

**Scope:**

1. New folder `src/gerendo-cli/` (separate from the Next.js app at `src/app/`).
2. Walk these files:
   - `CLAUDE.md`, `AGENTS.md`, `_notes.md`, `README.md`
   - Everything in `docs/*.md`
   - Everything under `~/.claude/projects/-Users-mingw-gerendo-app/memory/`
3. Chunk by section/paragraph (~500 tokens each). Record `{path, byte_start, byte_end, content_hash}` per chunk.
4. Embed each chunk via Anthropic.
5. Store **only** `(pointer_json, embedding, hash)` rows in SQLite + `sqlite-vec`. No text column.
6. Two CLI commands:
   - `gerendo index` - rebuild index from files
   - `gerendo ask "<question>"` - embed query → vector search → top 5 pointers → re-read byte spans → Claude answers with `[file:line]` citations

**Out of scope for Step 1:** map extraction (Step 3), conversation transcripts (Step 2), Gmail (Step 4+), incremental re-indexing, web UI, multi-user.

**Estimated effort:** 1-2 hours.

**Permissions needed before starting:**
- Anthropic API key in `.env.local` (Gino to provide / confirm)
- Install deps: `better-sqlite3`, `sqlite-vec`, `@anthropic-ai/sdk`
- Create `data/` folder, gitignore it

**First test query (acceptance):**
`gerendo ask "what does Gino want for the first integration?"` should return an answer that cites `_notes.md` or this doc and *not* contain hallucinated content.

---

## Open questions (defer until after Step 1)

- Chunking strategy: paragraph vs section vs semantic. Default paragraph for now; revisit if retrieval quality is bad.
- Re-index policy when source files mutate. Default: full re-index on `gerendo index`. Add incremental later.
- Embedding vendor: Anthropic vs Voyage AI vs OpenAI. Default Anthropic; benchmark later.
- When to update [BRIEF.md](BRIEF.md) and [PLAN.md](PLAN.md) to reflect the memory-layer reframe. Not yet - wait until Step 3 is working and the pitch is proven by daily use.
- Strategic question: is "personal AI memory" the wedge that expands into "agency AI memory," or are they different products? Decide after 2 weeks of dogfooding.

---

## What this is NOT

- Not a chat app. Claude Desktop / Claude Code is the chat.
- Not a notes app. Sources stay where they are.
- Not a multi-tenant SaaS yet. One user, local laptop.
- Not "search my Gmail." That's a much later step and may never be the priority.
- Not the PLAN.md Phase 1 build. PLAN.md assumed a hosted multi-tenant web app from the start; we've cut underneath that.
