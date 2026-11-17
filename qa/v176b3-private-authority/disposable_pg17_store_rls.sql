-- TIEN404 V17.6-B.3 DISPOSABLE PG17 RLS TEST: SYNTHETIC USER->TENANT->STORE
-- NEVER RUN ON HOSTED SUPABASE OR ANY EXISTING DATABASE.
-- This file is executed ONLY on an isolated ephemeral GitHub Actions PG17
-- DB named t404_b3_disposable, by ci-disposable-pg17.sh.
-- Claims via set_config() are intentionally SPOOFABLE and are NOT real JWTs.
-- Source: https://supabase.com/docs/guides/database/postgres/row-level-security
\set ON_ERROR_STOP on
BEGIN;

CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE SCHEMA t404_b3;
GRANT USAGE ON SCHEMA auth,t404_b3 TO authenticated;

CREATE FUNCTION auth.uid()
RETURNS uuid LANGUAGE sql STABLE SECURITY INVOKER
AS $UID$
  SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid
$UID$;
REVOKE ALL ON FUNCTION auth.uid() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;

CREATE TABLE t404_b3.store_memberships (
 tenant_id uuid NOT NULL,
 store_id uuid NOT NULL,
 user_id uuid NOT NULL,
 role text NOT NULL CHECK(role IN ('owner','manager','staff')),
 active boolean NOT NULL,
 PRIMARY KEY (tenant_id,store_id,user_id)
);
CREATE TABLE t404_b3.catalog_products (
 tenant_id uuid NOT NULL,store_id uuid NOT NULL,
 sku text NOT NULL,price_vnd bigint NOT NULL CHECK(price_vnd>=0),
 PRIMARY KEY (tenant_id,store_id,sku)
);
CREATE TABLE t404_b3.orders (
 tenant_id uuid NOT NULL,store_id uuid NOT NULL,
 order_ref text NOT NULL,status text NOT NULL,
 PRIMARY KEY(tenant_id,store_id,order_ref)
);

-- Fake tenants: A and B share a tenant; C belongs to a different tenant.
-- All identifiers are public QA fixtures and never map to real users.
INSERT INTO t404_b3.store_memberships VALUES
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','owner',true),
 ('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2','owner',true),
 ('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc2','staff',false),
 ('22222222-2222-4222-8222-222222222222','dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
  'dddddddd-dddd-4ddd-8ddd-ddddddddddd2','owner',true);
INSERT INTO t404_b3.catalog_products VALUES
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','SKU_A',159000),
 ('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1','SKU_B',199000),
 ('22222222-2222-4222-8222-222222222222','dddddddd-dddd-4ddd-8ddd-ddddddddddd1','SKU_T2',299000);
INSERT INTO t404_b3.orders VALUES
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','ORDER_A','PENDING_QA'),
 ('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1','ORDER_B','PENDING_QA'),
 ('22222222-2222-4222-8222-222222222222','dddddddd-dddd-4ddd-8ddd-ddddddddddd1','ORDER_T2','PENDING_QA');

ALTER TABLE t404_b3.store_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE t404_b3.store_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE t404_b3.catalog_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE t404_b3.catalog_products FORCE ROW LEVEL SECURITY;
ALTER TABLE t404_b3.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE t404_b3.orders FORCE ROW LEVEL SECURITY;

CREATE POLICY membership_user_only ON t404_b3.store_memberships
 FOR SELECT TO authenticated
 USING (active AND user_id=(SELECT auth.uid()));
CREATE POLICY catalog_store_scope ON t404_b3.catalog_products
 FOR SELECT TO authenticated
 USING (EXISTS(
   SELECT 1 FROM t404_b3.store_memberships AS m
   WHERE m.tenant_id=catalog_products.tenant_id
     AND m.store_id=catalog_products.store_id
     AND m.user_id=(SELECT auth.uid()) AND m.active
     AND m.role IN ('owner','manager','staff')
 ));
CREATE POLICY orders_store_scope ON t404_b3.orders
 FOR SELECT TO authenticated
 USING (EXISTS(
   SELECT 1 FROM t404_b3.store_memberships AS m
   WHERE m.tenant_id=orders.tenant_id
     AND m.store_id=orders.store_id
     AND m.user_id=(SELECT auth.uid()) AND m.active
     AND m.role IN ('owner','manager')
 ));

