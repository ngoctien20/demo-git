#!/usr/bin/env bash
# RPC12 authentic caller contract rehearsal (NOT real JWT) on disposable PostgreSQL 17.
set -euo pipefail
[[ "${CI:-}" == true && "${T404_RPC8_DISPOSABLE:-}" == YES &&
   "${PGDATABASE:-}" == t404_rpc8_ci && "${PGHOST:-}" == postgres &&
   "${PGUSER:-}" == postgres ]] || { echo RPC12_DISPOSABLE_ONLY; exit 2; }
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
psql -X -v ON_ERROR_STOP=1 -q -f qa/v152-rpc12/pg17-auth-bound-writer-disposable-only.sql >/dev/null

A=aaaaaaaa-0000-4000-8000-000000000001
B=bbbbbbbb-0000-4000-8000-000000000002
C=cccccccc-0000-4000-8000-000000000003
SA=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa
SB=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb
SC=cccccccc-cccc-4ccc-8ccc-cccccccccccc
T1=11111111-1111-4111-8111-111111111111
T2=22222222-2222-4222-8222-222222222222
check(){ local want="$1" sql="$2" name="$3" got
 got="$(psql -X -Atq -v ON_ERROR_STOP=1 -c "$sql")"
 [[ "$want" == "$got" ]] || { echo "FAIL $name expected:$want got:$got";exit 1; }
 echo "PASS $name"
}
caller(){ local identity="$1" stmt="$2"
 psql -X -Atq -v ON_ERROR_STOP=1 <<SQL
BEGIN;
SET LOCAL ROLE qa_rpc12_authenticated;
${identity:+SET LOCAL request.jwt.claim.sub='$identity';}
$stmt
COMMIT;
SQL
}
allow(){ local identity="$1" want="$2" stmt="$3" name="$4" got
 got="$(caller "$identity" "$stmt")"
 [[ "$want" == "$got" ]] || { echo "FAIL $name expected:$want got:$got";exit 1; }
 echo "PASS $name"
}
deny(){ local identity="$1" stmt="$2" name="$3"
 if caller "$identity" "$stmt" >/dev/null 2>&1;then echo "FAIL $name";exit 1;fi
 echo "PASS $name denied"
}

check 6 "select count(*) from pg_policies where schemaname='qa_rpc8' and policyname like 'rpc12_writer_%'" 'RLS writer policies installed'
check 3 "select count(*) from pg_policies where schemaname='qa_rpc8' and tablename in ('stores','store_memberships','tenant_memberships') and cmd='UPDATE' and btrim(with_check,'() ')='false'" 'authority row locks have update USING and deny all mutation with WITH CHECK(false)'
check t "select has_column_privilege('qa_rpc12_writer','qa_rpc8.stores','active','UPDATE')" 'row lock column privilege on Store'
check t "select has_column_privilege('qa_rpc12_writer','qa_rpc8.store_memberships','active','UPDATE')" 'row lock column privilege on Store Membership'
check t "select has_column_privilege('qa_rpc12_writer','qa_rpc8.tenant_memberships','active','UPDATE')" 'row lock column privilege on Tenant Membership'
check f "select rolbypassrls from pg_roles where rolname='qa_rpc12_writer'" 'dedicated DB writer cannot bypass RLS'
check f "select rolcanlogin from pg_roles where rolname='qa_rpc12_writer'" 'dedicated DB writer cannot log in'
check f "select has_table_privilege('qa_rpc12_authenticated','qa_rpc8.products','UPDATE')" 'client has no direct product UPDATE'
check f "select has_table_privilege('qa_rpc12_authenticated','qa_rpc8.products','INSERT')" 'client has no direct product INSERT'
check 0 "select count(*) from pg_proc where pronamespace='qa_rpc12_api'::regnamespace and proname='create_product' and pg_get_function_identity_arguments(oid) ilike '%actor%'" 'client cannot supply caller actor parameter'

