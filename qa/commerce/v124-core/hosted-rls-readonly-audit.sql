-- TIEN404 AI V12.4R.3 — HOSTED RLS CHECKS, READ-ONLY ONLY.
-- Run each block using an authorized SQL editor role. Simulated request.jwt.claim.sub is not a JWT test.
-- Never run on user request or exposed HTTP. No ALTER/GRANT/CREATE, no customer PII output.
-- Block A: snapshot all relevant policies and database privilege boundaries
SELECT n.nspname AS schema_name,c.relname AS table_name,c.relrowsecurity AS rls_enabled,
 c.relforcerowsecurity AS force_rls,
 has_table_privilege('anon',c.oid,'SELECT') AS anon_select,
 has_table_privilege('authenticated',c.oid,'SELECT') AS authenticated_select
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE (n.nspname='public' AND c.relname IN ('products','tenant_memberships'))
   OR (n.nspname='tien404_r1_qa' AND c.relname IN ('catalog','shop_bots'))
ORDER BY n.nspname,c.relname;

-- Block B: authenticated QA member of first tenant, then roll back
BEGIN READ ONLY;
SELECT set_config('request.jwt.claim.sub',(
  SELECT m.user_id::text FROM public.tenant_memberships m WHERE m.active AND
    m.tenant_id=(SELECT tenant_id FROM public.tenant_memberships WHERE active GROUP BY tenant_id ORDER BY tenant_id LIMIT 1)
  ORDER BY m.user_id LIMIT 1),true);
SELECT set_config('qa.expected_tenant',(
  SELECT m.tenant_id::text FROM public.tenant_memberships m WHERE m.user_id=current_setting('request.jwt.claim.sub')::uuid AND m.active LIMIT 1),true);
SET LOCAL ROLE authenticated;
SELECT current_user AS role_checked,count(*)::int AS visible_products,
  count(*) FILTER (WHERE tenant_id=current_setting('qa.expected_tenant')::uuid)::int AS own_products,
  count(*) FILTER (WHERE tenant_id<>current_setting('qa.expected_tenant')::uuid)::int AS cross_shop_products
FROM public.products;
ROLLBACK;

-- Block C: authenticated QA member of second DISTINCT tenant, then roll back
BEGIN READ ONLY;
SELECT set_config('request.jwt.claim.sub',(
  SELECT m.user_id::text FROM public.tenant_memberships m WHERE m.active AND
    m.tenant_id=(SELECT tenant_id FROM public.tenant_memberships WHERE active GROUP BY tenant_id ORDER BY tenant_id OFFSET 1 LIMIT 1)
  ORDER BY m.user_id LIMIT 1),true);
SELECT set_config('qa.expected_tenant',(
  SELECT m.tenant_id::text FROM public.tenant_memberships m WHERE m.user_id=current_setting('request.jwt.claim.sub')::uuid AND m.active LIMIT 1),true);
SET LOCAL ROLE authenticated;
SELECT current_user AS role_checked,count(*)::int AS visible_products,
  count(*) FILTER (WHERE tenant_id=current_setting('qa.expected_tenant')::uuid)::int AS own_products,
  count(*) FILTER (WHERE tenant_id<>current_setting('qa.expected_tenant')::uuid)::int AS cross_shop_products
FROM public.products;
ROLLBACK;

-- Block D: unknown user must fail closed, no private identifiers printed.
BEGIN READ ONLY;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
SET LOCAL ROLE authenticated;
SELECT count(*)::int AS unknown_user_visible_products FROM public.products;
ROLLBACK;

-- Block E: anon should lack SELECT; do not SELECT catalog rows.
BEGIN READ ONLY;
SET LOCAL ROLE anon;
SELECT has_table_privilege(current_user,'public.products'::regclass,'SELECT') AS anon_can_select_public,
  has_schema_privilege(current_user,'tien404_r1_qa','USAGE') AS anon_can_access_qa_schema;
ROLLBACK;

-- Customer backend gate: no dedicated tien404_customer_*_ro database role currently exists.
-- Do not GRANT these tables to authenticated, anon or service_role to make integration pass.
