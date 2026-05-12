#!/usr/bin/env bash
# SessionStart hook: inject Gerendo encryption rules into session context.
cat <<'EOF'
[GERENDO ENCRYPTION RULES — ALWAYS APPLY]

Sensitive content columns are encrypted at rest with AES-256-GCM. Master key in
GERENDO_MASTER_KEY env var (Vercel + .env.local). When you touch these tables
you MUST follow the pattern.

WRITE: encryptForBytea(plaintext, aad.<builder>(...)) → goes into the _enc bytea column.
       NEVER pass raw encrypt() Buffer to Supabase JS — it JSON-wraps the bytes.
       Both plaintext and _enc columns are populated during Phase 1.
READ:  decryptOrFallback(row.column_enc, row.column, aad.<builder>(...))
       NEVER read the plaintext column directly for sensitive data.

Sensitive (table, column) pairs:
  messages.subject               / subject_enc
  embeddings.keyword_text        / keyword_text_enc
  drive_embeddings.keyword_text  / keyword_text_enc
  asana_embeddings.keyword_text  / keyword_text_enc
  summaries.summary              / summary_enc
  facts.detail                   / detail_enc
  oauth_tokens.access_token      / access_token_enc
  oauth_tokens.refresh_token     / refresh_token_enc

AAD builders are in src/lib/crypto-aad.ts. Write side and read side MUST use the
same builder for the same (table, column). For free-form string fields in AAD
(type, subject, anything AI-generated), the builder uses \x1f as separator —
colons can collide. Integer/enum identity fields use ":".

NOT encrypted (Tier 3, by design): messages.sender, thread_id, external_id,
drive_files.name/mime_type, asana_items.name/project_name/assignee, all IDs,
timestamps, foreign keys.

Full design: /Users/mingw/.claude/plans/atomic-crafting-wreath.md
EOF
