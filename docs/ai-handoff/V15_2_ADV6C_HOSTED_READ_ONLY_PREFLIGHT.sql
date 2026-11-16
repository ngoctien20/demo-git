-- TIEN404 V15.2-ADV.6C — HOSTED READ ONLY PREFLIGHT
-- NO DDL, DML, AUTH DATA, TOKEN/JWT, SECRET, CUSTOMER ROWS, OR EXPORT.
-- Metadata alone does not certify Store Owner A/B JWT/RLS.
-- Execute only as an authorized read-only operator against the intended
-- STAGING project. This script is a proposal and HAS NOT BEEN APPLIED.
-- Never run it as proof of authenticated JWT-based Store isolation.

-- A: exact required tables; flag missing Store objects explicitly.
select x.table_name,
       (to_regclass('public.'||x.table_name) is not null) as exists,
       c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as force_rls
from (values('tenants'),('tenant_memberships'),('stores'),
 ('store_memberships'),('products'),('orders'),('customers'))
 as x(table_name)
left join pg_class c on c.oid=to_regclass('public.'||x.table_name)
order by x.table_name;

-- B: Store columns on catalog/order/customer. Presence is necessary but
-- cannot prove FK integrity, correct historical attribution or RLS policy.
select x.table_name, count(c.column_name) filter
 (where c.column_name='store_id')=1 as has_store_id
from (values('products'),('orders'),('customers')) x(table_name)
left join information_schema.columns c
 on c.table_schema='public' and c.table_name=x.table_name
group by x.table_name order by x.table_name;

-- C: count the policy types / predicate presence; DO NOT display customer
-- rows. Read actual pg_policies separately for manually reviewed changes.
select tablename,cmd,count(*)::int policy_count,
 count(*) filter(where qual like '%store_id%')::int policies_mentioning_store
from pg_policies where schemaname='public'
 and tablename in ('products','orders','customers','store_memberships')
group by tablename,cmd order by 1,2;

-- D: executable definer privileges. Review caller dependency and code
-- in private authorized operator context before any REVOKE/ALTER.
select p.proname,p.prosecdef as security_definer,
 has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in
 ('qa_shop_b_zalo_claim','qa_owner_pairing','save_merchant_product')
order by p.proname;

-- E: role capability count, not role secrets or credentials.
select rolname,rolbypassrls,rolcanlogin
from pg_roles where rolname in ('anon','authenticated','service_role',
 'postgres','t404_action_claim_runtime')
order by rolname;

-- STOP HERE. Host JWT/RLS proof requires independently authorized real
-- owner sessions and existing verified Store fixtures via the pre-existing
-- V14.4.2 GET-only acceptance (not an SQL superuser impersonation test).
-- Backup authorization requires explicit one-time Controller decision and
-- independent restore evidence. Neither is proven by this SQL.
