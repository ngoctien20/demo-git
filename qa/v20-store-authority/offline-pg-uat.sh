#!/usr/bin/env bash
# TIEN404 V20 Store Authority — OFFLINE UAT on a disposable local PostgreSQL.
# Refuses any non-local host. Simulates Supabase roles + auth.uid() from JWT claims;
# this is NOT hosted acceptance and NOT real GoTrue (see ci-local-gotrue-uat.mjs for that).
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
: "${PGHOST:?set PGHOST to a local socket dir or 127.0.0.1}"
: "${PGPORT:?}"; : "${PGUSER:=postgres}"; : "${PGDATABASE:=t404_v20_store}"
case "$PGHOST" in /*|127.0.0.1|localhost) ;; *) echo "REFUSE_NON_LOCAL_HOST"; exit 2;; esac
[ -z "${SUPABASE_DB_URL:-}${SUPABASE_ACCESS_TOKEN:-}${DATABASE_URL:-}" ] || { echo "REFUSE_HOSTED_ENV"; exit 2; }
export PGHOST PGPORT PGUSER
PASS=0
PSQL=(psql -X -q -v ON_ERROR_STOP=1 -At)
admin(){ "${PSQL[@]}" -d "$PGDATABASE" -c "$1"; }
# as <uid|anon> <sql> -> runs SQL with Supabase-like role + JWT sub claim
as(){
  local who="$1" sql="$2" role=authenticated claims
  if [ "$who" = anon ]; then role=anon; claims='{"role":"anon"}'; else claims="{\"sub\":\"$who\",\"role\":\"authenticated\"}"; fi
  "${PSQL[@]}" -d "$PGDATABASE" -c "SET ROLE $role" -c "SELECT set_config('request.jwt.claims','$claims',false)" -c "$sql" | tail -n 1
}
ok(){ if [ "$1" = "$2" ]; then PASS=$((PASS+1)); echo "PASS_$3"; else echo "FAIL_$3 expected=[$2] got=[$1]"; exit 1; fi; }
denied(){ # expects the statement to fail with one of the SQLSTATE-class messages
  local out; if out=$("$@" 2>&1); then echo "FAIL_${DENY_TAG} unexpectedly accepted: $out"; exit 1; fi
  if echo "$out" | grep -Eq "$DENY_RE"; then PASS=$((PASS+1)); echo "PASS_DENY_${DENY_TAG}"; else echo "FAIL_${DENY_TAG} wrong error: $out"; exit 1; fi
}
fingerprint(){ admin "SELECT md5(string_agg(x,'|' ORDER BY x)) FROM (
  SELECT 'c:'||table_name||'.'||column_name||':'||data_type||':'||is_nullable FROM information_schema.columns WHERE table_schema='public'
  UNION ALL SELECT 'k:'||conrelid::regclass||':'||conname||':'||pg_get_constraintdef(oid) FROM pg_constraint WHERE connamespace='public'::regnamespace
  UNION ALL SELECT 'p:'||tablename||':'||policyname||':'||cmd||':'||coalesce(qual,'') FROM pg_policies WHERE schemaname='public'
  UNION ALL SELECT 'i:'||indexdef FROM pg_indexes WHERE schemaname='public'
  UNION ALL SELECT 't:'||tgrelid::regclass||':'||tgname FROM pg_trigger WHERE NOT tgisinternal AND tgrelid::regclass::text NOT LIKE 'auth.%'
  UNION ALL SELECT 'g:'||table_name||':'||grantee||':'||privilege_type FROM information_schema.role_table_grants WHERE table_schema='public' AND grantee IN ('anon','authenticated')
 ) s(x)"; }

TA=9c8c524c-88db-4771-8ab0-a4316298494c; TB=4b12fc28-4fc3-4b06-bbf1-72a1f62ad5c5
OA=a0000000-0000-4000-8000-00000000000a; OB=b0000000-0000-4000-8000-00000000000b
OBR=a0000000-0000-4000-8000-0000000000c1   # owner of a 2nd Store inside tenant A only
STF=a0000000-0000-4000-8000-0000000000c2   # staff in tenant A main store
TMO=a0000000-0000-4000-8000-0000000000c3   # tenant A member with NO store rights

"${PSQL[@]}" -d postgres -c "DROP DATABASE IF EXISTS $PGDATABASE" -c "CREATE DATABASE $PGDATABASE" >/dev/null
"${PSQL[@]}" -d "$PGDATABASE" -f "$DIR/00_hosted_baseline_replica.sql" >/dev/null
BASE_FP=$(fingerprint)
ok "$(as $OA 'SELECT count(*) FROM public.products')" 1 BASELINE_OWNER_A_SEES_OWN_PRODUCT

runfile(){ local out; out=$("${PSQL[@]}" -d "$PGDATABASE" -f "$1" 2>&1) || { echo "$out"; echo "FAIL_RUN_$2"; exit 1; }
  echo "$out" | grep -q "$2" || { echo "$out"; echo "FAIL_MARKER_$2"; exit 1; }; }
runfile "$DIR/10_store_authority_expand.sql" T404_V20_STORE_AUTHORITY_EXPAND_OK
PASS=$((PASS+1)); echo PASS_MIGRATION_APPLIED_WITH_POSTCONDITIONS
DENY_TAG=MIGRATION_NOT_REAPPLIABLE DENY_RE='T404_PRECHECK_STORE_TABLES_ALREADY_EXIST' denied "${PSQL[@]}" -d "$PGDATABASE" -f "$DIR/10_store_authority_expand.sql"

# --- no access loss at cutover ---------------------------------------------------------
ok "$(as $OA 'SELECT count(*) FROM public.products')" 1 OWNER_A_KEEPS_PRODUCTS
ok "$(as $OA 'SELECT count(*) FROM public.orders')" 1 OWNER_A_KEEPS_ORDERS
ok "$(as $OB "SELECT string_agg(sku,',') FROM public.products")" QA-B001 OWNER_B_KEEPS_ONLY_B
ok "$(as $OA "SELECT count(*) FROM public.products WHERE tenant_id='$TB'")" 0 CROSS_TENANT_DENIED
ok "$(admin 'SELECT count(*) FROM public.products WHERE store_id IS NULL')" 0 BACKFILL_COMPLETE

# --- second Store in tenant A ----------------------------------------------------------
admin "INSERT INTO auth.users(id,email) VALUES ('$OBR','branch@qa.invalid'),('$STF','staff@qa.invalid'),('$TMO','member@qa.invalid');
 INSERT INTO public.tenant_memberships(tenant_id,user_id,role) VALUES ('$TA','$OBR','owner'),('$TA','$STF','staff'),('$TA','$TMO','manager');
 INSERT INTO public.stores(id,tenant_id,store_key,name) VALUES ('e0000000-0000-4000-8000-0000000000a2','$TA','branch','Chi nhánh');
 INSERT INTO public.store_memberships(tenant_id,store_id,user_id,role) VALUES
  ('$TA','e0000000-0000-4000-8000-0000000000a2','$OBR','owner'),
  ('$TA',(SELECT id FROM public.stores WHERE tenant_id='$TA' AND is_default),'$STF','staff');
 INSERT INTO public.products(id,tenant_id,store_id,sku,name,price_vnd,stock_on_hand) VALUES
  ('c0000000-0000-4000-8000-0000000000a2','$TA','e0000000-0000-4000-8000-0000000000a2','QA-A002','Branch item',199000,3);
 INSERT INTO public.customers(id,tenant_id,store_id,display_name) VALUES
  ('f0000000-0000-4000-8000-0000000000a2','$TA','e0000000-0000-4000-8000-0000000000a2','Khách chi nhánh');
 INSERT INTO public.orders(id,tenant_id,store_id,customer_id,total_vnd) VALUES
  ('d0000000-0000-4000-8000-0000000000a2','$TA','e0000000-0000-4000-8000-0000000000a2','f0000000-0000-4000-8000-0000000000a2',199000);
 INSERT INTO public.order_items(tenant_id,order_id,product_id,quantity,unit_price_vnd) VALUES
  ('$TA','d0000000-0000-4000-8000-0000000000a2','c0000000-0000-4000-8000-0000000000a2',1,199000);
 INSERT INTO public.conversations(id,tenant_id,store_id,channel) VALUES ('90000000-0000-4000-8000-0000000000a2','$TA','e0000000-0000-4000-8000-0000000000a2','zalo');
 INSERT INTO public.messages(tenant_id,conversation_id,sender,body) VALUES ('$TA','90000000-0000-4000-8000-0000000000a2','customer','xin chào');" >/dev/null
ok "$(admin "SELECT store_id FROM public.order_items WHERE order_id='d0000000-0000-4000-8000-0000000000a2'")" e0000000-0000-4000-8000-0000000000a2 CHILD_ITEM_INHERITS_ORDER_STORE
ok "$(admin "SELECT store_id FROM public.messages WHERE conversation_id='90000000-0000-4000-8000-0000000000a2'")" e0000000-0000-4000-8000-0000000000a2 CHILD_MESSAGE_INHERITS_CONVERSATION_STORE

for t in products customers orders order_items conversations messages; do
  ok "$(as $OA "SELECT count(*) FROM public.$t WHERE store_id='e0000000-0000-4000-8000-0000000000a2'")" 0 MAIN_OWNER_${t}_CROSS_STORE_DENIED
  ok "$(as $OBR "SELECT count(*) FROM public.$t WHERE store_id<>'e0000000-0000-4000-8000-0000000000a2'")" 0 BRANCH_OWNER_${t}_ONLY_OWN_STORE
  ok "$(as $OBR "SELECT count(*)>0 FROM public.$t")" t BRANCH_OWNER_${t}_OWN_ALLOWED
  ok "$(as $TMO "SELECT count(*) FROM public.$t")" 0 TENANT_MEMBER_WITHOUT_STORE_${t}_DENIED
done
ok "$(as $STF 'SELECT count(*) FROM public.products')" 1 STAFF_SEES_STORE_PRODUCTS
ok "$(as $STF 'SELECT count(*) FROM public.orders')" 0 STAFF_CANNOT_SEE_ORDERS
ok "$(as $OBR "SELECT store_key FROM public.stores")" branch BRANCH_OWNER_SEES_ONLY_OWN_STORE_ROW
ok "$(as $OA "SELECT count(*) FROM public.store_memberships")" 1 MEMBERSHIP_SELF_READ_ONLY

# --- Data API privilege surface --------------------------------------------------------
DENY_TAG=ANON_STORES DENY_RE='permission denied' denied as anon 'SELECT count(*) FROM public.stores'
DENY_TAG=ANON_PRODUCTS DENY_RE='permission denied' denied as anon 'SELECT count(*) FROM public.products'
DENY_TAG=AUTH_INSERT_STORE DENY_RE='permission denied' denied as $OA "INSERT INTO public.stores(tenant_id,store_key,name) VALUES ('$TA','x1','x')"
DENY_TAG=AUTH_SELF_GRANT_MEMBERSHIP DENY_RE='permission denied' denied as $TMO "INSERT INTO public.store_memberships(tenant_id,store_id,user_id,role) VALUES ('$TA','e0000000-0000-4000-8000-0000000000a2','$TMO','owner')"
DENY_TAG=AUTH_CALL_GUARD_FN DENY_RE='permission denied' denied as $OA 'SELECT app_private.t404_store_scope_guard()'

# --- Integrity: cross-store / cross-tenant writes rejected even for service writers -----
DENY_RE='violates foreign key|store_scope_immutable|violates not-null'
DENY_TAG=ITEM_ORDER_MAIN_PRODUCT_BRANCH denied admin "INSERT INTO public.order_items(tenant_id,order_id,product_id,quantity,unit_price_vnd) VALUES ('$TA','d0000000-0000-4000-8000-0000000000a1','c0000000-0000-4000-8000-0000000000a2',1,1)"
DENY_TAG=ORDER_CUSTOMER_OTHER_STORE denied admin "INSERT INTO public.orders(tenant_id,store_id,customer_id,total_vnd) VALUES ('$TA',(SELECT id FROM public.stores WHERE tenant_id='$TA' AND is_default),'f0000000-0000-4000-8000-0000000000a2',1)"
DENY_TAG=MESSAGE_CONVERSATION_OTHER_STORE denied admin "INSERT INTO public.messages(tenant_id,store_id,conversation_id,sender,body) VALUES ('$TA',(SELECT id FROM public.stores WHERE tenant_id='$TA' AND is_default),'90000000-0000-4000-8000-0000000000a2','customer','x')"
DENY_TAG=PRODUCT_STORE_OF_OTHER_TENANT denied admin "INSERT INTO public.products(tenant_id,store_id,sku,name,price_vnd) VALUES ('$TB','e0000000-0000-4000-8000-0000000000a2','X9','x',1)"
DENY_TAG=MOVE_ROW_TO_OTHER_STORE denied admin "UPDATE public.products SET store_id='e0000000-0000-4000-8000-0000000000a2' WHERE id='c0000000-0000-4000-8000-0000000000a1'"
DENY_TAG=MEMBERSHIP_FOR_NON_TENANT_MEMBER denied admin "INSERT INTO public.store_memberships(tenant_id,store_id,user_id,role) VALUES ('$TA','e0000000-0000-4000-8000-0000000000a2','$OB','owner')"
DENY_RE='duplicate key'
DENY_TAG=SECOND_DEFAULT_STORE denied admin "INSERT INTO public.stores(tenant_id,store_key,name,is_default) VALUES ('$TA','dup','dup',true)"

# --- Live writer compatibility (save_merchant_product, unchanged) ----------------------
TS=$(as $OA "SELECT public.save_merchant_product('$TA','QA-A003','Writer compat',120000,true,4,NULL)")
ok "$(admin "SELECT s.is_default FROM public.products p JOIN public.stores s ON s.id=p.store_id WHERE p.sku='QA-A003'")" t LEGACY_WRITER_CREATE_LANDS_IN_DEFAULT_STORE
as $OA "SELECT public.save_merchant_product('$TA','QA-A003','Writer compat 2',130000,true,NULL,'$TS'::timestamptz)" >/dev/null
ok "$(admin "SELECT price_vnd FROM public.products WHERE sku='QA-A003'")" 130000 LEGACY_WRITER_UPDATE_BY_TENANT_SKU_WORKS
ok "$(admin "SELECT count(*) FROM app_private.audit_events WHERE metadata->>'sku'='QA-A003'")" 2 LEGACY_WRITER_AUDIT_UNCHANGED

# --- New tenant onboarding still works -------------------------------------------------
admin "INSERT INTO public.tenants(id,slug,name) VALUES ('11111111-0000-4000-8000-000000000001','qa-new-tenant','QA New');
 INSERT INTO public.products(tenant_id,sku,name,price_vnd) VALUES ('11111111-0000-4000-8000-000000000001','N1','n',1)" >/dev/null
ok "$(admin "SELECT count(*) FROM public.products p JOIN public.stores s ON s.id=p.store_id AND s.is_default WHERE p.tenant_id='11111111-0000-4000-8000-000000000001'")" 1 NEW_TENANT_GETS_DEFAULT_STORE

# --- Revocation is immediate (same JWT) ------------------------------------------------
admin "UPDATE public.store_memberships SET active=false WHERE user_id='$OBR'" >/dev/null
ok "$(as $OBR 'SELECT count(*) FROM public.orders')" 0 REVOKED_STORE_MEMBERSHIP_DENIED_SAME_JWT
admin "UPDATE public.store_memberships SET active=true WHERE user_id='$OBR'; UPDATE public.tenant_memberships SET active=false WHERE user_id='$OBR'" >/dev/null
ok "$(as $OBR 'SELECT count(*) FROM public.orders')" 0 REVOKED_TENANT_MEMBERSHIP_OVERRIDES_STORE
admin "UPDATE public.tenant_memberships SET active=true WHERE user_id='$OBR'; UPDATE public.stores SET active=false WHERE id='e0000000-0000-4000-8000-0000000000a2'" >/dev/null
ok "$(as $OBR 'SELECT count(*) FROM public.products')" 0 INACTIVE_STORE_DENIED
ok "$(as $OA 'SELECT count(*) FROM public.products')" 2 OTHER_STORE_UNAFFECTED
ok "$(as $OB 'SELECT count(*) FROM public.products')" 1 OTHER_TENANT_UNAFFECTED

# --- Rollback --------------------------------------------------------------------------
DENY_TAG=ROLLBACK_REFUSES_MULTI_STORE DENY_RE='T404_ROLLBACK_REFUSED_MULTI_STORE_DATA_EXISTS' denied "${PSQL[@]}" -d "$PGDATABASE" -f "$DIR/90_store_authority_rollback.sql"
admin "DELETE FROM public.messages WHERE store_id='e0000000-0000-4000-8000-0000000000a2';
 DELETE FROM public.conversations WHERE store_id='e0000000-0000-4000-8000-0000000000a2';
 DELETE FROM public.order_items WHERE store_id='e0000000-0000-4000-8000-0000000000a2';
 DELETE FROM public.orders WHERE store_id='e0000000-0000-4000-8000-0000000000a2';
 DELETE FROM public.customers WHERE store_id='e0000000-0000-4000-8000-0000000000a2';
 DELETE FROM public.products WHERE store_id='e0000000-0000-4000-8000-0000000000a2';
 DELETE FROM public.store_memberships WHERE store_id='e0000000-0000-4000-8000-0000000000a2';
 DELETE FROM public.stores WHERE id='e0000000-0000-4000-8000-0000000000a2'" >/dev/null
runfile "$DIR/90_store_authority_rollback.sql" T404_V20_STORE_AUTHORITY_ROLLBACK_OK
PASS=$((PASS+1)); echo PASS_ROLLBACK_APPLIED
ok "$(fingerprint)" "$BASE_FP" ROLLBACK_SCHEMA_FINGERPRINT_EQUALS_BASELINE
ok "$(as $OA 'SELECT count(*) FROM public.products')" 2 ROLLBACK_OWNER_A_ACCESS_RESTORED
ok "$(as $TMO 'SELECT count(*) FROM public.orders')" 1 ROLLBACK_TENANT_MANAGER_REGAINS_TENANT_LEVEL_READ

echo "{\"checkpoint\":\"V20_STORE_AUTHORITY_EXPAND_OFFLINE_PG\",\"status\":\"PASS\",\"passed\":$PASS,\"failed\":0,\"realGoTrueJwt\":false,\"hostedConnections\":0,\"hostedMigrations\":0,\"productionReady\":false}"
