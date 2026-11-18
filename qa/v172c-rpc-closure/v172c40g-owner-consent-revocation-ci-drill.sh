#!/usr/bin/env bash
# V17.2C.40G — ephemeral PostgreSQL 17 only. Never run against Supabase.
set -euo pipefail
[[ "${PGHOST:?}" == "127.0.0.1" && "${PGDATABASE:?}" == "postgres" ]] || exit 91
root=qa/v172c-rpc-closure
psql -X -q -v ON_ERROR_STOP=1 -f "$root/v172c40g-private-owner-consent-revocation-NOT_EXECUTED.sql"

psql -X -q -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO tien404_v172c40g_qa.owner_sessions
(session_ref,actor_ref,tenant_ref,store_ref,active,expires_at)
VALUES
('session-a','actor-a','tenant-x','store-a',true,clock_timestamp()+interval '10 minutes'),
('session-b','actor-b','tenant-x','store-b',true,clock_timestamp()+interval '10 minutes'),
('session-c','actor-c','tenant-x','store-c',true,clock_timestamp()+interval '10 minutes'),
('session-d','actor-d','tenant-x','store-d',true,clock_timestamp()+interval '10 minutes'),
('session-e','actor-e','tenant-x','store-e',true,clock_timestamp()+interval '10 minutes'),
('session-f','actor-f','tenant-x','store-f',true,clock_timestamp()+interval '10 minutes'),
('session-inactive','actor-inactive','tenant-x','store-inactive',false,clock_timestamp()+interval '10 minutes');
INSERT INTO tien404_v172c40g_qa.owner_memberships
(actor_ref,tenant_ref,store_ref,member_role,active)
VALUES
('actor-a','tenant-x','store-a','owner',true),
('actor-b','tenant-x','store-b','owner',true),
('actor-c','tenant-x','store-c','owner',true),
('actor-d','tenant-x','store-d','owner',true),
('actor-e','tenant-x','store-e','owner',true),
('actor-f','tenant-x','store-f','manager',true),
('actor-inactive','tenant-x','store-inactive','owner',true);
INSERT INTO tien404_v172c40g_qa.owner_challenges
(challenge_digest,session_ref,actor_ref,tenant_ref,store_ref,decision_ref,decision_version,operation,issued_at,expires_at)
VALUES
(repeat('a',64),'session-a','actor-a','tenant-x','store-a','synthetic-transition-s1-v2',2,'OWNER_DECISION_CONSENT',clock_timestamp()-interval '1 minute',clock_timestamp()+interval '4 minutes'),
(repeat('b',64),'session-a','actor-a','tenant-x','store-a','synthetic-transition-s1-v2',2,'OWNER_DECISION_CONSENT',clock_timestamp()-interval '1 minute',clock_timestamp()+interval '4 minutes'),
(repeat('c',64),'session-c','actor-c','tenant-x','store-c','synthetic-transition-s2-v2',2,'OWNER_DECISION_CONSENT',clock_timestamp()-interval '1 minute',clock_timestamp()+interval '4 minutes'),
(repeat('d',64),'session-d','actor-d','tenant-x','store-d','synthetic-transition-s2-v2',2,'OWNER_DECISION_CONSENT',clock_timestamp()-interval '1 minute',clock_timestamp()+interval '4 minutes'),
(repeat('e',64),'session-e','actor-e','tenant-x','store-e','synthetic-transition-s2-v2',2,'OWNER_DECISION_CONSENT',clock_timestamp()-interval '1 minute',clock_timestamp()+interval '4 minutes'),
(repeat('f',64),'session-a','actor-a','tenant-x','store-a','synthetic-transition-s1-v2',2,'OWNER_DECISION_CONSENT',clock_timestamp()-interval '20 minutes',clock_timestamp()-interval '10 minutes 1 second'),
(repeat('7',64),'session-a','actor-a','tenant-x','store-a','synthetic-transition-s1-v2',2,'OWNER_DECISION_CONSENT',clock_timestamp()-interval '1 minute',clock_timestamp()+interval '4 minutes'),
(repeat('8',64),'session-a','actor-a','tenant-x','store-a','synthetic-transition-s1-v2',2,'OWNER_DECISION_CONSENT',clock_timestamp()-interval '1 minute',clock_timestamp()+interval '4 minutes'),
(repeat('9',64),'session-inactive','actor-inactive','tenant-x','store-inactive','synthetic-transition-s1-v2',2,'OWNER_DECISION_CONSENT',clock_timestamp()-interval '1 minute',clock_timestamp()+interval '4 minutes'),
(repeat('0',64),'session-f','actor-f','tenant-x','store-f','synthetic-transition-s1-v2',2,'OWNER_DECISION_CONSENT',clock_timestamp()-interval '1 minute',clock_timestamp()+interval '4 minutes');
SQL

