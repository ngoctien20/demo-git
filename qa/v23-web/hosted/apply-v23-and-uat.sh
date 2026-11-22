#!/usr/bin/env bash
# Apply db/v23-web 10 -> 20 -> 30 (each only if absent) to the target in DB_URL, run the rolled-back
# hosted UAT, prove zero residue, and on any failure roll back what THIS run applied (70 -> 80 -> 90).
# Prints tags only (this repository is public).
set -uo pipefail
D=db/v23-web; H=qa/v23-web/hosted
q(){ psql "$DB_URL" -X -At -v ON_ERROR_STOP=1 "$@" 2>/dev/null; }
[ "$(q -c "select to_regprocedure('public.create_store(uuid,text,text)') is not null and exists(select 1 from pg_trigger where tgname='t404_tenant_default_store')")" = t ] \
  || { echo "::error::V20 steps 10-30 not present on target; nothing applied"; exit 1; }
applied=()
step(){ # file marker presence-sql
  if [ "$(q -c "$3")" = t ]; then echo "ALREADY_APPLIED_$2"; return 0; fi
  psql "$DB_URL" -X -q -v ON_ERROR_STOP=1 -f "$D/$1" > /dev/null 2>err.txt \
    || { grep -o 'T404_[A-Z0-9_]*' err.txt | head -1; rm -f err.txt; echo "::error::$1 failed (its transaction rolled back)"; return 1; }
  grep -q "$2" err.txt || { rm -f err.txt; echo "::error::$2 marker missing"; return 1; }
  rm -f err.txt; echo "APPLIED_$2"; applied+=("$1"); }
fail=0
step 10_leads.sql T404_V23_LEADS_OK "select to_regclass('app_private.web_leads') is not null" || fail=1
[ $fail = 0 ] && { step 20_self_serve_shop.sql T404_V23_SELF_SERVE_OK "select to_regprocedure('public.register_shop(text,text)') is not null" || fail=1; }
[ $fail = 0 ] && { step 30_store_bot_settings.sql T404_V23_BOT_SETTINGS_OK "select to_regclass('public.store_bot_settings') is not null" || fail=1; }
if [ $fail = 0 ]; then
  out=$(psql "$DB_URL" -X -At -v ON_ERROR_STOP=1 -f $H/v23-uat.sql 2>err.txt) || { grep -o 'T404_[A-Z0-9_]*' err.txt | head -1; echo "::error::UAT aborted"; fail=1; }
  rm -f err.txt
  echo "$out" | grep -E '^(PASS_|FAIL_|UAT_TOTAL=|RESIDUE )'
  echo "$out" | grep -q '^UAT_TOTAL=51 FAILED=0$' || fail=1
  echo "$out" | grep -Eq '^RESIDUE uat_leads=0 self_serve=0 uat_products=0 uat_users=0 ' || { echo "::error::residue found"; fail=1; }
fi
if [ $fail = 1 ]; then
  for f in 30_store_bot_settings.sql:70_store_bot_settings_rollback.sql 20_self_serve_shop.sql:80_self_serve_shop_rollback.sql 10_leads.sql:90_leads_rollback.sql; do
    a=${f%%:*}; r=${f##*:}
    if printf '%s\n' "${applied[@]:-}" | grep -qx "$a"; then
      psql "$DB_URL" -X -q -v ON_ERROR_STOP=1 -f "$D/$r" > /dev/null 2>&1 && echo "ROLLED_BACK_${r%%_*}" || echo "::error::rollback $r failed"
    fi
  done
fi
echo "N8N=0 PROVIDER_SENDS=0 UAT_WRITES_ROLLED_BACK=1"
exit $fail
