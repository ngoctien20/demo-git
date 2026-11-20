-- TIEN404 V19.8.9 — LOCAL SUPABASE CLI ONLY, NOT A HOSTED MIGRATION.
-- Workflow runs this against localhost:54322 after starting a brand-new
-- Supabase Auth + PostgREST + Postgres stack on an ephemeral GitHub runner.
-- Do not copy or apply this to Supabase hosted, shared staging or BIO.
\set ON_ERROR_STOP on
BEGIN;
CREATE TABLE public.t404_uat1989_tenants (
  tenant_id uuid PRIMARY KEY,
  label text NOT NULL UNIQUE
);
CREATE TABLE public.t404_uat1989_stores (
  tenant_id uuid NOT NULL REFERENCES public.t404_uat1989_tenants(tenant_id),
  store_code text NOT NULL CHECK (store_code IN ('A','B')),
  PRIMARY KEY(tenant_id,store_code)
);
CREATE TABLE public.t404_uat1989_memberships (
  tenant_id uuid NOT NULL,
  store_code text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  active boolean NOT NULL DEFAULT false,
  PRIMARY KEY(tenant_id,store_code,user_id),
  FOREIGN KEY(tenant_id,store_code)
    REFERENCES public.t404_uat1989_stores(tenant_id,store_code)
);
CREATE TABLE public.t404_uat1989_products (
  tenant_id uuid NOT NULL,
  store_code text NOT NULL,
  sku text NOT NULL,
  price_vnd bigint NOT NULL CHECK(price_vnd>0),
  stock_on_hand integer NOT NULL CHECK(stock_on_hand>=0),
  fixture_tag text NOT NULL CHECK(fixture_tag='V1989_SYNTHETIC_ONLY'),
  PRIMARY KEY(tenant_id,store_code,sku),
  FOREIGN KEY(tenant_id,store_code)
    REFERENCES public.t404_uat1989_stores(tenant_id,store_code)
);
CREATE TABLE public.t404_uat1989_orders (
  tenant_id uuid NOT NULL,
  store_code text NOT NULL,
  order_ref text NOT NULL,
  fixture_tag text NOT NULL CHECK(fixture_tag='V1989_SYNTHETIC_ONLY'),
  PRIMARY KEY(tenant_id,store_code,order_ref),
  FOREIGN KEY(tenant_id,store_code)
    REFERENCES public.t404_uat1989_stores(tenant_id,store_code)
);
CREATE TABLE public.t404_uat1989_conversations (
  tenant_id uuid NOT NULL,
  store_code text NOT NULL,
  conversation_ref text NOT NULL,
  fixture_tag text NOT NULL CHECK(fixture_tag='V1989_SYNTHETIC_ONLY'),
  PRIMARY KEY(tenant_id,store_code,conversation_ref),
  FOREIGN KEY(tenant_id,store_code)
    REFERENCES public.t404_uat1989_stores(tenant_id,store_code)
);

ALTER TABLE public.t404_uat1989_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t404_uat1989_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t404_uat1989_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t404_uat1989_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t404_uat1989_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE public.t404_uat1989_products FORCE ROW LEVEL SECURITY;
ALTER TABLE public.t404_uat1989_orders FORCE ROW LEVEL SECURITY;
ALTER TABLE public.t404_uat1989_conversations FORCE ROW LEVEL SECURITY;

CREATE POLICY v1989_self_membership_read ON public.t404_uat1989_memberships
 FOR SELECT TO authenticated
 USING(user_id=(select auth.uid()) AND active=true);

CREATE POLICY v1989_store_product_read ON public.t404_uat1989_products
 FOR SELECT TO authenticated
 USING(EXISTS(
   SELECT 1 FROM public.t404_uat1989_memberships m
   WHERE m.tenant_id=t404_uat1989_products.tenant_id
     AND m.store_code=t404_uat1989_products.store_code
     AND m.user_id=(select auth.uid()) AND m.active=true
 ));
CREATE POLICY v1989_store_order_read ON public.t404_uat1989_orders
 FOR SELECT TO authenticated
 USING(EXISTS(
   SELECT 1 FROM public.t404_uat1989_memberships m
   WHERE m.tenant_id=t404_uat1989_orders.tenant_id
     AND m.store_code=t404_uat1989_orders.store_code
     AND m.user_id=(select auth.uid()) AND m.active=true
 ));
CREATE POLICY v1989_store_conversation_read ON public.t404_uat1989_conversations
 FOR SELECT TO authenticated
 USING(EXISTS(
   SELECT 1 FROM public.t404_uat1989_memberships m
   WHERE m.tenant_id=t404_uat1989_conversations.tenant_id
     AND m.store_code=t404_uat1989_conversations.store_code
     AND m.user_id=(select auth.uid()) AND m.active=true
 ));

REVOKE ALL ON public.t404_uat1989_memberships,
 public.t404_uat1989_products,public.t404_uat1989_orders,
 public.t404_uat1989_conversations FROM anon,authenticated;
GRANT SELECT ON public.t404_uat1989_memberships,
 public.t404_uat1989_products,public.t404_uat1989_orders,
 public.t404_uat1989_conversations TO authenticated;

INSERT INTO public.t404_uat1989_tenants VALUES
 ('00000000-0000-0000-0000-000000000199','QA_ONE_TENANT_TWO_STORES');
INSERT INTO public.t404_uat1989_stores VALUES
 ('00000000-0000-0000-0000-000000000199','A'),
 ('00000000-0000-0000-0000-000000000199','B');
INSERT INTO public.t404_uat1989_products VALUES
 ('00000000-0000-0000-0000-000000000199','A','F01',159000,5,'V1989_SYNTHETIC_ONLY'),
 ('00000000-0000-0000-0000-000000000199','B','F01',189000,9,'V1989_SYNTHETIC_ONLY');
INSERT INTO public.t404_uat1989_orders VALUES
 ('00000000-0000-0000-0000-000000000199','A','V1989_A_01','V1989_SYNTHETIC_ONLY'),
 ('00000000-0000-0000-0000-000000000199','B','V1989_B_01','V1989_SYNTHETIC_ONLY');
INSERT INTO public.t404_uat1989_conversations VALUES
 ('00000000-0000-0000-0000-000000000199','A','V1989_A_01','V1989_SYNTHETIC_ONLY'),
 ('00000000-0000-0000-0000-000000000199','B','V1989_B_01','V1989_SYNTHETIC_ONLY');
COMMIT;