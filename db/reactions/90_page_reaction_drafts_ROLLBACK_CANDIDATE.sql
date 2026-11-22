-- TIEN404 V21.4 — rollback for disposable QA or separately approved staging ONLY.
-- DO NOT RUN HOSTED without a backup, data retention review and explicit owner approval.
-- Deliberately does not alter existing Config Core / Messenger / Commerce tables.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout='5s';
DROP FUNCTION IF EXISTS public.save_page_reaction_draft(uuid,jsonb,text);
DROP TABLE IF EXISTS public.page_reaction_drafts;
DROP TABLE IF EXISTS app_private.reaction_page_industries;
SELECT 'T404_V214_REACTION_DRAFT_ROLLBACK_OK' AS marker;
COMMIT;
