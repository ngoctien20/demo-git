#!/usr/bin/env bash
# TIEN404 V23 web — OFFLINE UAT of db/v23-web (leads, self-service shop, bot settings/FAQ/customer stage)
# on a disposable local PostgreSQL, stacked on the V20 Store Authority files (10, 20, 30).
# Simulated Supabase roles + JWT claims (same harness as qa/v20-store-authority). NOT hosted acceptance.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"; V20="$DIR/../v20-store-authority"; V23="$DIR/../../db/v23-web"
: "${PGHOST:?}"; : "${PGPORT:?}"; : "${PGUSER:=postgres}"; PGDATABASE=t404_v23_web
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
md5fn(){ admin "SELECT md5(pg_get_functiondef('$1'::regprocedure))"; }

TA=9c8c524c-88db-4771-8ab0-a4316298494c
OA=a0000000-0000-4000-8000-00000000000a; OB=b0000000-0000-4000-8000-00000000000b
U1=d0000000-0000-4000-8000-0000000000e1; U2=d0000000-0000-4000-8000-0000000000e2
UN=d0000000-0000-4000-8000-0000000000e9; STF=d0000000-0000-4000-8000-0000000000f1

"${PSQL[@]}" -d postgres -c "DROP DATABASE IF EXISTS $PGDATABASE" -c "CREATE DATABASE $PGDATABASE" >/dev/null
"${PSQL[@]}" -d "$PGDATABASE" -f "$V20/00_hosted_baseline_replica.sql" >/dev/null
admin "ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS email_confirmed_at timestamptz;
       UPDATE auth.users SET email_confirmed_at=now();
       INSERT INTO auth.users(id,email,email_confirmed_at) VALUES ('$U1','u1@qa.invalid',now()),('$U2','u2@qa.invalid',now()),
         ('$UN','unconfirmed@qa.invalid',NULL),('$STF','staff@qa.invalid',now());" >/dev/null
runfile "$V20/10_store_authority_expand.sql" T404_V20_STORE_AUTHORITY_EXPAND_OK
runfile "$V20/20_store_aware_writer.sql" T404_V20_STORE_AWARE_WRITER_OK
runfile "$V20/30_store_admin_rpcs.sql" T404_V20_STORE_ADMIN_RPCS_OK
V20_ALLOW=$(md5fn 'app_private.t404_qa_tenant_allowed(uuid)')

# ---------------- 10 leads ----------------
runfile "$V23/10_leads.sql" T404_V23_LEADS_OK
deny LEADS_NOT_REAPPLIABLE 'T404_V23_LEADS_ALREADY_APPLIED' "${PSQL[@]}" -d "$PGDATABASE" -f "$V23/10_leads.sql"
ok "$(as anon "SELECT public.submit_lead('Lan','Shop Lan','+84 912 345 678',NULL,'Thời trang','cua-hang','Cần AI trả lời giá','/contact.html')")" t ANON_SUBMITS_LEAD
ok "$(admin "SELECT phone FROM app_private.web_leads")" 0912345678 LEAD_PHONE_NORMALISED
deny ANON_READ_LEADS 'permission denied' as anon "SELECT count(*) FROM app_private.web_leads"
deny AUTH_READ_LEADS 'permission denied' as $OA "SELECT count(*) FROM app_private.web_leads"
deny LEAD_NO_CONTACT 'invalid_lead' as anon "SELECT public.submit_lead('Lan',NULL,NULL,NULL,NULL,NULL,'Cần tư vấn',NULL)"
deny LEAD_BAD_PHONE 'invalid_lead' as anon "SELECT public.submit_lead('Lan',NULL,'12345',NULL,NULL,NULL,'Cần tư vấn',NULL)"
deny LEAD_BAD_PLAN 'invalid_lead' as anon "SELECT public.submit_lead('Lan',NULL,NULL,'a@b.vn',NULL,'vip','Cần tư vấn',NULL)"
for i in 2 3 4 5; do as anon "SELECT public.submit_lead('Lan',NULL,'0912345678',NULL,NULL,NULL,'Lần $i nhé',NULL)" >/dev/null; done
deny LEAD_RATE_LIMIT_PER_PHONE 'rate_limited' as anon "SELECT public.submit_lead('Lan',NULL,'0912 345 678',NULL,NULL,NULL,'Lần 6',NULL)"
ok "$(admin "SELECT count(*) FROM app_private.web_leads")" 5 LEADS_STORED

