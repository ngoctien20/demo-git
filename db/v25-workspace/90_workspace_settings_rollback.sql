-- Rollback of 10_workspace_settings.sql. tenants.industry values written by set_workspace_industry are kept
-- (same column register_shop writes; previous values are in app_private.audit_events 'workspace_industry_set').
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
DROP FUNCTION public.save_briefing_settings(uuid,boolean,time,text,text[]);
DROP TABLE public.store_briefing_settings;
DROP FUNCTION public.set_workspace_industry(uuid,text);
DO $post$ BEGIN RAISE NOTICE 'T404_V25_WORKSPACE_SETTINGS_ROLLBACK_OK'; END $post$;
COMMIT;
