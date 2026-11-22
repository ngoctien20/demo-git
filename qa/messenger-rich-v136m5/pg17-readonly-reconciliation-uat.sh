#!/usr/bin/env bash
# V21 Messenger READ-ONLY reconciliation with real disposable PG17 FORCE RLS.
# No hosted DB, provider API, real sender, Orders or customer data.
set -euo pipefail
[ "$CI" = true ] && [ "$GITHUB_ACTIONS" = true ] && [ "$T404_DISPOSABLE_PG_QA" = YES ] || exit 2
case "$PGHOST" in localhost|127.0.0.1) ;; *) echo REFUSE_NON_LOCAL; exit 2;; esac
[ "$PGPORT" = 5432 ] || exit 2
[ -z "$SUPABASE_DB_URL$SUPABASE_ACCESS_TOKEN$DATABASE_URL$PGHOSTADDR" ] || exit 2
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SNAPSHOT=$(cd "$ROOT" && node -e 'process.stdout.write(require("./qa/messenger-rich-v136m5/message-reconciliation-inspector.cjs").SQL.snapshot)')
READ_ONLY=$(cd "$ROOT" && node -e 'process.stdout.write(require("./qa/messenger-rich-v136m5/message-reconciliation-inspector.cjs").SQL.readOnly)')
DB="t404_reconcile_$RANDOM$RANDOM"
RA="t404_reconcile_a_$RANDOM$RANDOM"
RB="t404_reconcile_b_$RANDOM$RANDOM"
RC="t404_reconcile_c_$RANDOM$RANDOM"
PW="synthetic_$(openssl rand -hex 18)"
TMP=$(mktemp -d); made_db=0; made_roles=0; PASS=0
admin(){ psql -XAtq -v ON_ERROR_STOP=1 -d postgres -c "$1"; }
sql(){ psql -XAtq -v ON_ERROR_STOP=1 -d "$DB" -c "$1"; }
client(){ PGUSER="$1" PGPASSWORD="$PW" psql -XAtq -v ON_ERROR_STOP=1 -d "$DB" -c "$2"; }
cleanup(){
 if [ "$made_db" = 1 ]; then admin "DROP DATABASE $DB WITH (FORCE)" >/dev/null || echo WARN_DROP_DB; fi
 if [ "$made_roles" = 1 ]; then for r in "$RA" "$RB" "$RC"; do admin "DROP ROLE $r" >/dev/null || echo WARN_DROP_ROLE; done; fi
 rm -rf "$TMP"
}
trap cleanup EXIT
fail(){ echo "FAIL_$1"; exit 1; }
ok(){ [ "$1" = "$2" ] || fail "$3"; PASS=$((PASS+1)); echo "PASS_$3"; }
TA=11111111-1111-4111-8111-111111111111
TB=22222222-2222-4222-8222-222222222222
SA=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa
SB=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb
SC=cccccccc-cccc-4ccc-8ccc-cccccccccccc
PA=12345678901234567; PB=98765432109876543; PC=88888888888888888
NOW=2026-11-22T15:00:00Z
CUTOFF=2026-11-22T14:55:00Z
OLDER=2026-11-22T14:45:00Z
FRESH=2026-11-22T14:59:30Z
H=$(printf '%064d' 1)
E=$(printf '%064d' 2)
D=$(printf '%064d' 3)
B=$(printf '%064d' 4)
I1=10000000-0000-4000-8000-000000000001
I2=10000000-0000-4000-8000-000000000002
I3=10000000-0000-4000-8000-000000000003
I4=10000000-0000-4000-8000-000000000004
I5=10000000-0000-4000-8000-000000000005
I6=10000000-0000-4000-8000-000000000006
I7=10000000-0000-4000-8000-000000000007
I8=10000000-0000-4000-8000-000000000008
admin "CREATE DATABASE $DB" >/dev/null; made_db=1
admin "CREATE ROLE $RA LOGIN NOINHERIT NOBYPASSRLS PASSWORD '$PW';
 CREATE ROLE $RB LOGIN NOINHERIT NOBYPASSRLS PASSWORD '$PW';
 CREATE ROLE $RC LOGIN NOINHERIT NOBYPASSRLS PASSWORD '$PW';" >/dev/null; made_roles=1