# ---------------- 20 self-service shop ----------------
runfile "$V23/20_self_serve_shop.sql" T404_V23_SELF_SERVE_OK
deny SELF_SERVE_NOT_REAPPLIABLE 'T404_V23_PRECHECK_ALREADY_APPLIED' "${PSQL[@]}" -d "$PGDATABASE" -f "$V23/20_self_serve_shop.sql"
ok "$(admin "SELECT app_private.t404_qa_tenant_allowed('$TA')")" t QA_TENANT_STILL_ALLOWED
deny ANON_REGISTER 'permission denied' as anon "SELECT public.register_shop('Shop X','fashion')"
deny UNCONFIRMED_REGISTER 'access_denied' as $UN "SELECT public.register_shop('Shop X','fashion')"
deny SHORT_NAME 'invalid_shop' as $U1 "SELECT public.register_shop(' x ','fashion')"
T1=$(as $U1 "SELECT public.register_shop('Shop Hoa Mai','fashion')")
ok "$(as $U1 "SELECT count(*)||':'||max(name) FROM public.tenants")" "1:Shop Hoa Mai" U1_SEES_OWN_TENANT
S1=$(as $U1 "SELECT id FROM public.stores WHERE tenant_id='$T1'")
ok "$(as $U1 "SELECT name||':'||is_default FROM public.stores")" "Shop Hoa Mai:true" DEFAULT_STORE_NAMED_AFTER_SHOP
ok "$(as $U1 "SELECT role FROM public.store_memberships WHERE store_id='$S1'")" owner U1_IS_STORE_OWNER
deny SECOND_SELF_SERVE 'shop_already_registered' as $U1 "SELECT public.register_shop('Shop thứ hai','fashion')"
T2=$(as $U2 "SELECT public.register_shop('Shop Bình An','beauty')")
S2=$(as $U2 "SELECT id FROM public.stores WHERE tenant_id='$T2'")
ok "$(as $U1 "SELECT public.save_merchant_product_in_store('$S1','AO-01','Áo sơ mi trắng',289000,true,12,NULL) IS NOT NULL")" t U1_CREATES_PRODUCT
ok "$(as $U1 "SELECT name||':'||price_vnd||':'||stock_on_hand FROM public.products")" "Áo sơ mi trắng:289000:12" U1_READS_PRODUCT
ok "$(as $U2 "SELECT count(*) FROM public.products")" 0 U2_CANNOT_SEE_U1_PRODUCTS
ok "$(as $OA "SELECT count(*) FROM public.products WHERE tenant_id='$T1'")" 0 QA_OWNER_CANNOT_SEE_SELF_SERVE
deny U2_WRITES_U1_STORE 'access_denied' as $U2 "SELECT public.save_merchant_product_in_store('$S1','X-1','x',1,true,1,NULL)"
ok "$(as $U1 "SELECT public.create_store('$T1','chi-nhanh-2','Chi nhánh 2') IS NOT NULL")" t U1_CREATES_BRANCH
deny DIRECT_TENANT_INSERT 'permission denied' as $U1 "INSERT INTO public.tenants(slug,name,industry) VALUES ('shop-direct','x','x')"
ok "$(admin "SELECT count(*) FROM app_private.audit_events WHERE event_type='self_serve_register'")" 2 REGISTER_AUDITED

