#!/usr/bin/env bash
# V21 atomic claim -> plan -> parts -> private HMAC ref: disposable PG17 FORCE RLS QA.
# No Meta Send, Supabase hosted, production credentials, orders or real tenants.
set -euo pipefail
[ "$CI" = true ] && [ "$GITHUB_ACTIONS" = true ] && [ "$T404_DISPOSABLE_PG_QA" = YES ] || exit 2
case "$PGHOST" in localhost|127.0.0.1) ;; *) echo REFUSE_NON_LOCAL; exit 2;; esac
[ "$PGPORT" = 5432 ] || exit 2
[ -z "$SUPABASE_DB_URL$SUPABASE_ACCESS_TOKEN$DATABASE_URL$PGHOSTADDR" ] || exit 2
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ATOMIC=$(cd "$ROOT" && node -e 'process.stdout.write(require("./qa/messenger-rich-v136m5/atomic-claim-plan-private-ref.cjs").SQL.claimPlanPartsAndRef)')
DB="t404_atomic_ref_$RANDOM$RANDOM"
RA="t404_ref_a_$RANDOM$RANDOM"; RB="t404_ref_b_$RANDOM$RANDOM"; RO="t404_ref_viewer_$RANDOM$RANDOM"
PW="offline_$(openssl rand -hex 18)"
TMP=$(mktemp -d); created=0; roles=0; PASS=0
admin(){ psql -XAtq -v ON_ERROR_STOP=1 -d postgres -c "$1"; }
sql(){ psql -XAtq -v ON_ERROR_STOP=1 -d "$DB" -c "$1"; }
client(){ PGUSER="$1" PGPASSWORD="$PW" psql -XAtq -v ON_ERROR_STOP=1 -d "$DB" -c "$2"; }
cleanup(){
 if [ "$created" = 1 ]; then admin "DROP DATABASE $DB WITH (FORCE)" >/dev/null || true; fi
 if [ "$roles" = 1 ]; then for r in "$RA" "$RB" "$RO"; do admin "DROP ROLE $r" >/dev/null || true; done; fi
 rm -rf "$TMP"
}
trap cleanup EXIT
fail(){ echo "FAIL_$1"; exit 1; }
ok(){ [ "$1" = "$2" ] || fail "$3"; PASS=$((PASS+1)); echo "PASS_$3"; }
deny(){
 local label="$1" who="$2" statement="$3"
 if client "$who" "$statement" >"$TMP/deny" 2>&1; then fail "$label"; fi
 grep -Eqi 'row-level security|permission denied|must be member|not a member' "$TMP/deny" || { cat "$TMP/deny"; fail "UNEXPECTED_DENIAL"; }
 PASS=$((PASS+1)); echo "PASS_DENY_$label"
}
TA=11111111-1111-4111-8111-111111111111
SA=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa
SB=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb
PA=12345678901234567
PB=98765432109876543
H=$(printf '%064d' 1)
E=$(printf '%064d' 2)
E2=$(printf '%064d' 3)
E3=$(printf '%064d' 4)
E4=$(printf '%064d' 5)
E5=$(printf '%064d' 10)
E6=$(printf '%064d' 11)
E7=$(printf '%064d' 12)
E8=$(printf '%064d' 13)
E9=$(printf '%064d' 14)
D=$(printf '%064d' 6)
B1=$(printf '%064d' 7)
B2=$(printf '%064d' 8)
NOW=2026-11-22T14:00:00Z
EXP=2026-11-29T14:00:00Z
I1=10000000-0000-4000-8000-000000000001
I2=10000000-0000-4000-8000-000000000002
I3=10000000-0000-4000-8000-000000000003
I4=10000000-0000-4000-8000-000000000004
I5=10000000-0000-4000-8000-000000000005
I6=10000000-0000-4000-8000-000000000006
I7=10000000-0000-4000-8000-000000000007
I8=10000000-0000-4000-8000-000000000008
I9=10000000-0000-4000-8000-000000000009
I10=10000000-0000-4000-8000-000000000010
L1=20000000-0000-4000-8000-000000000001
L2=20000000-0000-4000-8000-000000000002
L3=20000000-0000-4000-8000-000000000003
L4=20000000-0000-4000-8000-000000000004
L5=20000000-0000-4000-8000-000000000005
L6=20000000-0000-4000-8000-000000000006
L8=20000000-0000-4000-8000-000000000008
L9=20000000-0000-4000-8000-000000000009
L10=20000000-0000-4000-8000-000000000010
ref_for(){
 REF_PLAN="$1" REF_STORE="$2" REF_PAGE="$3" node -e '
 const {createHmac}=require("node:crypto");
 const v=[process.env.REF_TENANT||"11111111-1111-4111-8111-111111111111",
 process.env.REF_STORE,process.env.REF_PAGE,process.env.REF_PLAN];
 process.stdout.write(createHmac("sha256","SYNTHETIC_OPERATOR_REFERENCE_SECRET_FOR_QA_404")
 .update("tien404/messenger/reconcile/ref/v1\0"+v.join("|")).digest("hex").slice(0,32));
 '
}
stmt(){
 local id="$1" store="$2" page="$3" event="$4" lease="$5" ref
 ref=$(ref_for "$id" "$store" "$page")
 printf "PREPARE qa(uuid,uuid,uuid,text,text,int,text,text,int,text[],uuid,timestamptz,timestamptz,text) AS %s; EXECUTE qa('%s','%s','%s','%s','%s',3,'%s','%s',2,ARRAY['%s','%s'],'%s','%s','%s','%s');" \
 "$ATOMIC" "$id" "$TA" "$store" "$page" "$H" "$event" "$D" "$B1" "$B2" "$lease" "$NOW" "$EXP" "$ref"
}
attempt(){ client "$1" "$(stmt "$2" "$3" "$4" "$5" "$6")"; }
stmt_n(){
 local id="$1" store="$2" page="$3" event="$4" lease="$5" count="$6" ref parts
 ref=$(ref_for "$id" "$store" "$page")
 case "$count" in
  1) parts="ARRAY['$B1']" ;;
  3) parts="ARRAY['$B1','$B2','$B1']" ;;
  *) echo DENY_COUNT; return 2 ;;
 esac
 printf "PREPARE qn(uuid,uuid,uuid,text,text,int,text,text,int,text[],uuid,timestamptz,timestamptz,text) AS %s; EXECUTE qn('%s','%s','%s','%s','%s',3,'%s','%s',%s,%s,'%s','%s','%s','%s');" \
 "$ATOMIC" "$id" "$TA" "$store" "$page" "$H" "$event" "$D" "$count" "$parts" "$lease" "$NOW" "$EXP" "$ref"
}


