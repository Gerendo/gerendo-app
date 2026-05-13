-- Phase 3b: drop the Bucket C plaintext columns now that the deployed code
-- writes only to the _enc columns and reads use decryptColumn.
--
-- Run AFTER the Phase 3b code deploy promotes. Old code that's still
-- in-flight when this runs will fail any write to these columns; the
-- deploy window is small (Vercel atomic promotion) and acceptable.
--
-- See ~/.claude/plans/atomic-crafting-wreath.md for the full rollout.

ALTER TABLE messages           DROP COLUMN IF EXISTS sender;
ALTER TABLE messages           DROP COLUMN IF EXISTS thread_id;
ALTER TABLE drive_files        DROP COLUMN IF EXISTS name;
ALTER TABLE asana_items        DROP COLUMN IF EXISTS name;
ALTER TABLE asana_items        DROP COLUMN IF EXISTS project_name;
ALTER TABLE asana_items        DROP COLUMN IF EXISTS assignee;
ALTER TABLE asana_items        DROP COLUMN IF EXISTS notes;
ALTER TABLE asana_items        DROP COLUMN IF EXISTS due_date;
ALTER TABLE asana_items        DROP COLUMN IF EXISTS permalink_url;
ALTER TABLE workspace_contexts DROP COLUMN IF EXISTS context_text;
ALTER TABLE drift_findings     DROP COLUMN IF EXISTS decision_summary;
ALTER TABLE drift_findings     DROP COLUMN IF EXISTS draft_update;
ALTER TABLE drift_findings     DROP COLUMN IF EXISTS resolution_note;
