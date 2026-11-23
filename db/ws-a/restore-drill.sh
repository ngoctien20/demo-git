#!/usr/bin/env bash
# B-P0-07 (offline part) — dump/restore drill of the staging-equivalent stack on a DISPOSABLE local
# PostgreSQL (CI: postgres:17 service). Builds the stack + the negative-suite fixtures, pg_dumps it,
# restores into a brand-new database and requires an identical fingerprint: every table (rows md5, non-owner grants,
# RLS/force flags, column types, grants), every policy, every function (md5 of full definition incl.
# SET search_path, SECURITY DEFINER flag, owner, EXECUTE ACL) and every trigger. Then re-runs the
# negative suite's surface checks against the RESTORED copy. Never touches hosted databases.
# PG_DUMP / PSQL_RESTORE may be overridden (e.g. "docker exec -i <ctr> pg_dump") to match the server major.
PGDATABASE=t404_wsa_negative; source "$(dirname "$0")/lib.sh"
PG_DUMP="${PG_DUMP:-pg_dump}"; PSQL_RESTORE="${PSQL_RESTORE:-psql -h $PGHOST -p $PGPORT -U $PGUSER}"; T="${WSA_TMP:-/tmp}"; mkdir -p "$T"
bash "$WSA_DIR/secdef-negative-suite.sh" > "$T/neg.log" 2>&1 || { tail -5 "$T/neg.log"; echo FAIL_SOURCE_SUITE; exit 1; }
PASS=$((PASS+1)); echo "PASS_SOURCE_BUILT_AND_ATTACKED ($(tail -1 "$T/neg.log"))"
FP="WITH app(s) AS (VALUES ('public'),('app_private'),('auth')),
tbl AS (SELECT c.oid,n.nspname,c.relname,c.relrowsecurity,c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE c.relkind='r' AND n.nspname IN (SELECT s FROM app))
SELECT 'table|'||nspname||'.'||relname||'|rls='||relrowsecurity||',force='||relforcerowsecurity
  ||',rows='||(xpath('/row/c/text()',query_to_xml(format('select count(*) c from %I.%I',nspname,relname),false,true,'')))[1]::text
  ||',md5='||coalesce((xpath('/row/c/text()',query_to_xml(format('select md5(string_agg(t::text,''|'' order by t::text)) c from %I.%I t',nspname,relname),false,true,'')))[1]::text,'empty')
  ||',cols='||(SELECT md5(string_agg(a.attname||':'||format_type(a.atttypid,a.atttypmod)||':'||a.attnotnull,',' ORDER BY a.attnum)) FROM pg_attribute a WHERE a.attrelid=tbl.oid AND a.attnum>0 AND NOT a.attisdropped)
  ||',grants='||coalesce((SELECT md5(string_agg(coalesce(nullif(pg_get_userbyid(x.grantee),''),'PUBLIC')||':'||x.privilege_type,',' ORDER BY 1)) FROM pg_class c2, aclexplode(c2.relacl) x WHERE c2.oid=tbl.oid AND x.grantee<>c2.relowner),'none') FROM tbl
UNION ALL SELECT 'policy|'||schemaname||'.'||tablename||'.'||policyname||'|'||md5(permissive||cmd||roles::text||coalesce(qual,'')||coalesce(with_check,'')) FROM pg_policies WHERE schemaname IN (SELECT s FROM app)
UNION ALL SELECT 'function|'||n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')|'||md5(pg_get_functiondef(p.oid))
  ||',secdef='||p.prosecdef||',owner='||pg_get_userbyid(p.proowner)
  ||',exec='||coalesce((SELECT string_agg(coalesce(nullif(pg_get_userbyid(x.grantee),''),'PUBLIC'),',' ORDER BY 1) FROM aclexplode(p.proacl) x),'default')
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN (SELECT s FROM app)
UNION ALL SELECT 'trigger|'||n.nspname||'.'||c.relname||'.'||t.tgname||'|'||md5(pg_get_triggerdef(t.oid)) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE NOT t.tgisinternal AND n.nspname IN (SELECT s FROM app)
ORDER BY 1"
"${PSQL[@]}" -d "$PGDATABASE" -c "$FP" > "$T/fp_src.txt"
$PG_DUMP -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" --no-password -Fp > "$T/dump.sql" 2>"$T/dump.err" || { cat "$T/dump.err"; echo FAIL_DUMP; exit 1; }
PASS=$((PASS+1)); echo "PASS_DUMP bytes=$(wc -c < "$T/dump.sql") server=$("${PSQL[@]}" -d postgres -c 'show server_version')"
R=t404_wsa_restored
"${PSQL[@]}" -d postgres -c "DROP DATABASE IF EXISTS $R" -c "CREATE DATABASE $R" >/dev/null
$PSQL_RESTORE -X -q -v ON_ERROR_STOP=1 --single-transaction -d "$R" < "$T/dump.sql" > "$T/restore.log" 2>&1 || { grep -m5 ERROR "$T/restore.log"; echo FAIL_RESTORE; exit 1; }
PASS=$((PASS+1)); echo PASS_RESTORE_SINGLE_TRANSACTION
"${PSQL[@]}" -d "$R" -c "$FP" > "$T/fp_dst.txt"
echo "FINGERPRINT_LINES=$(wc -l < "$T/fp_src.txt") tables=$(grep -c '^table|' "$T/fp_src.txt") policies=$(grep -c '^policy|' "$T/fp_src.txt") functions=$(grep -c '^function|' "$T/fp_src.txt") triggers=$(grep -c '^trigger|' "$T/fp_src.txt")"
if diff -q "$T/fp_src.txt" "$T/fp_dst.txt" >/dev/null; then PASS=$((PASS+1)); echo PASS_FINGERPRINT_IDENTICAL_AFTER_RESTORE
else diff "$T/fp_src.txt" "$T/fp_dst.txt" | cut -c1-160 | head -20; echo FAIL_FINGERPRINT_DIFF; exit 1; fi
PGDATABASE=$R
ok "$(admin "SELECT string_agg(p.proname,',' ORDER BY p.proname) FROM pg_proc p WHERE p.pronamespace IN ('public'::regnamespace,'app_private'::regnamespace) AND p.prosecdef AND has_function_privilege('anon',p.oid,'EXECUTE')")" "get_channel_menu,submit_lead" RESTORED_ANON_SURFACE_UNCHANGED
deny RESTORED_B_WRITES_A access_denied as b0000000-0000-4000-8000-00000000000b "SELECT public.save_store_faq((SELECT id FROM public.stores WHERE tenant_id='9c8c524c-88db-4771-8ab0-a4316298494c' AND is_default),NULL,'hijack?','x',true)"
ok "$(as b0000000-0000-4000-8000-00000000000b "SELECT count(*) FROM public.store_faqs WHERE tenant_id='9c8c524c-88db-4771-8ab0-a4316298494c'")" 0 RESTORED_RLS_STILL_ISOLATES
echo "WSA_RESTORE_DRILL_PASS=$PASS"
