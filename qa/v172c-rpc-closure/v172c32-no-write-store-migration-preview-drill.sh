#!/usr/bin/env bash
# V17.2C.32 — NO-WRITE TO CONNECTED SUPABASE.
# Only GitHub Actions ephemeral PG17 service at 127.0.0.1.
set -euo pipefail
[[ "${PGHOST:-}" == "127.0.0.1" && "${PGDATABASE:-}" == "postgres" &&
   "${PGUSER:-}" == "postgres" && "${PGPORT:-}" == "5432" ]] || {
  echo "DENY: NOT_EPHEMERAL_POSTGRES" >&2; exit 91; }
r='tien404_v172c32_preview'
root='qa/v172c-rpc-closure'
A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
C='cccccccc-cccc-4ccc-8ccc-cccccccccccc'
UNKNOWN='ffffffff-ffff-4fff-8fff-ffffffffffff'
SA='11111111-1111-4111-8111-111111111111'
SB='22222222-2222-4222-8222-222222222222'
SC='33333333-3333-4333-8333-333333333333'
T1='dddddddd-dddd-4ddd-8ddd-dddddddddddd'
T2='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
OA='10101010-1010-4010-8010-101010101010'
OB='20202020-2020-4020-8020-202020202020'
OLD='30303030-3030-4030-8030-303030303030'
OC='40404040-4040-4040-8040-404040404040'

psql -X -q -v ON_ERROR_STOP=1 -f "$root/v172c32-ephemeral-current-commerce-baseline.sql"
as_actor(){
 local actor="$1" statement="$2"
 psql -X -qAt -v ON_ERROR_STOP=1 <<SQL
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '$actor';
$statement
ROLLBACK;
SQL
}
orders(){
 as_actor "$1" "SELECT COALESCE(string_agg(id::text,',' ORDER BY id::text),'NONE') FROM $r.orders;" | grep -v '^$'
}
items(){
 as_actor "$1" "SELECT COALESCE(string_agg(id::text,',' ORDER BY id::text),'NONE') FROM $r.order_items;" | grep -v '^$'
}
names(){
 local actor="$1" table="$2" column="$3"
 as_actor "$actor" "SELECT COALESCE(string_agg($column,',' ORDER BY $column),'NONE') FROM $r.$table;" | grep -v '^$'
}
# Pre-migration baseline reproduces tenant SELECT policy: both tenant 1
# users see A and B orders even when their intended Store ownership differs.
baseline_A="$(orders "$A")";baseline_B="$(orders "$B")"
[[ "$baseline_A" == "$baseline_B" ]] || { echo 'Baseline mismatch';exit 2; }
[[ "$baseline_A" == *"$OA"* && "$baseline_A" == *"$OB"* && "$baseline_A" == *"$OLD"* ]] || {
 echo 'Tenant-only baseline did not expose synthetic same-tenant rows';exit 3;}
echo "Baseline reproduced: same-tenant users see unpartitioned orders (synthetic only)"

psql -X -q -v ON_ERROR_STOP=1 -f "$root/v172c32-store-authority-expansion-preview_NOT_EXECUTED.sql"
# Existing rows are NOT assigned a Store by the migration.
[[ "$(psql -X -qAt -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM $r.orders WHERE store_id IS NULL;")" == "4" ]] || {
 echo 'Legacy Store IDs were silently assigned'; exit 4; }
[[ "$(orders "$A")" == "NONE" && "$(orders "$B")" == "NONE" ]] || {
 echo 'Unverified legacy Orders remained exposed';exit 5;}
echo 'Preview migration: all 4 legacy orders remain NULL/hidden (no guessing)'

# The operator can assign ONLY explicitly known SYNTHETIC provenance on CI.
# The legacy OLD row intentionally remains NULL/hidden for future review.
psql -X -q -v ON_ERROR_STOP=1 <<SQL
INSERT INTO $r.stores(tenant_id,store_id,store_label,active) VALUES
 ('$T1','$SA','synthetic Store A',true),
 ('$T1','$SB','synthetic Store B',true),
 ('$T2','$SC','synthetic Store C',true);
INSERT INTO $r.store_memberships(tenant_id,store_id,user_id,role,active) VALUES
 ('$T1','$SA','$A','owner',true),
 ('$T1','$SB','$B','manager',true),
 ('$T2','$SC','$C','owner',true);