sql "CREATE SCHEMA app_private;
 CREATE TABLE app_private.qa_role_page_scopes(
  role_name name NOT NULL,tenant_id uuid NOT NULL,store_id uuid NOT NULL,
  page_id text NOT NULL,active boolean NOT NULL DEFAULT true,
  PRIMARY KEY(role_name,tenant_id,store_id,page_id));
 CREATE TABLE app_private.messenger_send_plans(
  id uuid PRIMARY KEY,tenant_id uuid NOT NULL,store_id uuid NOT NULL,page_id text NOT NULL,
  sender_hash char(64) NOT NULL,binding_version int NOT NULL,event_hash char(64) NOT NULL,
  plan_digest char(64) NOT NULL,expected_count int NOT NULL,status text NOT NULL);
 CREATE TABLE app_private.messenger_send_parts(
  plan_id uuid NOT NULL REFERENCES app_private.messenger_send_plans(id),
  tenant_id uuid NOT NULL,store_id uuid NOT NULL,page_id text NOT NULL,
  part_no int NOT NULL,status text NOT NULL,
  body_digest char(64) NOT NULL,attempted_at timestamptz,attempt_id uuid,
  PRIMARY KEY(plan_id,part_no));
 ALTER TABLE app_private.qa_role_page_scopes ENABLE ROW LEVEL SECURITY;
 ALTER TABLE app_private.qa_role_page_scopes FORCE ROW LEVEL SECURITY;
 ALTER TABLE app_private.messenger_send_plans ENABLE ROW LEVEL SECURITY;
 ALTER TABLE app_private.messenger_send_plans FORCE ROW LEVEL SECURITY;
 ALTER TABLE app_private.messenger_send_parts ENABLE ROW LEVEL SECURITY;
 ALTER TABLE app_private.messenger_send_parts FORCE ROW LEVEL SECURITY;
 REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
 REVOKE ALL ON app_private.qa_role_page_scopes,app_private.messenger_send_plans,app_private.messenger_send_parts FROM PUBLIC;
 GRANT USAGE ON SCHEMA app_private TO $RA,$RB,$RC;
 GRANT SELECT ON app_private.qa_role_page_scopes,app_private.messenger_send_plans,app_private.messenger_send_parts TO $RA,$RB,$RC;
 CREATE POLICY bound_scope ON app_private.qa_role_page_scopes FOR SELECT TO $RA,$RB,$RC USING(role_name=CURRENT_USER::name);
 CREATE POLICY plan_ro ON app_private.messenger_send_plans FOR SELECT TO $RA,$RB,$RC USING(EXISTS(SELECT 1 FROM app_private.qa_role_page_scopes q
 WHERE q.role_name=CURRENT_USER::name AND q.active AND q.tenant_id=messenger_send_plans.tenant_id
 AND q.store_id=messenger_send_plans.store_id AND q.page_id=messenger_send_plans.page_id));
 CREATE POLICY part_ro ON app_private.messenger_send_parts FOR SELECT TO $RA,$RB,$RC USING(EXISTS(SELECT 1 FROM app_private.qa_role_page_scopes q
 WHERE q.role_name=CURRENT_USER::name AND q.active AND q.tenant_id=messenger_send_parts.tenant_id
 AND q.store_id=messenger_send_parts.store_id AND q.page_id=messenger_send_parts.page_id));
 INSERT INTO app_private.qa_role_page_scopes(role_name,tenant_id,store_id,page_id) VALUES
 ('$RA','$TA','$SA','$PA'),('$RB','$TA','$SB','$PB'),('$RC','$TB','$SC','$PC');
 INSERT INTO app_private.messenger_send_plans(id,tenant_id,store_id,page_id,sender_hash,binding_version,event_hash,plan_digest,expected_count,status) VALUES
 ('$I1','$TA','$SA','$PA','$H',3,'$E','$D',3,'PREPARED'),
 ('$I2','$TA','$SA','$PA','$H',3,'$E','$D',3,'PREPARED'),
 ('$I3','$TA','$SA','$PA','$H',3,'$E','$D',2,'PREPARED'),
 ('$I4','$TA','$SA','$PA','$H',3,'$E','$D',3,'MOCK_PARTS_ACCEPTED'),
 ('$I5','$TA','$SA','$PA','$H',3,'$E','$D',1,'PREPARED'),
 ('$I6','$TA','$SA','$PA','$H',3,'$E','$D',1,'PREPARED'),
 ('$I7','$TA','$SB','$PB','$H',3,'$E','$D',1,'PREPARED'),
 ('$I8','$TB','$SC','$PC','$H',3,'$E','$D',1,'PREPARED');
 INSERT INTO app_private.messenger_send_parts(plan_id,tenant_id,store_id,page_id,part_no,status,body_digest,attempted_at) VALUES
 ('$I1','$TA','$SA','$PA',1,'API_ACCEPTED_MOCK','$B',NULL),
 ('$I1','$TA','$SA','$PA',2,'PLANNED','$B',NULL),
 ('$I1','$TA','$SA','$PA',3,'PLANNED','$B',NULL),
 ('$I2','$TA','$SA','$PA',1,'API_ACCEPTED_MOCK','$B',NULL),
 ('$I2','$TA','$SA','$PA',2,'API_ACCEPTED_MOCK','$B',NULL),
 ('$I2','$TA','$SA','$PA',3,'UNCERTAIN_HOLD','$B',NULL),
 ('$I3','$TA','$SA','$PA',1,'MAY_HAVE_SENT_HOLD','$B','$OLDER'),
 ('$I3','$TA','$SA','$PA',2,'PLANNED','$B',NULL),
 ('$I4','$TA','$SA','$PA',1,'API_ACCEPTED_MOCK','$B',NULL),
 ('$I4','$TA','$SA','$PA',2,'API_ACCEPTED_MOCK','$B',NULL),
 ('$I4','$TA','$SA','$PA',3,'API_ACCEPTED_MOCK','$B',NULL),
 ('$I5','$TA','$SA','$PA',1,'MAY_HAVE_SENT_HOLD','$B','$FRESH'),
 ('$I6','$TA','$SA','$PA',1,'PLANNED','$B',NULL),
 ('$I7','$TA','$SB','$PB',1,'UNCERTAIN_HOLD','$B',NULL),
 ('$I8','$TB','$SC','$PC',1,'PLANNED','$B',NULL);" >/dev/null
