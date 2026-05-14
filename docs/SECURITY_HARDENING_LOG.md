# Security hardening log (2026-05-13 → 2026-05-14)

Two-day cycle that took Gerendo from "marketing claims RLS-based privacy"
to "marketing claim is cryptographically true." Four phases of column
encryption + eight rounds of independent audit + one post-audit
follow-up. This doc is the canonical reference for *what* shipped, *why*
each piece exists, and *how* to debug it. Read this before changing any
encrypted-column write/read path.

---

## TL;DR for the next session

- **26 sensitive columns are encrypted at rest** with AES-256-GCM, AAD-bound, master key in `GERENDO_MASTER_KEY` (Vercel env + `.env.local`).
- **OAuth refresh failures are observable** — `ReauthorizeRequiredError` thrown by `getGmailToken`/`getDriveToken`/`getAsanaToken`, surfaced as a 401 in routes, an SSE `needs_reauth` event in `/api/ask`, and a structured `[oauth-reauth-needed]` log in webhooks.
- **Drift Asana mutations are idempotent** — partial-failure retries don't create duplicate sections/tasks/comments.
- **All 4 smoke test scripts pass** against live Supabase. Run them after any change to encryption-touching code.
- **The encryption rules hook** (`.claude/hooks/encryption-rules.sh`) injects column inventory + WRITE/READ patterns into every session start. Don't bypass it.

---

## Phase 1-4: column encryption rollout

### Phase 1+2 (content + tokens, audit pre-history)

Encrypted, plaintext columns dropped:
- `messages.subject_enc`
- `embeddings.keyword_text_enc`
- `drive_embeddings.keyword_text_enc`
- `asana_embeddings.keyword_text_enc`
- `summaries.summary_enc`
- `facts.detail_enc`
- `oauth_tokens.access_token_enc`
- `oauth_tokens.refresh_token_enc`

### Phase 3a (PII + metadata)

- `messages.sender_enc`, `messages.thread_id_enc`
- `drive_files.name_enc`
- `asana_items.name_enc`, `project_name_enc`, `assignee_enc`, `notes_enc`, `due_date_enc`, `permalink_url_enc`
- `workspace_contexts.context_text_enc`

### Phase 3b (drift findings)

- `drift_findings.decision_summary_enc`, `draft_update_enc`, `resolution_note_enc`

### Phase 4 (workspace + chat)

- `workspaces.name_enc`
- `conversations.title_enc`
- `conversation_messages.content_enc`

### Post-audit-3 (action_log JSONB)

- `action_log.payload_before_enc`, `payload_after_enc`

**Total: 26 encrypted columns. Zero plaintext counterparts remain.**

---

## Core crypto primitives

`src/lib/crypto-storage.ts`:
- `encrypt(plaintext, aad) → Buffer` — AES-256-GCM with random 12-byte nonce, 16-byte tag, version byte `0x01`.
- `encryptForBytea(plaintext, aad) → "\x..." hex string` — **always use this in `.insert()`/`.update()`**. Raw Buffers get JSON-wrapped by Supabase JS and corrupt the bytea column.
- `decryptColumn(enc, aad) → string` — strict. Throws on null. Use everywhere in production read paths.
- `decryptOrFallback(enc, plaintext, aad)` — Phase 1 transition helper. Dead in `src/` today; only backfill scripts use it.

`src/lib/crypto-aad.ts`: one AAD builder per (table, column). Builders use `:` for integer/UUID/enum identity tuples and `\x1f` (ASCII Unit Separator) for free-form string fields (avoids `:` collision in AI-generated text).

---

## Critical write-path patterns

### 2-step insert for id-based AAD

Tables whose AAD identity tuple includes the row's own id (workspaces, conversations, conversation_messages, action_log) need a 2-step insert because Postgres generates the id:

```typescript
// Step 1: insert minimal row, get id
const { data: row } = await sb.from("X").insert({...}).select("id").single();

// Step 2: encrypt using row.id in AAD, UPDATE
await sb.from("X").update({ col_enc: encryptForBytea(plaintext, aad.xCol(row.id)) }).eq("id", row.id);
```

### Postgres timestamp normalization (audit 1)

`Date.prototype.toISOString()` returns `...Z` form. Postgres `timestamptz` reads back as `...+00:00` form. If a timestamp is in the AAD, the write-side and read-side strings diverge → AEAD authentication fails.

