#!/usr/bin/env bash
# V21 P1 — operator current-role grant + immutable no-send review journal QA.
# Disposable PostgreSQL 17 ONLY. No hosted DB, Meta API, Orders, credentials.
set -euo pipefail
[ "$CI" = true ] && [ "$GITHUB_ACTIONS" = true ] && [ "$T404_DISPOSABLE_PG_QA" = YES ] || exit 2
case "$PGHOST" in 127.0.0.1|localhost) ;; *) echo REFUSE_HOST; exit 2;; esac
[ "$PGPORT" = 5432 ] || exit 2
[ -z "$SUPABASE_DB_URL$SUPABASE_ACCESS_TOKEN$DATABASE_URL$PGHOSTADDR" ] || exit 2
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VIEW=$(cd "$ROOT" && node -e 'process.stdout.write(require("./qa/messenger-rich-v136m5/operator-reconciliation-review.cjs").SQL.view)')
APPEND=$(cd "$ROOT" && node -e 'process.stdout.write(require("./qa/messenger-rich-v136m5/operator-reconciliation-review.cjs").SQL.append)')
READ_ONLY=$(cd "$ROOT" && node -e 'process.stdout.write(require("./qa/messenger-rich-v136m5/operator-reconciliation-review.cjs").SQL.readOnly)')
DB="t404_operator_review_$RANDOM$RANDOM"
RA="t404_op_owner_a_$RANDOM$RANDOM"; RM="t404_op_manager_a_$RANDOM$RANDOM"
RS="t404_op_staff_a_$RANDOM$RANDOM"; RB="t404_op_owner_b_$RANDOM$RANDOM"
RC="t404_op_owner_c_$RANDOM$RANDOM"; RX="t404_op_expired_a_$RANDOM$RANDOM"
PW="qa_$(openssl rand -hex 18)"
TMP=$(mktemp -d); db_created=0; roles_created=0; PASS=0
admin(){ psql -XAtq -v ON_ERROR_STOP=1 -d postgres -c "$1"; }
sql(){ psql -XAtq -v ON_ERROR_STOP=1 -d "$DB" -c "$1"; }
client(){ PGUSER="$1" PGPASSWORD="$PW" psql -XAtq -v ON_ERROR_STOP=1 -d "$DB" -c "$2"; }
cleanup(){
 if [ "$db_created" = 1 ]; then admin "DROP DATABASE $DB WITH (FORCE)" >/dev/null || echo WARN_CLEANUP_DB; fi
 if [ "$roles_created" = 1 ]; then for role in "$RA" "$RM" "$RS" "$RB" "$RC" "$RX"; do admin "DROP ROLE $role" >/dev/null || echo WARN_CLEANUP_ROLE; done; fi
 rm -rf "$TMP"
}
trap cleanup EXIT
fail(){ echo "FAIL_$1"; exit 1; }
ok(){ [ "$1" = "$2" ] || fail "$3"; PASS=$((PASS+1)); echo "PASS_$3"; }
deny(){
 local tag="$1" who="$2" stmt="$3"
 if client "$who" "$stmt" >"$TMP/denied" 2>&1; then fail "$tag"; fi
 grep -Eqi 'row-level security|permission denied|cannot set role|must be member|not a member' "$TMP/denied" || { cat "$TMP/denied"; fail "WRONG_ERROR_$tag"; }
 PASS=$((PASS+1)); echo "PASS_DENY_$tag"
}
TA=11111111-1111-4111-8111-111111111111
TB=22222222-2222-4222-8222-222222222222
SA=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa
SB=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb
SC=cccccccc-cccc-4ccc-8ccc-cccccccccccc
PA=12345678901234567; PB=98765432109876543; PC=88888888888888888
H=$(printf '%064d' 1); E=$(printf '%064d' 2); D=$(printf '%064d' 3); BODY=$(printf '%064d' 4)
REQ1=$(printf '%064d' 5); REQ2=$(printf '%064d' 6); REQ3=$(printf '%064d' 7)
I1=10000000-0000-4000-8000-000000000001
I2=10000000-0000-4000-8000-000000000002
I3=10000000-0000-4000-8000-000000000003
J1=20000000-0000-4000-8000-000000000001
J2=20000000-0000-4000-8000-000000000002
J3=20000000-0000-4000-8000-000000000003
J4=20000000-0000-4000-8000-000000000004
J5=20000000-0000-4000-8000-000000000005
J6=20000000-0000-4000-8000-000000000006
CUTOFF=2026-11-22T15:55:00Z