deny() {
 local label="$1" sql="$2" expected="$3" file="/tmp/v172c40g-deny-$1.log"
 if psql -X -qAt -v ON_ERROR_STOP=1 -c "$sql" >"$file" 2>&1; then
  echo "FAIL: $label unexpectedly succeeded"; exit 10
 fi
 grep -q "$expected" "$file" || { echo "FAIL: $label missing $expected"; cat "$file"; exit 11; }
}

consume_a="SELECT status || '|' || event_id FROM tien404_v172c40g_qa.consume_owner_consent(repeat('a',64),'session-a','idempotency-key-a-0001','ACCEPT');"
first="$(psql -X -qAt -v ON_ERROR_STOP=1 -c "$consume_a")"
[[ "$first" == CONSENT_RECORDED_NOT_AUTHORITY_GRANTED\|* ]] || { echo "FAIL: initial consent not recorded"; exit 12; }
event_a="${first##*|}"
[[ "$(psql -X -qAt -v ON_ERROR_STOP=1 -c "SELECT tien404_v172c40g_qa.check_current_consent($event_a);")" == "REVIEW_REQUIRED_NOT_AUTHORITY_GO" ]] || { echo "FAIL: consent was treated as authority GO"; exit 13; }

# Same idempotency key + same payload returns the original event only.
replay="$(psql -X -qAt -v ON_ERROR_STOP=1 -c "$consume_a")"
[[ "$replay" == "IDEMPOTENT_REPLAY_NO_NEW_EVENT|$event_a" ]] || { echo "FAIL: same-key retry not idempotent"; exit 14; }
[[ "$(psql -X -qAt -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM tien404_v172c40g_qa.owner_consent_events WHERE challenge_digest=repeat('a',64);")" == "1" ]]

deny "challenge-replay" "SELECT * FROM tien404_v172c40g_qa.consume_owner_consent(repeat('a',64),'session-a','idempotency-key-a-0002','ACCEPT');" "DENY_CHALLENGE_INVALID_REPLAY_OR_SCOPE"
deny "idempotency-conflict" "SELECT * FROM tien404_v172c40g_qa.consume_owner_consent(repeat('b',64),'session-a','idempotency-key-a-0001','ACCEPT');" "DENY_IDEMPOTENCY_CONFLICT"
deny "expired-challenge" "SELECT * FROM tien404_v172c40g_qa.consume_owner_consent(repeat('f',64),'session-a','idempotency-key-expired','ACCEPT');" "DENY_CHALLENGE_INVALID_REPLAY_OR_SCOPE"
deny "wrong-session-binding" "SELECT * FROM tien404_v172c40g_qa.consume_owner_consent(repeat('7',64),'session-b','idempotency-key-wrong-session','ACCEPT');" "DENY_CHALLENGE_INVALID_REPLAY_OR_SCOPE"
deny "inactive-session" "SELECT * FROM tien404_v172c40g_qa.consume_owner_consent(repeat('9',64),'session-inactive','idempotency-key-inactive','ACCEPT');" "DENY_SESSION_INACTIVE_OR_REVOKED"
deny "non-owner-membership" "SELECT * FROM tien404_v172c40g_qa.consume_owner_consent(repeat('0',64),'session-f','idempotency-key-manager','ACCEPT');" "DENY_OWNER_MEMBERSHIP_REVOKED_OR_INVALID"

# Revocation obtains the membership row lock first. Consent must wait, observe
# the committed revocation, and leave the challenge unconsumed with no event.
psql -X -qAt -v ON_ERROR_STOP=1 -c "BEGIN; SELECT tien404_v172c40g_qa.revoke_owner_membership('actor-c','tenant-x','store-c','revoked-before-consent'); SELECT pg_sleep(2); COMMIT;" >/tmp/v172c40g-revoke-first.log 2>&1 &
revoke_first_pid=$!
sleep 0.4
deny "revocation-wins-race" "SELECT * FROM tien404_v172c40g_qa.consume_owner_consent(repeat('c',64),'session-c','idempotency-key-c','ACCEPT');" "DENY_OWNER_MEMBERSHIP_REVOKED_OR_INVALID"
wait "$revoke_first_pid"
[[ "$(psql -X -qAt -v ON_ERROR_STOP=1 -c "SELECT state FROM tien404_v172c40g_qa.owner_challenges WHERE challenge_digest=repeat('c',64);")" == "issued" ]]
[[ "$(psql -X -qAt -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM tien404_v172c40g_qa.owner_consent_events WHERE challenge_digest=repeat('c',64);")" == "0" ]]

# Consent commits first while holding the membership lock; revocation waits.
# The immutable event remains, but the current admission check must then DENY.
psql -X -qAt -v ON_ERROR_STOP=1 -c "BEGIN; SELECT status || '|' || event_id FROM tien404_v172c40g_qa.consume_owner_consent(repeat('d',64),'session-d','idempotency-key-d','ACCEPT'); SELECT pg_sleep(2); COMMIT;" >/tmp/v172c40g-consent-first.log 2>&1 &
consent_first_pid=$!
sleep 0.4
psql -X -qAt -v ON_ERROR_STOP=1 -c "SELECT tien404_v172c40g_qa.revoke_owner_membership('actor-d','tenant-x','store-d','revoked-after-consent');" >/tmp/v172c40g-revoke-after.log 2>&1
wait "$consent_first_pid"
event_d="$(psql -X -qAt -v ON_ERROR_STOP=1 -c "SELECT event_id FROM tien404_v172c40g_qa.owner_consent_events WHERE challenge_digest=repeat('d',64);")"
[[ -n "$event_d" ]]
[[ "$(psql -X -qAt -v ON_ERROR_STOP=1 -c "SELECT tien404_v172c40g_qa.check_current_consent($event_d);")" == "DENY" ]] || { echo "FAIL: post-consent membership revocation did not deny"; exit 15; }

# Explicit consent withdrawal is an append-only event and invalidates current review.
event_e_row="$(psql -X -qAt -v ON_ERROR_STOP=1 -c "SELECT status || '|' || event_id FROM tien404_v172c40g_qa.consume_owner_consent(repeat('e',64),'session-e','idempotency-key-e','ACCEPT');")"
event_e="${event_e_row##*|}"
psql -X -qAt -v ON_ERROR_STOP=1 -c "SELECT tien404_v172c40g_qa.revoke_owner_consent($event_e,'owner-withdrew-consent');" >/dev/null
[[ "$(psql -X -qAt -v ON_ERROR_STOP=1 -c "SELECT tien404_v172c40g_qa.check_current_consent($event_e);")" == "DENY" ]]

# Revoked session also invalidates an earlier event, without editing history.
psql -X -qAt -v ON_ERROR_STOP=1 -c "UPDATE tien404_v172c40g_qa.owner_sessions SET active=false,revoked_at=clock_timestamp() WHERE session_ref='session-a';" >/dev/null
[[ "$(psql -X -qAt -v ON_ERROR_STOP=1 -c "SELECT tien404_v172c40g_qa.check_current_consent($event_a);")" == "DENY" ]]

deny "consent-event-mutation" "UPDATE tien404_v172c40g_qa.owner_consent_events SET consent_action='DECLINE' WHERE event_id=$event_a;" "DENY_APPEND_ONLY_EVENT_MUTATION"
deny "revocation-event-mutation" "DELETE FROM tien404_v172c40g_qa.owner_revocation_events;" "DENY_APPEND_ONLY_EVENT_MUTATION"

# Private functions and schema remain inaccessible to API roles; SECURITY INVOKER.
for role in anon authenticated; do
 [[ "$(psql -X -qAt -v ON_ERROR_STOP=1 -c "SELECT has_schema_privilege('$role','tien404_v172c40g_qa','USAGE');")" == "f" ]]
 [[ "$(psql -X -qAt -v ON_ERROR_STOP=1 -c "SELECT has_function_privilege('$role','tien404_v172c40g_qa.consume_owner_consent(text,text,text,text)','EXECUTE');")" == "f" ]]
done
definer="$(psql -X -qAt -v ON_ERROR_STOP=1 -c "SELECT prosecdef FROM pg_proc WHERE oid='tien404_v172c40g_qa.consume_owner_consent(text,text,text,text)'::regprocedure;")"
[[ "$definer" == "f" ]]

echo "PASS: atomic challenge+consent, idempotent retry, replay/expiry/session/role DENY, both revocation race orderings DENY current admission, append-only audit, no API-role execution."
