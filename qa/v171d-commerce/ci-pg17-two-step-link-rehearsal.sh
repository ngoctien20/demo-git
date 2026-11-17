#!/usr/bin/env bash
# Only a disposable PG17 database in CI; no Supabase API or real messages.
set -euo pipefail
[[ "$(printenv CI || true)" == "true" &&
 "$(printenv T404_V171C_DISPOSABLE || true)" == "YES" &&
 "$(printenv PGHOST || true)" == "postgres" &&
 "$(printenv PGDATABASE || true)" == "t404_v171c_ci" &&
 "$(printenv PGUSER || true)" == "postgres" ]] || { echo 'V171D_DISPOSABLE_ONLY';exit 2; }
[[ "$(psql -X -Atqc 'show server_version_num')" == 17* ]] || exit 2
[[ "$(psql -X -Atqc "select current_setting('tien404.v171c_ephemeral',true)")" == 'RPC171C_DISPOSABLE' ]] || exit 2
psql -X -v ON_ERROR_STOP=1 -q -f qa/v171c-commerce/pg17-private-link-context-disposable-only.sql >/dev/null
psql -X -v ON_ERROR_STOP=1 -q -f qa/v171d-commerce/pg17-two-step-link-disposable-only.sql >/dev/null
q(){ psql -X -Atq -v ON_ERROR_STOP=1 -c "$1"; }
check(){ local want="$1" sql="$2" label="$3" got
 got="$(q "$sql")"
 [[ "$got" == "$want" ]] || { echo "FAIL $label expected=$want got=[$got]";exit 1; }
 echo "PASS $label"
}
TOKEN="$(printf 'f%.0s' {1..64})";SOURCE="$(printf 'a%.0s' {1..64})"
TARGET="$(printf 'b%.0s' {1..64})";WRONG="$(printf 'c%.0s' {1..64})"
psql -X -v ON_ERROR_STOP=1 -q >/dev/null <<SQL
INSERT INTO qa_v171c.link_challenges(token_hash,tenant_id,store_id,
 source_channel,source_subject_hash,target_channel,canonical_customer_id,expires_at)
VALUES('$TOKEN','qa-tenant-1','qa-store-a','MESSENGER','$SOURCE',
 'ZALO_OA','qa-customer-a',clock_timestamp()+interval '5 minutes');
SQL
check 0 "SELECT count(*) FROM qa_v171c.identity_links" 'challenge not active until source approval'
check 1 "WITH presented AS (
 INSERT INTO qa_v171c.pending_link_approvals(token_hash,tenant_id,store_id,
 target_channel,target_account_id,target_subject_hash)
 SELECT token_hash,tenant_id,store_id,target_channel,'qa-zalo-oa','$TARGET'
 FROM qa_v171c.link_challenges WHERE token_hash='$TOKEN'
 AND tenant_id='qa-tenant-1' AND store_id='qa-store-a' AND target_channel='ZALO_OA'
 AND consumed_at IS NULL AND expires_at>clock_timestamp()
 RETURNING token_hash) SELECT count(*) FROM presented" 'destination authenticated in synthetic evidence becomes PENDING'
check 0 "SELECT count(*) FROM qa_v171c.identity_links" 'pending target cannot read order through link'
check 0 "WITH bad AS (UPDATE qa_v171c.pending_link_approvals p
 SET status='SOURCE_APPROVED',source_approved_at=clock_timestamp()
 FROM qa_v171c.link_challenges c WHERE p.token_hash=c.token_hash
 AND p.token_hash='$TOKEN' AND c.source_subject_hash='$WRONG'
 AND p.status='PENDING_SOURCE' RETURNING p.token_hash)
 SELECT count(*) FROM bad" 'wrong source Messenger subject cannot approve'
check 0 "WITH bad AS (UPDATE qa_v171c.pending_link_approvals p
 SET status='SOURCE_APPROVED',source_approved_at=clock_timestamp()
 FROM qa_v171c.link_challenges c WHERE p.token_hash=c.token_hash
 AND p.token_hash='$TOKEN' AND c.tenant_id='qa-tenant-1'
 AND c.store_id='qa-store-b' AND p.status='PENDING_SOURCE'
 RETURNING p.token_hash) SELECT count(*) FROM bad" 'wrong Store cannot source-approve'
