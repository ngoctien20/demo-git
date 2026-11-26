-- TIEN404 V28.2 rollback: drops plan/settings tables and admin RPCs, restores the fixed sample prices.
-- Keeps every invoice and subscription (they belong to db/v28-account/10).
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
DROP FUNCTION IF EXISTS public.admin_set_store_plan(uuid,text,text,timestamptz), public.admin_set_invoice(uuid,text),
  public.admin_invoices(text), public.admin_save_settings(jsonb), public.admin_save_plan(text,jsonb),
  public.admin_platform_config(), public.platform_catalog(), app_private.platform_plans_json(boolean);
CREATE OR REPLACE FUNCTION app_private.billing_demo_price(p_plan text, p_cycle text) RETURNS integer
 LANGUAGE sql IMMUTABLE SET search_path='' AS $f$
 SELECT (CASE p_plan WHEN 'lite' THEN 99000 WHEN 'plus' THEN 299000 WHEN 'pro' THEN 699000 END)
        * (CASE p_cycle WHEN 'month' THEN 1 WHEN 'year' THEN 10 END) $f$;
ALTER FUNCTION app_private.billing_demo_price(text,text) SECURITY INVOKER;
REVOKE ALL ON FUNCTION app_private.billing_demo_price(text,text) FROM PUBLIC, anon, authenticated;
DROP TABLE IF EXISTS app_private.platform_settings, app_private.platform_plans;
DO $d$ BEGIN RAISE NOTICE 'T404_V28_2_ROLLBACK_OK'; END $d$;
COMMIT;
