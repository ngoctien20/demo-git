-- TIEN404 data platform: REVIEW-ONLY SQL blueprint. NOT a deployed migration.
-- Run only after choosing a Supabase project and completing a staging backup.
-- Public tables expose SELECT to authenticated users with RLS; all writes are denied.
-- Admin/write transactions require an independently reviewed server implementation.
BEGIN;
CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z][a-z0-9-]{2,62}$'),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 2 AND 150),
  industry text NOT NULL DEFAULT 'other',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.tenant_memberships (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  role text NOT NULL CHECK (role IN ('owner','manager','staff')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id)
);
CREATE INDEX IF NOT EXISTS memberships_user_active_idx ON public.tenant_memberships(user_id, tenant_id) WHERE active;
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  sku text NOT NULL CHECK (length(btrim(sku)) BETWEEN 1 AND 80),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 250),
  price_vnd bigint NOT NULL CHECK (price_vnd BETWEEN 0 AND 1000000000000),
  stock_on_hand integer NOT NULL DEFAULT 0 CHECK (stock_on_hand >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, sku), UNIQUE (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS products_tenant_active_idx ON public.products(tenant_id, is_active);
CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  display_name text NOT NULL CHECK (length(btrim(display_name)) BETWEEN 1 AND 150),
  phone text,
  email text,
  consent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  CHECK (phone IS NULL OR length(phone) <= 30),
  CHECK (email IS NULL OR length(email) <= 254)
);
CREATE INDEX IF NOT EXISTS customers_tenant_idx ON public.customers(tenant_id);
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  customer_id uuid,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','paid','cancelled','refunded')),
  total_vnd bigint NOT NULL CHECK (total_vnd BETWEEN 0 AND 1000000000000000),
  order_source text NOT NULL DEFAULT 'manual' CHECK (order_source IN ('manual','web','messenger','zalo','line','api')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id,id),
  FOREIGN KEY (tenant_id, customer_id) REFERENCES public.customers(tenant_id, id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS orders_tenant_created_idx ON public.orders(tenant_id, created_at DESC);
CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  order_id uuid NOT NULL,
  product_id uuid NOT NULL,
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 10000),
  unit_price_vnd bigint NOT NULL CHECK (unit_price_vnd BETWEEN 0 AND 1000000000000),
  line_total_vnd bigint GENERATED ALWAYS AS (quantity::bigint * unit_price_vnd) STORED,
  FOREIGN KEY (tenant_id, order_id) REFERENCES public.orders(tenant_id,id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, product_id) REFERENCES public.products(tenant_id,id) ON DELETE RESTRICT,
  UNIQUE (order_id, product_id)
);
CREATE INDEX IF NOT EXISTS order_items_tenant_order_idx ON public.order_items(tenant_id,order_id);
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  channel text NOT NULL CHECK (channel IN ('web','messenger','zalo','line')),
  external_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id,id)
);
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  conversation_id uuid NOT NULL,
  sender text NOT NULL CHECK (sender IN ('customer','agent','human')),
  body text NOT NULL CHECK (char_length(body) <= 10000),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id,conversation_id) REFERENCES public.conversations(tenant_id,id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS messages_tenant_conversation_idx ON public.messages(tenant_id,conversation_id,created_at);

-- Server-only records; do not add app_private to the Data API exposed schemas.
CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS app_private.channel_secrets (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  platform text NOT NULL,
  external_account_ref text NOT NULL,
  secret_ref text NOT NULL CHECK (secret_ref ~ '^vault://[A-Za-z0-9/_-]{5,150}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id, platform), UNIQUE(platform,external_account_ref)
);
CREATE TABLE IF NOT EXISTS app_private.order_idempotency (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  request_key text NOT NULL CHECK (length(request_key) BETWEEN 8 AND 128),
  request_sha256 text NOT NULL CHECK (request_sha256 ~ '^[a-f0-9]{64}$'),
  order_id uuid REFERENCES public.orders(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,request_key)
);
CREATE TABLE IF NOT EXISTS app_private.audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id),
  actor_id uuid,
  event_type text NOT NULL,
  request_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Private records have no browser policies and are not exposed in Data API.
ALTER TABLE app_private.channel_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.order_idempotency ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.audit_events ENABLE ROW LEVEL SECURITY;

-- Every Data API table is closed by default; only scoped SELECT is granted.
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants FORCE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE public.products FORCE ROW LEVEL SECURITY;
ALTER TABLE public.customers FORCE ROW LEVEL SECURITY;
ALTER TABLE public.orders FORCE ROW LEVEL SECURITY;
ALTER TABLE public.order_items FORCE ROW LEVEL SECURITY;
ALTER TABLE public.conversations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.messages FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS memberships_self_read ON public.tenant_memberships;
CREATE POLICY memberships_self_read ON public.tenant_memberships FOR SELECT TO authenticated
  USING (user_id=(SELECT auth.uid()) AND active);
DROP POLICY IF EXISTS tenants_member_read ON public.tenants;
CREATE POLICY tenants_member_read ON public.tenants FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tenant_memberships m
    WHERE m.tenant_id=id AND m.user_id=(SELECT auth.uid()) AND m.active));
DROP POLICY IF EXISTS products_member_read ON public.products;
CREATE POLICY products_member_read ON public.products FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tenant_memberships m
    WHERE m.tenant_id=products.tenant_id AND m.user_id=(SELECT auth.uid()) AND m.active));
DROP POLICY IF EXISTS customers_manager_read ON public.customers;
CREATE POLICY customers_manager_read ON public.customers FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tenant_memberships m
    WHERE m.tenant_id=customers.tenant_id AND m.user_id=(SELECT auth.uid()) AND m.active AND m.role IN ('owner','manager')));
DROP POLICY IF EXISTS orders_manager_read ON public.orders;
CREATE POLICY orders_manager_read ON public.orders FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tenant_memberships m
    WHERE m.tenant_id=orders.tenant_id AND m.user_id=(SELECT auth.uid()) AND m.active AND m.role IN ('owner','manager')));
DROP POLICY IF EXISTS order_items_manager_read ON public.order_items;
CREATE POLICY order_items_manager_read ON public.order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tenant_memberships m
    WHERE m.tenant_id=order_items.tenant_id AND m.user_id=(SELECT auth.uid()) AND m.active AND m.role IN ('owner','manager')));
DROP POLICY IF EXISTS conversations_manager_read ON public.conversations;
CREATE POLICY conversations_manager_read ON public.conversations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tenant_memberships m
    WHERE m.tenant_id=conversations.tenant_id AND m.user_id=(SELECT auth.uid()) AND m.active AND m.role IN ('owner','manager')));
DROP POLICY IF EXISTS messages_manager_read ON public.messages;
CREATE POLICY messages_manager_read ON public.messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tenant_memberships m
    WHERE m.tenant_id=messages.tenant_id AND m.user_id=(SELECT auth.uid()) AND m.active AND m.role IN ('owner','manager')));

REVOKE ALL ON TABLE public.tenants,public.tenant_memberships,public.products,public.customers,
  public.orders,public.order_items,public.conversations,public.messages FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE public.tenants,public.tenant_memberships,public.products,public.customers,
  public.orders,public.order_items,public.conversations,public.messages TO authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA app_private FROM PUBLIC,anon,authenticated;
COMMIT;