admin "CREATE DATABASE $DB" >/dev/null; db_created=1
admin "CREATE ROLE $RA LOGIN NOINHERIT NOBYPASSRLS PASSWORD '$PW';
 CREATE ROLE $RM LOGIN NOINHERIT NOBYPASSRLS PASSWORD '$PW';
 CREATE ROLE $RS LOGIN NOINHERIT NOBYPASSRLS PASSWORD '$PW';
 CREATE ROLE $RB LOGIN NOINHERIT NOBYPASSRLS PASSWORD '$PW';
 CREATE ROLE $RC LOGIN NOINHERIT NOBYPASSRLS PASSWORD '$PW';
 CREATE ROLE $RX LOGIN NOINHERIT NOBYPASSRLS PASSWORD '$PW';" >/dev/null; roles_created=1
sql "CREATE SCHEMA app_private;
 CREATE TABLE app_private.messenger_operator_grants(
  db_role name NOT NULL,tenant_id uuid NOT NULL,store_id uuid NOT NULL,page_id text NOT NULL,
  access_role text NOT NULL CHECK(access_role IN ('OWNER','MANAGER','STAFF')),
  active boolean NOT NULL DEFAULT true,valid_until timestamptz NOT NULL,
  PRIMARY KEY(db_role,tenant_id,store_id,page_id));
 CREATE TABLE app_private.messenger_send_plans(
  id uuid PRIMARY KEY,tenant_id uuid NOT NULL,store_id uuid NOT NULL,page_id text NOT NULL,
  sender_hash char(64) NOT NULL,binding_version int NOT NULL,event_hash char(64) NOT NULL,
  plan_digest char(64) NOT NULL,expected_count int NOT NULL,status text NOT NULL,
  UNIQUE(id,tenant_id,store_id,page_id));
 CREATE TABLE app_private.messenger_send_parts(
  plan_id uuid NOT NULL,tenant_id uuid NOT NULL,store_id uuid NOT NULL,page_id text NOT NULL,
  part_no int NOT NULL,body_digest char(64) NOT NULL,
  status text NOT NULL CHECK(status IN ('PLANNED','MAY_HAVE_SENT_HOLD','UNCERTAIN_HOLD','API_ACCEPTED_MOCK')),
  attempted_at timestamptz,PRIMARY KEY(plan_id,part_no),
  FOREIGN KEY(plan_id,tenant_id,store_id,page_id)
   REFERENCES app_private.messenger_send_plans(id,tenant_id,store_id,page_id));
 CREATE TABLE app_private.messenger_review_events(
  id uuid PRIMARY KEY,
  plan_id uuid NOT NULL,tenant_id uuid NOT NULL,store_id uuid NOT NULL,page_id text NOT NULL,
  actor_db_role name NOT NULL,access_role text NOT NULL CHECK(access_role IN ('OWNER','MANAGER')),
  decision_code text NOT NULL CHECK(decision_code IN
   ('REQUEST_PROVIDER_REVIEW','ESCALATE_TO_OWNER','ACKNOWLEDGE_NO_SEND')),
  request_digest char(64) NOT NULL,created_at timestamptz NOT NULL,
  UNIQUE(plan_id,request_digest),
  FOREIGN KEY(plan_id,tenant_id,store_id,page_id)
   REFERENCES app_private.messenger_send_plans(id,tenant_id,store_id,page_id));
 ALTER TABLE app_private.messenger_operator_grants ENABLE ROW LEVEL SECURITY;
 ALTER TABLE app_private.messenger_operator_grants FORCE ROW LEVEL SECURITY;
 ALTER TABLE app_private.messenger_send_plans ENABLE ROW LEVEL SECURITY;
 ALTER TABLE app_private.messenger_send_plans FORCE ROW LEVEL SECURITY;
 ALTER TABLE app_private.messenger_send_parts ENABLE ROW LEVEL SECURITY;
 ALTER TABLE app_private.messenger_send_parts FORCE ROW LEVEL SECURITY;
 ALTER TABLE app_private.messenger_review_events ENABLE ROW LEVEL SECURITY;
 ALTER TABLE app_private.messenger_review_events FORCE ROW LEVEL SECURITY;
 REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
 REVOKE ALL ON app_private.messenger_operator_grants,app_private.messenger_send_plans,
 app_private.messenger_send_parts,app_private.messenger_review_events FROM PUBLIC;
 GRANT USAGE ON SCHEMA app_private TO $RA,$RM,$RS,$RB,$RC,$RX;
 GRANT SELECT ON app_private.messenger_operator_grants,app_private.messenger_send_plans,
 app_private.messenger_send_parts,app_private.messenger_review_events TO $RA,$RM,$RS,$RB,$RC,$RX;
 GRANT INSERT ON app_private.messenger_review_events TO $RA,$RM,$RS,$RB,$RC,$RX;
 CREATE POLICY private_grant_self ON app_private.messenger_operator_grants
 FOR SELECT TO $RA,$RM,$RS,$RB,$RC,$RX USING(db_role=CURRENT_USER::name);
 CREATE POLICY scoped_plans ON app_private.messenger_send_plans
 FOR SELECT TO $RA,$RM,$RS,$RB,$RC,$RX USING(EXISTS(
 SELECT 1 FROM app_private.messenger_operator_grants g
 WHERE g.db_role=CURRENT_USER::name AND g.active
 AND g.valid_until>transaction_timestamp()
 AND g.tenant_id=messenger_send_plans.tenant_id AND g.store_id=messenger_send_plans.store_id
 AND g.page_id=messenger_send_plans.page_id));
 CREATE POLICY scoped_parts ON app_private.messenger_send_parts
 FOR SELECT TO $RA,$RM,$RS,$RB,$RC,$RX USING(EXISTS(
 SELECT 1 FROM app_private.messenger_operator_grants g
 WHERE g.db_role=CURRENT_USER::name AND g.active
 AND g.valid_until>transaction_timestamp()
 AND g.tenant_id=messenger_send_parts.tenant_id AND g.store_id=messenger_send_parts.store_id
 AND g.page_id=messenger_send_parts.page_id));
 CREATE POLICY scoped_journal_read ON app_private.messenger_review_events
 FOR SELECT TO $RA,$RM,$RS,$RB,$RC,$RX USING(EXISTS(
 SELECT 1 FROM app_private.messenger_operator_grants g
 WHERE g.db_role=CURRENT_USER::name AND g.active
 AND g.valid_until>transaction_timestamp()
 AND g.tenant_id=messenger_review_events.tenant_id AND g.store_id=messenger_review_events.store_id
 AND g.page_id=messenger_review_events.page_id));
 CREATE POLICY scoped_journal_insert ON app_private.messenger_review_events
 FOR INSERT TO $RA,$RM,$RS,$RB,$RC,$RX WITH CHECK(EXISTS(
 SELECT 1 FROM app_private.messenger_operator_grants g
 WHERE g.db_role=CURRENT_USER::name AND g.active
 AND g.valid_until>transaction_timestamp()
 AND g.tenant_id=messenger_review_events.tenant_id AND g.store_id=messenger_review_events.store_id
 AND g.page_id=messenger_review_events.page_id AND g.db_role=messenger_review_events.actor_db_role
 AND g.access_role=messenger_review_events.access_role
 AND ((g.access_role='OWNER' AND messenger_review_events.decision_code IN
 ('REQUEST_PROVIDER_REVIEW','ESCALATE_TO_OWNER','ACKNOWLEDGE_NO_SEND'))
 OR (g.access_role='MANAGER' AND messenger_review_events.decision_code IN
 ('REQUEST_PROVIDER_REVIEW','ESCALATE_TO_OWNER')))));
 INSERT INTO app_private.messenger_operator_grants
 (db_role,tenant_id,store_id,page_id,access_role,valid_until) VALUES
 ('$RA','$TA','$SA','$PA','OWNER',transaction_timestamp()+interval '1 day'),
 ('$RM','$TA','$SA','$PA','MANAGER',transaction_timestamp()+interval '1 day'),
 ('$RS','$TA','$SA','$PA','STAFF',transaction_timestamp()+interval '1 day'),
 ('$RB','$TA','$SB','$PB','OWNER',transaction_timestamp()+interval '1 day'),
 ('$RC','$TB','$SC','$PC','OWNER',transaction_timestamp()+interval '1 day'),
 ('$RX','$TA','$SA','$PA','OWNER',transaction_timestamp()-interval '1 minute');
 INSERT INTO app_private.messenger_send_plans
 (id,tenant_id,store_id,page_id,sender_hash,binding_version,event_hash,
 plan_digest,expected_count,status) VALUES
 ('$I1','$TA','$SA','$PA','$H',3,'$E','$D',3,'PREPARED'),
 ('$I2','$TA','$SB','$PB','$H',3,'$E','$D',1,'PREPARED'),
 ('$I3','$TB','$SC','$PC','$H',3,'$E','$D',1,'PREPARED');
 INSERT INTO app_private.messenger_send_parts
 (plan_id,tenant_id,store_id,page_id,part_no,body_digest,status) VALUES
 ('$I1','$TA','$SA','$PA',1,'$BODY','API_ACCEPTED_MOCK'),
 ('$I1','$TA','$SA','$PA',2,'$BODY','API_ACCEPTED_MOCK'),
 ('$I1','$TA','$SA','$PA',3,'$BODY','UNCERTAIN_HOLD'),
 ('$I2','$TA','$SB','$PB',1,'$BODY','PLANNED'),
 ('$I3','$TB','$SC','$PC',1,'$BODY','MAY_HAVE_SENT_HOLD');" >/dev/null

