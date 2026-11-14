-- TIEN404 V12.4 — SANDBOX ONLY (Supabase tien404-staging).
-- Separate QA tables; never reference AI_SALES_DEMO Orders/Products or Commerce data.
-- Staging Tester must have current approved access and active "sheets" assignment.
CREATE TABLE IF NOT EXISTS public.tien404_qa_sandbox_products (
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  sku text NOT NULL CHECK (sku ~ '^[A-Z0-9_-]{2,24}$'),
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 140),
  unit_price bigint NOT NULL CHECK (unit_price BETWEEN 0 AND 1000000000),
  stock integer NOT NULL CHECK (stock BETWEEN 0 AND 1000000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id,sku)
);
CREATE TABLE IF NOT EXISTS public.tien404_qa_sandbox_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  sku text NOT NULL CHECK (sku ~ '^[A-Z0-9_-]{2,24}$'),
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 1000),
  unit_price bigint NOT NULL CHECK (unit_price BETWEEN 0 AND 1000000000),
  total bigint GENERATED ALWAYS AS (unit_price * quantity) STORED,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tien404_qa_sandbox_orders_owner_sku_status
 ON public.tien404_qa_sandbox_orders(owner_id,sku,status);

ALTER TABLE public.tien404_qa_sandbox_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tien404_qa_sandbox_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tien404_qa_sandbox_products FORCE ROW LEVEL SECURITY;
ALTER TABLE public.tien404_qa_sandbox_orders FORCE ROW LEVEL SECURITY;

CREATE POLICY qa_sandbox_products_read ON public.tien404_qa_sandbox_products
FOR SELECT TO authenticated USING (
 (owner_id=(SELECT auth.uid()) AND EXISTS (
  SELECT 1 FROM public.tien404_tester_access a
  JOIN public.tien404_tester_assignments t ON t.user_id=a.user_id AND t.module_id='sheets' AND t.active
  WHERE a.user_id=(SELECT auth.uid()) AND a.access_status='approved' AND a.expires_at>now()
 )) OR EXISTS (
  SELECT 1 FROM public.tien404_tester_staff s
  WHERE s.user_id=(SELECT auth.uid()) AND s.active AND s.staff_role IN ('super_admin','qa_manager')
 )
);
CREATE POLICY qa_sandbox_products_insert ON public.tien404_qa_sandbox_products
FOR INSERT TO authenticated WITH CHECK (
 owner_id=(SELECT auth.uid()) AND EXISTS (
  SELECT 1 FROM public.tien404_tester_access a
  JOIN public.tien404_tester_assignments t ON t.user_id=a.user_id AND t.module_id='sheets' AND t.active
  WHERE a.user_id=(SELECT auth.uid()) AND a.access_status='approved' AND a.expires_at>now()
 )
);
CREATE POLICY qa_sandbox_products_update ON public.tien404_qa_sandbox_products
FOR UPDATE TO authenticated USING (
 owner_id=(SELECT auth.uid()) AND EXISTS (
  SELECT 1 FROM public.tien404_tester_access a
  JOIN public.tien404_tester_assignments t ON t.user_id=a.user_id AND t.module_id='sheets' AND t.active
  WHERE a.user_id=(SELECT auth.uid()) AND a.access_status='approved' AND a.expires_at>now()
 )
) WITH CHECK (
 owner_id=(SELECT auth.uid()) AND EXISTS (
  SELECT 1 FROM public.tien404_tester_access a
  JOIN public.tien404_tester_assignments t ON t.user_id=a.user_id AND t.module_id='sheets' AND t.active
  WHERE a.user_id=(SELECT auth.uid()) AND a.access_status='approved' AND a.expires_at>now()
 )
);
CREATE POLICY qa_sandbox_orders_read ON public.tien404_qa_sandbox_orders
FOR SELECT TO authenticated USING (
 (owner_id=(SELECT auth.uid()) AND EXISTS (
  SELECT 1 FROM public.tien404_tester_access a
  JOIN public.tien404_tester_assignments t ON t.user_id=a.user_id AND t.module_id='sheets' AND t.active
  WHERE a.user_id=(SELECT auth.uid()) AND a.access_status='approved' AND a.expires_at>now()
 )) OR EXISTS (
  SELECT 1 FROM public.tien404_tester_staff s
  WHERE s.user_id=(SELECT auth.uid()) AND s.active AND s.staff_role IN ('super_admin','qa_manager')
 )
);
CREATE POLICY qa_sandbox_orders_insert ON public.tien404_qa_sandbox_orders
FOR INSERT TO authenticated WITH CHECK (
 owner_id=(SELECT auth.uid()) AND EXISTS (
  SELECT 1 FROM public.tien404_tester_access a
  JOIN public.tien404_tester_assignments t ON t.user_id=a.user_id AND t.module_id='sheets' AND t.active
  WHERE a.user_id=(SELECT auth.uid()) AND a.access_status='approved' AND a.expires_at>now()
 )
);
CREATE POLICY qa_sandbox_orders_update ON public.tien404_qa_sandbox_orders
FOR UPDATE TO authenticated USING (
 owner_id=(SELECT auth.uid()) AND EXISTS (
  SELECT 1 FROM public.tien404_tester_access a
  JOIN public.tien404_tester_assignments t ON t.user_id=a.user_id AND t.module_id='sheets' AND t.active
  WHERE a.user_id=(SELECT auth.uid()) AND a.access_status='approved' AND a.expires_at>now()
 )
) WITH CHECK (
 owner_id=(SELECT auth.uid()) AND EXISTS (
  SELECT 1 FROM public.tien404_tester_access a
  JOIN public.tien404_tester_assignments t ON t.user_id=a.user_id AND t.module_id='sheets' AND t.active
  WHERE a.user_id=(SELECT auth.uid()) AND a.access_status='approved' AND a.expires_at>now()
 )
);