UPDATE $r.products SET store_id='$SA' WHERE id='51515151-5151-4515-8515-515151515151';
UPDATE $r.products SET store_id='$SB' WHERE id='52525252-5252-4525-8525-525252525252';
UPDATE $r.products SET store_id='$SC' WHERE id='53535353-5353-4535-8535-535353535353';
UPDATE $r.customers SET store_id='$SA' WHERE id='71717171-7171-4717-8717-717171717171';
UPDATE $r.customers SET store_id='$SB' WHERE id='72727272-7272-4727-8727-727272727272';
UPDATE $r.customers SET store_id='$SC' WHERE id='73737373-7373-4737-8737-737373737373';
UPDATE $r.orders SET store_id='$SA' WHERE id='$OA';
UPDATE $r.orders SET store_id='$SB' WHERE id='$OB';
UPDATE $r.orders SET store_id='$SC' WHERE id='$OC';
UPDATE $r.order_items SET store_id='$SA' WHERE id='61616161-6161-4616-8616-616161616161';
UPDATE $r.order_items SET store_id='$SB' WHERE id='62626262-6262-4626-8626-626262626262';
UPDATE $r.order_items SET store_id='$SC' WHERE id='63636363-6363-4636-8636-636363636363';
SQL
[[ "$(orders "$A")" == "$OA" ]] || { echo 'A Order Store isolation FAILED';exit 6; }
[[ "$(orders "$B")" == "$OB" ]] || { echo 'B Order Store isolation FAILED';exit 7; }
[[ "$(orders "$C")" == "$OC" ]] || { echo 'C cross-tenant isolation FAILED';exit 8; }
[[ "$(orders "$UNKNOWN")" == "NONE" ]] || { echo 'Unknown user Order read';exit 9; }
[[ "$(items "$A")" == '61616161-6161-4616-8616-616161616161' ]] || { echo 'Item A leak';exit 10; }
[[ "$(items "$B")" == '62626262-6262-4626-8626-626262626262' ]] || { echo 'Item B leak';exit 11; }
[[ "$(names "$A" products sku)" == 'A-SKU' && "$(names "$B" products sku)" == 'B-SKU' ]] || {
 echo 'Products scope FAILED';exit 12;}
[[ "$(names "$A" customers display_name)" == 'Synthetic A' && "$(names "$B" customers display_name)" == 'Synthetic B' ]] || {
 echo 'Customers scope FAILED';exit 13;}
[[ "$(psql -X -qAt -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM $r.orders WHERE id='$OLD' AND store_id IS NULL;")" == "1" ]] || {
 echo 'Unverified old order assigned a Store';exit 14;}
echo 'Scoped Orders/Items/Products/Customers A/B/C PASS; legacy unknown remains hidden'

# Composite FK denies connecting order of A to a product of B.
if psql -X -q -v ON_ERROR_STOP=1 -c "UPDATE $r.order_items SET store_id='$SB' WHERE id='61616161-6161-4616-8616-616161616161';" >/tmp/v172c32-item-cross-fk.log 2>&1;then
 echo 'FAIL: mismatched order/product Store allowed';exit 15;fi
grep -qi 'foreign key constraint' /tmp/v172c32-item-cross-fk.log
# Customer B cannot be linked to Order A even inside one tenant.
if psql -X -q -v ON_ERROR_STOP=1 -c "UPDATE $r.orders SET customer_id='72727272-7272-4727-8727-727272727272' WHERE id='$OA';" >/tmp/v172c32-customer-cross-fk.log 2>&1;then
 echo 'FAIL: Store A Order references Store B Customer';exit 16;fi
grep -qi 'foreign key constraint' /tmp/v172c32-customer-cross-fk.log
# Same SKU in two stores is *still* disallowed by old (tenant_id,sku)
# uniqueness. It is an unresolved compatibility issue, not fixed here.
if psql -X -q -v ON_ERROR_STOP=1 -c "INSERT INTO $r.products(id,tenant_id,store_id,sku,name,price_vnd) VALUES ('59595959-5959-4595-8595-595959595959','$T1','$SB','A-SKU','Duplicate SKU in B',159000);" >/tmp/v172c32-sku-constraint.log 2>&1;then
 echo 'FAIL: legacy uniqueness was silently dropped';exit 17;fi
grep -qi 'duplicate key value violates unique constraint' /tmp/v172c32-sku-constraint.log
echo 'Composite Store FK protection PASS; legacy tenant-wide SKU constraint retained (known gap)'

# Authenticated cannot mutate Orders or alter Store membership.
if as_actor "$A" "UPDATE $r.orders SET status='paid' WHERE id='$OA';" >/tmp/v172c32-update-denied.log 2>&1;then
 echo 'FAIL: direct Auth writes allowed';exit 18;fi
grep -qi 'permission denied' /tmp/v172c32-update-denied.log
if as_actor "$B" "UPDATE $r.store_memberships SET active=true WHERE user_id='$A';" >/tmp/v172c32-selfgrant-denied.log 2>&1;then
 echo 'FAIL: client modified Store membership';exit 19;fi
grep -qi 'permission denied' /tmp/v172c32-selfgrant-denied.log

# Role and RLS must both respect immediate store and tenant revocation.
psql -X -q -v ON_ERROR_STOP=1 -c "UPDATE $r.store_memberships SET active=false WHERE user_id='$A';"
[[ "$(orders "$A")" == 'NONE' ]] || { echo 'Revoked Store A read still open';exit 20; }
psql -X -q -v ON_ERROR_STOP=1 -c "UPDATE $r.tenant_memberships SET active=false WHERE user_id='$B';"
[[ "$(orders "$B")" == 'NONE' ]] || { echo 'Revoked tenant B read still open';exit 21; }
echo 'Direct writes and forged membership denied; tenant and Store revocation PASS'
# No migration cutover on hosted environment, no data mutation on real Supabase.
