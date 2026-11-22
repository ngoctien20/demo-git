-- Xuất quyền (GRANT/REVOKE) chính xác của các schema ứng dụng thành một script SQL.
-- Chỉ đọc catalog. Chạy: psql -X -At -f export-grants.sql > grants.sql
-- Lý do: khi khôi phục vào dự án Supabase mới, default privileges của dự án mới tự cấp
-- quyền cho anon/authenticated/service_role, nên quyền phải được đặt lại cho khớp nguồn.
with app(s) as (values ('public'),('app_private'),('factory_private'),('tien404_r1_qa'),('tien404_v175_qa'),('tien404_dialogue_private')),
roles(r) as (select 'PUBLIC' union all select quote_ident(rolname) from pg_roles
             where rolname in ('anon','authenticated','service_role') or rolname like 'tien404\_%'),
revokees as (select string_agg(r, ', ') l from roles),
objs as (
  -- schema
  select 1 ord, n.nspname k, 'SCHEMA ' || quote_ident(n.nspname) obj, coalesce(n.nspacl, acldefault('n'::"char", n.nspowner)) acl
  from pg_namespace n where n.nspname in (select s from app)
  union all
  -- bảng, view, sequence
  select 2, n.nspname || '.' || c.relname,
         case c.relkind when 'S' then 'SEQUENCE ' else 'TABLE ' end || quote_ident(n.nspname) || '.' || quote_ident(c.relname),
         coalesce(c.relacl, acldefault((case c.relkind when 'S' then 's' else 'r' end)::"char", c.relowner))
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in (select s from app) and c.relkind in ('r','v','m','S','p','f')
  union all
  -- hàm
  select 3, n.nspname || '.' || p.proname, 'FUNCTION ' || p.oid::regprocedure::text,
         coalesce(p.proacl, acldefault('f'::"char", p.proowner))
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in (select s from app) and p.prokind in ('f','p')
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
)
select line from (
  select 0 ord, '' k, 0 sub, 'BEGIN;' line
  union all
  select o.ord, o.k, 1, 'REVOKE ALL ON ' || o.obj || ' FROM ' || (select l from revokees) || ';' from objs o
  union all
  select o.ord, o.k, 2, 'GRANT ' || x.privilege_type || ' ON ' || o.obj || ' TO '
         || case x.grantee when 0 then 'PUBLIC' else quote_ident(pg_get_userbyid(x.grantee)) end
         || case when x.is_grantable then ' WITH GRANT OPTION' else '' end || ';'
  from objs o, aclexplode(o.acl) x
  where x.grantee = 0 or pg_get_userbyid(x.grantee) in ('anon','authenticated','service_role','postgres') or pg_get_userbyid(x.grantee) like 'tien404\_%'
  union all
  select 9, '', 0, 'COMMIT;'
) z order by ord, k, sub, line;
