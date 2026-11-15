-- TIEN404 AI V14.2 / P0 STORE RLS — REVIEW-ONLY PROPOSAL
-- THIS IS NOT A SUPABASE MIGRATION. NOT APPROVED. DO NOT APPLY.
-- Intended for expert review only; no permission, credential, or data changes authorized.
-- Backups, Shop A/B signed-in QA, locking and database migration sequencing are required.
--
-- A hard gate deliberately aborts BEFORE ANY DDL. DO NOT REMOVE without
-- a separate written owner approval covering both schema AND RLS policy changes.
BEGIN;
DO $v142_no_approval$
BEGIN
 RAISE EXCEPTION 'V14_2_SCHEMA_AND_RLS_CHANGE_NOT_AUTHORIZED_STOP';
END;
$v142_no_approval$;

-- ==== PHASE 1 — Canonical store and authenticated assignments (REVIEW ONLY) ====
-- Prerequisite: verify all existing tenant_id values, tenant_memberships roles,
-- staff assignment hierarchy, full backup and point-in-time restore plan.
CREATE TABLE public.stores (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
 display_name text NOT NULL CHECK(length(trim(display_name)) BETWEEN 2 AND 120),
 status text NOT NULL DEFAULT 'setup' CHECK(status IN ('setup','active','paused','archived')),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id)
);
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.stores FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.stores TO authenticated;

CREATE TABLE public.store_memberships (
 tenant_id uuid NOT NULL,
 store_id uuid NOT NULL,
 user_id uuid NOT NULL,
 role text NOT NULL CHECK(role IN
  ('SHOP_OWNER','SHOP_MANAGER','STORE_VIEWER','TIEN404_SUPPORT','TIEN404_REVIEWER','PLATFORM_SUPER_ADMIN')),
 active boolean NOT NULL DEFAULT false,
 staff_store_assignment_active boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,store_id,user_id),
 FOREIGN KEY(tenant_id,store_id) REFERENCES public.stores(tenant_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(tenant_id,user_id) REFERENCES public.tenant_memberships(tenant_id,user_id) ON DELETE RESTRICT,
 CONSTRAINT staff_assignment_active_guard CHECK(
   role NOT IN ('TIEN404_SUPPORT','TIEN404_REVIEWER','PLATFORM_SUPER_ADMIN')
   OR staff_store_assignment_active
 )
);
CREATE INDEX store_memberships_user_active ON public.store_memberships(user_id,store_id)
 WHERE active;
ALTER TABLE public.store_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_memberships FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.store_memberships FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.store_memberships TO authenticated;

-- These policies only reveal the user's own membership, and stores with a
-- valid active tenant AND store membership; never trust raw_user_meta_data.
CREATE POLICY store_memberships_self_select ON public.store_memberships
 FOR SELECT TO authenticated
 USING(user_id=(select auth.uid()) AND active);
CREATE POLICY stores_assigned_member_select ON public.stores
 FOR SELECT TO authenticated
 USING(EXISTS (
   SELECT 1 FROM public.store_memberships sm
   JOIN public.tenant_memberships tm
     ON tm.tenant_id=sm.tenant_id AND tm.user_id=sm.user_id AND tm.active
   WHERE sm.tenant_id=stores.tenant_id AND sm.store_id=stores.id
     AND sm.user_id=(select auth.uid()) AND sm.active
 ));

-- ==== PHASE 2 — Nullable expand, NO blind tenant→store backfill ====
-- Existing rows may belong to an ambiguous store: never infer from tenant alone.
-- VERIFY data snapshot; map each product/order record to a store with owner signoff.
ALTER TABLE public.products ADD COLUMN store_id uuid;
ALTER TABLE public.customers ADD COLUMN store_id uuid;
ALTER TABLE public.orders ADD COLUMN store_id uuid;
ALTER TABLE public.order_items ADD COLUMN store_id uuid;
ALTER TABLE public.conversations ADD COLUMN store_id uuid;
ALTER TABLE public.messages ADD COLUMN store_id uuid;

-- Create future composite identities (not yet store enforcement until NOT NULL).
ALTER TABLE public.products ADD CONSTRAINT product_store_identity UNIQUE(tenant_id,store_id,id);
ALTER TABLE public.customers ADD CONSTRAINT customer_store_identity UNIQUE(tenant_id,store_id,id);
ALTER TABLE public.orders ADD CONSTRAINT order_store_identity UNIQUE(tenant_id,store_id,id);
ALTER TABLE public.conversations ADD CONSTRAINT conversation_store_identity UNIQUE(tenant_id,store_id,id);

