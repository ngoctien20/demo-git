// PROPOSED fix for S-18 / S-19 (n8n fDB9dvs1qPPVt9Sp "Validate Change" node). NOT published to n8n.
// Patch (one line in the Code node, both Published 137d5689 and Draft 2e8786fd):
//   - if (rows.length > 1) return reject('multiple_orders', ...)
//   + if (matched.length > 1) return reject('multiple_orders', ...)
// S-19 is already fixed in the Draft apply gate (`!expected` rejects); keep that when publishing.
// Synthetic data only.
import test from 'node:test';
import assert from 'node:assert/strict';

const normPhone = (p) => { let d = String(p ?? '').replace(/\D/g, ''); if (d.startsWith('84') && d.length >= 11) d = '0' + d.slice(2); if (d.length === 9 && !d.startsWith('0')) d = '0' + d; return d; };

function fixedGuard(rows, orderId, phone) {
  const matched = rows.filter((r) => String(r.order_id).trim() === orderId && normPhone(r.phone) === normPhone(phone));
  if (matched.length === 0) return 'order_not_matched';
  if (matched.length > 1) return 'multiple_orders';
  return 'ok';
}
const draftApplyAllowed = (expected, total) => {
  const n = Number(String(expected ?? '').replace(/[^\d]/g, ''));
  return !(!expected || !Number.isFinite(n) || n !== total);
};

const sheet = [
  { order_id: 'ORD-SYN-1', phone: '0900000001' },
  { order_id: 'ORD-SYN-2', phone: '0900000002' },
  { order_id: 'ORD-SYN-3', phone: '+84 900 000 003' },
];

test('S-18 fixed: edit allowed when the sheet holds several different orders', () => {
  assert.equal(fixedGuard(sheet, 'ORD-SYN-1', '0900000001'), 'ok');
  assert.equal(fixedGuard(sheet, 'ORD-SYN-3', '0900000003'), 'ok');
});
test('S-18 fixed: wrong phone or unknown order still rejected', () => {
  assert.equal(fixedGuard(sheet, 'ORD-SYN-1', '0900000002'), 'order_not_matched');
  assert.equal(fixedGuard(sheet, 'ORD-SYN-9', '0900000001'), 'order_not_matched');
});
test('S-18 fixed: genuine duplicate order_id+phone still rejected', () => {
  const dup = [...sheet, { order_id: 'ORD-SYN-1', phone: '84900000001' }];
  assert.equal(fixedGuard(dup, 'ORD-SYN-1', '0900000001'), 'multiple_orders');
});
test('S-19 (draft gate kept): apply requires expected_total equal to the new total', () => {
  assert.equal(draftApplyAllowed(undefined, 250000), false);
  assert.equal(draftApplyAllowed('', 250000), false);
  assert.equal(draftApplyAllowed('250.000đ', 250000), true);
  assert.equal(draftApplyAllowed('240000', 250000), false);
});
