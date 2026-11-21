#!/usr/bin/env bash
# Apply 30_store_admin_rpcs.sql (if absent) to the target in DB_URL, run the rolled-back hosted UAT,
# prove zero residue, and roll back 30 (file 70) on any failure. Prints tags/hashes only.
set -uo pipefail
D=qa/v20-store-authority
POST_FP=${T404_EXPECT_FP:-996aac15c13766a23f4def4ed8eefa08}
q(){ psql "$DB_URL" -X -At -v ON_ERROR_STOP=1 "$@" 2>/dev/null; }
fp(){ q -f $D/hosted/fingerprint.sql | tail -1 | cut -d'|' -f1; }
[ "$(fp)" = "$POST_FP" ] || { echo "::error::target is not in the accepted V20 post state; nothing applied"; exit 1; }
[ "$(q -c "select pg_get_functiondef('public.save_merchant_product(uuid,text,text,bigint,boolean,integer,timestamptz)'::regprocedure) like '%store_memberships%'")" = t ] || { echo "::error::writer not store-aware"; exit 1; }
applied=0
if [ "$(q -c "select to_regprocedure('public.create_store(uuid,text,text)') is null")" = t ]; then
  psql "$DB_URL" -X -q -v ON_ERROR_STOP=1 -f $D/30_store_admin_rpcs.sql > /dev/null 2>err.txt \
    || { grep -o 'T404_[A-Z0-9_]*' err.txt | head -1; rm -f err.txt; echo "::error::30 failed (transaction rolled back)"; exit 1; }
  grep -o T404_V20_STORE_ADMIN_RPCS_OK err.txt || { rm -f err.txt; echo "::error::marker missing"; exit 1; }
  rm -f err.txt; applied=1
else echo "ALREADY_APPLIED_30"; fi
fail=0
[ "$(fp)" = "$POST_FP" ] && echo PASS_SCHEMA_FP_UNCHANGED_BY_30 || { echo "::error::fp changed"; fail=1; }
out=$(psql "$DB_URL" -X -At -v ON_ERROR_STOP=1 -f $D/hosted/admin-rpcs-uat.sql 2>err.txt) || { grep -o 'T404_[A-Z0-9_]*' err.txt | head -1; echo "::error::UAT aborted"; fail=1; }
rm -f err.txt
echo "$out" | grep -E '^(PASS_|FAIL_|UAT_TOTAL=|RESIDUE )'
echo "$out" | grep -q '^UAT_TOTAL=37 FAILED=0$' || fail=1
echo "$out" | grep -q '^RESIDUE stores_over_one=0 uat_products=0 uat_users=0$' || { echo "::error::residue found"; fail=1; }
if [ $fail = 1 ] && [ $applied = 1 ]; then
  psql "$DB_URL" -X -q -v ON_ERROR_STOP=1 -f $D/70_store_admin_rpcs_rollback.sql > /dev/null 2>&1 && echo "ROLLED_BACK_30" || echo "::error::rollback 70 failed"
fi
exit $fail
