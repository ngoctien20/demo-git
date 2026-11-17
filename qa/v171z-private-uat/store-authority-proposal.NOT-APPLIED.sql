-- TIEN404 V17.1Z -- QA STORE AUTHORITY DESIGN / NOT A DEPLOYMENT MIGRATION
-- DO NOT APPLY TO SUPABASE. This is a transactional DRY-RUN / proposal ONLY.
-- NEVER remove existing tenant_identity_map UNIQUE(auth_tenant_id) or primary key.
-- No existing Store or Merchant may be reassigned, deleted or used as a fixture.
-- A separately signed migration and actual backup/restoration admission are required.
BEGIN;

CREATE SCHEMA tien404_v171z_qa;

CREATE TABLE tien404_v171z_qa.qa_tenants (
 tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE RESTRICT,
 purpose text NOT NULL DEFAULT 'DISPOSABLE_AUTH_STORE_ISOLATION_QA'
   CHECK (purpose = 'DISPOSABLE_AUTH_STORE_ISOLATION_QA'),
 change_receipt_sha256 text NOT NULL CHECK (change_receipt_sha256 ~ '^[a-f0-9]{64}$')
);

CREATE TABLE tien404_v171z_qa.qa_stores (
 tenant_id uuid NOT NULL REFERENCES tien404_v171z_qa.qa_tenants(tenant_id) ON DELETE RESTRICT,
 store_key text NOT NULL CHECK (store_key IN ('QA_STORE_A','QA_STORE_B')),
 PRIMARY KEY (tenant_id,store_key)
);

CREATE TABLE tien404_v171z_qa.qa_store_memberships (
 tenant_id uuid NOT NULL,
 store_key text NOT NULL,
 user_id uuid NOT NULL,
 role text NOT NULL CHECK (role IN ('owner','manager')),
 active boolean NOT NULL DEFAULT true,
 PRIMARY KEY (tenant_id,store_key,user_id),
 FOREIGN KEY (tenant_id,store_key)
   REFERENCES tien404_v171z_qa.qa_stores(tenant_id,store_key) ON DELETE RESTRICT,
 FOREIGN KEY (tenant_id,user_id)
   REFERENCES public.tenant_memberships(tenant_id,user_id) ON DELETE RESTRICT
);

CREATE TABLE tien404_v171z_qa.qa_products (
 tenant_id uuid NOT NULL,
 store_key text NOT NULL,
 sku text NOT NULL CHECK (sku ~ '^QA-[A-Z0-9-]{2,48}$'),
 label text NOT NULL,
 price_vnd numeric(15,0) NOT NULL CHECK (price_vnd>=0),
 PRIMARY KEY (tenant_id,store_key,sku),
 FOREIGN KEY (tenant_id,store_key)
   REFERENCES tien404_v171z_qa.qa_stores(tenant_id,store_key) ON DELETE RESTRICT
);

ALTER TABLE tien404_v171z_qa.qa_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tien404_v171z_qa.qa_tenants FORCE ROW LEVEL SECURITY;
ALTER TABLE tien404_v171z_qa.qa_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE tien404_v171z_qa.qa_stores FORCE ROW LEVEL SECURITY;
ALTER TABLE tien404_v171z_qa.qa_store_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE tien404_v171z_qa.qa_store_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE tien404_v171z_qa.qa_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE tien404_v171z_qa.qa_products FORCE ROW LEVEL SECURITY;

-- Only authenticated own memberships may be read, provided corresponding
-- tenant membership is active. Store owner roles are NOT derived from
-- user_metadata, arbitrary client claims or a privileged SECURITY DEFINER RPC.
CREATE POLICY qa_store_membership_self_read
 ON tien404_v171z_qa.qa_store_memberships
 FOR SELECT TO authenticated
 USING (
   user_id=(SELECT auth.uid()) AND active
   AND EXISTS (
     SELECT 1 FROM public.tenant_memberships tm
     WHERE tm.tenant_id=qa_store_memberships.tenant_id
       AND tm.user_id=(SELECT auth.uid()) AND tm.active
   )
 );

CREATE POLICY qa_products_same_store_member_read
 ON tien404_v171z_qa.qa_products
 FOR SELECT TO authenticated
 USING (
   EXISTS (
     SELECT 1 FROM tien404_v171z_qa.qa_store_memberships sm
     WHERE sm.tenant_id=qa_products.tenant_id
       AND sm.store_key=qa_products.store_key
       AND sm.user_id=(SELECT auth.uid()) AND sm.active
   )
 );

-- Default-deny all writes; NO INSERT/UPDATE/DELETE policies and NO grants.
-- Dedicated private schema not exposed to Data API; any future
-- JWT-backed UAT runner/grants require independent admission and review.
REVOKE ALL ON SCHEMA tien404_v171z_qa FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA tien404_v171z_qa FROM PUBLIC,anon,authenticated;

-- CRITICAL: Even if a privileged operator runs this in error, do not commit.
ROLLBACK;
