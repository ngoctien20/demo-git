-- TIEN404 V20 Store Authority — EXPAND phase migration. STATUS: PROPOSED, DO NOT APPLY.
-- Written against the real hosted staging schema (catalog read 2026-11-21, 21 migrations,
-- latest 20261117074559). Approved target order: local replica -> tien404-restore-test
-- (after B-00 restore) -> staging. Each hosted step needs the owner's explicit approval.
--
-- Design (backward compatible with live writers):
--  * stores + store_memberships; exactly one default store per tenant ("main").
--  * store_id on the 6 Commerce tables, backfilled to the tenant's default store, NOT NULL,
--    then composite FKs (tenant_id,store_id) -> stores and same-store parent FKs.
--  * Legacy writers that do not know store_id (save_merchant_product, n8n service writers)
--    keep working: a BEFORE INSERT trigger fills store_id (child rows inherit the parent's
--    store, otherwise the tenant default). store_id/tenant_id are immutable after insert.
--  * UNIQUE(tenant_id,sku) is KEPT in this phase because save_merchant_product updates by
--    (tenant_id,sku). Per-store SKU (same SKU, different price per store) is the CONTRACT
--    phase, after writers become store-aware.
--  * RLS: tenant-level read policies are REPLACED by store-membership policies. Authority
--    comes from DB membership rows (store + tenant + active store), never JWT metadata.
--    Existing tenant members are mirrored into the default store with the same role, so
--    nobody loses access at cutover; new tenant members get NO store rights until granted.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

DO $pre$ BEGIN
 IF to_regclass('public.stores') IS NOT NULL OR to_regclass('public.store_memberships') IS NOT NULL THEN
  RAISE EXCEPTION 'T404_PRECHECK_STORE_TABLES_ALREADY_EXIST';
 END IF;
 IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND column_name='store_id') THEN
  RAISE EXCEPTION 'T404_PRECHECK_STORE_ID_ALREADY_EXISTS';
 END IF;
 IF to_regprocedure('auth.uid()') IS NULL OR to_regclass('auth.users') IS NULL THEN
  RAISE EXCEPTION 'T404_PRECHECK_AUTH_SCHEMA_MISSING';
 END IF;
 IF (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND policyname IN
   ('products_member_read','customers_manager_read','orders_manager_read',
    'order_items_manager_read','conversations_manager_read','messages_manager_read')) <> 6 THEN
  RAISE EXCEPTION 'T404_PRECHECK_BASELINE_POLICIES_DRIFTED';
 END IF;
END $pre$;

CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC, anon, authenticated;

-- 1. Store tables ---------------------------------------------------------------------
CREATE TABLE public.stores(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
 store_key text NOT NULL CHECK (store_key ~ '^[a-z][a-z0-9-]{1,62}$'),
 name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 150),
 is_default boolean NOT NULL DEFAULT false,
 active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT stores_tenant_id_id_key UNIQUE(tenant_id,id),
 CONSTRAINT stores_tenant_id_store_key_key UNIQUE(tenant_id,store_key)
);
CREATE UNIQUE INDEX stores_one_default_per_tenant ON public.stores(tenant_id) WHERE is_default;

CREATE TABLE public.store_memberships(
 tenant_id uuid NOT NULL,
 store_id uuid NOT NULL,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 role text NOT NULL CHECK (role IN ('owner','manager','staff')),
 active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,store_id,user_id),
 CONSTRAINT store_memberships_store_fk FOREIGN KEY(tenant_id,store_id)
  REFERENCES public.stores(tenant_id,id) ON DELETE RESTRICT,
 -- A Store member must be a member of the same tenant.
 CONSTRAINT store_memberships_tenant_member_fk FOREIGN KEY(tenant_id,user_id)
  REFERENCES public.tenant_memberships(tenant_id,user_id) ON DELETE RESTRICT
);
CREATE INDEX store_memberships_user_active_idx ON public.store_memberships(user_id,tenant_id,store_id) WHERE active;

-- Supabase default privileges grant ALL on new public tables to anon/authenticated: undo.
REVOKE ALL ON public.stores, public.store_memberships FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.stores, public.store_memberships TO authenticated;
GRANT ALL ON public.stores, public.store_memberships TO service_role;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores FORCE ROW LEVEL SECURITY;
ALTER TABLE public.store_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_memberships FORCE ROW LEVEL SECURITY;

-- 2. Default store per tenant + mirrored memberships ----------------------------------
INSERT INTO public.stores(tenant_id,store_key,name,is_default)
 SELECT t.id,'main','Cửa hàng chính',true FROM public.tenants t;
INSERT INTO public.store_memberships(tenant_id,store_id,user_id,role,active)
 SELECT m.tenant_id,s.id,m.user_id,m.role,m.active
 FROM public.tenant_memberships m
 JOIN public.stores s ON s.tenant_id=m.tenant_id AND s.is_default;