psql -X -v ON_ERROR_STOP=1 -q >/dev/null <<SQL
BEGIN;
DO \$approve\$
DECLARE x record;
BEGIN
 SELECT p.*,c.canonical_customer_id INTO x
 FROM qa_v171c.pending_link_approvals p
 JOIN qa_v171c.link_challenges c USING(token_hash)
 WHERE p.token_hash='$TOKEN' AND p.status='PENDING_SOURCE'
 AND c.tenant_id='qa-tenant-1' AND c.store_id='qa-store-a'
 AND c.source_channel='MESSENGER' AND c.source_subject_hash='$SOURCE'
 AND c.expires_at>clock_timestamp() AND c.consumed_at IS NULL
 FOR UPDATE OF p,c;
 IF NOT FOUND THEN RAISE EXCEPTION 'VERIFIED_SOURCE_PENDING_NOT_FOUND';END IF;
 UPDATE qa_v171c.link_challenges SET consumed_at=clock_timestamp()
 WHERE token_hash=x.token_hash AND consumed_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'CHALLENGE_ALREADY_CONSUMED';END IF;
 INSERT INTO qa_v171c.identity_links(tenant_id,store_id,channel,
 account_id,subject_hash,canonical_customer_id)
 VALUES(x.tenant_id,x.store_id,x.target_channel,x.target_account_id,
 x.target_subject_hash,x.canonical_customer_id)
 ON CONFLICT(tenant_id,store_id,channel,account_id,subject_hash)
 DO UPDATE SET linked_at=EXCLUDED.linked_at
 WHERE qa_v171c.identity_links.canonical_customer_id=EXCLUDED.canonical_customer_id
 AND qa_v171c.identity_links.status='active';
 IF NOT FOUND THEN RAISE EXCEPTION 'CONFLICTING_TARGET_CUSTOMER_LINK';END IF;
 UPDATE qa_v171c.pending_link_approvals SET status='SOURCE_APPROVED',
 source_approved_at=clock_timestamp() WHERE token_hash=x.token_hash
 AND status='PENDING_SOURCE';
 IF NOT FOUND THEN RAISE EXCEPTION 'SOURCE_APPROVAL_LOST';END IF;
END \$approve\$;
COMMIT;
SQL
check 1 "SELECT count(*) FROM qa_v171c.identity_links
 WHERE tenant_id='qa-tenant-1' AND store_id='qa-store-a'
 AND canonical_customer_id='qa-customer-a' AND status='active'" 'source-confirmed target link persists in new DB connection'
check 1 "SELECT count(*) FROM qa_v171c.pending_link_approvals
 WHERE token_hash='$TOKEN' AND status='SOURCE_APPROVED'
 AND source_approved_at IS NOT NULL" 'source consent persisted'
check 1 "SELECT count(*) FROM qa_v171c.link_challenges
 WHERE token_hash='$TOKEN' AND consumed_at IS NOT NULL" 'token consumed'
check 0 "WITH retry AS (UPDATE qa_v171c.pending_link_approvals
 SET source_approved_at=clock_timestamp()
 WHERE token_hash='$TOKEN' AND status='PENDING_SOURCE' RETURNING token_hash)
 SELECT count(*) FROM retry" 'source approval cannot be reused'
check 0 "SELECT count(*) FROM qa_v171c.identity_links
 WHERE tenant_id='qa-tenant-1' AND store_id='qa-store-b'" 'Store B cannot borrow Store A identity'
check 1 "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='qa_v171c' AND c.relname='pending_link_approvals'
 AND c.relrowsecurity AND c.relforcerowsecurity" 'private pending approval FORCE RLS'
check 0 "SELECT count(*) FROM information_schema.role_table_grants
 WHERE table_schema='qa_v171c' AND table_name='pending_link_approvals'
 AND grantee='qa_v171c_untrusted'" 'no nontrusted grants'
psql -X -v ON_ERROR_STOP=1 -q -c "UPDATE qa_v171c.identity_links
 SET status='revoked' WHERE store_id='qa-store-a'" >/dev/null
check 0 "SELECT count(*) FROM qa_v171c.identity_links WHERE status='active'" 'revocation stops access'
echo 'PASS V17.1D: two-step source approval on disposable PG17, no hosted provider credentials'
