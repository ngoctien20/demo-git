#!/usr/bin/env bash
set -euo pipefail
if [[ "$PGDATABASE" != "tien404_replay_ci" || "$TIEN404_M7_EPHEMERAL_ONLY" != "TRUE" ]]; then echo 'BLOCKED ephemeral-only'; exit 99; fi
[[ "$(psql -X -qAt -v ON_ERROR_STOP=1 -c 'select current_database()')" == 'tien404_replay_ci' ]] || exit 99
ROOT='qa_messenger_v136m7.event_claims'
T='11111111-1111-4111-8111-111111111111'; TB='22222222-2222-4222-8222-222222222222'
A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
P='12345678901234567'; PB='98765432109876543'
HA=$(printf 'a%.0s' {1..64}); HB=$(printf 'b%.0s' {1..64}); HC=$(printf 'c%.0s' {1..64}); HD=$(printf 'd%.0s' {1..64}); HE=$(printf 'e%.0s' {1..64})
S1=$(printf '1%.0s' {1..64}); S2=$(printf '2%.0s' {1..64})
E1=$(printf '3%.0s' {1..64}); E2=$(printf '4%.0s' {1..64})
ins(){
 local lease="$1" tenant="$2" shop="$3" page="$4" canonical="$5" version="$6" sender="$7" event="$8"
 psql -X -qAt -v ON_ERROR_STOP=1 <<SQL
WITH claim AS (INSERT INTO $ROOT
 (tenant_id,store_id,page_id,canonical_event_digest,sender_hash,event_hash,key_version,binding_version,lease_id,expires_at)
 VALUES ('$tenant'::uuid,'$shop'::uuid,'$page','$canonical','$sender','$event','$version',1,'$lease'::uuid,clock_timestamp()+interval '30 days')
 ON CONFLICT (tenant_id,store_id,page_id,canonical_event_digest) DO NOTHING RETURNING id)
SELECT count(*) FROM claim;
SQL
}
assert_n(){ local expected="$1" query="$2"; local got; got=$(psql -X -qAt -v ON_ERROR_STOP=1 -c "$query"); [[ "$got" == "$expected" ]] || { echo "FAIL expected=$expected actual=$got"; exit 1; }; }
assert_n 1 "select (relrowsecurity AND relforcerowsecurity)::int from pg_class where oid='$ROOT'::regclass"
assert_n 0 "select rolbypassrls::int from pg_roles where rolname='qa_messenger_ci_denied'"
work=$(mktemp -d); trap 'rm -rf "$work"' EXIT
for i in $(seq 1 32); do
 lease=$(printf '00000000-0000-4000-8000-%012d' "$i")
 (ins "$lease" "$T" "$A" "$P" "$HA" v1 "$S1" "$E1" > "$work/$i") &
done
wait
wins=$(cat "$work"/* | grep -c '^1$' || true); duplicates=$(cat "$work"/* | grep -c '^0$' || true)
[[ "$wins" == 1 && "$duplicates" == 31 ]] || { echo "FAIL concurrent $wins/$duplicates"; exit 1; }
assert_n 1 "select count(*) from $ROOT where tenant_id='$T' and store_id='$A' and canonical_event_digest='$HA'"
echo 'PASS 32 independent PG sessions, one winner'
[[ "$(ins '00000000-0000-4000-8000-000000000091' "$T" "$A" "$P" "$HA" v2 "$S2" "$E2")" == 0 ]] || exit 1
echo 'PASS HMAC version change cannot bypass stable canonical replay uniqueness'
[[ "$(ins '00000000-0000-4000-8000-000000000092' "$T" "$B" "$P" "$HA" v1 "$S1" "$E1")" == 1 ]] || exit 1
[[ "$(ins '00000000-0000-4000-8000-000000000093' "$T" "$A" "$PB" "$HA" v1 "$S1" "$E1")" == 1 ]] || exit 1
[[ "$(ins '00000000-0000-4000-8000-000000000094' "$TB" "$B" "$P" "$HA" v1 "$S1" "$E1")" == 1 ]] || exit 1
[[ "$(ins '00000000-0000-4000-8000-000000000095' "$T" "$A" "$P" "$HB" v1 "$S1" "$E1")" == 1 ]] || exit 1
echo 'PASS same-tenant two-store, cross-tenant, page, sender isolation'
psql -X -qAt -v ON_ERROR_STOP=1 > /dev/null <<SQL
BEGIN;
INSERT INTO $ROOT (tenant_id,store_id,page_id,canonical_event_digest,sender_hash,event_hash,key_version,binding_version,lease_id,expires_at)
VALUES ('$T','$A','$P','$HC','$S1','$E1','v1',1,'00000000-0000-4000-8000-000000000096',clock_timestamp()+interval '30 days');
ROLLBACK;
SQL
assert_n 0 "select count(*) from $ROOT where canonical_event_digest='$HC'"
[[ "$(ins '00000000-0000-4000-8000-000000000097' "$T" "$A" "$P" "$HC" v1 "$S1" "$E1")" == 1 ]] || exit 1
echo 'PASS transaction rollback'
psql -X -qAt -v ON_ERROR_STOP=1 > /dev/null <<SQL
BEGIN;
INSERT INTO $ROOT (tenant_id,store_id,page_id,canonical_event_digest,sender_hash,event_hash,key_version,binding_version,lease_id,expires_at)
VALUES ('$T','$A','$P','$HD','$S1','$E1','v1',1,'00000000-0000-4000-8000-000000000098',clock_timestamp()+interval '30 days');
SQL
assert_n 0 "select count(*) from $ROOT where canonical_event_digest='$HD'"
echo 'PASS connection lost before COMMIT'
lease='00000000-0000-4000-8000-000000000099'
[[ "$(ins "$lease" "$T" "$A" "$P" "$HE" v1 "$S1" "$E1")" == 1 ]] || exit 1
wrong=$(psql -X -qAt -v ON_ERROR_STOP=1 -c "WITH x AS (UPDATE $ROOT SET status='PREVIEW_READY', completed_at=clock_timestamp() WHERE canonical_event_digest='$HE' AND lease_id='00000000-0000-4000-8000-000000000001' AND status='CLAIMED' RETURNING id) SELECT count(*) FROM x")
right=$(psql -X -qAt -v ON_ERROR_STOP=1 -c "WITH x AS (UPDATE $ROOT SET status='PREVIEW_READY', completed_at=clock_timestamp() WHERE canonical_event_digest='$HE' AND lease_id='$lease' AND status='CLAIMED' RETURNING id) SELECT count(*) FROM x")
[[ "$wrong" == 0 && "$right" == 1 ]] || exit 1
[[ "$(ins '00000000-0000-4000-8000-000000000100' "$T" "$A" "$P" "$HE" v1 "$S1" "$E1")" == 0 ]] || exit 1
echo 'PASS persisted claimed record, wrong lease denial, one-way finalize'
rls=$(psql -X -qAt -v ON_ERROR_STOP=1 <<SQL
BEGIN;
SET LOCAL ROLE qa_messenger_ci_denied;
SELECT count(*) FROM $ROOT;
ROLLBACK;
SQL
)
[[ "$rls" == 0 ]] || { echo 'FAIL RLS default deny'; exit 1; }
echo 'PASS restricted role sees zero rows under FORCE RLS (not hosted JWT QA)'
assert_n 7 "select count(*) from $ROOT"
echo 'PASS disposable PostgreSQL 17 review suite; NOT hosted Supabase migration proof'
