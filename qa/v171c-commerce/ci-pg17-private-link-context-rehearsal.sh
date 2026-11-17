#!/usr/bin/env bash
# V17.1C PostgreSQL 17 CI disposable only, no Supabase changes.
set -euo pipefail
[[ "$(printenv CI || true)" == "true" &&
 "$(printenv T404_V171C_DISPOSABLE || true)" == "YES" &&
 "$(printenv PGHOST || true)" == "postgres" &&
 "$(printenv PGDATABASE || true)" == "t404_v171c_ci" &&
 "$(printenv PGUSER || true)" == "postgres" ]] || { echo V171C_DISPOSABLE_ONLY;exit 2; }
[[ "$(psql -X -Atqc 'show server_version_num')" == 17* ]] || exit 2
[[ "$(psql -X -Atqc 'select current_database()')" == "t404_v171c_ci" ]] || exit 2
[[ "$(psql -X -Atqc "select current_setting('tien404.v171c_ephemeral',true)")" == 'RPC171C_DISPOSABLE' ]] || exit 2
psql -X -q -v ON_ERROR_STOP=1 -f qa/v171c-commerce/pg17-private-link-context-disposable-only.sql >/dev/null
q(){ psql -X -Atq -v ON_ERROR_STOP=1 -c "$1"; }
check(){
 local expected="$1" stmt="$2" label="$3" got
 got="$(q "$stmt")"
 [[ "$got" == "$expected" ]] || { echo "FAIL $label expected=$expected got=[$got]";exit 1; }
 echo "PASS $label"
}
H_A="$(printf 'a%.0s' {1..64})"
H_B="$(printf 'b%.0s' {1..64})"
H_C="$(printf 'c%.0s' {1..64})"
psql -X -q -v ON_ERROR_STOP=1 >/dev/null <<SQL
INSERT INTO qa_v171c.link_challenges
(token_hash,tenant_id,store_id,source_channel,source_subject_hash,
 target_channel,canonical_customer_id,expires_at)
VALUES('$H_A','qa-tenant-1','qa-store-a','MESSENGER','$H_B',
 'ZALO_OA','qa-customer-1',clock_timestamp()+interval '5 minutes');
SQL
check 1 "SELECT count(*) FROM qa_v171c.link_challenges WHERE token_hash='$H_A' AND consumed_at IS NULL" 'challenge stored as hash'
for scope in "qa-tenant-1|qa-store-b|ZALO_OA" "qa-tenant-2|qa-store-c|ZALO_OA" "qa-tenant-1|qa-store-a|ZALO_BOT"; do
 IFS='|' read -r tenant store channel <<<"$scope"
 check 0 "WITH c AS (UPDATE qa_v171c.link_challenges
 SET consumed_at=clock_timestamp() WHERE token_hash='$H_A'
 AND tenant_id='$tenant' AND store_id='$store' AND target_channel='$channel'
 AND consumed_at IS NULL AND expires_at>clock_timestamp()
 RETURNING token_hash) SELECT count(*) FROM c" 'wrong tenant/store/channel denied'
done
# Consume challenge and establish private identity link in one transaction.
psql -X -q -v ON_ERROR_STOP=1 >/dev/null <<SQL
BEGIN;
DO \$redeem\$
DECLARE c record;
BEGIN
 UPDATE qa_v171c.link_challenges SET consumed_at=clock_timestamp()
 WHERE token_hash='$H_A' AND tenant_id='qa-tenant-1' AND store_id='qa-store-a'
 AND target_channel='ZALO_OA' AND consumed_at IS NULL
 AND expires_at>clock_timestamp() RETURNING * INTO c;
 IF NOT FOUND THEN RAISE EXCEPTION 'NO_CHALLENGE';END IF;
 INSERT INTO qa_v171c.identity_links
 (tenant_id,store_id,channel,account_id,subject_hash,canonical_customer_id)
 VALUES(c.tenant_id,c.store_id,'ZALO_OA','qa-oa-account','$H_C',c.canonical_customer_id)
 ON CONFLICT(tenant_id,store_id,channel,account_id,subject_hash)
 DO UPDATE SET linked_at=EXCLUDED.linked_at
 WHERE qa_v171c.identity_links.canonical_customer_id=EXCLUDED.canonical_customer_id
 AND qa_v171c.identity_links.status='active';
 IF NOT FOUND THEN RAISE EXCEPTION 'IDENTITY_CONFLICT';END IF;
