#!/usr/bin/env bash
# TIEN404 Universal Configuration Core v1 — OFFLINE UAT on a disposable LOCAL PostgreSQL.
# Stack: V20 replica 00 + V20 10/20/30 (as on develop) + db/config-core/10, then rollback 90 and re-apply.
# Simulated Supabase roles + request.jwt.claims (same harness as qa/v20-store-authority, qa/v23-web).
# NOT hosted acceptance. Refuses any non-local host or hosted credentials in the environment.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"; ROOT="$DIR/../.."; V20="$ROOT/qa/v20-store-authority"; CC="$ROOT/db/config-core"
: "${PGHOST:?}"; : "${PGPORT:?}"; : "${PGUSER:=postgres}"; PGDATABASE=t404_config_core
case "$PGHOST" in /*|127.0.0.1|localhost) ;; *) echo "REFUSE_NON_LOCAL_HOST"; exit 2;; esac
[ -z "${SUPABASE_DB_URL:-}${SUPABASE_ACCESS_TOKEN:-}${DATABASE_URL:-}" ] || { echo "REFUSE_HOSTED_ENV"; exit 2; }
export PGHOST PGPORT PGUSER
PASS=0; PSQL=(psql -X -q -v ON_ERROR_STOP=1 -At)
admin(){ "${PSQL[@]}" -d "$PGDATABASE" -c "$1"; }
as(){ local who="$1" sql="$2" role=authenticated claims
  case "$who" in
   anon) role=anon; claims='{"role":"anon"}';;
   service) role=service_role; claims='{"role":"service_role"}';;
   *) claims="{\"sub\":\"$who\",\"role\":\"authenticated\"}";;
  esac
  "${PSQL[@]}" -d "$PGDATABASE" -c "SET ROLE $role" -c "SELECT set_config('request.jwt.claims','$claims',false)" -c "$sql" | tail -n 1; }
ok(){ if [ "$1" = "$2" ]; then PASS=$((PASS+1)); echo "PASS_$3"; else echo "FAIL_$3 expected=[$2] got=[$1]"; exit 1; fi; }
deny(){ local tag=$1 re=$2; shift 2; local out
  if out=$("$@" 2>&1); then echo "FAIL_${tag} unexpectedly accepted: $out"; exit 1; fi
  if echo "$out" | grep -Eq "$re"; then PASS=$((PASS+1)); echo "PASS_DENY_${tag}"; else echo "FAIL_${tag} wrong error: $out"; exit 1; fi; }
runfile(){ local out; out=$("${PSQL[@]}" -d "$PGDATABASE" -f "$1" 2>&1) || { echo "$out"; echo "FAIL_RUN_$2"; exit 1; }
  echo "$out" | grep -q "$2" || { echo "$out"; echo "FAIL_MARKER_$2"; exit 1; }; PASS=$((PASS+1)); echo "PASS_$2"; }
md5fn(){ admin "SELECT md5(pg_get_functiondef('$1'::regprocedure))"; }
q(){ printf "%s" "$1" | sed "s/'/''/g"; }

TA=9c8c524c-88db-4771-8ab0-a4316298494c; TB=4b12fc28-4fc3-4b06-bbf1-72a1f62ad5c5; TC=7c7c7c7c-0000-4000-8000-00000000000c
OA=a0000000-0000-4000-8000-00000000000a; OB=b0000000-0000-4000-8000-00000000000b
MA=a0000000-0000-4000-8000-0000000000a2; SA=a0000000-0000-4000-8000-0000000000a3; OC=c0000000-0000-4000-8000-00000000000c

"${PSQL[@]}" -d postgres -c "DROP DATABASE IF EXISTS $PGDATABASE" -c "CREATE DATABASE $PGDATABASE" >/dev/null
"${PSQL[@]}" -d "$PGDATABASE" -f "$V20/00_hosted_baseline_replica.sql" >/dev/null
runfile "$V20/10_store_authority_expand.sql" T404_V20_STORE_AUTHORITY_EXPAND_OK
runfile "$V20/20_store_aware_writer.sql" T404_V20_STORE_AWARE_WRITER_OK
runfile "$V20/30_store_admin_rpcs.sql" T404_V20_STORE_ADMIN_RPCS_OK
admin "INSERT INTO auth.users(id,email) VALUES ('$MA','manager-a@qa.invalid'),('$SA','staff-a@qa.invalid'),('$OC','owner-c@qa.invalid');
 INSERT INTO public.tenants(id,slug,name) VALUES ('$TC','not-allowlisted-shop-c','Shop C (not allow-listed)');
 INSERT INTO public.tenant_memberships(tenant_id,user_id,role) VALUES ('$TA','$MA','manager'),('$TA','$SA','staff'),('$TC','$OC','owner');
 INSERT INTO public.store_memberships(tenant_id,store_id,user_id,role)
  SELECT tenant_id,id,'$MA'::uuid,'manager' FROM public.stores WHERE tenant_id='$TA' AND is_default UNION ALL
  SELECT tenant_id,id,'$SA','staff' FROM public.stores WHERE tenant_id='$TA' AND is_default UNION ALL
  SELECT tenant_id,id,'$OC','owner' FROM public.stores WHERE tenant_id='$TC' AND is_default;" >/dev/null
SA_STORE=$(admin "SELECT id FROM public.stores WHERE tenant_id='$TA' AND is_default")
SB_STORE=$(admin "SELECT id FROM public.stores WHERE tenant_id='$TB' AND is_default")
SC_STORE=$(admin "SELECT id FROM public.stores WHERE tenant_id='$TC' AND is_default")
MD5_ALLOW=$(md5fn 'app_private.t404_qa_tenant_allowed(uuid)')
MD5_WRITER=$(md5fn 'public.save_merchant_product(uuid,text,text,bigint,boolean,integer,timestamptz)')

# ---------------- apply ----------------
( cd "$ROOT" && node config-core/build-seed.mjs --check ) >/dev/null && { PASS=$((PASS+1)); echo PASS_SEED_BLOCK_MATCHES_JS; }
runfile "$CC/10_config_core.sql" T404_CC_CONFIG_CORE_OK
deny NOT_REAPPLIABLE 'T404_CC_ALREADY_APPLIED' "${PSQL[@]}" -d "$PGDATABASE" -f "$CC/10_config_core.sql"

# ---------------- registry + templates parity with JS ----------------
REG=$(node "$DIR/templates-json.mjs" registry); TPL=$(node "$DIR/templates-json.mjs")
ok "$(admin "SELECT jsonb_object_agg(action_type,status)='$(q "$REG")'::jsonb FROM public.action_types")" t REGISTRY_EQUALS_JS
ok "$(admin "SELECT jsonb_object_agg(template_key,config)='$(q "$TPL")'::jsonb FROM public.industry_templates")" t TEMPLATES_EQUAL_JS
ok "$(admin "SELECT bool_and(app_private.t404_cfg_validate(config,'publish')='{}') FROM public.industry_templates")" t SEEDED_TEMPLATES_PUBLISHABLE

# ---------------- validator parity (same fixtures as node unit tests) ----------------
N=0
while IFS= read -r line; do
  name=$(printf '%s' "$line" | node -e 'const j=JSON.parse(require("fs").readFileSync(0,"utf8"));console.log(j.name)')
  got=$(admin "WITH f AS (SELECT '$(q "$line")'::jsonb j)
    SELECT coalesce(jsonb_agg(split_part(e,'|',2) ORDER BY split_part(e,'|',2)),'[]')=(SELECT j->'codes' FROM f)
    FROM f, unnest(app_private.t404_cfg_validate(j->'cfg', j->>'mode')) e")
  ok "$got" t "PARITY_$name"; N=$((N+1))
done < <(node "$DIR/dump-fixtures.mjs")
echo "PARITY_CASES=$N"

# ---------------- grants ----------------
deny ANON_READ_ASSISTANTS 'permission denied' as anon "SELECT count(*) FROM public.assistants"
deny ANON_CREATE 'permission denied' as anon "SELECT public.create_assistant('$SA_STORE','x','shop')"
deny AUTH_DIRECT_INSERT 'permission denied' as $OA "INSERT INTO public.assistants(tenant_id,store_id,name) VALUES ('$TA','$SA_STORE','x')"
deny AUTH_DIRECT_INSERT_VERSION 'permission denied' as $OA "INSERT INTO public.assistant_config_versions(tenant_id,store_id,assistant_id,version_no,state,config,config_sha256,source) VALUES ('$TA','$SA_STORE',gen_random_uuid(),1,'draft','{}','x','x')"
deny AUTH_RESOLVER 'permission denied' as $OA "SELECT * FROM public.resolve_channel_assistant('messenger','1')"
deny AUTH_VALIDATOR 'permission denied' as $OA "SELECT app_private.t404_cfg_validate('{}','draft')"
deny AUTH_INSERT_CONNECTION 'permission denied' as $OA "INSERT INTO public.channel_connections(tenant_id,store_id,channel,external_account_id,environment) VALUES ('$TA','$SA_STORE','messenger','999','demo')"
ok "$(as $OA "SELECT count(*) FROM public.industry_templates")" 4 AUTH_READS_TEMPLATES

# ---------------- create + tenant isolation ----------------
AID=$(as $OA "SELECT public.create_assistant('$SA_STORE','Trợ lý Shop A','shop')")
ok "$(as $OA "SELECT version_no||':'||state||':'||source FROM public.assistant_config_versions WHERE assistant_id='$AID'")" "1:draft:template:shop@1" A_DRAFT_FROM_TEMPLATE
ok "$(as $OB "SELECT count(*) FROM public.assistants")" 0 B_CANNOT_SEE_A
ok "$(as $OB "SELECT count(*) FROM public.assistant_config_versions")" 0 B_CANNOT_SEE_A_VERSIONS
deny B_CREATE_IN_A 'access_denied' as $OB "SELECT public.create_assistant('$SA_STORE','x','shop')"
deny B_SAVE_A 'access_denied' as $OB "SELECT public.save_assistant_draft('$AID','{}',NULL)"
deny B_PUBLISH_A 'access_denied' as $OB "SELECT public.publish_assistant_config('$AID','x')"
deny B_ROLLBACK_A 'access_denied' as $OB "SELECT public.rollback_assistant_config('$AID',1)"
deny NOT_ALLOWLISTED_TENANT 'access_denied' as $OC "SELECT public.create_assistant('$SC_STORE','x','shop')"
deny UNKNOWN_TEMPLATE 'template_unknown' as $OA "SELECT public.create_assistant('$SA_STORE','x','casino')"
deny RANDOM_ASSISTANT 'access_denied' as $OA "SELECT public.save_assistant_draft(gen_random_uuid(),'{}',NULL)"
BID=$(as $OB "SELECT public.create_assistant('$SB_STORE','Trợ lý nghệ sĩ B','artist')")
ok "$(as $OA "SELECT count(*) FROM public.assistants WHERE id='$BID'")" 0 A_CANNOT_SEE_B

# ---------------- staff read-only, manager can edit ----------------
ok "$(as $SA "SELECT count(*) FROM public.assistants WHERE id='$AID'")" 1 STAFF_CAN_READ
SHA1=$(as $OA "SELECT config_sha256 FROM public.assistant_config_versions WHERE assistant_id='$AID' AND state='draft'")
CFG=$(as $OA "SELECT config FROM public.assistant_config_versions WHERE assistant_id='$AID' AND state='draft'")
deny STAFF_SAVE 'access_denied' as $SA "SELECT public.save_assistant_draft('$AID','$(q "$CFG")','$SHA1')"
deny STAFF_PUBLISH 'access_denied' as $SA "SELECT public.publish_assistant_config('$AID','$SHA1')"

# ---------------- edit draft: rename, reorder, hide, optimistic concurrency ----------------
CFG2=$(printf '%s' "$CFG" | node -e 'const c=JSON.parse(require("fs").readFileSync(0,"utf8"));
 c.menu.find(m=>m.id==="handoff").label="Gặp tư vấn viên"; c.menu.find(m=>m.id==="handoff").sort_order=5;
 c.menu.find(m=>m.id==="order_lookup").enabled=false; console.log(JSON.stringify(c))')
deny STALE_SHA 'draft_changed' as $MA "SELECT public.save_assistant_draft('$AID','$(q "$CFG2")','deadbeef')"
SHA2=$(as $MA "SELECT public.save_assistant_draft('$AID','$(q "$CFG2")','$SHA1')")
ok "$(as $OA "SELECT config->'menu'->3->>'label' FROM public.assistant_config_versions WHERE assistant_id='$AID' AND state='draft'")" "Gặp tư vấn viên" MANAGER_RENAMED
deny CONCURRENT_EDITOR 'draft_changed' as $OA "SELECT public.save_assistant_draft('$AID','$(q "$CFG")','$SHA1')"
BAD=$(printf '%s' "$CFG2" | node -e 'const c=JSON.parse(require("fs").readFileSync(0,"utf8")); c.menu[0].action_config={category:"ao",tool:"create_order"}; console.log(JSON.stringify(c))')
deny INJECTED_TOOL 'invalid_config' as $OA "SELECT public.save_assistant_draft('$AID','$(q "$BAD")','$SHA2')"
EXP=$(printf '%s' "$CFG2" | node -e 'const c=JSON.parse(require("fs").readFileSync(0,"utf8")); c.menu.push({id:"booking",action_type:"BOOKING_REQUEST",label:"Đặt lịch",enabled:true,sort_order:99,action_config:{}}); console.log(JSON.stringify(c))')
SHA_EXP=$(as $OA "SELECT public.save_assistant_draft('$AID','$(q "$EXP")','$SHA2')")
deny PUBLISH_EXPERIMENTAL 'invalid_config' as $OA "SELECT public.publish_assistant_config('$AID','$SHA_EXP')"
SHA2=$(as $OA "SELECT public.save_assistant_draft('$AID','$(q "$CFG2")','$SHA_EXP')")

# ---------------- publish + immutability ----------------
deny PUBLISH_STALE 'draft_changed' as $OA "SELECT public.publish_assistant_config('$AID','$SHA1')"
ok "$(as $OA "SELECT public.publish_assistant_config('$AID','$SHA2')")" 1 PUBLISH_V1
deny PUBLISH_TWICE 'draft_changed' as $OA "SELECT public.publish_assistant_config('$AID','$SHA2')"
deny PUBLISHED_IMMUTABLE_EVEN_FOR_ADMIN 'config_version_immutable' admin "UPDATE public.assistant_config_versions SET config=config||'{\"greeting\":\"x\"}' WHERE assistant_id='$AID' AND version_no=1"
deny PUBLISHED_UNDELETABLE 'config_version_immutable' admin "DELETE FROM public.assistant_config_versions WHERE assistant_id='$AID' AND version_no=1"
deny MOVE_VERSION_TO_B 'config_version_immutable' admin "UPDATE public.assistant_config_versions SET tenant_id='$TB' WHERE assistant_id='$AID' AND version_no=1"

# ---------------- second version, rollback ----------------
CFG3=$(printf '%s' "$CFG2" | node -e 'const c=JSON.parse(require("fs").readFileSync(0,"utf8")); c.greeting="Chào bạn, phiên bản 2!"; console.log(JSON.stringify(c))')
SHA3=$(as $OA "SELECT public.save_assistant_draft('$AID','$(q "$CFG3")',NULL)")
ok "$(as $OA "SELECT version_no FROM public.assistant_config_versions WHERE assistant_id='$AID' AND state='draft'")" 2 NEW_DRAFT_V2
ok "$(as $OA "SELECT public.publish_assistant_config('$AID','$SHA3')")" 2 PUBLISH_V2
ok "$(as $OA "SELECT string_agg(version_no||state,',' ORDER BY version_no) FROM public.assistant_config_versions WHERE assistant_id='$AID'")" "1superseded,2published" V1_SUPERSEDED
SHA4=$(as $OA "SELECT public.save_assistant_draft('$AID','$(q "$CFG3")',NULL)")
ok "$(as $OA "SELECT public.rollback_assistant_config('$AID',1)")" 4 ROLLBACK_TO_V1_AS_V4
ok "$(as $OA "SELECT (SELECT config FROM public.assistant_config_versions WHERE assistant_id='$AID' AND state='published')=(SELECT config FROM public.assistant_config_versions WHERE assistant_id='$AID' AND version_no=1)")" t ROLLBACK_CONFIG_EQUALS_V1
ok "$(as $OA "SELECT source FROM public.assistant_config_versions WHERE assistant_id='$AID' AND state='published'")" "rollback:v1" ROLLBACK_SOURCE
ok "$(as $OA "SELECT version_no||':'||config_sha256 FROM public.assistant_config_versions WHERE assistant_id='$AID' AND state='draft'")" "3:$SHA4" OPEN_DRAFT_UNTOUCHED
deny ROLLBACK_TO_DRAFT 'version_not_found' as $OA "SELECT public.rollback_assistant_config('$AID',3)"
deny ROLLBACK_MISSING 'version_not_found' as $OA "SELECT public.rollback_assistant_config('$AID',99)"
ok "$(admin "SELECT count(*) FROM app_private.audit_events WHERE event_type LIKE 'assistant_%' AND tenant_id='$TA'")" 9 AUDITED

# ---------------- channel connections + trusted resolver ----------------
as service "INSERT INTO public.channel_connections(tenant_id,store_id,assistant_id,channel,external_account_id,environment,status) VALUES ('$TA','$SA_STORE','$AID','messenger','2379295362359912','demo','active')" >/dev/null
deny PAGE_BOUND_TWICE 'channel_connections_account_key' as service "INSERT INTO public.channel_connections(tenant_id,store_id,assistant_id,channel,external_account_id,environment,status) VALUES ('$TB','$SB_STORE','$BID','messenger','2379295362359912','demo','active')"
deny CROSS_TENANT_ASSISTANT_BINDING 'channel_connections_assistant_fk' as service "INSERT INTO public.channel_connections(tenant_id,store_id,assistant_id,channel,external_account_id,environment) VALUES ('$TA','$SA_STORE','$BID','web','site-b','demo')"
ok "$(as service "SELECT tenant_id||':'||version_no||':'||(config->>'greeting') FROM public.resolve_channel_assistant('messenger','2379295362359912')")" "$TA:4:$(printf '%s' "$CFG2" | node -e 'console.log(JSON.parse(require("fs").readFileSync(0,"utf8")).greeting)')" RESOLVER_RETURNS_A_PUBLISHED
ok "$(as service "SELECT count(*) FROM public.resolve_channel_assistant('messenger','111')")" 0 RESOLVER_UNKNOWN_PAGE
ok "$(as service "SELECT count(*) FROM public.resolve_channel_assistant('zalo_bot','2379295362359912')")" 0 RESOLVER_CHANNEL_SCOPED
ok "$(as $OA "SELECT count(*) FROM public.channel_connections")" 1 A_SEES_OWN_CONNECTION
ok "$(as $OB "SELECT count(*) FROM public.channel_connections")" 0 B_CANNOT_SEE_A_CONNECTION
admin "UPDATE public.channel_connections SET status='disabled'" >/dev/null
ok "$(as service "SELECT count(*) FROM public.resolve_channel_assistant('messenger','2379295362359912')")" 0 RESOLVER_DISABLED_CONNECTION
admin "UPDATE public.channel_connections SET status='active'; UPDATE public.assistants SET status='disabled' WHERE id='$AID'" >/dev/null
ok "$(as service "SELECT count(*) FROM public.resolve_channel_assistant('messenger','2379295362359912')")" 0 RESOLVER_DISABLED_ASSISTANT

# ---------------- V20 untouched ----------------
ok "$(md5fn 'app_private.t404_qa_tenant_allowed(uuid)')" "$MD5_ALLOW" V20_ALLOWLIST_UNCHANGED
ok "$(md5fn 'public.save_merchant_product(uuid,text,text,bigint,boolean,integer,timestamptz)')" "$MD5_WRITER" V20_WRITER_UNCHANGED

# ---------------- rollback 90 + re-apply ----------------
runfile "$CC/90_config_core_rollback.sql" T404_CC_ROLLBACK_OK
ok "$(admin "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('assistants','assistant_config_versions','channel_connections','action_types','industry_templates')")" 0 ROLLBACK_NO_TABLES
ok "$(admin "SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE (n.nspname='app_private' AND p.proname LIKE 't404_cfg%') OR p.proname IN ('create_assistant','save_assistant_draft','publish_assistant_config','rollback_assistant_config','resolve_channel_assistant','t404_acv_guard')")" 0 ROLLBACK_NO_FUNCTIONS
ok "$(md5fn 'app_private.t404_qa_tenant_allowed(uuid)')" "$MD5_ALLOW" V20_ALLOWLIST_UNCHANGED_AFTER_ROLLBACK
runfile "$CC/10_config_core.sql" T404_CC_CONFIG_CORE_OK
echo "T404_CONFIG_CORE_OFFLINE_UAT_PASS=$PASS"
