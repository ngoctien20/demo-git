#!/usr/bin/env bash
# TIEN404 V20 step 3 — OFFLINE UAT of the Store admin RPCs (30) on a disposable local PostgreSQL.
# Simulated Supabase roles + JWT claims; NOT hosted acceptance. Refuses non-local hosts.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
: "${PGHOST:?}"; : "${PGPORT:?}"; : "${PGUSER:=postgres}"; PGDATABASE=t404_v20_admin
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

TA=9c8c524c-88db-4771-8ab0-a4316298494c; TB=4b12fc28-4fc3-4b06-bbf1-72a1f62ad5c5
OA=a0000000-0000-4000-8000-00000000000a; OB=b0000000-0000-4000-8000-00000000000b
MGR=a0000000-0000-4000-8000-0000000000d1   # tenant A manager, no Store rights yet
STF=a0000000-0000-4000-8000-0000000000d2   # tenant A staff, no Store rights yet

"${PSQL[@]}" -d postgres -c "DROP DATABASE IF EXISTS $PGDATABASE" -c "CREATE DATABASE $PGDATABASE" >/dev/null
"${PSQL[@]}" -d "$PGDATABASE" -f "$DIR/00_hosted_baseline_replica.sql" >/dev/null
runfile "$DIR/10_store_authority_expand.sql" T404_V20_STORE_AUTHORITY_EXPAND_OK
runfile "$DIR/20_store_aware_writer.sql" T404_V20_STORE_AWARE_WRITER_OK
admin "INSERT INTO auth.users(id,email) VALUES ('$MGR','mgr-a@qa.invalid'),('$STF','staff-a@qa.invalid');
       INSERT INTO public.tenant_memberships(tenant_id,user_id,role) VALUES ('$TA','$MGR','manager'),('$TA','$STF','staff');" >/dev/null
runfile "$DIR/30_store_admin_rpcs.sql" T404_V20_STORE_ADMIN_RPCS_OK
deny ADMIN_NOT_REAPPLIABLE 'T404_ADMIN_PRECHECK_ALREADY_APPLIED' "${PSQL[@]}" -d "$PGDATABASE" -f "$DIR/30_store_admin_rpcs.sql"

# --- create_store ---------------------------------------------------------------------
deny ANON_CREATE_STORE 'permission denied' as anon "SELECT public.create_store('$TA','x-anon','x')"
deny CROSS_TENANT_CREATE_STORE 'access_denied' as $OB "SELECT public.create_store('$TA','b-into-a','x')"
deny MANAGER_CREATE_STORE 'access_denied' as $MGR "SELECT public.create_store('$TA','mgr-store','x')"
deny DIRECT_STORE_INSERT 'permission denied' as $OA "INSERT INTO public.stores(tenant_id,store_key,name) VALUES ('$TA','direct','x')"
S2=$(as $OA "SELECT public.create_store('$TA','branch-2','Chi nhánh 2')")
ok "$(admin "SELECT count(*) FROM public.stores WHERE id='$S2' AND NOT is_default")" 1 OWNER_CREATES_SECOND_STORE
ok "$(admin "SELECT role FROM public.store_memberships WHERE store_id='$S2' AND user_id='$OA'")" owner CREATOR_IS_STORE_OWNER
deny RESERVED_KEY 'invalid_store' as $OA "SELECT public.create_store('$TA','main','x')"
deny DUPLICATE_KEY 'store_key_taken' as $OA "SELECT public.create_store('$TA','branch-2','x')"
ok "$(as $OA 'SELECT count(*) FROM public.stores')" 2 OWNER_SEES_BOTH_STORES
ok "$(as $OB "SELECT count(*) FROM public.stores WHERE tenant_id='$TA'")" 0 OTHER_TENANT_CANNOT_SEE_STORES
ok "$(admin "SELECT count(*) FROM app_private.audit_events WHERE event_type='store_create'")" 1 STORE_CREATE_AUDITED

# --- set_store_member -----------------------------------------------------------------
ok "$(as $MGR 'SELECT count(*) FROM public.products')" 0 TENANT_MANAGER_WITHOUT_STORE_SEES_NOTHING
deny MEMBER_SELF_EDIT 'invalid_member' as $OA "SELECT public.set_store_member('$S2','$OA','manager',true)"
deny NON_TENANT_MEMBER 'not_a_tenant_member' as $OA "SELECT public.set_store_member('$S2','$OB','manager',true)"
deny CROSS_TENANT_SET_MEMBER 'access_denied' as $OB "SELECT public.set_store_member('$S2','$MGR','owner',true)"
deny DIRECT_MEMBERSHIP_INSERT 'permission denied' as $MGR "INSERT INTO public.store_memberships(tenant_id,store_id,user_id,role) VALUES ('$TA','$S2','$MGR','owner')"
as $OA "SELECT public.set_store_member('$S2','$MGR','manager',true)" >/dev/null
ok "$(admin "SELECT role||active FROM public.store_memberships WHERE store_id='$S2' AND user_id='$MGR'")" managertrue OWNER_ADDS_STORE_MANAGER
deny MANAGER_CANNOT_GRANT 'access_denied' as $MGR "SELECT public.set_store_member('$S2','$STF','owner',true)"
as $OA "SELECT public.set_store_member('$S2','$STF','staff',true)" >/dev/null