-- New tenants automatically get their default store (legacy onboarding keeps working).
CREATE FUNCTION app_private.t404_tenant_default_store() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
BEGIN
 INSERT INTO public.stores(tenant_id,store_key,name,is_default)
 VALUES (NEW.id,'main','Cửa hàng chính',true);
 RETURN NEW;
END $f$;
CREATE TRIGGER t404_tenant_default_store AFTER INSERT ON public.tenants
 FOR EACH ROW EXECUTE FUNCTION app_private.t404_tenant_default_store();

-- 3. store_id columns + backfill ------------------------------------------------------
ALTER TABLE public.products      ADD COLUMN store_id uuid;
ALTER TABLE public.customers     ADD COLUMN store_id uuid;
ALTER TABLE public.orders        ADD COLUMN store_id uuid;
ALTER TABLE public.order_items   ADD COLUMN store_id uuid;
ALTER TABLE public.conversations ADD COLUMN store_id uuid;
ALTER TABLE public.messages      ADD COLUMN store_id uuid;
UPDATE public.products x SET store_id=s.id FROM public.stores s WHERE s.tenant_id=x.tenant_id AND s.is_default;
UPDATE public.customers x SET store_id=s.id FROM public.stores s WHERE s.tenant_id=x.tenant_id AND s.is_default;
UPDATE public.orders x SET store_id=s.id FROM public.stores s WHERE s.tenant_id=x.tenant_id AND s.is_default;
UPDATE public.order_items x SET store_id=s.id FROM public.stores s WHERE s.tenant_id=x.tenant_id AND s.is_default;
UPDATE public.conversations x SET store_id=s.id FROM public.stores s WHERE s.tenant_id=x.tenant_id AND s.is_default;
UPDATE public.messages x SET store_id=s.id FROM public.stores s WHERE s.tenant_id=x.tenant_id AND s.is_default;

-- 4. Fill + immutability trigger (fires before NOT NULL / FK checks) -------------------
CREATE FUNCTION app_private.t404_store_scope_guard() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.store_id IS DISTINCT FROM OLD.store_id OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
   RAISE EXCEPTION 'store_scope_immutable' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
 END IF;
 IF NEW.store_id IS NULL THEN
  IF TG_TABLE_NAME='order_items' THEN
   SELECT o.store_id INTO NEW.store_id FROM public.orders o
    WHERE o.tenant_id=NEW.tenant_id AND o.id=NEW.order_id;
  ELSIF TG_TABLE_NAME='messages' THEN
   SELECT c.store_id INTO NEW.store_id FROM public.conversations c
    WHERE c.tenant_id=NEW.tenant_id AND c.id=NEW.conversation_id;
  ELSIF TG_TABLE_NAME='orders' THEN
   -- nested: plpgsql does not short-circuit record field access across tables
   IF NEW.customer_id IS NOT NULL THEN
    SELECT c.store_id INTO NEW.store_id FROM public.customers c
     WHERE c.tenant_id=NEW.tenant_id AND c.id=NEW.customer_id;
   END IF;
  END IF;
  IF NEW.store_id IS NULL THEN
   SELECT s.id INTO NEW.store_id FROM public.stores s
    WHERE s.tenant_id=NEW.tenant_id AND s.is_default;
  END IF;
  IF NEW.store_id IS NULL THEN
   RAISE EXCEPTION 'store_required' USING ERRCODE='23502';
  END IF;
 END IF;
 RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION app_private.t404_store_scope_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.t404_tenant_default_store() FROM PUBLIC, anon, authenticated;
