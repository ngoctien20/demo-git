#!/usr/bin/env bash
# Real restricted PostgreSQL 17 roles, synthetic claims. Disposable CI ONLY.
set -euo pipefail
[ "$CI" = true ] && [ "$GITHUB_ACTIONS" = true ] && [ "$T404_DISPOSABLE_PG_QA" = YES ] || exit 2
case "$PGHOST" in 127.0.0.1|localhost) ;; *) echo REFUSE_HOST; exit 2;; esac
[ "$PGPORT" = 5432 ] || exit 2
[ -z "$SUPABASE_DB_URL$SUPABASE_ACCESS_TOKEN$DATABASE_URL$PGHOSTADDR" ] || exit 2
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CLAIM=$(cd "$ROOT" && node -e 'process.stdout.write(require("./qa/messenger-rich-v136m5/private-event-store.cjs").SQL.claim)')
FINAL=$(cd "$ROOT" && node -e 'process.stdout.write(require("./qa/messenger-rich-v136m5/private-event-store.cjs").SQL.finalize)')
DB="t404_rls_$RANDOM$RANDOM"; RA="t404_a_$RANDOM$RANDOM"; RB="t404_b_$RANDOM$RANDOM"; RC="t404_c_$RANDOM$RANDOM"
PW="offline_$(openssl rand -hex 18)"
TEMP=$(mktemp -d); made_db=0; made_roles=0; PASS=0
admin(){ psql -XAtq -v ON_ERROR_STOP=1 -d postgres -c "$1"; }
sql(){ psql -XAtq -v ON_ERROR_STOP=1 -d "$DB" -c "$1"; }
client(){
 local who="$1" stmt="$2"
 PGUSER="$who" PGPASSWORD="$PW" psql -XAtq -v ON_ERROR_STOP=1 -d "$DB" -c "$stmt"
}
cleanup(){
 if [ "$made_db" = 1 ]; then admin "DROP DATABASE $DB WITH (FORCE)" >/dev/null || true; fi
 if [ "$made_roles" = 1 ]; then for r in "$RA" "$RB" "$RC"; do admin "DROP ROLE $r" >/dev/null || true; done; fi
 rm -rf "$TEMP"
}
trap cleanup EXIT
fail(){ echo "FAIL_$1"; exit 1; }
ok(){ [ "$1" = "$2" ] || fail "$3"; PASS=$((PASS+1)); echo "PASS_$3"; }
deny(){
 local tag="$1" role="$2" statement="$3"
 if client "$role" "$statement" >"$TEMP/denied" 2>&1; then fail "$tag"; fi
 grep -Eqi 'row-level security|permission denied|not a member|must be member|cannot set role' "$TEMP/denied" || fail "UNEXPECTED_DB_ERROR"
 PASS=$((PASS+1)); echo "PASS_DENY_$tag"
}
TA=11111111-1111-4111-8111-111111111111; TB=22222222-2222-4222-8222-222222222222
SA=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa; SB=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb; SC=cccccccc-cccc-4ccc-8ccc-cccccccccccc
PA=12345678901234567; PB=98765432109876543; PC=88888888888888888
H=$(printf '%064d' 1); E=$(printf '%064d' 2); E2=$(printf '%064d' 3)
LA=10000000-0000-4000-8000-000000000001; LB=10000000-0000-4000-8000-000000000002; LC=10000000-0000-4000-8000-000000000003
START=2026-11-22T11:30:00Z; EXPIRES=2026-11-29T11:30:00Z
claim(){
 local who="$1" t="$2" s="$3" p="$4" event="$5" lease="$6"
 client "$who" "PREPARE c(uuid,uuid,text,text,int,text,uuid,timestamptz,timestamptz) AS $CLAIM;
 EXECUTE c('$t','$s','$p','$H',3,'$event','$lease','$START','$EXPIRES');"
}
finish(){
 local who="$1" t="$2" s="$3" p="$4" lease="$5"
 client "$who" "PREPARE f(uuid,uuid,text,text,int,text,uuid,text,timestamptz) AS $FINAL;
 EXECUTE f('$t','$s','$p','$H',3,'$E','$lease','PREVIEW_READY','$START');"
}
admin "CREATE DATABASE $DB" >/dev/null; made_db=1
admin "CREATE ROLE $RA LOGIN NOINHERIT NOBYPASSRLS PASSWORD '$PW';
 CREATE ROLE $RB LOGIN NOINHERIT NOBYPASSRLS PASSWORD '$PW';
 CREATE ROLE $RC LOGIN NOINHERIT NOBYPASSRLS PASSWORD '$PW';" >/dev/null; made_roles=1
