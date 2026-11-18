\set ON_ERROR_STOP on
DO $guard$ BEGIN
 IF current_database() <> 'tien404_v1836e_disposable' THEN RAISE EXCEPTION 'DISPOSABLE_NAME_MISMATCH'; END IF;
 IF current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999 THEN RAISE EXCEPTION 'NOT_POSTGRESQL_17'; END IF;
END $guard$;

CREATE EXTENSION pgtap;
CREATE SCHEMA auth;
CREATE SCHEMA app_private;
CREATE ROLE qa_authenticated NOLOGIN NOBYPASSRLS;
CREATE ROLE qa_order_command NOLOGIN NOBYPASSRLS;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $fn$
 SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid;
$fn$;

CREATE TABLE public.tenants(id uuid PRIMARY KEY);
CREATE TABLE public.tenant_memberships(
 tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 user_id uuid NOT NULL, role text NOT NULL CHECK(role IN('owner','manager','staff')),
 active boolean NOT NULL DEFAULT false,
 PRIMARY KEY(tenant_id,user_id)
);
CREATE TABLE public.stores(
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 slug text NOT NULL, status text NOT NULL CHECK(status IN('provisioning','active','suspended','archived')),
 UNIQUE(tenant_id,id), UNIQUE(tenant_id,slug)
);
CREATE TABLE public.store_memberships(
 tenant_id uuid NOT NULL, store_id uuid NOT NULL, user_id uuid NOT NULL,
 role text NOT NULL CHECK(role IN('store_owner','manager','staff')),
 status text NOT NULL CHECK(status IN('invited','active','suspended','revoked','expired')),
 expires_at timestamptz, revoked_at timestamptz,
 PRIMARY KEY(tenant_id,store_id,user_id),
 FOREIGN KEY(tenant_id,store_id) REFERENCES public.stores(tenant_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(tenant_id,user_id) REFERENCES public.tenant_memberships(tenant_id,user_id) ON DELETE RESTRICT
);
CREATE TABLE app_private.store_channel_installations(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,store_id uuid NOT NULL,
 provider text NOT NULL,external_account_id text NOT NULL,
 status text NOT NULL CHECK(status IN('pending','verified','suspended','revoked')),
 revoked_at timestamptz,
 UNIQUE(tenant_id,store_id,id),
 FOREIGN KEY(tenant_id,store_id) REFERENCES public.stores(tenant_id,id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX active_provider_account_one_store
 ON app_private.store_channel_installations(provider,external_account_id)
 WHERE status='verified' AND revoked_at IS NULL;
CREATE TABLE public.products(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,store_id uuid,sku text NOT NULL,
 price_vnd bigint NOT NULL CHECK(price_vnd>=0),stock bigint NOT NULL CHECK(stock>=0),
 UNIQUE(tenant_id,store_id,id),
 CONSTRAINT products_store_sku_key UNIQUE NULLS NOT DISTINCT(tenant_id,store_id,sku),
 FOREIGN KEY(tenant_id,store_id) REFERENCES public.stores(tenant_id,id) ON DELETE RESTRICT
);
CREATE TABLE public.customers(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,store_id uuid,display_name text NOT NULL,
 UNIQUE(tenant_id,store_id,id),
 FOREIGN KEY(tenant_id,store_id) REFERENCES public.stores(tenant_id,id) ON DELETE RESTRICT
);
CREATE TABLE public.orders(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,store_id uuid,customer_id uuid,
 status text NOT NULL DEFAULT 'pending',total_vnd bigint NOT NULL DEFAULT 0 CHECK(total_vnd>=0),
 UNIQUE(tenant_id,store_id,id),
 FOREIGN KEY(tenant_id,store_id) REFERENCES public.stores(tenant_id,id) ON DELETE RESTRICT,
 CONSTRAINT orders_customer_store_fk FOREIGN KEY(tenant_id,store_id,customer_id)
 REFERENCES public.customers(tenant_id,store_id,id) ON DELETE RESTRICT
);
CREATE TABLE public.order_items(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,store_id uuid,
 order_id uuid NOT NULL, product_id uuid NOT NULL,
 quantity integer NOT NULL CHECK(quantity>0), unit_price_vnd bigint NOT NULL CHECK(unit_price_vnd>=0),
 FOREIGN KEY(tenant_id,store_id) REFERENCES public.stores(tenant_id,id) ON DELETE RESTRICT,
 CONSTRAINT items_order_store_fk FOREIGN KEY(tenant_id,store_id,order_id)
 REFERENCES public.orders(tenant_id,store_id,id) ON DELETE RESTRICT,
 CONSTRAINT items_product_store_fk FOREIGN KEY(tenant_id,store_id,product_id)
 REFERENCES public.products(tenant_id,store_id,id) ON DELETE RESTRICT
);
CREATE TABLE public.conversations(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,store_id uuid,channel_installation_id uuid,
 external_reference text,
 UNIQUE(tenant_id,store_id,id),
 FOREIGN KEY(tenant_id,store_id) REFERENCES public.stores(tenant_id,id) ON DELETE RESTRICT,
 CONSTRAINT conversation_verified_installation_fk
 FOREIGN KEY(tenant_id,store_id,channel_installation_id)
 REFERENCES app_private.store_channel_installations(tenant_id,store_id,id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX conversation_external_scoped_unique
 ON public.conversations(tenant_id,store_id,channel_installation_id,external_reference)
 WHERE external_reference IS NOT NULL AND channel_installation_id IS NOT NULL;
CREATE TABLE public.messages(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,store_id uuid,conversation_id uuid NOT NULL,body text NOT NULL,
 FOREIGN KEY(tenant_id,store_id) REFERENCES public.stores(tenant_id,id) ON DELETE RESTRICT,
 CONSTRAINT messages_conversation_store_fk FOREIGN KEY(tenant_id,store_id,conversation_id)
 REFERENCES public.conversations(tenant_id,store_id,id) ON DELETE RESTRICT
);

CREATE FUNCTION app_private.has_store_role(tid uuid,sid uuid,allowed_roles text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
 SELECT auth.uid() IS NOT NULL AND tid IS NOT NULL AND sid IS NOT NULL
 AND EXISTS(
   SELECT 1 FROM public.store_memberships sm
   JOIN public.stores s ON s.id=sm.store_id AND s.tenant_id=sm.tenant_id
   JOIN public.tenant_memberships tm ON tm.tenant_id=sm.tenant_id AND tm.user_id=sm.user_id
   WHERE sm.tenant_id=tid AND sm.store_id=sid AND sm.user_id=auth.uid()
     AND sm.role=ANY(allowed_roles) AND sm.status='active'
     AND sm.revoked_at IS NULL AND (sm.expires_at IS NULL OR sm.expires_at>now())
     AND s.status='active' AND tm.active
 );
$fn$;
REVOKE ALL ON FUNCTION app_private.has_store_role(uuid,uuid,text[]) FROM PUBLIC;
GRANT USAGE ON SCHEMA public,auth,app_private TO qa_authenticated,qa_order_command;
GRANT EXECUTE ON FUNCTION auth.uid() TO qa_authenticated,qa_order_command;
GRANT EXECUTE ON FUNCTION app_private.has_store_role(uuid,uuid,text[]) TO qa_authenticated,qa_order_command;

CREATE FUNCTION app_private.reject_store_reassignment()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $fn$
BEGIN
 IF OLD.tenant_id IS DISTINCT FROM NEW.tenant_id OR OLD.store_id IS DISTINCT FROM NEW.store_id THEN
   RAISE EXCEPTION 'STORE_SCOPE_IMMUTABLE' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END
$fn$;
DO $schema$
DECLARE tbl text;
BEGIN
 FOREACH tbl IN ARRAY ARRAY['products','customers','orders','order_items','conversations','messages'] LOOP
  EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION app_private.reject_store_reassignment()',tbl||'_scope_immutable',tbl);
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tbl);
 END LOOP;
END $schema$;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.store_channel_installations ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_self_read ON public.tenant_memberships FOR SELECT TO qa_authenticated
 USING (active AND user_id=auth.uid());
CREATE POLICY tenant_visible ON public.tenants FOR SELECT TO qa_authenticated
 USING (EXISTS(SELECT 1 FROM public.tenant_memberships tm
  WHERE tm.tenant_id=tenants.id AND tm.user_id=auth.uid() AND tm.active));
CREATE POLICY store_visible ON public.stores FOR SELECT TO qa_authenticated
 USING (app_private.has_store_role(tenant_id,id,ARRAY['store_owner','manager','staff'])
  OR EXISTS(SELECT 1 FROM public.tenant_memberships tm
   WHERE tm.tenant_id=stores.tenant_id AND tm.user_id=auth.uid() AND tm.role='owner' AND tm.active));
CREATE POLICY membership_self_read ON public.store_memberships FOR SELECT TO qa_authenticated
 USING (user_id=auth.uid() AND status='active' AND revoked_at IS NULL
   AND (expires_at IS NULL OR expires_at>now())
   AND app_private.has_store_role(tenant_id,store_id,ARRAY['store_owner','manager','staff']));
DO $policies$
DECLARE tbl text; roles text;
BEGIN
 FOREACH tbl IN ARRAY ARRAY['products','customers','orders','order_items','conversations','messages'] LOOP
  EXECUTE format(
   'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO qa_authenticated,qa_order_command
    USING (store_id IS NOT NULL AND app_private.has_store_role(tenant_id,store_id,ARRAY[''store_owner'',''manager'',''staff'']))
    WITH CHECK(store_id IS NOT NULL AND app_private.has_store_role(tenant_id,store_id,ARRAY[''store_owner'',''manager'',''staff'']))',
   tbl||'_store_boundary',tbl
  );
  IF tbl='customers' THEN roles:='''store_owner'',''manager''';
  ELSE roles:='''store_owner'',''manager'',''staff'''; END IF;
  EXECUTE format(
   'CREATE POLICY %I ON public.%I FOR SELECT TO qa_authenticated,qa_order_command
     USING(app_private.has_store_role(tenant_id,store_id,ARRAY[%s]))',
     tbl||'_role_read',tbl,roles);
 END LOOP;
END $policies$;
-- An intentionally overly broad extra permissive policy must NOT override Store RLS.
CREATE POLICY products_tenant_wide_legacy ON public.products FOR SELECT TO qa_authenticated
 USING (EXISTS(SELECT 1 FROM public.tenant_memberships tm
 WHERE tm.tenant_id=products.tenant_id AND tm.user_id=auth.uid() AND tm.active));
CREATE POLICY products_edit ON public.products FOR UPDATE TO qa_authenticated
 USING(app_private.has_store_role(tenant_id,store_id,ARRAY['store_owner','manager']))
 WITH CHECK(app_private.has_store_role(tenant_id,store_id,ARRAY['store_owner','manager']));
CREATE POLICY products_insert ON public.products FOR INSERT TO qa_authenticated
 WITH CHECK(app_private.has_store_role(tenant_id,store_id,ARRAY['store_owner','manager']));
CREATE POLICY customers_edit ON public.customers FOR UPDATE TO qa_authenticated
 USING(app_private.has_store_role(tenant_id,store_id,ARRAY['store_owner','manager']))
 WITH CHECK(app_private.has_store_role(tenant_id,store_id,ARRAY['store_owner','manager']));
CREATE POLICY orders_edit ON public.orders FOR UPDATE TO qa_authenticated
 USING(app_private.has_store_role(tenant_id,store_id,ARRAY['store_owner','manager']))
 WITH CHECK(app_private.has_store_role(tenant_id,store_id,ARRAY['store_owner','manager']));
CREATE POLICY orders_command_insert ON public.orders FOR INSERT TO qa_order_command
 WITH CHECK(app_private.has_store_role(tenant_id,store_id,ARRAY['store_owner','manager','staff']));
CREATE POLICY items_command_insert ON public.order_items FOR INSERT TO qa_order_command
 WITH CHECK(app_private.has_store_role(tenant_id,store_id,ARRAY['store_owner','manager','staff']));
REVOKE ALL ON ALL TABLES IN SCHEMA public,app_private FROM PUBLIC;
GRANT SELECT ON public.tenants,public.tenant_memberships,public.stores,public.store_memberships TO qa_authenticated;
GRANT SELECT ON public.products,public.customers,public.orders,public.order_items,public.conversations,public.messages TO qa_authenticated,qa_order_command;
GRANT INSERT,UPDATE ON public.products TO qa_authenticated;
GRANT UPDATE ON public.orders,public.customers TO qa_authenticated;
GRANT INSERT ON public.orders,public.order_items TO qa_order_command;

-- All fixtures are synthetic and inserted by the bootstrap owner before legacy NULL guards.
INSERT INTO public.tenants VALUES
('00000000-0000-0000-0000-000000000001'),
('00000000-0000-0000-0000-000000000002');
INSERT INTO public.tenant_memberships VALUES
('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000001001','owner',true),
('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000001002','staff',true),
('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000001003','staff',true),
('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000001004','manager',true),
('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000001005','staff',true),
('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000001006','staff',true),
('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000001007','staff',true),
('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000001008','staff',true),
('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000001009','owner',true);
INSERT INTO public.stores VALUES
('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000001','store-a','active'),
('00000000-0000-0000-0000-000000000102','00000000-0000-0000-0000-000000000001','store-b','active'),
('00000000-0000-0000-0000-000000000103','00000000-0000-0000-0000-000000000001','store-suspended','suspended'),
('00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000002','store-c','active');
INSERT INTO public.store_memberships(tenant_id,store_id,user_id,role,status,expires_at,revoked_at) VALUES
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000001002','store_owner','active',NULL,NULL),
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000102','00000000-0000-0000-0000-000000001003','store_owner','active',NULL,NULL),
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000001004','manager','active',NULL,NULL),
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000001005','staff','active',NULL,NULL),
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000001006','store_owner','active',NULL,NULL),
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000102','00000000-0000-0000-0000-000000001006','store_owner','active',NULL,NULL),
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000001007','staff','revoked',NULL,now()),
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000001008','staff','active',now()-interval '1 day',NULL),
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000103','00000000-0000-0000-0000-000000001002','store_owner','active',NULL,NULL),
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000001009','store_owner','active',NULL,NULL);
INSERT INTO app_private.store_channel_installations VALUES
('00000000-0000-0000-0000-000000003001','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101','messenger','QA_PAGE_A','verified',NULL),
('00000000-0000-0000-0000-000000003002','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000102','zalo_oa','QA_OA_B','verified',NULL),
('00000000-0000-0000-0000-000000003003','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000201','website','QA_WEB_C','verified',NULL);
INSERT INTO public.products VALUES
('00000000-0000-0000-0000-000000004001','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101','SKU-SHARED',159000,25),
('00000000-0000-0000-0000-000000004002','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000102','SKU-SHARED',169000,8),
('00000000-0000-0000-0000-000000004003','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000201','SKU-C',210000,12),
('00000000-0000-0000-0000-000000004004','00000000-0000-0000-0000-000000000001',NULL,'SKU-LEGACY',59000,1);
INSERT INTO public.customers VALUES
('00000000-0000-0000-0000-000000005001','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101','Fixture Customer A'),
('00000000-0000-0000-0000-000000005002','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000102','Fixture Customer B');
INSERT INTO public.orders VALUES
('00000000-0000-0000-0000-000000006001','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000005001','pending',159000),
('00000000-0000-0000-0000-000000006002','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000102','00000000-0000-0000-0000-000000005002','pending',169000),
('00000000-0000-0000-0000-000000006003','00000000-0000-0000-0000-000000000001',NULL,NULL,'pending',59000);
INSERT INTO public.order_items VALUES
('00000000-0000-0000-0000-000000007001','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000006001','00000000-0000-0000-0000-000000004001',1,159000),
('00000000-0000-0000-0000-000000007002','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000102','00000000-0000-0000-0000-000000006002','00000000-0000-0000-0000-000000004002',1,169000);
INSERT INTO public.conversations VALUES
('00000000-0000-0000-0000-000000008001','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000003001','QA-CONV-A'),
('00000000-0000-0000-0000-000000008002','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000102','00000000-0000-0000-0000-000000003002','QA-CONV-B');
INSERT INTO public.messages VALUES
('00000000-0000-0000-0000-000000009001','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000008001','Synthetic A'),
('00000000-0000-0000-0000-000000009002','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000102','00000000-0000-0000-0000-000000008002','Synthetic B');
DO $checks$ DECLARE tbl text; BEGIN
 FOREACH tbl IN ARRAY ARRAY['products','customers','orders','order_items','conversations','messages'] LOOP
 EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (store_id IS NOT NULL) NOT VALID',tbl,tbl||'_store_not_null_new_rows');
 END LOOP;
END $checks$;
ALTER TABLE public.conversations ADD CONSTRAINT conversations_install_required CHECK (channel_installation_id IS NOT NULL) NOT VALID;

SELECT 'V18_3_6E_PG17_DISPOSABLE_BOOTSTRAP_PASS' AS proof;