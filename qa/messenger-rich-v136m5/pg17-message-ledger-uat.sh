#!/usr/bin/env bash
# V21: real PostgreSQL 17 unique per-event message plan / per-part attempt.
# Uses unchanged message-attempt-ledger.cjs SQL on a DISPOSABLE LOCAL CI DB.
# NO HOSTED MIGRATION, NO META SEND, NO ORDERS, NO REAL TENANT DATA.
set -euo pipefail
[ "$CI" = true ] && [ "$GITHUB_ACTIONS" = true ] && [ "$T404_DISPOSABLE_PG_QA" = YES ] || { echo REFUSE_NON_CI; exit 2; }
case "$PGHOST" in 127.0.0.1|localhost) ;; *) echo REFUSE_NON_LOCAL_HOST; exit 2;; esac
[ "$PGPORT" = 5432 ] || exit 2
[ -z "$SUPABASE_DB_URL$SUPABASE_ACCESS_TOKEN$DATABASE_URL$PGHOSTADDR" ] || exit 2
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PLAN=$(cd "$ROOT" && node -e 'process.stdout.write(require("./qa/messenger-rich-v136m5/message-attempt-ledger.cjs").SQL.plan)')
RESERVE=$(cd "$ROOT" && node -e 'process.stdout.write(require("./qa/messenger-rich-v136m5/message-attempt-ledger.cjs").SQL.reserve)')
ACCEPT=$(cd "$ROOT" && node -e 'process.stdout.write(require("./qa/messenger-rich-v136m5/message-attempt-ledger.cjs").SQL.accept)')
HOLD=$(cd "$ROOT" && node -e 'process.stdout.write(require("./qa/messenger-rich-v136m5/message-attempt-ledger.cjs").SQL.uncertain)')
CLOSE=$(cd "$ROOT" && node -e 'process.stdout.write(require("./qa/messenger-rich-v136m5/message-attempt-ledger.cjs").SQL.close)')
DB="t404_sendledger_$RANDOM$RANDOM"; DIR=$(mktemp -d); created=0; PASS=0
admin(){ psql -XAtq -v ON_ERROR_STOP=1 -d postgres -c "$1"; }
sql(){ psql -XAtq -v ON_ERROR_STOP=1 -d "$DB" -c "$1"; }
cleanup(){ if [ "$created" = 1 ]; then admin "DROP DATABASE $DB WITH (FORCE)" >/dev/null || echo WARN_QA_DB_CLEANUP; fi; rm -rf "$DIR"; }
trap cleanup EXIT
fail(){ echo "FAIL_$1"; exit 1; }
ok(){ [ "$1" = "$2" ] || fail "$3 expected=$2 got=$1"; PASS=$((PASS+1)); echo "PASS_$3"; }
T=11111111-1111-4111-8111-111111111111
S=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa
P=12345678901234567
H=$(printf '%064d' 1)
E=$(printf '%064d' 2)
E2=$(printf '%064d' 3)
BODY1=$(printf '%064d' 4)
BODY2=$(printf '%064d' 5)
BODY3=$(printf '%064d' 6)
PLANHASH=$(printf '%064d' 7)
MID1=$(printf '%064d' 8)
MID2=$(printf '%064d' 9)
MID3=$(printf '%064d' 10)
NOW=2026-11-22T12:00:00Z
ID1=10000000-0000-4000-8000-000000000001
ID2=10000000-0000-4000-8000-000000000002
A1=20000000-0000-4000-8000-000000000001
A2=20000000-0000-4000-8000-000000000002
A3=20000000-0000-4000-8000-000000000003
B1=30000000-0000-4000-8000-000000000001
B2=30000000-0000-4000-8000-000000000002
B3=30000000-0000-4000-8000-000000000003
PLAN_TYPES="uuid,uuid,uuid,text,text,int,text,text,int,text[]"
reserve(){
 local id="$1" part="$2" att="$3" hold="$4"
 psql -XAtq -v ON_ERROR_STOP=1 -d "$DB" <<SQL
BEGIN;
PREPARE reserve_part(uuid,int,uuid,timestamptz) AS $RESERVE;
EXECUTE reserve_part('$id',$part,'$att','$NOW');
SELECT pg_sleep($hold);
COMMIT;
SQL
}
plan(){
 local id="$1" event="$2" hold="$3"
 psql -XAtq -v ON_ERROR_STOP=1 -d "$DB" <<SQL
BEGIN;
PREPARE create_plan($PLAN_TYPES) AS $PLAN;
EXECUTE create_plan('$id','$T','$S','$P','$H',3,'$event','$PLANHASH',3,ARRAY['$BODY1','$BODY2','$BODY3']);
SELECT pg_sleep($hold);
COMMIT;
SQL
}
accept(){
 local id="$1" part="$2" attempt="$3" mid="$4"
 sql "PREPARE record_receipt(uuid,int,uuid,text,timestamptz) AS $ACCEPT;
 EXECUTE record_receipt('$id',$part,'$attempt','$mid','$NOW');"
}
uncertain(){
 local id="$1" part="$2" attempt="$3"
 sql "PREPARE record_hold(uuid,int,uuid,timestamptz) AS $HOLD;
 EXECUTE record_hold('$id',$part,'$attempt','$NOW');"
}
close_plan(){
 local id="$1"
 sql "PREPARE close_preview(uuid,timestamptz) AS $CLOSE;
 EXECUTE close_preview('$id','$NOW');"
}
admin "CREATE DATABASE $DB" >/dev/null; created=1
sql "CREATE SCHEMA app_private;
 CREATE TABLE app_private.messenger_send_plans (
  id uuid PRIMARY KEY,tenant_id uuid NOT NULL,store_id uuid NOT NULL,
  page_id text NOT NULL,sender_hash char(64) NOT NULL,binding_version int NOT NULL,
  event_hash char(64) NOT NULL,plan_digest char(64) NOT NULL,
  expected_count int NOT NULL CHECK(expected_count BETWEEN 1 AND 3),
  status text NOT NULL CHECK(status IN ('PREPARED','MOCK_PARTS_ACCEPTED')),
  completed_at timestamptz,
  UNIQUE(tenant_id,store_id,page_id,sender_hash,binding_version,event_hash),
  UNIQUE(id,tenant_id,store_id,page_id)
 );
 CREATE TABLE app_private.messenger_send_parts (
  plan_id uuid NOT NULL,
  tenant_id uuid NOT NULL,store_id uuid NOT NULL,page_id text NOT NULL,
  part_no int NOT NULL CHECK(part_no BETWEEN 1 AND 3),
  body_digest char(64) NOT NULL,
  status text NOT NULL CHECK(status IN ('PLANNED','MAY_HAVE_SENT_HOLD','UNCERTAIN_HOLD','API_ACCEPTED_MOCK')),
  attempt_id uuid,attempted_at timestamptz,held_at timestamptz,
  provider_mid_digest char(64),confirmed_at timestamptz,
  PRIMARY KEY(plan_id,part_no),
  FOREIGN KEY(plan_id,tenant_id,store_id,page_id)
    REFERENCES app_private.messenger_send_plans(id,tenant_id,store_id,page_id)
 );
 CREATE UNIQUE INDEX uq_send_mid_per_plan
 ON app_private.messenger_send_parts(plan_id,provider_mid_digest)
 WHERE provider_mid_digest IS NOT NULL;
 CREATE UNIQUE INDEX uq_send_attempt_per_plan
 ON app_private.messenger_send_parts(plan_id,attempt_id)
 WHERE attempt_id IS NOT NULL;
 ALTER TABLE app_private.messenger_send_plans ENABLE ROW LEVEL SECURITY;
 ALTER TABLE app_private.messenger_send_plans FORCE ROW LEVEL SECURITY;
 ALTER TABLE app_private.messenger_send_parts ENABLE ROW LEVEL SECURITY;
 ALTER TABLE app_private.messenger_send_parts FORCE ROW LEVEL SECURITY;
 REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
 REVOKE ALL ON app_private.messenger_send_plans FROM PUBLIC;
 REVOKE ALL ON app_private.messenger_send_parts FROM PUBLIC;" >/dev/null

