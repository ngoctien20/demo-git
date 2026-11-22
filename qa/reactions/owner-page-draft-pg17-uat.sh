#!/usr/bin/env bash
set -euo pipefail
# Disposable PG17 only; no hosted resource.
[[ "${TIEN404_DISPOSABLE_PG17_QA:-}" == YES && "${PGHOST:-}" == 127.0.0.1 && "${PGUSER:-}" == postgres ]] || exit 2
[[ -z "${DATABASE_URL:-}${SUPABASE_DB_URL:-}${SUPABASE_SERVICE_ROLE_KEY:-}${SUPABASE_ACCESS_TOKEN:-}" ]] || exit 2
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
V20="$ROOT/qa/v20-store-authority"
DB=t404_reaction_owner_qa
P=(psql -X -q -v ON_ERROR_STOP=1 -At)
q(){ "${P[@]}" -d "$DB" -c "$1" | tail -n 1; }
as(){ local role=authenticated claims
  if [[ "$1" == anon ]]; then role=anon;claims='{"role":"anon"}'
  else claims="{\"sub\":\"$1\",\"role\":\"authenticated\"}";fi
  "${P[@]}" -d "$DB" -c "SET ROLE $role" -c "SELECT set_config('request.jwt.claims','$claims',false)" -c "$2" | tail -n 1
}
PASS=0
ok(){ [[ "$1" == "$2" ]] || { echo "FAIL_$3 expected=$2 got=$1";exit 1; };PASS=$((PASS+1));echo "PASS_$3"; }
deny(){ local out; if out=$("$3" "$4" "$5" 2>&1);then echo "FAIL_$1";exit 1;fi
 echo "$out" | grep -q "$2" || { echo "FAIL_ERR_$1";echo "$out" | tail -n 2;exit 1; }
 PASS=$((PASS+1));echo "PASS_DENY_$1";
}
deny_user(){ local out; if out=$(as "$3" "$4" 2>&1);then echo "FAIL_$1";exit 1;fi
 echo "$out" | grep -q "$2" || { echo "FAIL_ERR_$1";echo "$out" | tail -n 2;exit 1; }
 PASS=$((PASS+1));echo "PASS_DENY_$1";
}
runfile(){ local out;out=$("${P[@]}" -d "$DB" -f "$1" 2>&1) || { echo "SQL_FAILED_$2";echo "$out" | tail -n 10;exit 1; }
 echo "$out" | grep -q "$2" || exit 1; PASS=$((PASS+1));echo "PASS_$2"; }
OA=a0000000-0000-4000-8000-00000000000a
OB=b0000000-0000-4000-8000-00000000000b
MA=a0000000-0000-4000-8000-0000000000a2
TA=9c8c524c-88db-4771-8ab0-a4316298494c
TB=4b12fc28-4fc3-4b06-bbf1-72a1f62ad5c5
"${P[@]}" -d postgres -c "DROP DATABASE IF EXISTS $DB" -c "CREATE DATABASE $DB" >/dev/null
"${P[@]}" -d "$DB" -f "$V20/00_hosted_baseline_replica.sql" >/dev/null
runfile "$V20/10_store_authority_expand.sql" T404_V20_STORE_AUTHORITY_EXPAND_OK
runfile "$V20/20_store_aware_writer.sql" T404_V20_STORE_AWARE_WRITER_OK
runfile "$V20/30_store_admin_rpcs.sql" T404_V20_STORE_ADMIN_RPCS_OK
runfile "$ROOT/db/config-core/10_config_core.sql" T404_CC_CONFIG_CORE_OK
runfile "$ROOT/db/reactions/10_page_reaction_drafts_CANDIDATE.sql" T404_V214_REACTION_DRAFT_CANDIDATE_OK
runfile "$ROOT/db/reactions/20_owner_reaction_page_list_CANDIDATE.sql" T404_V215_OWNER_PAGE_LIST_OK
runfile "$ROOT/db/reactions/30_meta_page_installation_authority_V216_CANDIDATE.sql" T404_V216_META_INSTALL_AUTHORITY_CANDIDATE_OK
runfile "$ROOT/db/reactions/40_meta_oauth_nonce_claim_V217_CANDIDATE.sql" T404_V217_META_NONCE_ONE_TIME_CANDIDATE_OK
SA=$(q "SELECT id FROM public.stores WHERE tenant_id='$TA' AND is_default")
SB=$(q "SELECT id FROM public.stores WHERE tenant_id='$TB' AND is_default")
q "INSERT INTO auth.users(id,email) VALUES ('$MA','manager@qa.invalid');INSERT INTO public.tenant_memberships(tenant_id,user_id,role) VALUES ('$TA','$MA','manager');INSERT INTO public.store_memberships(tenant_id,store_id,user_id,role) VALUES ('$TA','$SA','$MA','manager')" >/dev/null
AA=$(q "INSERT INTO public.assistants(tenant_id,store_id,name) VALUES ('$TA','$SA','QA A') RETURNING id")
AB=$(q "INSERT INTO public.assistants(tenant_id,store_id,name) VALUES ('$TB','$SB','QA B') RETURNING id")
CA=$(q "INSERT INTO public.channel_connections(tenant_id,store_id,assistant_id,channel,external_account_id,environment,status) VALUES ('$TA','$SA','$AA','messenger','123450001234500','demo','active') RETURNING id")
CB=$(q "INSERT INTO public.channel_connections(tenant_id,store_id,assistant_id,channel,external_account_id,environment,status) VALUES ('$TB','$SB','$AB','messenger','123450001234501','demo','active') RETURNING id")
CA2=$(q "INSERT INTO public.channel_connections(tenant_id,store_id,assistant_id,channel,external_account_id,environment,status) VALUES ('$TA','$SA','$AA','messenger','123450001234502','demo','active') RETURNING id")
F='{"schemaVersion":2,"profileId":"friendly","intents":{"thanks":true,"praise":true},"cooldownSeconds":300,"maxPerHour":2}'
R='{"schemaVersion":2,"profileId":"restrained","intents":{"thanks":true,"praise":false},"cooldownSeconds":600,"maxPerHour":1}'
X='{"schemaVersion":2,"profileId":"expressive","intents":{"thanks":true,"praise":true},"cooldownSeconds":90,"maxPerHour":5}'
Z='{"schemaVersion":2,"profileId":"silent","intents":{"thanks":false,"praise":false},"cooldownSeconds":3600,"maxPerHour":0}'
deny_user UNVERIFIED_PAGE unverified_page_industry "$OA" "SELECT public.save_page_reaction_draft('$CA','$F'::jsonb,NULL)"
ok "$(as "$OA" "SELECT count(*) FROM public.list_verified_reaction_pages('$SA')")" 0 ZERO_VERIFIED_BEFORE_ATTESTATION
deny_user ANON_NOT_ALLOWED permission "$OA" "SELECT 1 FROM app_private.reaction_page_industries LIMIT 1"
# APPROVED APP + proof rows are synthetic fixtures in disposable QA database ONLY.
# Real gateway must verify OAuth nonce, matching Page tasks, token/app/permission
# and Page subscription before signing a receipt and writing private proof metadata.
APP=900000000000001
q "INSERT INTO app_private.reaction_meta_apps(app_id,environment,status,approved_by,approved_at,expires_at)
 VALUES ('$APP','demo','approved','$OA',now()-interval '1 hour',now()+interval '30 days')" >/dev/null

