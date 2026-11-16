-- TIEN404 V15.0-10 :: READ-ONLY METADATA PREFLIGHT FOR SUPABASE STAGING
-- No DDL/DML, Auth mutation, impersonation, session-token reads or customer data.
-- SQL Editor output is NOT evidence of signed Auth JWT/PostgREST RLS.
WITH required(t) AS (
 VALUES ('stores'),('store_memberships'),('products'),('orders'),
        ('order_items'),('conversations'),('messages')
), scope(t) AS (
 VALUES ('products'),('orders'),('order_items'),('conversations'),('messages')
), tab AS (
 SELECT table_name FROM information_schema.tables WHERE table_schema='public'
), col AS (
 SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public'
), rels AS (
 SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind='r'
)
SELECT 'table:'||r.t AS check_id, EXISTS(SELECT 1 FROM tab WHERE table_name=r.t) AS ready FROM required r
UNION ALL
SELECT 'store_id:'||s.t,EXISTS(SELECT 1 FROM col WHERE table_name=s.t AND column_name='store_id') FROM scope s
UNION ALL
SELECT 'rls_force:'||s.t,COALESCE((SELECT relrowsecurity AND relforcerowsecurity FROM rels WHERE relname=s.t),false) FROM scope s
ORDER BY check_id;
SELECT tablename,policyname,permissive,roles,cmd
FROM pg_policies WHERE schemaname='public' AND tablename IN ('orders','products','order_items','stores','store_memberships')
ORDER BY tablename,policyname;
-- No SET ROLE or SET request.jwt.claim.sub: those cannot prove signed-JWT access.
