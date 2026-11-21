-- Schema fingerprint of public (columns, constraints, policies, indexes, triggers, table ACLs
-- for anon/authenticated). Catalog-only, independent of the connecting role. No data read.
SET search_path TO public, pg_catalog;
SELECT md5(string_agg(x,'|' ORDER BY x)) AS fp, count(*) AS n FROM (
  SELECT 'c:'||c.relname||'.'||a.attname||':'||format_type(a.atttypid,a.atttypmod)||':'||a.attnotnull
   FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
   WHERE c.relnamespace='public'::regnamespace AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped
  UNION ALL SELECT 'k:'||conrelid::regclass||':'||conname||':'||pg_get_constraintdef(oid)
   FROM pg_constraint WHERE connamespace='public'::regnamespace
  UNION ALL SELECT 'p:'||polrelid::regclass||':'||polname||':'||polcmd::text||':'||coalesce(pg_get_expr(polqual,polrelid),'')
   FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE c.relnamespace='public'::regnamespace
  UNION ALL SELECT 'i:'||pg_get_indexdef(i.indexrelid)
   FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid WHERE c.relnamespace='public'::regnamespace
  UNION ALL SELECT 't:'||tgrelid::regclass||':'||tgname
   FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE NOT tgisinternal AND c.relnamespace='public'::regnamespace
  UNION ALL SELECT 'g:'||c.relname||':'||e.grantee::regrole||':'||e.privilege_type
   FROM pg_class c, aclexplode(c.relacl) e
   WHERE c.relnamespace='public'::regnamespace AND c.relkind='r'
     AND e.grantee IN ('anon'::regrole,'authenticated'::regrole)
) s(x);
