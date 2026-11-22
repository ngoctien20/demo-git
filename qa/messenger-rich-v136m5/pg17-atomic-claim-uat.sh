#!/usr/bin/env bash
# V21 Issue #495: real PostgreSQL 17 concurrency QA for the EXISTING V13.6M.5 claim SQL.
# This is disposable LOCAL CI testing, not a hosted migration or a Messenger send.
set -euo pipefail
[ "$T404_DISPOSABLE_PG_QA" = "YES" ] && [ "$CI" = "true" ] && [ "$GITHUB_ACTIONS" = "true" ] || { echo REFUSE_NON_CI; exit 2; }
case "$PGHOST" in 127.0.0.1|localhost) ;; *) echo REFUSE_NON_LOCAL_HOST; exit 2;; esac
case "$PGPORT" in 5432) ;; *) echo REFUSE_UNEXPECTED_PORT; exit 2;; esac
[ -z "$SUPABASE_DB_URL$SUPABASE_ACCESS_TOKEN$DATABASE_URL$PGHOSTADDR" ] || { echo REFUSE_HOSTED_ENV; exit 2; }
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CLAIM_SQL=$(cd "$ROOT" && node -e 'process.stdout.write(require("./qa/messenger-rich-v136m5/private-event-store.cjs").SQL.claim)')
FINALIZE_SQL=$(cd "$ROOT" && node -e 'process.stdout.write(require("./qa/messenger-rich-v136m5/private-event-store.cjs").SQL.finalize)')
DB="t404_atomic_$RANDOM$RANDOM"; ROLE="t404_atomic_role_$RANDOM$RANDOM"
TEMP=$(mktemp -d); created=0; role_created=0; PASS=0
admin(){ psql -XAtq -v ON_ERROR_STOP=1 -d postgres -c "$1"; }
sql(){ psql -XAtq -v ON_ERROR_STOP=1 -d "$DB" -c "$1"; }
cleanup(){
  if [ "$created" -eq 1 ]; then admin "DROP DATABASE $DB WITH (FORCE)" >/dev/null || echo WARN_DISPOSABLE_CLEANUP_FAILED; fi
  if [ "$role_created" -eq 1 ]; then admin "DROP ROLE $ROLE" >/dev/null || echo WARN_ROLE_CLEANUP_FAILED; fi
  rm -rf "$TEMP"
}
trap cleanup EXIT
fail(){ echo "FAIL_$1"; exit 1; }
ok(){ [ "$1" = "$2" ] || fail "$3 expected=$2 got=$1"; PASS=$((PASS+1)); echo "PASS_$3"; }
T1=11111111-1111-4111-8111-111111111111
T2=22222222-2222-4222-8222-222222222222
S1=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa
S2=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb
P1=12345678901234567; P2=98765432109876543
H1=$(printf '%064d' 1); H2=$(printf '%064d' 2)
E1=$(printf '%064d' 3); E2=$(printf '%064d' 4)
E3=$(printf '%064d' 5); E4=$(printf '%064d' 6)
CLAIM_TYPES="uuid,uuid,text,text,int,text,uuid,timestamptz,timestamptz"
FINAL_TYPES="uuid,uuid,text,text,int,text,uuid,text,timestamptz"
NOW=2026-11-22T10:00:00Z; EXP=2026-11-29T10:00:00Z
# claim: tenant,store,page,hashed-sender,binding-version,hashed-event,lease,hold-seconds,transaction-action
claim(){
  local t="$1" s="$2" p="$3" h="$4" v="$5" e="$6" lease="$7" hold="$8" action="$9"
  psql -XAtq -v ON_ERROR_STOP=1 -d "$DB" <<SQL
SET statement_timeout='20s'; SET lock_timeout='15s';
BEGIN;
PREPARE t404_claim($CLAIM_TYPES) AS $CLAIM_SQL;
EXECUTE t404_claim('$t','$s','$p','$h',$v,'$e','$lease','$NOW','$EXP');
SELECT pg_sleep($hold);
$action;
SQL
}
finish(){
 local lease="$1" state="$2"
 psql -XAtq -v ON_ERROR_STOP=1 -d "$DB" <<SQL
BEGIN;
PREPARE t404_final($FINAL_TYPES) AS $FINALIZE_SQL;
EXECUTE t404_final('$T1','$S1','$P1','$H1',3,'$E1','$lease','$state','$NOW');
COMMIT;
SQL
}
admin "CREATE DATABASE $DB"; created=1
sql "CREATE SCHEMA app_private;
 CREATE TABLE app_private.messenger_event_claims(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,store_id uuid NOT NULL,page_id text NOT NULL,
  sender_hash char(64) NOT NULL,binding_version int NOT NULL CHECK (binding_version>0),
  event_hash char(64) NOT NULL,
  status text NOT NULL CHECK(status IN ('CLAIMED','PREVIEW_READY','REJECTED')),
  lease_id uuid NOT NULL, claimed_at timestamptz NOT NULL,
  completed_at timestamptz,expires_at timestamptz NOT NULL,
  CONSTRAINT uq_messenger_event_scope UNIQUE
   (tenant_id,store_id,page_id,sender_hash,binding_version,event_hash));
 ALTER TABLE app_private.messenger_event_claims ENABLE ROW LEVEL SECURITY;
 ALTER TABLE app_private.messenger_event_claims FORCE ROW LEVEL SECURITY;
 REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
 REVOKE ALL ON app_private.messenger_event_claims FROM PUBLIC;" >/dev/null
