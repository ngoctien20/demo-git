-- Dấu vân tay chỉ-đọc của database: chỉ in số đếm và mã băm, KHÔNG in dữ liệu.
-- Chạy trên staging và trên dự án thử, rồi so sánh hai kết quả.
\pset format unaligned
\pset tuples_only on
\pset fieldsep '|'
with app(s) as (values ('public'),('app_private'),('factory_private'),('tien404_r1_qa'),('tien404_v175_qa'),('tien404_dialogue_private')),
tbl as (
  select c.oid, n.nspname, c.relname, c.relrowsecurity, c.relforcerowsecurity
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where c.relkind = 'r' and n.nspname in (select s from app)
)
select 'table', nspname || '.' || relname,
       'rls=' || relrowsecurity || ',force=' || relforcerowsecurity
         || ',rows=' || (xpath('/row/c/text()', query_to_xml(format('select count(*) c from %I.%I', nspname, relname), false, true, '')))[1]::text
         || ',md5=' || coalesce((xpath('/row/c/text()', query_to_xml(format('select md5(string_agg(t::text, ''|'' order by t::text)) c from %I.%I t', nspname, relname), false, true, '')))[1]::text, 'empty')
         || ',cols=' || (select md5(string_agg(a.attname || ':' || format_type(a.atttypid, a.atttypmod) || ':' || a.attnotnull, ',' order by a.attnum)) from pg_attribute a where a.attrelid = tbl.oid and a.attnum > 0 and not a.attisdropped)
         || ',grants=' || coalesce((select md5(string_agg(coalesce(nullif(pg_get_userbyid(x.grantee), ''), 'PUBLIC') || ':' || x.privilege_type, ',' order by 1)) from pg_class c2, aclexplode(c2.relacl) x where c2.oid = tbl.oid), 'none')
from tbl
union all
select 'policy', schemaname || '.' || tablename || '.' || policyname,
       md5(permissive || cmd || roles::text || coalesce(qual, '') || coalesce(with_check, ''))
from pg_policies where schemaname in (select s from app)
union all
select 'function', n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
       md5(pg_get_functiondef(p.oid)) || ',secdef=' || p.prosecdef
         || ',exec=' || coalesce((select string_agg(coalesce(nullif(pg_get_userbyid(x.grantee), ''), 'PUBLIC'), ',' order by 1) from aclexplode(p.proacl) x), 'default')
from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in (select s from app)
union all
select 'view', schemaname || '.' || viewname, md5(definition) from pg_views where schemaname in (select s from app)
union all
select 'trigger', n.nspname || '.' || c.relname || '.' || t.tgname, md5(pg_get_triggerdef(t.oid))
from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
where not t.tgisinternal and n.nspname in (select s from app)
union all
select 'auth', 'users', 'rows=' || count(*) || ',md5=' || coalesce(md5(string_agg(id::text || email || coalesce(encrypted_password, ''), '|' order by id)), 'empty') from auth.users
union all
select 'auth', 'identities', 'rows=' || count(*) from auth.identities
union all
select 'role', rolname, 'login=' || rolcanlogin || ',inherit=' || rolinherit from pg_roles where rolname like 'tien404\_%'
order by 1, 2;
