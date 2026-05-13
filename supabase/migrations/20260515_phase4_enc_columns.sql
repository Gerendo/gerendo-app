-- Phase 4: add _enc columns for workspace name + chat history.
-- Additive only. Phase 4b (separate migration) drops the plaintext columns
-- after the deploy + backfill cycle completes.

ALTER TABLE workspaces            ADD COLUMN IF NOT EXISTS name_enc    bytea;
ALTER TABLE conversations         ADD COLUMN IF NOT EXISTS title_enc   bytea;
ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS content_enc bytea;
