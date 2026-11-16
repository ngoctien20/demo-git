-- TIEN404 V15.0-09B: EPHEMERAL PostgreSQL 17 RLS REHEARSAL ONLY.
-- Runs in GitHub Actions disposable postgres:17 service, NEVER Supabase hosted.
-- This script BUILDS SYNTHETIC DATABASE and uses an UNSIGNED simulated JWT claim.
-- It is NOT proof of a genuine Supabase Auth JWT or hosted RLS policy.
\set ON_ERROR_STOP on
CREATE ROLE qa_authenticated NOLOGIN;
CREATE ROLE qa_anon NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true),'')::uuid
$$;
GRANT USAGE ON SCHEMA auth TO qa_authenticated,qa_anon;
GRANT EXECUTE ON FUNCTION auth.uid() TO qa_authenticated,qa_anon;

CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE TABLE public.tenants(id uuid PRIMARY KEY);
CREATE TABLE public.tenant_memberships(
 tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 user_id uuid NOT NULL REFERENCES auth.users(id),
 role text NOT NULL CHECK(role IN ('owner','manager','staff')),
 active boolean NOT NULL DEFAULT false,
 PRIMARY KEY(tenant_id,user_id)
);
CREATE TABLE public.stores(
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 status text NOT NULL CHECK(status IN ('active','paused','revoked')),
 UNIQUE(tenant_id,id)
);
CREATE TABLE public.store_memberships(
 tenant_id uuid NOT NULL, store_id uuid NOT NULL, user_id uuid NOT NULL,
 role text NOT NULL CHECK(role IN ('owner','manager','staff')),
 active boolean NOT NULL DEFAULT false,
 PRIMARY KEY(tenant_id,store_id,user_id),
 FOREIGN KEY(tenant_id,store_id) REFERENCES public.stores(tenant_id,id),
 FOREIGN KEY(tenant_id,user_id) REFERENCES public.tenant_memberships(tenant_id,user_id)
);
CREATE TABLE public.products(
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL, store_id uuid NOT NULL,
 sku text NOT NULL,price_vnd bigint NOT NULL CHECK(price_vnd>=0),
 FOREIGN KEY(tenant_id,store_id) REFERENCES public.stores(tenant_id,id),
 UNIQUE(tenant_id,store_id,id),
 UNIQUE(tenant_id,store_id,sku)
);
CREATE TABLE public.orders(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,store_id uuid NOT NULL,
 total_vnd bigint NOT NULL CHECK(total_vnd>=0),
 FOREIGN KEY(tenant_id,store_id) REFERENCES public.stores(tenant_id,id),
 UNIQUE(tenant_id,store_id,id)
);
CREATE TABLE public.order_items(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,store_id uuid NOT NULL,
 order_id uuid NOT NULL,product_id uuid NOT NULL,
 FOREIGN KEY(tenant_id,store_id,order_id) REFERENCES public.orders(tenant_id,store_id,id),
 FOREIGN KEY(tenant_id,store_id,product_id) REFERENCES public.products(tenant_id,store_id,id)
);
INSERT INTO auth.users(id) VALUES
 ('00000000-0000-0000-0000-000000000011'),
 ('00000000-0000-0000-0000-000000000012'),
 ('00000000-0000-0000-0000-000000000013'),
 ('00000000-0000-0000-0000-000000000014');
INSERT INTO public.tenants VALUES
 ('10000000-0000-0000-0000-000000000001'),
 ('10000000-0000-0000-0000-000000000002');
INSERT INTO public.tenant_memberships VALUES
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000011','owner',true),
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000012','owner',true),
 ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000013','owner',true),
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000014','owner',true);
INSERT INTO public.stores VALUES
 ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','active'),
 ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','active'),
 ('20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002','active');
INSERT INTO public.store_memberships VALUES
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000011','owner',true),
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000012','owner',true),
 ('10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000013','owner',true),
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000014','owner',false);
INSERT INTO public.products VALUES
 ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','A002',159000),
 ('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','A002',209000),
 ('30000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000003','A002',259000);
INSERT INTO public.orders VALUES
 ('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',159000),
 ('40000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002',209000);
