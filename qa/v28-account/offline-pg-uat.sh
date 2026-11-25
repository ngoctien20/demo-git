#!/usr/bin/env bash
# TIEN404 V28 Account — OFFLINE UAT of db/v28-account (DEMO billing + platform Admin) on a disposable local PostgreSQL,
# stacked on V20 10/20/30 + V23 10/20/30. Simulated Supabase roles + JWT claims. NOT hosted acceptance.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"; V20="$DIR/../v20-store-authority"; V23="$DIR/../../db/v23-web"; V28="$DIR/../../db/v28-account"
: "${PGHOST:?}"; : "${PGPORT:?}"; : "${PGUSER:=postgres}"; PGDATABASE=t404_v28_account
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

U1=d0000000-0000-4000-8000-0000000000e1; U2=d0000000-0000-4000-8000-0000000000e2
STF=d0000000-0000-4000-8000-0000000000f1; ADM=d0000000-0000-4000-8000-0000000000ad; ADM2=d0000000-0000-4000-8000-0000000000ae

"${PSQL[@]}" -d postgres -c "DROP DATABASE IF EXISTS $PGDATABASE" -c "CREATE DATABASE $PGDATABASE" >/dev/null
"${PSQL[@]}" -d "$PGDATABASE" -f "$V20/00_hosted_baseline_replica.sql" >/dev/null
admin "ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS email_confirmed_at timestamptz, ADD COLUMN IF NOT EXISTS banned_until timestamptz,
         ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(), ADD COLUMN IF NOT EXISTS last_sign_in_at timestamptz;
       UPDATE auth.users SET email_confirmed_at=now();
       INSERT INTO auth.users(id,email,email_confirmed_at) VALUES ('$U1','u1@qa.invalid',now()),('$U2','u2@qa.invalid',now()),
         ('$STF','staff@qa.invalid',now()),('$ADM','admin@qa.invalid',now()),('$ADM2','admin2@qa.invalid',now());" >/dev/null
for f in 10_store_authority_expand 20_store_aware_writer 30_store_admin_rpcs; do "${PSQL[@]}" -d "$PGDATABASE" -f "$V20/$f.sql" >/dev/null; done
for f in 10_leads 20_self_serve_shop 30_store_bot_settings; do "${PSQL[@]}" -d "$PGDATABASE" -f "$V23/$f.sql" >/dev/null 2>&1; done
T1=$(as $U1 "SELECT public.register_shop('Shop Hoa Mai','fashion')"); S1=$(as $U1 "SELECT id FROM public.stores WHERE tenant_id='$T1'")
T2=$(as $U2 "SELECT public.register_shop('Shop Bình An','beauty')"); S2=$(as $U2 "SELECT id FROM public.stores WHERE tenant_id='$T2'")
admin "INSERT INTO public.tenant_memberships(tenant_id,user_id,role) VALUES ('$T1','$STF','staff');" >/dev/null
as $U1 "SELECT public.set_store_member('$S1','$STF','staff',true)" >/dev/null
echo "baseline ready: S1=$S1 S2=$S2"

runfile "$V28/10_billing_demo_admin.sql" T404_V28_ACCOUNT_OK
deny NOT_REAPPLIABLE 'T404_V28_ALREADY_APPLIED' "${PSQL[@]}" -d "$PGDATABASE" -f "$V28/10_billing_demo_admin.sql"