admin "CREATE DATABASE $DB" >/dev/null; created=1
admin "CREATE ROLE $RA LOGIN NOINHERIT NOBYPASSRLS PASSWORD '$PW';
 CREATE ROLE $RB LOGIN NOINHERIT NOBYPASSRLS PASSWORD '$PW';
 CREATE ROLE $RO LOGIN NOINHERIT NOBYPASSRLS PASSWORD '$PW';" >/dev/null; roles=1
sql "CREATE SCHEMA app_private;
 CREATE TABLE app_private.qa_scope(role_name name NOT NULL,tenant_id uuid NOT NULL,store_id uuid NOT NULL,page_id text NOT NULL,active bool NOT NULL DEFAULT true,PRIMARY KEY(role_name,tenant_id,store_id,page_id));
 CREATE TABLE app_private.messenger_event_claims(
 tenant_id uuid NOT NULL,store_id uuid NOT NULL,page_id text NOT NULL,sender_hash char(64) NOT NULL,binding_version int NOT NULL,event_hash char(64) NOT NULL,
 status text NOT NULL,lease_id uuid NOT NULL,claimed_at timestamptz NOT NULL,expires_at timestamptz NOT NULL,completed_at timestamptz,
 UNIQUE(tenant_id,store_id,page_id,sender_hash,binding_version,event_hash));
 CREATE TABLE app_private.messenger_send_plans(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,store_id uuid NOT NULL,page_id text NOT NULL,sender_hash char(64) NOT NULL,binding_version int NOT NULL,event_hash char(64) NOT NULL,
 plan_digest char(64) NOT NULL,expected_count int NOT NULL CHECK(expected_count BETWEEN 1 AND 3),status text NOT NULL,completed_at timestamptz,
 UNIQUE(tenant_id,store_id,page_id,sender_hash,binding_version,event_hash),
 UNIQUE(id,tenant_id,store_id,page_id));
 CREATE TABLE app_private.messenger_send_parts(
 plan_id uuid NOT NULL,tenant_id uuid NOT NULL,store_id uuid NOT NULL,page_id text NOT NULL,part_no int NOT NULL CHECK(part_no BETWEEN 1 AND 3),body_digest char(64) NOT NULL,
 status text NOT NULL,attempt_id uuid,attempted_at timestamptz,held_at timestamptz,provider_mid_digest char(64),confirmed_at timestamptz,
 PRIMARY KEY(plan_id,part_no),
 FOREIGN KEY(plan_id,tenant_id,store_id,page_id)
 REFERENCES app_private.messenger_send_plans(id,tenant_id,store_id,page_id));
 CREATE TABLE app_private.messenger_reconciliation_refs(
 reference char(32) PRIMARY KEY,
 plan_id uuid NOT NULL,tenant_id uuid NOT NULL,store_id uuid NOT NULL,page_id text NOT NULL,
 UNIQUE(plan_id,tenant_id,store_id,page_id),
 FOREIGN KEY(plan_id,tenant_id,store_id,page_id)
 REFERENCES app_private.messenger_send_plans(id,tenant_id,store_id,page_id));
 ALTER TABLE app_private.messenger_reconciliation_refs ENABLE ROW LEVEL SECURITY;
 ALTER TABLE app_private.messenger_reconciliation_refs FORCE ROW LEVEL SECURITY;
 ALTER TABLE app_private.qa_scope ENABLE ROW LEVEL SECURITY;
 ALTER TABLE app_private.qa_scope FORCE ROW LEVEL SECURITY;
 ALTER TABLE app_private.messenger_event_claims ENABLE ROW LEVEL SECURITY;
 ALTER TABLE app_private.messenger_event_claims FORCE ROW LEVEL SECURITY;
 ALTER TABLE app_private.messenger_send_plans ENABLE ROW LEVEL SECURITY;
 ALTER TABLE app_private.messenger_send_plans FORCE ROW LEVEL SECURITY;
 ALTER TABLE app_private.messenger_send_parts ENABLE ROW LEVEL SECURITY;
 ALTER TABLE app_private.messenger_send_parts FORCE ROW LEVEL SECURITY;
 REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
 REVOKE ALL ON app_private.qa_scope,app_private.messenger_event_claims,app_private.messenger_send_plans,app_private.messenger_send_parts,app_private.messenger_reconciliation_refs FROM PUBLIC;
 GRANT USAGE ON SCHEMA app_private TO $RA,$RB,$RO;
 GRANT SELECT ON app_private.qa_scope TO $RA,$RB;
 GRANT SELECT,INSERT ON app_private.messenger_event_claims,app_private.messenger_send_plans,app_private.messenger_send_parts,app_private.messenger_reconciliation_refs TO $RA,$RB;
 GRANT SELECT ON app_private.messenger_reconciliation_refs TO $RO;
 CREATE POLICY scope_self ON app_private.qa_scope FOR SELECT TO $RA,$RB USING(role_name=CURRENT_USER::name);
 CREATE POLICY claim_read ON app_private.messenger_event_claims FOR SELECT TO $RA,$RB USING(EXISTS(SELECT 1 FROM app_private.qa_scope q WHERE q.role_name=CURRENT_USER::name AND q.active AND q.tenant_id=messenger_event_claims.tenant_id AND q.store_id=messenger_event_claims.store_id AND q.page_id=messenger_event_claims.page_id));
 CREATE POLICY claim_insert ON app_private.messenger_event_claims FOR INSERT TO $RA,$RB WITH CHECK(EXISTS(SELECT 1 FROM app_private.qa_scope q WHERE q.role_name=CURRENT_USER::name AND q.active AND q.tenant_id=messenger_event_claims.tenant_id AND q.store_id=messenger_event_claims.store_id AND q.page_id=messenger_event_claims.page_id));
 CREATE POLICY plan_read ON app_private.messenger_send_plans FOR SELECT TO $RA,$RB USING(EXISTS(SELECT 1 FROM app_private.qa_scope q WHERE q.role_name=CURRENT_USER::name AND q.active AND q.tenant_id=messenger_send_plans.tenant_id AND q.store_id=messenger_send_plans.store_id AND q.page_id=messenger_send_plans.page_id));
 CREATE POLICY plan_insert ON app_private.messenger_send_plans FOR INSERT TO $RA,$RB WITH CHECK(EXISTS(SELECT 1 FROM app_private.qa_scope q WHERE q.role_name=CURRENT_USER::name AND q.active AND q.tenant_id=messenger_send_plans.tenant_id AND q.store_id=messenger_send_plans.store_id AND q.page_id=messenger_send_plans.page_id));
 CREATE POLICY part_read ON app_private.messenger_send_parts FOR SELECT TO $RA,$RB USING(EXISTS(SELECT 1 FROM app_private.qa_scope q WHERE q.role_name=CURRENT_USER::name AND q.active AND q.tenant_id=messenger_send_parts.tenant_id AND q.store_id=messenger_send_parts.store_id AND q.page_id=messenger_send_parts.page_id));
 CREATE POLICY part_insert ON app_private.messenger_send_parts FOR INSERT TO $RA,$RB WITH CHECK(EXISTS(SELECT 1 FROM app_private.qa_scope q WHERE q.role_name=CURRENT_USER::name AND q.active AND q.tenant_id=messenger_send_parts.tenant_id AND q.store_id=messenger_send_parts.store_id AND q.page_id=messenger_send_parts.page_id));
 CREATE POLICY ref_read ON app_private.messenger_reconciliation_refs FOR SELECT TO $RA,$RB
 USING(EXISTS(SELECT 1 FROM app_private.qa_scope q WHERE q.role_name=CURRENT_USER::name AND q.active
 AND q.tenant_id=messenger_reconciliation_refs.tenant_id
 AND q.store_id=messenger_reconciliation_refs.store_id
 AND q.page_id=messenger_reconciliation_refs.page_id));
 CREATE POLICY ref_insert ON app_private.messenger_reconciliation_refs FOR INSERT TO $RA,$RB
 WITH CHECK(EXISTS(SELECT 1 FROM app_private.qa_scope q WHERE q.role_name=CURRENT_USER::name AND q.active
 AND q.tenant_id=messenger_reconciliation_refs.tenant_id
 AND q.store_id=messenger_reconciliation_refs.store_id
 AND q.page_id=messenger_reconciliation_refs.page_id));
 INSERT INTO app_private.qa_scope(role_name,tenant_id,store_id,page_id) VALUES('$RA','$TA','$SA','$PA'),('$RB','$TA','$SB','$PB');" >/dev/null

