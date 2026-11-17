#!/usr/bin/env bash
# RPC10 — SYNTHETIC PG17 DISPOSABLE ONLY; not hosted, not real JWT.
set -euo pipefail
[[ "$(printenv CI || true)" == "true" &&
   "$(printenv T404_RPC8_DISPOSABLE || true)" == "YES" &&
   "$(printenv PGDATABASE || true)" == "t404_rpc8_ci" &&
   "$(printenv PGHOST || true)" == "postgres" &&
   "$(printenv PGUSER || true)" == "postgres" ]] || { echo 'RPC10_DISPOSABLE_ONLY';exit 2; }
[[ "$(psql -X -Atqc 'show server_version_num')" == 17* ]] || exit 2
[[ "$(psql -X -Atqc "select current_setting('tien404.rpc8_ephemeral',true)")" == "RPC8_DISPOSABLE" ]] || exit 2
psql -X -q -v ON_ERROR_STOP=1 -f qa/v152-rpc8/pg17-synthetic-legacy-fixture.sql >/dev/null
psql -X -q -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
BEGIN;
\i qa/v152-rpc8/pg17-m1-expand-disposable-only.sql
COMMIT;
SQL
psql -X -q -v ON_ERROR_STOP=1 -f qa/v152-rpc9/pg17-prepare-synthetic-three-store.sql >/dev/null
psql -X -q -v ON_ERROR_STOP=1 -f qa/v152-rpc10/pg17-six-surface-fixture.sql >/dev/null
check(){
 local want="$1" stmt="$2" label="$3" got
 got="$(psql -X -qAt -v ON_ERROR_STOP=1 -c "$stmt")"
 [[ "$want" == "$got" ]] || { echo "FAIL $label expected=$want got=[$got]";exit 1; }
 echo "PASS $label"
}
actor(){
 local who="$1" stmt="$2"
 psql -X -qAt -v ON_ERROR_STOP=1 <<SQL
BEGIN;
SET LOCAL ROLE qa_rpc8_user;
SET LOCAL tien404.synthetic_actor='$who';
$stmt
ROLLBACK;
SQL
}
check_actor(){
 local who="$1" want="$2" stmt="$3" label="$4" got
 got="$(actor "$who" "$stmt")"
 [[ "$want" == "$got" ]] || { echo "FAIL $label expected=$want got=[$got]";exit 1; }
 echo "PASS $label"
}
A=aaaaaaaa-0000-4000-8000-000000000001
B=bbbbbbbb-0000-4000-8000-000000000002
C=cccccccc-0000-4000-8000-000000000003
SA=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa
SB=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb
for t in products orders order_items conversations messages; do
 check_actor "$A" 2 "select count(*) from qa_rpc8.$t;" "RED: Tenant-only A sees two $t"
 check_actor "$B" 2 "select count(*) from qa_rpc8.$t;" "RED: Tenant-only B sees two $t"
done
psql -X -q -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
BEGIN;
\i qa/v152-rpc10/pg17-six-surface-atomic-cutover-disposable-only.sql
ROLLBACK;
SQL
for t in products orders order_items conversations messages; do
 check 0 "select count(*) from qa_rpc8.$t where store_id is not null" "ROLLBACK $t"
done
check 6 "select count(*) from pg_policies where schemaname='qa_rpc8' and policyname in ('products_member_read','orders_manager_read','customers_manager_read','order_items_manager_read','conversations_manager_read','messages_manager_read')" 'ROLLBACK restores six old policies'
check 0 "select count(*) from pg_policies where schemaname='qa_rpc8' and policyname like 'rpc10_%'" 'ROLLBACK removes new policies'
if psql -X -q -v ON_ERROR_STOP=1 >/dev/null 2>&1 <<'SQL'
BEGIN;
INSERT INTO qa_rpc8.messages(id,tenant_id,conversation_id,body)
VALUES('dddddddd-5555-4555-8555-dddddddddddd','11111111-1111-4111-8111-111111111111','aaaaaaaa-4444-4444-8444-aaaaaaaaaaaa','QA-DRIFT');
\i qa/v152-rpc10/pg17-six-surface-atomic-cutover-disposable-only.sql
COMMIT;
SQL
then echo 'FAIL drift was not blocked';exit 1; fi
check 3 'select count(*) from qa_rpc8.messages' 'drift rolled back new message'
check 0 'select count(*) from qa_rpc8.products where store_id is not null' 'drift leaves no half-backfill'
psql -X -q -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
BEGIN;
\i qa/v152-rpc10/pg17-six-surface-atomic-cutover-disposable-only.sql
COMMIT;
SQL
for t in products orders order_items conversations messages; do
 check 3 "select count(*) from qa_rpc8.$t where store_id is not null" "all $t attributed"
 check_actor "$A" 1 "select count(*) from qa_rpc8.$t;" "A own $t"
 check_actor "$B" 1 "select count(*) from qa_rpc8.$t;" "B own $t"
 check_actor "$C" 1 "select count(*) from qa_rpc8.$t;" "C own $t"
 check_actor "$A" 0 "select count(*) from qa_rpc8.$t where store_id='$SB';" "A cannot see B $t"
 check_actor "$B" 0 "select count(*) from qa_rpc8.$t where store_id='$SA';" "B cannot see A $t"
 check_actor ffffffff-0000-4000-8000-000000000004 0 "select count(*) from qa_rpc8.$t;" "unassigned denied $t"