sql "CREATE SCHEMA app_private;
 CREATE TABLE app_private.messenger_event_claims (
 tenant_id uuid NOT NULL, store_id uuid NOT NULL, page_id text NOT NULL,
 sender_hash char(64) NOT NULL, binding_version int NOT NULL,
 event_hash char(64) NOT NULL, status text NOT NULL,
 lease_id uuid NOT NULL, claimed_at timestamptz NOT NULL,
 completed_at timestamptz, expires_at timestamptz NOT NULL,
 UNIQUE(tenant_id,store_id,page_id,sender_hash,binding_version,event_hash));
 CREATE TABLE app_private.qa_claim_role_scope (
 role_name name NOT NULL, tenant_id uuid NOT NULL, store_id uuid NOT NULL,
 page_id text NOT NULL, active bool NOT NULL DEFAULT true,
 PRIMARY KEY(role_name,tenant_id,store_id,page_id));
 ALTER TABLE app_private.messenger_event_claims ENABLE ROW LEVEL SECURITY;
 ALTER TABLE app_private.messenger_event_claims FORCE ROW LEVEL SECURITY;
 ALTER TABLE app_private.qa_claim_role_scope ENABLE ROW LEVEL SECURITY;
 ALTER TABLE app_private.qa_claim_role_scope FORCE ROW LEVEL SECURITY;
 REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
 REVOKE ALL ON app_private.messenger_event_claims FROM PUBLIC;
 REVOKE ALL ON app_private.qa_claim_role_scope FROM PUBLIC;
 GRANT USAGE ON SCHEMA app_private TO $RA,$RB,$RC;
 GRANT CONNECT ON DATABASE $DB TO $RA,$RB,$RC;
 GRANT SELECT,INSERT,UPDATE ON app_private.messenger_event_claims TO $RA,$RB,$RC;
 GRANT SELECT ON app_private.qa_claim_role_scope TO $RA,$RB,$RC;
 CREATE POLICY role_scope_self ON app_private.qa_claim_role_scope
 FOR SELECT TO $RA,$RB,$RC USING (role_name=CURRENT_USER::name);
 CREATE POLICY claim_read ON app_private.messenger_event_claims
 FOR SELECT TO $RA,$RB,$RC USING (EXISTS
 (SELECT 1 FROM app_private.qa_claim_role_scope r WHERE r.role_name=CURRENT_USER::name
  AND r.tenant_id=messenger_event_claims.tenant_id
  AND r.store_id=messenger_event_claims.store_id
  AND r.page_id=messenger_event_claims.page_id AND r.active));
 CREATE POLICY claim_add ON app_private.messenger_event_claims
 FOR INSERT TO $RA,$RB,$RC WITH CHECK (EXISTS
 (SELECT 1 FROM app_private.qa_claim_role_scope r WHERE r.role_name=CURRENT_USER::name
  AND r.tenant_id=messenger_event_claims.tenant_id
  AND r.store_id=messenger_event_claims.store_id
  AND r.page_id=messenger_event_claims.page_id AND r.active));
 CREATE POLICY claim_edit ON app_private.messenger_event_claims
 FOR UPDATE TO $RA,$RB,$RC USING (EXISTS
 (SELECT 1 FROM app_private.qa_claim_role_scope r WHERE r.role_name=CURRENT_USER::name
  AND r.tenant_id=messenger_event_claims.tenant_id
  AND r.store_id=messenger_event_claims.store_id
  AND r.page_id=messenger_event_claims.page_id AND r.active))
 WITH CHECK (EXISTS
 (SELECT 1 FROM app_private.qa_claim_role_scope r WHERE r.role_name=CURRENT_USER::name
  AND r.tenant_id=messenger_event_claims.tenant_id
  AND r.store_id=messenger_event_claims.store_id
  AND r.page_id=messenger_event_claims.page_id AND r.active));
 INSERT INTO app_private.qa_claim_role_scope(role_name,tenant_id,store_id,page_id)
 VALUES ('$RA','$TA','$SA','$PA'),('$RB','$TA','$SB','$PB'),('$RC','$TB','$SC','$PC');" >/dev/null