REVOKE ALL ON ALL TABLES IN SCHEMA t404_b3 FROM PUBLIC;
GRANT SELECT ON t404_b3.store_memberships,t404_b3.catalog_products,t404_b3.orders TO authenticated;

SET LOCAL ROLE authenticated;

DO $CHECK_B3$
DECLARE
 n integer;
 bypass boolean;
BEGIN
 SELECT rolbypassrls INTO bypass FROM pg_roles WHERE rolname=current_user;
 IF current_user<>'authenticated' OR bypass IS DISTINCT FROM false
   THEN RAISE EXCEPTION 'B3_TEST_ROLE_OR_BYPASS_INVALID'; END IF;

 -- All rows must be absent with no actor claim.
 PERFORM set_config('request.jwt.claim.sub','',true);
 SELECT count(*) INTO n FROM t404_b3.catalog_products;
 IF n<>0 THEN RAISE EXCEPTION 'B3_UNAUTH_CATALOG_LEAK_%',n; END IF;
 SELECT count(*) INTO n FROM t404_b3.orders;
 IF n<>0 THEN RAISE EXCEPTION 'B3_UNAUTH_ORDER_LEAK_%',n; END IF;

 -- A has exactly own Store A: positive A->A, denied A->B and A->T2.
 PERFORM set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',true);
 SELECT count(*) INTO n FROM t404_b3.catalog_products;
 IF n<>1 THEN RAISE EXCEPTION 'B3_A_CATALOG_COUNT_%',n; END IF;
 SELECT count(*) INTO n FROM t404_b3.catalog_products WHERE sku='SKU_B';
 IF n<>0 THEN RAISE EXCEPTION 'B3_A_READ_B_CATALOG_LEAK'; END IF;
 SELECT count(*) INTO n FROM t404_b3.catalog_products WHERE sku='SKU_T2';
 IF n<>0 THEN RAISE EXCEPTION 'B3_A_CROSS_TENANT_LEAK'; END IF;
 SELECT count(*) INTO n FROM t404_b3.orders;
 IF n<>1 THEN RAISE EXCEPTION 'B3_A_ORDER_COUNT_%',n; END IF;
 SELECT count(*) INTO n FROM t404_b3.orders WHERE order_ref='ORDER_B';
 IF n<>0 THEN RAISE EXCEPTION 'B3_A_READ_B_ORDER_LEAK'; END IF;

 -- Forged user-editable metadata MUST NOT alter Store-authority decisions.
 PERFORM set_config('request.jwt.claim.user_metadata',
   '{"role":"owner","tenant_id":"22222222-2222-4222-8222-222222222222","store_id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1"}',true);
 SELECT count(*) INTO n FROM t404_b3.catalog_products;
 IF n<>1 THEN RAISE EXCEPTION 'B3_USER_METADATA_BYPASS_%',n; END IF;
 SELECT count(*) INTO n FROM t404_b3.catalog_products WHERE sku='SKU_B';
 IF n<>0 THEN RAISE EXCEPTION 'B3_USER_METADATA_GRANTED_B'; END IF;

 -- B has B, never A. Its own order is readable, A's is not.
 PERFORM set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',true);
 SELECT count(*) INTO n FROM t404_b3.catalog_products;
 IF n<>1 THEN RAISE EXCEPTION 'B3_B_CATALOG_COUNT_%',n; END IF;
 SELECT count(*) INTO n FROM t404_b3.catalog_products WHERE sku='SKU_A';
 IF n<>0 THEN RAISE EXCEPTION 'B3_B_READ_A_CATALOG_LEAK'; END IF;
 SELECT count(*) INTO n FROM t404_b3.orders;
 IF n<>1 THEN RAISE EXCEPTION 'B3_B_ORDER_COUNT_%',n; END IF;
 SELECT count(*) INTO n FROM t404_b3.orders WHERE order_ref='ORDER_A';
 IF n<>0 THEN RAISE EXCEPTION 'B3_B_READ_A_ORDER_LEAK'; END IF;

 -- Revoked/inactive staff membership never gains own Store access.
 PERFORM set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-ccccccccccc2',true);
 SELECT count(*) INTO n FROM t404_b3.catalog_products;
 IF n<>0 THEN RAISE EXCEPTION 'B3_INACTIVE_STAFF_READ_%',n; END IF;
 SELECT count(*) INTO n FROM t404_b3.orders;
 IF n<>0 THEN RAISE EXCEPTION 'B3_INACTIVE_STAFF_ORDER_%',n; END IF;

 -- Other-Tenant owner sees only own Store, not either A/B.
 PERFORM set_config('request.jwt.claim.sub','dddddddd-dddd-4ddd-8ddd-ddddddddddd2',true);
 SELECT count(*) INTO n FROM t404_b3.catalog_products;
 IF n<>1 THEN RAISE EXCEPTION 'B3_T2_CATALOG_COUNT_%',n; END IF;
 SELECT count(*) INTO n FROM t404_b3.catalog_products WHERE sku IN ('SKU_A','SKU_B');
 IF n<>0 THEN RAISE EXCEPTION 'B3_T2_READ_T1_LEAK'; END IF;
 SELECT count(*) INTO n FROM t404_b3.orders;
 IF n<>1 THEN RAISE EXCEPTION 'B3_T2_ORDER_COUNT_%',n; END IF;

 -- Unknown verified-looking user claim does not grant memberships.
 PERFORM set_config('request.jwt.claim.sub','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2',true);
 SELECT count(*) INTO n FROM t404_b3.catalog_products;
 IF n<>0 THEN RAISE EXCEPTION 'B3_UNKNOWN_SUB_READ_%',n; END IF;

 -- Required no-write admission: not even a grant to insert/update/delete.
 IF has_table_privilege(current_user,'t404_b3.catalog_products','INSERT')
    OR has_table_privilege(current_user,'t404_b3.catalog_products','UPDATE')
    OR has_table_privilege(current_user,'t404_b3.catalog_products','DELETE')
    OR has_table_privilege(current_user,'t404_b3.orders','INSERT')
    OR has_table_privilege(current_user,'t404_b3.orders','UPDATE')
    OR has_table_privilege(current_user,'t404_b3.orders','DELETE')
    THEN RAISE EXCEPTION 'B3_WRITER_PRIVILEGE_PRESENT'; END IF;
