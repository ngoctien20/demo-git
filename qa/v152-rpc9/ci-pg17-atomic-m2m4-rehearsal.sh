#!/usr/bin/env bash
# RPC.9: disposable PostgreSQL 17 ONLY; synthetic Owner mapping.
set -euo pipefail
[[ "$(printenv CI || true)" == "true" &&
  "$(printenv T404_RPC8_DISPOSABLE || true)" == "YES" &&
  "$(printenv PGDATABASE || true)" == "t404_rpc8_ci" &&
  "$(printenv PGHOST || true)" == "postgres" &&
  "$(printenv PGUSER || true)" == "postgres" ]] || { echo 'RPC9_DISPOSABLE_ONLY';exit 2; }
[[ "$(psql -X -Atqc 'show server_version_num')" == 17* ]] || exit 2
[[ "$(psql -X -Atqc 'select current_database()')" == "t404_rpc8_ci" ]] || exit 2
[[ "$(psql -X -Atqc "select current_setting('tien404.rpc8_ephemeral',true)")" == "RPC8_DISPOSABLE" ]] || exit 2

psql -X -v ON_ERROR_STOP=1 -q -f qa/v152-rpc8/pg17-synthetic-legacy-fixture.sql >/dev/null
psql -X -v ON_ERROR_STOP=1 -q <<'SQL' >/dev/null
BEGIN;
\i qa/v152-rpc8/pg17-m1-expand-disposable-only.sql
COMMIT;
SQL
psql -X -v ON_ERROR_STOP=1 -q -f qa/v152-rpc9/pg17-prepare-synthetic-three-store.sql >/dev/null

check(){
 local want="$1" sql="$2" msg="$3" got
 got="$(psql -X -Atq -v ON_ERROR_STOP=1 -c "$sql")"
 [[ "$want" == "$got" ]] || { echo "FAIL $msg expected=$want got=[$got]";exit 1; }
 echo "PASS $msg"
}
actor(){
 local id="$1" sql="$2"
 psql -X -Atq -v ON_ERROR_STOP=1 <<SQL
BEGIN;
SET LOCAL ROLE qa_rpc8_user;
SET LOCAL tien404.synthetic_actor='$id';
$sql
ROLLBACK;
SQL
}
assert_actor(){
 local id="$1" want="$2" sql="$3" msg="$4" got
 got="$(actor "$id" "$sql")"
 [[ "$want" == "$got" ]] || { echo "FAIL $msg expected=$want got=[$got]";exit 1; }
 echo "PASS $msg"
}
A=aaaaaaaa-0000-4000-8000-000000000001
B=bbbbbbbb-0000-4000-8000-000000000002
C=cccccccc-0000-4000-8000-000000000003
SA=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa
SB=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb
check 3 'select count(*) from qa_rpc8.products' '3 synthetic Products (hosted has 2)'
check 3 'select count(*) from qa_rpc8.orders' '3 synthetic Orders (hosted has 2)'
check 0 'select count(*) from qa_rpc8.customers' '0 synthetic Customers'
assert_actor "$A" 2 'select count(*) from qa_rpc8.products;' 'RED: A sees B Product under old Tenant policy'
assert_actor "$B" 2 'select count(*) from qa_rpc8.products;' 'RED: B sees A Product under old Tenant policy'
assert_actor "$A" 2 'select count(*) from qa_rpc8.orders;' 'RED: A sees B Order under old Tenant policy'
assert_actor "$B" 2 'select count(*) from qa_rpc8.orders;' 'RED: B sees A Order under old Tenant policy'

psql -X -v ON_ERROR_STOP=1 -q <<'SQL' >/dev/null
BEGIN;
\i qa/v152-rpc9/pg17-atomic-m2m4-disposable-only.sql
DO $post$
BEGIN
 IF (SELECT count(*) FROM qa_rpc8.products WHERE store_id IS NOT NULL)<>3
  OR (SELECT count(*) FROM qa_rpc8.orders WHERE store_id IS NOT NULL)<>3
 THEN RAISE EXCEPTION 'RPC9_TXN_NOT_ASSIGNED';END IF;
END $post$;
ROLLBACK;
SQL
check 0 'select count(*) from qa_rpc8.products where store_id is not null' 'ROLLBACK reverts all Product assignments'
check 0 'select count(*) from qa_rpc8.orders where store_id is not null' 'ROLLBACK reverts all Order assignments'
check 3 "select count(*) from pg_policies where schemaname='qa_rpc8' and policyname in('products_member_read','orders_manager_read','customers_manager_read')" 'ROLLBACK restores old policies'
check 0 "select count(*) from pg_policies where schemaname='qa_rpc8' and policyname in('products_store_scoped_read','orders_store_manager_read','customers_store_manager_read')" 'ROLLBACK removes new policies'
assert_actor "$A" 2 'select count(*) from qa_rpc8.products;' 'ROLLBACK restores original Tenant read result'

