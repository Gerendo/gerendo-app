#!/usr/bin/env bash
# SessionStart hook: inject Gerendo encryption rules into session context.
cat <<'EOF'
[GERENDO ENCRYPTION RULES — ALWAYS APPLY]

Sensitive content columns are encrypted at rest with AES-256-GCM. Master key in
GERENDO_MASTER_KEY env var (Vercel + .env.local). When you touch these tables
you MUST follow the pattern.

WRITE: encryptForBytea(plaintext, aad.<builder>(...)) → goes into the _enc bytea column.
       NEVER pass raw encrypt() Buffer to Supabase JS — it JSON-wraps the bytes.
       Plaintext columns were dropped in Phase 2. Write only the _enc column.
READ:  decryptColumn(row.column_enc, aad.<builder>(...))
       Throws on null. decryptOrFallback is the Phase 1 helper, kept for
       backward compat but use decryptColumn in new code.

Sensitive _enc columns (the only columns now — plaintext counterparts dropped):
  messages.subject_enc
  embeddings.keyword_text_enc
  drive_embeddings.keyword_text_enc
  asana_embeddings.keyword_text_enc
  summaries.summary_enc
  facts.detail_enc
  oauth_tokens.access_token_enc
  oauth_tokens.refresh_token_enc

AAD builders are in src/lib/crypto-aad.ts. Write side and read side MUST use the
same builder for the same (table, column). For free-form string fields in AAD
(type, subject, anything AI-generated), the builder uses \x1f as separator —
colons can collide. Integer/enum identity fields use ":".

NOT encrypted (Tier 3, by design): messages.sender, thread_id, external_id,
drive_files.name/mime_type, asana_items.name/project_name/assignee, all IDs,
timestamps, foreign keys.

Full design: /Users/mingw/.claude/plans/atomic-crafting-wreath.md
EOF
