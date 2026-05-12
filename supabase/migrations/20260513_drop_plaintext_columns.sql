-- Phase 2 of at-rest encryption rollout. Drops the plaintext columns now that
-- every read/write path in code goes through the _enc columns only.
--
-- Run this AFTER the corresponding Phase 2 code deploy has gone live. Running
-- it before deploy would error production rows that still try to write the
-- plaintext columns. Verify the deploy is fully promoted before applying.
--
-- See ~/.claude/plans/atomic-crafting-wreath.md for the full rollout plan.

ALTER TABLE messages         DROP COLUMN IF EXISTS subject;
ALTER TABLE embeddings       DROP COLUMN IF EXISTS keyword_text;
ALTER TABLE drive_embeddings DROP COLUMN IF EXISTS keyword_text;
ALTER TABLE asana_embeddings DROP COLUMN IF EXISTS keyword_text;
ALTER TABLE summaries        DROP COLUMN IF EXISTS summary;
ALTER TABLE facts            DROP COLUMN IF EXISTS detail;
ALTER TABLE oauth_tokens     DROP COLUMN IF EXISTS access_token;
ALTER TABLE oauth_tokens     DROP COLUMN IF EXISTS refresh_token;

-- Phase 2 also drops the now-unused FTS RPCs. Postgres tsvector cannot operate
-- on bytea, and our hybrid search (src/lib/search.ts) was reduced to
-- vector-only in Phase 1. Remove the dead RPCs.
DROP FUNCTION IF EXISTS fts_search_embeddings(uuid, text, integer);
DROP FUNCTION IF EXISTS fts_search_drive(uuid, text, integer);
DROP FUNCTION IF EXISTS fts_search_asana(uuid, text, integer);
