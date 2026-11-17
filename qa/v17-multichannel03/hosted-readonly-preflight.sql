-- TIEN404 V17.MULTI-CHANNEL-03 HOSTED READ-ONLY METADATA PRE-FLIGHT
-- Only SELECT; returns aggregates without customer/user IDs or data values.
-- Do not substitute these results for real signed JWT, Store RLS or Meta owner proof.
-- Executed in staging via authorized Supabase connector read-only; no DDL.
with core as (
  select t.table_name,
    exists (select 1 from information_schema.columns c
      where c.table_schema='public' and c.table_name=t.table_name
        and c.column_name='store_id') as has_store_id,
    coalesce((select count(*) from pg_policies p
      where p.schemaname='public' and p.tablename=t.table_name
        and (coalesce(p.qual,'')||coalesce(p.with_check,'')) ilike '%store_id%'),0)
       as store_policy_count,
    exists(select 1 from pg_class cl join pg_namespace ns on ns.oid=cl.relnamespace
      where ns.nspname='public' and cl.relname=t.table_name and cl.relrowsecurity)
       as rls_enabled
  from (values ('products'),('orders'),('customers'),('order_items'),
               ('conversations'),('messages')) as t(table_name)
), active_member_pairs as (
  select tenant_id from public.tenant_memberships
  where active=true group by tenant_id having count(distinct user_id)>1
), db_session_member_pairs as (
  select m.tenant_id from public.tenant_memberships m
  join auth.sessions s on s.user_id=m.user_id
    and (s.not_after is null or s.not_after>now())
  where m.active=true
  group by m.tenant_id having count(distinct m.user_id)>1
)
select
 (select count(*) from core) core_table_count,
 (select count(*) from core where has_store_id) core_with_store_column,
 (select count(*) from core where store_policy_count>0) core_with_store_policy,
 (select count(*) from core where rls_enabled) core_with_rls_enabled,
 (select count(distinct user_id) from public.tenant_memberships where active=true) active_member_users,
 (select count(*) from active_member_pairs) tenants_with_two_active_members,
 (select count(*) from db_session_member_pairs) tenants_with_two_members_having_db_session_rows,
 (select count(*) from auth.sessions where not_after is null or not_after>now()) db_session_rows_within_not_after,
 (select count(*) from information_schema.tables
    where table_schema='public' and table_name='stores') canonical_stores,
 (select count(*) from information_schema.tables
    where table_schema='public' and table_name='store_memberships') canonical_store_memberships,
 (select count(*) from information_schema.tables
    where table_schema='public' and table_name='commercial_staff_assignments') commercial_staff_registry;
