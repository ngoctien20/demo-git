-- TIEN404 V20 Store Authority — ROLLBACK of 10_store_authority_expand.sql. STATUS: PROPOSED.
-- Restores the exact pre-migration policies/constraints. Refuses to run if rolling back
-- would merge data from more than one Store per tenant (store assignment would be lost).
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $pre$ BEGIN
 IF to_regclass('public.stores') IS NULL THEN RAISE EXCEPTION 'T404_ROLLBACK_NOTHING_TO_ROLL_BACK'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.products'::regclass AND conname='products_tenant_id_sku_key') THEN
  RAISE EXCEPTION 'T404_ROLLBACK_REFUSED_RUN_60_FIRST'; -- step-4 contract applied: roll it back first
 END IF;
 IF EXISTS (SELECT 1 FROM public.stores GROUP BY tenant_id HAVING count(*)>1) THEN
  RAISE EXCEPTION 'T404_ROLLBACK_REFUSED_MULTI_STORE_DATA_EXISTS';
 END IF;
END $pre$;
DO $d$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['products','customers','orders','order_items','conversations','messages'] LOOP
  EXECUTE format('DROP TRIGGER t404_store_scope_guard ON public.%I', t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['customers','orders','order_items','conversations','messages'] LOOP
  EXECUTE format('DROP POLICY %I ON public.%I', t||'_store_manager_read', t);
 END LOOP;
END $d$;
DROP POLICY products_store_member_read ON public.products;
ALTER TABLE public.products DROP CONSTRAINT products_tenant_store_sku_key;
ALTER TABLE public.messages DROP CONSTRAINT messages_conversation_same_store_fk;
ALTER TABLE public.order_items DROP CONSTRAINT order_items_product_same_store_fk;
ALTER TABLE public.order_items DROP CONSTRAINT order_items_order_same_store_fk;
ALTER TABLE public.orders DROP CONSTRAINT orders_customer_same_store_fk;
DO $c$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['products','customers','orders','conversations'] LOOP
  EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', t, t||'_tenant_store_id_key');
 END LOOP;
 FOREACH t IN ARRAY ARRAY['products','customers','orders','order_items','conversations','messages'] LOOP
  EXECUTE format('ALTER TABLE public.%I DROP COLUMN store_id', t);  -- drops its FK + index
 END LOOP;
END $c$;
DROP TRIGGER t404_tenant_default_store ON public.tenants;
DROP FUNCTION app_private.t404_store_scope_guard();
DROP FUNCTION app_private.t404_tenant_default_store();
DROP POLICY stores_member_read ON public.stores;
DROP POLICY store_memberships_self_read ON public.store_memberships;
DROP TABLE public.store_memberships;
DROP TABLE public.stores;
-- Original tenant-level policies, verbatim from the hosted catalog (2026-11-21).
CREATE POLICY products_member_read ON public.products FOR SELECT TO authenticated
 USING (EXISTS (SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id=products.tenant_id
   AND m.user_id=(SELECT auth.uid()) AND m.active));
DO $p$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['customers','orders','order_items','conversations','messages'] LOOP
  EXECUTE format($q$CREATE POLICY %I ON public.%I FOR SELECT TO authenticated
   USING (EXISTS (SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id=%I.tenant_id
     AND m.user_id=(SELECT auth.uid()) AND m.active AND m.role = ANY (ARRAY['owner','manager'])))$q$,
   t||'_manager_read', t, t);
 END LOOP;
END $p$;
DO $post$ BEGIN
 IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND column_name='store_id')
 THEN RAISE EXCEPTION 'T404_ROLLBACK_STORE_ID_REMAINS'; END IF;
 RAISE NOTICE 'T404_V20_STORE_AUTHORITY_ROLLBACK_OK';
END $post$;
COMMIT;