# Synthetic issued challenges; only the server will issue these in a future deployment.
N_A=$(printf '1%.0s' {1..64})
N_B=$(printf '2%.0s' {1..64})
N_C=$(printf '3%.0s' {1..64})
INST_A=d0000000-0000-4000-8000-000000000001
INST_B=d0000000-0000-4000-8000-000000000002
INST_C=d0000000-0000-4000-8000-000000000003
q "INSERT INTO app_private.reaction_meta_nonce_claims
 (oauth_nonce_sha256,installation_id,connection_id,tenant_id,store_id,owner_user_id,
 meta_app_id,meta_page_id,expires_at)
 VALUES
 ('$N_A','$INST_A','$CA','$TA','$SA','$OA','$APP','123450001234500',now()+interval '6 minutes'),
 ('$N_B','$INST_B','$CB','$TB','$SB','$OB','$APP','123450001234501',now()+interval '6 minutes'),
 ('$N_C','$INST_C','$CA2','$TA','$SA','$OA','$APP','123450001234502',now()+interval '6 minutes')" >/dev/null
deny_user OWNER_CANNOT_READ_NONCE permission "$OA" "SELECT count(*) FROM app_private.reaction_meta_nonce_claims"
deny_user OWNER_CANNOT_CONSUME_NONCE permission "$OA" "SELECT app_private.t404_reaction_consume_meta_oauth_nonce('$N_A','$INST_A','$CA','$TA','$SA','$OA','$APP','123450001234500',repeat('a',64))"
ok "$(q "SELECT app_private.t404_reaction_consume_meta_oauth_nonce('$N_A','$INST_A','$CA','$TA','$SB','$OA','$APP','123450001234500',repeat('a',64))")" f NONCE_WRONG_STORE_DENIED
ok "$(q "SELECT app_private.t404_reaction_consume_meta_oauth_nonce('$N_A','$INST_A','$CA','$TA','$SA','$OB','$APP','123450001234500',repeat('a',64))")" f NONCE_WRONG_OWNER_DENIED
ok "$(q "SELECT app_private.t404_reaction_consume_meta_oauth_nonce('$N_A','$INST_A','$CA','$TA','$SA','$OA','$APP','123450001234500',repeat('a',64))")" t NONCE_A_FIRST_CLAIM
ok "$(q "SELECT app_private.t404_reaction_consume_meta_oauth_nonce('$N_A','$INST_A','$CA','$TA','$SA','$OA','$APP','123450001234500',repeat('a',64))")" f NONCE_A_REPLAY_DENIED
ok "$(q "SELECT app_private.t404_reaction_consume_meta_oauth_nonce('$N_B','$INST_B','$CB','$TB','$SB','$OB','$APP','123450001234501',repeat('b',64))")" t NONCE_B_FIRST_CLAIM
ok "$(q "SELECT app_private.t404_reaction_consume_meta_oauth_nonce('$N_C','$INST_C','$CA2','$TA','$SA','$OA','$APP','123450001234502',repeat('c',64))")" t NONCE_C_FIRST_CLAIM

q "INSERT INTO app_private.reaction_page_industries
 (connection_id,industry_id,proof_kind,verified_at,verified_by,
 meta_page_id,meta_app_id,installation_id,authority_issuer,attestation_version,
 receipt_sha256,oauth_nonce_sha256,callback_state_verified,token_app_binding_verified,page_token_validated,
 messaging_task_verified,subscribed_app_verified,validated_permissions,proof_status,expires_at)
 VALUES
 ('$CA','retail_general','meta_page_verified_installation',now(),'$OA',
 '123450001234500','$APP','$INST_A','t404_meta_oauth_gateway',1,
 repeat('a',64),'$N_A',true,true,true,true,true,ARRAY['pages_show_list','pages_manage_metadata','pages_messaging'],'verified',now()+interval '12 hours'),
 ('$CB','legal','meta_page_verified_installation',now(),'$OB',
 '123450001234501','$APP','$INST_B','t404_meta_oauth_gateway',1,
 repeat('b',64),'$N_B',true,true,true,true,true,ARRAY['pages_show_list','pages_manage_metadata','pages_messaging'],'verified',now()+interval '12 hours'),
 ('$CA2','artist','meta_page_verified_installation',now(),'$OA',
 '123450001234502','$APP','$INST_C','t404_meta_oauth_gateway',1,
 repeat('c',64),'$N_C',true,true,true,true,true,ARRAY['pages_show_list','pages_manage_metadata','pages_messaging'],'verified',now()+interval '12 hours')" >/dev/null
ok "$(q "SELECT count(*) FROM app_private.reaction_page_industries p WHERE app_private.t404_reaction_meta_install_active(p.connection_id)")" 3 META_PAGE_INSTALL_AUTHORITY_VALIDATED