# Concurrent independent PostgreSQL clients must create one atomic plan + 3 parts.
plan "$ID1" "$E" 1.5 >"$DIR/plan_a" &
a=$!
sleep 0.2
plan "$ID2" "$E" 0 >"$DIR/plan_b" &
b=$!
wait "$a";wait "$b"
ok "$(grep -h -c '|3' "$DIR"/plan_* | awk '{s+=$1}END{print s+0}')" 1 UNIQUE_ONE_PLAN_OF_TWO
ok "$(sql "SELECT count(*) FROM app_private.messenger_send_plans")" 1 ONE_PERSISTED_PLAN
ok "$(sql "SELECT count(*) FROM app_private.messenger_send_parts WHERE plan_id='$ID1'")" 3 THREE_PARTS_ATOMIC
ok "$(plan "$ID2" "$E" 0 | grep -c '|3' || true)" 0 DUPLICATE_PLAN_NOT_RECREATED

# Two concurrent attempt reservations for the SAME part: only one CAS winner.
reserve "$ID1" 1 "$A1" 1.3 >"$DIR/res_a" &
a=$!
sleep 0.2
reserve "$ID1" 1 "$A2" 0 >"$DIR/res_b" &
b=$!
wait "$a";wait "$b"
ok "$(grep -h -c '|MAY_HAVE_SENT_HOLD' "$DIR"/res_* | awk '{s+=$1}END{print s+0}')" 1 ONE_ATTEMPT_RESERVATION
ok "$(sql "SELECT count(*) FROM app_private.messenger_send_parts WHERE plan_id='$ID1' AND part_no=1 AND status='MAY_HAVE_SENT_HOLD'")" 1 PART_RESERVED_DURABLY
ok "$(reserve "$ID1" 1 "$A2" 0 | grep -c '|MAY_HAVE_SENT_HOLD' || true)" 0 NO_AUTO_RETRY_RESERVED