**Fix pattern:** insert stub with `created_at` set, read back the DB-canonical string, then encrypt using that exact returned string. Applied in `src/app/api/conversations/[id]/messages/route.ts` POST.

### Postgres bytea serialization

Raw Buffer passed to Supabase JS gets JSON-wrapped (`{"type":"Buffer","data":[...]}`) and stored as garbage. `encryptForBytea` wraps `encrypt(...).toString("hex")` with `\x` prefix — the Postgres bytea wire format. Never pass raw Buffer to `.insert()` / `.update()`.

---

## OAuth observability layer (audits 4-6)

`src/lib/agency-db.ts` exports `ReauthorizeRequiredError extends Error`. Thrown by `getGmailToken`/`getDriveToken`/`getAsanaToken` when:
- `expires_at` is past AND no refresh_token (`reason: "no_refresh_token"`)
- Refresh request returned no `access_token` (`reason: <provider's error code>` like `"invalid_grant"`)

`src/lib/oauth-errors.ts` provides:
- `isReauthError(err): boolean` — instanceof check.
- `reauthErrorToResponse(err): NextResponse | null` — for JSON routes, returns 401 with `{ error: "reauthorize_required", provider }`. Null if not a reauth error.
- `logReauthNeeded(err, contextHint): boolean` — for webhook handlers; emits `[oauth-reauth-needed] provider=X reason=Y context=Z` and returns whether a reauth was logged (so caller can break the loop).

Wired into 14+ routes. **When you add a new route that calls one of the token functions, use these helpers.** See `src/app/api/sync/asana/route.ts` POST for the canonical JSON-route pattern, `src/app/api/webhooks/asana/route.ts` for the webhook pattern.

`/api/ask` emits `data: {"type":"needs_reauth","provider":"google-gmail"}` SSE events. The chat client at `src/app/ask/page.tsx` handles them via `setToast(...)`.

---

## Drift idempotency (post-audit-7 fix)

`src/lib/action-log-idempotency.ts`:
- `getExistingActionTargetId(service, findingId, actionType): string | null` — returns the `target_id` of the most recent `status='success'` action_log row, or null.
- `hasActionSucceeded(service, findingId, actionType): boolean` — for actions where you only need to know "did we run this step yet" (e.g., `asana.add_comment`).

`drift/[id]/create-project/route.ts` and `drift/[id]/accept/route.ts` check before each Asana mutation. On retry after partial failure, gids are reused. No duplicate projects/sections/tasks/comments.