# ---------------- 30 bot settings / FAQ / customer stage ----------------
runfile "$V23/30_store_bot_settings.sql" T404_V23_BOT_SETTINGS_OK
TS=$(as $U1 "SELECT public.save_store_bot_settings('$S1','Mở cửa 8h-21h, giao toàn quốc','Không hứa giao trong 2 giờ','friendly',true,ARRAY['Owner@Shop.vn','owner@shop.vn'],NULL)")
ok "$(as $U1 "SELECT tone||':'||array_to_string(notify_emails,',')||':'||bot_enabled FROM public.store_bot_settings")" "friendly:owner@shop.vn:true" U1_SAVES_SETTINGS_EMAILS_DEDUPED
deny SETTINGS_STALE_CREATE 'settings_changed' as $U1 "SELECT public.save_store_bot_settings('$S1','x','','polite',true,'{}',NULL)"
deny SETTINGS_STALE_UPDATE 'settings_changed' as $U1 "SELECT public.save_store_bot_settings('$S1','x','','polite',true,'{}','2000-01-01')"
ok "$(as $U1 "SELECT public.save_store_bot_settings('$S1','Mở cửa 8h-21h','','polite',false,'{}','$TS') > '$TS'")" t U1_TURNS_BOT_OFF
ok "$(as $U1 "SELECT bot_enabled FROM public.store_bot_settings")" f BOT_OFF_STORED
deny SETTINGS_BAD_TONE 'invalid_settings' as $U1 "SELECT public.save_store_bot_settings('$S1','','','rude',true,'{}',NULL)"
deny SETTINGS_BAD_EMAIL 'invalid_email' as $U2 "SELECT public.save_store_bot_settings('$S2','','','polite',true,ARRAY['not-an-email'],NULL)"
deny SETTINGS_SIX_EMAILS 'invalid_settings' as $U2 "SELECT public.save_store_bot_settings('$S2','','','polite',true,ARRAY['a@a.vn','b@a.vn','c@a.vn','d@a.vn','e@a.vn','f@a.vn'],NULL)"
deny U2_SAVES_U1_SETTINGS 'access_denied' as $U2 "SELECT public.save_store_bot_settings('$S1','x','','polite',true,'{}',NULL)"
ok "$(as $U2 "SELECT count(*) FROM public.store_bot_settings")" 0 U2_CANNOT_READ_U1_SETTINGS
ok "$(as anon "SELECT 1" )" 1 ANON_SESSION_OK
deny ANON_READ_SETTINGS 'permission denied' as anon "SELECT count(*) FROM public.store_bot_settings"
deny DIRECT_SETTINGS_INSERT 'permission denied' as $U1 "INSERT INTO public.store_bot_settings(tenant_id,store_id) VALUES ('$T1','$S1')"
F1=$(as $U1 "SELECT public.save_store_faq('$S1',NULL,'Shop có đổi trả không?','Đổi trong 7 ngày nếu còn tem.',true)")
ok "$(as $U1 "SELECT count(*) FROM public.store_faqs")" 1 U1_ADDS_FAQ
as $U1 "SELECT public.save_store_faq('$S1','$F1','Shop có đổi trả không?','Đổi trong 7 ngày, còn tem mác.',false)" >/dev/null
ok "$(as $U1 "SELECT answer||':'||active FROM public.store_faqs")" "Đổi trong 7 ngày, còn tem mác.:false" U1_EDITS_FAQ
deny U2_EDITS_U1_FAQ 'access_denied' as $U2 "SELECT public.save_store_faq('$S1','$F1','x?','y',true)"
deny U2_EDITS_FAQ_VIA_OWN_STORE 'faq_not_found' as $U2 "SELECT public.save_store_faq('$S2','$F1','hack?','y',true)"
deny FAQ_EMPTY 'invalid_faq' as $U1 "SELECT public.save_store_faq('$S1',NULL,'?','',true)"
deny DIRECT_FAQ_UPDATE 'permission denied' as $U1 "UPDATE public.store_faqs SET answer='x'"
# staff can read but not write
admin "INSERT INTO public.tenant_memberships(tenant_id,user_id,role) VALUES ('$T1','$STF','staff');" >/dev/null
as $U1 "SELECT public.set_store_member('$S1','$STF','staff',true)" >/dev/null
ok "$(as $STF "SELECT count(*) FROM public.store_faqs")" 1 STAFF_READS_FAQ
deny STAFF_WRITES_FAQ 'access_denied' as $STF "SELECT public.save_store_faq('$S1',NULL,'Giờ mở cửa?','8h',true)"
deny STAFF_TOGGLES_BOT 'access_denied' as $STF "SELECT public.save_store_bot_settings('$S1','','','polite',true,'{}',NULL)"
as $U1 "SELECT public.delete_store_faq('$S1','$F1')" >/dev/null
ok "$(as $U1 "SELECT count(*) FROM public.store_faqs")" 0 U1_DELETES_FAQ
C1=$(admin "INSERT INTO public.customers(tenant_id,store_id,display_name) VALUES ('$T1','$S1','Chị Lan') RETURNING id")
ok "$(as $U1 "SELECT stage FROM public.customers")" new CUSTOMER_DEFAULT_STAGE
as $U1 "SELECT public.set_customer_stage('$S1','$C1','hot',now()+interval '1 day','Hẹn gọi lại')" >/dev/null
ok "$(as $U1 "SELECT stage||':'||note FROM public.customers")" "hot:Hẹn gọi lại" U1_SETS_STAGE
deny BAD_STAGE 'invalid_stage' as $U1 "SELECT public.set_customer_stage('$S1','$C1','vip',NULL,NULL)"
deny U2_SETS_U1_STAGE 'access_denied' as $U2 "SELECT public.set_customer_stage('$S1','$C1','lost',NULL,NULL)"
deny U2_STAGE_VIA_OWN_STORE 'customer_not_found' as $U2 "SELECT public.set_customer_stage('$S2','$C1','lost',NULL,NULL)"