ok "$(sql "SELECT count(*) FROM pg_roles WHERE rolname IN ('$RA','$RB','$RC') AND NOT rolbypassrls AND NOT rolsuper")" 3 ROLES_NO_BYPASSRLS
ok "$(sql "SELECT count(*) FROM pg_class WHERE oid IN ('app_private.messenger_event_claims'::regclass,'app_private.qa_claim_role_scope'::regclass) AND relrowsecurity AND relforcerowsecurity")" 2 BOTH_FORCE_RLS
ok "$(claim "$RA" "$TA" "$SA" "$PA" "$E" "$LA" | grep -c '|CLAIMED')" 1 A_CAN_CLAIM
ok "$(claim "$RA" "$TA" "$SA" "$PA" "$E" "$LA" | grep -c '|CLAIMED' || true)" 0 DUPLICATE_DENIED
ok "$(claim "$RB" "$TA" "$SB" "$PB" "$E" "$LB" | grep -c '|CLAIMED')" 1 SAME_TENANT_STORE_B
ok "$(claim "$RC" "$TB" "$SC" "$PC" "$E" "$LC" | grep -c '|CLAIMED')" 1 OTHER_TENANT_C
ok "$(client "$RA" "SELECT count(*) FROM app_private.messenger_event_claims")" 1 A_SEES_ONLY_A
ok "$(client "$RB" "SELECT count(*) FROM app_private.messenger_event_claims")" 1 B_SEES_ONLY_B
ok "$(client "$RC" "SELECT count(*) FROM app_private.messenger_event_claims")" 1 C_SEES_ONLY_C
ok "$(client "$RA" "SELECT count(*) FROM app_private.qa_claim_role_scope")" 1 SCOPES_NOT_PUBLIC
deny B_FORGED_STORE_A "$RB" "PREPARE c(uuid,uuid,text,text,int,text,uuid,timestamptz,timestamptz) AS $CLAIM; EXECUTE c('$TA','$SA','$PA','$H',3,'$E2',gen_random_uuid(),'$START','$EXPIRES')"
deny A_OTHER_STORE "$RA" "PREPARE c(uuid,uuid,text,text,int,text,uuid,timestamptz,timestamptz) AS $CLAIM; EXECUTE c('$TA','$SB','$PB','$H',3,'$E2',gen_random_uuid(),'$START','$EXPIRES')"
deny A_OTHER_TENANT "$RA" "PREPARE c(uuid,uuid,text,text,int,text,uuid,timestamptz,timestamptz) AS $CLAIM; EXECUTE c('$TB','$SC','$PC','$H',3,'$E2',gen_random_uuid(),'$START','$EXPIRES')"
deny A_WRONG_PAGE "$RA" "PREPARE c(uuid,uuid,text,text,int,text,uuid,timestamptz,timestamptz) AS $CLAIM; EXECUTE c('$TA','$SA','$PB','$H',3,'$E2',gen_random_uuid(),'$START','$EXPIRES')"
deny B_CANNOT_ASSUME_A "$RB" "SET ROLE $RA"
deny A_CANNOT_MODIFY_BINDINGS "$RA" "UPDATE app_private.qa_claim_role_scope SET store_id='$SB' WHERE role_name='$RA'"
ok "$(client "$RB" "SELECT count(*) FROM app_private.messenger_event_claims WHERE store_id='$SA'")" 0 NO_CROSS_STORE_READ
ok "$(client "$RB" "UPDATE app_private.messenger_event_claims SET status='REJECTED' WHERE store_id='$SA' RETURNING status" | wc -l | tr -d ' ')" 0 NO_CROSS_STORE_UPDATE
ok "$(finish "$RA" "$TA" "$SA" "$PA" "$LA" | grep -c '|PREVIEW_READY')" 1 A_FINALIZES_OWN_LEASE
ok "$(finish "$RB" "$TA" "$SA" "$PA" "$LA" | grep -c '|PREVIEW_READY' || true)" 0 B_CANNOT_FINALIZE_A
ok "$(finish "$RA" "$TA" "$SA" "$PA" "$LA" | grep -c '|PREVIEW_READY' || true)" 0 A_FINALIZES_ONLY_ONCE
deny JWT_CANNOT_OVERRIDE_SCOPE "$RB" "SELECT set_config('request.jwt.claims','{\"tenant_id\":\"$TA\",\"store_id\":\"$SA\"}',false); PREPARE c(uuid,uuid,text,text,int,text,uuid,timestamptz,timestamptz) AS $CLAIM; EXECUTE c('$TA','$SA','$PA','$H',3,'$E2',gen_random_uuid(),'$START','$EXPIRES')"
sql "UPDATE app_private.qa_claim_role_scope SET active=false WHERE role_name='$RA'" >/dev/null
ok "$(client "$RA" "SELECT count(*) FROM app_private.messenger_event_claims")" 0 REVOKED_A_CANNOT_READ
deny REVOKED_A_CANNOT_WRITE "$RA" "PREPARE c(uuid,uuid,text,text,int,text,uuid,timestamptz,timestamptz) AS $CLAIM; EXECUTE c('$TA','$SA','$PA','$H',3,'$E2',gen_random_uuid(),'$START','$EXPIRES')"
echo "PG17_REAL_RESTRICTED_RLS_TESTS=$PASS"
echo "QA_MODE=DISPOSABLE_LOCAL_POSTGRES; HOSTED_WROTE=false; MESSENGER_SENT=false"