# ---------------- A. DEMO billing ----------------
ok "$(as $U1 "SELECT public.billing_demo_state('$S1')->'subscription'->>'plan'")" trial DEFAULT_TRIAL
ok "$(as $U1 "SELECT public.billing_demo_state('$S1')->>'demo'")" true STATE_MARKED_DEMO
J=$(as $U1 "SELECT public.billing_demo_checkout('$S1','plus','month')")
ok "$(echo "$J" | python3 -c 'import json,sys;d=json.load(sys.stdin)["invoices"][0];print(d["amount_vnd"],d["status"],d["transfer_note"].startswith("T404DEMO "))')" "299000 pending True" CHECKOUT_SERVER_PRICE
I1=$(echo "$J" | python3 -c 'import json,sys;print(json.load(sys.stdin)["invoices"][0]["id"])')
ok "$(admin "SELECT bool_and(is_demo) FROM public.billing_demo_invoices")" t INVOICES_ALWAYS_DEMO
deny INVOICE_NOT_DEMO 'check constraint' admin "UPDATE public.billing_demo_invoices SET is_demo=false"
deny BAD_PLAN 'invalid_plan' as $U1 "SELECT public.billing_demo_checkout('$S1','vip','month')"
deny BAD_CYCLE 'invalid_plan' as $U1 "SELECT public.billing_demo_checkout('$S1','lite','week')"
deny STAFF_CHECKOUT 'access_denied' as $STF "SELECT public.billing_demo_checkout('$S1','pro','month')"
ok "$(as $STF "SELECT jsonb_array_length(public.billing_demo_state('$S1')->'invoices')")" 1 STAFF_READS_STATE
deny STAFF_CONFIRM 'access_denied' as $STF "SELECT public.billing_demo_confirm('$S1','$I1')"
deny U2_READS_U1 'access_denied' as $U2 "SELECT public.billing_demo_state('$S1')"
deny U2_CONFIRMS_U1 'access_denied' as $U2 "SELECT public.billing_demo_confirm('$S1','$I1')"
deny U2_CONFIRMS_VIA_OWN_STORE 'invoice_not_pending' as $U2 "SELECT public.billing_demo_confirm('$S2','$I1')"
deny ANON_STATE 'permission denied' as anon "SELECT public.billing_demo_state('$S1')"
deny DIRECT_READ_INVOICES 'permission denied' as $U1 "SELECT count(*) FROM public.billing_demo_invoices"
deny DIRECT_WRITE_SUB 'permission denied' as $U1 "INSERT INTO public.billing_demo_subscriptions(store_id,tenant_id,plan,status) VALUES ('$S1','$T1','pro','active')"
J=$(as $U1 "SELECT public.billing_demo_checkout('$S1','pro','year')")
ok "$(echo "$J" | python3 -c 'import json,sys;i=json.load(sys.stdin)["invoices"];print(i[0]["amount_vnd"],i[0]["status"],i[1]["status"])')" "6990000 pending void" NEW_CHECKOUT_VOIDS_OLD
deny CONFIRM_VOIDED 'invoice_not_pending' as $U1 "SELECT public.billing_demo_confirm('$S1','$I1')"
I2=$(echo "$J" | python3 -c 'import json,sys;print(json.load(sys.stdin)["invoices"][0]["id"])')
J=$(as $U1 "SELECT public.billing_demo_confirm('$S1','$I2')")
ok "$(echo "$J" | python3 -c 'import json,sys;s=json.load(sys.stdin)["subscription"];print(s["plan"],s["cycle"],s["status"])')" "pro year active" CONFIRM_ACTIVATES_PLAN
ok "$(admin "SELECT renews_at::date = (now()+interval '1 year')::date FROM public.billing_demo_subscriptions WHERE store_id='$S1'")" t RENEWS_IN_ONE_YEAR
deny CONFIRM_TWICE 'invoice_not_pending' as $U1 "SELECT public.billing_demo_confirm('$S1','$I2')"
ok "$(as $U1 "SELECT public.billing_demo_cancel('$S1')->'subscription'->>'status'")" canceled OWNER_CANCELS
deny CANCEL_TWICE 'nothing_to_cancel' as $U1 "SELECT public.billing_demo_cancel('$S1')"
I3=$(as $U1 "SELECT public.billing_demo_checkout('$S1','lite','month')->'invoices'->0->>'id'")
ok "$(as $U1 "SELECT public.billing_demo_void('$S1','$I3')->'invoices'->0->>'status'")" void OWNER_VOIDS
ok "$(admin "SELECT count(*) FROM app_private.audit_events WHERE event_type LIKE 'billing_demo_%'")" 5 BILLING_AUDITED
for i in $(seq 1 17); do as $U2 "SELECT public.billing_demo_checkout('$S2','lite','month')" >/dev/null; done
ok "$(admin "SELECT count(*) FROM public.billing_demo_invoices WHERE store_id='$S2' AND status='pending'")" 1 ONE_PENDING_PER_STORE
for i in 1 2 3; do as $U2 "SELECT public.billing_demo_checkout('$S2','lite','month')" >/dev/null; done
deny CHECKOUT_RATE_LIMIT 'rate_limited' as $U2 "SELECT public.billing_demo_checkout('$S2','lite','month')"

