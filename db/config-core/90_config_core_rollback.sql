-- TIEN404 Universal Configuration Core v1 — ROLLBACK of 10_config_core.sql. STATUS: PROPOSED.
-- Drops everything 10 created. Assistant configs are lost: export them first
-- (SELECT * FROM public.assistant_config_versions) if the rollback is not on a disposable copy.
-- app_private.audit_events rows written by the RPCs are kept (audit trail).
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $pre$ BEGIN
 IF to_regclass('public.assistants') IS NULL THEN RAISE EXCEPTION 'T404_CC_NOT_APPLIED'; END IF;
END $pre$;
DROP FUNCTION IF EXISTS public.get_channel_menu(text,text); -- step 20, if applied
DROP FUNCTION public.resolve_channel_assistant(text,text);
DROP FUNCTION public.rollback_assistant_config(uuid,int);
DROP FUNCTION public.publish_assistant_config(uuid,text);
DROP FUNCTION public.save_assistant_draft(uuid,jsonb,text);
DROP FUNCTION public.create_assistant(uuid,text,text);
DROP FUNCTION app_private.t404_cfg_lock_assistant(uuid);
DROP FUNCTION app_private.t404_cfg_manager_tenant(uuid);
DROP TABLE public.channel_connections;
DROP TABLE public.assistant_config_versions;
DROP FUNCTION app_private.t404_acv_guard();
DROP TABLE public.assistants;
DROP TABLE public.industry_templates;
DROP FUNCTION app_private.t404_cfg_validate(jsonb,text);
DROP FUNCTION app_private.t404_cfg_phone_ok(jsonb);
DROP FUNCTION app_private.t404_cfg_url_error(jsonb,text[]);
DROP FUNCTION app_private.t404_cfg_int(jsonb,numeric,numeric);
DROP FUNCTION app_private.t404_cfg_str(jsonb,int,int);
DROP FUNCTION app_private.t404_cfg_sha(jsonb);
DROP TABLE public.action_types;
SELECT 'T404_CC_ROLLBACK_OK' AS marker;
COMMIT;
