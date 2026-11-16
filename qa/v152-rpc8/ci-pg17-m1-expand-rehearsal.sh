#!/usr/bin/env bash
# RPC.8: disposable PostgreSQL 17 ONLY. No hosted connection, no real rows.
set -euo pipefail
[[ "$(printenv CI || true)" == "true" &&
   "$(printenv T404_RPC8_DISPOSABLE || true)" == "YES" &&
   "$(printenv PGDATABASE || true)" == "t404_rpc8_ci" &&
   "$(printenv PGHOST || true)" == "postgres" &&
   "$(printenv PGUSER || true)" == "postgres" ]] || { echo 'RPC8_DISPOSABLE_ONLY';exit 2; }
[[ "$(psql -X -Atqc 'show server_version_num')" == 17* ]] || exit 2
[[ "$(psql -X -Atqc 'select current_database()')" == "t404_rpc8_ci" ]] || exit 2
[[ "$(psql -X -Atqc "select current_setting('tien404.rpc8_ephemeral',true)")" == "RPC8_DISPOSABLE" ]] || exit 2
psql -X -v ON_ERROR_STOP=1 -q -f qa/v152-rpc8/pg17-synthetic-legacy-fixture.sql >/dev/null
check(){
 local want="$1" query="$2" label="$3" got
 got="$(psql -X -Atq -v ON_ERROR_STOP=1 -c "$query")"
 if [[ "$got" != "$want" ]];then
  echo "FAIL: $label expected $want got [$got]"; exit 1;fi
 echo "PASS: $label"
}
check 2 'select count(*) from qa_rpc8.products' 'baseline products 2'
check 2 'select count(*) from qa_rpc8.orders' 'baseline orders 2'
check 0 'select count(*) from qa_rpc8.customers' 'baseline customers 0'
check 3 "select count(*) from pg_policies where schemaname='qa_rpc8' and tablename in('products','orders','customers')" 'three legacy RLS policies'
check 0 "select count(*) from information_schema.columns where table_schema='qa_rpc8' and table_name in('products','orders','customers') and column_name='store_id'" 'baseline no store IDs'
# Evaluate a whole candidate M1 transaction then ROLLBACK, verify original state.
psql -X -v ON_ERROR_STOP=1 -q >/dev/null <<'SQL'
BEGIN;
\i qa/v152-rpc8/pg17-m1-expand-disposable-only.sql
DO $check$
BEGIN
 IF to_regclass('qa_rpc8.stores') IS NULL OR
    to_regclass('qa_rpc8.store_memberships') IS NULL
 THEN RAISE EXCEPTION 'RPC8_EXPAND_TXN_NOT_PRESENT'; END IF;
END $check$;
ROLLBACK;
SQL
check 0 "select count(*) from information_schema.columns where table_schema='qa_rpc8' and table_name in('products','orders','customers') and column_name='store_id'" 'rollback removes nullable Store columns'
check '' "select coalesce(to_regclass('qa_rpc8.stores')::text,'')" 'rollback removes Store table'
check '' "select coalesce(to_regclass('qa_rpc8.store_memberships')::text,'')" 'rollback removes Store Membership table'
# Apply only inside throwaway CI DB, preserving all data/policies.
psql -X -v ON_ERROR_STOP=1 -q >/dev/null <<'SQL'
BEGIN;
\i qa/v152-rpc8/pg17-m1-expand-disposable-only.sql
COMMIT;
SQL
check 2 'select count(*) from qa_rpc8.products' 'M1 preserves Products'
check 2 'select count(*) from qa_rpc8.orders' 'M1 preserves Orders'
check 0 'select count(*) from qa_rpc8.customers' 'M1 preserves Customers'
check 3 "select count(*) from information_schema.columns where table_schema='qa_rpc8' and table_name in('products','orders','customers') and column_name='store_id' and is_nullable='YES'" 'three nullable store columns only'
check 0 'select count(*) from qa_rpc8.stores' 'M1 no Store rows created'
check 0 'select count(*) from qa_rpc8.store_memberships' 'M1 no Store memberships created'
check 0 'select count(*) from qa_rpc8.products where store_id is not null' 'M1 no product backfill'
check 0 'select count(*) from qa_rpc8.orders where store_id is not null' 'M1 no order backfill'
check 3 "select count(*) from pg_policies where schemaname='qa_rpc8' and tablename in('products','orders','customers') and permissive='PERMISSIVE'" 'M1 retains all three old tenant-wide RLS policies'
check 2 "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='qa_rpc8' and c.relname in('stores','store_memberships') and c.relrowsecurity and c.relforcerowsecurity" 'new tables ENABLE+FORCE RLS'
check 2 "select count(*) from pg_policies where schemaname='qa_rpc8' and tablename in('stores','store_memberships')" 'two new private read-only policies'
check 'f|f|f|f' "select has_table_privilege('qa_rpc8_user','qa_rpc8.stores','INSERT'),has_table_privilege('qa_rpc8_user','qa_rpc8.stores','UPDATE'),has_table_privilege('qa_rpc8_user','qa_rpc8.store_memberships','INSERT'),has_table_privilege('qa_rpc8_user','qa_rpc8.store_memberships','UPDATE')" 'no client direct INSERT/UPDATE on Store tables'
check 1 "select count(*) from pg_constraint where conrelid='qa_rpc8.products'::regclass and pg_get_constraintdef(oid) like 'UNIQUE (tenant_id, sku)%'" 'legacy SKU unique still present'
# Fake Store rows only in disposable CI; never real owner mapping.
psql -X -v ON_ERROR_STOP=1 -q >/dev/null <<'SQL'
INSERT INTO qa_rpc8.stores (id,tenant_id,code) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','qa-store-a'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','11111111-1111-4111-8111-111111111111','qa-store-b'),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','22222222-2222-4222-8222-222222222222','qa-store-c');
INSERT INTO qa_rpc8.store_memberships (tenant_id,store_id,user_id,role) VALUES
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-0000-4000-8000-000000000001','owner'),
 ('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','bbbbbbbb-0000-4000-8000-000000000002','staff'),
 ('22222222-2222-4222-8222-222222222222','cccccccc-cccc-4ccc-8ccc-cccccccccccc','cccccccc-0000-4000-8000-000000000003','owner');