ok "$(sql "SELECT count(*) FROM pg_roles WHERE rolname IN ('$RA','$RB','$RO') AND NOT rolbypassrls AND NOT rolsuper")" 3 RESTRICTED_ROLES_AND_VIEWER
ok "$(sql "SELECT count(*) FROM pg_class WHERE oid IN('app_private.messenger_event_claims'::regclass,'app_private.messenger_send_plans'::regclass,'app_private.messenger_send_parts'::regclass,'app_private.messenger_reconciliation_refs'::regclass) AND relrowsecurity AND relforcerowsecurity")" 4 TABLES_FORCE_RLS
ok "$(attempt "$RA" "$I1" "$SA" "$PA" "$E" "$L1" | grep -c '|2')" 1 A_ATOMIC_CLAIM_PLAN_AND_TWO_PARTS
ok "$(sql "SELECT count(*) FROM app_private.messenger_event_claims")" 1 CLAIM_COMMITTED
ok "$(sql "SELECT count(*) FROM app_private.messenger_send_plans")" 1 PLAN_COMMITTED
ok "$(sql "SELECT count(*) FROM app_private.messenger_send_parts")" 2 TWO_PARTS_COMMITTED
ok "$(sql "SELECT count(*) FROM app_private.messenger_reconciliation_refs")" 1 ONE_PRIVATE_REFERENCE_COMMITTED
ok "$(sql "SELECT count(*) FROM app_private.messenger_reconciliation_refs WHERE reference='$(ref_for "$I1" "$SA" "$PA")' AND plan_id='$I1'")" 1 EXACT_HMAC_REFERENCE_PARITY
ok "$(sql "SELECT count(*) FROM app_private.messenger_reconciliation_refs r JOIN app_private.messenger_send_plans p ON p.id=r.plan_id AND p.tenant_id=r.tenant_id AND p.store_id=r.store_id AND p.page_id=r.page_id")" 1 REFERENCE_MATCHES_PLAN_COMPOSITE_SCOPE
ok "$(attempt "$RA" "$I2" "$SA" "$PA" "$E" "$L2" | grep -c '|2' || true)" 0 REPLAY_BLOCKED
ok "$(sql "SELECT count(*) FROM app_private.messenger_event_claims")" 1 NO_DUPLICATE_CLAIM
ok "$(client "$RB" "SELECT count(*) FROM app_private.messenger_send_plans")" 0 B_CANNOT_VIEW_A
ok "$(client "$RB" "SELECT count(*) FROM app_private.messenger_reconciliation_refs")" 0 B_CANNOT_VIEW_A_REFERENCE
deny OPERATOR_CANNOT_MINT_REFERENCE "$RO" "INSERT INTO app_private.messenger_reconciliation_refs(reference,plan_id,tenant_id,store_id,page_id) VALUES('$(printf '%032d' 1)','$I1','$TA','$SA','$PA')"
deny B_CANNOT_CLAIM_A "$RB" "$(stmt "$I2" "$SA" "$PA" "$E2" "$L2")"
deny A_CANNOT_CLAIM_B "$RA" "$(stmt "$I2" "$SB" "$PB" "$E2" "$L2")"
ok "$(attempt "$RB" "$I2" "$SB" "$PB" "$E" "$L2" | grep -c '|2')" 1 B_SAME_TENANT_SEPARATE
ok "$(client "$RA" "SELECT count(*) FROM app_private.messenger_send_parts")" 2 A_CANNOT_VIEW_B_PARTS

