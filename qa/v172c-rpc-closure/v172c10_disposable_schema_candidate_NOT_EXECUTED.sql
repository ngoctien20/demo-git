-- V17.2C.10 — DISPOSABLE SCHEMA CANDIDATE, NOT APPROVED / NOT EXECUTED.
-- ONLY for an independent authorized disposable Supabase project after private
-- consent, cost and rollback review. Never run on current tien404-staging.
-- Must configure isolated Data API schema access only after a separate review.
-- No existing public Commerce data is read, migrated, reclassified or modified.
BEGIN;
CREATE SCHEMA tien404_v172c10_disposable;
REVOKE ALL ON SCHEMA tien404_v172c10_disposable FROM PUBLIC;
GRANT USAGE ON SCHEMA tien404_v172c10_disposable TO authenticated;

CREATE TABLE tien404_v172c10_disposable.qa_tenants (
  tenant_id uuid PRIMARY KEY,
  label text NOT NULL CHECK (length(label) BETWEEN 1 AND 64)
);
CREATE TABLE tien404_v172c10_disposable.qa_stores (
  tenant_id uuid NOT NULL REFERENCES tien404_v172c10_disposable.qa_tenants(tenant_id),
  store_id uuid NOT NULL,
  label text NOT NULL CHECK (length(label) BETWEEN 1 AND 64),
  PRIMARY KEY (tenant_id, store_id)
);
CREATE TABLE tien404_v172c10_disposable.qa_store_memberships (
  tenant_id uuid NOT NULL,
  store_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  role text NOT NULL CHECK (role IN ('owner','viewer')),
  active boolean NOT NULL DEFAULT false,
  PRIMARY KEY (tenant_id, store_id, user_id),
  FOREIGN KEY (tenant_id,store_id)
    REFERENCES tien404_v172c10_disposable.qa_stores(tenant_id,store_id)
);
CREATE INDEX qa_store_memberships_user_active_idx
ON tien404_v172c10_disposable.qa_store_memberships (user_id, active, tenant_id, store_id);
-- This index supports the auth.uid()/active predicate used by read-only RLS.
-- The composite PK begins with tenant_id and is not a substitute for user_id indexing.

CREATE TABLE tien404_v172c10_disposable.qa_catalog (
  tenant_id uuid NOT NULL,
  store_id uuid NOT NULL,
  sku text NOT NULL CHECK (length(sku) BETWEEN 1 AND 80),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 150),
  price_vnd bigint NOT NULL CHECK (price_vnd BETWEEN 0 AND 1000000000000),
  stock_on_hand integer NOT NULL CHECK (stock_on_hand>=0),
  PRIMARY KEY (tenant_id, store_id, sku),
  FOREIGN KEY (tenant_id,store_id)
    REFERENCES tien404_v172c10_disposable.qa_stores(tenant_id,store_id)
);

ALTER TABLE tien404_v172c10_disposable.qa_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tien404_v172c10_disposable.qa_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE tien404_v172c10_disposable.qa_store_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE tien404_v172c10_disposable.qa_catalog ENABLE ROW LEVEL SECURITY;

-- Tenant and store definitions remain inaccessible to direct Auth client API.
-- Membership rows only reveal the currently signed-in actor's own membership.
CREATE POLICY own_active_membership_read
ON tien404_v172c10_disposable.qa_store_memberships
FOR SELECT TO authenticated
USING (active AND user_id=(SELECT auth.uid()));

-- Read-only catalog is scoped to exact SAME tenant_id/store_id, never just tenant.
CREATE POLICY member_own_store_catalog_read
ON tien404_v172c10_disposable.qa_catalog
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM tien404_v172c10_disposable.qa_store_memberships m
  WHERE m.tenant_id=qa_catalog.tenant_id
    AND m.store_id=qa_catalog.store_id
    AND m.user_id=(SELECT auth.uid())
    AND m.active
));

REVOKE ALL ON ALL TABLES IN SCHEMA tien404_v172c10_disposable
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON tien404_v172c10_disposable.qa_store_memberships,
  tien404_v172c10_disposable.qa_catalog TO authenticated;
-- No INSERT/UPDATE/DELETE/EXECUTE grants to anon/authenticated.
-- Only a separately authorized private QA operator may seed synthetic fixtures.
COMMIT;
