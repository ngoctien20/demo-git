-- TIEN404 V28 Account rollback. Unlocks every account locked through admin_set_account_lock, then drops V28 objects.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
UPDATE auth.users u SET banned_until=NULL FROM app_private.account_locks l WHERE l.user_id=u.id;
DROP FUNCTION IF EXISTS public.admin_set_store_bot(uuid,boolean), public.admin_set_account_lock(uuid,boolean,text),
  public.admin_overview(), app_private.t404_require_admin(), public.is_platform_admin(),
  public.billing_demo_cancel(uuid), public.billing_demo_void(uuid,uuid), public.billing_demo_confirm(uuid,uuid),
  public.billing_demo_checkout(uuid,text,text), public.billing_demo_state(uuid), app_private.billing_demo_json(uuid),
  app_private.billing_demo_price(text,text), app_private.t404_store_owner_tenant(uuid), app_private.t404_store_member(uuid);
DROP TABLE IF EXISTS app_private.account_locks, app_private.platform_admins, public.billing_demo_invoices, public.billing_demo_subscriptions;
DO $d$ BEGIN RAISE NOTICE 'T404_V28_ROLLBACK_OK'; END $d$;
COMMIT;