-- Normal invoker functions: no privileged bypass, no public execute permissions.
CREATE OR REPLACE FUNCTION public.tien404_qa_sandbox_order_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog,public,pg_temp AS $body$
DECLARE
  v_stock integer; v_price bigint; v_reserved bigint; v_own_count bigint;
BEGIN
  IF NEW.owner_id IS DISTINCT FROM (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'QA_OWNER_MISMATCH';
  END IF;
  IF TG_OP='INSERT' THEN
    SELECT count(*) INTO v_own_count FROM public.tien404_qa_sandbox_orders WHERE owner_id=NEW.owner_id;
    IF v_own_count>=100 THEN RAISE EXCEPTION 'QA_MAX_ORDERS'; END IF;
  END IF;
  -- Row lock serializes concurrent reservations of one SKU within this test account.
  PERFORM 1 FROM public.tien404_qa_sandbox_products
   WHERE owner_id=NEW.owner_id AND sku=NEW.sku FOR UPDATE;
  SELECT stock,unit_price INTO v_stock,v_price
   FROM public.tien404_qa_sandbox_products WHERE owner_id=NEW.owner_id AND sku=NEW.sku;
  IF NOT FOUND THEN RAISE EXCEPTION 'QA_SKU_NOT_FOUND'; END IF;
  IF NEW.unit_price<>v_price THEN RAISE EXCEPTION 'QA_PRICE_MISMATCH'; END IF;
  IF NEW.status<>'cancelled' THEN
    IF TG_OP='UPDATE' THEN
      SELECT COALESCE(sum(quantity),0) INTO v_reserved
       FROM public.tien404_qa_sandbox_orders
       WHERE owner_id=NEW.owner_id AND sku=NEW.sku AND status<>'cancelled' AND id<>OLD.id;
    ELSE
      SELECT COALESCE(sum(quantity),0) INTO v_reserved
       FROM public.tien404_qa_sandbox_orders
       WHERE owner_id=NEW.owner_id AND sku=NEW.sku AND status<>'cancelled';
    END IF;
    IF v_reserved+NEW.quantity>v_stock THEN RAISE EXCEPTION 'QA_STOCK_LIMIT'; END IF;
  END IF;
  NEW.updated_at=now();
  RETURN NEW;
END
$body$;
CREATE OR REPLACE FUNCTION public.tien404_qa_sandbox_product_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog,public,pg_temp AS $body$
DECLARE v_reserved bigint; v_count bigint;
BEGIN
 IF NEW.owner_id IS DISTINCT FROM (SELECT auth.uid()) THEN RAISE EXCEPTION 'QA_OWNER_MISMATCH'; END IF;
 IF TG_OP='INSERT' THEN
  SELECT count(*) INTO v_count FROM public.tien404_qa_sandbox_products WHERE owner_id=NEW.owner_id;
  IF v_count>=100 THEN RAISE EXCEPTION 'QA_MAX_PRODUCTS'; END IF;
 ELSE
  SELECT COALESCE(sum(quantity),0) INTO v_reserved FROM public.tien404_qa_sandbox_orders
  WHERE owner_id=NEW.owner_id AND sku=NEW.sku AND status<>'cancelled';
  IF NEW.stock<v_reserved THEN RAISE EXCEPTION 'QA_RESERVED_STOCK'; END IF;
 END IF;
 NEW.updated_at=now();
 RETURN NEW;
END
$body$;
DROP TRIGGER IF EXISTS qa_order_guard ON public.tien404_qa_sandbox_orders;
CREATE TRIGGER qa_order_guard BEFORE INSERT OR UPDATE
 ON public.tien404_qa_sandbox_orders FOR EACH ROW EXECUTE FUNCTION public.tien404_qa_sandbox_order_guard();
DROP TRIGGER IF EXISTS qa_product_guard ON public.tien404_qa_sandbox_products;
CREATE TRIGGER qa_product_guard BEFORE INSERT OR UPDATE
 ON public.tien404_qa_sandbox_products FOR EACH ROW EXECUTE FUNCTION public.tien404_qa_sandbox_product_guard();
REVOKE ALL ON public.tien404_qa_sandbox_products FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.tien404_qa_sandbox_orders FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.tien404_qa_sandbox_products,public.tien404_qa_sandbox_orders TO authenticated;
GRANT INSERT (sku,name,unit_price,stock) ON public.tien404_qa_sandbox_products TO authenticated;
GRANT UPDATE (name,unit_price,stock) ON public.tien404_qa_sandbox_products TO authenticated;
GRANT INSERT (sku,quantity,unit_price,status) ON public.tien404_qa_sandbox_orders TO authenticated;
GRANT UPDATE (sku,quantity,unit_price,status) ON public.tien404_qa_sandbox_orders TO authenticated;
REVOKE ALL ON FUNCTION public.tien404_qa_sandbox_order_guard() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.tien404_qa_sandbox_product_guard() FROM PUBLIC,anon,authenticated;
-- No DELETE grants, no real Orders/Products references, no service-role browser usage.
