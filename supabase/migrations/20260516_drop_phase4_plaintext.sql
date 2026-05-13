-- Phase 4 plaintext drop. Run AFTER the Phase 4 code deploy promotes.

ALTER TABLE workspaces            DROP COLUMN IF EXISTS name;
ALTER TABLE conversations         DROP COLUMN IF EXISTS title;
ALTER TABLE conversation_messages DROP COLUMN IF EXISTS content;
