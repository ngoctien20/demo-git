#!/usr/bin/env bash
# TIEN404 RPC.5 — DISPOSABLE PG17: SAME-TENANT CUSTOMER/ORDER FK proof
# Must run AFTER inherited V14.4.1 test in identical disposable DB.
set -euo pipefail
[[ "$(printenv CI_V1441_DISPOSABLE || true)" == "YES" &&
   "$(printenv PGDATABASE || true)" == "tien404_v1441_ci" &&
   "$(printenv PGHOST || true)" == "postgres" &&
   "$(printenv PGUSER || true)" == "postgres" ]] || {
  echo 'RPC5_REJECT_NON_DISPOSABLE_DATABASE'; exit 2;
}
[[ "$(psql -X -qAt -v ON_ERROR_STOP=1 -c 'SHOW server_version_num')" == 17* ]] || exit 2

psql -X -qAt -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
DO $qa_only$
BEGIN
 IF current_database()<>'tien404_v1441_ci'
   OR current_user<>'postgres'
   OR current_setting('tien404.qa_ephemeral',true)<>'V1441_DISPOSABLE'
 THEN RAISE EXCEPTION 'RPC5_REFUSES_HOSTED_OR_UNAPPROVED_DB'; END IF;
END $qa_only$;

-- V14.4.1 deliberately deactivated synthetic B to test revocation.
UPDATE qa_v1441.store_memberships SET active=true
 WHERE actor_id='bbbbbbbb-0000-4000-8000-000000000002';

CREATE TABLE qa_v1441.customers (
 id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL,
 store_id uuid NOT NULL,
 label text NOT NULL,
 UNIQUE(tenant_id,id),
 UNIQUE(tenant_id,store_id,id)
);
ALTER TABLE qa_v1441.orders ADD COLUMN customer_id uuid;
ALTER TABLE qa_v1441.orders ADD CONSTRAINT qa_legacy_tenant_customer_fk
 FOREIGN KEY(tenant_id,customer_id)
 REFERENCES qa_v1441.customers(tenant_id,id);

INSERT INTO qa_v1441.customers VALUES
 ('aaaaaaaa-5555-4555-8555-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','QA-A'),
 ('bbbbbbbb-5555-4555-8555-bbbbbbbbbbbb',
  '11111111-1111-4111-8111-111111111111',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','QA-B'),
 ('cccccccc-5555-4555-8555-cccccccccccc',
  '22222222-2222-4222-8222-222222222222',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc','QA-C');
UPDATE qa_v1441.orders
 SET customer_id='aaaaaaaa-5555-4555-8555-aaaaaaaaaaaa'
 WHERE id='aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa';
UPDATE qa_v1441.orders
 SET customer_id='bbbbbbbb-5555-4555-8555-bbbbbbbbbbbb'
 WHERE id='bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';

-- Proof: tenant-only FK ALLOWS same-tenant cross-store customer assignment.
BEGIN;
UPDATE qa_v1441.orders
 SET customer_id='bbbbbbbb-5555-4555-8555-bbbbbbbbbbbb'
 WHERE id='aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa';
DO $legacy$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM qa_v1441.orders
  WHERE id='aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa'
  AND customer_id='bbbbbbbb-5555-4555-8555-bbbbbbbbbbbb')
 THEN RAISE EXCEPTION 'RPC5_LEGACY_TENANT_FK_NOT_REPRODUCED'; END IF;
END $legacy$;
ROLLBACK;

-- Now enforce same tenant AND store in DB FK: wrong-store linkage denied.
ALTER TABLE qa_v1441.orders ADD CONSTRAINT qa_customer_same_store_fk
 FOREIGN KEY(tenant_id,store_id,customer_id)
 REFERENCES qa_v1441.customers(tenant_id,store_id,id);
ALTER TABLE qa_v1441.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_v1441.customers FORCE ROW LEVEL SECURITY;
REVOKE ALL ON qa_v1441.customers FROM PUBLIC;
GRANT SELECT ON qa_v1441.customers TO qa_v1441_user;
CREATE POLICY scoped_customer_read ON qa_v1441.customers FOR SELECT TO qa_v1441_user
 USING (qa_v1441.store_access(tenant_id,store_id));

DO $same_store$
BEGIN
 BEGIN
  UPDATE qa_v1441.orders
   SET customer_id='bbbbbbbb-5555-4555-8555-bbbbbbbbbbbb'
   WHERE id='aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa';
  RAISE EXCEPTION 'RPC5_COMPOSITE_FK_WRONG_STORE_SUCCEEDED';
 EXCEPTION WHEN foreign_key_violation THEN NULL;
 END;
END $same_store$;
SQL

actor_query(){
 local actor="$1" sql="$2"
 psql -X -qAt -v ON_ERROR_STOP=1 <<SQL
BEGIN;
SET LOCAL ROLE qa_v1441_user;
SET LOCAL tien404.synthetic_actor='$actor';
$sql
ROLLBACK;
SQL
}
assert_actor(){
 local actor="$1" expected="$2" sql="$3" label="$4"
 local got
 got="$(actor_query "$actor" "$sql")"
 [[ "$got" == "$expected" ]] || {
  echo "FAIL: $label expected=$expected actual=$got";exit 1; }
 echo "PASS: $label"
}
A='aaaaaaaa-0000-4000-8000-000000000001'
B='bbbbbbbb-0000-4000-8000-000000000002'
C='cccccccc-0000-4000-8000-000000000003'
R='ffffffff-0000-4000-8000-000000000004'
assert_actor "$A" 1 'SELECT count(*) FROM qa_v1441.customers;' 'Shop A sees own customer'
assert_actor "$B" 1 'SELECT count(*) FROM qa_v1441.customers;' 'Shop B same tenant sees own customer'
assert_actor "$C" 1 'SELECT count(*) FROM qa_v1441.customers;' 'Shop C separate tenant sees own customer'
assert_actor "$R" 0 'SELECT count(*) FROM qa_v1441.customers;' 'Unassigned sees none'
assert_actor "$A" 0 \
 "SELECT count(*) FROM qa_v1441.customers WHERE store_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';" \
 'Shop A cannot see Shop B customer'
assert_actor "$B" 0 \
 "SELECT count(*) FROM qa_v1441.customers WHERE store_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';" \
 'Shop B cannot see Shop A customer'
assert_actor "$A" QA-A \
 "SELECT c.label FROM qa_v1441.orders o JOIN qa_v1441.customers c ON c.id=o.customer_id WHERE o.store_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';" \
 'Shop A joins own Order and Customer only'
assert_actor "$B" QA-B \
 "SELECT c.label FROM qa_v1441.orders o JOIN qa_v1441.customers c ON c.id=o.customer_id WHERE o.store_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';" \
 'Shop B joins own Order and Customer only'
got="$(psql -X -qAt -v ON_ERROR_STOP=1 -c \
 "SELECT has_table_privilege('qa_v1441_user','qa_v1441.customers','INSERT')")"
[[ "$got" == "f" ]] || { echo 'FAIL QA customer INSERT granted';exit 1; }
echo 'PASS: no client INSERT grant on customers'
echo 'PASS: RPC5 disposable composite FK and RLS; NOT hosted JWT/RLS proof'
