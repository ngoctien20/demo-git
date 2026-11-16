-- TIEN404 V15 Sales Lite P0-F — STORE-AWARE SECURITY INVOKER REMEDIATION REHEARSAL
-- DISPOSABLE PostgreSQL17 SYNTHETIC QA ONLY. NEVER execute on Supabase hosted.
-- This is NOT a migration, a real JWT identity test or a production-ready RPC.
-- No personal records, real tenant IDs, credentials, Meta/Zalo sends or live Orders.
\set ON_ERROR_STOP on
BEGIN;

CREATE ROLE authenticated NOLOGIN;
CREATE ROLE anon NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA auth TO authenticated,anon;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;

CREATE SCHEMA qa_p0f;
GRANT USAGE ON SCHEMA qa_p0f TO authenticated,anon;
CREATE TABLE qa_p0f.tenants(id uuid PRIMARY KEY);
CREATE TABLE qa_p0f.tenant_memberships(
 tenant_id uuid NOT NULL REFERENCES qa_p0f.tenants(id),
 user_id uuid NOT NULL,
 role text NOT NULL CHECK(role IN('owner','manager','staff')),
 active boolean NOT NULL,
 PRIMARY KEY(tenant_id,user_id));
CREATE TABLE qa_p0f.stores(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES qa_p0f.tenants(id),
 status text NOT NULL CHECK(status IN('active','paused','revoked')),
 UNIQUE(tenant_id,id));
CREATE TABLE qa_p0f.store_memberships(
 tenant_id uuid NOT NULL,store_id uuid NOT NULL,user_id uuid NOT NULL,
 role text NOT NULL CHECK(role IN('owner','manager','staff')),
 active boolean NOT NULL,
 PRIMARY KEY(tenant_id,store_id,user_id),
 FOREIGN KEY(tenant_id,store_id) REFERENCES qa_p0f.stores(tenant_id,id),
 FOREIGN KEY(tenant_id,user_id) REFERENCES qa_p0f.tenant_memberships(tenant_id,user_id));
CREATE TABLE qa_p0f.products(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,store_id uuid NOT NULL,
 sku text NOT NULL CHECK(sku ~ '^[A-Z][0-9]{3}$'),
 name text NOT NULL,price_vnd bigint NOT NULL CHECK(price_vnd BETWEEN 1 AND 1000000000000),
 stock_on_hand integer NOT NULL CHECK(stock_on_hand>=0),
 updated_at timestamptz NOT NULL DEFAULT '2026-11-16T00:00:00+00',
 UNIQUE(tenant_id,store_id,sku),
 FOREIGN KEY(tenant_id,store_id) REFERENCES qa_p0f.stores(tenant_id,id));

ALTER TABLE qa_p0f.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_p0f.tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_p0f.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_p0f.store_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_p0f.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_p0f.tenants FORCE ROW LEVEL SECURITY;
ALTER TABLE qa_p0f.tenant_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE qa_p0f.stores FORCE ROW LEVEL SECURITY;
ALTER TABLE qa_p0f.store_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE qa_p0f.products FORCE ROW LEVEL SECURITY;

GRANT SELECT ON qa_p0f.tenants,qa_p0f.tenant_memberships,
  qa_p0f.stores,qa_p0f.store_memberships,qa_p0f.products TO authenticated;
GRANT UPDATE(name,price_vnd,updated_at) ON qa_p0f.products TO authenticated;

CREATE POLICY tenant_member_self ON qa_p0f.tenant_memberships
 FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()) AND active);
CREATE POLICY tenant_self ON qa_p0f.tenants FOR SELECT TO authenticated USING(
 EXISTS(SELECT 1 FROM qa_p0f.tenant_memberships m
 WHERE m.tenant_id=tenants.id AND m.user_id=(SELECT auth.uid()) AND m.active));
CREATE POLICY store_membership_self ON qa_p0f.store_memberships
 FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()) AND active
  AND EXISTS(SELECT 1 FROM qa_p0f.tenant_memberships m
  WHERE m.tenant_id=store_memberships.tenant_id
    AND m.user_id=(SELECT auth.uid()) AND m.active));
CREATE POLICY store_member_read ON qa_p0f.stores FOR SELECT TO authenticated USING(
 status='active' AND EXISTS(SELECT 1 FROM qa_p0f.store_memberships m
 WHERE m.tenant_id=stores.tenant_id AND m.store_id=stores.id
   AND m.user_id=(SELECT auth.uid()) AND m.active));
CREATE POLICY product_member_read ON qa_p0f.products FOR SELECT TO authenticated USING(
 EXISTS(SELECT 1 FROM qa_p0f.store_memberships m
 JOIN qa_p0f.stores s ON s.id=m.store_id AND s.tenant_id=m.tenant_id
 JOIN qa_p0f.tenant_memberships t ON t.tenant_id=m.tenant_id AND t.user_id=m.user_id
 WHERE m.tenant_id=products.tenant_id AND m.store_id=products.store_id
   AND m.user_id=(SELECT auth.uid()) AND m.active AND t.active AND s.status='active'));
