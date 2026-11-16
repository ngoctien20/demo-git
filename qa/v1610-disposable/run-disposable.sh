#!/usr/bin/env bash
# TIEN404 V16.10: disposable GH hosted runner synthetic PG17 ONLY.
set -euo pipefail
[[ "$T404_DISPOSABLE_QA_ONLY" == "YES" ]] || { echo 'BLOCKED: no QA authorization'; exit 31; }
[[ "$PGHOST" == "127.0.0.1" && "$PGPORT" == "5432" && "$PGUSER" == "postgres" ]] || {
 echo 'BLOCKED: only local disposable PG'; exit 32;
}
[[ "$GITHUB_ACTIONS" == "true" && "$GITHUB_REPOSITORY" == "ngoctien20/demo-git" ]] || {
 echo 'BLOCKED: wrong runner or repository'; exit 33;
}
command -v pg_dump >/dev/null
command -v pg_restore >/dev/null
command -v psql >/dev/null
command -v sha256sum >/dev/null
sourceDb="t404_v1610_disposable"
restoreDb="t404_v1610_restored"
# Never overwrite an existing database, even if named like the fixture.
for db in "$sourceDb" "$restoreDb"; do
 if [[ "$(psql -d postgres -Atqc "SELECT count(*) FROM pg_database WHERE datname='$db'")" != "0" ]];then
   echo "BLOCKED: preexisting database: $db";exit 35
 fi
done
createdb "$sourceDb"
psql -v ON_ERROR_STOP=1 -d "$sourceDb" -f qa/v1610-disposable/postgres-fixture.sql
psql -v ON_ERROR_STOP=1 -d "$sourceDb" -f qa/v1610-disposable/test-store-rls.sql
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
# Synthetic, unencrypted dump! NOT hosted backup encryption/retention certification.
pg_dump --format=custom --file="$tmp/qa-synthetic.dump" "$sourceDb"
sha256sum "$tmp/qa-synthetic.dump" > "$tmp/qa-synthetic.sha256"
(cd "$tmp" && sha256sum --check qa-synthetic.sha256)
createdb "$restoreDb"
pg_restore --exit-on-error --no-owner --dbname="$restoreDb" "$tmp/qa-synthetic.dump"
psql -v ON_ERROR_STOP=1 -d "$restoreDb" -f qa/v1610-disposable/test-store-rls.sql
s="$(psql -d "$sourceDb" -Atqc "SELECT concat_ws('|',(SELECT count(*) FROM qa.stores),(SELECT count(*) FROM qa.products),(SELECT count(*) FROM qa.customers),(SELECT count(*) FROM qa.orders),(SELECT sum(price_vnd) FROM qa.products))")"
r="$(psql -d "$restoreDb" -Atqc "SELECT concat_ws('|',(SELECT count(*) FROM qa.stores),(SELECT count(*) FROM qa.products),(SELECT count(*) FROM qa.customers),(SELECT count(*) FROM qa.orders),(SELECT sum(price_vnd) FROM qa.products))")"
if [[ "$s" != "$r" || "$s" != "3|3|3|3|627000" ]];then
 echo "FAIL: synthetic restore mismatch";exit 36
fi
echo 'V1610_DISPOSABLE_PG17_RESTORE_PASS: 3 Stores, 3 products, 3 customers, 3 orders; Store RLS tests repeated on restored DB; SHA256 verified'
echo 'V1610_HOSTED_BACKUP_RESTORE_NOT_RUN; V1610_REAL_JWT_NOT_VERIFIED; V1610_REAL_OWNER_PROOF_MISSING'
