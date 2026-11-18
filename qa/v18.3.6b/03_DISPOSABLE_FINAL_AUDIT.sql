\set ON_ERROR_STOP on
DO $audit$
DECLARE
 t text;
 n int;
BEGIN
 IF current_database()<>'tien404_v1836_disposable' THEN RAISE EXCEPTION 'FINAL_AUDIT_WRONG_DATABASE'; END IF;
 IF current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999 THEN RAISE EXCEPTION 'FINAL_AUDIT_NOT_PG17'; END IF;
 IF (SELECT count(*) FROM public.stores)<>3 OR (SELECT count(*) FROM public.store_memberships)<>3 THEN RAISE EXCEPTION 'STORE_REGISTRY_FIXTURE_COUNT_MISMATCH'; END IF;
 IF (SELECT count(*) FROM public.store_memberships WHERE active AND role='owner' AND approved_at IS NOT NULL)<>3 THEN RAISE EXCEPTION 'OWNER_MAPPING_FIXTURE_INVALID'; END IF;
 IF (SELECT count(DISTINCT tenant_id) FROM public.store_memberships WHERE user_id IN ('00000000-0000-0000-0000-000000001001','00000000-0000-0000-0000-000000001002'))<>1
    OR (SELECT count(DISTINCT store_id) FROM public.store_memberships WHERE user_id IN ('00000000-0000-0000-0000-000000001001','00000000-0000-0000-0000-000000001002'))<>2
    OR (SELECT count(DISTINCT user_id) FROM public.store_memberships WHERE user_id IN ('00000000-0000-0000-0000-000000001001','00000000-0000-0000-0000-000000001002'))<>2
 THEN RAISE EXCEPTION 'SAME_TENANT_OWNER_A_B_FIXTURE_INVALID'; END IF;
 IF (SELECT count(*) FROM public.products)<>4 OR (SELECT count(*) FROM public.products WHERE store_id IS NOT NULL)<>3 OR (SELECT count(*) FROM public.products WHERE store_id IS NULL)<>1 THEN RAISE EXCEPTION 'PRODUCT_LEGACY_MAPPING_COUNTS_INVALID'; END IF;
 IF (SELECT count(*) FROM public.customers)<>2 OR (SELECT count(*) FROM public.customers WHERE store_id IS NULL)<>0 THEN RAISE EXCEPTION 'CUSTOMER_MAPPING_COUNTS_INVALID'; END IF;
 IF (SELECT count(*) FROM public.orders)<>3 OR (SELECT count(*) FROM public.orders WHERE store_id IS NOT NULL)<>2 OR (SELECT count(*) FROM public.orders WHERE store_id IS NULL)<>1 THEN RAISE EXCEPTION 'ORDER_LEGACY_MAPPING_COUNTS_INVALID'; END IF;
 IF (SELECT count(*) FROM public.order_items)<>2 OR (SELECT count(*) FROM public.order_items WHERE store_id IS NULL)<>0 THEN RAISE EXCEPTION 'ORDER_ITEM_MAPPING_COUNTS_INVALID'; END IF;
 IF (SELECT count(*) FROM public.conversations)<>2 OR (SELECT count(*) FROM public.conversations WHERE store_id IS NULL)<>0 THEN RAISE EXCEPTION 'CONVERSATION_MAPPING_COUNTS_INVALID'; END IF;
 IF (SELECT count(*) FROM public.messages)<>2 OR (SELECT count(*) FROM public.messages WHERE store_id IS NULL)<>0 THEN RAISE EXCEPTION 'MESSAGE_MAPPING_COUNTS_INVALID'; END IF;
 SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
 WHERE ns.nspname='public' AND c.relname IN ('tenants','tenant_memberships','stores','store_memberships','products','customers','orders','order_items','conversations','messages') AND c.relrowsecurity;
 IF n<>10 THEN RAISE EXCEPTION 'RLS_NOT_ENABLED_ON_ALL_10_TABLES: %',n; END IF;
 SELECT count(*) INTO n FROM pg_policies WHERE schemaname='public' AND tablename IN ('products','customers','orders','order_items','conversations','messages') AND permissive='RESTRICTIVE' AND cmd='SELECT';
 IF n<>6 THEN RAISE EXCEPTION 'RESTRICTIVE_STORE_POLICY_COUNT_INVALID: %',n; END IF;
 SELECT count(*) INTO n FROM pg_constraint WHERE conname IN ('products_store_fk','customers_store_fk','orders_store_fk','order_items_store_fk','conversations_store_fk','messages_store_fk','orders_customer_store_fk','items_order_store_fk','items_product_store_fk','messages_conversation_store_fk') AND convalidated;
 IF n<>10 THEN RAISE EXCEPTION 'VALIDATED_COMPOSITE_FK_COUNT_INVALID: %',n; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='tien404_v1836_authenticated' AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcanlogin) THEN RAISE EXCEPTION 'QA_ROLE_PRIVILEGE_FLAGS_INVALID'; END IF;
 FOREACH t IN ARRAY ARRAY['tenants','tenant_memberships','stores','store_memberships','products','customers','orders','order_items','conversations','messages'] LOOP
  IF has_table_privilege('tien404_v1836_authenticated',format('public.%I',t),'INSERT')
     OR has_table_privilege('tien404_v1836_authenticated',format('public.%I',t),'UPDATE')
     OR has_table_privilege('tien404_v1836_authenticated',format('public.%I',t),'DELETE')
     OR has_table_privilege('tien404_v1836_authenticated',format('public.%I',t),'TRUNCATE')
  THEN RAISE EXCEPTION 'QA_ROLE_HAS_WRITE_PRIVILEGE_ON_%',t; END IF;
 END LOOP;
END
$audit$;

-- The legacy order is deliberately unmapped and must be invisible to both same-tenant owners.
SET ROLE tien404_v1836_authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000001001';
DO $legacy_a$
BEGIN
 IF (SELECT count(*) FROM public.orders WHERE id='00000000-0000-0000-0000-000000004003')<>0 THEN RAISE EXCEPTION 'STORE_A_CAN_READ_LEGACY_ORDER'; END IF;
END
$legacy_a$;
RESET ROLE;
SET ROLE tien404_v1836_authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000001002';
DO $legacy_b$
BEGIN
 IF (SELECT count(*) FROM public.orders WHERE id='00000000-0000-0000-0000-000000004003')<>0 THEN RAISE EXCEPTION 'STORE_B_CAN_READ_LEGACY_ORDER'; END IF;
END
$legacy_b$;
RESET ROLE;

SELECT current_setting('server_version') AS pg_version,
 'V18_3_6B_FULL_MIGRATION_REPLAY_AND_LEGACY_MAPPING_PASS' AS proof,
 (SELECT count(*) FROM public.products WHERE store_id IS NULL) AS unmapped_products,
 (SELECT count(*) FROM public.orders WHERE store_id IS NULL) AS unmapped_orders;
