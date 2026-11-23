-- Rollback of 20_briefing_sender.sql. Stops all sending (n8n calls then fail with "function not found").
-- The Vault secret is kept (harmless without the RPCs); delete it in the Vault UI if wanted.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
DROP FUNCTION public.briefing_recent_deliveries(uuid);
DROP FUNCTION public.briefing_report_v1(uuid,boolean,text);
DROP FUNCTION public.briefing_claim_due_v1();
UPDATE public.store_briefing_settings SET status='awaiting_sender';
ALTER TABLE public.store_briefing_settings ALTER COLUMN status SET DEFAULT 'awaiting_sender';
ALTER TABLE public.store_briefing_settings DROP CONSTRAINT store_briefing_settings_status_check;
ALTER TABLE public.store_briefing_settings ADD CONSTRAINT store_briefing_settings_status_check CHECK (status IN ('awaiting_sender'));
DROP TABLE app_private.briefing_deliveries;
DROP FUNCTION app_private.t404_briefing_caller_ok();
DO $post$ BEGIN RAISE NOTICE 'T404_V25_BRIEFING_SENDER_ROLLBACK_OK'; END $post$;
COMMIT;
