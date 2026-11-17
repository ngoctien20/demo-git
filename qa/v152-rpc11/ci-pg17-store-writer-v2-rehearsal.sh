#!/usr/bin/env bash
# RPC11 SYNTHETIC ONLY: reuse pre-existing RPC8+RPC9+RPC10 disposable SQL.
set -euo pipefail
[[ "${CI:-}" == true && "${T404_RPC8_DISPOSABLE:-}" == YES &&
   "${PGDATABASE:-}" == t404_rpc8_ci && "${PGHOST:-}" == postgres &&
   "${PGUSER:-}" == postgres ]] || { echo RPC11_DISPOSABLE_ONLY; exit 2; }
[[ "$(psql -X -Atqc 'select current_database()')" == t404_rpc8_ci ]] || exit 2
[[ "$(psql -X -Atqc 'show server_version_num')" == 17* ]] || exit 2
[[ "$(psql -X -Atqc "select current_setting('tien404.rpc8_ephemeral',true)")" == RPC8_DISPOSABLE ]] || exit 2
psql -X -v ON_ERROR_STOP=1 -q -f qa/v152-rpc8/pg17-synthetic-legacy-fixture.sql >/dev/null
psql -X -v ON_ERROR_STOP=1 -q <<'SQL' >/dev/null
BEGIN;
\i qa/v152-rpc8/pg17-m1-expand-disposable-only.sql
COMMIT;
SQL
psql -X -v ON_ERROR_STOP=1 -q -f qa/v152-rpc9/pg17-prepare-synthetic-three-store.sql >/dev/null
psql -X -v ON_ERROR_STOP=1 -q -f qa/v152-rpc10/pg17-six-surface-fixture.sql >/dev/null
psql -X -v ON_ERROR_STOP=1 -q <<'SQL' >/dev/null
BEGIN;
\i qa/v152-rpc10/pg17-six-surface-atomic-cutover-disposable-only.sql
COMMIT;
SQL
psql -X -v ON_ERROR_STOP=1 -q -f qa/v152-rpc11/pg17-store-writer-v2-disposable-only.sql >/dev/null
A=aaaaaaaa-0000-4000-8000-000000000001
B=bbbbbbbb-0000-4000-8000-000000000002
C=cccccccc-0000-4000-8000-000000000003
T1=11111111-1111-4111-8111-111111111111
T2=22222222-2222-4222-8222-222222222222
SA=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa
SB=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb
SC=cccccccc-cccc-4ccc-8ccc-cccccccccccc
check(){ local want="$1" sql="$2" name="$3" got
 got="$(psql -X -Atq -v ON_ERROR_STOP=1 -c "$sql")"
 [[ "$want" == "$got" ]] || { echo "FAIL $name want:$want got:$got"; exit 1; }
 echo "PASS $name"
}
caller(){ local actor="$1" stmt="$2"
 psql -X -Atq -v ON_ERROR_STOP=1 <<SQL
BEGIN;
SET LOCAL ROLE qa_rpc8_user;
SET LOCAL tien404.synthetic_actor='$actor';
$stmt
COMMIT;
SQL
}
allow(){ local actor="$1" expected="$2" stmt="$3" name="$4" got
 got="$(caller "$actor" "$stmt")"
 [[ "$expected" == "$got" ]] || { echo "FAIL $name want:$expected got:$got";exit 1; }
 echo "PASS $name"
}
deny(){ local actor="$1" stmt="$2" name="$3"
 if caller "$actor" "$stmt" >/dev/null 2>&1; then echo "FAIL $name";exit 1; fi
 echo "PASS $name rejected"
}
check 6 "select count(*) from pg_policies where schemaname='qa_rpc8' and tablename in ('products','orders','customers','order_items','conversations','messages')" 'six Store policies loaded'
check 0 "select count(*) from pg_policies where schemaname='qa_rpc8' and policyname in ('products_member_read','orders_manager_read','customers_manager_read','order_items_manager_read','conversations_manager_read','messages_manager_read')" 'no legacy tenant policy'
allow "$A" 1 "SELECT CASE WHEN qa_rpc8.create_product_store_v2('$T1','$SA','RPC11-SAME',159000,10) IS NOT NULL THEN 1 ELSE 0 END;" 'A creates Store A product'
allow "$B" 1 "SELECT CASE WHEN qa_rpc8.create_product_store_v2('$T1','$SB','RPC11-SAME',250000,5) IS NOT NULL THEN 1 ELSE 0 END;" 'B creates same SKU Store B'
allow "$C" 1 "SELECT CASE WHEN qa_rpc8.create_product_store_v2('$T2','$SC','RPC11-SAME',99000,2) IS NOT NULL THEN 1 ELSE 0 END;" 'C creates Tenant 2 product'
check 3 "SELECT count(*) FROM qa_rpc8.products WHERE sku='RPC11-SAME'" 'Store-scoped SKU uniqueness works'
allow "$A" 1 "SELECT qa_rpc8.update_product_price_store_v2('$T1','$SA','RPC11-SAME',159000,160000);" 'A updates own price'
check 160000 "SELECT price_vnd FROM qa_rpc8.products WHERE tenant_id='$T1' AND store_id='$SA' AND sku='RPC11-SAME'" 'A price committed'
check 250000 "SELECT price_vnd FROM qa_rpc8.products WHERE tenant_id='$T1' AND store_id='$SB' AND sku='RPC11-SAME'" 'B price unchanged'
deny "$A" "SELECT qa_rpc8.create_product_store_v2('$T1','$SB','RPC11-CROSS',1,1);" 'A cannot create product in Store B'
deny "$A" "SELECT qa_rpc8.update_product_price_store_v2('$T1','$SB','RPC11-SAME',250000,1);" 'A cannot update Store B price'
deny "$A" "SELECT qa_rpc8.create_product_store_v2('$T2','$SC','RPC11-CROSS-TENANT',1,1);" 'A cannot create for Tenant C'
deny "$A" "INSERT INTO qa_rpc8.products(id,tenant_id,store_id,sku,price_vnd,stock_on_hand) VALUES(pg_catalog.gen_random_uuid(),'$T1','$SA','RPC11-DIRECT',1,1);" 'A direct INSERT denied'
deny "$A" "UPDATE qa_rpc8.products SET price_vnd=1 WHERE sku='RPC11-SAME';" 'A direct UPDATE denied'
deny "$A" "SELECT qa_rpc8.create_product_store_v2('$T1','$SA',' BAD ',1,1);" 'untrimmed SKU denied'
deny "$A" "SELECT qa_rpc8.create_product_store_v2('$T1','$SA','BAD',-1,1);" 'negative price denied'
deny "$A" "SELECT qa_rpc8.update_product_price_store_v2('$T1','$SA','RPC11-SAME',159000,1);" 'stale expected price denied'
check 160000 "SELECT price_vnd FROM qa_rpc8.products WHERE tenant_id='$T1' AND store_id='$SA' AND sku='RPC11-SAME'" 'failed price update left old price'
psql -X -v ON_ERROR_STOP=1 -q -c "UPDATE qa_rpc8.stores SET active=false WHERE id='$SB' AND tenant_id='$T1'" >/dev/null
deny "$B" "SELECT qa_rpc8.create_product_store_v2('$T1','$SB','DISABLED-STORE',1,1);" 'disabled Store cannot write'
psql -X -v ON_ERROR_STOP=1 -q -c "UPDATE qa_rpc8.stores SET active=true WHERE id='$SB' AND tenant_id='$T1'" >/dev/null
psql -X -v ON_ERROR_STOP=1 -q -c "UPDATE qa_rpc8.store_memberships SET active=false WHERE tenant_id='$T1' AND store_id='$SB' AND user_id='$B'" >/dev/null
deny "$B" "SELECT qa_rpc8.create_product_store_v2('$T1','$SB','REVOKED',1,1);" 'revoked membership blocks insert'
deny "$B" "SELECT qa_rpc8.update_product_price_store_v2('$T1','$SB','RPC11-SAME',250000,1);" 'revoked membership blocks price edit'
check 250000 "SELECT price_vnd FROM qa_rpc8.products WHERE tenant_id='$T1' AND store_id='$SB' AND sku='RPC11-SAME'" 'Store B unchanged after revoke'
allow "$A" 1 "SELECT qa_rpc8.update_product_price_store_v2('$T1','$SA','RPC11-SAME',160000,161000);" 'Store A unaffected by B revoke'
check 0 "SELECT count(*) FROM qa_rpc8.products WHERE sku LIKE 'RPC11-CROSS%' OR sku='REVOKED' OR sku='DISABLED-STORE'" 'denied writes caused zero rows'
echo 'PASS RPC11 disposable PG17 Store Writer V2 (synthetic; not hosted JWT or real Owner proof)'