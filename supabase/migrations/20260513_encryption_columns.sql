-- Phase 1 - additive only. Phase 2 (separate migration, 1 week later) drops the
-- plaintext columns after backfill is verified stable. Reads use plaintext
-- until Day 3 switches them.
--
-- See docs/USER_PROBLEMS_SOLUTIONS.md and
-- /Users/mingw/.claude/plans/atomic-crafting-wreath.md for the full rollout
-- plan (Option A app-layer envelope encryption with AES-256-GCM).
--
-- All new columns are nullable bytea. Write paths populate both plaintext and
-- _enc columns during Phase 1. A backfill script will then NULL the plaintext
-- columns; Phase 2 drops them outright.

ALTER TABLE embeddings        ADD COLUMN IF NOT EXISTS keyword_text_enc bytea;
ALTER TABLE drive_embeddings  ADD COLUMN IF NOT EXISTS keyword_text_enc bytea;
ALTER TABLE asana_embeddings  ADD COLUMN IF NOT EXISTS keyword_text_enc bytea;
ALTER TABLE summaries         ADD COLUMN IF NOT EXISTS summary_enc      bytea;
ALTER TABLE facts             ADD COLUMN IF NOT EXISTS detail_enc       bytea;
ALTER TABLE messages          ADD COLUMN IF NOT EXISTS subject_enc      bytea;
ALTER TABLE oauth_tokens      ADD COLUMN IF NOT EXISTS access_token_enc bytea;
ALTER TABLE oauth_tokens      ADD COLUMN IF NOT EXISTS refresh_token_enc bytea;
