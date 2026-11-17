-- RPC17.8A CANDIDATE DDL — REVIEW AND DISPOSABLE POSTGRES CI ONLY.
-- DO NOT APPLY TO SUPABASE STAGING without an independently accepted exact
-- migration authorization, prechange recovery proof and owner/security approval.
-- Creates a NO-ACCESS private schema: not a usable PostgREST Auth A/B endpoint.
\set ON_ERROR_STOP on

BEGIN;
DO $$
BEGIN
 IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='rpc178_qa') THEN
   RAISE EXCEPTION 'RPC178A scope collision; refusing to modify existing QA schema';
 END IF;
END $$;

CREATE SCHEMA rpc178_qa;
REVOKE ALL ON SCHEMA rpc178_qa FROM PUBLIC;
REVOKE ALL ON SCHEMA rpc178_qa FROM anon;
REVOKE ALL ON SCHEMA rpc178_qa FROM authenticated;
REVOKE ALL ON SCHEMA rpc178_qa FROM service_role;

CREATE TABLE rpc178_qa.tenants(
  tenant_id uuid PRIMARY KEY
);
CREATE TABLE rpc178_qa.stores(
  tenant_id uuid NOT NULL REFERENCES rpc178_qa.tenants(tenant_id),
  store_id uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  authority_version integer NOT NULL CHECK(authority_version>0),
  PRIMARY KEY(tenant_id,store_id)
);
CREATE TABLE rpc178_qa.memberships(
  tenant_id uuid NOT NULL,
  store_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK(role IN ('owner','manager','staff')),
  is_active boolean NOT NULL DEFAULT false,
  authority_version integer NOT NULL CHECK(authority_version>0),
  PRIMARY KEY(tenant_id,store_id,user_id),
  FOREIGN KEY(tenant_id,store_id) REFERENCES rpc178_qa.stores(tenant_id,store_id)
);
CREATE TABLE rpc178_qa.products(
  product_id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  store_id uuid NOT NULL,
  sku text NOT NULL,
  FOREIGN KEY(tenant_id,store_id) REFERENCES rpc178_qa.stores(tenant_id,store_id),
  UNIQUE(tenant_id,store_id,sku)
);
CREATE INDEX rpc178_store_member_lookup ON rpc178_qa.memberships(user_id,tenant_id,store_id)
 WHERE is_active;
CREATE INDEX rpc178_product_scope ON rpc178_qa.products(tenant_id,store_id);

ALTER TABLE rpc178_qa.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE rpc178_qa.tenants FORCE ROW LEVEL SECURITY;
ALTER TABLE rpc178_qa.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE rpc178_qa.stores FORCE ROW LEVEL SECURITY;
ALTER TABLE rpc178_qa.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE rpc178_qa.memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE rpc178_qa.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE rpc178_qa.products FORCE ROW LEVEL SECURITY;

-- No policies means deny-by-default. No permissions on new tables granted.
-- Local QA superuser may seed synthetic fixtures only into disposable PG17.
COMMIT;
