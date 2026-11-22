#!/usr/bin/env bash
# Apply 40_store_sku_contract.sql (if absent) to the target in DB_URL, run the rolled-back hosted
# UAT, prove zero residue, and roll back 40 (file 60) on any failure. With ROLLBACK_CYCLE=1
# (restore-test only) it also proves 60 restores the step-3 fingerprint and writer, then re-applies.
# With EXPECT_FP40 set (staging) the post-40 fingerprint must equal restore-test's. Tags/hashes only.
set -uo pipefail
D=qa/v20-store-authority
PRE_FP=${T404_EXPECT_FP:-996aac15c13766a23f4def4ed8eefa08}
W20=${T404_EXPECT_W20:-a88a1d4841cee94d4f0b258285119c00}
SIG='public.save_merchant_product(uuid,text,text,bigint,boolean,integer,timestamptz)'
q(){ psql "$DB_URL" -X -At -v ON_ERROR_STOP=1 "$@" 2>/dev/null; }
fp(){ q -f $D/hosted/fingerprint.sql | tail -1 | cut -d'|' -f1; }
wmd5(){ q -c "select md5(pg_get_functiondef('$SIG'::regprocedure))"; }
runf(){ psql "$DB_URL" -X -q -v ON_ERROR_STOP=1 -f "$1" > /dev/null 2>err.txt \
  || { grep -o 'T404_[A-Z0-9_]*' err.txt | head -1; rm -f err.txt; echo "::error::$1 failed (transaction rolled back)"; return 1; }
  grep -o "$2" err.txt || { rm -f err.txt; echo "::error::$2 missing"; return 1; }; rm -f err.txt; }
[ "$(q -c "select to_regprocedure('public.save_merchant_product_in_store(uuid,text,text,bigint,boolean,integer,timestamptz)') is not null")" = t ] || { echo "::error::step 3 missing; nothing applied"; exit 1; }
has_key=$(q -c "select count(*) from pg_constraint where conrelid='public.products'::regclass and conname='products_tenant_id_sku_key'")
applied=0
if [ "$has_key" = 1 ]; then
  [ "$(fp)" = "$PRE_FP" ] || { echo "::error::target is not in the accepted step-3 state; nothing applied"; exit 1; }
  [ "$(wmd5)" = "$W20" ] || { echo "::error::writer is not the accepted step-2 body; nothing applied"; exit 1; }
  echo PASS_PRE_STATE_IS_STEP3
  runf $D/40_store_sku_contract.sql T404_V20_STORE_SKU_CONTRACT_OK || exit 1
  applied=1
else echo "ALREADY_APPLIED_40"; fi
fail=0
FP40=$(fp); echo "FP40=$FP40"; echo "WRITER40_MD5=$(wmd5)"
[ -n "${GITHUB_OUTPUT:-}" ] && echo "fp40=$FP40" >> "$GITHUB_OUTPUT"
if [ -n "${EXPECT_FP40:-}" ]; then
  [ "$FP40" = "$EXPECT_FP40" ] && echo PASS_FP40_EQUALS_RESTORE_TEST || { echo "::error::fp40 differs from restore-test"; fail=1; }
fi
uat(){ local out; out=$(psql "$DB_URL" -X -At -v ON_ERROR_STOP=1 -f $D/contract/contract-uat.sql 2>err.txt) || { grep -o 'T404_[A-Z0-9_]*' err.txt | head -1; echo "::error::UAT aborted"; rm -f err.txt; return 1; }
  rm -f err.txt
  echo "$out" | grep -E '^(PASS_|FAIL_|UAT_TOTAL=|RESIDUE )'
  echo "$out" | grep -q '^UAT_TOTAL=20 FAILED=0$' || return 1
  echo "$out" | grep -q '^RESIDUE stores_over_one=0 uat_products=0 uat_users=0 dup_skus=0$' || { echo "::error::residue found"; return 1; }; }
[ $fail = 0 ] && { uat || fail=1; }
if [ $fail = 0 ] && [ "${ROLLBACK_CYCLE:-0}" = 1 ]; then
  if runf $D/60_store_sku_contract_rollback.sql T404_V20_STORE_SKU_CONTRACT_ROLLBACK_OK; then
    [ "$(fp)" = "$PRE_FP" ] && echo PASS_ROLLBACK_60_FP_EQUALS_STEP3 || { echo "::error::fp after 60"; fail=1; }
    [ "$(wmd5)" = "$W20" ] && echo PASS_ROLLBACK_60_WRITER_EQUALS_STEP2 || { echo "::error::writer after 60"; fail=1; }
    if runf $D/40_store_sku_contract.sql T404_V20_STORE_SKU_CONTRACT_OK; then
      [ "$(fp)" = "$FP40" ] && echo PASS_REAPPLY_FP_EQUALS_FP40 || { echo "::error::fp after re-apply"; fail=1; }
    else fail=1; applied=0; fi
  else fail=1; fi
fi
if [ $fail = 1 ] && [ $applied = 1 ]; then
  runf $D/60_store_sku_contract_rollback.sql T404_V20_STORE_SKU_CONTRACT_ROLLBACK_OK > /dev/null && echo "ROLLED_BACK_40" || echo "::error::rollback 60 failed"
fi
exit $fail
