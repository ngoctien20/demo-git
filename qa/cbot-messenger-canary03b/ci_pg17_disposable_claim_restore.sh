#!/usr/bin/env bash
# CBOT-MSG-CANARY-03B — disposable PostgreSQL17 only.
# NEVER run on Supabase hosted or any customer database. This uses a
# freshly created fake database inside a CI-only postgres:17 service.
# Tests the same review-only INSERT/ON CONFLICT/FOR UPDATE SQL from GitHub.
# NOT native Meta authorization, prod SQL approval, n8n real restore,
# nor guaranteed exactly-once delivery.
set -euo pipefail
root="$(cd "$(dirname "$0")" && pwd)"
[[ "$(printenv CI || true)" == "true" &&
   "$(printenv CI_CANARY03B_DISPOSABLE || true)" == "YES" &&
   "$(printenv PGHOST || true)" == "postgres" &&
   "$(printenv PGUSER || true)" == "postgres" &&
   "$(printenv PGDATABASE || true)" == "t404_cbot03b_ci" ]] || {
  echo "BLOCKED: CANARY03B_PG17_DISPOSABLE_QA_ONLY"; exit 2; }
[[ "$(psql -X -Atqc 'SELECT current_database()')" == "t404_cbot03b_ci" ]] ||
  { echo 'BLOCKED: wrong DB'; exit 2; }
[[ "$(psql -X -Atqc 'SHOW server_version_num')" == 17* ]] ||
  { echo 'BLOCKED: wrong PG major'; exit 2; }

# Roles exist in Supabase, not vanilla disposable PostgreSQL.
# The CI-only roles are created ONLY in disposable postgres:17.
psql -X -v ON_ERROR_STOP=1 -q <<'SQL'
DO $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
   CREATE ROLE anon NOLOGIN;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
   CREATE ROLE authenticated NOLOGIN;
 END IF;
END$$;
SQL
psql -X -v ON_ERROR_STOP=1 -q -f \
  "$root/PRIVATE_PAGE_ONE_SHOT_SCHEMA_REVIEW_ONLY.sql"

for role in anon authenticated; do
  role_access="$(psql -X -Atq -c "SELECT has_schema_privilege('$role','t404_canary_private','USAGE')")"
  [[ "$role_access" == "f" ]] || exit 1
done
[[ "$(psql -X -Atqc "SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='t404_canary_private'")" == "0" ]] || exit 1

campaign="00000000-0000-4000-8000-000000000001"
campaign2="00000000-0000-4000-8000-000000000002"
campaign3="00000000-0000-4000-8000-000000000003"
page="$(printf 'a%.0s' {1..64})"
recipient="$(printf 'b%.0s' {1..64})"
profile="$(printf 'c%.0s' {1..64})"
owner="$(printf 'd%.0s' {1..64})"
reviewer="$(printf 'e%.0s' {1..64})"
event="$(printf 'f%.0s' {1..64})"
wrong="$(printf '0%.0s' {1..64})"
new_event="$(printf '1%.0s' {1..64})"

psql -X -v ON_ERROR_STOP=1 -q -c "
INSERT INTO t404_canary_private.page_only_authorizations
(canary_id,page_binding_hmac,recipient_binding_hmac,
 approved_profile_sha256,owner_consent_ticket_hmac,reviewer_ticket_hmac,
 marker,state,valid_from,expires_at)
VALUES ('$campaign','$page','$recipient','$profile','$owner','$reviewer',
 'TIEN404-CANARY-LIVE02','APPROVED',
 clock_timestamp()-interval '5 seconds',clock_timestamp()+interval '5 minutes'),
 ('$campaign2','$page','$recipient','$profile','$owner','$reviewer',
 'TIEN404-CANARY-LIVE02','APPROVED',
 clock_timestamp()-interval '5 seconds',clock_timestamp()+interval '5 minutes'),
 ('$campaign3','$page','$recipient','$profile','$owner','$reviewer',
 'TIEN404-CANARY-LIVE02','REVOKED',
 clock_timestamp()-interval '5 seconds',clock_timestamp()+interval '5 minutes');"

# Use EXACT SQL CTE/INSERT from the review-only source as a prepared
# statement, with fake positional parameters and no real provider event.
claim_statement="$(awk '
 /^WITH eligible AS MATERIALIZED/{flag=1}
 flag && /^COMMIT;/{exit}
 flag {print}
' "$root/PRIVATE_ONE_SHOT_ATOMIC_CLAIM_REVIEW_ONLY.sql")"
[[ "$claim_statement" == *"FOR UPDATE OF a"* &&
   "$claim_statement" == *"ON CONFLICT DO NOTHING"* &&
   "$claim_statement" == *"RETURNING canary_id;"* ]] || exit 1
