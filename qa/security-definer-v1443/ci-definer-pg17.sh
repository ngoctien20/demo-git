#!/usr/bin/env bash
# OFFLINE CI ONLY: postgres-owned SECURITY DEFINER bypass demonstration.
# No Supabase project, customer database, provider sends or credentials.
set -euo pipefail
[[ "$(printenv CI_V1443_DISPOSABLE || true)" == "YES" &&
   "$(printenv PGDATABASE || true)" == "tien404_v1443_definer_ci" &&
   "$(printenv PGHOST || true)" == "postgres" &&
   "$(printenv PGUSER || true)" == "postgres" ]] || {
  echo 'BLOCKED: NOT_EXACT_V1443_EPHEMERAL_PG17'; exit 2;
}
version=$(psql -X -qAt -v ON_ERROR_STOP=1 -c 'show server_version_num')
[[ "$version" == 17* ]] || { echo 'BLOCKED: MAJOR_VERSION_NOT_17'; exit 2; }
psql -X -qAt -v ON_ERROR_STOP=1 \
  -f qa/security-definer-v1443/EPHEMERAL_PG17_ONLY.sql >/dev/null

query(){
  psql -X -qAt -v ON_ERROR_STOP=1 -c "$1"
}
assert_eq(){
  local expected="$1" sql="$2" title="$3" got
  got=$(query "$sql")
  if [[ "$got" != "$expected" ]]; then
    echo "FAIL $title (unexpected result)"; exit 1
  fi
  echo "PASS $title"
}
assert_eq "f" \
 "select rolbypassrls from pg_roles where rolname='qa_v1443_anon'" \
 "synthetic anon has NO BYPASSRLS"
assert_eq "t" \
 "select relforcerowsecurity from pg_class where oid='qa_v1443.products'::regclass" \
 "products table has FORCE RLS"
assert_eq "0" \
 "SET ROLE qa_v1443_anon; SELECT count(*) FROM qa_v1443.products" \
 "direct SELECT denied all rows under RLS"
assert_eq "2" \
 "SET ROLE qa_v1443_anon; SELECT qa_v1443.read_count()" \
 "postgres-owned SECURITY DEFINER can bypass RLS even under FORCE"
assert_eq "f" \
 "select exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE') from pg_proc p where p.oid='qa_v1443.read_count()'::regprocedure" \
 "PUBLIC EXECUTE not granted"
assert_eq "t" \
 "select has_function_privilege('qa_v1443_anon','qa_v1443.read_count()','EXECUTE')" \
 "synthetic anon may call only during bypass demonstration"
query "REVOKE EXECUTE ON FUNCTION qa_v1443.read_count() FROM qa_v1443_anon" >/dev/null
assert_eq "f" \
 "select has_function_privilege('qa_v1443_anon','qa_v1443.read_count()','EXECUTE')" \
 "revoke EXECUTE removes function privilege"
set +e
output=$(psql -X -qAt -v ON_ERROR_STOP=1 -c \
 "SET ROLE qa_v1443_anon; SELECT qa_v1443.read_count()" 2>&1)
code=$?
set -e
if [[ "$code" == "0" || "$output" != *"permission denied"* ]]; then
 echo "FAIL revoked role still able to call privileged function or unexpected error"; exit 1
fi
echo "PASS revoked role's privileged function call is actually denied"
echo "PASS disposable PG17 SECURITY DEFINER demo; NOT proof of hosted Supabase grant or actual exploit"