END \$redeem\$;
COMMIT;
SQL
check 1 "SELECT count(*) FROM qa_v171c.identity_links
 WHERE store_id='qa-store-a' AND canonical_customer_id='qa-customer-1'" 'atomic identity link'
check 0 "WITH c AS (UPDATE qa_v171c.link_challenges
 SET consumed_at=clock_timestamp() WHERE token_hash='$H_A' AND consumed_at IS NULL
 RETURNING token_hash) SELECT count(*) FROM c" 'replay of redeemed challenge denied'
# Conflicting customer binding fails and transaction rolls challenge back.
psql -X -q -v ON_ERROR_STOP=1 >/dev/null <<SQL
INSERT INTO qa_v171c.link_challenges
(token_hash,tenant_id,store_id,source_channel,source_subject_hash,
 target_channel,canonical_customer_id,expires_at)
VALUES('$H_B','qa-tenant-1','qa-store-a','MESSENGER','$H_A',
 'ZALO_OA','qa-customer-evil',clock_timestamp()+interval '5 minutes');
SQL
if psql -X -q -v ON_ERROR_STOP=1 >/dev/null 2>&1 <<SQL
BEGIN;
DO \$conflict\$
DECLARE c record;
BEGIN
 UPDATE qa_v171c.link_challenges SET consumed_at=clock_timestamp()
 WHERE token_hash='$H_B' AND consumed_at IS NULL AND expires_at>clock_timestamp()
 RETURNING * INTO c;
 INSERT INTO qa_v171c.identity_links
 (tenant_id,store_id,channel,account_id,subject_hash,canonical_customer_id)
 VALUES(c.tenant_id,c.store_id,'ZALO_OA','qa-oa-account','$H_C',c.canonical_customer_id)
 ON CONFLICT(tenant_id,store_id,channel,account_id,subject_hash)
 DO UPDATE SET linked_at=EXCLUDED.linked_at
 WHERE qa_v171c.identity_links.canonical_customer_id=EXCLUDED.canonical_customer_id
 AND qa_v171c.identity_links.status='active';
 IF NOT FOUND THEN RAISE EXCEPTION 'CONFLICT_MUST_ROLLBACK';END IF;
END \$conflict\$;
COMMIT;
SQL
then echo 'FAIL conflicting customer link allowed';exit 1;fi
check 0 "SELECT count(*) FROM qa_v171c.identity_links WHERE canonical_customer_id='qa-customer-evil'" 'conflicting destination denied'
check 1 "SELECT count(*) FROM qa_v171c.link_challenges WHERE token_hash='$H_B' AND consumed_at IS NULL" 'failed identity bind rolled back token consume'
psql -X -q -v ON_ERROR_STOP=1 >/dev/null <<SQL
INSERT INTO qa_v171c.link_challenges
(token_hash,tenant_id,store_id,source_channel,source_subject_hash,target_channel,
 canonical_customer_id,issued_at,expires_at)
VALUES('$H_C','qa-tenant-1','qa-store-a','MESSENGER','$H_A','ZALO_OA',
 'qa-expired',clock_timestamp()-interval '10 minutes',clock_timestamp()-interval '1 minute');
SQL
check 0 "WITH c AS (UPDATE qa_v171c.link_challenges SET consumed_at=clock_timestamp()
 WHERE token_hash='$H_C' AND consumed_at IS NULL AND expires_at>clock_timestamp()
 RETURNING token_hash) SELECT count(*) FROM c" 'expired challenge denied'

