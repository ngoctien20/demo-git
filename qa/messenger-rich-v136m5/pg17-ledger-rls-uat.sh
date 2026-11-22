#!/usr/bin/env bash
# V21 P1: candidate Messenger plans+parts restricted RLS test.
# Disposable LOCAL GitHub CI only. Not a migration. NO META SEND.
set -euo pipefail
[ "$CI" = true ] && [ "$GITHUB_ACTIONS" = true ] && [ "$T404_DISPOSABLE_PG_QA" = YES ] || exit 2
case "$PGHOST" in 127.0.0.1|localhost) ;; *) echo REFUSE_PGHOST; exit 2;; esac
[ "$PGPORT" = 5432 ] || exit 2
[ -z "$SUPABASE_DB_URL$SUPABASE_ACCESS_TOKEN$DATABASE_URL$PGHOSTADDR" ] || exit 2
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PLAN=$(cd "$ROOT" && node -e 'process.stdout.write(require("./qa/messenger-rich-v136m5/message-attempt-ledger.cjs").SQL.plan)')
RESERVE=$(cd "$ROOT" && node -e 'process.stdout.write(require("./qa/messenger-rich-v136m5/message-attempt-ledger.cjs").SQL.reserve)')
ACCEPT=$(cd "$ROOT" && node -e 'process.stdout.write(require("./qa/messenger-rich-v136m5/message-attempt-ledger.cjs").SQL.accept)')
HOLD=$(cd "$ROOT" && node -e 'process.stdout.write(require("./qa/messenger-rich-v136m5/message-attempt-ledger.cjs").SQL.uncertain)')
CLOSE=$(cd "$ROOT" && node -e 'process.stdout.write(require("./qa/messenger-rich-v136m5/message-attempt-ledger.cjs").SQL.close)')
DB="t404_ledger_rls_$RANDOM$RANDOM"
RA="t404_ledger_a_$RANDOM$RANDOM"; RB="t404_ledger_b_$RANDOM$RANDOM"; RC="t404_ledger_c_$RANDOM$RANDOM"
PW="test_$(openssl rand -hex 20)"
TMP=$(mktemp -d); created=0; roles=0; PASS=0
admin(){ psql -XAtq -v ON_ERROR_STOP=1 -d postgres -c "$1"; }
sql(){ psql -XAtq -v ON_ERROR_STOP=1 -d "$DB" -c "$1"; }
client(){ PGUSER="$1" PGPASSWORD="$PW" psql -XAtq -v ON_ERROR_STOP=1 -d "$DB" -c "$2"; }
cleanup(){
 if [ "$created" = 1 ]; then admin "DROP DATABASE $DB WITH (FORCE)" >/dev/null || true; fi
 if [ "$roles" = 1 ]; then for r in "$RA" "$RB" "$RC"; do admin "DROP ROLE $r" >/dev/null || true; done; fi
 rm -rf "$TMP"
}
trap cleanup EXIT
fail(){ echo "FAIL_$1"; exit 1; }
ok(){ [ "$1" = "$2" ] || fail "$3"; PASS=$((PASS+1)); echo "PASS_$3"; }
deny(){
 local tag="$1" who="$2" query="$3"
 if client "$who" "$query" >"$TMP/error" 2>&1; then fail "$tag"; fi
 grep -Eqi 'row-level security|permission denied|not a member|must be member|cannot set role' "$TMP/error" || { cat "$TMP/error"; fail "BAD_ERROR_$tag"; }
 PASS=$((PASS+1)); echo "PASS_DENY_$tag"
}
TA=11111111-1111-4111-8111-111111111111; TB=22222222-2222-4222-8222-222222222222
SA=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa; SB=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb; SC=cccccccc-cccc-4ccc-8ccc-cccccccccccc
PA=12345678901234567; PB=98765432109876543; PC=88888888888888888
H=$(printf '%064d' 1); E=$(printf '%064d' 2); E2=$(printf '%064d' 3); M1=$(printf '%064d' 8)
B1=$(printf '%064d' 4); B2=$(printf '%064d' 5); PD=$(printf '%064d' 7)
NOW=2026-11-22T12:00:00Z
IA=10000000-0000-4000-8000-000000000001; IB=10000000-0000-4000-8000-000000000002; IC=10000000-0000-4000-8000-000000000003
AA=20000000-0000-4000-8000-000000000001; AB=20000000-0000-4000-8000-000000000002; BA=30000000-0000-4000-8000-000000000001
plan(){
 local who="$1" id="$2" t="$3" s="$4" p="$5" e="$6"
 client "$who" "PREPARE a(uuid,uuid,uuid,text,text,int,text,text,int,text[]) AS $PLAN; EXECUTE a('$id','$t','$s','$p','$H',3,'$e','$PD',2,ARRAY['$B1','$B2']);"
}
part(){
 local who="$1" id="$2" n="$3" lease="$4"
 client "$who" "PREPARE a(uuid,int,uuid,timestamptz) AS $RESERVE; EXECUTE a('$id',$n,'$lease','$NOW');"
}
accept(){
 client "$1" "PREPARE a(uuid,int,uuid,text,timestamptz) AS $ACCEPT; EXECUTE a('$2',$3,'$4','$5','$NOW');"
}
hold(){
 client "$1" "PREPARE a(uuid,int,uuid,timestamptz) AS $HOLD; EXECUTE a('$2',$3,'$4','$NOW');"
}
finish(){
 client "$1" "PREPARE a(uuid,timestamptz) AS $CLOSE; EXECUTE a('$2','$NOW');"
}
admin "CREATE DATABASE $DB" >/dev/null; created=1
admin "CREATE ROLE $RA LOGIN NOINHERIT NOBYPASSRLS PASSWORD '$PW'; CREATE ROLE $RB LOGIN NOINHERIT NOBYPASSRLS PASSWORD '$PW'; CREATE ROLE $RC LOGIN NOINHERIT NOBYPASSRLS PASSWORD '$PW';" >/dev/null; roles=1
sql "CREATE SCHEMA app_private;
 CREATE TABLE app_private.qa_page_bindings(role_name name NOT NULL,tenant_id uuid NOT NULL,store_id uuid NOT NULL,page_id text NOT NULL,active bool NOT NULL DEFAULT true,PRIMARY KEY(role_name,tenant_id,store_id,page_id));
 CREATE TABLE app_private.messenger_send_plans(
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL,store_id uuid NOT NULL,page_id text NOT NULL,sender_hash char(64) NOT NULL,binding_version int NOT NULL,event_hash char(64) NOT NULL,plan_digest char(64) NOT NULL,expected_count int NOT NULL CHECK(expected_count BETWEEN 1 AND 3),status text NOT NULL CHECK(status IN ('PREPARED','MOCK_PARTS_ACCEPTED')),completed_at timestamptz,
  UNIQUE(tenant_id,store_id,page_id,sender_hash,binding_version,event_hash));
 CREATE TABLE app_private.messenger_send_parts(
  plan_id uuid NOT NULL REFERENCES app_private.messenger_send_plans(id),part_no int NOT NULL CHECK(part_no BETWEEN 1 AND 3),
  body_digest char(64) NOT NULL,status text NOT NULL CHECK(status IN ('PLANNED','MAY_HAVE_SENT_HOLD','UNCERTAIN_HOLD','API_ACCEPTED_MOCK')),
  attempt_id uuid,attempted_at timestamptz,held_at timestamptz,provider_mid_digest char(64),confirmed_at timestamptz,
  PRIMARY KEY(plan_id,part_no));
 CREATE UNIQUE INDEX uq_mid ON app_private.messenger_send_parts(plan_id,provider_mid_digest) WHERE provider_mid_digest IS NOT NULL;
 ALTER TABLE app_private.qa_page_bindings ENABLE ROW LEVEL SECURITY;
 ALTER TABLE app_private.qa_page_bindings FORCE ROW LEVEL SECURITY;
 ALTER TABLE app_private.messenger_send_plans ENABLE ROW LEVEL SECURITY;
 ALTER TABLE app_private.messenger_send_plans FORCE ROW LEVEL SECURITY;
 ALTER TABLE app_private.messenger_send_parts ENABLE ROW LEVEL SECURITY;
 ALTER TABLE app_private.messenger_send_parts FORCE ROW LEVEL SECURITY;
 REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
 REVOKE ALL ON app_private.qa_page_bindings,app_private.messenger_send_plans,app_private.messenger_send_parts FROM PUBLIC;
 GRANT USAGE ON SCHEMA app_private TO $RA,$RB,$RC;
 GRANT CONNECT ON DATABASE $DB TO $RA,$RB,$RC;
 GRANT SELECT ON app_private.qa_page_bindings TO $RA,$RB,$RC;
 GRANT SELECT,INSERT,UPDATE ON app_private.messenger_send_plans,app_private.messenger_send_parts TO $RA,$RB,$RC;
 CREATE POLICY bound_self ON app_private.qa_page_bindings FOR SELECT TO $RA,$RB,$RC USING(role_name=CURRENT_USER::name);
 CREATE POLICY plan_select ON app_private.messenger_send_plans FOR SELECT TO $RA,$RB,$RC USING(EXISTS(
 SELECT 1 FROM app_private.qa_page_bindings q WHERE q.role_name=CURRENT_USER::name AND q.active
 AND q.tenant_id=messenger_send_plans.tenant_id AND q.store_id=messenger_send_plans.store_id AND q.page_id=messenger_send_plans.page_id));
 CREATE POLICY plan_insert ON app_private.messenger_send_plans FOR INSERT TO $RA,$RB,$RC WITH CHECK(EXISTS(
 SELECT 1 FROM app_private.qa_page_bindings q WHERE q.role_name=CURRENT_USER::name AND q.active
 AND q.tenant_id=messenger_send_plans.tenant_id AND q.store_id=messenger_send_plans.store_id AND q.page_id=messenger_send_plans.page_id));
 CREATE POLICY plan_update ON app_private.messenger_send_plans FOR UPDATE TO $RA,$RB,$RC
 USING(EXISTS(SELECT 1 FROM app_private.qa_page_bindings q WHERE q.role_name=CURRENT_USER::name AND q.active
 AND q.tenant_id=messenger_send_plans.tenant_id AND q.store_id=messenger_send_plans.store_id AND q.page_id=messenger_send_plans.page_id))
 WITH CHECK(EXISTS(SELECT 1 FROM app_private.qa_page_bindings q WHERE q.role_name=CURRENT_USER::name AND q.active
 AND q.tenant_id=messenger_send_plans.tenant_id AND q.store_id=messenger_send_plans.store_id AND q.page_id=messenger_send_plans.page_id));
 CREATE POLICY part_select ON app_private.messenger_send_parts FOR SELECT TO $RA,$RB,$RC USING(EXISTS(
 SELECT 1 FROM app_private.messenger_send_plans p WHERE p.id=messenger_send_parts.plan_id));
 CREATE POLICY part_insert ON app_private.messenger_send_parts FOR INSERT TO $RA,$RB,$RC WITH CHECK(EXISTS(
 SELECT 1 FROM app_private.messenger_send_plans p WHERE p.id=messenger_send_parts.plan_id));
 CREATE POLICY part_update ON app_private.messenger_send_parts FOR UPDATE TO $RA,$RB,$RC
 USING(EXISTS(SELECT 1 FROM app_private.messenger_send_plans p WHERE p.id=messenger_send_parts.plan_id))
 WITH CHECK(EXISTS(SELECT 1 FROM app_private.messenger_send_plans p WHERE p.id=messenger_send_parts.plan_id));
 INSERT INTO app_private.qa_page_bindings(role_name,tenant_id,store_id,page_id)
 VALUES ('$RA','$TA','$SA','$PA'),('$RB','$TA','$SB','$PB'),('$RC','$TB','$SC','$PC');" >/dev/null