END
$CHECK_B3$;

-- Attempted writes below are to disposable fixtures only, and MUST fail.
DO $WRITE_DENY_B3$
DECLARE denied boolean;
BEGIN
 denied:=false;
 BEGIN
   INSERT INTO t404_b3.catalog_products VALUES
    ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','EVIL',1);
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'B3_INSERT_NOT_DENIED'; END IF;

 denied:=false;
 BEGIN
   UPDATE t404_b3.catalog_products SET price_vnd=1 WHERE sku='SKU_A';
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'B3_UPDATE_NOT_DENIED'; END IF;

 denied:=false;
 BEGIN
   DELETE FROM t404_b3.catalog_products WHERE sku='SKU_A';
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'B3_DELETE_NOT_DENIED'; END IF;
END
$WRITE_DENY_B3$;

RESET ROLE;
DO $BASELINE_B3$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM t404_b3.catalog_products;
 IF n<>3 THEN RAISE EXCEPTION 'B3_DISPOSABLE_CATALOG_MUTATED_%',n; END IF;
 SELECT count(*) INTO n FROM t404_b3.orders;
 IF n<>3 THEN RAISE EXCEPTION 'B3_DISPOSABLE_ORDER_MUTATED_%',n; END IF;
END
$BASELINE_B3$;
ROLLBACK;

-- The test must leave zero schema/roles: rollback was in one transaction.
DO $CLEAN_B3$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_namespace WHERE nspname IN ('t404_b3','auth'))
   OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated')
 THEN RAISE EXCEPTION 'B3_ROLLBACK_ORIGIN_DATABASE_DIRTY'; END IF;
END
$CLEAN_B3$;
\echo 'V176B3_DISPOSABLE_PG17_RLS_SUCCESS_A_B_CROSS_STORE_DENIED_NO_REAL_JWT_ROLLBACK_VERIFIED'
