#!/usr/bin/env bash
# V21 claim-bound plan SQL acceptance on local disposable PostgreSQL 17.
# Test real scoped existing claim/lease + restricted RLS, not provider send.
set -euo pipefail
[ "$CI" = true ] && [ "$GITHUB_ACTIONS" = true ] && [ "$T404_DISPOSABLE_PG_QA" = YES ] || exit 2
case "$PGHOST" in 127.0.0.1|localhost) ;; *) echo REFUSE_PGHOST; exit 2;; esac
[ "$PGPORT" = 5432 ] || exit 2
[ -z "$SUPABASE_DB_URL$SUPABASE_ACCESS_TOKEN$DATABASE_URL$PGHOSTADDR" ] || exit 2
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CLAIM=$(cd "$ROOT" && node -e 'process.stdout.write(require("./qa/messenger-rich-v136m5/private-event-store.cjs").SQL.claim)')
GUARD=$(cd "$ROOT" && node -e 'process.stdout.write(require("./qa/messenger-rich-v136m5/claim-bound-plan-contract.cjs").SQL.claimBoundPlan)')
DB="t404_bound_$RANDOM$RANDOM"; RA="t404_bound_a_$RANDOM$RANDOM"; RB="t404_bound_b_$RANDOM$RANDOM"
PASSWORD="local_$(openssl rand -hex 18)"
TMP=$(mktemp -d); db_created=0; roles_created=0; PASS=0
admin(){ psql -XAtq -v ON_ERROR_STOP=1 -d postgres -c "$1"; }
sql(){ psql -XAtq -v ON_ERROR_STOP=1 -d "$DB" -c "$1"; }
client(){ PGUSER="$1" PGPASSWORD="$PASSWORD" psql -XAtq -v ON_ERROR_STOP=1 -d "$DB" -c "$2"; }
cleanup(){
 if [ "$db_created" = 1 ]; then admin "DROP DATABASE $DB WITH (FORCE)" >/dev/null || echo WARN_DB_CLEANUP; fi
 if [ "$roles_created" = 1 ]; then for role in "$RA" "$RB"; do admin "DROP ROLE $role" >/dev/null || echo WARN_ROLE_CLEANUP; done; fi
 rm -rf "$TMP"
}
trap cleanup EXIT
fail(){ echo "FAIL_$1"; exit 1; }
ok(){ [ "$1" = "$2" ] || fail "$3"; PASS=$((PASS+1)); echo "PASS_$3"; }
TA=11111111-1111-4111-8111-111111111111
SA=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa
SB=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb
PA=12345678901234567
PB=98765432109876543
PSA=55555555555555555
PSB=66666666666666666
KEY=$(printf '%064d' 1)
KEY2=$(printf '%064d' 2)
KEY3=$(printf '%064d' 3)
KEY4=$(printf '%064d' 4)
BODY1=$(printf '%064d' 8)
BODY2=$(printf '%064d' 9)
PLANHASH=$(printf '%064d' 7)
LA=10000000-0000-4000-8000-000000000001
LB=10000000-0000-4000-8000-000000000002
LX=10000000-0000-4000-8000-000000000003
LF=10000000-0000-4000-8000-000000000004
NOW=2026-11-22T13:30:00Z
BEFORE=2026-11-22T13:25:00Z
AFTER=2026-11-22T14:30:00Z
STALE=2026-11-22T13:29:59Z
FUTURE=2026-11-22T13:30:01Z
PLANID1=20000000-0000-4000-8000-000000000001
PLANID2=20000000-0000-4000-8000-000000000002
PLANID3=20000000-0000-4000-8000-000000000003