# 1/3 mock provider API acceptance must NOT mark event complete.
ok "$(accept "$ID1" 1 "$A1" "$MID1" | grep -c '|API_ACCEPTED_MOCK')" 1 PART_ONE_MOCK_ACCEPTED
ok "$(close_plan "$ID1" | grep -c '|MOCK_PARTS_ACCEPTED' || true)" 0 ONE_OF_THREE_NEVER_COMPLETE
ok "$(sql "SELECT count(*) FROM app_private.messenger_send_parts WHERE plan_id='$ID1' AND status='PLANNED'")" 2 TWO_UNATTEMPTED_STILL_PLANNED

# 2/3 accepted; last timeout is a permanent hold and no blind retry.
ok "$(reserve "$ID1" 2 "$A2" 0 | grep -c '|MAY_HAVE_SENT_HOLD')" 1 PART_TWO_RESERVED
ok "$(accept "$ID1" 2 "$A2" "$MID2" | grep -c '|API_ACCEPTED_MOCK')" 1 PART_TWO_MOCK_ACCEPTED
ok "$(reserve "$ID1" 3 "$A3" 0 | grep -c '|MAY_HAVE_SENT_HOLD')" 1 PART_THREE_RESERVED
ok "$(uncertain "$ID1" 3 "$A3" | grep -c '|UNCERTAIN_HOLD')" 1 PART_THREE_TIMEOUT_HELD
ok "$(reserve "$ID1" 3 "$A3" 0 | grep -c '|MAY_HAVE_SENT_HOLD' || true)" 0 CANNOT_RETRY_UNCERTAIN
ok "$(close_plan "$ID1" | grep -c '|MOCK_PARTS_ACCEPTED' || true)" 0 TWO_OF_THREE_WITH_TIMEOUT_NEVER_COMPLETE

# Restart equivalent: new psql session retains unresolved events and attempt leases.
ok "$(sql "SELECT status FROM app_private.messenger_send_parts WHERE plan_id='$ID1' AND part_no=3")" UNCERTAIN_HOLD OUTCOME_PERSISTS_NEW_CONNECTION
ok "$(accept "$ID1" 3 "$A3" "$MID3" | grep -c '|API_ACCEPTED_MOCK' || true)" 0 CANNOT_LATE_ACCEPT_AFTER_TIMEOUT

# Second distinct event: all 3 parts accepted with unique mids, plan can close.
ok "$(plan "$ID2" "$E2" 0 | grep -c '|3')" 1 SECOND_EVENT_INDEPENDENT
ok "$(reserve "$ID2" 1 "$B1" 0 | grep -c '|MAY_HAVE_SENT_HOLD')" 1 SECOND_EVENT_PART_ONE_RESERVED
ok "$(accept "$ID2" 1 "$B1" "$MID1" | grep -c '|API_ACCEPTED_MOCK')" 1 SECOND_EVENT_PART_ONE_MOCK_ACCEPTED
ok "$(reserve "$ID2" 2 "$B2" 0 | grep -c '|MAY_HAVE_SENT_HOLD')" 1 SECOND_EVENT_PART_TWO_RESERVED
if accept "$ID2" 2 "$B2" "$MID1" >"$DIR/duplicate_provider" 2>&1; then fail DUPLICATE_PROVIDER_MID_ACCEPTED; fi
grep -Eqi 'duplicate key value violates unique constraint' "$DIR/duplicate_provider" || fail MID_UNIQUE_ERROR
PASS=$((PASS+1)); echo PASS_DUPLICATE_PROVIDER_MID_REJECTED
ok "$(accept "$ID2" 2 "$B2" "$MID2" | grep -c '|API_ACCEPTED_MOCK')" 1 SECOND_EVENT_PART_TWO_MOCK_ACCEPTED
ok "$(reserve "$ID2" 3 "$B3" 0 | grep -c '|MAY_HAVE_SENT_HOLD')" 1 SECOND_EVENT_PART_THREE_RESERVED
ok "$(accept "$ID2" 3 "$B3" "$MID3" | grep -c '|API_ACCEPTED_MOCK')" 1 SECOND_EVENT_PART_THREE_MOCK_ACCEPTED
ok "$(close_plan "$ID2" | grep -c '|MOCK_PARTS_ACCEPTED')" 1 ALL_THREE_CAN_CLOSE_MOCK
ok "$(close_plan "$ID2" | grep -c '|MOCK_PARTS_ACCEPTED' || true)" 0 MOCK_CLOSE_ONCE

echo "PG17_REAL_MESSAGE_LEDGER_TESTS=$PASS"
echo "MODE=DISPOSABLE_LOCAL_PG17; HOSTED_WRITES=false; PROVIDER_SEND=false"