-- Run review-only verification queries before any FK/not-null transition:
-- SELECT COUNT(*) FILTER (WHERE store_id IS NULL) FROM public.products;
-- SELECT tenant_id,sku,COUNT(*) FROM public.products GROUP BY tenant_id,sku HAVING COUNT(*)>1;
-- Validate order item, order and product all belong to SAME tenant/store.

-- Backfill mapping is a separately authorized, auditable data-change operation.
-- Never use a default store_id for unknown rows; quarantine ambiguous records.

-- ==== PHASE 3 — Constrain relational integrity AFTER verified backfill ====
ALTER TABLE public.products ADD CONSTRAINT product_store_fk FOREIGN KEY(tenant_id,store_id)
 REFERENCES public.stores(tenant_id,id) NOT VALID;
ALTER TABLE public.orders ADD CONSTRAINT orders_store_fk FOREIGN KEY(tenant_id,store_id)
 REFERENCES public.stores(tenant_id,id) NOT VALID;
ALTER TABLE public.customers ADD CONSTRAINT customers_store_fk FOREIGN KEY(tenant_id,store_id)
 REFERENCES public.stores(tenant_id,id) NOT VALID;
ALTER TABLE public.conversations ADD CONSTRAINT conversations_store_fk FOREIGN KEY(tenant_id,store_id)
 REFERENCES public.stores(tenant_id,id) NOT VALID;
ALTER TABLE public.messages ADD CONSTRAINT messages_store_conversation_fk
 FOREIGN KEY(tenant_id,store_id,conversation_id)
 REFERENCES public.conversations(tenant_id,store_id,id) NOT VALID;
ALTER TABLE public.order_items ADD CONSTRAINT order_items_store_order_fk
 FOREIGN KEY(tenant_id,store_id,order_id)
 REFERENCES public.orders(tenant_id,store_id,id) NOT VALID;
ALTER TABLE public.order_items ADD CONSTRAINT order_items_store_product_fk
 FOREIGN KEY(tenant_id,store_id,product_id)
 REFERENCES public.products(tenant_id,store_id,id) NOT VALID;

-- Only after every row is mapped AND all FKs validated, mark all store_id NOT NULL.
-- Review all creation/update tooling first; otherwise workflow writes will fail.
-- Then replace tenant-wide products_tenant_id_sku_key with (tenant_id,store_id,sku).
-- Do not drop original tenant-SKU constraint until contract/integration tests pass.

-- ==== Knowledge schema prerequisite — MUST be separately approved ====
-- V14.1 proposal creates app_private.shop_knowledge_releases/items but is BLOCKED.
-- Only after that schema exists, add explicit revision to match the read-only adapter:
ALTER TABLE app_private.shop_knowledge_releases
 ADD COLUMN revision integer NOT NULL DEFAULT 1 CHECK(revision>=1);
-- Release and knowledge items must be bound by composite tenant/store FKs;
-- publication must be atomic CAS, with independent staff review and merchant signoff.
-- public.tenant_agent_configs currently tracks knowledge_version by TENANT+CHANNEL,
-- so store-scoped configuration requires a separate store-aware contract before rollout.

-- ==== PHASE 4 — Atomic RLS policy replacement (requires separate approval) ====
-- PostgreSQL PERMISSIVE policies combine with OR; simply adding store RLS
-- alongside existing tenant-wide read policy DOES NOT isolate stores.
-- Within an approved transaction, remove all old tenant-only SELECT policies,
-- create store-membership-only policies for all six Commerce tables and
-- revalidate both Shop A and Shop B sessions. Include all paths: products,
-- customers, orders, order_items, conversations, messages, RPCs, views, service role.
-- The code below is EXAMPLE ONLY for a scoped SELECT replacement on products:
--
-- DROP POLICY products_member_read ON public.products;
-- CREATE POLICY products_store_member_read ON public.products FOR SELECT
-- TO authenticated USING(
--   store_id IS NOT NULL AND EXISTS(
--     SELECT 1 FROM public.store_memberships sm
--     JOIN public.tenant_memberships tm
--       ON tm.tenant_id=sm.tenant_id AND tm.user_id=sm.user_id AND tm.active
--     WHERE sm.tenant_id=products.tenant_id AND sm.store_id=products.store_id
--       AND sm.user_id=(select auth.uid()) AND sm.active
--   )
-- );
--
-- Existing write privileges, service_role and SECURITY DEFINER functions
-- require separate execution-path audit. No automatic deployment.

COMMIT;
