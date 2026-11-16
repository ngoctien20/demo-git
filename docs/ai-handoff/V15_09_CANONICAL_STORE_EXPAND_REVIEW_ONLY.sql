-- TIEN404 V15.0-09 — CANONICAL STORE EXPAND SQL (REVIEW-ONLY)
-- UNSAFE TO APPLY TO HOSTED DATABASE. This is NOT a runnable migration.
-- Evidence baseline: Supabase staging ifxlvrhyjhbzbrkdsida, PG17.11, 2026-11-16 JST.
-- Required: explicit owner approval + verified backup/restore + 4-row ownership proof,
-- actual authenticated JWT negative tests, full dependency review, rollout + rollback.
-- Critical: current tenant-wide SELECT policies remain in place after these DDLs;
-- adding store_id alone DOES NOT establish per-Store RLS isolation.
--
-- IMMUTABLE SAFETY GUARD. An engineer must produce a NEW reviewed migration
-- with the guard removed only after a separate approved deployment gate.
BEGIN;
DO $review_only$ BEGIN
  RAISE EXCEPTION 'V15.0-09 REVIEW ONLY: execution forbidden without owner-approved cutover';
END $review_only$;

-- PHASE 0: NOT IMPLEMENTED HERE — private snapshot, Auth owner evidence,
-- QA map reconciliation, existing subscription/notification/Order dependencies.
-- Do not auto-map the 2 Products or 2 Orders to a new default Store.

-- PHASE 1 (DESIGN): Add canonical child Store under existing Tenant.
CREATE TABLE public.stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  slug text NOT NULL CHECK (slug ~ '^[a-z][a-z0-9-]{2,62}$'),
  display_name text NOT NULL CHECK (length(btrim(display_name)) BETWEEN 2 AND 150),
  status text NOT NULL DEFAULT 'draft'
     CHECK (status IN ('draft','active','paused','revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stores_tenant_id_id_key UNIQUE(tenant_id,id),
  CONSTRAINT stores_tenant_slug_key UNIQUE(tenant_id,slug)
);
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores FORCE ROW LEVEL SECURITY;
-- Do NOT grant anon, PUBLIC, or authenticated write privileges.

-- Explicit Store membership, with parent Tenant membership as prerequisite.
CREATE TABLE public.store_memberships (
  tenant_id uuid NOT NULL,
  store_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('owner','manager','staff')),
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,store_id,user_id),
  FOREIGN KEY (tenant_id,store_id)
    REFERENCES public.stores(tenant_id,id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id,user_id)
    REFERENCES public.tenant_memberships(tenant_id,user_id) ON DELETE RESTRICT
);
ALTER TABLE public.store_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_memberships FORCE ROW LEVEL SECURITY;
-- Self-lookup only; tenant membership must also remain ACTIVE.
CREATE POLICY store_memberships_self_read ON public.store_memberships
 AS PERMISSIVE FOR SELECT TO authenticated
 USING (user_id=(SELECT auth.uid()) AND active AND EXISTS (
   SELECT 1 FROM public.tenant_memberships tm
   WHERE tm.tenant_id=store_memberships.tenant_id
   AND tm.user_id=(SELECT auth.uid()) AND tm.active
 ));
CREATE POLICY stores_explicit_member_read ON public.stores
 AS PERMISSIVE FOR SELECT TO authenticated
 USING (EXISTS (
   SELECT 1 FROM public.store_memberships sm
   WHERE sm.tenant_id=stores.tenant_id AND sm.store_id=stores.id
   AND sm.user_id=(SELECT auth.uid()) AND sm.active
 ));
CREATE INDEX store_memberships_user_active_idx
  ON public.store_memberships(user_id,tenant_id,store_id) WHERE active;

-- PHASE 2 (DESIGN): Add nullable columns ONLY. Existing rows remain unassigned.
-- 7 currently tenant-scoped entities need explicit per-Store assessment.
ALTER TABLE public.products ADD COLUMN store_id uuid;
ALTER TABLE public.customers ADD COLUMN store_id uuid;
ALTER TABLE public.orders ADD COLUMN store_id uuid;
ALTER TABLE public.order_items ADD COLUMN store_id uuid;
ALTER TABLE public.conversations ADD COLUMN store_id uuid;
ALTER TABLE public.messages ADD COLUMN store_id uuid;
ALTER TABLE public.tenant_agent_configs ADD COLUMN store_id uuid;

-- Composite Store ownership must be validated without inventing backfill values.
ALTER TABLE public.products ADD CONSTRAINT products_tenant_store_fk
 FOREIGN KEY (tenant_id,store_id) REFERENCES public.stores(tenant_id,id) NOT VALID;
ALTER TABLE public.customers ADD CONSTRAINT customers_tenant_store_fk
 FOREIGN KEY (tenant_id,store_id) REFERENCES public.stores(tenant_id,id) NOT VALID;
ALTER TABLE public.orders ADD CONSTRAINT orders_tenant_store_fk
 FOREIGN KEY (tenant_id,store_id) REFERENCES public.stores(tenant_id,id) NOT VALID;
ALTER TABLE public.order_items ADD CONSTRAINT order_items_tenant_store_fk
 FOREIGN KEY (tenant_id,store_id) REFERENCES public.stores(tenant_id,id) NOT VALID;
ALTER TABLE public.conversations ADD CONSTRAINT conversations_tenant_store_fk
 FOREIGN KEY (tenant_id,store_id) REFERENCES public.stores(tenant_id,id) NOT VALID;
ALTER TABLE public.messages ADD CONSTRAINT messages_tenant_store_fk
 FOREIGN KEY (tenant_id,store_id) REFERENCES public.stores(tenant_id,id) NOT VALID;
ALTER TABLE public.tenant_agent_configs ADD CONSTRAINT agent_configs_tenant_store_fk
 FOREIGN KEY (tenant_id,store_id) REFERENCES public.stores(tenant_id,id) NOT VALID;

-- PHASE 3: EXPLICITLY DEFERRED / NOT INCLUDED IN SQL
-- [ ] Prove canonical owner with auth.users -> tenant_memberships -> stores ->
--     store_memberships plus independently verified channel owner consent.
-- [ ] Independently attribute each legacy Product/Order before any backfill.
-- [ ] Add UNIQUE (tenant_id,store_id,id) on Products, Orders, Customers,
--     Conversations, then composite child FKs involving order_id, product_id,
--     customer_id and conversation_id; guard cross-Store references.
-- [ ] Update public.products SKU key from UNIQUE(tenant_id,sku) to
--     UNIQUE(tenant_id,store_id,sku) ONLY after dependent queries are migrated.
-- [ ] Review tenant_agent_configs PK/channel uniqueness for per-Store profiles.
-- [ ] Review app_private.order_idempotency (currently tenant_id/request_key)
--     and app_private.channel_secrets (tenant-scoped), plus outbox/replay.
-- [ ] Migration cutover: add RESTRICTIVE store-SELECT policy to ALL business tables;
--     do not use an OR policy that broadens existing tenant-wide access.
-- [ ] Explicitly validate null rows, FK constraints, policy grants and correct
--     auth.uid() / store_memberships before enabling application writes.
-- [ ] Test authenticated Shop A vs B same Tenant, Shop C separate Tenant,
--     revoked owner, anonymous request and service-role bypass cases.
-- [ ] Test read AND write/update/foreign key paths, with exact rollback.
-- [ ] Review existing SECURITY DEFINER RPC before modifying access or GRANT.
-- [ ] No production unlock until Owner UAT and security sign-off.

-- The SQL in this document is NEVER committed by execution.
ROLLBACK;
