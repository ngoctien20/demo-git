#!/usr/bin/env bash
# TIEN404 V14.4.1 — disposable PostgreSQL 17 only; DOES NOT restore a backup.
set -euo pipefail
[[ "$(printenv CI_V1441_DISPOSABLE || true)" == "YES" &&
   "$(printenv PGDATABASE || true)" == "tien404_v1441_ci" &&
   "$(printenv PGHOST || true)" == "127.0.0.1" &&
   "$(printenv PGUSER || true)" == "postgres" ]] || {
  echo 'BLOCKED: V14.4.1 exact disposable PG17 CI only'; exit 2;
}
v=$(psql -X -qAt -v ON_ERROR_STOP=1 -c 'show server_version_num')
[[ "$v" == 17* ]] || { echo "WRONG_POSTGRES_VERSION"; exit 2; }
[[ "$(psql -X -qAt -v ON_ERROR_STOP=1 -c 'select current_database()')" == "tien404_v1441_ci" ]] || exit 2

# The SQL file contains a separate database/user/GUC guard.
psql -X -qAt -v ON_ERROR_STOP=1 \
  -f qa/hosted-readiness-v1441/EPHEMERAL_PG17_CI_ONLY.sql >/dev/null

T='11111111-1111-4111-8111-111111111111'
A='aaaaaaaa-0000-4000-8000-000000000001'
B='bbbbbbbb-0000-4000-8000-000000000002'
C='cccccccc-0000-4000-8000-000000000003'
SA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
SB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
SQLBASE='qa_v1441'
actor_query(){
  local actor="$1" sql="$2"
  psql -X -qAt -v ON_ERROR_STOP=1 <<SQL
BEGIN;
SET LOCAL ROLE qa_v1441_user;
SET LOCAL tien404.synthetic_actor = '$actor';
$sql
ROLLBACK;
SQL
}
assert_actor(){
 local actor="$1" expected="$2" sql="$3" label="$4"
 local got
 got="$(actor_query "$actor" "$sql")"
 [[ "$got" == "$expected" ]] || {
  echo "FAIL $label: expected $expected got [$got]"; exit 1;
 }
 echo "PASS $label"
}
assert_admin(){
 local want="$1" sql="$2" label="$3"
 local got
 got="$(psql -X -qAt -v ON_ERROR_STOP=1 -c "$sql")"
 [[ "$got" == "$want" ]] || {
  echo "FAIL $label expected $want got [$got]"; exit 1;
 }
 echo "PASS $label"
}

assert_admin 2 "select count(*) from qa_v1441.products where tenant_id='$T' and sku='SKU-SAME'" \
  'two same-tenant stores can reuse identical SKU with separate price/stock'
assert_admin 'f' "select rolbypassrls from pg_roles where rolname='qa_v1441_user'" \
  'QA role has NO BYPASSRLS'
assert_admin 5 "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='qa_v1441' and c.relkind='r' and c.relforcerowsecurity" \
  'FORCE RLS enabled on five test tables'
assert_actor "$A" 1 "select count(*) from $SQLBASE.products;" \
  'Shop A can read only its own product'
assert_actor "$B" 1 "select count(*) from $SQLBASE.products;" \
  'Shop B same-tenant independently scoped'
assert_actor "$C" 1 "select count(*) from $SQLBASE.products;" \
  'Shop C cross-tenant independently scoped'
assert_actor "$A" 0 "select count(*) from $SQLBASE.products where store_id='$SB';" \
  'Shop A cannot read Shop B with same tenant'
assert_actor "$A" 159000 "select price_vnd from $SQLBASE.products where store_id='$SA';" \
  'Shop A has its own price'
assert_actor "$B" 189000 "select price_vnd from $SQLBASE.products where store_id='$SB';" \
  'Shop B has different own price for same SKU'
assert_actor "$A" 1 "select count(*) from $SQLBASE.orders;" \
  'Shop A can read only its own order'
