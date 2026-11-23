#!/usr/bin/env bash
# TIEN404 V25 workspace settings — OFFLINE UAT on a disposable LOCAL PostgreSQL.
# Workspace profile + briefing prefs. Stack: V20 00/10/20/30 + V23 web 10/20/30 + Config Core 10 + db/v25-workspace/10, rollback 90, re-apply.
# Simulated Supabase roles + request.jwt.claims. NOT hosted acceptance. Refuses non-local hosts.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"; ROOT="$DIR/../.."; V20="$ROOT/qa/v20-store-authority"; V23="$ROOT/db/v23-web"
CC="$ROOT/db/config-core"; V25="$ROOT/db/v25-workspace"
: "${PGHOST:?}"; : "${PGPORT:?}"; : "${PGUSER:=postgres}"; PGDATABASE=t404_v25_workspace
case "$PGHOST" in /*|127.0.0.1|localhost) ;; *) echo "REFUSE_NON_LOCAL_HOST"; exit 2;; esac
[ -z "${SUPABASE_DB_URL:-}${SUPABASE_ACCESS_TOKEN:-}${DATABASE_URL:-}" ] || { echo "REFUSE_HOSTED_ENV"; exit 2; }
export PGHOST PGPORT PGUSER
PASS=0; PSQL=(psql -X -q -v ON_ERROR_STOP=1 -At)
admin(){ "${PSQL[@]}" -d "$PGDATABASE" -c "$1"; }
as(){ local who="$1" sql="$2" role=authenticated claims
  case "$who" in anon) role=anon; claims='{"role":"anon"}';; *) claims="{\"sub\":\"$who\",\"role\":\"authenticated\"}";; esac
  "${PSQL[@]}" -d "$PGDATABASE" -c "SET ROLE $role" -c "SELECT set_config('request.jwt.claims','$claims',false)" -c "$sql" | tail -n 1; }
ok(){ if [ "$1" = "$2" ]; then PASS=$((PASS+1)); echo "PASS_$3"; else echo "FAIL_$3 expected=[$2] got=[$1]"; exit 1; fi; }
deny(){ local tag=$1 re=$2; shift 2; local out
  if out=$("$@" 2>&1); then echo "FAIL_${tag} unexpectedly accepted: $out"; exit 1; fi
  if echo "$out" | grep -Eq "$re"; then PASS=$((PASS+1)); echo "PASS_DENY_${tag}"; else echo "FAIL_${tag} wrong error: $out"; exit 1; fi; }
runfile(){ local out; out=$("${PSQL[@]}" -d "$PGDATABASE" -f "$1" 2>&1) || { echo "$out"; echo "FAIL_RUN_$2"; exit 1; }
  echo "$out" | grep -q "$2" || { echo "$out"; echo "FAIL_MARKER_$2"; exit 1; }; PASS=$((PASS+1)); echo "PASS_$2"; }

TA=9c8c524c-88db-4771-8ab0-a4316298494c; TB=4b12fc28-4fc3-4b06-bbf1-72a1f62ad5c5
OA=a0000000-0000-4000-8000-00000000000a; OB=b0000000-0000-4000-8000-00000000000b
MA=a0000000-0000-4000-8000-0000000000a2; SA=a0000000-0000-4000-8000-0000000000a3

"${PSQL[@]}" -d postgres -c "DROP DATABASE IF EXISTS $PGDATABASE" -c "CREATE DATABASE $PGDATABASE" >/dev/null
"${PSQL[@]}" -d "$PGDATABASE" -f "$V20/00_hosted_baseline_replica.sql" >/dev/null
for f in 10_store_authority_expand 20_store_aware_writer 30_store_admin_rpcs; do "${PSQL[@]}" -d "$PGDATABASE" -f "$V20/$f.sql" >/dev/null 2>&1; done
for f in 10_leads 20_self_serve_shop 30_store_bot_settings; do "${PSQL[@]}" -d "$PGDATABASE" -f "$V23/$f.sql" >/dev/null 2>&1; done
"${PSQL[@]}" -d "$PGDATABASE" -f "$CC/10_config_core.sql" >/dev/null 2>&1
admin "INSERT INTO auth.users(id,email) VALUES ('$MA','manager-a@qa.invalid'),('$SA','staff-a@qa.invalid');
 INSERT INTO public.tenant_memberships(tenant_id,user_id,role) VALUES ('$TA','$MA','manager'),('$TA','$SA','staff');
 INSERT INTO public.store_memberships(tenant_id,store_id,user_id,role)
  SELECT tenant_id,id,'$MA'::uuid,'manager' FROM public.stores WHERE tenant_id='$TA' AND is_default UNION ALL
  SELECT tenant_id,id,'$SA','staff' FROM public.stores WHERE tenant_id='$TA' AND is_default;" >/dev/null
SA_STORE=$(admin "SELECT id FROM public.stores WHERE tenant_id='$TA' AND is_default")
SB_STORE=$(admin "SELECT id FROM public.stores WHERE tenant_id='$TB' AND is_default")
IND_A=$(admin "SELECT industry FROM public.tenants WHERE id='$TA'")

for round in 1 2; do
 runfile "$V25/10_workspace_settings.sql" T404_V25_WORKSPACE_SETTINGS_OK
 deny NOT_REAPPLIABLE 'T404_V25_ALREADY_APPLIED' "${PSQL[@]}" -d "$PGDATABASE" -f "$V25/10_workspace_settings.sql"
 # workspace profile (free label, any modules, people label)
 as $OA "SELECT public.save_workspace_profile('$SA_STORE','  Phòng khám nha khoa ',ARRAY['service','education','service'],'Bệnh nhân')" >/dev/null
 ok "$(as $SA "SELECT label||'|'||array_to_string(modules,',')||'|'||people_label FROM public.workspace_profiles WHERE store_id='$SA_STORE'")" "Phòng khám nha khoa|education,service|Bệnh nhân" OWNER_SAVES_PROFILE_STAFF_READS
 as $OA "SELECT public.save_workspace_profile('$SA_STORE','Quỹ từ thiện',ARRAY[]::text[],'Nhà hảo tâm')" >/dev/null
 ok "$(as $MA "SELECT label||'|'||cardinality(modules)||'|'||people_label FROM public.workspace_profiles WHERE store_id='$SA_STORE'")" "Quỹ từ thiện|0|Nhà hảo tâm" PROFILE_UPSERT_NO_MODULES
 ok "$(admin "SELECT count(*) FROM app_private.audit_events WHERE event_type='workspace_profile_save' AND tenant_id='$TA'")" "$((round*2))" PROFILE_AUDITED
 ok "$(admin "SELECT industry FROM public.tenants WHERE id='$TA'")" "$IND_A" TENANT_INDUSTRY_UNTOUCHED
 deny MANAGER_PROFILE 'access_denied' as $MA "SELECT public.save_workspace_profile('$SA_STORE','Spa',ARRAY['service'],'Khách')"
 deny STAFF_PROFILE 'access_denied' as $SA "SELECT public.save_workspace_profile('$SA_STORE','Spa',ARRAY['service'],'Khách')"
 deny CROSS_TENANT_PROFILE 'access_denied' as $OA "SELECT public.save_workspace_profile('$SB_STORE','Spa',ARRAY['service'],'Khách')"
 deny ANON_PROFILE 'permission denied' as anon "SELECT public.save_workspace_profile('$SA_STORE','Spa',ARRAY['service'],'Khách')"
 deny BAD_MODULE 'invalid_profile' as $OA "SELECT public.save_workspace_profile('$SA_STORE','Spa',ARRAY['casino'],'Khách')"
 deny SHORT_LABEL 'invalid_profile' as $OA "SELECT public.save_workspace_profile('$SA_STORE',' x ',ARRAY['service'],'Khách')"
 deny LONG_PEOPLE 'invalid_profile' as $OA "SELECT public.save_workspace_profile('$SA_STORE','Spa',ARRAY['service'],repeat('a',41))"
 ok "$(as $OB "SELECT count(*) FROM public.workspace_profiles")" 0 OTHER_TENANT_CANNOT_READ_PROFILE
 ok "$(as anon "SELECT count(*) FROM public.workspace_profiles" 2>&1 | grep -c 'permission denied')" 1 ANON_CANNOT_READ_PROFILE
 deny DIRECT_PROFILE_INSERT 'permission denied' as $OA "INSERT INTO public.workspace_profiles(store_id,tenant_id,label,people_label,updated_by) VALUES ('$SA_STORE','$TA','x x','y y','$OA')"
 deny DIRECT_PROFILE_UPDATE 'permission denied' as $OA "UPDATE public.workspace_profiles SET label='hack'"
 # briefing
 as $MA "SELECT public.save_briefing_settings('$SA_STORE',true,'07:45:30','email',ARRAY['orders','handoff','orders'])" >/dev/null
 ok "$(as $OA "SELECT opt_in||'|'||send_time||'|'||destination||'|'||array_to_string(metrics,',')||'|'||status FROM public.store_briefing_settings WHERE store_id='$SA_STORE'")" "true|07:45:00|email|handoff,orders|awaiting_sender" MANAGER_SAVES_BRIEFING
 as $OA "SELECT public.save_briefing_settings('$SA_STORE',false,'06:00','telegram','{}')" >/dev/null
 ok "$(as $MA "SELECT opt_in||'|'||destination||'|'||cardinality(metrics) FROM public.store_briefing_settings WHERE store_id='$SA_STORE'")" "false|telegram|0" OWNER_UPSERTS_BRIEFING
 ok "$(as $SA "SELECT count(*) FROM public.store_briefing_settings")" 0 STAFF_CANNOT_READ_BRIEFING
 ok "$(as $OB "SELECT count(*) FROM public.store_briefing_settings")" 0 OTHER_TENANT_CANNOT_READ
 deny STAFF_SAVE 'access_denied' as $SA "SELECT public.save_briefing_settings('$SA_STORE',true,'07:00','email','{}')"
 deny CROSS_SAVE 'access_denied' as $OA "SELECT public.save_briefing_settings('$SB_STORE',true,'07:00','email','{}')"
 deny ANON_SAVE 'permission denied' as anon "SELECT public.save_briefing_settings('$SA_STORE',true,'07:00','email','{}')"
 deny BAD_DEST 'invalid_briefing' as $OA "SELECT public.save_briefing_settings('$SA_STORE',true,'07:00','sms','{}')"
 deny BAD_METRIC 'invalid_briefing' as $OA "SELECT public.save_briefing_settings('$SA_STORE',true,'07:00','email',ARRAY['DROP TABLE'])"
 deny DIRECT_INSERT 'permission denied' as $OA "INSERT INTO public.store_briefing_settings(store_id,tenant_id,updated_by) VALUES ('$SA_STORE','$TA','$OA')"
 deny DIRECT_UPDATE 'permission denied' as $OA "UPDATE public.store_briefing_settings SET status='sent'"
 deny STATUS_ONLY_AWAITING 'check constraint' admin "UPDATE public.store_briefing_settings SET status='active'"
 if [ $round = 1 ]; then
  runfile "$V25/90_workspace_settings_rollback.sql" T404_V25_WORKSPACE_SETTINGS_ROLLBACK_OK
  ok "$(admin "SELECT to_regclass('public.store_briefing_settings') IS NULL AND to_regclass('public.workspace_profiles') IS NULL AND to_regprocedure('public.save_workspace_profile(uuid,text,text[],text)') IS NULL")" t ROLLBACK_CLEAN
 fi
done
echo "T404_V25_WORKSPACE_OFFLINE_PASS $PASS"
