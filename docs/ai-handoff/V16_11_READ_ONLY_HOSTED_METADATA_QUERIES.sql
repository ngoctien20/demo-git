-- TIEN404 V16.11 — READ-ONLY METADATA CATALOG (NO CUSTOMER ROWS)
-- SOURCE-ONLY REFERENCE. DO NOT RUN WITHOUT AN APPROVED READ-ONLY OPERATOR.
-- Never use this to prove signed JWT, business ownership or backup recovery.
BEGIN TRANSACTION READ ONLY;

SELECT current_database() AS database_name, current_setting('server_version') AS pg_version;

SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS force_rls
FROM pg_class c
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind IN ('r','p')
  AND c.relname IN ('tenants','tenant_memberships','stores','store_memberships',
                    'products','orders','customers')
ORDER BY c.relname;

SELECT table_name,column_name
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name IN ('stores','store_memberships','products','orders','customers')
  AND column_name IN ('id','tenant_id','store_id','customer_id','sku')
ORDER BY table_name,column_name;

SELECT tablename,policyname,cmd,roles::text,qual,with_check
FROM pg_policies
WHERE schemaname='public'
 AND tablename IN ('tenants','tenant_memberships','stores','store_memberships',
                    'products','orders','customers')
ORDER BY tablename,policyname;

SELECT c.conrelid::regclass::text AS relation_name,
       c.conname AS constraint_name, c.contype AS constraint_type,
       pg_get_constraintdef(c.oid) AS constraint_definition
FROM pg_constraint c
WHERE c.conrelid IN (
   'public.products'::regclass,'public.orders'::regclass,'public.customers'::regclass
)
 AND c.contype IN ('f','u')
ORDER BY relation_name,constraint_name;

SELECT p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS function_arguments,
       p.prosecdef AS security_definer,
       has_function_privilege('anon',p.oid,'EXECUTE') AS anon_can_execute,
       has_function_privilege('authenticated',p.oid,'EXECUTE') AS signed_in_can_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public'
 AND p.proname IN ('qa_shop_b_zalo_claim','qa_owner_pairing','save_merchant_product')
ORDER BY p.proname;

ROLLBACK;
