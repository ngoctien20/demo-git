#!/usr/bin/env bash
# V17.2C.30 ONLY the GitHub Actions ephemeral Postgres service.
set -euo pipefail
[[ "${PGHOST:-}" == '127.0.0.1' && "${PGDATABASE:-}" == 'postgres' &&
   "${PGUSER:-}" == 'postgres' && "${PGPORT:-}" == '5432' ]] || {
 echo 'DENY: not isolated CI PostgreSQL' >&2; exit 91; }
root='qa/v172c-rpc-closure'
psql -X -q -v ON_ERROR_STOP=1 -f "$root/v172c30-ephemeral-orders-rls-fixture.sql"
A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
C='cccccccc-cccc-4ccc-8ccc-cccccccccccc'
V='dddddddd-dddd-4ddd-8ddd-dddddddddddd'
UNKNOWN='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
base='tien404_v172c30_orders_qa.orders'
as_actor() {
 local id="$1" sql="$2"
 psql -X -qAt -v ON_ERROR_STOP=1 <<SQL
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '$id';
$sql
ROLLBACK;
SQL
}
seen() {
 as_actor "$1" "SELECT COALESCE(string_agg(order_id,',' ORDER BY order_id),'NONE') FROM $base;" | grep -v '^$'
}
[[ "$(seen "$A")" == 'SYN-ORDER-A' ]] || { echo 'A isolation failed'; exit 2; }
[[ "$(seen "$B")" == 'SYN-ORDER-B' ]] || { echo 'B isolation failed'; exit 3; }
[[ "$(seen "$C")" == 'SYN-ORDER-C' ]] || { echo 'C cross-tenant isolation failed'; exit 4; }
[[ "$(seen "$V")" == 'SYN-ORDER-B' ]] || { echo 'Viewer read failed'; exit 5; }
[[ "$(seen "$UNKNOWN")" == 'NONE' ]] || { echo 'Unknown actor leaked'; exit 6; }
echo 'Orders read: A/B same-tenant separation; C cross-tenant; viewer; unknown PASS'

affected() {
 local id="$1" order="$2"
 as_actor "$id" "WITH changed AS (UPDATE $base SET status='confirmed' WHERE order_id='$order' RETURNING order_id) SELECT count(*) FROM changed;" | grep -v '^$'
}
[[ "$(affected "$A" 'SYN-ORDER-A')" == '1' ]] || { echo 'A own update failed'; exit 7; }
[[ "$(affected "$B" 'SYN-ORDER-B')" == '1' ]] || { echo 'B own update failed'; exit 8; }
[[ "$(affected "$A" 'SYN-ORDER-B')" == '0' ]] || { echo 'A modified B'; exit 9; }
[[ "$(affected "$B" 'SYN-ORDER-A')" == '0' ]] || { echo 'B modified A'; exit 10; }
[[ "$(affected "$A" 'SYN-ORDER-C')" == '0' ]] || { echo 'Cross-tenant C write'; exit 11; }
[[ "$(affected "$V" 'SYN-ORDER-B')" == '0' ]] || { echo 'Viewer modified B'; exit 12; }
[[ "$(affected "$UNKNOWN" 'SYN-ORDER-A')" == '0' ]] || { echo 'Unknown actor modified A'; exit 13; }
echo 'Orders status updates: owner own allowed and transaction rolled back; cross-store, cross-tenant, viewer, stranger DENIED'

# Even on an owned order, no update to totals or tenant/store authority.
if as_actor "$A" "UPDATE $base SET total_vnd=1 WHERE order_id='SYN-ORDER-A';" > /tmp/tien404-v172c30-total-denied.log 2>&1; then
 echo 'FAIL: authenticated owner could change order monetary total'; exit 14
fi
grep -qi 'permission denied' /tmp/tien404-v172c30-total-denied.log
if as_actor "$A" "UPDATE $base SET store_id='store-B' WHERE order_id='SYN-ORDER-A';" > /tmp/tien404-v172c30-store-denied.log 2>&1; then
 echo 'FAIL: authenticated owner could change order Store'; exit 15
fi
grep -qi 'permission denied' /tmp/tien404-v172c30-store-denied.log
if psql -X -q -v ON_ERROR_STOP=1 <<'SQL' > /tmp/tien404-v172c30-anon-denied.log 2>&1
BEGIN;
SET LOCAL ROLE anon;
SELECT * FROM tien404_v172c30_orders_qa.orders;
ROLLBACK;
SQL
then
 echo 'FAIL: anon read orders'; exit 16
fi
grep -qi 'permission denied' /tmp/tien404-v172c30-anon-denied.log
# All attempted updates were within ROLLBACK: confirm persisted rows still pending.
remain="$(psql -X -qAt -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM $base WHERE status='pending';")"
[[ "$remain" == '3' ]] || { echo "FAIL: status changed after rollback: $remain"; exit 17; }
echo 'Orders immutable amount/store fields, anon denial and rollback persistence 3/3 PASS'

# Once membership revoked, previous synthetic claim no longer permits read or write.
psql -X -q -v ON_ERROR_STOP=1 -c "UPDATE tien404_v172c30_orders_qa.memberships SET active=false WHERE subject_id='$A';"
[[ "$(seen "$A")" == 'NONE' ]] || { echo 'Revoked A read allowed'; exit 18; }
[[ "$(affected "$A" 'SYN-ORDER-A')" == '0' ]] || { echo 'Revoked A write allowed'; exit 19; }
echo 'Membership revoked: A read/write both denied PASS'

# No privilege escalation to direct membership editing by authenticated.
if as_actor "$B" "UPDATE tien404_v172c30_orders_qa.memberships SET role='owner' WHERE subject_id='$V';" > /tmp/tien404-v172c30-membership-denied.log 2>&1; then
 echo 'FAIL: client edited membership role'; exit 20
fi
grep -qi 'permission denied' /tmp/tien404-v172c30-membership-denied.log
echo 'No direct membership privilege escalation PASS'