assert_actor "$B" 1 "select count(*) from $SQLBASE.orders;" \
  'Shop B can read only its own order'
assert_actor "$A" 1 "select count(*) from $SQLBASE.order_items;" \
  'Shop A can read its own valid composite-FK order item'
assert_actor "$B" 0 "select count(*) from $SQLBASE.order_items;" \
  'Shop B cannot read Shop A order item'
assert_actor 'ffffffff-0000-4000-8000-000000000004' 0 \
  "select count(*) from $SQLBASE.products;" \
  'unassigned actor default deny'
assert_actor "$A" 0 \
  "with changed as (update $SQLBASE.products set stock=stock+1 where store_id='$SB' returning 1) select count(*) from changed;" \
  'Shop A UPDATE cannot change Shop B stock'
assert_actor "$A" 1 \
  "with ins as (insert into $SQLBASE.products(tenant_id,store_id,id,sku,price_vnd,stock) values ('$T','$SA','aaaaaaaa-4444-4444-8444-aaaaaaaaaaaa','QA-NEW',1500,2) returning 1) select count(*) from ins;" \
  'Shop A INSERT WITH CHECK accepts own store (rolled back)'

# Wrong-store INSERT must raise an actual PostgreSQL RLS violation.
psql -X -qAt -v ON_ERROR_STOP=1 >/dev/null <<SQL
BEGIN;
SET LOCAL ROLE qa_v1441_user;
SET LOCAL tien404.synthetic_actor = '$A';
DO \$check\$
BEGIN
 BEGIN
  INSERT INTO qa_v1441.products(tenant_id,store_id,id,sku,price_vnd,stock)
  VALUES ('$T','$SB','bbbbbbbb-4444-4444-8444-bbbbbbbbbbbb','QA-FOREIGN',1500,1);
  RAISE EXCEPTION 'CI_FAIL_WRONG_STORE_INSERT_SUCCEEDED';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END
\$check\$;
ROLLBACK;
SQL
echo 'PASS Shop A wrong-store INSERT blocked by actual RLS WITH CHECK'

# Demonstrate how OLD PERMISSIVE TENANT policy bypasses store-only policy.
# Then DROP old policy and verify isolation is restored.
psql -X -qAt -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
CREATE POLICY old_tenant_policy_DEMO_DO_NOT_USE ON qa_v1441.products
 FOR SELECT TO qa_v1441_user
 USING (EXISTS (
  SELECT 1 FROM qa_v1441.tenant_memberships tm
  WHERE tm.tenant_id=products.tenant_id
  AND tm.actor_id=qa_v1441.actor_id() AND tm.active
 ));
SQL
assert_actor "$A" 2 "select count(*) from $SQLBASE.products;" \
  'RED-TEAM expected old permissive tenant policy leaks same-tenant Store B'
psql -X -qAt -v ON_ERROR_STOP=1 -c \
 'DROP POLICY old_tenant_policy_DEMO_DO_NOT_USE ON qa_v1441.products' >/dev/null
assert_actor "$A" 1 "select count(*) from $SQLBASE.products;" \
  'required old tenant policy removal restores isolation'

psql -X -qAt -v ON_ERROR_STOP=1 -c \
  "update qa_v1441.store_memberships set active=false where actor_id='$B'" >/dev/null
assert_actor "$B" 0 "select count(*) from $SQLBASE.products;" \
  'revoked Store B membership denies immediately in synthetic policy model'
assert_actor "$A" 1 "select count(*) from $SQLBASE.products;" \
  'revocation B leaves A unaffected'

assert_admin 0 "select count(*) from pg_policies where schemaname='qa_v1441' and policyname='old_tenant_policy_demo_do_not_use'" \
 'old tenant-only policy absent at end of CI fixture'
echo 'PASS PG17 disposable source-only RLS mechanics; NOT Supabase Auth JWT, hosted RLS or backup restore'
