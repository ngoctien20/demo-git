-- Rollback of 30_store_admin_rpcs.sql: drops the three RPCs and the allow-list helper only.
-- Stores / memberships created through them are data and are kept (90 still refuses while a
-- tenant has more than one Store; remove extra Stores deliberately before running 90).
\set ON_ERROR_STOP on
BEGIN;
DROP FUNCTION IF EXISTS public.create_store(uuid,text,text);
DROP FUNCTION IF EXISTS public.set_store_member(uuid,uuid,text,boolean);
DROP FUNCTION IF EXISTS public.save_merchant_product_in_store(uuid,text,text,bigint,boolean,integer,timestamptz);
DROP FUNCTION IF EXISTS app_private.t404_qa_tenant_allowed(uuid);
DO $post$ BEGIN
 IF to_regprocedure('public.create_store(uuid,text,text)') IS NOT NULL THEN RAISE EXCEPTION 'T404_ADMIN_ROLLBACK_FAILED'; END IF;
 RAISE NOTICE 'T404_V20_STORE_ADMIN_RPCS_ROLLBACK_OK';
END $post$;
COMMIT;
