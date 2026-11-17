-- TIEN404 V17.2A — MIGRATION CANDIDATE / NOT APPROVED / NOT APPLIED
-- No live Supabase application has been made. Approval, backup and private
-- owner Auth user provisioning must be completed separately.
-- To prevent accidental deployment, this preview always ROLLS BACK.
-- DO NOT move this file into supabase/migrations without independent review.
BEGIN;

CREATE SCHEMA tien404_v172a_qa;

CREATE TABLE tien404_v172a_qa.qa_tenants (
 tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE RESTRICT,
 receipt_sha256 text NOT NULL CHECK(receipt_sha256 ~ '^[a-f0-9]{64}$')
);

CREATE TABLE tien404_v172a_qa.qa_stores (
 tenant_id uuid NOT NULL REFERENCES tien404_v172a_qa.qa_tenants(tenant_id) ON DELETE RESTRICT,
 store_key text NOT NULL CHECK(store_key IN ('QA_STORE_A','QA_STORE_B')),
 PRIMARY KEY(tenant_id,store_key)
);

CREATE TABLE tien404_v172a_qa.qa_store_memberships (
 tenant_id uuid NOT NULL,
 store_key text NOT NULL,
 user_id uuid NOT NULL,
 role text NOT NULL CHECK(role IN ('owner','manager')),
 active boolean NOT NULL DEFAULT true,
 PRIMARY KEY(tenant_id,store_key,user_id),
 FOREIGN KEY(tenant_id,store_key)
  REFERENCES tien404_v172a_qa.qa_stores(tenant_id,store_key) ON DELETE RESTRICT,
 FOREIGN KEY(tenant_id,user_id)
  REFERENCES public.tenant_memberships(tenant_id,user_id) ON DELETE RESTRICT
);

CREATE TABLE tien404_v172a_qa.qa_catalog (
 tenant_id uuid NOT NULL,
 store_key text NOT NULL,
 sku text NOT NULL CHECK(sku ~ '^QA-[A-Z0-9-]{2,48}$'),
 name text NOT NULL CHECK(length(name) BETWEEN 2 AND 100),
 price_vnd numeric(15,0) NOT NULL CHECK(price_vnd >= 0),
 PRIMARY KEY(tenant_id,store_key,sku),
 FOREIGN KEY(tenant_id,store_key)
  REFERENCES tien404_v172a_qa.qa_stores(tenant_id,store_key) ON DELETE RESTRICT
);

ALTER TABLE tien404_v172a_qa.qa_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tien404_v172a_qa.qa_tenants FORCE ROW LEVEL SECURITY;
ALTER TABLE tien404_v172a_qa.qa_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE tien404_v172a_qa.qa_stores FORCE ROW LEVEL SECURITY;
ALTER TABLE tien404_v172a_qa.qa_store_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE tien404_v172a_qa.qa_store_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE tien404_v172a_qa.qa_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE tien404_v172a_qa.qa_catalog FORCE ROW LEVEL SECURITY;

-- No client write policies. SELECT only for the specific signed-in user.
CREATE POLICY qa_store_membership_self_read
 ON tien404_v172a_qa.qa_store_memberships
 FOR SELECT TO authenticated
 USING (
  user_id = (SELECT auth.uid()) AND active
  AND EXISTS (
   SELECT 1 FROM public.tenant_memberships tm
   WHERE tm.tenant_id = qa_store_memberships.tenant_id
    AND tm.user_id = (SELECT auth.uid())
    AND tm.active
  )
 );

-- Store-specific read enforced by RLS, not a client-supplied store claim.
CREATE POLICY qa_catalog_same_store_owner_read
 ON tien404_v172a_qa.qa_catalog
 FOR SELECT TO authenticated
 USING (
  EXISTS (
   SELECT 1 FROM tien404_v172a_qa.qa_store_memberships m
   WHERE m.tenant_id = qa_catalog.tenant_id
    AND m.store_key = qa_catalog.store_key
    AND m.user_id = (SELECT auth.uid())
    AND m.role = 'owner'
    AND m.active
  )
 );

-- All other private tables default-deny even for authenticated.
REVOKE ALL ON SCHEMA tien404_v172a_qa FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA tien404_v172a_qa FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA tien404_v172a_qa TO authenticated;
GRANT SELECT ON tien404_v172a_qa.qa_store_memberships,
 tien404_v172a_qa.qa_catalog TO authenticated;

-- PostgreSQL 17 supports a security_invoker view: the calling JWT's role
-- continues to enforce private table RLS. Only synthetic QA rows are exposed.
-- Public schema changes require SEPARATE independent security authorization.
CREATE VIEW public.tien404_v172a_qa_catalog
 WITH (security_invoker = true)
 AS
 SELECT tenant_id,store_key,sku,name,price_vnd
 FROM tien404_v172a_qa.qa_catalog;
REVOKE ALL ON public.tien404_v172a_qa_catalog FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.tien404_v172a_qa_catalog TO authenticated;

-- No SECURITY DEFINER, no bypassrls, no role grants, no service_role,
-- no change to legacy tenant_identity_map or production Commerce tables.
-- Endpoint MUST use an end-user real JWT via PostgREST, never a service key.
ROLLBACK;