CREATE POLICY product_owner_manager_update ON qa_p0f.products FOR UPDATE TO authenticated USING(
 EXISTS(SELECT 1 FROM qa_p0f.store_memberships m
 JOIN qa_p0f.stores s ON s.id=m.store_id AND s.tenant_id=m.tenant_id
 JOIN qa_p0f.tenant_memberships t ON t.tenant_id=m.tenant_id AND t.user_id=m.user_id
 WHERE m.tenant_id=products.tenant_id AND m.store_id=products.store_id
   AND m.user_id=(SELECT auth.uid()) AND m.active AND t.active
   AND m.role IN('owner','manager') AND t.role IN('owner','manager') AND s.status='active'))
 WITH CHECK(
 EXISTS(SELECT 1 FROM qa_p0f.store_memberships m
 JOIN qa_p0f.stores s ON s.id=m.store_id AND s.tenant_id=m.tenant_id
 JOIN qa_p0f.tenant_memberships t ON t.tenant_id=m.tenant_id AND t.user_id=m.user_id
 WHERE m.tenant_id=products.tenant_id AND m.store_id=products.store_id
   AND m.user_id=(SELECT auth.uid()) AND m.active AND t.active
   AND m.role IN('owner','manager') AND t.role IN('owner','manager') AND s.status='active'));

-- CANDIDATE: demonstrably safe against cross-store writes in DISPOSABLE
-- environment. SECURITY INVOKER means caller RLS AND column grants are enforced.
-- Production code must additionally bind trusted resolved channel identity to Store.
CREATE FUNCTION qa_p0f.change_product_price(
 p_tenant uuid,p_store uuid,p_sku text,p_expected_updated_at timestamptz,
 p_price_vnd bigint,p_name text
) RETURNS timestamptz
 LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $function$
DECLARE v_new timestamptz;
BEGIN
 IF (SELECT auth.uid()) IS NULL OR p_tenant IS NULL OR p_store IS NULL
 OR p_sku IS NULL OR p_sku !~ '^[A-Z][0-9]{3}$'
 OR p_expected_updated_at IS NULL
 OR p_price_vnd IS NULL OR p_price_vnd NOT BETWEEN 1 AND 1000000000000
 OR p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 1 AND 250
 THEN RAISE EXCEPTION 'INVALID_OR_UNAUTHORIZED_REQUEST' USING ERRCODE='42501'; END IF;

 UPDATE qa_p0f.products
 SET name=btrim(p_name),price_vnd=p_price_vnd,
     updated_at=greatest(clock_timestamp(),updated_at+interval '1 microsecond')
 WHERE tenant_id=p_tenant AND store_id=p_store AND sku=p_sku
   AND updated_at=p_expected_updated_at
 RETURNING updated_at INTO v_new;

 -- Do not distinguish absent, wrong Store, forbidden role or stale timestamp.
 IF NOT FOUND THEN RAISE EXCEPTION 'NOT_AUTHORIZED_OR_STALE_PRODUCT' USING ERRCODE='42501'; END IF;
 RETURN v_new;
