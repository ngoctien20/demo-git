-- TIEN404 V19.8.9 / LOCAL DOCKER SUPABASE ONLY.
-- NEVER apply to hosted Supabase or customer's schema.
-- Test fixtures: one tenant, Store A and Store B, no real merchant data.
BEGIN;
CREATE TABLE public.t404_v1989_tenants (
  tenant_id uuid PRIMARY KEY,
  code text NOT NULL UNIQUE CHECK(code='QA_TENANT_AB')
);
CREATE TABLE public.t404_v1989_stores (
  tenant_id uuid NOT NULL REFERENCES public.t404_v1989_tenants(tenant_id),
  store_code text NOT NULL CHECK(store_code IN ('A','B')),
  PRIMARY KEY(tenant_id,store_code)
);
CREATE TABLE public.t404_v1989_tenant_memberships (
  tenant_id uuid NOT NULL REFERENCES public.t404_v1989_tenants(tenant_id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  owner_active boolean NOT NULL DEFAULT false,
  PRIMARY KEY(tenant_id,user_id)
);
CREATE TABLE public.t404_v1989_store_memberships (
  tenant_id uuid NOT NULL,
  store_code text NOT NULL,
  user_id uuid NOT NULL,
  active boolean NOT NULL DEFAULT false,
  role text NOT NULL CHECK(role='owner'),
  PRIMARY KEY(tenant_id,store_code,user_id),
  FOREIGN KEY(tenant_id,store_code) REFERENCES public.t404_v1989_stores(tenant_id,store_code),
  FOREIGN KEY(tenant_id,user_id) REFERENCES public.t404_v1989_tenant_memberships(tenant_id,user_id)
);
CREATE TABLE public.t404_v1989_products (
  tenant_id uuid NOT NULL,store_code text NOT NULL,
  sku text NOT NULL,
  price_vnd bigint NOT NULL CHECK(price_vnd>0),
  stock_on_hand integer NOT NULL CHECK(stock_on_hand>=0),
  fixture_tag text NOT NULL CHECK(fixture_tag='SYNTHETIC_V1989'),
  PRIMARY KEY(tenant_id,store_code,sku),
  FOREIGN KEY(tenant_id,store_code) REFERENCES public.t404_v1989_stores(tenant_id,store_code)
);
CREATE TABLE public.t404_v1989_customers (
  tenant_id uuid NOT NULL,store_code text NOT NULL,customer_ref text NOT NULL,
  fixture_tag text NOT NULL CHECK(fixture_tag='SYNTHETIC_V1989'),
  PRIMARY KEY(tenant_id,store_code,customer_ref),
  FOREIGN KEY(tenant_id,store_code) REFERENCES public.t404_v1989_stores(tenant_id,store_code)
);
CREATE TABLE public.t404_v1989_orders (
  tenant_id uuid NOT NULL,store_code text NOT NULL,
  order_ref text NOT NULL,fixture_tag text NOT NULL CHECK(fixture_tag='SYNTHETIC_V1989'),
  PRIMARY KEY(tenant_id,store_code,order_ref),
  FOREIGN KEY(tenant_id,store_code) REFERENCES public.t404_v1989_stores(tenant_id,store_code)
);
CREATE TABLE public.t404_v1989_order_items (
  tenant_id uuid NOT NULL,store_code text NOT NULL,
  line_ref text NOT NULL,order_ref text NOT NULL,sku text NOT NULL,
  fixture_tag text NOT NULL CHECK(fixture_tag='SYNTHETIC_V1989'),
  PRIMARY KEY(tenant_id,store_code,line_ref),
  FOREIGN KEY(tenant_id,store_code,order_ref)
    REFERENCES public.t404_v1989_orders(tenant_id,store_code,order_ref),
  FOREIGN KEY(tenant_id,store_code,sku)
    REFERENCES public.t404_v1989_products(tenant_id,store_code,sku)
);
CREATE TABLE public.t404_v1989_conversations (
  tenant_id uuid NOT NULL,store_code text NOT NULL,conversation_ref text NOT NULL,
  fixture_tag text NOT NULL CHECK(fixture_tag='SYNTHETIC_V1989'),
  PRIMARY KEY(tenant_id,store_code,conversation_ref),
  FOREIGN KEY(tenant_id,store_code) REFERENCES public.t404_v1989_stores(tenant_id,store_code)
);
CREATE TABLE public.t404_v1989_messages (
  tenant_id uuid NOT NULL,store_code text NOT NULL,
  message_ref text NOT NULL,conversation_ref text NOT NULL,
  fixture_tag text NOT NULL CHECK(fixture_tag='SYNTHETIC_V1989'),
  PRIMARY KEY(tenant_id,store_code,message_ref),
  FOREIGN KEY(tenant_id,store_code,conversation_ref)
    REFERENCES public.t404_v1989_conversations(tenant_id,store_code,conversation_ref)
);
ALTER TABLE public.t404_v1989_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t404_v1989_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t404_v1989_tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t404_v1989_store_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t404_v1989_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t404_v1989_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t404_v1989_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t404_v1989_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t404_v1989_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t404_v1989_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t404_v1989_tenants FORCE ROW LEVEL SECURITY;
ALTER TABLE public.t404_v1989_stores FORCE ROW LEVEL SECURITY;
ALTER TABLE public.t404_v1989_tenant_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE public.t404_v1989_store_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE public.t404_v1989_products FORCE ROW LEVEL SECURITY;
ALTER TABLE public.t404_v1989_customers FORCE ROW LEVEL SECURITY;
ALTER TABLE public.t404_v1989_orders FORCE ROW LEVEL SECURITY;
ALTER TABLE public.t404_v1989_order_items FORCE ROW LEVEL SECURITY;
ALTER TABLE public.t404_v1989_conversations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.t404_v1989_messages FORCE ROW LEVEL SECURITY;
CREATE POLICY v1989_own_tenant_membership ON public.t404_v1989_tenant_memberships
 FOR SELECT TO authenticated
 USING(user_id=(SELECT auth.uid()) AND owner_active=true);
CREATE POLICY v1989_own_store_membership ON public.t404_v1989_store_memberships
 FOR SELECT TO authenticated USING(
 user_id=(SELECT auth.uid()) AND active=true AND role='owner'
 AND EXISTS(SELECT 1 FROM public.t404_v1989_tenant_memberships tm
  WHERE tm.tenant_id=t404_v1989_store_memberships.tenant_id
    AND tm.user_id=(SELECT auth.uid()) AND tm.owner_active=true)
);
DO $policies$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['products','customers','orders','order_items','conversations','messages'] LOOP
  EXECUTE format(
    'CREATE POLICY v1989_store_read ON public.%I FOR SELECT TO authenticated USING (
      EXISTS(SELECT 1 FROM public.t404_v1989_store_memberships sm
       WHERE sm.tenant_id=%I.tenant_id AND sm.store_code=%I.store_code
         AND sm.user_id=(SELECT auth.uid()) AND sm.active=true AND sm.role=''owner'')
    )',
    't404_v1989_'||t,'t404_v1989_'||t,'t404_v1989_'||t
  );
 END LOOP;
