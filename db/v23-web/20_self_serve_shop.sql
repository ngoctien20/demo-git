-- TIEN404 V23 web — self-service shop registration. STATUS: PROPOSED (not applied anywhere).
-- REQUIRES V20 10 + 20 + 30 (qa/v20-store-authority, PR #482): uses app_private.t404_qa_tenant_allowed
-- and the default-store trigger on public.tenants.
--   public.register_shop(p_name, p_industry) -> tenant id
--     * caller must be signed in with a CONFIRMED email
--     * one self-service shop per user; global cap 50 new shops per hour
--     * creates tenant (+ default Store "main" via trigger), owner tenant membership and owner Store membership
--   app_private.t404_qa_tenant_allowed() now also admits self-service tenants, so the V20 admin RPCs
--   (create_store, set_store_member, save_merchant_product_in_store) work for them.
--   The live v1 writer save_merchant_product keeps its own inline QA allow-list (unchanged).
-- Rollback: 80_self_serve_shop_rollback.sql
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $pre$ BEGIN
 IF to_regprocedure('public.create_store(uuid,text,text)') IS NULL THEN RAISE EXCEPTION 'T404_V23_PRECHECK_V20_STEP3_MISSING'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='t404_tenant_default_store') THEN RAISE EXCEPTION 'T404_V23_PRECHECK_DEFAULT_STORE_TRIGGER_MISSING'; END IF;
 IF to_regprocedure('public.register_shop(text,text)') IS NOT NULL THEN RAISE EXCEPTION 'T404_V23_PRECHECK_ALREADY_APPLIED'; END IF;
END $pre$;

CREATE TABLE IF NOT EXISTS app_private.self_serve_tenants(
 tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE RESTRICT,
 created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS self_serve_tenants_one_per_user ON app_private.self_serve_tenants(created_by);
ALTER TABLE app_private.self_serve_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.self_serve_tenants FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.self_serve_tenants FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION app_private.t404_qa_tenant_allowed(p_tenant uuid) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $f$
 SELECT EXISTS (SELECT 1 FROM public.tenants t WHERE t.id=p_tenant
  AND ((t.id='9c8c524c-88db-4771-8ab0-a4316298494c'::uuid AND t.slug='qa-staging-shop-a-20261110')
    OR (t.id='4b12fc28-4fc3-4b06-bbf1-72a1f62ad5c5'::uuid AND t.slug='qa-staging-shop-b-20261110')))
 OR EXISTS (SELECT 1 FROM app_private.self_serve_tenants s WHERE s.tenant_id=p_tenant)
$f$;
REVOKE ALL ON FUNCTION app_private.t404_qa_tenant_allowed(uuid) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.register_shop(p_name text, p_industry text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE actor uuid := auth.uid(); tid uuid; sid uuid; nm text := btrim(coalesce(p_name,''));
  ind text := coalesce(nullif(btrim(p_industry),''),'other');
BEGIN
 IF actor IS NULL OR NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id=actor AND u.email_confirmed_at IS NOT NULL) THEN
  RAISE EXCEPTION 'access_denied' USING ERRCODE='42501';
 END IF;
 IF length(nm) NOT BETWEEN 2 AND 150 OR length(ind) > 60 THEN
  RAISE EXCEPTION 'invalid_shop' USING ERRCODE='22023';
 END IF;
 IF EXISTS (SELECT 1 FROM app_private.self_serve_tenants s WHERE s.created_by=actor) THEN
  RAISE EXCEPTION 'shop_already_registered' USING ERRCODE='23505';
 END IF;
 IF (SELECT count(*) FROM app_private.self_serve_tenants s WHERE s.created_at > now() - interval '1 hour') >= 50 THEN
  RAISE EXCEPTION 'rate_limited' USING ERRCODE='P0001';
 END IF;
 INSERT INTO public.tenants(slug,name,industry)
  VALUES ('shop-' || substr(replace(gen_random_uuid()::text,'-',''),1,12), nm, ind)
  RETURNING id INTO tid;
 SELECT s.id INTO sid FROM public.stores s WHERE s.tenant_id=tid AND s.is_default;
 IF sid IS NULL THEN RAISE EXCEPTION 'default_store_missing'; END IF;
 UPDATE public.stores SET name=nm WHERE id=sid;
 INSERT INTO public.tenant_memberships(tenant_id,user_id,role,active) VALUES (tid,actor,'owner',true);
 INSERT INTO public.store_memberships(tenant_id,store_id,user_id,role,active) VALUES (tid,sid,actor,'owner',true);
 INSERT INTO app_private.self_serve_tenants(tenant_id,created_by) VALUES (tid,actor);
 INSERT INTO app_private.audit_events(tenant_id,actor_id,event_type,metadata)
  VALUES (tid,actor,'self_serve_register',jsonb_build_object('store_id',sid));
 RETURN tid;
END $f$;
REVOKE ALL ON FUNCTION public.register_shop(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_shop(text,text) TO authenticated;

DO $post$ BEGIN
 IF has_function_privilege('anon','public.register_shop(text,text)','EXECUTE') THEN RAISE EXCEPTION 'T404_V23_POST_ANON_CAN_REGISTER'; END IF;
 IF has_table_privilege('authenticated','public.tenants','INSERT') THEN RAISE EXCEPTION 'T404_V23_POST_DIRECT_TENANT_WRITE'; END IF;
 RAISE NOTICE 'T404_V23_SELF_SERVE_OK';
END $post$;
COMMIT;
