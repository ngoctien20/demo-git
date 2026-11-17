-- V18.0-P0P: READ ONLY STAGING owner/session and canonical-store aggregate.
-- Never copy user UUID, JWT, session IDs, emails or raw customer/order data.
BEGIN TRANSACTION READ ONLY;
WITH eligible AS (
 SELECT m.tenant_id,m.user_id,
  EXISTS(SELECT 1 FROM auth.sessions s WHERE s.user_id=m.user_id) AS any_session,
  EXISTS(SELECT 1 FROM auth.sessions s WHERE s.user_id=m.user_id
   AND (s.not_after IS NULL OR s.not_after>now())) AS candidate_session
 FROM public.tenant_memberships m
 JOIN auth.users u ON u.id=m.user_id
 WHERE m.active=true AND m.role='owner'
  AND u.confirmed_at IS NOT NULL AND u.deleted_at IS NULL
  AND NOT COALESCE(u.is_anonymous,false)
  AND (u.banned_until IS NULL OR u.banned_until<now())
), per_tenant AS (
 SELECT tenant_id,count(distinct user_id) owners,
  count(*) FILTER(WHERE any_session) any_session_owners,
  count(*) FILTER(WHERE candidate_session) candidate_session_owners
 FROM eligible GROUP BY tenant_id
)
SELECT owners,any_session_owners,candidate_session_owners,
 count(*) AS tenant_count FROM per_tenant GROUP BY 1,2,3 ORDER BY owners DESC;
SELECT
 (SELECT count(*) FROM information_schema.tables WHERE table_schema='public'
  AND table_name IN ('stores','store_memberships')) AS canonical_tables,
 (SELECT count(*) FROM information_schema.columns WHERE table_schema='public'
  AND table_name IN ('products','orders','order_items','customers','conversations','messages','tenant_memberships')
  AND column_name='store_id') AS store_columns,
 (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname IN
  ('products','orders','order_items','customers','conversations','messages','tenant_memberships')
  AND c.relrowsecurity AND c.relforcerowsecurity) AS rls_force_core_count;
COMMIT;