END $policies$;
REVOKE ALL ON public.t404_v1989_tenants,public.t404_v1989_stores,
 public.t404_v1989_tenant_memberships,public.t404_v1989_store_memberships,
 public.t404_v1989_products,public.t404_v1989_customers,
 public.t404_v1989_orders,public.t404_v1989_order_items,
 public.t404_v1989_conversations,public.t404_v1989_messages
 FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.t404_v1989_tenant_memberships,
 public.t404_v1989_store_memberships,
 public.t404_v1989_products,public.t404_v1989_customers,
 public.t404_v1989_orders,public.t404_v1989_order_items,
 public.t404_v1989_conversations,public.t404_v1989_messages TO authenticated;
INSERT INTO public.t404_v1989_tenants VALUES
 ('00000000-0000-0000-0000-000000001989','QA_TENANT_AB');
INSERT INTO public.t404_v1989_stores VALUES
 ('00000000-0000-0000-0000-000000001989','A'),
 ('00000000-0000-0000-0000-000000001989','B');
INSERT INTO public.t404_v1989_products VALUES
 ('00000000-0000-0000-0000-000000001989','A','F01',159000,5,'SYNTHETIC_V1989'),
 ('00000000-0000-0000-0000-000000001989','B','F01',189000,9,'SYNTHETIC_V1989');
INSERT INTO public.t404_v1989_customers VALUES
 ('00000000-0000-0000-0000-000000001989','A','V1989_A_01','SYNTHETIC_V1989'),
 ('00000000-0000-0000-0000-000000001989','B','V1989_B_01','SYNTHETIC_V1989');
INSERT INTO public.t404_v1989_orders VALUES
 ('00000000-0000-0000-0000-000000001989','A','V1989_A_01','SYNTHETIC_V1989'),
 ('00000000-0000-0000-0000-000000001989','B','V1989_B_01','SYNTHETIC_V1989');
INSERT INTO public.t404_v1989_order_items VALUES
 ('00000000-0000-0000-0000-000000001989','A','V1989_A_01','V1989_A_01','F01','SYNTHETIC_V1989'),
 ('00000000-0000-0000-0000-000000001989','B','V1989_B_01','V1989_B_01','F01','SYNTHETIC_V1989');
INSERT INTO public.t404_v1989_conversations VALUES
 ('00000000-0000-0000-0000-000000001989','A','V1989_A_01','SYNTHETIC_V1989'),
 ('00000000-0000-0000-0000-000000001989','B','V1989_B_01','SYNTHETIC_V1989');
INSERT INTO public.t404_v1989_messages VALUES
 ('00000000-0000-0000-0000-000000001989','A','V1989_A_01','V1989_A_01','SYNTHETIC_V1989'),
 ('00000000-0000-0000-0000-000000001989','B','V1989_B_01','V1989_B_01','SYNTHETIC_V1989');
COMMIT;
