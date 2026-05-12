-- Phase 3a - additive only. Phase 3b (separate migration) will drop the
-- plaintext columns after backfill is verified stable on live.
--
-- See /Users/mingw/.claude/plans/atomic-crafting-wreath.md for the at-rest
-- encryption rollout plan. Phase 1+2 encrypted the original 8 columns
-- (messages.subject, embeddings.keyword_text x3, summaries.summary,
-- facts.detail, oauth_tokens.access_token / refresh_token). Bucket C covers
-- the remaining content/PII columns the original plan left plaintext:
-- messages.sender + thread_id, drive_files.name, every asana_items field
-- (name, project_name, assignee, notes, due_date, permalink_url),
-- workspace_contexts.context_text, and drift_findings (decision_summary,
-- draft_update, resolution_note).
--
-- All new columns are nullable bytea. During Phase 3a, write paths dual-write
-- plaintext + _enc on every insert/update; read paths use decryptOrFallback
-- so rows not yet backfilled keep working. Backfill (scripts/backfill-bucket-c.ts)
-- populates _enc for existing rows. Phase 3b drops the plaintext columns.

ALTER TABLE messages           ADD COLUMN IF NOT EXISTS sender_enc            bytea;
ALTER TABLE messages           ADD COLUMN IF NOT EXISTS thread_id_enc         bytea;
ALTER TABLE drive_files        ADD COLUMN IF NOT EXISTS name_enc              bytea;
ALTER TABLE asana_items        ADD COLUMN IF NOT EXISTS name_enc              bytea;
ALTER TABLE asana_items        ADD COLUMN IF NOT EXISTS project_name_enc      bytea;
ALTER TABLE asana_items        ADD COLUMN IF NOT EXISTS assignee_enc          bytea;
ALTER TABLE asana_items        ADD COLUMN IF NOT EXISTS notes_enc             bytea;
ALTER TABLE asana_items        ADD COLUMN IF NOT EXISTS due_date_enc          bytea;
ALTER TABLE asana_items        ADD COLUMN IF NOT EXISTS permalink_url_enc     bytea;
ALTER TABLE workspace_contexts ADD COLUMN IF NOT EXISTS context_text_enc      bytea;
ALTER TABLE drift_findings     ADD COLUMN IF NOT EXISTS decision_summary_enc  bytea;
ALTER TABLE drift_findings     ADD COLUMN IF NOT EXISTS draft_update_enc      bytea;
ALTER TABLE drift_findings     ADD COLUMN IF NOT EXISTS resolution_note_enc   bytea;
