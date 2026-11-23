-- Rollback of 10_workspace_settings.sql. Drops workspace profiles and briefing preferences (saved values are
-- lost; their history stays in app_private.audit_events). tenants/stores are untouched.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
DROP FUNCTION public.save_briefing_settings(uuid,boolean,time,text,text[]);
DROP TABLE public.store_briefing_settings;
DROP FUNCTION public.save_workspace_profile(uuid,text,text[],text);
DROP TABLE public.workspace_profiles;
DO $post$ BEGIN RAISE NOTICE 'T404_V25_WORKSPACE_SETTINGS_ROLLBACK_OK'; END $post$;
COMMIT;