DO $trg$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['products','customers','orders','order_items','conversations','messages'] LOOP
  EXECUTE format('CREATE TRIGGER t404_store_scope_guard BEFORE INSERT OR UPDATE OF store_id, tenant_id ON public.%I
    FOR EACH ROW EXECUTE FUNCTION app_private.t404_store_scope_guard()', t);
 END LOOP;
END $trg$;

-- 5. Constraints: NOT NULL before composite FKs (avoids MATCH SIMPLE null bypass) ------
DO $nn$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['products','customers','orders','order_items','conversations','messages'] LOOP
  EXECUTE format('ALTER TABLE public.%I ALTER COLUMN store_id SET NOT NULL', t);
  EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY(tenant_id,store_id)
    REFERENCES public.stores(tenant_id,id) ON DELETE RESTRICT', t, t||'_tenant_store_fk');
  EXECUTE format('CREATE INDEX %I ON public.%I(tenant_id,store_id)', t||'_tenant_store_idx', t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['products','customers','orders','conversations'] LOOP
  EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I UNIQUE(tenant_id,store_id,id)', t, t||'_tenant_store_id_key');
 END LOOP;
END $nn$;
ALTER TABLE public.orders ADD CONSTRAINT orders_customer_same_store_fk
 FOREIGN KEY(tenant_id,store_id,customer_id) REFERENCES public.customers(tenant_id,store_id,id) ON DELETE RESTRICT;
ALTER TABLE public.order_items ADD CONSTRAINT order_items_order_same_store_fk
 FOREIGN KEY(tenant_id,store_id,order_id) REFERENCES public.orders(tenant_id,store_id,id) ON DELETE RESTRICT;
ALTER TABLE public.order_items ADD CONSTRAINT order_items_product_same_store_fk
 FOREIGN KEY(tenant_id,store_id,product_id) REFERENCES public.products(tenant_id,store_id,id) ON DELETE RESTRICT;
ALTER TABLE public.messages ADD CONSTRAINT messages_conversation_same_store_fk
 FOREIGN KEY(tenant_id,store_id,conversation_id) REFERENCES public.conversations(tenant_id,store_id,id) ON DELETE RESTRICT;
-- Expand phase: per-store SKU uniqueness added; tenant-level SKU uniqueness kept (see header).
ALTER TABLE public.products ADD CONSTRAINT products_tenant_store_sku_key UNIQUE(tenant_id,store_id,sku);

-- 6. RLS: replace tenant-level read policies with Store authority ---------------------
CREATE POLICY store_memberships_self_read ON public.store_memberships FOR SELECT TO authenticated
 USING (user_id=(SELECT auth.uid()) AND active);
CREATE POLICY stores_member_read ON public.stores FOR SELECT TO authenticated
 USING (active AND EXISTS (
  SELECT 1 FROM public.store_memberships sm
  JOIN public.tenant_memberships tm ON tm.tenant_id=sm.tenant_id AND tm.user_id=sm.user_id AND tm.active
  WHERE sm.tenant_id=stores.tenant_id AND sm.store_id=stores.id
    AND sm.user_id=(SELECT auth.uid()) AND sm.active));

DROP POLICY products_member_read ON public.products;
DROP POLICY customers_manager_read ON public.customers;
DROP POLICY orders_manager_read ON public.orders;
DROP POLICY order_items_manager_read ON public.order_items;
DROP POLICY conversations_manager_read ON public.conversations;
DROP POLICY messages_manager_read ON public.messages;
-- products: any active store member (staff included), same as old tenant semantics.
CREATE POLICY products_store_member_read ON public.products FOR SELECT TO authenticated
 USING (EXISTS (
  SELECT 1 FROM public.store_memberships sm
  JOIN public.stores s ON s.tenant_id=sm.tenant_id AND s.id=sm.store_id AND s.active
  JOIN public.tenant_memberships tm ON tm.tenant_id=sm.tenant_id AND tm.user_id=sm.user_id AND tm.active
  WHERE sm.tenant_id=products.tenant_id AND sm.store_id=products.store_id
    AND sm.user_id=(SELECT auth.uid()) AND sm.active));
-- customer/order/chat data: Store owner/manager only, same as old tenant semantics.
DO $pol$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['customers','orders','order_items','conversations','messages'] LOOP
  EXECUTE format($p$CREATE POLICY %I ON public.%I FOR SELECT TO authenticated
   USING (EXISTS (
    SELECT 1 FROM public.store_memberships sm
    JOIN public.stores s ON s.tenant_id=sm.tenant_id AND s.id=sm.store_id AND s.active
    JOIN public.tenant_memberships tm ON tm.tenant_id=sm.tenant_id AND tm.user_id=sm.user_id AND tm.active
    WHERE sm.tenant_id=%I.tenant_id AND sm.store_id=%I.store_id
      AND sm.user_id=(SELECT auth.uid()) AND sm.active
      AND sm.role IN ('owner','manager')))$p$, t||'_store_manager_read', t, t, t);
 END LOOP;
END $pol$;

-- 7. Postconditions -------------------------------------------------------------------
DO $post$ DECLARE bad int; BEGIN
 IF EXISTS (SELECT 1 FROM public.tenants t WHERE NOT EXISTS
   (SELECT 1 FROM public.stores s WHERE s.tenant_id=t.id AND s.is_default)) THEN
  RAISE EXCEPTION 'T404_POST_TENANT_WITHOUT_DEFAULT_STORE'; END IF;
 IF (SELECT count(*) FROM public.store_memberships) <> (SELECT count(*) FROM public.tenant_memberships) THEN
  RAISE EXCEPTION 'T404_POST_MEMBERSHIP_MIRROR_MISMATCH'; END IF;
 SELECT count(*) INTO bad FROM information_schema.role_table_grants
  WHERE table_schema='public' AND table_name IN ('stores','store_memberships')
    AND grantee IN ('anon','authenticated') AND privilege_type<>'SELECT';
 IF bad>0 OR has_table_privilege('anon','public.stores','SELECT') THEN
  RAISE EXCEPTION 'T404_POST_STORE_TABLE_GRANTS_TOO_WIDE'; END IF;
 IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND policyname IN
   ('products_member_read','customers_manager_read','orders_manager_read',
    'order_items_manager_read','conversations_manager_read','messages_manager_read')) THEN
  RAISE EXCEPTION 'T404_POST_TENANT_POLICY_STILL_PRESENT'; END IF;
 RAISE NOTICE 'T404_V20_STORE_AUTHORITY_EXPAND_OK';
END $post$;
COMMIT;
