-- Defense-in-depth: enforce the role whitelist at the DB level so any future
-- insert path (not just the POST /conversations/[id]/messages route) cannot
-- write arbitrary strings. The application route already validates, but
-- without a DB constraint a server action, background job, or admin script
-- could bypass that and corrupt the AAD identity tuple downstream.
-- Verified on 2026-05-14: only "user" and "assistant" roles in production.

ALTER TABLE conversation_messages
  ADD CONSTRAINT conversation_messages_role_check
  CHECK (role IN ('user','assistant','system'));