# Induce row-count drift: transaction must abort before assignments or policy edits.
if psql -X -v ON_ERROR_STOP=1 -q >/dev/null 2>&1 <<'SQL'
BEGIN;
INSERT INTO qa_rpc8.products(id,tenant_id,sku,price_vnd,stock_on_hand)
VALUES('dddddddd-1111-4111-8111-dddddddddddd',
'11111111-1111-4111-8111-111111111111','QA-DRIFT-TEST',1,1);
\i qa/v152-rpc9/pg17-atomic-m2m4-disposable-only.sql
COMMIT;
SQL
then echo 'FAIL: drift did not block atomic cutover';exit 1;fi
check 3 'select count(*) from qa_rpc8.products' 'drift test rolls back inserted Product'
check 0 'select count(*) from qa_rpc8.products where store_id is not null' 'drift failure causes zero backfill'
check 3 "select count(*) from pg_policies where schemaname='qa_rpc8' and policyname in('products_member_read','orders_manager_read','customers_manager_read')" 'drift failure leaves old RLS policies'

psql -X -v ON_ERROR_STOP=1 -q <<'SQL' >/dev/null
BEGIN;
\i qa/v152-rpc9/pg17-atomic-m2m4-disposable-only.sql
COMMIT;
SQL
check 3 'select count(*) from qa_rpc8.products where store_id is not null' 'atomic commit assigns every Product'
check 3 'select count(*) from qa_rpc8.orders where store_id is not null' 'atomic commit assigns every Order'
check 0 "select count(*) from pg_policies where schemaname='qa_rpc8' and policyname in('products_member_read','orders_manager_read','customers_manager_read')" 'atomic commit removes all 3 old permissive policies'
check 3 "select count(*) from pg_policies where schemaname='qa_rpc8' and policyname in('products_store_scoped_read','orders_store_manager_read','customers_store_manager_read')" 'atomic commit creates Store-scoped policies'
check 0 "select count(*) from qa_rpc8.products p left join qa_rpc8.stores s on s.tenant_id=p.tenant_id and s.id=p.store_id where s.id is null" 'all Products have valid tenant/store'
check 0 "select count(*) from qa_rpc8.orders o left join qa_rpc8.stores s on s.tenant_id=o.tenant_id and s.id=o.store_id where s.id is null" 'all Orders have valid tenant/store'
assert_actor "$A" 1 'select count(*) from qa_rpc8.products;' 'Owner A sees only Store A Product'
assert_actor "$B" 1 'select count(*) from qa_rpc8.products;' 'Manager B sees only Store B Product'
assert_actor "$C" 1 'select count(*) from qa_rpc8.products;' 'Owner C sees only Store C Product'
assert_actor "$A" 0 "select count(*) from qa_rpc8.products where store_id='$SB';" 'A denied Store B Product'
assert_actor "$B" 0 "select count(*) from qa_rpc8.products where store_id='$SA';" 'B denied Store A Product'
assert_actor "$A" 1 'select count(*) from qa_rpc8.orders;' 'Owner A sees only Store A Order'
assert_actor "$B" 1 'select count(*) from qa_rpc8.orders;' 'Manager B sees only Store B Order'
assert_actor "$C" 1 'select count(*) from qa_rpc8.orders;' 'Owner C sees only Store C Order'
assert_actor "$A" 0 "select count(*) from qa_rpc8.orders where store_id='$SB';" 'A denied Store B Order'
assert_actor "$B" 0 "select count(*) from qa_rpc8.orders where store_id='$SA';" 'B denied Store A Order'
assert_actor 'ffffffff-0000-4000-8000-000000000004' 0 'select count(*) from qa_rpc8.products;' 'unassigned actor denied'
assert_actor "$B" 1 'select count(*) from qa_rpc8.stores;' 'B sees own Store before revoke'
psql -X -v ON_ERROR_STOP=1 -q -c "UPDATE qa_rpc8.store_memberships SET active=false WHERE user_id='$B'" >/dev/null
assert_actor "$B" 0 'select count(*) from qa_rpc8.products;' 'revoked B has no Products'
assert_actor "$B" 0 'select count(*) from qa_rpc8.orders;' 'revoked B has no Orders'
assert_actor "$A" 1 'select count(*) from qa_rpc8.products;' 'A unaffected by B revoke'
check 3 'select count(*) from qa_rpc8.products' 'no synthetic Product deleted'
check 3 'select count(*) from qa_rpc8.orders' 'no synthetic Order deleted'
echo 'PASS RPC9: synthetic PG17 atomic cutover + rollback + Store isolation; NOT hosted JWT or zero-downtime'
