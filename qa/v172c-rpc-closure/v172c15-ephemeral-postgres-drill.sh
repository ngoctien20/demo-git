#!/usr/bin/env bash
# V17.2C.15 — EPHEMERAL GITHUB CI POSTGRES ONLY. NEVER target Supabase.
set -euo pipefail
: "${PGHOST:?missing PGHOST}"
: "${PGPORT:?missing PGPORT}"
: "${PGUSER:?missing PGUSER}"
: "${PGDATABASE:?missing PGDATABASE}"
: "${PGPASSWORD:?missing ephemeral ci password}"
if [[ "$PGHOST" != "127.0.0.1" || "$PGDATABASE" != "postgres" ]]; then
 echo "Refusing non-local or non-postgres CI database" >&2; exit 91
fi
root="qa/v172c-rpc-closure"
psql -X -q -v ON_ERROR_STOP=1 -f "$root/v172c15-ci-ephemeral-postgres-bootstrap.sql"
psql -X -q -v ON_ERROR_STOP=1 -f "$root/v172c10_disposable_schema_candidate_NOT_EXECUTED.sql"
gate="$(psql -X -qAt -v ON_ERROR_STOP=1 -f "$root/v172c12-postdeploy-rls-readonly-audit.sql")"
echo "$gate" | grep -q 'METADATA_REVIEW_REQUIRED_NOT_JWT_GO'
psql -X -q -v ON_ERROR_STOP=1 -f "$root/v172c15-ci-synthetic-store-ab-fixture.sql"

function as_actor() {
 local actor="$1"
 psql -X -qAt -v ON_ERROR_STOP=1 <<SQL
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '$actor';
SELECT COALESCE(string_agg(sku,',' ORDER BY sku),'NONE')
FROM tien404_v172c10_disposable.qa_catalog;
ROLLBACK;
SQL
}
a="$(as_actor aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa)"
b="$(as_actor bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb)"
[[ "$a" == "QA-A" ]] || { echo "A RLS isolation FAIL: $a"; exit 2; }
[[ "$b" == "QA-B" ]] || { echo "B RLS isolation FAIL: $b"; exit 3; }
echo "Synthetic signed-claim emulation RLS A->A only and B->B only PASS (NOT real JWT)."

# An unaffiliated authenticated actor is denied both rows.
none="$(as_actor cccccccc-cccc-4ccc-8ccc-cccccccccccc)"
[[ "$none" == "NONE" ]] || { echo "Unaffiliated actor could read catalog"; exit 4; }
# Revoking membership immediately removes catalog access even with same emulated claim.
psql -X -q -v ON_ERROR_STOP=1 -c "UPDATE tien404_v172c10_disposable.qa_store_memberships SET active=false WHERE user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';"
revoked="$(as_actor aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa)"
[[ "$revoked" == "NONE" ]] || { echo "Revoked membership could still read"; exit 5; }
echo "Unknown actor and revoked membership denial PASS."

if psql -X -q -v ON_ERROR_STOP=1 <<'SQL' > /tmp/tien404-anon-qa.log 2>&1
BEGIN;
SET LOCAL ROLE anon;
SELECT * FROM tien404_v172c10_disposable.qa_catalog;
ROLLBACK;
SQL
then
 echo "FAIL: anon was able to SELECT catalog"; exit 6
fi
if ! grep -qi 'permission denied' /tmp/tien404-anon-qa.log; then
 echo "Anon failed for unexpected reason"; sed -n '1,8p' /tmp/tien404-anon-qa.log; exit 7
fi
echo "Anon denied PASS."

# Guarded rollback MUST reject populated fixtures, without dropping any relation.
if psql -X -q -v ON_ERROR_STOP=1 -f "$root/v172c10_disposable_rollback_candidate_NOT_EXECUTED.sql" > /tmp/tien404-rollback-qa.log 2>&1; then
 echo "FAIL: rollback deleted populated QA schema"; exit 8
fi
grep -q 'Disposable schema has QA rows' /tmp/tien404-rollback-qa.log
exists="$(psql -X -qAt -v ON_ERROR_STOP=1 -c "SELECT to_regnamespace('tien404_v172c10_disposable') IS NOT NULL;")"
[[ "$exists" == "t" ]] || { echo "Schema vanished after rollback refusal"; exit 9; }
echo "Rollback non-empty fail-closed PASS."

# Only synthetic CI fixtures in an ephemeral service are cleared here.
psql -X -q -v ON_ERROR_STOP=1 -c "TRUNCATE tien404_v172c10_disposable.qa_catalog, tien404_v172c10_disposable.qa_store_memberships, tien404_v172c10_disposable.qa_stores, tien404_v172c10_disposable.qa_tenants;"
psql -X -q -v ON_ERROR_STOP=1 -f "$root/v172c10_disposable_rollback_candidate_NOT_EXECUTED.sql"
empty="$(psql -X -qAt -v ON_ERROR_STOP=1 -c "SELECT to_regnamespace('tien404_v172c10_disposable') IS NULL;")"
[[ "$empty" == "t" ]] || { echo "Rollback did not remove emptied disposable schema"; exit 10; }
echo "Guarded empty QA schema rollback PASS."
