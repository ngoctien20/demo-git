#!/usr/bin/env bash
# TIEN404 V20 step 4 — OFFLINE UAT of the SKU contract (40) and its rollback (60) on a
# disposable local PostgreSQL. Simulated Supabase roles + JWT claims; NOT hosted acceptance.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
: "${PGHOST:?}"; : "${PGPORT:?}"; : "${PGUSER:=postgres}"; PGDATABASE=t404_v20_contract
case "$PGHOST" in /*|127.0.0.1|localhost) ;; *) echo "REFUSE_NON_LOCAL_HOST"; exit 2;; esac
[ -z "${SUPABASE_DB_URL:-}${SUPABASE_ACCESS_TOKEN:-}${DATABASE_URL:-}" ] || { echo "REFUSE_HOSTED_ENV"; exit 2; }
export PGHOST PGPORT PGUSER
PASS=0; PSQL=(psql -X -q -v ON_ERROR_STOP=1 -At)
admin(){ "${PSQL[@]}" -d "$PGDATABASE" -c "$1"; }
as(){ local who="$1" sql="$2" role=authenticated claims
  if [ "$who" = anon ]; then role=anon; claims='{"role":"anon"}'; else claims="{\"sub\":\"$who\",\"role\":\"authenticated\"}"; fi
  "${PSQL[@]}" -d "$PGDATABASE" -c "SET ROLE $role" -c "SELECT set_config('request.jwt.claims','$claims',false)" -c "$sql" | tail -n 1; }
ok(){ if [ "$1" = "$2" ]; then PASS=$((PASS+1)); echo "PASS_$3"; else echo "FAIL_$3 expected=[$2] got=[$1]"; exit 1; fi; }
deny(){ local tag=$1 re=$2; shift 2; local out
  if out=$("$@" 2>&1); then echo "FAIL_${tag} unexpectedly accepted: $out"; exit 1; fi
  if echo "$out" | grep -Eq "$re"; then PASS=$((PASS+1)); echo "PASS_DENY_${tag}"; else echo "FAIL_${tag} wrong error: $out"; exit 1; fi; }
runfile(){ local out; out=$("${PSQL[@]}" -d "$PGDATABASE" -f "$1" 2>&1) || { echo "$out"; echo "FAIL_RUN_$2"; exit 1; }
  echo "$out" | grep -q "$2" || { echo "$out"; echo "FAIL_MARKER_$2"; exit 1; }; PASS=$((PASS+1)); echo "PASS_$2"; }
fp(){ "${PSQL[@]}" -d "$PGDATABASE" -f "$DIR/hosted/fingerprint.sql" | tail -1 | cut -d'|' -f1; }
wmd5(){ admin "SELECT md5(pg_get_functiondef('public.save_merchant_product(uuid,text,text,bigint,boolean,integer,timestamptz)'::regprocedure))"; }

TA=9c8c524c-88db-4771-8ab0-a4316298494c; TB=4b12fc28-4fc3-4b06-bbf1-72a1f62ad5c5
OA=a0000000-0000-4000-8000-00000000000a; OB=b0000000-0000-4000-8000-00000000000b
MGR=a0000000-0000-4000-8000-0000000000d1   # tenant A manager, branch Store only

"${PSQL[@]}" -d postgres -c "DROP DATABASE IF EXISTS $PGDATABASE" -c "CREATE DATABASE $PGDATABASE" >/dev/null
"${PSQL[@]}" -d "$PGDATABASE" -f "$DIR/00_hosted_baseline_replica.sql" >/dev/null
runfile "$DIR/10_store_authority_expand.sql" T404_V20_STORE_AUTHORITY_EXPAND_OK
runfile "$DIR/20_store_aware_writer.sql" T404_V20_STORE_AWARE_WRITER_OK
admin "INSERT INTO auth.users(id,email) VALUES ('$MGR','mgr-a@qa.invalid');
       INSERT INTO public.tenant_memberships(tenant_id,user_id,role) VALUES ('$TA','$MGR','manager');" >/dev/null
runfile "$DIR/30_store_admin_rpcs.sql" T404_V20_STORE_ADMIN_RPCS_OK
FP30=$(fp); W20=$(wmd5)
MAIN=$(admin "SELECT id FROM public.stores WHERE tenant_id='$TA' AND is_default")
S2=$(as $OA "SELECT public.create_store('$TA','branch-2','Chi nhánh 2')")
as $OA "SELECT public.set_store_member('$S2','$MGR','manager',true)" >/dev/null

# --- before contract: tenant-wide SKU still enforced ----------------------------------------
deny PRE_CONTRACT_SKU_TENANT_WIDE 'sku_taken' as $OA "SELECT public.save_merchant_product_in_store('$S2','QA-A001','dup',1,true,0,NULL)"
runfile "$DIR/40_store_sku_contract.sql" T404_V20_STORE_SKU_CONTRACT_OK
deny CONTRACT_NOT_REAPPLIABLE 'T404_CONTRACT_PRECHECK_ALREADY_APPLIED' "${PSQL[@]}" -d "$PGDATABASE" -f "$DIR/40_store_sku_contract.sql"
ok "$(admin "SELECT count(*) FROM pg_constraint WHERE conrelid='public.products'::regclass AND conname='products_tenant_id_sku_key'")" 0 TENANT_SKU_KEY_DROPPED
ok "$(admin "SELECT count(*) FROM pg_constraint WHERE conrelid='public.products'::regclass AND conname='products_tenant_store_sku_key'")" 1 STORE_SKU_KEY_KEPT
ok "$(admin "SELECT has_function_privilege('anon','public.save_merchant_product(uuid,text,text,bigint,boolean,integer,timestamptz)','EXECUTE')")" f ANON_NO_EXECUTE_V1
deny ANON_V1_WRITE 'permission denied' as anon "SELECT public.save_merchant_product('$TA','QA-ANON','x',1,true,0,NULL)"

# --- same SKU in two Stores ------------------------------------------------------------------
T2=$(as $MGR "SELECT public.save_merchant_product_in_store('$S2','QA-A001','QA A chi nhánh',149000,true,2,NULL)")
ok "$(admin "SELECT count(*)||':'||count(DISTINCT store_id) FROM public.products WHERE tenant_id='$TA' AND sku='QA-A001'")" 2:2 SAME_SKU_IN_TWO_STORES
ok "$(admin "SELECT price_vnd FROM public.products WHERE store_id='$S2' AND sku='QA-A001'")" 149000 BRANCH_OWN_PRICE
ok "$(admin "SELECT price_vnd||':'||stock_on_hand FROM public.products WHERE store_id='$MAIN' AND sku='QA-A001'")" 159000:5 MAIN_ROW_UNTOUCHED
deny SAME_STORE_DUP_SKU 'sku_taken' as $MGR "SELECT public.save_merchant_product_in_store('$S2','QA-A001','dup',1,true,0,NULL)"
as $MGR "SELECT public.save_merchant_product_in_store('$S2','QA-A001','QA A chi nhánh sửa',139000,true,NULL,'$T2'::timestamptz)" >/dev/null
ok "$(admin "SELECT string_agg(price_vnd::text,',' ORDER BY price_vnd) FROM public.products WHERE tenant_id='$TA' AND sku='QA-A001'")" 139000,159000 BRANCH_EDIT_ONLY_BRANCH_ROW
ok "$(as $MGR "SELECT count(*) FROM public.products WHERE sku='QA-A001'")" 1 BRANCH_MANAGER_SEES_ONLY_BRANCH_COPY
ok "$(as $OA "SELECT count(*) FROM public.products WHERE sku='QA-A001'")" 2 TENANT_OWNER_SEES_BOTH_COPIES
ok "$(as $OB "SELECT count(*) FROM public.products WHERE sku='QA-A001'")" 0 OTHER_TENANT_SEES_NO_COPY

# --- legacy v1 writer pinned to the default Store ------------------------------------------
TM=$(admin "SELECT updated_at FROM public.products WHERE store_id='$MAIN' AND sku='QA-A001'")
as $OA "SELECT public.save_merchant_product('$TA','QA-A001','QA A main sửa',158000,true,NULL,'$TM'::timestamptz)" >/dev/null
ok "$(admin "SELECT string_agg(price_vnd::text,',' ORDER BY price_vnd) FROM public.products WHERE tenant_id='$TA' AND sku='QA-A001'")" 139000,158000 V1_EDIT_HITS_DEFAULT_STORE_ONLY
TB2=$(admin "SELECT updated_at FROM public.products WHERE store_id='$S2' AND sku='QA-A001'")
deny V1_CANNOT_EDIT_BRANCH_ROW 'product_changed_or_missing' as $OA "SELECT public.save_merchant_product('$TA','QA-A001','x',1,true,NULL,'$TB2'::timestamptz)"
as $MGR "SELECT public.save_merchant_product_in_store('$S2','QA-S2-ONLY','Chỉ chi nhánh',50000,true,1,NULL)" >/dev/null
as $OA "SELECT public.save_merchant_product('$TA','QA-S2-ONLY','Giờ có ở main',60000,true,4,NULL)" >/dev/null
ok "$(admin "SELECT string_agg(s.is_default::text,',' ORDER BY s.is_default) FROM public.products p JOIN public.stores s ON s.id=p.store_id WHERE p.tenant_id='$TA' AND p.sku='QA-S2-ONLY'")" false,true V1_CREATE_GOES_TO_DEFAULT_STORE
deny V1_DUP_IN_DEFAULT_STORE 'duplicate key|23505' as $OA "SELECT public.save_merchant_product('$TA','QA-S2-ONLY','x',1,true,0,NULL)"
deny BRANCH_MANAGER_V1_DENIED 'access_denied' as $MGR "SELECT public.save_merchant_product('$TA','QA-MGR-V1','x',1,true,0,NULL)"
deny CROSS_TENANT_V1_DENIED 'access_denied' as $OB "SELECT public.save_merchant_product('$TA','QA-B-INTO-A','x',1,true,0,NULL)"

# --- orders keep pointing at the right Store's product ---------------------------------------
PB=$(admin "SELECT id FROM public.products WHERE store_id='$S2' AND sku='QA-A001'")
deny ORDER_ITEM_CROSS_STORE 'order_items_product_same_store_fk' admin "INSERT INTO public.order_items(tenant_id,store_id,order_id,product_id,quantity,unit_price_vnd) VALUES ('$TA','$MAIN','d0000000-0000-4000-8000-0000000000a1','$PB',1,1)"

# --- rollback 60 ------------------------------------------------------------------------------
deny ROLLBACK_REFUSED_WITH_DUP_SKUS 'T404_CONTRACT_ROLLBACK_SKU_IN_SEVERAL_STORES' "${PSQL[@]}" -d "$PGDATABASE" -f "$DIR/60_store_sku_contract_rollback.sql"
deny FULL_ROLLBACK_REFUSED_WHILE_CONTRACT 'T404_ROLLBACK_REFUSED_RUN_60_FIRST' "${PSQL[@]}" -d "$PGDATABASE" -f "$DIR/90_store_authority_rollback.sql"
admin "DELETE FROM public.products WHERE store_id='$S2' AND sku IN ('QA-A001','QA-S2-ONLY')" >/dev/null
runfile "$DIR/60_store_sku_contract_rollback.sql" T404_V20_STORE_SKU_CONTRACT_ROLLBACK_OK
ok "$(fp)" "$FP30" FP_BACK_TO_STEP3
ok "$(wmd5)" "$W20" WRITER_BACK_TO_STEP2_BODY
deny POST_ROLLBACK_SKU_TENANT_WIDE 'sku_taken' as $MGR "SELECT public.save_merchant_product_in_store('$S2','QA-A001','dup',1,true,0,NULL)"
runfile "$DIR/40_store_sku_contract.sql" T404_V20_STORE_SKU_CONTRACT_OK
echo "FP40=$(fp)"
echo "OFFLINE_CONTRACT_UAT_PASS=$PASS (simulated roles; NOT hosted acceptance)"
