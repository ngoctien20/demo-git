\set ON_ERROR_STOP on
-- TIEN404 V19.0-B7: disposable PostgreSQL 17 in CI service container ONLY.
-- Never run against Supabase, staging, production or real customer tables.
-- This implements only the *rehearsal* of V18.3.6D restrictive policy algebra.
-- Role names stand for SYNTHETIC actors, NOT authenticated Supabase JWTs.
CREATE SCHEMA b7_fixture;
CREATE ROLE b7_owner_a NOLOGIN NOBYPASSRLS;
CREATE ROLE b7_owner_b NOLOGIN NOBYPASSRLS;
CREATE ROLE b7_owner_both NOLOGIN NOBYPASSRLS;
CREATE ROLE b7_tenant_owner NOLOGIN NOBYPASSRLS;
CREATE ROLE b7_revoked NOLOGIN NOBYPASSRLS;
CREATE ROLE b7_expired NOLOGIN NOBYPASSRLS;
CREATE ROLE b7_staff_a NOLOGIN NOBYPASSRLS;
CREATE ROLE b7_external NOLOGIN NOBYPASSRLS;
CREATE ROLE b7_no_membership NOLOGIN NOBYPASSRLS;

CREATE TABLE b7_fixture.stores (
 tenant_id text NOT NULL,
 store_id text NOT NULL,
 state text NOT NULL CHECK(state IN ('active','suspended')),
 PRIMARY KEY(tenant_id,store_id)
);
CREATE TABLE b7_fixture.tenant_memberships (
 actor_name text NOT NULL,
 tenant_id text NOT NULL,
 state text NOT NULL,
 PRIMARY KEY(actor_name,tenant_id)
);
CREATE TABLE b7_fixture.store_memberships (
 actor_name text NOT NULL,
 tenant_id text NOT NULL,
 store_id text NOT NULL,
 state text NOT NULL,
 valid_until timestamptz NOT NULL,
 PRIMARY KEY(actor_name,tenant_id,store_id),
 FOREIGN KEY(tenant_id,store_id) REFERENCES b7_fixture.stores(tenant_id,store_id)
);
CREATE TABLE b7_fixture.orders (
 tenant_id text NOT NULL,
 store_id text,
 order_ref text NOT NULL,
 PRIMARY KEY(tenant_id,order_ref),
 FOREIGN KEY(tenant_id,store_id) REFERENCES b7_fixture.stores(tenant_id,store_id)
);

INSERT INTO b7_fixture.stores VALUES
 ('tenant-synthetic-1','store-synthetic-a','active'),
 ('tenant-synthetic-1','store-synthetic-b','active'),
 ('tenant-synthetic-1','store-synthetic-disabled','suspended'),
 ('tenant-synthetic-2','store-synthetic-c','active');
INSERT INTO b7_fixture.tenant_memberships VALUES
 ('b7_owner_a','tenant-synthetic-1','active'),
 ('b7_owner_b','tenant-synthetic-1','active'),
 ('b7_owner_both','tenant-synthetic-1','active'),
 ('b7_tenant_owner','tenant-synthetic-1','active'),
 ('b7_revoked','tenant-synthetic-1','active'),
 ('b7_expired','tenant-synthetic-1','active'),
 ('b7_staff_a','tenant-synthetic-1','active'),
 ('b7_external','tenant-synthetic-2','active');
INSERT INTO b7_fixture.store_memberships VALUES
 ('b7_owner_a','tenant-synthetic-1','store-synthetic-a','active',now()+interval '1 day'),
 ('b7_owner_a','tenant-synthetic-1','store-synthetic-disabled','active',now()+interval '1 day'),
 ('b7_owner_b','tenant-synthetic-1','store-synthetic-b','active',now()+interval '1 day'),
 ('b7_owner_both','tenant-synthetic-1','store-synthetic-a','active',now()+interval '1 day'),
 ('b7_owner_both','tenant-synthetic-1','store-synthetic-b','active',now()+interval '1 day'),
 ('b7_revoked','tenant-synthetic-1','store-synthetic-a','revoked',now()+interval '1 day'),
 ('b7_expired','tenant-synthetic-1','store-synthetic-a','active',now()-interval '1 day'),
 ('b7_staff_a','tenant-synthetic-1','store-synthetic-a','active',now()+interval '1 day'),
 ('b7_external','tenant-synthetic-2','store-synthetic-c','active',now()+interval '1 day');
INSERT INTO b7_fixture.orders VALUES
 ('tenant-synthetic-1','store-synthetic-a','qa-order-a'),
 ('tenant-synthetic-1','store-synthetic-b','qa-order-b'),
 ('tenant-synthetic-1','store-synthetic-disabled','qa-order-disabled'),
 ('tenant-synthetic-1',NULL,'qa-order-legacy-null'),
 ('tenant-synthetic-2','store-synthetic-c','qa-order-c');

ALTER TABLE b7_fixture.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE b7_fixture.orders FORCE ROW LEVEL SECURITY;
-- A real production policy will use auth.uid(), memberships, and approved
-- permission helper. Here current_user represents a distinct synthetic DB actor.
CREATE POLICY legacy_tenant_permissive
 ON b7_fixture.orders AS PERMISSIVE FOR SELECT TO PUBLIC
 USING (EXISTS (
  SELECT 1 FROM b7_fixture.tenant_memberships tm
  WHERE tm.actor_name=current_user
    AND tm.tenant_id=orders.tenant_id
    AND tm.state='active'
 ));