admin "CREATE ROLE $ROLE NOLOGIN NOINHERIT"; role_created=1

# First transaction holds uncommitted UNIQUE key. Another client must not become a second winner.
claim "$T1" "$S1" "$P1" "$H1" 3 "$E1" 00000000-0000-4000-8000-000000000001 1.5 COMMIT >"$TEMP/first" &
a=$!
sleep 0.25
claim "$T1" "$S1" "$P1" "$H1" 3 "$E1" 00000000-0000-4000-8000-000000000002 0 COMMIT >"$TEMP/second" &
b=$!
wait "$a"; wait "$b"
winners=$(grep -h -c '|CLAIMED' "$TEMP/first" "$TEMP/second" | awk '{s+=$1} END {print s+0}')
ok "$winners" 1 CONCURRENT_TWO_ONE_WINNER
ok "$(sql "SELECT count(*) FROM app_private.messenger_event_claims")" 1 ONE_DURABLE_ROW
LEASE=$(grep -h '|CLAIMED' "$TEMP/first" "$TEMP/second" | head -1 | cut -d'|' -f1)
wrong=$(finish 00000000-0000-4000-8000-000000000099 PREVIEW_READY | grep -c '|PREVIEW_READY' || true)
ok "$wrong" 0 WRONG_LEASE_NO_FINALIZE
ok "$(finish "$LEASE" PREVIEW_READY | grep -c '|PREVIEW_READY')" 1 RIGHT_LEASE_FINALIZES_ONCE
ok "$(finish "$LEASE" PREVIEW_READY | grep -c '|PREVIEW_READY' || true)" 0 DOUBLE_FINALIZE_DENIED
ok "$(claim "$T1" "$S1" "$P1" "$H1" 3 "$E1" 00000000-0000-4000-8000-000000000003 0 COMMIT | grep -c '|CLAIMED' || true)" 0 PROCESSED_EVENT_DEDUPED

# Many independent PostgreSQL client processes contend on a different key.
for i in $(seq 1 16); do
 lease=$(printf '10000000-0000-4000-8000-%012d' "$i")
 claim "$T1" "$S1" "$P1" "$H1" 3 "$E2" "$lease" 0 COMMIT >"$TEMP/concurrent_$i" &
done
wait
winners=$(grep -h -c '|CLAIMED' "$TEMP"/concurrent_* | awk '{s+=$1} END {print s+0}')
ok "$winners" 1 SIXTEEN_CLIENTS_ONE_WINNER
ok "$(sql "SELECT count(*) FROM app_private.messenger_event_claims WHERE event_hash='$E2'")" 1 SIXTEEN_CLIENTS_ONE_ROW