# Transaction rollback simulates worker death after SQL but BEFORE COMMIT.
if PGUSER="$RA" PGPASSWORD="$PW" psql -XAtq -v ON_ERROR_STOP=1 -d "$DB" >"$TMP/crash" 2>&1 <<SQL
BEGIN;
$(stmt "$I3" "$SA" "$PA" "$E3" "$L3")
SELECT 1/0;
COMMIT;
SQL
then fail EXPECTED_ROLLBACK_EXCEPTION; fi
grep -qi 'division by zero' "$TMP/crash" || fail ROLLBACK_FAILURE_WRONG_REASON
ok "$(sql "SELECT count(*) FROM app_private.messenger_event_claims WHERE event_hash='$E3'")" 0 CRASH_ROLLED_BACK_CLAIM
ok "$(sql "SELECT count(*) FROM app_private.messenger_send_plans WHERE event_hash='$E3'")" 0 CRASH_ROLLED_BACK_PLAN
ok "$(sql "SELECT count(*) FROM app_private.messenger_reconciliation_refs WHERE plan_id='$I3'")" 0 CRASH_ROLLED_BACK_PRIVATE_REFERENCE
ok "$(attempt "$RA" "$I3" "$SA" "$PA" "$E3" "$L3" | grep -c '|2')" 1 RESTART_AFTER_ROLLBACK_WORKS
ok "$(sql "SELECT count(*) FROM app_private.messenger_reconciliation_refs WHERE plan_id='$I3'")" 1 RESTART_PRIVATE_REFERENCE_COMMITTED
ok "$(attempt "$RA" "$I4" "$SA" "$PA" "$E3" "$L4" | grep -c '|2' || true)" 0 RESTART_AFTER_COMMIT_HOLD