# Receipt must match the unique consumed OAuth nonce, not just have valid-looking flags.
q "UPDATE app_private.reaction_page_industries SET receipt_sha256=repeat('e',64) WHERE connection_id='$CA2'" >/dev/null
ok "$(as "$OA" "SELECT count(*) FROM public.list_verified_reaction_pages('$SA')")" 1 NONCE_RECEIPT_MISMATCH_BLOCKS_LIST
q "UPDATE app_private.reaction_page_industries SET receipt_sha256=repeat('c',64) WHERE connection_id='$CA2'" >/dev/null
ok "$(as "$OA" "SELECT count(*) FROM public.list_verified_reaction_pages('$SA')")" 2 NONCE_RECEIPT_BINDING_RESTORED

# V21.7 real two-session PostgreSQL race: exactly one successful nonce consumption.
N_D=$(printf '4%.0s' {1..64})
INST_D=d0000000-0000-4000-8000-000000000004
q "INSERT INTO app_private.reaction_meta_nonce_claims
 (oauth_nonce_sha256,installation_id,connection_id,tenant_id,store_id,owner_user_id,meta_app_id,meta_page_id,expires_at)
 VALUES ('$N_D','$INST_D','$CA','$TA','$SA','$OA','$APP','123450001234500',now()+interval '6 minutes')" >/dev/null
NONCE_TMP="$(mktemp -d)"
trap 'rm -rf "$NONCE_TMP"' EXIT
( q "SELECT app_private.t404_reaction_consume_meta_oauth_nonce('$N_D','$INST_D','$CA','$TA','$SA','$OA','$APP','123450001234500',repeat('d',64))" >"$NONCE_TMP/a.out" 2>&1 ) &
( q "SELECT app_private.t404_reaction_consume_meta_oauth_nonce('$N_D','$INST_D','$CA','$TA','$SA','$OA','$APP','123450001234500',repeat('d',64))" >"$NONCE_TMP/b.out" 2>&1 ) &
wait
ok "$(grep -l '^t


# V21.6 negative Meta authority checks, no customer data or real Meta API.
q "UPDATE app_private.reaction_page_industries SET callback_state_verified=false WHERE connection_id='$CA2'" >/dev/null
ok "$(as "$OA" "SELECT count(*) FROM public.list_verified_reaction_pages('$SA')")" 1 META_OAUTH_STATE_BAD_EXCLUDED
deny_user META_CALLBACK_UNVERIFIED unverified_page_industry "$OA" "SELECT public.save_page_reaction_draft('$CA2','$X'::jsonb,NULL)"
q "UPDATE app_private.reaction_page_industries SET callback_state_verified=true WHERE connection_id='$CA2'" >/dev/null
q "UPDATE app_private.reaction_page_industries SET validated_permissions=ARRAY['pages_show_list','pages_manage_metadata'] WHERE connection_id='$CA2'" >/dev/null
ok "$(as "$OA" "SELECT count(*) FROM public.list_verified_reaction_pages('$SA')")" 1 META_MESSAGING_PERMISSION_MISSING
q "UPDATE app_private.reaction_page_industries SET validated_permissions=ARRAY['pages_show_list','pages_manage_metadata','pages_messaging'] WHERE connection_id='$CA2'" >/dev/null
q "UPDATE app_private.reaction_page_industries SET meta_page_id='123450001239999' WHERE connection_id='$CA2'" >/dev/null
ok "$(as "$OA" "SELECT count(*) FROM public.list_verified_reaction_pages('$SA')")" 1 META_PAGE_ID_MISMATCH_EXCLUDED
q "UPDATE app_private.reaction_page_industries SET meta_page_id='123450001234502' WHERE connection_id='$CA2'" >/dev/null
q "UPDATE app_private.reaction_page_industries SET messaging_task_verified=false WHERE connection_id='$CA2'" >/dev/null
ok "$(as "$OA" "SELECT count(*) FROM public.list_verified_reaction_pages('$SA')")" 1 META_MESSAGING_TASK_MISSING
q "UPDATE app_private.reaction_page_industries SET messaging_task_verified=true WHERE connection_id='$CA2'" >/dev/null
q "UPDATE app_private.reaction_page_industries SET subscribed_app_verified=false WHERE connection_id='$CA2'" >/dev/null
ok "$(as "$OA" "SELECT count(*) FROM public.list_verified_reaction_pages('$SA')")" 1 META_SUBSCRIBED_APP_UNVERIFIED
q "UPDATE app_private.reaction_page_industries SET subscribed_app_verified=true WHERE connection_id='$CA2'" >/dev/null
q "UPDATE app_private.reaction_page_industries SET proof_status='revoked' WHERE connection_id='$CA2'" >/dev/null
ok "$(as "$OA" "SELECT count(*) FROM public.list_verified_reaction_pages('$SA')")" 1 META_PROOF_REVOKED_EXCLUDED
q "UPDATE app_private.reaction_page_industries SET proof_status='verified' WHERE connection_id='$CA2'" >/dev/null
q "UPDATE app_private.reaction_meta_apps SET status='revoked' WHERE app_id='$APP'" >/dev/null
ok "$(as "$OA" "SELECT count(*) FROM public.list_verified_reaction_pages('$SA')")" 0 META_APP_REVOKED_DISALLOWS_ALL
q "UPDATE app_private.reaction_meta_apps SET status='approved' WHERE app_id='$APP'" >/dev/null
ok "$(as "$OA" "SELECT count(*) FROM public.list_verified_reaction_pages('$SA')")" 2 META_AUTHORITY_RESTORED_AFTER_SYNTHETIC_TEST
ok "$(q "SELECT has_table_privilege('authenticated','app_private.reaction_meta_apps','SELECT')")" f META_APP_REGISTRY_NOT_PUBLIC
ok "$(q "SELECT has_function_privilege('authenticated','app_private.t404_reaction_meta_install_active(uuid)','EXECUTE')")" f META_AUTHORITY_FUNCTION_PRIVATE