ok "$(sql "SELECT count(*) FROM pg_roles WHERE rolname IN ('$RA','$RB','$RC') AND NOT rolbypassrls AND NOT rolsuper")" 3 THREE_RESTRICTED_LOGIN_ROLES
ok "$(sql "SELECT count(*) FROM pg_class WHERE oid IN('app_private.qa_page_bindings'::regclass,'app_private.messenger_send_plans'::regclass,'app_private.messenger_send_parts'::regclass) AND relrowsecurity AND relforcerowsecurity")" 3 FORCE_RLS_ALL_TABLES
ok "$(plan "$RA" "$IA" "$TA" "$SA" "$PA" "$E" | grep -c '|2')" 1 RESTRICTED_A_PLAN_WITH_PARTS
ok "$(plan "$RB" "$IB" "$TA" "$SB" "$PB" "$E" | grep -c '|2')" 1 SAME_TENANT_STORE_B_PLAN
ok "$(plan "$RC" "$IC" "$TB" "$SC" "$PC" "$E" | grep -c '|2')" 1 OTHER_TENANT_C_PLAN
ok "$(client "$RA" "SELECT count(*) FROM app_private.messenger_send_plans")" 1 A_SEES_ONLY_A_PLAN
ok "$(client "$RB" "SELECT count(*) FROM app_private.messenger_send_parts")" 2 B_SEES_ONLY_B_PARTS
ok "$(client "$RC" "SELECT count(*) FROM app_private.messenger_send_parts")" 2 C_SEES_ONLY_C_PARTS
deny A_CANNOT_FORGE_B_PLAN "$RA" "PREPARE a(uuid,uuid,uuid,text,text,int,text,text,int,text[]) AS $PLAN; EXECUTE a(gen_random_uuid(),'$TA','$SB','$PB','$H',3,'$E2','$PD',2,ARRAY['$B1','$B2'])"
deny A_CANNOT_FORGE_C_PLAN "$RA" "PREPARE a(uuid,uuid,uuid,text,text,int,text,text,int,text[]) AS $PLAN; EXECUTE a(gen_random_uuid(),'$TB','$SC','$PC','$H',3,'$E2','$PD',2,ARRAY['$B1','$B2'])"
deny A_CANNOT_ASSUME_B_ROLE "$RA" "SET ROLE $RB"
deny B_CANNOT_EDIT_BINDING "$RB" "UPDATE app_private.qa_page_bindings SET store_id='$SA'"
ok "$(client "$RB" "SELECT count(*) FROM app_private.messenger_send_parts WHERE plan_id='$IA'")" 0 B_CANNOT_READ_A_PARTS
ok "$(part "$RB" "$IA" 1 "$BA" | grep -c '|MAY_HAVE_SENT_HOLD' || true)" 0 B_CANNOT_RESERVE_A_PART
ok "$(accept "$RB" "$IA" 1 "$AA" "$M1" | grep -c '|API_ACCEPTED_MOCK' || true)" 0 B_CANNOT_ACCEPT_A_MID
ok "$(hold "$RB" "$IA" 1 "$AA" | grep -c '|UNCERTAIN_HOLD' || true)" 0 B_CANNOT_HOLD_A
ok "$(finish "$RB" "$IA" | grep -c '|MOCK_PARTS_ACCEPTED' || true)" 0 B_CANNOT_CLOSE_A
deny B_CANNOT_FORGE_A_PART "$RB" "INSERT INTO app_private.messenger_send_parts(plan_id,part_no,body_digest,status) VALUES('$IA',3,'$B1','PLANNED')"
ok "$(part "$RA" "$IA" 1 "$AA" | grep -c '|MAY_HAVE_SENT_HOLD')" 1 A_RESERVES_OWN_PART
ok "$(accept "$RA" "$IA" 1 "$AA" "$M1" | grep -c '|API_ACCEPTED_MOCK')" 1 A_CAN_ACCEPT_OWN_MOCK
ok "$(part "$RA" "$IA" 2 "$AB" | grep -c '|MAY_HAVE_SENT_HOLD')" 1 A_RESERVES_SECOND_PART
ok "$(hold "$RA" "$IA" 2 "$AB" | grep -c '|UNCERTAIN_HOLD')" 1 A_TIMEOUT_HELD
ok "$(finish "$RA" "$IA" | grep -c '|MOCK_PARTS_ACCEPTED' || true)" 0 PARTIAL_UNCLOSED
deny FAKE_JWT_CANNOT_ESCALATE "$RB" "SELECT set_config('request.jwt.claims','{\"tenant_id\":\"$TA\",\"store_id\":\"$SA\"}',false); PREPARE a(uuid,uuid,uuid,text,text,int,text,text,int,text[]) AS $PLAN; EXECUTE a(gen_random_uuid(),'$TA','$SA','$PA','$H',3,'$E2','$PD',2,ARRAY['$B1','$B2'])"
sql "UPDATE app_private.qa_page_bindings SET active=false WHERE role_name='$RA'" >/dev/null
ok "$(client "$RA" "SELECT count(*) FROM app_private.messenger_send_plans")" 0 REVOKED_PLAN_INVISIBLE
ok "$(client "$RA" "SELECT count(*) FROM app_private.messenger_send_parts")" 0 REVOKED_PARTS_INVISIBLE
ok "$(part "$RA" "$IA" 1 "$BA" | grep -c '|MAY_HAVE_SENT_HOLD' || true)" 0 REVOKED_CANNOT_RESERVE
deny REVOKED_CANNOT_PLAN "$RA" "PREPARE a(uuid,uuid,uuid,text,text,int,text,text,int,text[]) AS $PLAN; EXECUTE a(gen_random_uuid(),'$TA','$SA','$PA','$H',3,'$E2','$PD',2,ARRAY['$B1','$B2'])"
echo "PG17_LEDGER_RESTRICTED_RLS_TESTS=$PASS"
echo "CI_ONLY=true; HOSTED_WRITES=false; META_SEND=false"