# Claim retention may remove historical claim but older plan survives: never
# mint a fresh claim for the same event identity.
sql "DELETE FROM app_private.messenger_event_claims WHERE event_hash='$E3'" >/dev/null
ok "$(attempt "$RA" "$I4" "$SA" "$PA" "$E3" "$L4" | grep -c '|2' || true)" 0 STALE_PLAN_BLOCKS_NEW_CLAIM
ok "$(sql "SELECT count(*) FROM app_private.messenger_event_claims WHERE event_hash='$E3'")" 0 NO_ORPHAN_CLAIM

# Two independent restricted PostgreSQL clients compete for one event.
# A successful commit owns both claim and reply plan; the other MUST wait
# at the unique claim key and then insert zero rows.
race(){
 local id="$1" lease="$2" pause="$3"
 PGUSER="$RA" PGPASSWORD="$PW" psql -XAtq -v ON_ERROR_STOP=1 -d "$DB" <<SQL >"$TMP/race_$id" 2>&1
BEGIN;
$(stmt "$id" "$SA" "$PA" "$E5" "$lease")
SELECT pg_sleep($pause);
COMMIT;
SQL
}
race "$I5" "$L5" 1.3 &
race_a=$!
sleep 0.2
race "$I6" "$L6" 0 &
race_b=$!
wait "$race_a";wait "$race_b"
ok "$(grep -h -c '|2' "$TMP"/race_* | awk '{n+=$1}END{print n+0}')" 1 TWO_PG_CLIENTS_ONE_ATOMIC_WINNER
ok "$(sql "SELECT count(*) FROM app_private.messenger_event_claims WHERE event_hash='$E5'")" 1 RACING_ONE_CLAIM
ok "$(sql "SELECT count(*) FROM app_private.messenger_send_plans WHERE event_hash='$E5'")" 1 RACING_ONE_PLAN
ok "$(sql "SELECT count(*) FROM app_private.messenger_reconciliation_refs r JOIN app_private.messenger_send_plans p ON p.id=r.plan_id WHERE p.event_hash='$E5'")" 1 RACING_ONE_PRIVATE_REFERENCE
ok "$(sql "SELECT count(*) FROM app_private.messenger_send_parts sp JOIN app_private.messenger_send_plans p ON p.id=sp.plan_id WHERE p.event_hash='$E5'")" 2 RACING_TWO_PARTS_ONLY