psql -X -q -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
INSERT INTO qa_v171c.conversation_sessions
(tenant_id,store_id,canonical_customer_id,state,revision,expires_at)
VALUES('qa-tenant-1','qa-store-a','qa-customer-1',
 '{"selectedItemId":"qa-a003","quantity":2,"awaitingConfirmation":true}'::jsonb,
 1,clock_timestamp()+interval '15 minutes');
SQL
check 1 "SELECT revision FROM qa_v171c.conversation_sessions
 WHERE tenant_id='qa-tenant-1' AND store_id='qa-store-a'
 AND canonical_customer_id='qa-customer-1' AND expires_at>clock_timestamp()" 'new connection reads stored conversation'
check 2 "WITH changed AS (UPDATE qa_v171c.conversation_sessions SET revision=revision+1,
 state='{\"selectedItemId\":\"qa-a003\",\"quantity\":1}'::jsonb,
 updated_at=clock_timestamp(),expires_at=clock_timestamp()+interval '15 minutes'
 WHERE tenant_id='qa-tenant-1' AND store_id='qa-store-a'
 AND canonical_customer_id='qa-customer-1' AND revision=1 AND expires_at>clock_timestamp()
 RETURNING revision) SELECT revision FROM changed" 'optimistic CAS update succeeds'
check 0 "WITH c AS (UPDATE qa_v171c.conversation_sessions SET revision=revision+1
 WHERE tenant_id='qa-tenant-1' AND store_id='qa-store-a'
 AND canonical_customer_id='qa-customer-1' AND revision=1
 RETURNING revision) SELECT count(*) FROM c" 'stale CAS update denied'
check 0 "SELECT count(*) FROM qa_v171c.conversation_sessions
 WHERE tenant_id='qa-tenant-1' AND store_id='qa-store-b'
 AND canonical_customer_id='qa-customer-1'" 'different Store context not returned'
psql -X -q -v ON_ERROR_STOP=1 -c "UPDATE qa_v171c.conversation_sessions
 SET expires_at=clock_timestamp()-interval '1 second'
 WHERE store_id='qa-store-a'" >/dev/null
check 0 "WITH c AS (UPDATE qa_v171c.conversation_sessions SET revision=revision+1
 WHERE store_id='qa-store-a' AND revision=2 AND expires_at>clock_timestamp()
 RETURNING revision) SELECT count(*) FROM c" 'expired context denies update'

claim_sql="WITH c AS (INSERT INTO qa_v171c.inbound_event_claims
 (tenant_id,store_id,channel,account_id,event_id,expires_at)
 VALUES('qa-tenant-1','qa-store-a','ZALO_OA','qa-oa-account',
 'qa-once',clock_timestamp()+interval '5 minutes')
 ON CONFLICT DO NOTHING RETURNING event_id) SELECT count(*) FROM c"
p1=$(mktemp);p2=$(mktemp)
psql -X -Atq -v ON_ERROR_STOP=1 -c "$claim_sql" >"$p1" & a=$!
psql -X -Atq -v ON_ERROR_STOP=1 -c "$claim_sql" >"$p2" & b=$!
wait "$a";wait "$b"
total=$(( $(cat "$p1") + $(cat "$p2") ))
rm -f "$p1" "$p2"
[[ "$total" == 1 ]] || { echo "FAIL concurrent event claims=$total";exit 1; }
echo 'PASS two PG connections claim one inbound event'
check 1 "SELECT count(*) FROM qa_v171c.inbound_event_claims WHERE event_id='qa-once'" 'event claim persisted'
check 4 "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='qa_v171c' AND c.relname IN ('link_challenges','identity_links',
 'conversation_sessions','inbound_event_claims') AND c.relrowsecurity AND c.relforcerowsecurity" 'all four private tables FORCE RLS'
check 0 "SELECT count(*) FROM information_schema.role_table_grants WHERE table_schema='qa_v171c' AND grantee='qa_v171c_untrusted'" 'no untrusted table grants'
echo 'PASS V17.1C disposable PG17 atomic link/context/replay, no hosted or vendor I/O'