inspect(){
 local role="$1" tenant="$2" store="$3" page="$4"
 PGUSER="$role" PGPASSWORD="$PW" psql -XAtq -v ON_ERROR_STOP=1 -d "$DB" <<SQL
BEGIN;
$READ_ONLY;
PREPARE r(uuid,uuid,text,timestamptz) AS $SNAPSHOT;
EXECUTE r('$tenant','$store','$page','$CUTOFF');
COMMIT;
SQL
}
inspect "$RA" "$TA" "$SA" "$PA" >"$TMP/A"
inspect "$RB" "$TA" "$SB" "$PB" >"$TMP/B"
inspect "$RC" "$TB" "$SC" "$PC" >"$TMP/C"
ok "$(sql "SELECT count(*) FROM pg_roles WHERE rolname IN ('$RA','$RB','$RC') AND NOT rolbypassrls AND NOT rolsuper")" 3 RESTRICTED_ROLES
ok "$(sql "SELECT count(*) FROM pg_class WHERE oid IN('app_private.qa_role_page_scopes'::regclass,'app_private.messenger_send_plans'::regclass,'app_private.messenger_send_parts'::regclass) AND relrowsecurity AND relforcerowsecurity")" 3 FORCE_RLS_ALL
ok "$(grep -c '^10000000-' "$TMP/A")" 6 A_SEES_SIX_OWN_PLANS
ok "$(grep -c '^10000000-' "$TMP/B")" 1 B_SEES_ONE_OWN_PLAN
ok "$(grep -c '^10000000-' "$TMP/C")" 1 C_SEES_ONE_OWN_PLAN
ok "$(awk -F'|' -v x="$I1" '$1==x{print $3"|"$4"|"$5"|"$9}' "$TMP/A")" '3|3|2|1' PARTIAL_ONE_OF_THREE
ok "$(awk -F'|' -v x="$I2" '$1==x{print $3"|"$4"|"$8"|"$9}' "$TMP/A")" '3|3|1|2' PARTIAL_TWO_OF_THREE_TIMEOUT
ok "$(awk -F'|' -v x="$I3" '$1==x{print $6"|"$7}' "$TMP/A")" '1|1' STALE_INFLIGHT
ok "$(awk -F'|' -v x="$I4" '$1==x{print $2"|"$9}' "$TMP/A")" 'MOCK_PARTS_ACCEPTED|3' THREE_OF_THREE_MOCK_ONLY
ok "$(awk -F'|' -v x="$I5" '$1==x{print $6"|"$7}' "$TMP/A")" '1|0' FRESH_INFLIGHT_NOT_STALE
ok "$(awk -F'|' -v x="$I6" '$1==x{print $5}' "$TMP/A")" 1 PLANNED_ONLY
ok "$(grep -c '^10000000-' "$TMP/B")" 1 B_ZERO_A_DATA
ok "$(inspect "$RA" "$TA" "$SB" "$PB" | grep -c '^10000000-' || true)" 0 A_CANNOT_FAKE_B_SCOPE
ok "$(inspect "$RB" "$TA" "$SA" "$PA" | grep -c '^10000000-' || true)" 0 B_CANNOT_FAKE_A_SCOPE
ok "$(inspect "$RA" "$TB" "$SC" "$PC" | grep -c '^10000000-' || true)" 0 A_CANNOT_READ_C_TENANT
before=$(sql "SELECT count(*) FROM app_private.messenger_send_plans")
inspect "$RA" "$TA" "$SA" "$PA" >"$TMP/restarted"
ok "$(cmp -s "$TMP/A" "$TMP/restarted" && echo 1 || echo 0)" 1 NEW_CONNECTION_SAME_SNAPSHOT
ok "$(sql "SELECT count(*) FROM app_private.messenger_send_plans")" "$before" READ_ONLY_NO_PLAN_WRITES
# Even a table owner/admin cannot write within the inspector's READ ONLY transaction.
if psql -XAtq -v ON_ERROR_STOP=1 -d "$DB" >"$TMP/blocked" 2>&1 <<SQL
BEGIN;
$READ_ONLY;
INSERT INTO app_private.messenger_send_plans(id,tenant_id,store_id,page_id,sender_hash,binding_version,event_hash,plan_digest,expected_count,status)
VALUES(gen_random_uuid(),'$TA','$SA','$PA','$H',3,'$E','$D',1,'PREPARED');
COMMIT;
SQL
then fail READ_ONLY_TX_ALLOWED_WRITE; fi
grep -qi 'read-only transaction' "$TMP/blocked" || fail EXPECTED_READONLY_TX_ERROR
PASS=$((PASS+1)); echo PASS_READ_ONLY_TRANSACTION_BLOCKS_WRITE
sql "UPDATE app_private.qa_role_page_scopes SET active=false WHERE role_name='$RA'" >/dev/null
ok "$(inspect "$RA" "$TA" "$SA" "$PA" | grep -c '^10000000-' || true)" 0 REVOKED_ROLE_SEES_NO_PLANS
ok "$(sql "SELECT count(*) FROM app_private.messenger_send_parts")" 15 NO_PART_MUTATIONS
echo "PG17_READ_ONLY_RECONCILIATION_TESTS=$PASS"
echo "DISPOSABLE_ONLY=true; HOSTED_WRITES=false; META_SEND=false"