# Collision with an already assigned opaque reference MUST roll back claim,
# plan and child parts. Simulate driver on 0 mapping rows by aborting transaction
# inside it. A committed 0-row SQL statement WITHOUT this rollback is unsafe.
sql "INSERT INTO app_private.messenger_send_plans(id,tenant_id,store_id,page_id,sender_hash,binding_version,event_hash,plan_digest,expected_count,status) VALUES('$I7','$TA','$SA','$PA','$H',3,'$E6','$D',2,'PREPARED')" >/dev/null
collision_ref=$(ref_for "$I8" "$SA" "$PA")
sql "INSERT INTO app_private.messenger_reconciliation_refs(reference,plan_id,tenant_id,store_id,page_id) VALUES('$collision_ref','$I7','$TA','$SA','$PA')" >/dev/null
if PGUSER="$RA" PGPASSWORD="$PW" psql -XAtq -v ON_ERROR_STOP=1 -d "$DB" >"$TMP/collision" 2>&1 <<SQL
BEGIN;
$(stmt "$I8" "$SA" "$PA" "$E7" "$L8")
SELECT 1/0;
COMMIT;
SQL
then fail REF_COLLISION_SHOULD_ROLLBACK; fi
grep -qi 'division by zero' "$TMP/collision" || fail COLLISION_ROLLBACK_NOT_CONFIRMED
ok "$(grep -c '|2' "$TMP/collision" || true)" 0 REF_CONFLICT_SQL_RETURNS_ZERO
ok "$(sql "SELECT count(*) FROM app_private.messenger_event_claims WHERE event_hash='$E7'")" 0 REF_CONFLICT_NO_ORPHAN_CLAIM
ok "$(sql "SELECT count(*) FROM app_private.messenger_send_plans WHERE id='$I8'")" 0 REF_CONFLICT_NO_ORPHAN_PLAN
ok "$(sql "SELECT count(*) FROM app_private.messenger_send_parts WHERE plan_id='$I8'")" 0 REF_CONFLICT_NO_ORPHAN_PARTS
ok "$(sql "SELECT count(*) FROM app_private.messenger_reconciliation_refs WHERE plan_id='$I8'")" 0 REF_CONFLICT_NO_NEW_REFERENCE
ok "$(sql "SELECT count(*) FROM app_private.messenger_reconciliation_refs WHERE reference='$collision_ref' AND plan_id='$I7'")" 1 ORIGINAL_REFERENCE_UNCHANGED