P1=$(as $U1 "SELECT id FROM public.products WHERE sku='AO-01'"); PU=$(as $U1 "SELECT updated_at FROM public.products WHERE sku='AO-01'")
ok "$(as $U1 "SELECT public.set_product_stock('$S1','$P1',30,'$PU') > '$PU'")" t U1_SETS_STOCK
ok "$(as $U1 "SELECT stock_on_hand FROM public.products WHERE sku='AO-01'")" 30 STOCK_STORED
deny STOCK_STALE 'product_changed_or_missing' as $U1 "SELECT public.set_product_stock('$S1','$P1',5,'$PU')"
deny STOCK_NEGATIVE 'invalid_stock' as $U1 "SELECT public.set_product_stock('$S1','$P1',-1,now())"
deny U2_SETS_U1_STOCK 'access_denied' as $U2 "SELECT public.set_product_stock('$S1','$P1',0,now())"
deny STAFF_SETS_STOCK 'access_denied' as $STF "SELECT public.set_product_stock('$S1','$P1',0,now())"
ok "$(admin "SELECT metadata->>'old'||'>'||(metadata->>'new') FROM app_private.audit_events WHERE event_type='product_stock_set'")" "12>30" STOCK_AUDITED

# ---------------- rollback + re-apply ----------------
"${PSQL[@]}" -d "$PGDATABASE" -f "$V23/70_store_bot_settings_rollback.sql" >/dev/null
ok "$(admin "SELECT to_regclass('public.store_faqs') IS NULL AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='stage')")" t ROLLBACK_70_CLEAN
"${PSQL[@]}" -d "$PGDATABASE" -f "$V23/80_self_serve_shop_rollback.sql" >/dev/null 2>&1
ok "$(md5fn 'app_private.t404_qa_tenant_allowed(uuid)')" "$V20_ALLOW" ROLLBACK_80_RESTORES_ALLOW_LIST
deny SELF_SERVE_WRITES_AFTER_ROLLBACK 'access_denied' as $U1 "SELECT public.save_merchant_product_in_store('$S1','AO-02','x',1,true,1,NULL)"
ok "$(as $U1 "SELECT count(*) FROM public.products")" 1 SELF_SERVE_KEEPS_READ_AFTER_ROLLBACK
"${PSQL[@]}" -d "$PGDATABASE" -f "$V23/90_leads_rollback.sql" >/dev/null 2>&1
ok "$(admin "SELECT to_regclass('app_private.web_leads') IS NULL")" t ROLLBACK_90_CLEAN
ok "$(admin "SELECT count(*) FROM app_private.self_serve_tenants")" 2 ROLLBACK_80_KEEPS_REGISTRY_WITH_ROWS
runfile "$V23/10_leads.sql" T404_V23_LEADS_OK
runfile "$V23/20_self_serve_shop.sql" T404_V23_SELF_SERVE_OK
runfile "$V23/30_store_bot_settings.sql" T404_V23_BOT_SETTINGS_OK
ok "$(as $U1 "SELECT public.save_merchant_product_in_store('$S1','AO-02','Quần tây',350000,true,4,NULL) IS NOT NULL")" t SELF_SERVE_WRITES_AFTER_REAPPLY
echo "T404_V23_WEB_OFFLINE_UAT_PASS $PASS"