# Derive actual scoped HMAC identifiers with the SAME production-candidate code.
# Secret is synthetic. No raw sender stored in any database table.
read -r SHA_A EV_A < <(cd "$ROOT" && node -e '
 const {deriveIdentity}=require("./qa/messenger-rich-v136m5/private-event-store.cjs");
 const p={source:"SERVER_VERIFIED_MESSENGER_BINDING",serverDerived:true,verified:true,
 tenantId:"11111111-1111-4111-8111-111111111111",
 storeId:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",pageId:"12345678901234567",
 recipientPsid:"55555555555555555",bindingVersion:3};
 const x=deriveIdentity({trusted:p,replayKey:"0000000000000000000000000000000000000000000000000000000000000001",
 secret:"LOCAL_SYNTHETIC_HMAC_SECRET_FOR_BOUND_PG17_TEST_ONLY"});
 console.log(x.senderHash,x.eventHash);')
read -r SHA_B EV_B < <(cd "$ROOT" && node -e '
 const {deriveIdentity}=require("./qa/messenger-rich-v136m5/private-event-store.cjs");
 const p={source:"SERVER_VERIFIED_MESSENGER_BINDING",serverDerived:true,verified:true,
 tenantId:"11111111-1111-4111-8111-111111111111",
 storeId:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",pageId:"98765432109876543",
 recipientPsid:"66666666666666666",bindingVersion:3};
 const x=deriveIdentity({trusted:p,replayKey:"0000000000000000000000000000000000000000000000000000000000000001",
 secret:"LOCAL_SYNTHETIC_HMAC_SECRET_FOR_BOUND_PG17_TEST_ONLY"});
 console.log(x.senderHash,x.eventHash);')
read -r SHA_X EV_X < <(cd "$ROOT" && node -e '
 const {deriveIdentity}=require("./qa/messenger-rich-v136m5/private-event-store.cjs");
 const p={source:"SERVER_VERIFIED_MESSENGER_BINDING",serverDerived:true,verified:true,
 tenantId:"11111111-1111-4111-8111-111111111111",
 storeId:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",pageId:"12345678901234567",
 recipientPsid:"55555555555555555",bindingVersion:3};
 const x=deriveIdentity({trusted:p,replayKey:"0000000000000000000000000000000000000000000000000000000000000002",
 secret:"LOCAL_SYNTHETIC_HMAC_SECRET_FOR_BOUND_PG17_TEST_ONLY"});
 console.log(x.senderHash,x.eventHash);')
# Some additional event fingerprints only need to be distinct test-only SHA.
EV3=$(printf '%064d' 13)
EV4=$(printf '%064d' 14)

admin "CREATE DATABASE $DB" >/dev/null; db_created=1
admin "CREATE ROLE $RA LOGIN NOINHERIT NOBYPASSRLS PASSWORD '$PASSWORD'; CREATE ROLE $RB LOGIN NOINHERIT NOBYPASSRLS PASSWORD '$PASSWORD';" >/dev/null; roles_created=1
sql "CREATE SCHEMA app_private;
 CREATE TABLE app_private.qa_role_scope(role_name name NOT NULL,tenant_id uuid NOT NULL,store_id uuid NOT NULL,page_id text NOT NULL,active boolean NOT NULL DEFAULT true,
 PRIMARY KEY(role_name,tenant_id,store_id,page_id));
 CREATE TABLE app_private.messenger_event_claims(
 tenant_id uuid NOT NULL,store_id uuid NOT NULL,page_id text NOT NULL,sender_hash char(64) NOT NULL,binding_version int NOT NULL,event_hash char(64) NOT NULL,
 status text NOT NULL,lease_id uuid NOT NULL,claimed_at timestamptz NOT NULL,expires_at timestamptz NOT NULL,completed_at timestamptz,
 UNIQUE(tenant_id,store_id,page_id,sender_hash,binding_version,event_hash));
 CREATE TABLE app_private.messenger_send_plans(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,store_id uuid NOT NULL,page_id text NOT NULL,
 sender_hash char(64) NOT NULL,binding_version int NOT NULL,event_hash char(64) NOT NULL,
 plan_digest char(64) NOT NULL,expected_count int NOT NULL CHECK(expected_count BETWEEN 1 AND 3),
 status text NOT NULL CHECK(status IN ('PREPARED','MOCK_PARTS_ACCEPTED')),completed_at timestamptz,
 UNIQUE(tenant_id,store_id,page_id,sender_hash,binding_version,event_hash),
 UNIQUE(id,tenant_id,store_id,page_id));
 CREATE TABLE app_private.messenger_send_parts(
 plan_id uuid NOT NULL,tenant_id uuid NOT NULL,store_id uuid NOT NULL,page_id text NOT NULL,
 part_no int NOT NULL CHECK(part_no BETWEEN 1 AND 3),body_digest char(64) NOT NULL,
 status text NOT NULL CHECK(status IN ('PLANNED','MAY_HAVE_SENT_HOLD','UNCERTAIN_HOLD','API_ACCEPTED_MOCK')),
 attempt_id uuid,attempted_at timestamptz,held_at timestamptz,provider_mid_digest char(64),confirmed_at timestamptz,
 PRIMARY KEY(plan_id,part_no),FOREIGN KEY(plan_id,tenant_id,store_id,page_id)
 REFERENCES app_private.messenger_send_plans(id,tenant_id,store_id,page_id));
 ALTER TABLE app_private.qa_role_scope ENABLE ROW LEVEL SECURITY;
 ALTER TABLE app_private.qa_role_scope FORCE ROW LEVEL SECURITY;
 ALTER TABLE app_private.messenger_event_claims ENABLE ROW LEVEL SECURITY;
 ALTER TABLE app_private.messenger_event_claims FORCE ROW LEVEL SECURITY;
 ALTER TABLE app_private.messenger_send_plans ENABLE ROW LEVEL SECURITY;
 ALTER TABLE app_private.messenger_send_plans FORCE ROW LEVEL SECURITY;
 ALTER TABLE app_private.messenger_send_parts ENABLE ROW LEVEL SECURITY;
 ALTER TABLE app_private.messenger_send_parts FORCE ROW LEVEL SECURITY;
 REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
 REVOKE ALL ON app_private.qa_role_scope,app_private.messenger_event_claims,app_private.messenger_send_plans,app_private.messenger_send_parts FROM PUBLIC;
 GRANT USAGE ON SCHEMA app_private TO $RA,$RB;
 GRANT CONNECT ON DATABASE $DB TO $RA,$RB;
 GRANT SELECT ON app_private.qa_role_scope,app_private.messenger_event_claims TO $RA,$RB;
 GRANT SELECT,INSERT,UPDATE ON app_private.messenger_send_plans,app_private.messenger_send_parts TO $RA,$RB;
 CREATE POLICY role_self ON app_private.qa_role_scope FOR SELECT TO $RA,$RB USING(role_name=CURRENT_USER::name);
 CREATE POLICY claim_select ON app_private.messenger_event_claims FOR SELECT TO $RA,$RB USING(EXISTS(
 SELECT 1 FROM app_private.qa_role_scope r WHERE r.role_name=CURRENT_USER::name AND r.active
 AND r.tenant_id=messenger_event_claims.tenant_id AND r.store_id=messenger_event_claims.store_id AND r.page_id=messenger_event_claims.page_id));
 CREATE POLICY plan_select ON app_private.messenger_send_plans FOR SELECT TO $RA,$RB USING(EXISTS(
 SELECT 1 FROM app_private.qa_role_scope r WHERE r.role_name=CURRENT_USER::name AND r.active
 AND r.tenant_id=messenger_send_plans.tenant_id AND r.store_id=messenger_send_plans.store_id AND r.page_id=messenger_send_plans.page_id));
 CREATE POLICY plan_insert ON app_private.messenger_send_plans FOR INSERT TO $RA,$RB WITH CHECK(EXISTS(
 SELECT 1 FROM app_private.qa_role_scope r WHERE r.role_name=CURRENT_USER::name AND r.active
 AND r.tenant_id=messenger_send_plans.tenant_id AND r.store_id=messenger_send_plans.store_id AND r.page_id=messenger_send_plans.page_id));
 CREATE POLICY plan_update ON app_private.messenger_send_plans FOR UPDATE TO $RA,$RB
 USING(EXISTS(SELECT 1 FROM app_private.qa_role_scope r WHERE r.role_name=CURRENT_USER::name AND r.active
 AND r.tenant_id=messenger_send_plans.tenant_id AND r.store_id=messenger_send_plans.store_id AND r.page_id=messenger_send_plans.page_id))
 WITH CHECK(EXISTS(SELECT 1 FROM app_private.qa_role_scope r WHERE r.role_name=CURRENT_USER::name AND r.active
 AND r.tenant_id=messenger_send_plans.tenant_id AND r.store_id=messenger_send_plans.store_id AND r.page_id=messenger_send_plans.page_id));
 CREATE POLICY part_select ON app_private.messenger_send_parts FOR SELECT TO $RA,$RB USING(EXISTS(
 SELECT 1 FROM app_private.qa_role_scope r WHERE r.role_name=CURRENT_USER::name AND r.active
 AND r.tenant_id=messenger_send_parts.tenant_id AND r.store_id=messenger_send_parts.store_id AND r.page_id=messenger_send_parts.page_id));
 CREATE POLICY part_insert ON app_private.messenger_send_parts FOR INSERT TO $RA,$RB WITH CHECK(EXISTS(
 SELECT 1 FROM app_private.qa_role_scope r WHERE r.role_name=CURRENT_USER::name AND r.active
 AND r.tenant_id=messenger_send_parts.tenant_id AND r.store_id=messenger_send_parts.store_id AND r.page_id=messenger_send_parts.page_id));
 INSERT INTO app_private.qa_role_scope(role_name,tenant_id,store_id,page_id)
 VALUES('$RA','$TA','$SA','$PA'),('$RB','$TA','$SB','$PB');" >/dev/null
claim(){
 local t="$1" s="$2" p="$3" senderhash="$4" eventhash="$5" lease="$6" created="$7" exp="$8"
 sql "PREPARE c(uuid,uuid,text,text,int,text,uuid,timestamptz,timestamptz) AS $CLAIM;
 EXECUTE c('$t','$s','$p','$senderhash',3,'$eventhash','$lease','$created','$exp');"
}
plan(){
 local role="$1" id="$2" t="$3" s="$4" p="$5" senderhash="$6" eventhash="$7" lease="$8"
 client "$role" "PREPARE x(uuid,uuid,uuid,text,text,int,text,text,int,text[],uuid,timestamptz) AS $GUARD;
 EXECUTE x('$id','$t','$s','$p','$senderhash',3,'$eventhash','$PLANHASH',2,ARRAY['$BODY1','$BODY2'],'$lease','$NOW');"
}
ok "$(sql "SELECT count(*) FROM pg_roles WHERE rolname IN ('$RA','$RB') AND NOT rolbypassrls AND NOT rolsuper")" 2 RESTRICTED_ROLES
ok "$(sql "SELECT count(*) FROM pg_class WHERE oid IN('app_private.messenger_event_claims'::regclass,'app_private.messenger_send_plans'::regclass,'app_private.messenger_send_parts'::regclass) AND relrowsecurity AND relforcerowsecurity")" 3 ALL_PRIVATE_TABLES_FORCE_RLS
ok "$(plan "$RA" "$PLANID1" "$TA" "$SA" "$PA" "$SHA_A" "$EV_A" "$LA" | grep -c '|2' || true)" 0 NO_CLAIM_NO_PLAN
ok "$(claim "$TA" "$SA" "$PA" "$SHA_A" "$EV_A" "$LA" "$BEFORE" "$AFTER" | grep -c '|CLAIMED')" 1 CLAIM_WRITTEN_USING_EXISTING_SQL
ok "$(plan "$RA" "$PLANID1" "$TA" "$SA" "$PA" "$SHA_A" "$EV_A" "$LB" | grep -c '|2' || true)" 0 WRONG_LEASE_DENIED
ok "$(plan "$RA" "$PLANID1" "$TA" "$SA" "$PA" "$SHA_A" "$EV_X" "$LA" | grep -c '|2' || true)" 0 WRONG_EVENT_DENIED
ok "$(plan "$RA" "$PLANID1" "$TA" "$SA" "$PA" "$SHA_B" "$EV_A" "$LA" | grep -c '|2' || true)" 0 WRONG_SENDER_DENIED
ok "$(plan "$RA" "$PLANID1" "$TA" "$SA" "$PB" "$SHA_A" "$EV_A" "$LA" | grep -c '|2' || true)" 0 WRONG_PAGE_DENIED
ok "$(plan "$RA" "$PLANID1" "$TA" "$SB" "$PB" "$SHA_A" "$EV_A" "$LA" | grep -c '|2' || true)" 0 WRONG_STORE_DENIED
# Verify the correct binding, lease, time and claim status now allow exactly one plan.
ok "$(plan "$RA" "$PLANID1" "$TA" "$SA" "$PA" "$SHA_A" "$EV_A" "$LA" | grep -c '|2')" 1 REAL_CLAIM_ADMITS_PLAN_ONCE
ok "$(sql "SELECT count(*) FROM app_private.messenger_send_parts WHERE plan_id='$PLANID1'")" 2 ALL_PARTS_ATOMIC
ok "$(plan "$RA" "$PLANID2" "$TA" "$SA" "$PA" "$SHA_A" "$EV_A" "$LA" | grep -c '|2' || true)" 0 DUPLICATE_CANNOT_CREATE_PLAN
ok "$(sql "SELECT count(*) FROM app_private.messenger_send_plans")" 1 ONLY_ONE_PLAN
ok "$(claim "$TA" "$SB" "$PB" "$SHA_B" "$EV_B" "$LB" "$BEFORE" "$AFTER" | grep -c '|CLAIMED')" 1 STORE_B_CLAIM_WRITTEN
ok "$(plan "$RA" "$PLANID2" "$TA" "$SB" "$PB" "$SHA_B" "$EV_B" "$LB" | grep -c '|2' || true)" 0 ROLE_A_CANNOT_BIND_STORE_B
ok "$(plan "$RB" "$PLANID2" "$TA" "$SB" "$PB" "$SHA_B" "$EV_B" "$LA" | grep -c '|2' || true)" 0 STORE_B_WRONG_LEASE
ok "$(plan "$RB" "$PLANID2" "$TA" "$SB" "$PB" "$SHA_B" "$EV_B" "$LB" | grep -c '|2')" 1 STORE_B_VALID_CLAIM_ADMITTED
ok "$(client "$RB" "SELECT count(*) FROM app_private.messenger_send_plans WHERE id='$PLANID1'")" 0 STORE_B_CANNOT_READ_A_PLAN
ok "$(claim "$TA" "$SA" "$PA" "$SHA_X" "$EV_X" "$LX" "$BEFORE" "$STALE" | grep -c '|CLAIMED')" 1 EXPIRED_CLAIM_CREATED
ok "$(plan "$RA" "$PLANID3" "$TA" "$SA" "$PA" "$SHA_X" "$EV_X" "$LX" | grep -c '|2' || true)" 0 EXPIRED_CLAIM_DENIED
# Claim that exists but has already been finalized cannot grant a plan.
ok "$(claim "$TA" "$SA" "$PA" "$SHA_X" "$EV3" "$LF" "$BEFORE" "$AFTER" | grep -c '|CLAIMED')" 1 EXTRA_CLAIM_CREATED
sql "UPDATE app_private.messenger_event_claims SET status='PREVIEW_READY' WHERE event_hash='$EV3'" >/dev/null
ok "$(plan "$RA" "$PLANID3" "$TA" "$SA" "$PA" "$SHA_X" "$EV3" "$LF" | grep -c '|2' || true)" 0 FINALIZED_CLAIM_DENIED
ok "$(sql "SELECT count(*) FROM app_private.messenger_send_plans")" 2 NO_FORGED_PLAN_PERSISTED
echo "PG17_CLAIM_BOUND_PLAN_TESTS=$PASS"
echo "DISPOSABLE_LOCAL_PG17=true; HOSTED_WROTE=false; META_SEND=false"