deny "" "select qa_rpc12_api.create_product('$SA','AUTH-NO-SUB',1,1);" 'missing auth.uid() claim denied'
allow "$A" 1 "select case when qa_rpc12_api.create_product('$SA','RPC12-SAME',159000,2) is not null then 1 else 0 end;" 'A creates own Store product from auth.uid()'
allow "$B" 1 "select case when qa_rpc12_api.create_product('$SB','RPC12-SAME',250000,3) is not null then 1 else 0 end;" 'B creates same SKU Store B'
allow "$C" 1 "select case when qa_rpc12_api.create_product('$SC','RPC12-SAME',99000,4) is not null then 1 else 0 end;" 'C creates Store C'
check 3 "select count(*) from qa_rpc8.products where sku='RPC12-SAME'" 'cross-Store SKU support'
check 1 "select count(*) from qa_rpc8.products where store_id='$SA' and tenant_id='$T1' and sku='RPC12-SAME'" 'tenant automatically derived from A Store'
check 1 "select count(*) from qa_rpc8.products where store_id='$SC' and tenant_id='$T2' and sku='RPC12-SAME'" 'tenant automatically derived from C Store'
# Even internal NOLOGIN DB role cannot change Store/member status under RLS.
if psql -X -v ON_ERROR_STOP=1 -q >/dev/null 2>&1 <<SQL
BEGIN;
SET LOCAL ROLE qa_rpc12_writer;
SET LOCAL request.jwt.claim.sub='$A';
UPDATE qa_rpc8.store_memberships SET active=false WHERE store_id='$SA' AND user_id='$A';
COMMIT;
SQL
then echo 'FAIL internal authority mutation bypass'; exit 1; else echo 'PASS internal authority mutation denied by WITH CHECK(false)'; fi
check t "select active from qa_rpc8.store_memberships where store_id='$SA' and user_id='$A'" 'Store A authority preserved after blocked mutation'
allow "$A" 1 "select qa_rpc12_api.update_price('$SA','RPC12-SAME',159000,160000);" 'A changes own Store price'
check 160000 "select price_vnd from qa_rpc8.products where store_id='$SA' and sku='RPC12-SAME'" 'own price committed'
check 250000 "select price_vnd from qa_rpc8.products where store_id='$SB' and sku='RPC12-SAME'" 'B price unaffected'

deny "$A" "select qa_rpc12_api.create_product('$SB','RPC12-CROSS',1,1);" 'A denied Store B product creation'
deny "$A" "select qa_rpc12_api.update_price('$SB','RPC12-SAME',250000,1);" 'A denied Store B price update'
deny "$A" "select qa_rpc12_api.create_product('$SC','RPC12-OTHER-TENANT',1,1);" 'A denied other Tenant'
deny "$A" "insert into qa_rpc8.products(id,tenant_id,store_id,sku,price_vnd,stock_on_hand) values(pg_catalog.gen_random_uuid(),'$T1','$SA','RPC12-DIRECT',1,1);" 'client direct INSERT denied'
deny "$A" "update qa_rpc8.products set price_vnd=1 where store_id='$SA';" 'client direct UPDATE denied'
deny "$A" "select qa_rpc12_api.create_product('$SA',' BAD ',1,1);" 'untrimmed SKU refused'
deny "$A" "select qa_rpc12_api.update_price('$SA','RPC12-SAME',159000,1);" 'stale expected price denied'
check 160000 "select price_vnd from qa_rpc8.products where store_id='$SA' and sku='RPC12-SAME'" 'failed write does not mutate price'

psql -X -v ON_ERROR_STOP=1 -q -c "update qa_rpc8.stores set active=false where id='$SB'" >/dev/null
deny "$B" "select qa_rpc12_api.create_product('$SB','RPC12-DISABLED',1,1);" 'disabled Store denied'
psql -X -v ON_ERROR_STOP=1 -q -c "update qa_rpc8.stores set active=true where id='$SB'" >/dev/null
psql -X -v ON_ERROR_STOP=1 -q -c "update qa_rpc8.store_memberships set active=false where store_id='$SB' and user_id='$B'" >/dev/null
deny "$B" "select qa_rpc12_api.create_product('$SB','RPC12-REVOKED',1,1);" 'revoked store member denied with unchanged simulated JWT claim'
deny "$B" "select qa_rpc12_api.update_price('$SB','RPC12-SAME',250000,1);" 'revoked store member price update denied'
psql -X -v ON_ERROR_STOP=1 -q -c "update qa_rpc8.tenant_memberships set active=false where tenant_id='$T1' and user_id='$A'" >/dev/null
deny "$A" "select qa_rpc12_api.create_product('$SA','RPC12-REVOKED-TENANT',1,1);" 'revoked tenant member denied'
check 0 "select count(*) from qa_rpc8.products where sku like 'RPC12-CROSS%' or sku like 'RPC12-REVOKED%' or sku='RPC12-DIRECT' or sku='RPC12-DISABLED'" 'denied writes leave no rows'
check 250000 "select price_vnd from qa_rpc8.products where store_id='$SB' and sku='RPC12-SAME'" 'B unchanged by failures'
echo 'PASS RPC12 PG17 AUTH.UID() claim-context contract, NOT real JWT signature verification or hosted Supabase'