view(){
 local who="$1" tenant="$2" store="$3" page="$4"
 PGUSER="$who" PGPASSWORD="$PW" psql -XAtq -v ON_ERROR_STOP=1 -d "$DB" <<SQL
BEGIN;
$READ_ONLY;
PREPARE v(uuid,uuid,text,timestamptz) AS $VIEW;
EXECUTE v('$tenant','$store','$page','$CUTOFF');
COMMIT;
SQL
}
append(){
 local who="$1" plan="$2" tenant="$3" store="$4" page="$5" id="$6" action="$7" request="$8"
 client "$who" "PREPARE w(uuid,uuid,uuid,text,uuid,text,text) AS $APPEND;
 EXECUTE w('$plan','$tenant','$store','$page','$id','$action','$request');"
}

ok "$(sql "SELECT count(*) FROM pg_roles WHERE rolname IN ('$RA','$RM','$RS','$RB','$RC','$RX') AND NOT rolbypassrls AND NOT rolsuper")" 6 SIX_REAL_RESTRICTED_LOGINS
ok "$(sql "SELECT count(*) FROM pg_class WHERE oid IN('app_private.messenger_operator_grants'::regclass,'app_private.messenger_send_plans'::regclass,'app_private.messenger_send_parts'::regclass,'app_private.messenger_review_events'::regclass) AND relrowsecurity AND relforcerowsecurity")" 4 FOUR_FORCE_RLS_TABLES
for who in "$RA" "$RM" "$RS"; do
 ok "$(view "$who" "$TA" "$SA" "$PA" | grep -c "^$I1|" || true)" 1 AUTHORIZED_SHOP_A_READ