# --- save_merchant_product_in_store -----------------------------------------------------
TS=$(as $MGR "SELECT public.save_merchant_product_in_store('$S2','QA-S2-001','Hàng chi nhánh 2',99000,true,3,NULL)")
ok "$(admin "SELECT count(*) FROM public.products WHERE sku='QA-S2-001' AND store_id='$S2'")" 1 STORE_MANAGER_CREATES_IN_OWN_STORE
ok "$(as $MGR "SELECT string_agg(sku,',') FROM public.products")" QA-S2-001 STORE_MANAGER_SEES_ONLY_OWN_STORE
as $MGR "SELECT public.save_merchant_product_in_store('$S2','QA-S2-001','Hàng chi nhánh 2 sửa',99000,true,NULL,'$TS'::timestamptz)" >/dev/null
ok "$(admin "SELECT name FROM public.products WHERE sku='QA-S2-001'")" 'Hàng chi nhánh 2 sửa' STORE_MANAGER_EDITS_OWN_STORE
deny STALE_EDIT 'product_changed_or_missing' as $MGR "SELECT public.save_merchant_product_in_store('$S2','QA-S2-001','x',1,true,NULL,'$TS'::timestamptz)"
MAIN=$(admin "SELECT id FROM public.stores WHERE tenant_id='$TA' AND is_default")
deny MANAGER_OTHER_STORE 'access_denied' as $MGR "SELECT public.save_merchant_product_in_store('$MAIN','QA-MGR-X','x',1,true,0,NULL)"
deny MANAGER_V1_DEFAULT_STORE 'access_denied' as $MGR "SELECT public.save_merchant_product('$TA','QA-MGR-Y','x',1,true,0,NULL)"
deny STAFF_WRITE 'access_denied' as $STF "SELECT public.save_merchant_product_in_store('$S2','QA-STF-X','x',1,true,0,NULL)"
ok "$(as $STF 'SELECT count(*) FROM public.products')" 1 STAFF_READS_STORE_PRODUCTS
ok "$(as $STF 'SELECT count(*) FROM public.orders')" 0 STAFF_CANNOT_READ_ORDERS
deny SKU_TENANT_UNIQUE 'sku_taken' as $OA "SELECT public.save_merchant_product_in_store('$S2','QA-A001','dup',1,true,0,NULL)"
deny CROSS_TENANT_WRITE 'access_denied' as $OB "SELECT public.save_merchant_product_in_store('$S2','QA-B-X','x',1,true,0,NULL)"
deny ANON_WRITE 'permission denied' as anon "SELECT public.save_merchant_product_in_store('$S2','QA-ANON','x',1,true,0,NULL)"
ok "$(as $OA "SELECT count(*) FROM public.products")" 2 TENANT_OWNER_SEES_MAIN_AND_BRANCH
ok "$(as $OB "SELECT count(*) FROM public.products WHERE sku='QA-S2-001'")" 0 OTHER_TENANT_CANNOT_SEE_BRANCH_PRODUCT
as $OA "SELECT public.save_merchant_product('$TA','QA-A010','Main via v1',1000,true,1,NULL)" >/dev/null
ok "$(admin "SELECT s.is_default FROM public.products p JOIN public.stores s ON s.id=p.store_id WHERE p.sku='QA-A010'")" t V1_WRITER_STILL_DEFAULT_STORE

# --- last owner + revocation ----------------------------------------------------------
as $OA "SELECT public.set_store_member('$S2','$MGR','owner',true)" >/dev/null
as $MGR "SELECT public.set_store_member('$S2','$OA','owner',false)" >/dev/null
ok "$(admin "SELECT active FROM public.store_memberships WHERE store_id='$S2' AND user_id='$OA'")" f STORE_OWNER_CAN_DEACTIVATE_OTHER_OWNER
deny LAST_STORE_OWNER 'last_store_owner' as $OA "SELECT public.set_store_member('$S2','$MGR','manager',true)"
ok "$(as $OA "SELECT public.set_store_member('$S2','$OA','owner',true)" 2>&1 | grep -c invalid_member)" 1 TENANT_OWNER_CANNOT_SELF_REINSTATE
as $MGR "SELECT public.set_store_member('$S2','$STF','staff',false)" >/dev/null
ok "$(as $STF 'SELECT count(*) FROM public.products')" 0 REVOKED_STAFF_LOSES_READ
admin "UPDATE public.stores SET active=false WHERE id='$S2'" >/dev/null
ok "$(as $MGR 'SELECT count(*) FROM public.products')" 0 INACTIVE_STORE_HIDES_PRODUCTS
deny INACTIVE_STORE_WRITE 'access_denied' as $MGR "SELECT public.save_merchant_product_in_store('$S2','QA-S2-002','x',1,true,0,NULL)"
admin "UPDATE public.stores SET active=true WHERE id='$S2'" >/dev/null

# --- rollback ---------------------------------------------------------------------------
runfile "$DIR/70_store_admin_rpcs_rollback.sql" T404_V20_STORE_ADMIN_RPCS_ROLLBACK_OK
ok "$(admin "SELECT to_regprocedure('public.create_store(uuid,text,text)') IS NULL")" t ADMIN_RPCS_REMOVED
ok "$(admin "SELECT count(*) FROM public.stores WHERE id='$S2'")" 1 STORE_DATA_KEPT_AFTER_RPC_ROLLBACK
deny FULL_ROLLBACK_REFUSED_WITH_TWO_STORES 'T404_ROLLBACK_REFUSED_MULTI_STORE_DATA_EXISTS' "${PSQL[@]}" -d "$PGDATABASE" -f "$DIR/90_store_authority_rollback.sql"
runfile "$DIR/30_store_admin_rpcs.sql" T404_V20_STORE_ADMIN_RPCS_OK
echo "OFFLINE_ADMIN_UAT_PASS=$PASS (simulated roles; NOT hosted acceptance)"