ok "$(as "$OA" "SELECT count(*) FROM public.list_verified_reaction_pages('$SA')")" 2 OWNER_A_TWO_VERIFIED_PAGES
ok "$(as "$OB" "SELECT count(*) FROM public.list_verified_reaction_pages('$SB')")" 1 OWNER_B_ONE_VERIFIED_PAGE
ok "$(as "$OB" "SELECT count(*) FROM public.list_verified_reaction_pages('$SA')")" 0 OWNER_B_NO_A_PAGE_LIST
ok "$(as "$MA" "SELECT count(*) FROM public.list_verified_reaction_pages('$SA')")" 0 MANAGER_NO_VERIFIED_LIST
deny_user ANON_LIST permission anon "SELECT count(*) FROM public.list_verified_reaction_pages('$SA')"
SHA=$(as "$OA" "SELECT public.save_page_reaction_draft('$CA','$F'::jsonb,NULL)")
ok "${#SHA}" 64 OWNER_A_SAVE
ok "$(as "$OA" "SELECT count(*) FROM public.list_verified_reaction_pages('$SA') WHERE draft_sha='$SHA'")" 1 OWNER_A_LIST_DRAFT_SHA
ok "$(as "$OA" "SELECT count(*) FROM public.page_reaction_drafts")" 1 OWNER_A_READ
ok "$(as "$OB" "SELECT count(*) FROM public.page_reaction_drafts")" 0 OWNER_B_CANNOT_READ
ok "$(as "$MA" "SELECT count(*) FROM public.page_reaction_drafts")" 0 MANAGER_CANNOT_READ
deny_user ANON_READ permission anon "SELECT count(*) FROM public.page_reaction_drafts"
deny_user CROSS_TENANT access_denied "$OB" "SELECT public.save_page_reaction_draft('$CA','$F'::jsonb,'$SHA')"
deny_user MANAGER_SAVE access_denied "$MA" "SELECT public.save_page_reaction_draft('$CA','$F'::jsonb,'$SHA')"
deny_user DIRECT_UPDATE permission "$OA" "UPDATE public.page_reaction_drafts SET industry_id='legal'"
deny_user STALE_SHA draft_changed "$OA" "SELECT public.save_page_reaction_draft('$CA','$R'::jsonb,'bad')"
deny_user FORBID_ENABLED invalid_reaction_draft "$OA" "SELECT public.save_page_reaction_draft('$CA',('$F'::jsonb || '{\"enabled\":true}'::jsonb),'$SHA')"
deny_user EXCESS_QUOTA profile_limit_invalid "$OA" "SELECT public.save_page_reaction_draft('$CA',jsonb_set('$F'::jsonb,'{maxPerHour}','6'::jsonb),'$SHA')"
SHA2=$(as "$OA" "SELECT public.save_page_reaction_draft('$CA','$R'::jsonb,'$SHA')")
ok "${#SHA2}" 64 OPTIMISTIC_SAVE
deny_user LEGAL_EXPRESSIVE profile_not_allowed "$OB" "SELECT public.save_page_reaction_draft('$CB','$X'::jsonb,NULL)"
SHB=$(as "$OB" "SELECT public.save_page_reaction_draft('$CB','$Z'::jsonb,NULL)")
ok "${#SHB}" 64 LEGAL_SILENT_ONLY
SHA3=$(as "$OA" "SELECT public.save_page_reaction_draft('$CA2','$X'::jsonb,NULL)")
ok "${#SHA3}" 64 ARTIST_SEPARATE_PAGE
q "UPDATE app_private.reaction_page_industries SET verified_at=now()-interval '181 days', expires_at=now()-interval '180 days' WHERE connection_id='$CA2'" >/dev/null
deny_user STALE_PROOF unverified_page_industry "$OA" "SELECT public.save_page_reaction_draft('$CA2','$X'::jsonb,'$SHA3')"
ok "$(as "$OA" "SELECT count(*) FROM public.list_verified_reaction_pages('$SA')")" 1 OWNER_A_LIST_EXCLUDES_STALE_PROOF
ok "$(q "SELECT count(*) FROM public.page_reaction_drafts")" 3 TOTAL_DRAFTS
ok "$(q "SELECT count(*) FROM app_private.audit_events WHERE event_type='reaction_page_draft_saved'")" 4 AUDIT_RECORDS
ok "$(q "SELECT to_regprocedure('public.publish_page_reaction_draft(uuid,text)') IS NULL")" t NO_PUBLISH_RPC
# Two owners of the SAME Page race on the SAME draft SHA; only one commit may win.
F2='{"schemaVersion":2,"profileId":"friendly","intents":{"thanks":true,"praise":false},"cooldownSeconds":300,"maxPerHour":1}'
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
( as "$OA" "SELECT public.save_page_reaction_draft('$CA','$F'::jsonb,'$SHA2')" >"$TMP/a.log" 2>&1 && echo yes >"$TMP/a.status" || echo no >"$TMP/a.status" ) &
( as "$OA" "SELECT public.save_page_reaction_draft('$CA','$F2'::jsonb,'$SHA2')" >"$TMP/b.log" 2>&1 && echo yes >"$TMP/b.status" || echo no >"$TMP/b.status" ) &
wait
WON=$(grep -l yes "$TMP"/*.status | wc -l | tr -d " ")
ok "$WON" 1 CONCURRENT_CAS_SINGLE_WINNER
LOST=$(grep -l no "$TMP"/*.status | wc -l | tr -d " ")
ok "$LOST" 1 CONCURRENT_CAS_SINGLE_LOSER
ok "$(q "SELECT count(*) FROM app_private.audit_events WHERE event_type='reaction_page_draft_saved'")" 5 CONCURRENT_CAS_ONE_EXTRA_AUDIT
ok "$(q "SELECT count(*) FROM public.page_reaction_drafts WHERE connection_id='$CA'")" 1 CONCURRENT_CAS_ONE_ROW

runfile "$ROOT/db/reactions/90_page_reaction_drafts_ROLLBACK_CANDIDATE.sql" T404_V214_REACTION_DRAFT_ROLLBACK_OK
ok "$(q "SELECT to_regclass('public.page_reaction_drafts') IS NULL")" t ROLLBACK_DRAFT_TABLE
ok "$(q "SELECT to_regclass('app_private.reaction_page_industries') IS NULL")" t ROLLBACK_INDUSTRY_REGISTRY
ok "$(q "SELECT to_regclass('app_private.reaction_meta_apps') IS NULL")" t ROLLBACK_META_APP_ALLOWLIST
ok "$(q "SELECT to_regclass('app_private.reaction_meta_nonce_claims') IS NULL")" t ROLLBACK_NONCE_LEDGER
ok "$(q "SELECT to_regprocedure('app_private.t404_reaction_consume_meta_oauth_nonce(text,uuid,uuid,uuid,uuid,uuid,text,text,text)') IS NULL")" t ROLLBACK_NONCE_CLAIM_RPC
ok "$(q "SELECT to_regprocedure('app_private.t404_reaction_meta_install_active(uuid)') IS NULL")" t ROLLBACK_AUTHORITY_FN
ok "$(q "SELECT to_regprocedure('public.list_verified_reaction_pages(uuid)') IS NULL")" t ROLLBACK_VERIFIED_PAGE_RPC
ok "$(q "SELECT to_regclass('public.channel_connections') IS NOT NULL")" t CONFIG_CORE_UNCHANGED
echo "T404_V214_PAGE_DRAFT_PG17_PASS $PASS"
 "$NONCE_TMP"/*.out | wc -l | tr -d ' ')" 1 NONCE_CONCURRENT_SINGLE_WINNER
ok "$(grep -l '^f


# V21.6 negative Meta authority checks, no customer data or real Meta API.
q "UPDATE app_private.reaction_page_industries SET callback_state_verified=false WHERE connection_id='$CA2'" >/dev/null
ok "$(as "$OA" "SELECT count(*) FROM public.list_verified_reaction_pages('$SA')")" 1 META_OAUTH_STATE_BAD_EXCLUDED
deny_user META_CALLBACK_UNVERIFIED unverified_page_industry "$OA" "SELECT public.save_page_reaction_draft('$CA2','$X'::jsonb,NULL)"
q "UPDATE app_private.reaction_page_industries SET callback_state_verified=true WHERE connection_id='$CA2'" >/dev/null
q "UPDATE app_private.reaction_page_industries SET validated_permissions=ARRAY['pages_show_list','pages_manage_metadata'] WHERE connection_id='$CA2'" >/dev/null
ok "$(as "$OA" "SELECT count(*) FROM public.list_verified_reaction_pages('$SA')")" 1 META_MESSAGING_PERMISSION_MISSING
q "UPDATE app_private.reaction_page_industries SET validated_permissions=ARRAY['pages_show_list','pages_manage_metadata','pages_messaging'] WHERE connection_id='$CA2'" >/dev/null
q "UPDATE app_private.reaction_page_industries SET meta_page_id='123450001239999' WHERE connection_id='$CA2'" >/dev/null
ok "$(as "$OA" "SELECT count(*) FROM public.list_verified_reaction_pages('$SA')")" 1 META_PAGE_ID_MISMATCH_EXCLUDED
q "UPDATE app_private.reaction_page_industries SET meta_page_id='123450001234502' WHERE connection_id='$CA2'" >/dev/null
q "UPDATE app_private.reaction_page_industries SET messaging_task_verified=false WHERE connection_id='$CA2'" >/dev/null
ok "$(as "$OA" "SELECT count(*) FROM public.list_verified_reaction_pages('$SA')")" 1 META_MESSAGING_TASK_MISSING
q "UPDATE app_private.reaction_page_industries SET messaging_task_verified=true WHERE connection_id='$CA2'" >/dev/null
q "UPDATE app_private.reaction_page_industries SET subscribed_app_verified=false WHERE connection_id='$CA2'" >/dev/null
ok "$(as "$OA" "SELECT count(*) FROM public.list_verified_reaction_pages('$SA')")" 1 META_SUBSCRIBED_APP_UNVERIFIED
q "UPDATE app_private.reaction_page_industries SET subscribed_app_verified=true WHERE connection_id='$CA2'" >/dev/null
q "UPDATE app_private.reaction_page_industries SET proof_status='revoked' WHERE connection_id='$CA2'" >/dev/null
ok "$(as "$OA" "SELECT count(*) FROM public.list_verified_reaction_pages('$SA')")" 1 META_PROOF_REVOKED_EXCLUDED
q "UPDATE app_private.reaction_page_industries SET proof_status='verified' WHERE connection_id='$CA2'" >/dev/null
q "UPDATE app_private.reaction_meta_apps SET status='revoked' WHERE app_id='$APP'" >/dev/null
ok "$(as "$OA" "SELECT count(*) FROM public.list_verified_reaction_pages('$SA')")" 0 META_APP_REVOKED_DISALLOWS_ALL
q "UPDATE app_private.reaction_meta_apps SET status='approved' WHERE app_id='$APP'" >/dev/null
ok "$(as "$OA" "SELECT count(*) FROM public.list_verified_reaction_pages('$SA')")" 2 META_AUTHORITY_RESTORED_AFTER_SYNTHETIC_TEST
ok "$(q "SELECT has_table_privilege('authenticated','app_private.reaction_meta_apps','SELECT')")" f META_APP_REGISTRY_NOT_PUBLIC
ok "$(q "SELECT has_function_privilege('authenticated','app_private.t404_reaction_meta_install_active(uuid)','EXECUTE')")" f META_AUTHORITY_FUNCTION_PRIVATE

ok "$(as "$OA" "SELECT count(*) FROM public.list_verified_reaction_pages('$SA')")" 2 OWNER_A_TWO_VERIFIED_PAGES
ok "$(as "$OB" "SELECT count(*) FROM public.list_verified_reaction_pages('$SB')")" 1 OWNER_B_ONE_VERIFIED_PAGE
ok "$(as "$OB" "SELECT count(*) FROM public.list_verified_reaction_pages('$SA')")" 0 OWNER_B_NO_A_PAGE_LIST
ok "$(as "$MA" "SELECT count(*) FROM public.list_verified_reaction_pages('$SA')")" 0 MANAGER_NO_VERIFIED_LIST
deny_user ANON_LIST permission anon "SELECT count(*) FROM public.list_verified_reaction_pages('$SA')"
SHA=$(as "$OA" "SELECT public.save_page_reaction_draft('$CA','$F'::jsonb,NULL)")
ok "${#SHA}" 64 OWNER_A_SAVE
ok "$(as "$OA" "SELECT count(*) FROM public.list_verified_reaction_pages('$SA') WHERE draft_sha='$SHA'")" 1 OWNER_A_LIST_DRAFT_SHA
ok "$(as "$OA" "SELECT count(*) FROM public.page_reaction_drafts")" 1 OWNER_A_READ
ok "$(as "$OB" "SELECT count(*) FROM public.page_reaction_drafts")" 0 OWNER_B_CANNOT_READ
ok "$(as "$MA" "SELECT count(*) FROM public.page_reaction_drafts")" 0 MANAGER_CANNOT_READ
deny_user ANON_READ permission anon "SELECT count(*) FROM public.page_reaction_drafts"
deny_user CROSS_TENANT access_denied "$OB" "SELECT public.save_page_reaction_draft('$CA','$F'::jsonb,'$SHA')"
deny_user MANAGER_SAVE access_denied "$MA" "SELECT public.save_page_reaction_draft('$CA','$F'::jsonb,'$SHA')"
deny_user DIRECT_UPDATE permission "$OA" "UPDATE public.page_reaction_drafts SET industry_id='legal'"
deny_user STALE_SHA draft_changed "$OA" "SELECT public.save_page_reaction_draft('$CA','$R'::jsonb,'bad')"
deny_user FORBID_ENABLED invalid_reaction_draft "$OA" "SELECT public.save_page_reaction_draft('$CA',('$F'::jsonb || '{\"enabled\":true}'::jsonb),'$SHA')"
deny_user EXCESS_QUOTA profile_limit_invalid "$OA" "SELECT public.save_page_reaction_draft('$CA',jsonb_set('$F'::jsonb,'{maxPerHour}','6'::jsonb),'$SHA')"
SHA2=$(as "$OA" "SELECT public.save_page_reaction_draft('$CA','$R'::jsonb,'$SHA')")
ok "${#SHA2}" 64 OPTIMISTIC_SAVE
deny_user LEGAL_EXPRESSIVE profile_not_allowed "$OB" "SELECT public.save_page_reaction_draft('$CB','$X'::jsonb,NULL)"
SHB=$(as "$OB" "SELECT public.save_page_reaction_draft('$CB','$Z'::jsonb,NULL)")
ok "${#SHB}" 64 LEGAL_SILENT_ONLY
SHA3=$(as "$OA" "SELECT public.save_page_reaction_draft('$CA2','$X'::jsonb,NULL)")
ok "${#SHA3}" 64 ARTIST_SEPARATE_PAGE
q "UPDATE app_private.reaction_page_industries SET verified_at=now()-interval '181 days', expires_at=now()-interval '180 days' WHERE connection_id='$CA2'" >/dev/null
deny_user STALE_PROOF unverified_page_industry "$OA" "SELECT public.save_page_reaction_draft('$CA2','$X'::jsonb,'$SHA3')"
ok "$(as "$OA" "SELECT count(*) FROM public.list_verified_reaction_pages('$SA')")" 1 OWNER_A_LIST_EXCLUDES_STALE_PROOF
ok "$(q "SELECT count(*) FROM public.page_reaction_drafts")" 3 TOTAL_DRAFTS
ok "$(q "SELECT count(*) FROM app_private.audit_events WHERE event_type='reaction_page_draft_saved'")" 4 AUDIT_RECORDS
ok "$(q "SELECT to_regprocedure('public.publish_page_reaction_draft(uuid,text)') IS NULL")" t NO_PUBLISH_RPC
# Two owners of the SAME Page race on the SAME draft SHA; only one commit may win.
F2='{"schemaVersion":2,"profileId":"friendly","intents":{"thanks":true,"praise":false},"cooldownSeconds":300,"maxPerHour":1}'
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
( as "$OA" "SELECT public.save_page_reaction_draft('$CA','$F'::jsonb,'$SHA2')" >"$TMP/a.log" 2>&1 && echo yes >"$TMP/a.status" || echo no >"$TMP/a.status" ) &
( as "$OA" "SELECT public.save_page_reaction_draft('$CA','$F2'::jsonb,'$SHA2')" >"$TMP/b.log" 2>&1 && echo yes >"$TMP/b.status" || echo no >"$TMP/b.status" ) &
wait
WON=$(grep -l yes "$TMP"/*.status | wc -l | tr -d " ")
ok "$WON" 1 CONCURRENT_CAS_SINGLE_WINNER
LOST=$(grep -l no "$TMP"/*.status | wc -l | tr -d " ")
ok "$LOST" 1 CONCURRENT_CAS_SINGLE_LOSER
ok "$(q "SELECT count(*) FROM app_private.audit_events WHERE event_type='reaction_page_draft_saved'")" 5 CONCURRENT_CAS_ONE_EXTRA_AUDIT
ok "$(q "SELECT count(*) FROM public.page_reaction_drafts WHERE connection_id='$CA'")" 1 CONCURRENT_CAS_ONE_ROW

runfile "$ROOT/db/reactions/90_page_reaction_drafts_ROLLBACK_CANDIDATE.sql" T404_V214_REACTION_DRAFT_ROLLBACK_OK
ok "$(q "SELECT to_regclass('public.page_reaction_drafts') IS NULL")" t ROLLBACK_DRAFT_TABLE
ok "$(q "SELECT to_regclass('app_private.reaction_page_industries') IS NULL")" t ROLLBACK_INDUSTRY_REGISTRY
ok "$(q "SELECT to_regclass('app_private.reaction_meta_apps') IS NULL")" t ROLLBACK_META_APP_ALLOWLIST
ok "$(q "SELECT to_regclass('app_private.reaction_meta_nonce_claims') IS NULL")" t ROLLBACK_NONCE_LEDGER
ok "$(q "SELECT to_regprocedure('app_private.t404_reaction_consume_meta_oauth_nonce(text,uuid,uuid,uuid,uuid,uuid,text,text,text)') IS NULL")" t ROLLBACK_NONCE_CLAIM_RPC
ok "$(q "SELECT to_regprocedure('app_private.t404_reaction_meta_install_active(uuid)') IS NULL")" t ROLLBACK_AUTHORITY_FN
ok "$(q "SELECT to_regprocedure('public.list_verified_reaction_pages(uuid)') IS NULL")" t ROLLBACK_VERIFIED_PAGE_RPC
ok "$(q "SELECT to_regclass('public.channel_connections') IS NOT NULL")" t CONFIG_CORE_UNCHANGED
echo "T404_V214_PAGE_DRAFT_PG17_PASS $PASS"
 "$NONCE_TMP"/*.out | wc -l | tr -d ' ')" 1 NONCE_CONCURRENT_SINGLE_LOSER
ok "$(q "SELECT count(*) FROM app_private.reaction_meta_nonce_claims WHERE oauth_nonce_sha256='$N_D' AND consumed_at IS NOT NULL")" 1 NONCE_CONCURRENT_SINGLE_CONSUMPTION
rm -rf "$NONCE_TMP"
trap - EXIT



# V21.6 negative Meta authority checks, no customer data or real Meta API.
q "UPDATE app_private.reaction_page_industries SET callback_state_verified=false WHERE connection_id='$CA2'" >/dev/null
ok "$(as "$OA" "SELECT count(*) FROM public.list_verified_reaction_pages('$SA')")" 1 META_OAUTH_STATE_BAD_EXCLUDED
deny_user META_CALLBACK_UNVERIFIED unverified_page_industry "$OA" "SELECT public.save_page_reaction_draft('$CA2','$X'::jsonb,NULL)"
q "UPDATE app_private.reaction_page_industries SET callback_state_verified=true WHERE connection_id='$CA2'" >/dev/null
q "UPDATE app_private.reaction_page_industries SET validated_permissions=ARRAY['pages_show_list','pages_manage_metadata'] WHERE connection_id='$CA2'" >/dev/null
ok "$(as "$OA" "SELECT count(*) FROM public.list_verified_reaction_pages('$SA')")" 1 META_MESSAGING_PERMISSION_MISSING
q "UPDATE app_private.reaction_page_industries SET validated_permissions=ARRAY['pages_show_list','pages_manage_metadata','pages_messaging'] WHERE connection_id='$CA2'" >/dev/null
q "UPDATE app_private.reaction_page_industries SET meta_page_id='123450001239999' WHERE connection_id='$CA2'" >/dev/null
ok "$(as "$OA" "SELECT count(*) FROM public.list_verified_reaction_pages('$SA')")" 1 META_PAGE_ID_MISMATCH_EXCLUDED
q "UPDATE app_private.reaction_page_industries SET meta_page_id='123450001234502' WHERE connection_id='$CA2'" >/dev/null
q "UPDATE app_private.reaction_page_industries SET messaging_task_verified=false WHERE connection_id='$CA2'" >/dev/null
ok "$(as "$OA" "SELECT count(*) FROM public.list_verified_reaction_pages('$SA')")" 1 META_MESSAGING_TASK_MISSING
q "UPDATE app_private.reaction_page_industries SET messaging_task_verified=true WHERE connection_id='$CA2'" >/dev/null
q "UPDATE app_private.reaction_page_industries SET subscribed_app_verified=false WHERE connection_id='$CA2'" >/dev/null
ok "$(as "$OA" "SELECT count(*) FROM public.list_verified_reaction_pages('$SA')")" 1 META_SUBSCRIBED_APP_UNVERIFIED
q "UPDATE app_private.reaction_page_industries SET subscribed_app_verified=true WHERE connection_id='$CA2'" >/dev/null
q "UPDATE app_private.reaction_page_industries SET proof_status='revoked' WHERE connection_id='$CA2'" >/dev/null
ok "$(as "$OA" "SELECT count(*) FROM public.list_verified_reaction_pages('$SA')")" 1 META_PROOF_REVOKED_EXCLUDED
q "UPDATE app_private.reaction_page_industries SET proof_status='verified' WHERE connection_id='$CA2'" >/dev/null
q "UPDATE app_private.reaction_meta_apps SET status='revoked' WHERE app_id='$APP'" >/dev/null
ok "$(as "$OA" "SELECT count(*) FROM public.list_verified_reaction_pages('$SA')")" 0 META_APP_REVOKED_DISALLOWS_ALL
q "UPDATE app_private.reaction_meta_apps SET status='approved' WHERE app_id='$APP'" >/dev/null
ok "$(as "$OA" "SELECT count(*) FROM public.list_verified_reaction_pages('$SA')")" 2 META_AUTHORITY_RESTORED_AFTER_SYNTHETIC_TEST
ok "$(q "SELECT has_table_privilege('authenticated','app_private.reaction_meta_apps','SELECT')")" f META_APP_REGISTRY_NOT_PUBLIC
ok "$(q "SELECT has_function_privilege('authenticated','app_private.t404_reaction_meta_install_active(uuid)','EXECUTE')")" f META_AUTHORITY_FUNCTION_PRIVATE

ok "$(as "$OA" "SELECT count(*) FROM public.list_verified_reaction_pages('$SA')")" 2 OWNER_A_TWO_VERIFIED_PAGES
ok "$(as "$OB" "SELECT count(*) FROM public.list_verified_reaction_pages('$SB')")" 1 OWNER_B_ONE_VERIFIED_PAGE
ok "$(as "$OB" "SELECT count(*) FROM public.list_verified_reaction_pages('$SA')")" 0 OWNER_B_NO_A_PAGE_LIST
ok "$(as "$MA" "SELECT count(*) FROM public.list_verified_reaction_pages('$SA')")" 0 MANAGER_NO_VERIFIED_LIST
deny_user ANON_LIST permission anon "SELECT count(*) FROM public.list_verified_reaction_pages('$SA')"
SHA=$(as "$OA" "SELECT public.save_page_reaction_draft('$CA','$F'::jsonb,NULL)")
ok "${#SHA}" 64 OWNER_A_SAVE
ok "$(as "$OA" "SELECT count(*) FROM public.list_verified_reaction_pages('$SA') WHERE draft_sha='$SHA'")" 1 OWNER_A_LIST_DRAFT_SHA
ok "$(as "$OA" "SELECT count(*) FROM public.page_reaction_drafts")" 1 OWNER_A_READ
ok "$(as "$OB" "SELECT count(*) FROM public.page_reaction_drafts")" 0 OWNER_B_CANNOT_READ
ok "$(as "$MA" "SELECT count(*) FROM public.page_reaction_drafts")" 0 MANAGER_CANNOT_READ
deny_user ANON_READ permission anon "SELECT count(*) FROM public.page_reaction_drafts"
deny_user CROSS_TENANT access_denied "$OB" "SELECT public.save_page_reaction_draft('$CA','$F'::jsonb,'$SHA')"
deny_user MANAGER_SAVE access_denied "$MA" "SELECT public.save_page_reaction_draft('$CA','$F'::jsonb,'$SHA')"
deny_user DIRECT_UPDATE permission "$OA" "UPDATE public.page_reaction_drafts SET industry_id='legal'"
deny_user STALE_SHA draft_changed "$OA" "SELECT public.save_page_reaction_draft('$CA','$R'::jsonb,'bad')"
deny_user FORBID_ENABLED invalid_reaction_draft "$OA" "SELECT public.save_page_reaction_draft('$CA',('$F'::jsonb || '{\"enabled\":true}'::jsonb),'$SHA')"
deny_user EXCESS_QUOTA profile_limit_invalid "$OA" "SELECT public.save_page_reaction_draft('$CA',jsonb_set('$F'::jsonb,'{maxPerHour}','6'::jsonb),'$SHA')"
SHA2=$(as "$OA" "SELECT public.save_page_reaction_draft('$CA','$R'::jsonb,'$SHA')")
ok "${#SHA2}" 64 OPTIMISTIC_SAVE
deny_user LEGAL_EXPRESSIVE profile_not_allowed "$OB" "SELECT public.save_page_reaction_draft('$CB','$X'::jsonb,NULL)"
SHB=$(as "$OB" "SELECT public.save_page_reaction_draft('$CB','$Z'::jsonb,NULL)")
ok "${#SHB}" 64 LEGAL_SILENT_ONLY
SHA3=$(as "$OA" "SELECT public.save_page_reaction_draft('$CA2','$X'::jsonb,NULL)")
ok "${#SHA3}" 64 ARTIST_SEPARATE_PAGE
q "UPDATE app_private.reaction_page_industries SET verified_at=now()-interval '181 days', expires_at=now()-interval '180 days' WHERE connection_id='$CA2'" >/dev/null
deny_user STALE_PROOF unverified_page_industry "$OA" "SELECT public.save_page_reaction_draft('$CA2','$X'::jsonb,'$SHA3')"
ok "$(as "$OA" "SELECT count(*) FROM public.list_verified_reaction_pages('$SA')")" 1 OWNER_A_LIST_EXCLUDES_STALE_PROOF
ok "$(q "SELECT count(*) FROM public.page_reaction_drafts")" 3 TOTAL_DRAFTS
ok "$(q "SELECT count(*) FROM app_private.audit_events WHERE event_type='reaction_page_draft_saved'")" 4 AUDIT_RECORDS
ok "$(q "SELECT to_regprocedure('public.publish_page_reaction_draft(uuid,text)') IS NULL")" t NO_PUBLISH_RPC
# Two owners of the SAME Page race on the SAME draft SHA; only one commit may win.
F2='{"schemaVersion":2,"profileId":"friendly","intents":{"thanks":true,"praise":false},"cooldownSeconds":300,"maxPerHour":1}'
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
( as "$OA" "SELECT public.save_page_reaction_draft('$CA','$F'::jsonb,'$SHA2')" >"$TMP/a.log" 2>&1 && echo yes >"$TMP/a.status" || echo no >"$TMP/a.status" ) &
( as "$OA" "SELECT public.save_page_reaction_draft('$CA','$F2'::jsonb,'$SHA2')" >"$TMP/b.log" 2>&1 && echo yes >"$TMP/b.status" || echo no >"$TMP/b.status" ) &
wait
WON=$(grep -l yes "$TMP"/*.status | wc -l | tr -d " ")
ok "$WON" 1 CONCURRENT_CAS_SINGLE_WINNER
LOST=$(grep -l no "$TMP"/*.status | wc -l | tr -d " ")
ok "$LOST" 1 CONCURRENT_CAS_SINGLE_LOSER
ok "$(q "SELECT count(*) FROM app_private.audit_events WHERE event_type='reaction_page_draft_saved'")" 5 CONCURRENT_CAS_ONE_EXTRA_AUDIT
ok "$(q "SELECT count(*) FROM public.page_reaction_drafts WHERE connection_id='$CA'")" 1 CONCURRENT_CAS_ONE_ROW

runfile "$ROOT/db/reactions/90_page_reaction_drafts_ROLLBACK_CANDIDATE.sql" T404_V214_REACTION_DRAFT_ROLLBACK_OK
ok "$(q "SELECT to_regclass('public.page_reaction_drafts') IS NULL")" t ROLLBACK_DRAFT_TABLE
ok "$(q "SELECT to_regclass('app_private.reaction_page_industries') IS NULL")" t ROLLBACK_INDUSTRY_REGISTRY
ok "$(q "SELECT to_regclass('app_private.reaction_meta_apps') IS NULL")" t ROLLBACK_META_APP_ALLOWLIST
ok "$(q "SELECT to_regclass('app_private.reaction_meta_nonce_claims') IS NULL")" t ROLLBACK_NONCE_LEDGER
ok "$(q "SELECT to_regprocedure('app_private.t404_reaction_consume_meta_oauth_nonce(text,uuid,uuid,uuid,uuid,uuid,text,text,text)') IS NULL")" t ROLLBACK_NONCE_CLAIM_RPC
ok "$(q "SELECT to_regprocedure('app_private.t404_reaction_meta_install_active(uuid)') IS NULL")" t ROLLBACK_AUTHORITY_FN
ok "$(q "SELECT to_regprocedure('public.list_verified_reaction_pages(uuid)') IS NULL")" t ROLLBACK_VERIFIED_PAGE_RPC
ok "$(q "SELECT to_regclass('public.channel_connections') IS NOT NULL")" t CONFIG_CORE_UNCHANGED
echo "T404_V214_PAGE_DRAFT_PG17_PASS $PASS"
