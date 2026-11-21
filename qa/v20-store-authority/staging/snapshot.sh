#!/usr/bin/env bash
# Visibility snapshot of the 6 Commerce tables + 2 report functions, seen by each real
# tenant member through RLS (SET LOCAL ROLE authenticated + JWT claims, always ROLLBACK).
# Writes nothing. Prints only one md5 and a line count (repo is public: no ids, no data).
# Usage: snapshot.sh <out-file>     needs DB_URL (staging, masked)
set -uo pipefail
out=$1; : > "$out"
q(){ psql "$DB_URL" -X -At -v ON_ERROR_STOP=1 2>/dev/null; }
members=$(echo "select tenant_id||'|'||user_id||'|'||role||'|'||active from public.tenant_memberships order by 1" | q) || { echo "::error::member list failed"; exit 1; }
[ -n "$members" ] || { echo "::error::no members"; exit 1; }
while IFS='|' read -r t u r a; do
  for stmt in \
    "select 'own_products',count(*) from public.products where tenant_id='$t'" \
    "select 'other_products',count(*) from public.products where tenant_id<>'$t'" \
    "select 'own_orders',count(*) from public.orders where tenant_id='$t'" \
    "select 'customers',count(*) from public.customers" \
    "select 'order_items',count(*) from public.order_items" \
    "select 'conversations',count(*) from public.conversations" \
    "select 'messages',count(*) from public.messages" \
    "select 'rev_v3',md5(public.merchant_revenue_v3('$t','2026-01-01','2026-12-31')::text)" \
    "select 'paid_daily',md5(coalesce(string_agg(x::text,',' order by x::text),''))  from public.merchant_paid_orders_daily('$t',3650) x"
  do
    res=$(printf "BEGIN;\nSET LOCAL ROLE authenticated;\nSELECT set_config('request.jwt.claims','{\"sub\":\"%s\",\"role\":\"authenticated\"}',true) \\\\gset\n%s;\nROLLBACK;\n" "$u" "$stmt" | q | grep '|' ) || res="ERR"
    echo "$r|$a|${res:-ERR}" >> "$out"
  done
done <<< "$members"
for stmt in "select 'anon_products',count(*) from public.products" "select 'anon_orders',count(*) from public.orders"; do
  res=$(printf "BEGIN;\nSET LOCAL ROLE anon;\n%s;\nROLLBACK;\n" "$stmt" | q | grep '|') || res="DENIED"
  echo "anon|${res:-DENIED}" >> "$out"
done
echo "SNAPSHOT lines=$(wc -l < "$out") md5=$(md5sum < "$out" | cut -c1-32) err=$(grep -c '|ERR$' "$out")"