**Status filter is `'success'` only.** `pending` rows are skipped (in-flight). `failed` rows are skipped (Asana side didn't commit; retry). `undone` rows are skipped (user explicitly rolled back). Re-acceptance after undo works correctly.

---

## Boot validation

`src/instrumentation.ts` runs `register()` once per Vercel function cold-start. Calls `encrypt("boot-check", "boot")` — throws if `GERENDO_MASTER_KEY` is missing or malformed. A misconfigured deploy fails fast instead of 500'ing on the first DB request.

---

## action_log lifecycle

```
INSERT → status='pending', payloads not yet written
  ↓
encrypt + UPDATE payloads + status='success' (audit 4)
  ↓
(optional) undo route → status='undone'

Stale path:
status='pending' AND executed_at < now() - 5min → flipped to 'failed'
  by inline sweep in logAction() (audit 5)
```

Idempotency reads from `status='success'`, so:
- Pending rows (in-flight) are ignored — could race two parallel acceptances, but `drift_findings.status` flips to `accepted` first, which short-circuits.
- Failed rows are ignored — retry will re-attempt and create a new row.
- Undone rows are ignored — re-acceptance after undo works.

---

## Smoke tests (run these after any encryption-touching change)

| Script | What it verifies |
|---|---|
| `scripts/verify-final.ts` | All 24+ plaintext columns dropped, all _enc populated, Phase 4 round-trip |
| `scripts/test-app-encryption.ts` | Full app-layer write/read round-trip for 12 column families |
| `scripts/test-action-log-enc.ts` | action_log payload encryption + AAD tamper rejection |
| `scripts/test-idempotency-lookup.ts` | action_log idempotency helpers, including undone-row exclusion |
| `scripts/sanity-decrypt.ts` | Random-row decrypt check across messages/embeddings/oauth_tokens |
| `scripts/check-prod-conv-msg.ts` | Decrypt every conversation_message; catches AAD format regressions |

Run: `set -a && source .env.local && set +a && npx tsx scripts/<name>.ts`

---

## Hooks

`.claude/hooks/encryption-rules.sh` (SessionStart): injects the full encrypted-column inventory + WRITE/READ patterns into every Claude session start. Don't bypass.

`.claude/hooks/check-encryption.sh` (PostToolUse on Edit/Write): scans touched files for:
- Pattern A: bare `encrypt(` calls outside the crypto module → use `encryptForBytea`.
- Pattern B: writes to a dropped plaintext column → warns with the correct `_enc` column name.
- Pattern C: informational note when a file imports the crypto module.

---

## Deferred items (do not fix unless symptoms appear)

1. **`cachedKey` rotation runbook** (audit 7 L1). The module-level cache in `crypto-storage.ts` cannot be invalidated without process restart. If you rotate `GERENDO_MASTER_KEY` in Vercel env, warm Lambdas keep using the old key for ~15 min. Mitigation: redeploy after rotation to force cold-start. No code change needed for Phase 0.
2. **Chat double-submit cosmetic** (audit 7 L2). Two POSTs in the same millisecond could share a `(conversation_id, role, created_at)` triple. Each row has its own id and fresh nonce, no security/correctness impact, only display order. Form is `disabled={loading}` so triple-protected anyway.
3. **Drift create-project edge: deleted Asana resources reused via idempotency** (audit 8 L3). If the user manually deletes a project/section/task in Asana between a partial retry, the idempotency lookup returns the stale gid; the next Asana call returns 404, route returns 502. No data corruption.

---

## Commit ledger

| Commit | Phase / audit |
|---|---|
| (Phase 1+2 series — pre-audit) | Encrypt 8 content/token columns, drop plaintext |
| (Phase 3a / 3b series) | Encrypt 13 PII/metadata columns |
| `fcd3ee7` | Phase 4: workspace name + chat history |
| `c56009a` | Privacy/terms text aligned with shipped reality |
| `09940bb` | Privacy policy consolidation + Voyage AI disclosure |
| `61701aa` | Audit 1: chat-message AAD timestamp-format fix |
| `745a8b2` | Audit 2: 3 routes selecting dropped plaintext columns |
| `0d73fae` | Audit 3: action_log enc + null self-heal + boot check + log leakage + dead exports |
| `86dd909` | Audit 4: OAuth refresh stale-token + action_log status race + undo create_* gap + role whitelist |
| `2d15607` | Audit 5: oauth-errors helpers + SSE needs_reauth + webhooks structured + 14 route mappings + role CHECK |
| `c79aa8b` | Audit 6: chat client handles needs_reauth + drift routes + webhook register |
| `c12047e` | Post-audit-7: forward-only idempotency on drift Asana mutations |

---

## How to debug encryption issues in the next session

**Symptom: a route 500s with "decryptColumn: encrypted column is null" or "Unsupported state or unable to authenticate data."**

1. Identify the column. The error message includes the AAD string; the first segment is `{table}:{column}`.
2. Check if the write side and read side use the **same AAD builder**. Grep `src/lib/crypto-aad.ts` for the column name, then grep `aad.<builderName>` to find write/read sites.
3. If the AAD includes a timestamp, verify the write side uses the DB-canonical string (post-roundtrip), not the JS form. See audit 1 fix.
4. If the AAD includes an id from a 2-step insert, verify the second step ran. Check `scripts/test-app-encryption.ts` for the right pattern.

**Symptom: OAuth API call returns a 401 but the UI doesn't show a reconnect prompt.**

1. Check the route catches `ReauthorizeRequiredError` and calls `reauthErrorToResponse(err)` before any other error mapping.
2. For `/api/ask`, check the SSE consumer in `src/app/ask/page.tsx` handles `type: "needs_reauth"`.
3. For webhooks, grep Vercel logs for `[oauth-reauth-needed]` — if present, the server side is correct.

**Symptom: drift acceptance retry creates duplicate Asana tasks/sections/comments.**

The idempotency layer should prevent this. Check:
1. `action_log` rows with `status='success'` for the `drift_finding_id`. Each successful mutation should have one.
2. If the row is `status='failed'`, the retry will re-run — that's correct.
3. If the row is `status='pending' AND old`, the sweep should have flipped it.

**Symptom: chat message disappeared from history.**

`conversations.title_enc` could be null on a half-written 2-step insert. The list GET filters `.not("title_enc", "is", null)`. The conversation is hidden but messages still exist. Either delete the orphan or use `scripts/test-app-encryption.ts` as a debugging template to manually finish the encryption.