# ---------------- B. Platform Admin ----------------
ok "$(as $U1 "SELECT public.is_platform_admin()")" f OWNER_IS_NOT_ADMIN
deny OWNER_OVERVIEW 'access_denied' as $U1 "SELECT public.admin_overview()"
deny STAFF_OVERVIEW 'access_denied' as $STF "SELECT public.admin_overview()"
deny ANON_OVERVIEW 'permission denied' as anon "SELECT public.admin_overview()"
deny ANON_IS_ADMIN 'permission denied' as anon "SELECT public.is_platform_admin()"
deny OWNER_READS_ADMINS 'permission denied' as $U1 "SELECT count(*) FROM app_private.platform_admins"
deny OWNER_SELF_PROMOTE 'permission denied' as $U1 "INSERT INTO app_private.platform_admins(user_id) VALUES ('$U1')"
deny OWNER_LOCKS 'access_denied' as $U1 "SELECT public.admin_set_account_lock('$U2',true,'spam spam')"
deny OWNER_BOT_OTHER 'access_denied' as $U1 "SELECT public.admin_set_store_bot('$S2',false)"
admin "INSERT INTO app_private.platform_admins(user_id,note) VALUES ('$ADM','QA admin'),('$ADM2','QA admin 2')" >/dev/null
ok "$(as $ADM "SELECT public.is_platform_admin()")" t ADMIN_FLAG
O=$(as $ADM "SELECT public.admin_overview()")
ok "$(echo "$O" | python3 -c '
import json,sys;d=json.load(sys.stdin);s={x["store_name"]:x for x in d["stores"]}
a=s["Shop Hoa Mai"];b=s["Shop Bình An"]
print(len(d["stores"])>=2,a["owner_email"],a["plan"],a["plan_status"],a["members"],b["pending_invoices"],len(d["accounts"])>=5)')" "True u1@qa.invalid pro canceled 2 1 True" ADMIN_SEES_ALL_STORES
ok "$(as $ADM "SELECT count(*) FROM public.products")" 0 ADMIN_HAS_NO_SHOP_TABLE_ACCESS
deny ADMIN_LOCK_SELF 'cannot_lock_self' as $ADM "SELECT public.admin_set_account_lock('$ADM',true,'test')"
deny ADMIN_LOCK_ADMIN 'cannot_lock_admin' as $ADM "SELECT public.admin_set_account_lock('$ADM2',true,'test lock')"
deny LOCK_NO_REASON 'invalid_reason' as $ADM "SELECT public.admin_set_account_lock('$U2',true,' ')"
deny LOCK_UNKNOWN 'invalid_account' as $ADM "SELECT public.admin_set_account_lock(gen_random_uuid(),true,'spam spam')"
ok "$(as $ADM "SELECT public.admin_set_account_lock('$U2',true,'Gửi tin rác')")" t ADMIN_LOCKS
ok "$(admin "SELECT banned_until='infinity' FROM auth.users WHERE id='$U2'")" t LOCK_SETS_BANNED_UNTIL
ok "$(as $ADM "SELECT (SELECT x->>'locked' FROM jsonb_array_elements(public.admin_overview()->'accounts') x WHERE x->>'user_id'='$U2')")" true OVERVIEW_SHOWS_LOCK
ok "$(as $ADM "SELECT public.admin_set_account_lock('$U2',false,NULL)")" f ADMIN_UNLOCKS
ok "$(admin "SELECT banned_until IS NULL FROM auth.users WHERE id='$U2'")" t UNLOCK_CLEARS_BAN
ok "$(as $ADM "SELECT public.admin_set_store_bot('$S2',false)")" f ADMIN_TURNS_BOT_OFF
ok "$(admin "SELECT bot_enabled FROM public.store_bot_settings WHERE store_id='$S2'")" f BOT_OFF_STORED
ok "$(as $ADM "SELECT public.admin_set_store_bot('$S2',true)")" t ADMIN_TURNS_BOT_ON
ok "$(admin "SELECT count(*) FROM app_private.audit_events WHERE event_type LIKE 'admin_%'")" 4 ADMIN_AUDITED
admin "DELETE FROM app_private.platform_admins WHERE user_id='$ADM2'" >/dev/null
deny REMOVED_ADMIN 'access_denied' as $ADM2 "SELECT public.admin_overview()"

# ---------------- rollback + re-apply ----------------
as $ADM "SELECT public.admin_set_account_lock('$U1',true,'Kiểm tra rollback')" >/dev/null
runfile "$V28/90_billing_demo_admin_rollback.sql" T404_V28_ROLLBACK_OK
ok "$(admin "SELECT to_regclass('public.billing_demo_invoices') IS NULL AND to_regclass('app_private.platform_admins') IS NULL AND to_regprocedure('public.admin_overview()') IS NULL")" t ROLLBACK_CLEAN
ok "$(admin "SELECT count(*) FROM auth.users WHERE banned_until IS NOT NULL")" 0 ROLLBACK_UNLOCKS_ALL
ok "$(as $U2 "SELECT bot_enabled FROM public.store_bot_settings")" t V23_UNTOUCHED
runfile "$V28/10_billing_demo_admin.sql" T404_V28_ACCOUNT_OK
echo "V28_ACCOUNT_OFFLINE_UAT_PASS=$PASS"
