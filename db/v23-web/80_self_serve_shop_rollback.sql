-- Rollback for 20_self_serve_shop.sql. Restores the V20 step-3 QA-only allow-list and drops register_shop.
-- Tenants already created stay (their owners keep read access) but can no longer write through the
-- V20 admin RPCs. Drops app_private.self_serve_tenants only when empty; otherwise keeps it.
\set ON_ERROR_STOP on
BEGIN;
DROP FUNCTION IF EXISTS public.register_shop(text,text);
CREATE OR REPLACE FUNCTION app_private.t404_qa_tenant_allowed(p_tenant uuid) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $f$
 SELECT EXISTS (SELECT 1 FROM public.tenants t WHERE t.id=p_tenant
  AND ((t.id='9c8c524c-88db-4771-8ab0-a4316298494c'::uuid AND t.slug='qa-staging-shop-a-20261110')
    OR (t.id='4b12fc28-4fc3-4b06-bbf1-72a1f62ad5c5'::uuid AND t.slug='qa-staging-shop-b-20261110')))
$f$;
REVOKE ALL ON FUNCTION app_private.t404_qa_tenant_allowed(uuid) FROM PUBLIC, anon, authenticated;
DO $d$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM app_private.self_serve_tenants) THEN DROP TABLE app_private.self_serve_tenants;
 ELSE RAISE NOTICE 'T404_V23_ROLLBACK_KEPT_SELF_SERVE_TABLE (rows exist)'; END IF;
END $d$;
COMMIT;
