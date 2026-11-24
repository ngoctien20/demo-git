#!/usr/bin/env bash
# TIEN404 V25 Daily Briefing sender — OFFLINE UAT on a disposable LOCAL PostgreSQL. NO email is sent.
# Stack: V20 00/10/20/30 + V23 10/20/30 + Config Core 10 + V25 10 + (fake Vault, pgcrypto in "extensions")
# + V25 20, rollback 80, re-apply. Simulates PostgREST anon calls with request.headers.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"; ROOT="$DIR/../.."; V20="$ROOT/qa/v20-store-authority"; V23="$ROOT/db/v23-web"
CC="$ROOT/db/config-core"; V25="$ROOT/db/v25-workspace"
: "${PGHOST:?}"; : "${PGPORT:?}"; : "${PGUSER:=postgres}"; PGDATABASE=t404_v25_briefing
case "$PGHOST" in /*|127.0.0.1|localhost) ;; *) echo "REFUSE_NON_LOCAL_HOST"; exit 2;; esac
[ -z "${SUPABASE_DB_URL:-}${SUPABASE_ACCESS_TOKEN:-}${DATABASE_URL:-}" ] || { echo "REFUSE_HOSTED_ENV"; exit 2; }
export PGHOST PGPORT PGUSER
PASS=0; PSQL=(psql -X -q -v ON_ERROR_STOP=1 -At)
admin(){ "${PSQL[@]}" -d "$PGDATABASE" -c "$1"; }
as(){ local who="$1" sql="$2" role=authenticated claims
  case "$who" in anon) role=anon; claims='{"role":"anon"}';; *) claims="{\"sub\":\"$who\",\"role\":\"authenticated\"}";; esac
  "${PSQL[@]}" -d "$PGDATABASE" -c "SET ROLE $role" -c "SELECT set_config('request.jwt.claims','$claims',false)" -c "$sql" | tail -n 1; }
n8n(){ local key="$1" sql="$2"
  "${PSQL[@]}" -d "$PGDATABASE" -c "SET ROLE anon" -c "SELECT set_config('request.jwt.claims','{\"role\":\"anon\"}',false)" \
   -c "SELECT set_config('request.headers','{\"x-t404-briefing-key\":\"$key\"}',false)" -c "$sql" | tail -n 1; }
ok(){ if [ "$1" = "$2" ]; then PASS=$((PASS+1)); echo "PASS_$3"; else echo "FAIL_$3 expected=[$2] got=[$1]"; exit 1; fi; }
deny(){ local tag=$1 re=$2; shift 2; local out
  if out=$("$@" 2>&1); then echo "FAIL_${tag} unexpectedly accepted: $out"; exit 1; fi
  if echo "$out" | grep -Eq "$re"; then PASS=$((PASS+1)); echo "PASS_DENY_${tag}"; else echo "FAIL_${tag} wrong error: $out"; exit 1; fi; }
runfile(){ local out; out=$("${PSQL[@]}" -d "$PGDATABASE" -f "$1" 2>&1) || { echo "$out"; echo "FAIL_RUN_$2"; exit 1; }
  echo "$out" | grep -q "$2" || { echo "$out"; echo "FAIL_MARKER_$2"; exit 1; }; PASS=$((PASS+1)); echo "PASS_$2"; }

TA=9c8c524c-88db-4771-8ab0-a4316298494c; TB=4b12fc28-4fc3-4b06-bbf1-72a1f62ad5c5
OA=a0000000-0000-4000-8000-00000000000a; OB=b0000000-0000-4000-8000-00000000000b
MA=a0000000-0000-4000-8000-0000000000a2; SA=a0000000-0000-4000-8000-0000000000a3; MU=a0000000-0000-4000-8000-0000000000a4

"${PSQL[@]}" -d postgres -c "DROP DATABASE IF EXISTS $PGDATABASE" -c "CREATE DATABASE $PGDATABASE" >/dev/null
"${PSQL[@]}" -d "$PGDATABASE" -f "$V20/00_hosted_baseline_replica.sql" >/dev/null
for f in 10_store_authority_expand 20_store_aware_writer 30_store_admin_rpcs; do "${PSQL[@]}" -d "$PGDATABASE" -f "$V20/$f.sql" >/dev/null 2>&1; done
admin "ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS email_confirmed_at timestamptz; UPDATE auth.users SET email_confirmed_at=now();" >/dev/null
for f in 10_leads 20_self_serve_shop 30_store_bot_settings; do "${PSQL[@]}" -d "$PGDATABASE" -f "$V23/$f.sql" >/dev/null 2>&1; done
"${PSQL[@]}" -d "$PGDATABASE" -f "$CC/10_config_core.sql" >/dev/null 2>&1
runfile "$V25/10_workspace_settings.sql" T404_V25_WORKSPACE_SETTINGS_OK
deny NEEDS_VAULT 'T404_V25_20_PRECHECK_VAULT_MISSING' "${PSQL[@]}" -d "$PGDATABASE" -f "$V25/20_briefing_sender.sql"
# Supabase-like Vault + pgcrypto in "extensions" (local stand-ins).
admin "CREATE SCHEMA IF NOT EXISTS extensions; CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;
 CREATE SCHEMA vault; CREATE TABLE vault.secrets(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text UNIQUE, secret text, description text);
 REVOKE ALL ON SCHEMA vault FROM PUBLIC; REVOKE ALL ON vault.secrets FROM PUBLIC;
 CREATE VIEW vault.decrypted_secrets AS SELECT id, name, secret AS decrypted_secret FROM vault.secrets;
 CREATE FUNCTION vault.create_secret(s text, n text, d text) RETURNS uuid LANGUAGE sql AS \$\$ INSERT INTO vault.secrets(name,secret,description) VALUES (n,s,d) RETURNING id \$\$;" >/dev/null 2>&1 || true
admin "INSERT INTO auth.users(id,email,email_confirmed_at) VALUES ('$MA','manager-a@qa.invalid',now()),('$SA','staff-a@qa.invalid',now()),('$MU','manager-unconfirmed@qa.invalid',NULL);
 INSERT INTO public.tenant_memberships(tenant_id,user_id,role) VALUES ('$TA','$MA','manager'),('$TA','$SA','staff'),('$TA','$MU','manager');
 INSERT INTO public.store_memberships(tenant_id,store_id,user_id,role)
  SELECT tenant_id,id,'$MA'::uuid,'manager' FROM public.stores WHERE tenant_id='$TA' AND is_default UNION ALL
  SELECT tenant_id,id,'$SA','staff' FROM public.stores WHERE tenant_id='$TA' AND is_default UNION ALL
  SELECT tenant_id,id,'$MU','manager' FROM public.stores WHERE tenant_id='$TA' AND is_default;" >/dev/null
SA_STORE=$(admin "SELECT id FROM public.stores WHERE tenant_id='$TA' AND is_default")
SB_STORE=$(admin "SELECT id FROM public.stores WHERE tenant_id='$TB' AND is_default")
OA_EMAIL=$(admin "SELECT email FROM auth.users WHERE id='$OA'")
# Activity: Shop A 2 Messenger + 1 web conversations, 1 handoff, 1 pending + 1 confirmed order (150 000đ); Shop B 1 conversation.
admin "INSERT INTO public.conversations(tenant_id,store_id,channel) VALUES ('$TA','$SA_STORE','messenger'),('$TA','$SA_STORE','messenger'),('$TA','$SA_STORE','web'),('$TB','$SB_STORE','messenger');
 INSERT INTO public.conversations(tenant_id,store_id,channel,created_at) VALUES ('$TA','$SA_STORE','messenger',now()-interval '3 days');
 INSERT INTO public.customers(tenant_id,store_id,display_name,stage) VALUES ('$TA','$SA_STORE','Khách cần người','needs_human');
 INSERT INTO public.orders(tenant_id,store_id,status,total_vnd) VALUES ('$TA','$SA_STORE','pending',90000),('$TA','$SA_STORE','confirmed',150000);" >/dev/null
# Expected order figures from the same rows (baseline replica already holds some Shop A orders).
ORD=$(admin "SELECT count(*)||' ('||count(*) FILTER (WHERE status='pending')||' chờ duyệt)' FROM public.orders WHERE store_id='$SA_STORE' AND created_at>=now()-interval '24 hours'")
REV=$(admin "SELECT coalesce(sum(total_vnd) FILTER (WHERE status IN ('confirmed','paid')),0) FROM public.orders WHERE store_id='$SA_STORE' AND created_at>=now()-interval '24 hours'")
SEND=$(admin "SELECT to_char(greatest((now() AT TIME ZONE 'Asia/Ho_Chi_Minh') - interval '30 minutes', date_trunc('day', now() AT TIME ZONE 'Asia/Ho_Chi_Minh')),'HH24:MI')")
LATER=$(admin "SELECT to_char((now() AT TIME ZONE 'Asia/Ho_Chi_Minh') + interval '2 hours','HH24:MI')")

for round in 1 2; do
 runfile "$V25/20_briefing_sender.sql" T404_V25_BRIEFING_SENDER_OK
 KEY=$(admin "SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='t404_briefing_sender_key'")
 ok "${#KEY}" 64 KEY_GENERATED_IN_DB
 ok "$(admin "SELECT count(*) FROM vault.secrets WHERE name='t404_briefing_sender_key'")" 1 KEY_KEPT_ACROSS_REAPPLY
 ok "$(admin "SELECT count(*) FROM public.store_briefing_settings WHERE status<>'active'")" 0 SETTINGS_MARKED_ACTIVE
 deny NO_HEADER 'access_denied' as anon "SELECT count(*) FROM public.briefing_claim_due_v1()"
 deny WRONG_KEY 'access_denied' n8n "$(printf '0%.0s' {1..64})" "SELECT count(*) FROM public.briefing_claim_due_v1()"
 deny AUTH_USER_CLAIM 'permission denied' as $OA "SELECT count(*) FROM public.briefing_claim_due_v1()"
 deny AUTH_USER_REPORT 'permission denied' as $OA "SELECT public.briefing_report_v1(gen_random_uuid(),true)"
 deny DELIVERIES_HIDDEN 'permission denied' as $OA "SELECT count(*) FROM app_private.briefing_deliveries"
 # Shop A opted in (email, picked 4 metrics), Shop B opted in but Telegram; nothing due yet for a later time.
 as $OA "SELECT public.save_briefing_settings('$SA_STORE',true,'$LATER','email',ARRAY['conv_messenger','orders','revenue','handoff'])" >/dev/null
 as $OB "SELECT public.save_briefing_settings('$SB_STORE',true,'$SEND','telegram','{}')" >/dev/null
 ok "$(n8n "$KEY" "SELECT count(*) FROM public.briefing_claim_due_v1()")" 0 NOT_DUE_BEFORE_SEND_TIME
 as $OA "SELECT public.save_briefing_settings('$SA_STORE',true,'$SEND','email',ARRAY['conv_messenger','orders','revenue','handoff'])" >/dev/null
 ROW=$(n8n "$KEY" "SELECT delivery_id||'|'||store_name||'|'||array_to_string(recipients,',')||'|'||metrics::text FROM public.briefing_claim_due_v1()")
 DEL=${ROW%%|*}
 ok "$(echo "$ROW" | cut -d'|' -f2-3)" "$(admin "SELECT name FROM public.stores WHERE id='$SA_STORE'")|manager-a@qa.invalid,$OA_EMAIL" CLAIM_SHOP_A_OWNER_MANAGER_CONFIRMED_ONLY
 ok "$(echo "$ROW" | cut -d'|' -f4-)" "{\"orders\": \"$ORD\", \"handoff\": 1, \"revenue\": $REV, \"conv_messenger\": 2}" METRICS_PICKED_LAST_24H_ONLY
 ok "$(n8n "$KEY" "SELECT count(*) FROM public.briefing_claim_due_v1()")" 0 ONCE_A_DAY_NO_DOUBLE_SEND
 n8n "$KEY" "SELECT public.briefing_report_v1('$DEL',true)" >/dev/null
 ok "$(admin "SELECT status||'|'||recipients FROM app_private.briefing_deliveries WHERE id='$DEL'")" "sent|2" REPORT_MARKS_SENT
 deny REPORT_TWICE 'delivery_not_claimed' n8n "$KEY" "SELECT public.briefing_report_v1('$DEL',false,'x')"
 ok "$(as $MA "SELECT status||'|'||recipients FROM public.briefing_recent_deliveries('$SA_STORE')")" "sent|2" MANAGER_SEES_OWN_DELIVERIES
 deny STAFF_DELIVERIES 'access_denied' as $SA "SELECT count(*) FROM public.briefing_recent_deliveries('$SA_STORE')"
 deny CROSS_DELIVERIES 'access_denied' as $OB "SELECT count(*) FROM public.briefing_recent_deliveries('$SA_STORE')"
 deny ANON_DELIVERIES 'permission denied' as anon "SELECT count(*) FROM public.briefing_recent_deliveries('$SA_STORE')"
 if [ $round = 1 ]; then
  runfile "$V25/80_briefing_sender_rollback.sql" T404_V25_BRIEFING_SENDER_ROLLBACK_OK
  ok "$(admin "SELECT to_regprocedure('public.briefing_claim_due_v1()') IS NULL AND to_regclass('app_private.briefing_deliveries') IS NULL AND (SELECT bool_and(status='awaiting_sender') FROM public.store_briefing_settings)")" t ROLLBACK_CLEAN
 fi
done
echo "T404_V25_BRIEFING_OFFLINE_PASS $PASS"
