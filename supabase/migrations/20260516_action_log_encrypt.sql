-- Encrypt action_log payloads. The jsonb columns held plaintext copies of
-- Asana task names, notes, and the decrypted draftUpdate comment text —
-- exactly the PII Phase 3b encrypts on asana_items.notes_enc and
-- drift_findings.draft_update_enc. The audit log defeated those columns at
-- rest. Replace with AES-256-GCM ciphertext bytea, AAD scoped to action_log.id.
-- Safe to drop in one step: action_log is operational/append-only and was
-- empty (0 rows) at the time of this migration; no backfill needed.

ALTER TABLE action_log ADD COLUMN IF NOT EXISTS payload_before_enc bytea;
ALTER TABLE action_log ADD COLUMN IF NOT EXISTS payload_after_enc  bytea;
ALTER TABLE action_log DROP COLUMN IF EXISTS payload_before;
ALTER TABLE action_log DROP COLUMN IF EXISTS payload_after;
