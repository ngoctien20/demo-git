#!/usr/bin/env bash
# TIEN404 RPC.6 -- disposable synthetic PG17 backup/restore mechanics.
# This NEVER exports Supabase hosted data. NOT independent restore of a
# real user archive, owner evidence or protected credentials.
set -euo pipefail
[[ "$(printenv CI || true)" == "true" &&
   "$(printenv CI_V1441_DISPOSABLE || true)" == "YES" &&
   "$(printenv PGDATABASE || true)" == "tien404_v1441_ci" &&
   "$(printenv PGHOST || true)" == "postgres" &&
   "$(printenv PGUSER || true)" == "postgres" ]] || {
 echo 'RPC6_DISPOSABLE_RESTORE_ONLY'; exit 2; }
[[ "$(psql -X -Atqc 'SHOW server_version_num')" == 17* ]] || exit 2
[[ "$(psql -X -Atqc 'SELECT current_database()')" == "tien404_v1441_ci" ]] || exit 2
[[ "$(psql -X -Atqc "SELECT current_setting('tien404.qa_ephemeral',true)")" == "V1441_DISPOSABLE" ]] || exit 2
test "$(psql -X -Atqc "SELECT count(*) FROM qa_v1441.products")" == "3"
test "$(psql -X -Atqc "SELECT count(*) FROM qa_v1441.orders")" == "2"
test "$(psql -X -Atqc "SELECT count(*) FROM qa_v1441.customers")" == "3"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
# Dump ONLY local QA schema, never a connection to hosted.
pg_dump --dbname=tien404_v1441_ci --format=custom \
 --schema=qa_v1441 --no-owner --no-acl --file="$work/synthetic.backup"
sha="$(sha256sum "$work/synthetic.backup" | cut -d' ' -f1)"
[[ "$sha" =~ ^[a-f0-9]{64}$ ]] || exit 1
createdb t404_rpc6_restore_ci
pg_restore --exit-on-error --no-owner --no-acl \
 --dbname=t404_rpc6_restore_ci "$work/synthetic.backup" >/dev/null
# The restore target is another ephemeral database in the SAME CI service,
# NOT an independently administered infrastructure environment.
dst="t404_rpc6_restore_ci"
check_restore(){
 local expected="$1" sql="$2" description="$3"
 local found
 found="$(psql -X -Atq -d "$dst" -c "$sql")"
 if [[ "$found" != "$expected" ]]; then
   echo "FAIL RPC6 synthetic restore: $description";exit 1;
 fi
 echo "PASS RPC6 synthetic restore: $description"
}
check_restore 3 'SELECT count(*) FROM qa_v1441.products' 'products count'
check_restore 2 'SELECT count(*) FROM qa_v1441.orders' 'orders count'
check_restore 3 'SELECT count(*) FROM qa_v1441.customers' 'synthetic customers count'
check_restore 1 "SELECT count(*) FROM pg_constraint WHERE conname='qa_customer_same_store_fk' AND contype='f'" \
 'same-Store composite customer/order FK preserved'
check_restore 0 "SELECT count(*) FROM pg_policies WHERE schemaname='qa_v1441' AND policyname='old_tenant_policy_demo_do_not_use'" \
 'old tenant-only permissive policy NOT restored'
check_restore 1 "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='qa_v1441' AND c.relname='customers' AND c.relrowsecurity AND c.relforcerowsecurity" \
 'customer FORCE RLS preserved'
check_restore 1 "SELECT count(*) FROM pg_roles WHERE rolname='qa_v1441_user' AND NOT rolbypassrls" \
 'QA role does NOT bypass RLS'
dropdb t404_rpc6_restore_ci
echo 'PASS: second disposable DB restore drill, NOT real hosted export/restore certification'
