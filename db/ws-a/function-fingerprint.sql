-- TIEN404 WS-A function fingerprint (READ-ONLY). One row per function in public/app_private:
-- signature | SECURITY DEFINER | anon EXECUTE | authenticated EXECUTE | service_role EXECUTE | search_path pinned | md5(definition)
-- Used (1) to prove the repo SQL rebuilds the exact hosted function bodies (B-P0-08) and
-- (2) as an extra block for the backup/restore fingerprint (B-P0-07). Safe on hosted: SELECT only.
SELECT n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')'
  ||'|'||p.prosecdef
  ||'|'||has_function_privilege('anon',p.oid,'EXECUTE')
  ||'|'||has_function_privilege('authenticated',p.oid,'EXECUTE')
  ||'|'||has_function_privilege('service_role',p.oid,'EXECUTE')
  ||'|'||coalesce(p.proconfig @> ARRAY['search_path=""'],false)
  ||'|'||md5(pg_get_functiondef(p.oid)) AS fp
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname IN ('public','app_private') AND p.prokind='f'
ORDER BY 1;