pgclaim(){
 local camp="$1" pg="$2" rcpt="$3" prof="$4" evt="$5" marker="$6"
 psql -X -Atq -v ON_ERROR_STOP=1 -c "
PREPARE t404_claim(uuid,text,text,text,text,text) AS
$claim_statement
EXECUTE t404_claim('$camp','$pg','$rcpt','$prof','$evt','$marker');
"
}
# Wrong Page, PSID, config, marker or revoked owner consent cannot claim.
[[ -z "$(pgclaim "$campaign" "$wrong" "$recipient" "$profile" "$event" "TIEN404-CANARY-LIVE02")" ]] || exit 1
[[ -z "$(pgclaim "$campaign" "$page" "$wrong" "$profile" "$event" "TIEN404-CANARY-LIVE02")" ]] || exit 1
[[ -z "$(pgclaim "$campaign" "$page" "$recipient" "$wrong" "$event" "TIEN404-CANARY-LIVE02")" ]] || exit 1
[[ -z "$(pgclaim "$campaign" "$page" "$recipient" "$profile" "$event" "ORDER_NOW")" ]] || exit 1
[[ -z "$(pgclaim "$campaign3" "$page" "$recipient" "$profile" "$event" "TIEN404-CANARY-LIVE02")" ]] || exit 1
[[ "$(psql -X -Atqc 'SELECT count(*) FROM t404_canary_private.one_shot_send_attempt_claims')" == "0" ]] || exit 1

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
pids=""
# 16 separate real PostgreSQL sessions race for ONE campaign.
for i in $(seq 1 16); do
 (pgclaim "$campaign" "$page" "$recipient" "$profile" "$event" "TIEN404-CANARY-LIVE02" > "$work/claim_$i.out") &
 pids="$pids $!"
done
for pid in $pids; do wait "$pid"; done
winners="$(awk -v expected="$campaign" '$0==expected{n++} END{print n+0}' "$work"/claim_*.out)"
[[ "$winners" == "1" ]] || { echo "FAILED one-shot winners=$winners";exit 1; }
[[ "$(psql -X -Atqc 'SELECT count(*) FROM t404_canary_private.one_shot_send_attempt_claims')" == "1" ]] || exit 1

# Same campaign new MID cannot reopen; original MID cannot be used on
# another approved campaign with the unique event HMAC.
[[ -z "$(pgclaim "$campaign" "$page" "$recipient" "$profile" "$new_event" "TIEN404-CANARY-LIVE02")" ]] || exit 1
[[ -z "$(pgclaim "$campaign2" "$page" "$recipient" "$profile" "$event" "TIEN404-CANARY-LIVE02")" ]] || exit 1
[[ "$(psql -X -Atqc 'SELECT count(*) FROM t404_canary_private.one_shot_send_attempt_claims')" == "1" ]] || exit 1

# ONLY synthetic CI schema backup/restore, never n8n/hosted/customer data.
pg_dump --dbname=t404_cbot03b_ci --format=custom \
 --schema=t404_canary_private --no-owner --no-acl \
 --file="$work/synthetic-cbot03b.backup"
sha="$(sha256sum "$work/synthetic-cbot03b.backup" | awk '{print $1}')"
[[ "$sha" =~ ^[a-f0-9]{64}$ ]] || exit 1
createdb t404_cbot03b_restore_ci
pg_restore --exit-on-error --no-owner --no-acl \
 --dbname=t404_cbot03b_restore_ci "$work/synthetic-cbot03b.backup" >/dev/null
restored_claims="$(psql -X -Atq -d t404_cbot03b_restore_ci \
 -c 'SELECT count(*) FROM t404_canary_private.one_shot_send_attempt_claims')"
[[ "$restored_claims" == "1" ]] || exit 1
restored_rls="$(psql -X -Atq -d t404_cbot03b_restore_ci -c \
"SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='t404_canary_private' AND
 c.relname IN ('one_shot_send_attempt_claims','page_only_authorizations')
 AND c.relrowsecurity AND c.relforcerowsecurity")"
[[ "$restored_rls" == "2" ]] || exit 1
restored_unique="$(psql -X -Atq -d t404_cbot03b_restore_ci -c \
"SELECT count(*) FROM pg_constraint con
 JOIN pg_class c ON c.oid=con.conrelid
 JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='t404_canary_private'
 AND c.relname='one_shot_send_attempt_claims'
 AND con.contype IN ('p','u')")"
[[ "$restored_unique" == "2" ]] || exit 1
dropdb t404_cbot03b_restore_ci

echo "PASS PG17_DISPOSABLE_SYNTHETIC: 16 concurrent claimers → 1 winner"
echo "PASS PG17_DISPOSABLE_SYNTHETIC: wrong Page/PSID, profile, revoked, replay blocked"
echo "PASS PG17_DISPOSABLE_SYNTHETIC: unique claim + 2 FORCE RLS restored to second DB"
echo "NOT CERTIFIED: real Meta PSID owner; hosted RLS; real n8n Published restore; LIVE02"