GRANT USAGE ON SCHEMA public TO qa_authenticated,qa_anon;
GRANT SELECT ON public.tenant_memberships,public.store_memberships,public.stores TO qa_authenticated;
GRANT SELECT,INSERT,UPDATE ON public.products TO qa_authenticated;
GRANT SELECT ON public.products TO qa_anon;

ALTER TABLE public.tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE public.store_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores FORCE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products FORCE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders FORCE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items FORCE ROW LEVEL SECURITY;

CREATE POLICY tm_self ON public.tenant_memberships FOR SELECT TO qa_authenticated
 USING (user_id=(SELECT auth.uid()) AND active);
CREATE POLICY sm_self ON public.store_memberships FOR SELECT TO qa_authenticated
 USING (user_id=(SELECT auth.uid()) AND active
 AND EXISTS (SELECT 1 FROM public.tenant_memberships tm
 WHERE tm.tenant_id=store_memberships.tenant_id AND tm.user_id=(SELECT auth.uid()) AND tm.active));
CREATE POLICY stores_member ON public.stores FOR SELECT TO qa_authenticated
 USING (status='active' AND EXISTS
 (SELECT 1 FROM public.store_memberships sm
 WHERE sm.tenant_id=stores.tenant_id AND sm.store_id=stores.id
 AND sm.user_id=(SELECT auth.uid()) AND sm.active));
-- Deliberately model EXISTING tenant-only SELECT problem, demonstrate A sees B too.
CREATE POLICY products_tenant_read ON public.products FOR SELECT TO qa_authenticated
 USING (EXISTS (SELECT 1 FROM public.tenant_memberships tm
 WHERE tm.tenant_id=products.tenant_id AND tm.user_id=(SELECT auth.uid()) AND tm.active));
SET ROLE qa_authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000011',false);
DO $$ BEGIN
 IF (SELECT count(*) FROM public.products)<>2 THEN
 RAISE EXCEPTION 'EXPECTED TENANT-ONLY EXPOSURE NOT REPRODUCED';
 END IF;
 RAISE NOTICE 'PASS baseline: tenant-wide SELECT permits both A and B rows in same tenant (DISALLOWED for production)';
END $$;
RESET ROLE;

-- Restrictive AND policy closes gap; all policies still require membership and active Store.
CREATE POLICY products_store_guard ON public.products AS RESTRICTIVE FOR SELECT TO qa_authenticated
 USING (store_id IS NOT NULL AND EXISTS
 (SELECT 1 FROM public.store_memberships sm JOIN public.stores s
 ON s.tenant_id=sm.tenant_id AND s.id=sm.store_id
 WHERE sm.tenant_id=products.tenant_id AND sm.store_id=products.store_id
 AND sm.user_id=(SELECT auth.uid()) AND sm.active AND s.status='active'));
CREATE POLICY products_insert_guard ON public.products FOR INSERT TO qa_authenticated
 WITH CHECK (store_id IS NOT NULL AND EXISTS (
 SELECT 1 FROM public.store_memberships sm JOIN public.stores s
 ON s.tenant_id=sm.tenant_id AND s.id=sm.store_id
 WHERE sm.tenant_id=products.tenant_id AND sm.store_id=products.store_id
 AND sm.user_id=(SELECT auth.uid()) AND sm.active AND s.status='active'));
CREATE POLICY products_update_guard ON public.products FOR UPDATE TO qa_authenticated
 USING (EXISTS (SELECT 1 FROM public.store_memberships sm
 WHERE sm.tenant_id=products.tenant_id AND sm.store_id=products.store_id
 AND sm.user_id=(SELECT auth.uid()) AND sm.active))
 WITH CHECK (EXISTS (SELECT 1 FROM public.store_memberships sm
 WHERE sm.tenant_id=products.tenant_id AND sm.store_id=products.store_id
 AND sm.user_id=(SELECT auth.uid()) AND sm.active));
-- Note: a real UPDATE guard must also match Store ACTIVE and subscription/revocation.

