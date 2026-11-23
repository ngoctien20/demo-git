#!/usr/bin/env bash
# Store-aware writer smoke on the real members: each call runs inside BEGIN ... ROLLBACK,
# so no product row survives. Owner/manager of the default store must succeed and the new
# row must land in the tenant's default store; staff must be refused. Prints tags only.
set -uo pipefail
q(){ psql "$DB_URL" -X -At -v ON_ERROR_STOP=1 2>/dev/null; }
members=$(echo "select tenant_id||'|'||user_id||'|'||role from public.tenant_memberships where active order by 1" | q) || exit 1
fail=0; n=0
while IFS='|' read -r t u r; do
  n=$((n+1))
  res=$(printf "BEGIN;\nSET LOCAL ROLE authenticated;\nSELECT set_config('request.jwt.claims','{\"sub\":\"%s\",\"role\":\"authenticated\"}',true) \\\\gset\nSELECT public.save_merchant_product('%s','QA-V20-STAGING-SMOKE','V20 smoke (rolled back)',1000,false,0,NULL) \\\\gset\nRESET ROLE;\nSELECT 'landed_in_default_store',(SELECT p.store_id FROM public.products p WHERE p.tenant_id='%s' AND p.sku='QA-V20-STAGING-SMOKE')=(SELECT d.id FROM public.stores d WHERE d.tenant_id='%s' AND d.is_default);\nROLLBACK;\n" "$u" "$t" "$t" "$t" | q | grep '|')
  case "$r" in
    owner|manager) [ "$res" = "landed_in_default_store|t" ] && echo "PASS_WRITER_${r^^}_$n" || { echo "FAIL_WRITER_${r^^}_$n"; fail=1; } ;;
    *) [ -z "$res" ] && echo "PASS_WRITER_DENY_${r^^}_$n" || { echo "FAIL_WRITER_${r^^}_$n accepted"; fail=1; } ;;
  esac
  other=$(echo "select id from public.tenants where id<>'$t' and not exists (select 1 from public.tenant_memberships m where m.tenant_id=tenants.id and m.user_id='$u') order by id limit 1" | q)
  if [ -n "$other" ]; then
    x=$(printf "BEGIN;\nSET LOCAL ROLE authenticated;\nSELECT set_config('request.jwt.claims','{\"sub\":\"%s\",\"role\":\"authenticated\"}',true) \\\\gset\nSELECT 'accepted',public.save_merchant_product('%s','QA-V20-STAGING-SMOKE','x',1000,false,0,NULL) IS NOT NULL;\nROLLBACK;\n" "$u" "$other" | q | grep '|')
    [ -z "$x" ] && echo "PASS_WRITER_DENY_CROSS_TENANT_$n" || { echo "FAIL_WRITER_CROSS_TENANT_$n accepted"; fail=1; }
  fi
done <<< "$members"
left=$(echo "select count(*) from public.products where sku='QA-V20-STAGING-SMOKE'" | q)
[ "$left" = 0 ] && echo "PASS_NO_SMOKE_ROW_LEFT" || { echo "FAIL_SMOKE_ROW_LEFT"; fail=1; }
exit $fail