done
ok "$(view "$RB" "$TA" "$SB" "$PB" | grep -c "^$I2|" || true)" 1 OWNER_B_READ_ONLY_B
ok "$(view "$RC" "$TB" "$SC" "$PC" | grep -c "^$I3|" || true)" 1 OWNER_C_READ_ONLY_C
ok "$(view "$RX" "$TA" "$SA" "$PA" | grep -c "^$I1|" || true)" 0 EXPIRED_GRANT_DENIED
ok "$(view "$RA" "$TA" "$SB" "$PB" | grep -c "^$I2|" || true)" 0 A_CANNOT_READ_B
ok "$(view "$RA" "$TB" "$SC" "$PC" | grep -c "^$I3|" || true)" 0 A_CANNOT_READ_C_TENANT
ok "$(view "$RS" "$TA" "$SB" "$PB" | grep -c "^$I2|" || true)" 0 STAFF_A_CANNOT_READ_B
ok "$(append "$RA" "$I1" "$TA" "$SA" "$PA" "$J1" ACKNOWLEDGE_NO_SEND "$REQ1" | grep -c '|ACKNOWLEDGE_NO_SEND')" 1 OWNER_APPEND_ACK_NO_SEND
ok "$(append "$RM" "$I1" "$TA" "$SA" "$PA" "$J2" REQUEST_PROVIDER_REVIEW "$REQ2" | grep -c '|REQUEST_PROVIDER_REVIEW')" 1 MANAGER_APPEND_PROVIDER_REQUEST
ok "$(append "$RM" "$I1" "$TA" "$SA" "$PA" "$J3" ESCALATE_TO_OWNER "$REQ3" | grep -c '|ESCALATE_TO_OWNER')" 1 MANAGER_APPEND_ESCALATE
ok "$(append "$RM" "$I1" "$TA" "$SA" "$PA" "$J4" ACKNOWLEDGE_NO_SEND "$(printf '%064d' 9)" | grep -c '|ACKNOWLEDGE_NO_SEND' || true)" 0 MANAGER_CANNOT_ACK
ok "$(append "$RS" "$I1" "$TA" "$SA" "$PA" "$J4" REQUEST_PROVIDER_REVIEW "$(printf '%064d' 10)" | grep -c '|REQUEST_PROVIDER_REVIEW' || true)" 0 STAFF_CANNOT_APPEND
ok "$(append "$RX" "$I1" "$TA" "$SA" "$PA" "$J4" REQUEST_PROVIDER_REVIEW "$(printf '%064d' 11)" | grep -c '|REQUEST_PROVIDER_REVIEW' || true)" 0 EXPIRED_CANNOT_APPEND
ok "$(append "$RA" "$I2" "$TA" "$SB" "$PB" "$J4" REQUEST_PROVIDER_REVIEW "$(printf '%064d' 12)" | grep -c '|REQUEST_PROVIDER_REVIEW' || true)" 0 OWNER_A_CANNOT_APPEND_B
ok "$(append "$RA" "$I3" "$TB" "$SC" "$PC" "$J4" REQUEST_PROVIDER_REVIEW "$(printf '%064d' 13)" | grep -c '|REQUEST_PROVIDER_REVIEW' || true)" 0 OWNER_A_CANNOT_APPEND_C
ok "$(append "$RA" "$I1" "$TA" "$SA" "$PA" "$J5" ACKNOWLEDGE_NO_SEND "$REQ1" | grep -c '|ACKNOWLEDGE_NO_SEND' || true)" 0 REUSED_IDEMPOTENCY_NO_DUPLICATE
ok "$(sql "SELECT count(*) FROM app_private.messenger_review_events")" 3 ONLY_THREE_APPROVED_RECORDS
ok "$(sql "SELECT count(*) FROM app_private.messenger_review_events WHERE actor_db_role='$RA' AND access_role='OWNER'")" 1 AUDIT_ACTOR_IS_REAL_OWNER_LOGIN
ok "$(sql "SELECT count(*) FROM app_private.messenger_review_events WHERE actor_db_role='$RM' AND access_role='MANAGER'")" 2 AUDIT_ACTOR_IS_REAL_MANAGER_LOGIN
ok "$(sql "SELECT count(*) FROM app_private.messenger_send_parts WHERE status='UNCERTAIN_HOLD'")" 1 LEDGER_UNCERTAINTY_UNCHANGED
ok "$(sql "SELECT count(*) FROM app_private.messenger_send_plans WHERE status='PREPARED'")" 3 LEDGER_PLANS_UNCHANGED
deny STAFF_CANNOT_IMPERSONATE_OWNER "$RS" "SET ROLE $RA"
deny OWNER_CANNOT_EDIT_REVIEW "$RA" "UPDATE app_private.messenger_review_events SET decision_code='ACKNOWLEDGE_NO_SEND' WHERE plan_id='$I1'"
deny OWNER_CANNOT_DELETE_REVIEW "$RA" "DELETE FROM app_private.messenger_review_events WHERE plan_id='$I1'"
deny STAFF_DIRECT_INSERT_FORGED_ROLE "$RS" "INSERT INTO app_private.messenger_review_events(id,plan_id,tenant_id,store_id,page_id,actor_db_role,access_role,decision_code,request_digest,created_at) VALUES('$J6','$I1','$TA','$SA','$PA','$RA','OWNER','ACKNOWLEDGE_NO_SEND','$(printf '%064d' 14)',transaction_timestamp())"