DO $block_cross_tenant$
BEGIN
 BEGIN
  INSERT INTO qa_rpc8.store_memberships (tenant_id,store_id,user_id,role)
  VALUES('11111111-1111-4111-8111-111111111111','cccccccc-cccc-4ccc-8ccc-cccccccccccc',
   'aaaaaaaa-0000-4000-8000-000000000001','owner');
  RAISE EXCEPTION 'RPC8_WRONG_TENANT_FK_ALLOWED';
 EXCEPTION WHEN foreign_key_violation THEN NULL;
 END;
END $block_cross_tenant$;
SQL
actor(){
 local who="$1" query="$2"
 psql -X -Atq -v ON_ERROR_STOP=1 <<SQL
BEGIN;
SET LOCAL ROLE qa_rpc8_user;
SET LOCAL tien404.synthetic_actor='$who';
$query
ROLLBACK;
SQL
}
assert_actor(){
 local who="$1" want="$2" query="$3" label="$4" got
 got="$(actor "$who" "$query")"
 [[ "$got" == "$want" ]] || { echo "FAIL $label want=$want got=[$got]";exit 1; }
 echo "PASS: $label"
}
A=aaaaaaaa-0000-4000-8000-000000000001
B=bbbbbbbb-0000-4000-8000-000000000002
C=cccccccc-0000-4000-8000-000000000003
SA=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa
SB=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb
assert_actor "$A" 1 "select count(*) from qa_rpc8.stores;" 'Owner A reads own Store only'
assert_actor "$B" 1 "select count(*) from qa_rpc8.stores;" 'Staff B same tenant reads Store B only'
assert_actor "$C" 1 "select count(*) from qa_rpc8.stores;" 'Owner C reads own cross-tenant Store only'
assert_actor "$A" 0 "select count(*) from qa_rpc8.stores where id='$SB';" 'A denied Store B same-tenant access'
assert_actor "$B" 0 "select count(*) from qa_rpc8.stores where id='$SA';" 'B denied Store A same-tenant access'
assert_actor "ffffffff-0000-4000-8000-000000000004" 0 'select count(*) from qa_rpc8.stores;' 'unassigned sees no stores'
assert_actor "$A" 1 'select count(*) from qa_rpc8.store_memberships;' 'A sees own membership only'
assert_actor "$B" 1 'select count(*) from qa_rpc8.store_memberships;' 'B sees own membership only'
assert_actor "$A" 1 'select count(*) from qa_rpc8.products;' 'legacy products still Tenant-scoped, NOT release proof'
assert_actor "$B" 1 'select count(*) from qa_rpc8.products;' 'legacy staff product read unchanged, NOT Store isolation'
psql -X -v ON_ERROR_STOP=1 -q -c "UPDATE qa_rpc8.store_memberships SET active=false WHERE user_id='$B'" >/dev/null
assert_actor "$B" 0 'select count(*) from qa_rpc8.stores;' 'revoked B sees no stores'
assert_actor "$B" 0 'select count(*) from qa_rpc8.store_memberships;' 'revoked B sees no memberships'
psql -X -v ON_ERROR_STOP=1 -q -c 'DELETE FROM qa_rpc8.store_memberships' >/dev/null
psql -X -v ON_ERROR_STOP=1 -q -c 'DELETE FROM qa_rpc8.stores' >/dev/null
check 0 'select count(*) from qa_rpc8.stores' 'no synthetic Store mapping retained'
check 0 'select count(*) from qa_rpc8.store_memberships' 'no synthetic membership retained'
echo 'PASS RPC8: disposable-only M1 expand + rollback + same-Tenant denial; NO hosted migration/JWT'
