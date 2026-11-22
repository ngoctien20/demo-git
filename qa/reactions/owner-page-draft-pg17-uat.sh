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
SA=$(q "SELECT id FROM public.stores WHERE tenant_id='$TA' AND is_default")
SB=$(q "SELECT id FROM public.stores WHERE tenant_id='$TB' AND is_default")
q "INSERT INTO auth.users(id,email) VALUES ('$MA','manager@qa.invalid');INSERT INTO public.tenant_memberships(tenant_id,user_id,role) VALUES ('$TA','$MA','manager');INSERT INTO public.store_memberships(tenant_id,store_id,user_id,role) VALUES ('$TA','$SA','$MA','manager')" >/dev/null
AA=$(q "INSERT INTO public.assistants(tenant_id,store_id,name) VALUES ('$TA','$SA','QA A') RETURNING id")
AB=$(q "INSERT INTO public.assistants(tenant_id,store_id,name) VALUES ('$TB','$SB','QA B') RETURNING id")
CA=$(q "INSERT INTO public.channel_connections(tenant_id,store_id,assistant_id,channel,external_account_id,environment,status) VALUES ('$TA','$SA','$AA','messenger','PAGE_A_QA','demo','active') RETURNING id")
CB=$(q "INSERT INTO public.channel_connections(tenant_id,store_id,assistant_id,channel,external_account_id,environment,status) VALUES ('$TB','$SB','$AB','messenger','PAGE_B_QA','demo','active') RETURNING id")
CA2=$(q "INSERT INTO public.channel_connections(tenant_id,store_id,assistant_id,channel,external_account_id,environment,status) VALUES ('$TA','$SA','$AA','messenger','PAGE_A_ARTIST','demo','active') RETURNING id")
F='{"schemaVersion":2,"profileId":"friendly","intents":{"thanks":true,"praise":true},"cooldownSeconds":300,"maxPerHour":2}'
R='{"schemaVersion":2,"profileId":"restrained","intents":{"thanks":true,"praise":false},"cooldownSeconds":600,"maxPerHour":1}'
X='{"schemaVersion":2,"profileId":"expressive","intents":{"thanks":true,"praise":true},"cooldownSeconds":90,"maxPerHour":5}'
Z='{"schemaVersion":2,"profileId":"silent","intents":{"thanks":false,"praise":false},"cooldownSeconds":3600,"maxPerHour":0}'
deny_user UNVERIFIED_PAGE unverified_page_industry "$OA" "SELECT public.save_page_reaction_draft('$CA','$F'::jsonb,NULL)"
deny_user ANON_NOT_ALLOWED permission "$OA" "SELECT 1 FROM app_private.reaction_page_industries LIMIT 1"
q "INSERT INTO app_private.reaction_page_industries(connection_id,industry_id,proof_kind,verified_at,verified_by) VALUES ('$CA','retail_general','meta_page_verified_installation',now(),'$OA'),('$CB','legal','meta_page_verified_installation',now(),'$OB'),('$CA2','artist','meta_page_verified_installation',now(),'$OA')" >/dev/null
SHA=$(as "$OA" "SELECT public.save_page_reaction_draft('$CA','$F'::jsonb,NULL)")
ok "${#SHA}" 64 OWNER_A_SAVE
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
q "UPDATE app_private.reaction_page_industries SET verified_at=now()-interval '181 days' WHERE connection_id='$CA2'" >/dev/null
deny_user STALE_PROOF unverified_page_industry "$OA" "SELECT public.save_page_reaction_draft('$CA2','$X'::jsonb,'$SHA3')"
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
WON=$(grep -l '^yes
 "$TMP"/*.status | wc -l | tr -d ' ')
ok "$WON" 1 CONCURRENT_CAS_SINGLE_WINNER
LOST=$(grep -l '^no
 "$TMP"/*.status | wc -l | tr -d ' ')
ok "$LOST" 1 CONCURRENT_CAS_SINGLE_LOSER
ok "$(q "SELECT count(*) FROM app_private.audit_events WHERE event_type='reaction_page_draft_saved'")" 5 CONCURRENT_CAS_ONE_EXTRA_AUDIT
ok "$(q "SELECT count(*) FROM public.page_reaction_drafts WHERE connection_id='$CA'")" 1 CONCURRENT_CAS_ONE_ROW

echo "T404_V214_PAGE_DRAFT_PG17_PASS $PASS"