-- Adversarial additional permissive policy: restrictive must still prevent leaks.
CREATE POLICY adversarial_permissive_true
 ON b7_fixture.orders AS PERMISSIVE FOR SELECT TO PUBLIC USING (true);
CREATE POLICY store_restrictive_boundary
 ON b7_fixture.orders AS RESTRICTIVE FOR SELECT TO PUBLIC
 USING (store_id IS NOT NULL AND EXISTS (
  SELECT 1 FROM b7_fixture.store_memberships sm
  JOIN b7_fixture.stores s ON
   s.tenant_id=sm.tenant_id AND s.store_id=sm.store_id
  WHERE sm.actor_name=current_user
   AND sm.tenant_id=orders.tenant_id
   AND sm.store_id=orders.store_id
   AND sm.state='active'
   AND sm.valid_until>now()
   AND s.state='active'
 ));

GRANT USAGE ON SCHEMA b7_fixture TO
 b7_owner_a,b7_owner_b,b7_owner_both,b7_tenant_owner,b7_revoked,
 b7_expired,b7_staff_a,b7_external,b7_no_membership;
GRANT SELECT ON b7_fixture.orders,b7_fixture.stores,
 b7_fixture.store_memberships,b7_fixture.tenant_memberships TO
 b7_owner_a,b7_owner_b,b7_owner_both,b7_tenant_owner,b7_revoked,
 b7_expired,b7_staff_a,b7_external,b7_no_membership;

SET ROLE b7_owner_a;
SELECT 1/(CASE WHEN (SELECT count(*) FROM b7_fixture.orders)=1 THEN 1 ELSE 0 END) AS qa_owner_a_isolated;
SELECT 1/(CASE WHEN (SELECT order_ref FROM b7_fixture.orders LIMIT 1)='qa-order-a' THEN 1 ELSE 0 END) AS qa_a_only;
SELECT 1/(CASE WHEN NOT has_table_privilege(current_user,'b7_fixture.orders','INSERT') AND NOT has_table_privilege(current_user,'b7_fixture.orders','UPDATE') AND NOT has_table_privilege(current_user,'b7_fixture.orders','DELETE') THEN 1 ELSE 0 END) AS qa_no_direct_dml;
RESET ROLE;

SET ROLE b7_owner_b;
SELECT 1/(CASE WHEN (SELECT count(*) FROM b7_fixture.orders)=1 THEN 1 ELSE 0 END) AS qa_owner_b_isolated;
SELECT 1/(CASE WHEN (SELECT order_ref FROM b7_fixture.orders LIMIT 1)='qa-order-b' THEN 1 ELSE 0 END) AS qa_b_only;
RESET ROLE;

SET ROLE b7_owner_both;
SELECT 1/(CASE WHEN (SELECT count(*) FROM b7_fixture.orders)=2 THEN 1 ELSE 0 END) AS qa_dual_membership_exactly_two;
RESET ROLE;

SET ROLE b7_tenant_owner;
SELECT 1/(CASE WHEN (SELECT count(*) FROM b7_fixture.orders)=0 THEN 1 ELSE 0 END) AS qa_tenant_owner_no_implicit_store_read;
RESET ROLE;

SET ROLE b7_revoked;
SELECT 1/(CASE WHEN (SELECT count(*) FROM b7_fixture.orders)=0 THEN 1 ELSE 0 END) AS qa_revoked_denied;
RESET ROLE;

SET ROLE b7_expired;
SELECT 1/(CASE WHEN (SELECT count(*) FROM b7_fixture.orders)=0 THEN 1 ELSE 0 END) AS qa_expired_denied;
RESET ROLE;

SET ROLE b7_staff_a;
SELECT 1/(CASE WHEN (SELECT count(*) FROM b7_fixture.orders)=1 THEN 1 ELSE 0 END) AS qa_staff_scoped_read;
SELECT 1/(CASE WHEN NOT has_table_privilege(current_user,'b7_fixture.orders','UPDATE') THEN 1 ELSE 0 END) AS qa_staff_no_direct_update;
RESET ROLE;

SET ROLE b7_external;
SELECT 1/(CASE WHEN (SELECT count(*) FROM b7_fixture.orders)=1 THEN 1 ELSE 0 END) AS qa_external_tenant_scoped;
SELECT 1/(CASE WHEN (SELECT order_ref FROM b7_fixture.orders LIMIT 1)='qa-order-c' THEN 1 ELSE 0 END) AS qa_external_only_c;
RESET ROLE;

SET ROLE b7_no_membership;
SELECT 1/(CASE WHEN (SELECT count(*) FROM b7_fixture.orders)=0 THEN 1 ELSE 0 END) AS qa_unknown_actor_denied;
RESET ROLE;

-- Static policy existence and RLS metadata must agree with fixture intent.
SELECT 1/(CASE WHEN
 (SELECT count(*) FROM pg_policies WHERE schemaname='b7_fixture'
  AND tablename='orders' AND permissive='RESTRICTIVE')=1
 AND (SELECT relrowsecurity AND relforcerowsecurity FROM pg_class
  WHERE oid='b7_fixture.orders'::regclass)=true
 THEN 1 ELSE 0 END) AS qa_restrictive_enabled;
-- This disposable service container is discarded at the end of GitHub Actions.