SET ROLE qa_authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000011',false);
DO $$ DECLARE n integer; denied boolean; BEGIN
 SELECT count(*) INTO n FROM public.products;
 IF n<>1 THEN RAISE EXCEPTION 'A must see exactly own product, saw %',n; END IF;
 SELECT count(*) INTO n FROM public.products WHERE store_id='20000000-0000-0000-0000-000000000002';
 IF n<>0 THEN RAISE EXCEPTION 'A can read B'; END IF;
 SELECT count(*) INTO n FROM public.products WHERE store_id='20000000-0000-0000-0000-000000000003';
 IF n<>0 THEN RAISE EXCEPTION 'A can read C'; END IF;
 denied:=false;
 BEGIN
 INSERT INTO public.products VALUES ('30000000-0000-0000-0000-000000000099',
 '10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','CROSS',1);
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'A cross-Store insert not blocked'; END IF;
 UPDATE public.products SET price_vnd=111 WHERE id='30000000-0000-0000-0000-000000000002';
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'A mutated B'; END IF;
 denied:=false;
 BEGIN
 UPDATE public.products SET store_id='20000000-0000-0000-0000-000000000002'
 WHERE id='30000000-0000-0000-0000-000000000001';
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'A can move own row into B'; END IF;
 RAISE NOTICE 'PASS A: read, insert, update cross-Store blocked';
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000012',false);
DO $$BEGIN
 IF (SELECT count(*) FROM public.products)<>1 THEN RAISE EXCEPTION 'B should see exactly B'; END IF;
 IF EXISTS(SELECT 1 FROM public.products WHERE price_vnd=159000) THEN RAISE EXCEPTION 'B saw A'; END IF;
END$$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000013',false);
DO $$BEGIN
 IF (SELECT count(*) FROM public.products)<>1 THEN RAISE EXCEPTION 'C should see exactly C'; END IF;
END$$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000014',false);
DO $$BEGIN IF (SELECT count(*) FROM public.products)<>0 THEN RAISE EXCEPTION 'inactive Store member saw records'; END IF; END$$;
SELECT set_config('request.jwt.claim.sub','',false);
DO $$BEGIN IF (SELECT count(*) FROM public.products)<>0 THEN RAISE EXCEPTION 'missing uid saw records'; END IF; END$$;
RESET ROLE;
SET ROLE qa_anon;
DO $$BEGIN IF (SELECT count(*) FROM public.products)<>0 THEN RAISE EXCEPTION 'anon role saw records'; END IF; END$$;
RESET ROLE;

-- Revoked membership and Store pause must deny data even with previous synthetic UID.
UPDATE public.store_memberships SET active=false WHERE user_id='00000000-0000-0000-0000-000000000011';
SET ROLE qa_authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000011',false);
DO $$BEGIN IF (SELECT count(*) FROM public.products)<>0 THEN RAISE EXCEPTION 'revoked membership leaked'; END IF; END$$;
RESET ROLE;
UPDATE public.store_memberships SET active=true WHERE user_id='00000000-0000-0000-0000-000000000011';
UPDATE public.stores SET status='paused' WHERE id='20000000-0000-0000-0000-000000000001';
SET ROLE qa_authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000011',false);
DO $$BEGIN IF (SELECT count(*) FROM public.products)<>0 THEN RAISE EXCEPTION 'paused shop leaked'; END IF; END$$;
RESET ROLE;
UPDATE public.stores SET status='active' WHERE id='20000000-0000-0000-0000-000000000001';

-- FK isolation: A Order + B Product (same Tenant) MUST fail.
DO $$ DECLARE denied boolean:=false; BEGIN
 BEGIN
 INSERT INTO public.order_items VALUES(
 '50000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',
 '20000000-0000-0000-0000-000000000001',
 '40000000-0000-0000-0000-000000000001',
 '30000000-0000-0000-0000-000000000002');
 EXCEPTION WHEN foreign_key_violation THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'cross-Store OrderItem FK violation not enforced'; END IF;
END $$;
DO $$DECLARE n integer; BEGIN
 SELECT count(*) INTO n FROM public.products WHERE sku='A002';
 IF n<>3 THEN RAISE EXCEPTION 'synthetic repeated per-Store SKU failed: %',n; END IF;
 RAISE NOTICE 'PASS 09B EPHEMERAL POSTGRES RLS: tenant-wide baseline reproduces risk, Store restrictive policy closes synthetic cross-Store access; no real JWT';
END $$;