done
check 6 "select count(*) from pg_policies where schemaname='qa_rpc8' and tablename in ('products','orders','customers','order_items','conversations','messages')" 'exactly six scoped policies'
check 10 "select count(*) from pg_constraint where connamespace='qa_rpc8'::regnamespace and conname like 'rpc10_%' and contype='f'" '10 scoped FK constraints'
check 6 "select count(*) from information_schema.columns where table_schema='qa_rpc8' and table_name in ('products','orders','customers','order_items','conversations','messages') and column_name='store_id' and is_nullable='NO'" 'six NOT NULL Store IDs'
psql -X -q -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
INSERT INTO qa_rpc8.customers(id,tenant_id,store_id,display_name) VALUES
('aaaaaaaa-6666-4666-8666-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','QA A'),
('bbbbbbbb-6666-4666-8666-bbbbbbbbbbbb','11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','QA B');
SQL
check_actor "$A" 1 'select count(*) from qa_rpc8.customers;' 'A own Customer'
check_actor "$B" 1 'select count(*) from qa_rpc8.customers;' 'B own Customer'
# Verify actual DB enforcement rather than just reading catalog definition.
if psql -X -q -v ON_ERROR_STOP=1 >/dev/null 2>&1 <<'SQL'
BEGIN;
UPDATE qa_rpc8.orders SET customer_id='bbbbbbbb-6666-4666-8666-bbbbbbbbbbbb'
WHERE id='aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa';
COMMIT;
SQL
then echo 'FAIL order/customer store FK';exit 1; fi
if psql -X -q -v ON_ERROR_STOP=1 >/dev/null 2>&1 <<'SQL'
BEGIN;
UPDATE qa_rpc8.order_items SET product_id='bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb'
WHERE id='aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa';
COMMIT;
SQL
then echo 'FAIL item/product store FK';exit 1; fi
if psql -X -q -v ON_ERROR_STOP=1 >/dev/null 2>&1 <<'SQL'
BEGIN;
UPDATE qa_rpc8.messages SET conversation_id='bbbbbbbb-4444-4444-8444-bbbbbbbbbbbb'
WHERE id='aaaaaaaa-5555-4555-8555-aaaaaaaaaaaa';
COMMIT;
SQL
then echo 'FAIL message/conversation store FK';exit 1; fi
psql -X -q -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
INSERT INTO qa_rpc8.products(id,tenant_id,store_id,sku,price_vnd,stock_on_hand)
VALUES('bbbbbbbb-7777-4777-8777-bbbbbbbbbbbb','11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','QA-TENANT-ONLY',200000,4);
SQL
check_actor "$A" 1 'select count(*) from qa_rpc8.products;' 'A unaffected by same SKU in B'
check_actor "$B" 2 'select count(*) from qa_rpc8.products;' 'B sees Store-B same SKU record'
psql -X -q -v ON_ERROR_STOP=1 -c "update qa_rpc8.store_memberships set active=false where user_id='$B'" >/dev/null
for t in products orders customers order_items conversations messages;do
 check_actor "$B" 0 "select count(*) from qa_rpc8.$t;" "revoked B denied $t"
done
check_actor "$A" 1 'select count(*) from qa_rpc8.orders;' 'A unaffected by B revocation'
check 3 'select count(*) from qa_rpc8.orders' 'all synthetic orders preserved'
echo 'PASS RPC10 six-surface disposable PG17; NOT real hosted JWT/RLS or Owner proof'