# Cross-tenant, cross-store, cross-Page, cross-sender and binding-version never collide.
i=40
for variant in "T2 S1 P1 H1 3" "T1 S2 P1 H1 3" "T1 S1 P2 H1 3" "T1 S1 P1 H2 3" "T1 S1 P1 H1 4"; do
 read -r t s p h v <<<"$variant"
 case "$t" in T1) t="$T1";; T2) t="$T2";; esac
 case "$s" in S1) s="$S1";; S2) s="$S2";; esac
 case "$p" in P1) p="$P1";; P2) p="$P2";; esac
 case "$h" in H1) h="$H1";; H2) h="$H2";; esac
 lease=$(printf '20000000-0000-4000-8000-%012d' "$i"); i=$((i+1))
 ok "$(claim "$t" "$s" "$p" "$h" "$v" "$E1" "$lease" 0 COMMIT | grep -c '|CLAIMED')" 1 ISOLATED_SCOPE_$i
done
ok "$(sql "SELECT count(*) FROM app_private.messenger_event_claims")" 7 SEPARATE_SCOPES

# A rolled-back INSERT must not permanently reserve the key.
ok "$(claim "$T1" "$S1" "$P1" "$H1" 3 "$E3" 30000000-0000-4000-8000-000000000001 0 ROLLBACK | grep -c '|CLAIMED')" 1 ROLLBACK_UNCOMMITTED_WIN
ok "$(sql "SELECT count(*) FROM app_private.messenger_event_claims WHERE event_hash='$E3'")" 0 ROLLBACK_NO_RESIDUE
ok "$(claim "$T1" "$S1" "$P1" "$H1" 3 "$E3" 30000000-0000-4000-8000-000000000002 0 COMMIT | grep -c '|CLAIMED')" 1 AFTER_ROLLBACK_CAN_CLAIM

# Expired claims are NOT automatically re-claimed without outcome reconciliation.
ok "$(claim "$T1" "$S1" "$P1" "$H1" 3 "$E4" 40000000-0000-4000-8000-000000000001 0 COMMIT | grep -c '|CLAIMED')" 1 STALLED_CLAIM_INSERTED
sql "UPDATE app_private.messenger_event_claims SET expires_at='2020-01-01T00:00:00Z' WHERE event_hash='$E4'" >/dev/null
ok "$(claim "$T1" "$S1" "$P1" "$H1" 3 "$E4" 40000000-0000-4000-8000-000000000002 0 COMMIT | grep -c '|CLAIMED' || true)" 0 EXPIRED_NOT_AUTO_RECLAIMED

# No public/data-api role can query or insert into private event store.
if sql "SET ROLE $ROLE; SELECT count(*) FROM app_private.messenger_event_claims" >"$TEMP/forbidden" 2>&1; then fail UNPRIVILEGED_READ_ALLOWED; fi
grep -qi 'permission denied' "$TEMP/forbidden" || fail UNEXPECTED_READ_ERROR
PASS=$((PASS+1)); echo PASS_UNPRIVILEGED_READ_DENIED
if sql "SET ROLE $ROLE; INSERT INTO app_private.messenger_event_claims
 (tenant_id,store_id,page_id,sender_hash,binding_version,event_hash,status,lease_id,claimed_at,expires_at)
 VALUES ('$T1','$S1','$P1','$H1',3,'$E2','CLAIMED',gen_random_uuid(),now(),now())" >"$TEMP/forbidden_write" 2>&1; then fail UNPRIVILEGED_INSERT_ALLOWED; fi
grep -qi 'permission denied' "$TEMP/forbidden_write" || fail UNEXPECTED_INSERT_ERROR
PASS=$((PASS+1)); echo PASS_UNPRIVILEGED_INSERT_DENIED

echo "PG17_REAL_UNIQUE_CLAIM_TESTS=$PASS"
echo "QA_PROFILE=DISPOSABLE_LOCAL_POSTGRES; HOSTED_WROTE=false; MESSENGER_SENT=false"
