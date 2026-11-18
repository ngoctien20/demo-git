\set ON_ERROR_STOP on
\echo V18_3_6E_CREATE_FIXTURE_START
DO $guard$ BEGIN
 IF current_database()<>'tien404_v1836e_disposable' OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 THEN RAISE EXCEPTION 'NOT_DISPOSABLE_POSTGRESQL_17'; END IF;
END $guard$;
CREATE EXTENSION IF NOT EXISTS pgtap;
CREATE ROLE tien404_e_actor NOLOGIN NOBYPASSRLS NOSUPERUSER;
CREATE SCHEMA auth;
CREATE SCHEMA qa_private;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $fn$
 SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid
$fn$;
CREATE TABLE public.tenants(id uuid PRIMARY KEY);
CREATE TABLE public.tenant_memberships(
 tenant_id uuid NOT NULL REFERENCES public.tenants(id),user_id uuid NOT NULL,role text NOT NULL,
 active boolean NOT NULL DEFAULT false,PRIMARY KEY(tenant_id,user_id));
CREATE TABLE public.stores(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 status text NOT NULL CHECK(status IN ('provisioning','active','suspended','archived')),
 UNIQUE(tenant_id,id));
CREATE TABLE public.store_memberships(
 tenant_id uuid NOT NULL,store_id uuid NOT NULL,user_id uuid NOT NULL,
 role text NOT NULL CHECK(role IN ('store_owner','manager','staff')),
 status text NOT NULL CHECK(status IN ('active','invited','suspended','revoked','expired')),
 revoked_at timestamptz,expires_at timestamptz,
 PRIMARY KEY(tenant_id,store_id,user_id),
 FOREIGN KEY(tenant_id,store_id) REFERENCES public.stores(tenant_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(tenant_id,user_id) REFERENCES public.tenant_memberships(tenant_id,user_id) ON DELETE RESTRICT);
CREATE TABLE public.products(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,store_id uuid,
 sku text NOT NULL,price_vnd bigint NOT NULL CHECK(price_vnd>=0),stock_on_hand integer NOT NULL CHECK(stock_on_hand>=0),
 UNIQUE NULLS NOT DISTINCT(tenant_id,store_id,sku),
 UNIQUE(tenant_id,store_id,id),
 FOREIGN KEY(tenant_id,store_id) REFERENCES public.stores(tenant_id,id) ON DELETE RESTRICT);
CREATE TABLE public.customers(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,store_id uuid,
 display_name text NOT NULL,
 UNIQUE(tenant_id,store_id,id),
 FOREIGN KEY(tenant_id,store_id) REFERENCES public.stores(tenant_id,id) ON DELETE RESTRICT);
CREATE TABLE public.orders(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,store_id uuid,customer_id uuid,
 status text NOT NULL CHECK(status IN('pending','confirmed','cancelled','completed')),
 total_vnd bigint NOT NULL CHECK(total_vnd>=0),
 UNIQUE(tenant_id,store_id,id),
 FOREIGN KEY(tenant_id,store_id) REFERENCES public.stores(tenant_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(tenant_id,store_id,customer_id) REFERENCES public.customers(tenant_id,store_id,id) ON DELETE RESTRICT);
CREATE TABLE public.order_items(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,store_id uuid,order_id uuid NOT NULL,product_id uuid NOT NULL,
 quantity integer NOT NULL CHECK(quantity>0),unit_price_vnd bigint NOT NULL CHECK(unit_price_vnd>=0),
 FOREIGN KEY(tenant_id,store_id) REFERENCES public.stores(tenant_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(tenant_id,store_id,order_id) REFERENCES public.orders(tenant_id,store_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(tenant_id,store_id,product_id) REFERENCES public.products(tenant_id,store_id,id) ON DELETE RESTRICT);
CREATE TABLE public.conversations(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,store_id uuid,
 channel text NOT NULL,external_reference text,
 UNIQUE(tenant_id,store_id,id),
 FOREIGN KEY(tenant_id,store_id) REFERENCES public.stores(tenant_id,id) ON DELETE RESTRICT);
CREATE TABLE public.messages(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,store_id uuid,
 conversation_id uuid NOT NULL,sender text NOT NULL,body text NOT NULL,
 FOREIGN KEY(tenant_id,store_id) REFERENCES public.stores(tenant_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(tenant_id,store_id,conversation_id) REFERENCES public.conversations(tenant_id,store_id,id) ON DELETE RESTRICT);

-- Synthetic fixtures: Store A and Store B share Tenant T1; Store C belongs to T2.
INSERT INTO public.tenants VALUES
 ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');
INSERT INTO public.stores VALUES
 ('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000001','active'),
 ('00000000-0000-0000-0000-000000000102','00000000-0000-0000-0000-000000000001','active'),
 ('00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000002','active');
INSERT INTO public.tenant_memberships(tenant_id,user_id,role,active)
SELECT CASE WHEN n=10 THEN '00000000-0000-0000-0000-000000000002'::uuid ELSE '00000000-0000-0000-0000-000000000001'::uuid END,
 ('00000000-0000-0000-0000-'||lpad((1000+n)::text,12,'0'))::uuid,
 CASE WHEN n IN (3,4,7,8) THEN 'staff' WHEN n=5 THEN 'owner' ELSE 'manager' END,true
FROM generate_series(1,10) AS n;
INSERT INTO public.store_memberships(tenant_id,store_id,user_id,role,status,expires_at,revoked_at) VALUES
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000001001','store_owner','active',NULL,NULL),
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000102','00000000-0000-0000-0000-000000001002','store_owner','active',NULL,NULL),
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000001003','manager','active',NULL,NULL),
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000001004','staff','active',NULL,NULL),
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000001006','store_owner','active',NULL,NULL),
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000102','00000000-0000-0000-0000-000000001006','store_owner','active',NULL,NULL),
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000001007','staff','revoked',NULL,now()),
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000001008','staff','active',now()-interval '1 day',NULL),
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000001010','store_owner','active',NULL,NULL);
INSERT INTO public.products VALUES
 ('00000000-0000-0000-0000-000000002001','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101','COMMON',100,8),
 ('00000000-0000-0000-0000-000000002002','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000102','COMMON',250,10),
 ('00000000-0000-0000-0000-000000002003','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000201','COMMON',80,4),
 ('00000000-0000-0000-0000-000000002004','00000000-0000-0000-0000-000000000001',NULL,'QA-LEGACY',75,1);
INSERT INTO public.customers VALUES
 ('00000000-0000-0000-0000-000000003001','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101','synthetic-A'),
 ('00000000-0000-0000-0000-000000003002','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000102','synthetic-B');
INSERT INTO public.orders VALUES
 ('00000000-0000-0000-0000-000000004001','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000003001','pending',100),
 ('00000000-0000-0000-0000-000000004002','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000102','00000000-0000-0000-0000-000000003002','pending',250),
 ('00000000-0000-0000-0000-000000004003','00000000-0000-0000-0000-000000000001',NULL,NULL,'pending',75);
INSERT INTO public.order_items VALUES
 ('00000000-0000-0000-0000-000000005001','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000004001','00000000-0000-0000-0000-000000002001',1,100),
 ('00000000-0000-0000-0000-000000005002','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000102','00000000-0000-0000-0000-000000004002','00000000-0000-0000-0000-000000002002',1,250);
INSERT INTO public.conversations VALUES
 ('00000000-0000-0000-0000-000000006001','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101','messenger','fixture-A'),
 ('00000000-0000-0000-0000-000000006002','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000102','messenger','fixture-B');
INSERT INTO public.messages VALUES
 ('00000000-0000-0000-0000-000000007001','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000006001','staff','synthetic-A'),
 ('00000000-0000-0000-0000-000000007002','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000102','00000000-0000-0000-0000-000000006002','staff','synthetic-B');

-- PostgreSQL enforces NOT VALID CHECK on newly added or updated rows, leaving old fixtures for quarantine.
DO $build$ DECLARE tbl text; BEGIN
 FOREACH tbl IN ARRAY ARRAY['products','customers','orders','order_items','conversations','messages'] LOOP
   EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I CHECK(store_id IS NOT NULL) NOT VALID',tbl,tbl||'_new_store_required');
 END LOOP;
END $build$;

-- Restricted helper reads memberships under definer privileges to avoid recursive RLS.
CREATE FUNCTION qa_private.store_role(p_tenant uuid,p_store uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $fn$
 SELECT sm.role FROM public.store_memberships sm
 JOIN public.tenant_memberships tm ON tm.tenant_id=sm.tenant_id AND tm.user_id=sm.user_id AND tm.active
 JOIN public.stores s ON s.tenant_id=sm.tenant_id AND s.id=sm.store_id AND s.status='active'
 WHERE sm.tenant_id=p_tenant AND sm.store_id=p_store
   AND sm.user_id=auth.uid() AND auth.uid() IS NOT NULL
   AND sm.status='active' AND sm.revoked_at IS NULL
   AND (sm.expires_at IS NULL OR sm.expires_at>now())
 LIMIT 1
$fn$;

-- Strict immutable authority: even dual-Store members cannot relocate records.
CREATE FUNCTION qa_private.prevent_store_move() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $fn$
BEGIN
 IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR NEW.store_id IS DISTINCT FROM OLD.store_id THEN
  RAISE EXCEPTION 'IMMUTABLE_STORE_SCOPE' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $fn$;
DO $triggers$ DECLARE tbl text; BEGIN
 FOREACH tbl IN ARRAY ARRAY['products','customers','orders','order_items','conversations','messages'] LOOP
  EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION qa_private.prevent_store_move()',tbl||'_immutable_store_scope',tbl);
 END LOOP;
END $triggers$;

-- RLS: membership helper supplies the Store boundary; role-specific policies supply commands.
DO $policies$ DECLARE tbl text; BEGIN
 FOREACH tbl IN ARRAY ARRAY['products','customers','orders','order_items','conversations','messages'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tbl);
  EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO tien404_e_actor USING (store_id IS NOT NULL AND qa_private.store_role(tenant_id,store_id) IS NOT NULL) WITH CHECK (store_id IS NOT NULL AND qa_private.store_role(tenant_id,store_id) IS NOT NULL)',tbl||'_store_boundary',tbl);
 END LOOP;
END $policies$;
-- Deliberately overbroad legacy-style SELECT to exercise restrictive AND semantics.
CREATE POLICY legacy_products_tenant_wide ON public.products FOR SELECT TO tien404_e_actor USING (true);
CREATE POLICY products_role_insert ON public.products FOR INSERT TO tien404_e_actor WITH CHECK (qa_private.store_role(tenant_id,store_id) IN ('store_owner','manager'));
CREATE POLICY products_role_update ON public.products FOR UPDATE TO tien404_e_actor USING (qa_private.store_role(tenant_id,store_id) IN ('store_owner','manager')) WITH CHECK (qa_private.store_role(tenant_id,store_id) IN ('store_owner','manager'));
CREATE POLICY customers_role_select ON public.customers FOR SELECT TO tien404_e_actor USING (qa_private.store_role(tenant_id,store_id) IN ('store_owner','manager'));
CREATE POLICY customers_role_insert ON public.customers FOR INSERT TO tien404_e_actor WITH CHECK (qa_private.store_role(tenant_id,store_id) IN ('store_owner','manager'));
CREATE POLICY customers_role_update ON public.customers FOR UPDATE TO tien404_e_actor USING (qa_private.store_role(tenant_id,store_id) IN ('store_owner','manager')) WITH CHECK (qa_private.store_role(tenant_id,store_id) IN ('store_owner','manager'));
CREATE POLICY orders_role_select ON public.orders FOR SELECT TO tien404_e_actor USING (qa_private.store_role(tenant_id,store_id) IN ('store_owner','manager','staff'));
CREATE POLICY orders_role_insert ON public.orders FOR INSERT TO tien404_e_actor WITH CHECK (qa_private.store_role(tenant_id,store_id) IN ('store_owner','manager','staff'));
CREATE POLICY orders_role_update ON public.orders FOR UPDATE TO tien404_e_actor USING (qa_private.store_role(tenant_id,store_id) IN ('store_owner','manager')) WITH CHECK (qa_private.store_role(tenant_id,store_id) IN ('store_owner','manager'));
CREATE POLICY order_items_role_select ON public.order_items FOR SELECT TO tien404_e_actor USING (qa_private.store_role(tenant_id,store_id) IN ('store_owner','manager','staff'));
CREATE POLICY order_items_role_insert ON public.order_items FOR INSERT TO tien404_e_actor WITH CHECK (qa_private.store_role(tenant_id,store_id) IN ('store_owner','manager','staff'));
CREATE POLICY conversations_role_select ON public.conversations FOR SELECT TO tien404_e_actor USING (qa_private.store_role(tenant_id,store_id) IN ('store_owner','manager','staff'));
CREATE POLICY conversations_role_insert ON public.conversations FOR INSERT TO tien404_e_actor WITH CHECK (qa_private.store_role(tenant_id,store_id) IN ('store_owner','manager'));
CREATE POLICY messages_role_select ON public.messages FOR SELECT TO tien404_e_actor USING (qa_private.store_role(tenant_id,store_id) IN ('store_owner','manager','staff'));
CREATE POLICY messages_role_insert ON public.messages FOR INSERT TO tien404_e_actor WITH CHECK (qa_private.store_role(tenant_id,store_id) IN ('store_owner','manager'));

GRANT USAGE ON SCHEMA public,auth,qa_private TO tien404_e_actor;
GRANT EXECUTE ON FUNCTION auth.uid() TO tien404_e_actor;
REVOKE ALL ON FUNCTION qa_private.store_role(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION qa_private.store_role(uuid,uuid) TO tien404_e_actor;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.products,public.customers,public.orders,public.order_items,public.conversations,public.messages TO tien404_e_actor;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO tien404_e_actor;
-- The authenticated actor has no direct access to authority tables.
REVOKE ALL ON public.tenants,public.tenant_memberships,public.stores,public.store_memberships FROM tien404_e_actor;
\echo V18_3_6E_FIXTURE_CREATED
