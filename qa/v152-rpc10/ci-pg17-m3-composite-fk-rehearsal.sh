#!/usr/bin/env bash
# RPC.10 — disposable Postgres17 ONLY: never run against Supabase hosted.
set -euo pipefail
[[ "$(printenv CI || true)" == "true" &&
   "$(printenv T404_RPC8_DISPOSABLE || true)" == "YES" &&
   "$(printenv PGHOST || true)" == "postgres" &&
   "$(printenv PGDATABASE || true)" == "t404_rpc8_ci" &&
   "$(printenv PGUSER || true)" == "postgres" ]] || { echo 'RPC10_DISPOSABLE_ONLY';exit 2; }
[[ "$(psql -X -Atqc 'show server_version_num')" == 17* ]] || exit 2
[[ "$(psql -X -Atqc 'select current_database()')" == "t404_rpc8_ci" ]] || exit 2
[[ "$(psql -X -Atqc "select current_setting('tien404.rpc8_ephemeral',true)")" == 'RPC8_DISPOSABLE' ]] || exit 2
psql -X -v ON_ERROR_STOP=1 -q -f qa/v152-rpc8/pg17-synthetic-legacy-fixture.sql >/dev/null
psql -X -v ON_ERROR_STOP=1 -q >/dev/null <<'SQL'
BEGIN;
\i qa/v152-rpc8/pg17-m1-expand-disposable-only.sql
COMMIT;
SQL
psql -X -v ON_ERROR_STOP=1 -q -f qa/v152-rpc9/pg17-prepare-synthetic-three-store.sql >/dev/null
psql -X -v ON_ERROR_STOP=1 -q >/dev/null <<'SQL'
BEGIN;
\i qa/v152-rpc9/pg17-atomic-m2m4-disposable-only.sql
COMMIT;
SQL
# Two fake Customers introduced only after Store/Owner synthetic fixtures.
psql -X -v ON_ERROR_STOP=1 -q >/dev/null <<'SQL'
INSERT INTO qa_rpc8.customers(id,tenant_id,display_name,store_id) VALUES
('aaaaaaaa-5555-4555-8555-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','SYNTHETIC-A','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
('bbbbbbbb-5555-4555-8555-bbbbbbbbbbbb','11111111-1111-4111-8111-111111111111','SYNTHETIC-B','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
UPDATE qa_rpc8.orders SET customer_id='aaaaaaaa-5555-4555-8555-aaaaaaaaaaaa'
 WHERE id='aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa';
UPDATE qa_rpc8.orders SET customer_id='bbbbbbbb-5555-4555-8555-bbbbbbbbbbbb'
 WHERE id='bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';
SQL
query(){ psql -X -Atq -v ON_ERROR_STOP=1 -c "$1"; }
check(){
 local expected="$1" sql="$2" description="$3" got
 got="$(query "$sql")"
 [[ "$got" == "$expected" ]] || { echo "FAIL $description expected=$expected actual=[$got]";exit 1; }
 echo "PASS $description"
}
actor(){
 local id="$1" sql="$2"
 psql -X -Atq -v ON_ERROR_STOP=1 <<SQL
BEGIN;
SET LOCAL ROLE qa_rpc8_user;
SET LOCAL tien404.synthetic_actor='$id';
$sql
ROLLBACK;
SQL
}
assert_actor(){
 local id="$1" expected="$2" sql="$3" label="$4" got
 got="$(actor "$id" "$sql")"
 [[ "$got" == "$expected" ]] || { echo "FAIL $label expected=$expected actual=[$got]";exit 1; }
 echo "PASS $label"
}
A=aaaaaaaa-0000-4000-8000-000000000001
B=bbbbbbbb-0000-4000-8000-000000000002
C=cccccccc-0000-4000-8000-000000000003
check 3 'SELECT count(*) FROM qa_rpc8.products WHERE store_id IS NOT NULL' 'pre-M3 three Store-scoped synthetic Products'
check 3 'SELECT count(*) FROM qa_rpc8.orders WHERE store_id IS NOT NULL' 'pre-M3 three Store-scoped synthetic Orders'
check 2 'SELECT count(*) FROM qa_rpc8.customers WHERE store_id IS NOT NULL' 'pre-M3 two Store-scoped synthetic Customers'
check 1 "SELECT count(*) FROM pg_constraint WHERE conrelid='qa_rpc8.products'::regclass AND conname='products_tenant_id_sku_key'" 'old Tenant-wide SKU constraint present'

# Demonstrate old FK permits an Order in Store A referencing Customer in Store B
# inside the SAME TENANT; revert this deliberate wrong link.
psql -X -v ON_ERROR_STOP=1 -q >/dev/null <<'SQL'
BEGIN;
UPDATE qa_rpc8.orders
 SET customer_id='bbbbbbbb-5555-4555-8555-bbbbbbbbbbbb'
 WHERE id='aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa';
DO $legacy$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM qa_rpc8.orders o JOIN qa_rpc8.customers c
  ON o.tenant_id=c.tenant_id AND o.customer_id=c.id
  WHERE o.id='aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa'
    AND o.store_id<>c.store_id)
 THEN RAISE EXCEPTION 'RPC10_LEGACY_CROSS_STORE_NOT_REPRODUCED';END IF;
END $legacy$;
ROLLBACK;
SQL
echo 'PASS legacy tenant-only Order-to-Customer FK allows wrong Store, test rolled back'

# First run complete M3 then ROLLBACK; ensure all original constraints return.
psql -X -v ON_ERROR_STOP=1 -q >/dev/null <<'SQL'
BEGIN;
\i qa/v152-rpc10/pg17-m3-composite-fk-disposable-only.sql
ROLLBACK;
SQL
check 0 "SELECT count(*) FROM pg_constraint WHERE connamespace='qa_rpc8'::regnamespace AND conname LIKE 'rpc10_%'" 'M3 rollback removes all new FKs'
check 1 "SELECT count(*) FROM pg_constraint WHERE conrelid='qa_rpc8.products'::regclass AND conname='products_tenant_id_sku_key'" 'M3 rollback restores Tenant SKU key'
check 3 "SELECT count(*) FROM information_schema.columns WHERE table_schema='qa_rpc8' AND table_name IN ('products','orders','customers') AND column_name='store_id' AND is_nullable='YES'" 'M3 rollback restores nullable Store columns'

# Negative: a cross-Store Customer link is accepted by OLD FK but must
# trigger M3 preflight refusal before any new schema is committed.
if psql -X -v ON_ERROR_STOP=1 -q >/dev/null 2>&1 <<'SQL'
BEGIN;
UPDATE qa_rpc8.orders SET customer_id='bbbbbbbb-5555-4555-8555-bbbbbbbbbbbb'
 WHERE id='aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa';
\i qa/v152-rpc10/pg17-m3-composite-fk-disposable-only.sql
COMMIT;
SQL
then echo 'FAIL expected wrong-Store source preflight rejection';exit 1; fi
check 0 "SELECT count(*) FROM pg_constraint WHERE connamespace='qa_rpc8'::regnamespace AND conname LIKE 'rpc10_%'" 'failed preflight rolled back DDL'
check 0 'SELECT count(*) FROM qa_rpc8.orders o JOIN qa_rpc8.customers c ON o.tenant_id=c.tenant_id AND o.customer_id=c.id WHERE o.store_id<>c.store_id' 'failed preflight restored good Customer link'

# Test positive M3 COMMIT in disposable DB ONLY.
psql -X -v ON_ERROR_STOP=1 -q >/dev/null <<'SQL'
BEGIN;
\i qa/v152-rpc10/pg17-m3-composite-fk-disposable-only.sql
COMMIT;
SQL
check 4 "SELECT count(*) FROM pg_constraint WHERE connamespace='qa_rpc8'::regnamespace AND conname IN('rpc10_products_tenant_store_fk','rpc10_orders_tenant_store_fk','rpc10_customers_tenant_store_fk','rpc10_orders_same_store_customer_fk') AND convalidated" 'four composite FKs validated'
check 3 "SELECT count(*) FROM information_schema.columns WHERE table_schema='qa_rpc8' AND table_name IN('products','orders','customers') AND column_name='store_id' AND is_nullable='NO'" 'all Commerce Store IDs NOT NULL'
check 1 "SELECT count(*) FROM pg_constraint WHERE conrelid='qa_rpc8.products'::regclass AND conname='rpc10_products_tenant_store_sku_key'" 'new Store-scoped SKU uniqueness present'
check 0 "SELECT count(*) FROM pg_constraint WHERE conrelid='qa_rpc8.products'::regclass AND conname='products_tenant_id_sku_key'" 'old Tenant SKU constraint removed'
check 3 "SELECT count(*) FROM pg_policies WHERE schemaname='qa_rpc8' AND policyname IN('products_store_scoped_read','orders_store_manager_read','customers_store_manager_read')" 'M3 preserves Store-level read policies'
psql -X -v ON_ERROR_STOP=1 -q >/dev/null <<'SQL'
DO $negative$
BEGIN
 BEGIN
  UPDATE qa_rpc8.orders SET customer_id='bbbbbbbb-5555-4555-8555-bbbbbbbbbbbb'
   WHERE id='aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa';
  RAISE EXCEPTION 'RPC10_WRONG_STORE_CUSTOMER_ALLOWED';
 EXCEPTION WHEN foreign_key_violation THEN NULL;
 END;
 BEGIN
  UPDATE qa_rpc8.products SET store_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc'
   WHERE id='aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
  RAISE EXCEPTION 'RPC10_WRONG_TENANT_STORE_ALLOWED';
 EXCEPTION WHEN foreign_key_violation THEN NULL;
 END;
 BEGIN
  UPDATE qa_rpc8.products SET store_id=NULL
   WHERE id='aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
  RAISE EXCEPTION 'RPC10_NULL_STORE_ALLOWED';
 EXCEPTION WHEN not_null_violation THEN NULL;
 END;
END $negative$;
SQL
echo 'PASS M3 forbids cross-Store Customer, cross-Tenant Store and NULL Store'

# The same SKU in different stores becomes legal, same-Store duplicate remains illegal.
psql -X -v ON_ERROR_STOP=1 -q >/dev/null <<'SQL'
INSERT INTO qa_rpc8.products(id,tenant_id,sku,price_vnd,stock_on_hand,store_id)
 VALUES('dddddddd-1111-4111-8111-dddddddddddd',
 '11111111-1111-4111-8111-111111111111','QA-TENANT-ONLY',
 189000,1,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
DO $unique$
BEGIN
 BEGIN
  INSERT INTO qa_rpc8.products(id,tenant_id,sku,price_vnd,stock_on_hand,store_id)
   VALUES('eeeeeeee-1111-4111-8111-eeeeeeeeeeee',
   '11111111-1111-4111-8111-111111111111','QA-TENANT-ONLY',
    199000,1,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  RAISE EXCEPTION 'RPC10_DUPLICATE_WITHIN_STORE_ALLOWED';
 EXCEPTION WHEN unique_violation THEN NULL;
 END;
END $unique$;
DELETE FROM qa_rpc8.products WHERE id='dddddddd-1111-4111-8111-dddddddddddd';
SQL
check 3 'SELECT count(*) FROM qa_rpc8.products' 'same-SKU cross-Store synthetic row cleaned up'
assert_actor "$A" 1 'SELECT count(*) FROM qa_rpc8.customers;' 'Owner A only own Customer'
assert_actor "$B" 1 'SELECT count(*) FROM qa_rpc8.customers;' 'Manager B only own Customer'
assert_actor "$C" 0 'SELECT count(*) FROM qa_rpc8.customers;' 'Owner C no Customers from other Tenant'
assert_actor "$A" 1 'SELECT count(*) FROM qa_rpc8.orders o JOIN qa_rpc8.customers c ON o.customer_id=c.id AND o.tenant_id=c.tenant_id AND o.store_id=c.store_id;' 'Owner A same-Store Order Customer join'
assert_actor "$B" 1 'SELECT count(*) FROM qa_rpc8.orders o JOIN qa_rpc8.customers c ON o.customer_id=c.id AND o.tenant_id=c.tenant_id AND o.store_id=c.store_id;' 'Manager B same-Store Order Customer join'
psql -X -v ON_ERROR_STOP=1 -q -c "UPDATE qa_rpc8.store_memberships SET active=false WHERE user_id='$B'" >/dev/null
assert_actor "$B" 0 'SELECT count(*) FROM qa_rpc8.customers;' 'revoked B cannot read Customers'
assert_actor "$B" 0 'SELECT count(*) FROM qa_rpc8.orders;' 'revoked B cannot read Orders'
check 3 'SELECT count(*) FROM qa_rpc8.products' 'M3 retains all synthetic Products'
check 3 'SELECT count(*) FROM qa_rpc8.orders' 'M3 retains all synthetic Orders'
check 2 'SELECT count(*) FROM qa_rpc8.customers' 'M3 retains all synthetic Customers'
echo 'PASS RPC10 disposable PG17 M3: composite FK/NOT NULL/SKU, rollback and negative RLS; NOT HOSTED'