END $function$;
REVOKE ALL ON FUNCTION qa_p0f.change_product_price(uuid,uuid,text,timestamptz,bigint,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION qa_p0f.change_product_price(uuid,uuid,text,timestamptz,bigint,text) FROM anon;
GRANT EXECUTE ON FUNCTION qa_p0f.change_product_price(uuid,uuid,text,timestamptz,bigint,text) TO authenticated;

-- Synthetic A and B are under SAME tenant; C belongs to another tenant.
INSERT INTO qa_p0f.tenants VALUES
 ('00000000-0000-0000-0000-000000000001'),
 ('00000000-0000-0000-0000-000000000002');
INSERT INTO qa_p0f.tenant_memberships VALUES
 ('00000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','owner',true),
 ('00000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','owner',true),
 ('00000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000003','owner',true),
 ('00000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000004','staff',true);
INSERT INTO qa_p0f.stores VALUES
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','active'),
 ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','active'),
 ('10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002','active');
INSERT INTO qa_p0f.store_memberships VALUES
 ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','owner',true),
 ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','owner',true),
 ('00000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000003','owner',true),
 ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000004','staff',true);
INSERT INTO qa_p0f.products(id,tenant_id,store_id,sku,name,price_vnd,stock_on_hand) VALUES
 ('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','A001','A Synthetic',159000,3),
 ('30000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','A001','B Synthetic',199000,4),
 ('30000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000003','A001','C Synthetic',219000,5);
-- Owner A must see its own Store SKU, no B despite same tenant.
SET ROLE authenticated;
SET request.jwt.claim.sub='20000000-0000-0000-0000-000000000001';
DO $assert$ BEGIN
 IF (SELECT count(*) FROM qa_p0f.products)<>1 OR
    (SELECT price_vnd FROM qa_p0f.products)<>159000 THEN
    RAISE EXCEPTION 'STORE_A_READ_BOUNDARY_FAILED'; END IF;
END $assert$;
RESET ROLE;
-- PG17 tests write of A exact price and freshness, block B and C, staff, pause, revoked, anon.
SET ROLE authenticated;
SET request.jwt.claim.sub='20000000-0000-0000-0000-000000000001';
DO $assert$ DECLARE before_ts timestamptz := '2026-11-16T00:00:00+00';new_ts timestamptz;blocked boolean:=false;
BEGIN
 new_ts := qa_p0f.change_product_price(
  '00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',
  'A001',before_ts,169000,'A Renamed');
 IF new_ts<=before_ts THEN RAISE EXCEPTION 'OPTIMISTIC_TIMESTAMP_NOT_ADVANCED'; END IF;
 BEGIN
 PERFORM qa_p0f.change_product_price(
  '00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',
  'A001',before_ts,1,'stale');
 EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'STALE_TIMESTAMP_ALLOWED'; END IF;
 blocked:=false;
 BEGIN
 PERFORM qa_p0f.change_product_price(
  '00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002',
  'A001',before_ts,1,'B SPOOF');
 EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'WRONG_STORE_WRITE_ALLOWED'; END IF;
 blocked:=false;
 BEGIN
 PERFORM qa_p0f.change_product_price(
  '00000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000003',
  'A001',before_ts,1,'C SPOOF');
 EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'CROSS_TENANT_WRITE_ALLOWED'; END IF;
 blocked:=false;
 BEGIN
 UPDATE qa_p0f.products SET store_id='10000000-0000-0000-0000-000000000002';
 EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'STORE_REASSIGN_PERMISSION_ALLOWED'; END IF;
END $assert$;
RESET ROLE;
DO $assert$ BEGIN
 IF (SELECT price_vnd FROM qa_p0f.products WHERE id='30000000-0000-0000-0000-000000000001')<>169000
 OR (SELECT price_vnd FROM qa_p0f.products WHERE id='30000000-0000-0000-0000-000000000002')<>199000
 OR (SELECT stock_on_hand FROM qa_p0f.products WHERE id='30000000-0000-0000-0000-000000000001')<>3
 THEN RAISE EXCEPTION 'CROSS_STORE_PRICE_OR_STOCK_CORRUPTED'; END IF;
END $assert$;
-- Staff user cannot write despite read membership.
SET ROLE authenticated;
SET request.jwt.claim.sub='20000000-0000-0000-0000-000000000004';
DO $assert$ DECLARE blocked boolean:=false;BEGIN
 BEGIN PERFORM qa_p0f.change_product_price(
  '00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',
  'A001','2026-11-16T00:00:00+00',1,'STAFF');
 EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'STAFF_CHANGED_PRICE'; END IF;
END $assert$;
RESET ROLE;
UPDATE qa_p0f.stores SET status='paused'
 WHERE id='10000000-0000-0000-0000-000000000002';
SET ROLE authenticated;
SET request.jwt.claim.sub='20000000-0000-0000-0000-000000000002';
DO $assert$ DECLARE blocked boolean:=false;BEGIN
 IF (SELECT count(*) FROM qa_p0f.products)<>0 THEN RAISE EXCEPTION 'PAUSED_STORE_CATALOG_LEAK'; END IF;
 BEGIN PERFORM qa_p0f.change_product_price(
  '00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002',
  'A001','2026-11-16T00:00:00+00',1,'PAUSED');
 EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'PAUSED_STORE_CHANGED_PRICE'; END IF;
END $assert$;
RESET ROLE;
UPDATE qa_p0f.store_memberships SET active=false
 WHERE user_id='20000000-0000-0000-0000-000000000001';
SET ROLE authenticated;
SET request.jwt.claim.sub='20000000-0000-0000-0000-000000000001';
DO $assert$ DECLARE blocked boolean:=false;BEGIN
 IF (SELECT count(*) FROM qa_p0f.products)<>0 THEN RAISE EXCEPTION 'REVOKED_STORE_READ_ALLOWED'; END IF;
 BEGIN PERFORM qa_p0f.change_product_price(
  '00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',
  'A001','2026-11-16T00:00:00+00',1,'REVOKED');
 EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'REVOKED_STORE_CHANGED_PRICE'; END IF;
END $assert$;
RESET ROLE;
SET ROLE anon;
DO $assert$ DECLARE blocked boolean:=false;BEGIN
 BEGIN PERFORM qa_p0f.change_product_price(
  '00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',
  'A001','2026-11-16T00:00:00+00',1,'ANON');
 EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'ANON_RPC_ALLOWED'; END IF;
END $assert$;
RESET ROLE;
-- Roll back all fixtures, roles, policies, functions and price changes.
ROLLBACK;
DO $assert$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='qa_p0f')
 THEN RAISE EXCEPTION 'DISPOSABLE_SCHEMA_REMAINED_AFTER_ROLLBACK'; END IF;
END $assert$;
SELECT 'PASS_DISPOSABLE_PG17_SECURITY_INVOKER_STORE_PRODUCT_FK_RLS_NO_HOSTED' AS result;
