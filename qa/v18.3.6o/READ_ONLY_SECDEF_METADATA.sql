-- V18.3.6O — SELECT-only staging metadata preview.
-- NEVER invoke pg_get_functiondef, retrieve prosrc/probin, select auth.sessions,
-- alter grants, create roles, enable extensions, or run privileged functions.
-- This is an EXACT identity + effective ACL snapshot, NOT code/body integrity.
SELECT n.nspname AS schema_name,
       p.proname AS function_name,
       pg_catalog.pg_get_function_identity_arguments(p.oid) AS identity_arguments,
       pg_catalog.pg_get_userbyid(p.proowner) AS owner_role,
       p.prosecdef AS security_definer,
       EXISTS (
         SELECT 1
         FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) AS cfg
         WHERE cfg LIKE 'search_path=%'
       ) AS search_path_configured,
       has_function_privilege('anon',p.oid,'EXECUTE') AS anon_exec,
       has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_exec,
       has_function_privilege('service_role',p.oid,'EXECUTE') AS service_role_exec,
       encode(
         digest(
           convert_to(
             n.nspname||'.'||p.proname||'('||
             pg_catalog.pg_get_function_identity_arguments(p.oid)||')',
             'UTF8'
           ),
           'sha256'
         ), 'hex'
       ) AS identity_sha256
FROM pg_catalog.pg_proc AS p
JOIN pg_catalog.pg_namespace AS n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.prosecdef
ORDER BY p.proname, p.oid;

-- Only effective privileges, no JWTs, tokens, session identifiers or rows.
SELECT current_setting('server_version') AS postgres_version,
       (SELECT count(*)
        FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n
          ON n.oid=c.relnamespace
        WHERE n.nspname='auth' AND c.relname='sessions'
          AND c.relkind IN ('r','p')) AS auth_sessions_relation_count,
       has_table_privilege('anon','auth.sessions','SELECT') AS anon_session_select,
       has_table_privilege('authenticated','auth.sessions','SELECT') AS authenticated_session_select,
       has_table_privilege('service_role','auth.sessions','SELECT') AS service_session_select,
       (SELECT count(*) FROM information_schema.tables
        WHERE table_schema='public' AND table_name IN ('stores','store_memberships')) AS canonical_store_tables;