# Verify 1 and 3-part message construction also creates exactly one map each.
ok "$(client "$RA" "$(stmt_n "$I9" "$SA" "$PA" "$E8" "$L9" 1)" | grep -c '|1')" 1 ONE_PART_ATOMIC_MAP_ACCEPTED
ok "$(client "$RA" "$(stmt_n "$I10" "$SA" "$PA" "$E9" "$L10" 3)" | grep -c '|3')" 1 THREE_PART_ATOMIC_MAP_ACCEPTED
ok "$(sql "SELECT count(*) FROM app_private.messenger_send_parts WHERE plan_id='$I9'")" 1 ONE_PART_WRITTEN
ok "$(sql "SELECT count(*) FROM app_private.messenger_send_parts WHERE plan_id='$I10'")" 3 THREE_PARTS_WRITTEN
ok "$(sql "SELECT count(*) FROM app_private.messenger_reconciliation_refs WHERE plan_id IN ('$I9','$I10')")" 2 ONE_PRIVATE_MAP_PER_EXTRA_PLAN

sql "UPDATE app_private.qa_scope SET active=false WHERE role_name='$RA'" >/dev/null
ok "$(client "$RA" "SELECT count(*) FROM app_private.messenger_send_plans")" 0 REVOKED_CANNOT_VIEW_OLD
deny REVOKED_CANNOT_CREATE "$RA" "$(stmt "$I4" "$SA" "$PA" "$E4" "$L4")"
ok "$(sql "SELECT count(*) FROM app_private.messenger_event_claims WHERE event_hash='$E4'")" 0 REVOKED_NO_CLAIM_WRITTEN

echo "PG17_ATOMIC_PRIVATE_REF_TESTS=$PASS"
echo "DISPOSABLE=true; HOSTED_WRITES=false; META_SEND=false"
