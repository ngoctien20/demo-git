#!/usr/bin/env bash
# V21 — signed-session / opaque reference backend SQL admission on disposable PG17.
# No hosted Supabase, real web sessions, Meta API, Orders, auto resend.
set -euo pipefail
[ "$CI" = true ] && [ "$GITHUB_ACTIONS" = true ] && [ "$T404_DISPOSABLE_PG_QA" = YES ] || exit 2
case "$PGHOST" in localhost|127.0.0.1) ;; *) echo REFUSE_REMOTE; exit 2;; esac
[ "$PGPORT" = 5432 ] || exit 2
[ -z "$SUPABASE_DB_URL$SUPABASE_ACCESS_TOKEN$DATABASE_URL$PGHOSTADDR" ] || exit 2
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VIEW=$(cd "$ROOT" && node -e 'process.stdout.write(require("./qa/messenger-rich-v136m5/private-opaque-session-bridge.cjs").SQL.view)')
APPEND=$(cd "$ROOT" && node -e 'process.stdout.write(require("./qa/messenger-rich-v136m5/private-opaque-session-bridge.cjs").SQL.append)')
READ_ONLY=$(cd "$ROOT" && node -e 'process.stdout.write(require("./qa/messenger-rich-v136m5/private-opaque-session-bridge.cjs").SQL.readOnly)')
DB="t404_opaque_$RANDOM$RANDOM"; RA="t404_opaque_owner_$RANDOM$RANDOM"
RM="t404_opaque_manager_$RANDOM$RANDOM"; RS="t404_opaque_staff_$RANDOM$RANDOM"
RB="t404_opaque_shopb_$RANDOM$RANDOM"
PW="local_$(openssl rand -hex 16)"
TMP=$(mktemp -d); db_created=0; roles_created=0; PASS=0
admin(){ psql -XAtq -v ON_ERROR_STOP=1 -d postgres -c "$1"; }
sql(){ psql -XAtq -v ON_ERROR_STOP=1 -d "$DB" -c "$1"; }
client(){ PGUSER="$1" PGPASSWORD="$PW" psql -XAtq -v ON_ERROR_STOP=1 -d "$DB" -c "$2"; }
cleanup(){
 if [ "$db_created" = 1 ];then admin "DROP DATABASE $DB WITH (FORCE)" >/dev/null || true;fi
 if [ "$roles_created" = 1 ];then for r in "$RA" "$RM" "$RS" "$RB";do admin "DROP ROLE $r" >/dev/null || true;done;fi
 rm -rf "$TMP"
}
trap cleanup EXIT
fail(){ echo "FAIL_$1"; exit 1; }
ok(){ [ "$1" = "$2" ] || fail "$3"; PASS=$((PASS+1)); echo "PASS_$3"; }
deny(){
 local tag="$1" who="$2" q="$3"
 if client "$who" "$q" >"$TMP/err" 2>&1;then fail "$tag";fi
 grep -Eqi 'row-level security|permission denied|cannot set role|must be member' "$TMP/err" || { cat "$TMP/err"; fail "WRONG_DENIAL_$tag"; }
 PASS=$((PASS+1));echo "PASS_DENY_$tag"
}
TA=11111111-1111-4111-8111-111111111111
SA=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa
SB=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb
PA=12345678901234567;PB=98765432109876543
UA=40000000-0000-4000-8000-000000000001
UM=40000000-0000-4000-8000-000000000002
US=40000000-0000-4000-8000-000000000003
UB=40000000-0000-4000-8000-000000000004
SEA=30000000-0000-4000-8000-000000000001
SEM=30000000-0000-4000-8000-000000000002
SES=30000000-0000-4000-8000-000000000003
SEB=30000000-0000-4000-8000-000000000004
PIDA=10000000-0000-4000-8000-000000000001
PIDB=10000000-0000-4000-8000-000000000002
J1=20000000-0000-4000-8000-000000000001
J2=20000000-0000-4000-8000-000000000002
J3=20000000-0000-4000-8000-000000000003
J4=20000000-0000-4000-8000-000000000004
J5=20000000-0000-4000-8000-000000000005
E=$(printf '%064d' 2); H=$(printf '%064d' 1); D=$(printf '%064d' 3)
REQ1=$(printf '%064d' 9);REQ2=$(printf '%064d' 8);REQ3=$(printf '%064d' 7)
REF_A=$(cd "$ROOT" && node -e '
 const {createHmac}=require("node:crypto");
 const ref=createHmac("sha256","SYNTHETIC_OPERATOR_REFERENCE_SECRET_FOR_QA_404")
 .update("tien404/messenger/reconcile/ref/v1\0"+
 ["11111111-1111-4111-8111-111111111111",
 "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","12345678901234567",
 "10000000-0000-4000-8000-000000000001"].join("|")).digest("hex").slice(0,32);
 process.stdout.write(ref);')
REF_B=$(cd "$ROOT" && node -e '
 const {createHmac}=require("node:crypto");
 const ref=createHmac("sha256","SYNTHETIC_OPERATOR_REFERENCE_SECRET_FOR_QA_404")
 .update("tien404/messenger/reconcile/ref/v1\0"+
 ["11111111-1111-4111-8111-111111111111",
 "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","98765432109876543",
 "10000000-0000-4000-8000-000000000002"].join("|")).digest("hex").slice(0,32);
 process.stdout.write(ref);')

admin "CREATE DATABASE $DB" >/dev/null;db_created=1
admin "CREATE ROLE $RA LOGIN NOINHERIT NOBYPASSRLS PASSWORD '$PW';
 CREATE ROLE $RM LOGIN NOINHERIT NOBYPASSRLS PASSWORD '$PW';
 CREATE ROLE $RS LOGIN NOINHERIT NOBYPASSRLS PASSWORD '$PW';
 CREATE ROLE $RB LOGIN NOINHERIT NOBYPASSRLS PASSWORD '$PW';" >/dev/null;roles_created=1
sql "CREATE SCHEMA app_private;
 CREATE TABLE app_private.messenger_operator_grants(
 db_role name NOT NULL,subject_user_id uuid NOT NULL,tenant_id uuid NOT NULL,
 store_id uuid NOT NULL,page_id text NOT NULL,access_role text NOT NULL
 CHECK(access_role IN ('OWNER','MANAGER','STAFF')),active bool NOT NULL,
 valid_until timestamptz NOT NULL,
 PRIMARY KEY(db_role,subject_user_id,tenant_id,store_id,page_id));
 CREATE TABLE app_private.messenger_operator_sessions(
 id uuid PRIMARY KEY,db_role name NOT NULL,subject_user_id uuid NOT NULL,
 tenant_id uuid NOT NULL,store_id uuid NOT NULL,page_id text NOT NULL,
 active bool NOT NULL,expires_at timestamptz NOT NULL);
 CREATE TABLE app_private.messenger_send_plans(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,store_id uuid NOT NULL,page_id text NOT NULL,
 sender_hash char(64) NOT NULL,binding_version int NOT NULL,event_hash char(64) NOT NULL,
 plan_digest char(64) NOT NULL,expected_count int NOT NULL,status text NOT NULL,
 UNIQUE(id,tenant_id,store_id,page_id));
 CREATE TABLE app_private.messenger_send_parts(
 plan_id uuid NOT NULL,tenant_id uuid NOT NULL,store_id uuid NOT NULL,page_id text NOT NULL,
 part_no int NOT NULL,status text NOT NULL,attempted_at timestamptz,
 PRIMARY KEY(plan_id,part_no),FOREIGN KEY(plan_id,tenant_id,store_id,page_id)
 REFERENCES app_private.messenger_send_plans(id,tenant_id,store_id,page_id));
 CREATE TABLE app_private.messenger_reconciliation_refs(
 reference char(32) PRIMARY KEY,plan_id uuid NOT NULL,tenant_id uuid NOT NULL,
 store_id uuid NOT NULL,page_id text NOT NULL,
 FOREIGN KEY(plan_id,tenant_id,store_id,page_id)
 REFERENCES app_private.messenger_send_plans(id,tenant_id,store_id,page_id));
 CREATE TABLE app_private.messenger_review_events(
 id uuid PRIMARY KEY,plan_id uuid NOT NULL,tenant_id uuid NOT NULL,
 store_id uuid NOT NULL,page_id text NOT NULL,operator_session_id uuid NOT NULL,
 actor_db_role name NOT NULL,access_role text NOT NULL,
 decision_code text NOT NULL CHECK(decision_code IN
 ('REQUEST_PROVIDER_REVIEW','ESCALATE_TO_OWNER','ACKNOWLEDGE_NO_SEND')),
 request_digest char(64) NOT NULL,created_at timestamptz NOT NULL,
 UNIQUE(plan_id,request_digest),
 FOREIGN KEY(plan_id,tenant_id,store_id,page_id)
 REFERENCES app_private.messenger_send_plans(id,tenant_id,store_id,page_id));
 ALTER TABLE app_private.messenger_operator_grants ENABLE ROW LEVEL SECURITY;
 ALTER TABLE app_private.messenger_operator_grants FORCE ROW LEVEL SECURITY;
 ALTER TABLE app_private.messenger_operator_sessions ENABLE ROW LEVEL SECURITY;
 ALTER TABLE app_private.messenger_operator_sessions FORCE ROW LEVEL SECURITY;
 ALTER TABLE app_private.messenger_send_plans ENABLE ROW LEVEL SECURITY;
 ALTER TABLE app_private.messenger_send_plans FORCE ROW LEVEL SECURITY;
 ALTER TABLE app_private.messenger_send_parts ENABLE ROW LEVEL SECURITY;
 ALTER TABLE app_private.messenger_send_parts FORCE ROW LEVEL SECURITY;
 ALTER TABLE app_private.messenger_reconciliation_refs ENABLE ROW LEVEL SECURITY;
 ALTER TABLE app_private.messenger_reconciliation_refs FORCE ROW LEVEL SECURITY;
 ALTER TABLE app_private.messenger_review_events ENABLE ROW LEVEL SECURITY;
 ALTER TABLE app_private.messenger_review_events FORCE ROW LEVEL SECURITY;
 REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
 REVOKE ALL ON app_private.messenger_operator_grants,app_private.messenger_operator_sessions,
 app_private.messenger_send_plans,app_private.messenger_send_parts,
 app_private.messenger_reconciliation_refs,app_private.messenger_review_events FROM PUBLIC;
 GRANT USAGE ON SCHEMA app_private TO $RA,$RM,$RS,$RB;
 GRANT SELECT ON app_private.messenger_operator_grants,app_private.messenger_operator_sessions,
 app_private.messenger_send_plans,app_private.messenger_send_parts,
 app_private.messenger_reconciliation_refs,app_private.messenger_review_events TO $RA,$RM,$RS,$RB;
 GRANT INSERT ON app_private.messenger_review_events TO $RA,$RM,$RS,$RB;
 CREATE POLICY grants_self ON app_private.messenger_operator_grants FOR SELECT
 TO $RA,$RM,$RS,$RB USING(db_role=CURRENT_USER::name);
 CREATE POLICY sessions_self ON app_private.messenger_operator_sessions FOR SELECT
 TO $RA,$RM,$RS,$RB USING(db_role=CURRENT_USER::name);
 CREATE POLICY plans_scope ON app_private.messenger_send_plans FOR SELECT
 TO $RA,$RM,$RS,$RB USING(EXISTS(SELECT 1 FROM app_private.messenger_operator_grants g
 WHERE g.db_role=CURRENT_USER::name AND g.active AND g.valid_until>transaction_timestamp()
 AND g.tenant_id=messenger_send_plans.tenant_id
 AND g.store_id=messenger_send_plans.store_id AND g.page_id=messenger_send_plans.page_id));
 CREATE POLICY parts_scope ON app_private.messenger_send_parts FOR SELECT
 TO $RA,$RM,$RS,$RB USING(EXISTS(SELECT 1 FROM app_private.messenger_operator_grants g
 WHERE g.db_role=CURRENT_USER::name AND g.active AND g.valid_until>transaction_timestamp()
 AND g.tenant_id=messenger_send_parts.tenant_id
 AND g.store_id=messenger_send_parts.store_id AND g.page_id=messenger_send_parts.page_id));
 CREATE POLICY refs_scope ON app_private.messenger_reconciliation_refs FOR SELECT
 TO $RA,$RM,$RS,$RB USING(EXISTS(SELECT 1 FROM app_private.messenger_operator_grants g
 WHERE g.db_role=CURRENT_USER::name AND g.active AND g.valid_until>transaction_timestamp()
 AND g.tenant_id=messenger_reconciliation_refs.tenant_id
 AND g.store_id=messenger_reconciliation_refs.store_id
 AND g.page_id=messenger_reconciliation_refs.page_id));
 CREATE POLICY journal_scope ON app_private.messenger_review_events FOR SELECT
 TO $RA,$RM,$RS,$RB USING(EXISTS(SELECT 1 FROM app_private.messenger_operator_grants g
 WHERE g.db_role=CURRENT_USER::name AND g.active AND g.valid_until>transaction_timestamp()
 AND g.tenant_id=messenger_review_events.tenant_id AND g.store_id=messenger_review_events.store_id
 AND g.page_id=messenger_review_events.page_id));
 CREATE POLICY journal_append ON app_private.messenger_review_events FOR INSERT
 TO $RA,$RM,$RS,$RB WITH CHECK(EXISTS(
 SELECT 1 FROM app_private.messenger_operator_sessions s
 JOIN app_private.messenger_operator_grants g
 ON g.db_role=s.db_role AND g.subject_user_id=s.subject_user_id
 AND g.tenant_id=s.tenant_id AND g.store_id=s.store_id AND g.page_id=s.page_id
 WHERE s.id=messenger_review_events.operator_session_id
 AND s.db_role=CURRENT_USER::name
 AND messenger_review_events.actor_db_role=CURRENT_USER::name
 AND s.active AND s.expires_at>transaction_timestamp()
 AND g.active AND g.valid_until>transaction_timestamp()
 AND g.tenant_id=messenger_review_events.tenant_id
 AND g.store_id=messenger_review_events.store_id
 AND g.page_id=messenger_review_events.page_id
 AND messenger_review_events.access_role=g.access_role
 AND ((g.access_role='OWNER' AND messenger_review_events.decision_code IN
 ('REQUEST_PROVIDER_REVIEW','ESCALATE_TO_OWNER','ACKNOWLEDGE_NO_SEND'))
 OR (g.access_role='MANAGER' AND messenger_review_events.decision_code IN
 ('REQUEST_PROVIDER_REVIEW','ESCALATE_TO_OWNER')))));
 INSERT INTO app_private.messenger_operator_grants
 (db_role,subject_user_id,tenant_id,store_id,page_id,access_role,active,valid_until) VALUES
 ('$RA','$UA','$TA','$SA','$PA','OWNER',true,transaction_timestamp()+interval '1 day'),
 ('$RM','$UM','$TA','$SA','$PA','MANAGER',true,transaction_timestamp()+interval '1 day'),
 ('$RS','$US','$TA','$SA','$PA','STAFF',true,transaction_timestamp()+interval '1 day'),
 ('$RB','$UB','$TA','$SB','$PB','OWNER',true,transaction_timestamp()+interval '1 day');
 INSERT INTO app_private.messenger_operator_sessions
 (id,db_role,subject_user_id,tenant_id,store_id,page_id,active,expires_at) VALUES
 ('$SEA','$RA','$UA','$TA','$SA','$PA',true,transaction_timestamp()+interval '1 day'),
 ('$SEM','$RM','$UM','$TA','$SA','$PA',true,transaction_timestamp()+interval '1 day'),
 ('$SES','$RS','$US','$TA','$SA','$PA',true,transaction_timestamp()+interval '1 day'),
 ('$SEB','$RB','$UB','$TA','$SB','$PB',true,transaction_timestamp()+interval '1 day');
 INSERT INTO app_private.messenger_send_plans
 (id,tenant_id,store_id,page_id,sender_hash,binding_version,event_hash,plan_digest,expected_count,status)
 VALUES('$PIDA','$TA','$SA','$PA','$H',3,'$E','$D',3,'PREPARED'),
 ('$PIDB','$TA','$SB','$PB','$H',3,'$E','$D',1,'PREPARED');
 INSERT INTO app_private.messenger_send_parts
 (plan_id,tenant_id,store_id,page_id,part_no,status) VALUES
 ('$PIDA','$TA','$SA','$PA',1,'API_ACCEPTED_MOCK'),
 ('$PIDA','$TA','$SA','$PA',2,'API_ACCEPTED_MOCK'),
 ('$PIDA','$TA','$SA','$PA',3,'UNCERTAIN_HOLD'),
 ('$PIDB','$TA','$SB','$PB',1,'PLANNED');
 INSERT INTO app_private.messenger_reconciliation_refs(reference,plan_id,tenant_id,store_id,page_id)
 VALUES('$REF_A','$PIDA','$TA','$SA','$PA'),('$REF_B','$PIDB','$TA','$SB','$PB');" >/dev/null
view(){
 local role="$1" ref="$2" session="$3"
 PGUSER="$role" PGPASSWORD="$PW" psql -XAtq -v ON_ERROR_STOP=1 -d "$DB" <<SQL
BEGIN;
$READ_ONLY;
PREPARE op_view(text,uuid,timestamptz) AS $VIEW;
EXECUTE op_view('$ref','$session','2026-11-22T15:00:00Z');
COMMIT;
SQL
}
append(){
 local role="$1" ref="$2" session="$3" id="$4" decision="$5" digest="$6"
 client "$role" "PREPARE op_write(text,uuid,uuid,text,text) AS $APPEND;
 EXECUTE op_write('$ref','$session','$id','$decision','$digest');"
}
ok "$(sql "SELECT count(*) FROM pg_roles WHERE rolname IN ('$RA','$RM','$RS','$RB') AND NOT rolsuper AND NOT rolbypassrls")" 4 FOUR_RESTRICTED_PG_LOGIN_ROLES
ok "$(sql "SELECT count(*) FROM pg_class WHERE oid IN('app_private.messenger_operator_grants'::regclass,'app_private.messenger_operator_sessions'::regclass,'app_private.messenger_send_plans'::regclass,'app_private.messenger_send_parts'::regclass,'app_private.messenger_reconciliation_refs'::regclass,'app_private.messenger_review_events'::regclass) AND relrowsecurity AND relforcerowsecurity")" 6 SIX_FORCE_RLS_TABLES
for data in "$RA $SEA" "$RM $SEM" "$RS $SES";do
 set -- $data
 ok "$(view "$1" "$REF_A" "$2" | grep -c "^$PIDA|" || true)" 1 ROLE_A_VIEW_OWN_OPAQUE_REF
done
ok "$(view "$RB" "$REF_B" "$SEB" | grep -c "^$PIDB|" || true)" 1 ROLE_B_VIEW_OWN_REF
ok "$(view "$RA" "$REF_B" "$SEA" | grep -c "^$PIDB|" || true)" 0 OWNER_A_CANNOT_RESOLVE_B
ok "$(view "$RB" "$REF_A" "$SEB" | grep -c "^$PIDA|" || true)" 0 OWNER_B_CANNOT_RESOLVE_A
ok "$(view "$RB" "$REF_A" "$SEA" | grep -c "^$PIDA|" || true)" 0 STOLEN_A_SESSION_WRONG_DB_ROLE
ok "$(view "$RA" "$REF_A" "$SEB" | grep -c "^$PIDA|" || true)" 0 STOLEN_B_SESSION_WRONG_DB_ROLE
ok "$(view "$RA" "$(printf '%032d' 3)" "$SEA" | grep -c "^$PIDA|" || true)" 0 FORGED_REF_NO_PLAN
ok "$(append "$RM" "$REF_A" "$SEM" "$J1" REQUEST_PROVIDER_REVIEW "$REQ1" | grep -c '|REQUEST_PROVIDER_REVIEW')" 1 MANAGER_CAN_REQUEST_PROVIDER_REVIEW
ok "$(append "$RA" "$REF_A" "$SEA" "$J2" ACKNOWLEDGE_NO_SEND "$REQ2" | grep -c '|ACKNOWLEDGE_NO_SEND')" 1 OWNER_CAN_ACK_NO_SEND
ok "$(append "$RM" "$REF_A" "$SEM" "$J3" ACKNOWLEDGE_NO_SEND "$REQ3" | grep -c '|ACKNOWLEDGE_NO_SEND' || true)" 0 MANAGER_CANNOT_ACK
ok "$(append "$RS" "$REF_A" "$SES" "$J3" REQUEST_PROVIDER_REVIEW "$REQ3" | grep -c '|REQUEST_PROVIDER_REVIEW' || true)" 0 STAFF_CANNOT_APPEND
ok "$(append "$RA" "$REF_B" "$SEA" "$J3" REQUEST_PROVIDER_REVIEW "$REQ3" | grep -c '|REQUEST_PROVIDER_REVIEW' || true)" 0 OWNER_A_CANNOT_APPEND_SHOP_B
ok "$(append "$RB" "$REF_A" "$SEB" "$J3" REQUEST_PROVIDER_REVIEW "$REQ3" | grep -c '|REQUEST_PROVIDER_REVIEW' || true)" 0 OWNER_B_CANNOT_APPEND_SHOP_A
ok "$(append "$RA" "$REF_A" "$SEA" "$J4" ACKNOWLEDGE_NO_SEND "$REQ2" | grep -c '|ACKNOWLEDGE_NO_SEND' || true)" 0 DUPLICATE_IDEMPOTENCY_NOT_REWRITTEN
ok "$(sql "SELECT count(*) FROM app_private.messenger_review_events")" 2 TWO_VALID_JOURNAL_RECORDS
ok "$(sql "SELECT count(*) FROM app_private.messenger_review_events WHERE actor_db_role='$RA' AND operator_session_id='$SEA'")" 1 OWNER_RECORD_HAS_REAL_SESSION
ok "$(sql "SELECT count(*) FROM app_private.messenger_review_events WHERE actor_db_role='$RM' AND operator_session_id='$SEM'")" 1 MANAGER_RECORD_HAS_REAL_SESSION
ok "$(sql "SELECT count(*) FROM app_private.messenger_send_parts WHERE status='UNCERTAIN_HOLD'")" 1 UNCERTAIN_MESSAGE_UNCHANGED
deny RAW_FAKE_OPERATOR_SESSION_INSERT "$RS" "INSERT INTO app_private.messenger_review_events(id,plan_id,tenant_id,store_id,page_id,operator_session_id,actor_db_role,access_role,decision_code,request_digest,created_at) VALUES('$J5','$PIDA','$TA','$SA','$PA','$SEA','$RA','OWNER','ACKNOWLEDGE_NO_SEND','$(printf '%064d' 10)',transaction_timestamp())"
deny RAW_JOURNAL_UPDATE "$RA" "UPDATE app_private.messenger_review_events SET decision_code='ACKNOWLEDGE_NO_SEND'"
deny RAW_JOURNAL_DELETE "$RA" "DELETE FROM app_private.messenger_review_events"
deny DB_ROLE_IMPERSONATION "$RS" "SET ROLE $RA"
sql "UPDATE app_private.messenger_operator_sessions SET active=false WHERE id='$SEA'" >/dev/null
ok "$(view "$RA" "$REF_A" "$SEA" | grep -c "^$PIDA|" || true)" 0 REVOKED_SESSION_CANNOT_VIEW
ok "$(append "$RA" "$REF_A" "$SEA" "$J5" ESCALATE_TO_OWNER "$(printf '%064d' 12)" | grep -c '|ESCALATE_TO_OWNER' || true)" 0 REVOKED_SESSION_CANNOT_APPEND
sql "UPDATE app_private.messenger_operator_sessions SET active=true WHERE id='$SEA'" >/dev/null
sql "UPDATE app_private.messenger_operator_grants SET active=false WHERE db_role='$RA'" >/dev/null
ok "$(view "$RA" "$REF_A" "$SEA" | grep -c "^$PIDA|" || true)" 0 REVOKED_STORE_GRANT_CANNOT_VIEW
ok "$(append "$RA" "$REF_A" "$SEA" "$J5" ESCALATE_TO_OWNER "$(printf '%064d' 13)" | grep -c '|ESCALATE_TO_OWNER' || true)" 0 REVOKED_STORE_GRANT_CANNOT_APPEND
ok "$(sql "SELECT count(*) FROM app_private.messenger_review_events")" 2 REVOKED_NO_JOURNAL_MUTATION
ok "$(sql "SELECT count(*) FROM app_private.messenger_send_plans")" 2 LEDGER_PLANS_IMMUTABLE
echo "PG17_OPAQUE_SESSION_BRIDGE_TESTS=$PASS"
echo "SYNTHETIC_ONLY=true; HOSTED_WRITES=false; META_SEND=false; AUTO_RETRY=false"