# A fake client JWT can be set in session, but cannot change CURRENT_USER or registry.
ok "$(client "$RS" "SELECT set_config('request.jwt.claims','{\"role\":\"OWNER\",\"tenant_id\":\"$TA\",\"store_id\":\"$SA\"}',false);
 SELECT count(*) FROM app_private.messenger_review_events WHERE plan_id='$I1'" | tail -1)" 3 STAFF_FAKE_JWT_DOES_NOT_CHANGE_OWN_READ_SCOPE
# Agent reconnect should see the same committed audit while live ledger is immutable.
ok "$(client "$RA" "SELECT count(*) FROM app_private.messenger_review_events")" 3 NEW_SESSION_SEES_JOURNAL
sql "UPDATE app_private.messenger_operator_grants SET active=false WHERE db_role='$RA'" >/dev/null
ok "$(view "$RA" "$TA" "$SA" "$PA" | grep -c "^$I1|" || true)" 0 REVOKED_OWNER_CANNOT_VIEW
ok "$(append "$RA" "$I1" "$TA" "$SA" "$PA" "$J6" ESCALATE_TO_OWNER "$(printf '%064d' 15)" | grep -c '|ESCALATE_TO_OWNER' || true)" 0 REVOKED_OWNER_CANNOT_APPEND
ok "$(sql "SELECT count(*) FROM app_private.messenger_review_events")" 3 REVOKED_NO_NEW_JOURNAL
echo "PG17_OPERATOR_REVIEW_RLS_TESTS=$PASS"
echo "SYNTHETIC_ONLY=true; HOSTED_WRITES=false; META_SEND=false; AUTO_RETRY=false"
