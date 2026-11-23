import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { validateOrder, reservedQty, toVnd } from '../lib/order-rules.mjs';
import { buildValidateOrderCode } from '../n8n/build-validate-order.mjs';

const NOW = Date.parse('2026-11-24T03:00:00Z');
const hAgo = (h) => new Date(NOW - h * 3600e3).toISOString();
// Mirrors the real Sheet AI_SALES_DEMO shape (price is a number with đ format, sometimes text).
const products = [
  { sku: 'A003', name: 'Áo thun nam đen basic size L', price: 159000, stock: 18 },
  { sku: 'A010', name: 'Quần short', price: '199.000đ', stock: 6 },
  { sku: 'A011', name: 'Áo hết hàng', price: 250000, stock: 0 },
  { sku: 'A020', name: 'Còn 1 cái', price: 300000, stock: 1 },
];
const base = { customer_name: 'QA Tien', phone: '0912345678', address: '12 Lê Duẩn, Đà Nẵng', sku: 'A003', quantity: 1 };
const run = (input, orders = [], nowMs = NOW) => validateOrder({ input: { ...base, ...input }, products, orders, nowMs, runKey: 'exec6999', rand: () => 0.5 });

test('happy path: price from Sheet, never from customer', () => {
  const r = run({ unit_price: 1 });
  assert.equal(r.ok, true); assert.equal(r.unit_price, 159000); assert.equal(r.total, 159000);
  assert.match(r.order_id, /^ORD-20261124030000-exec6999-550000$/); assert.equal(r.available_after, 17);
});
test('text price "199.000đ" parsed exactly; 7 × A010 refused (only 6)', () => {
  assert.equal(run({ sku: 'A010', quantity: 6 }).total, 1194000);
  const r = run({ sku: 'A010', quantity: 7 }); assert.equal(r.ok, false); assert.equal(r.available, 6);
});
test('out of stock and unknown SKU refused; no price invented', () => {
  assert.equal(run({ sku: 'A011' }).ok, false);
  const z = run({ sku: 'Z999' }); assert.equal(z.ok, false); assert.doesNotMatch(z.message, /\d{3}\.\d{3}/);
});
test('RESERVATION: last item held by a fresh pending order -> second customer refused', () => {
  const first = run({ sku: 'A020' }); assert.equal(first.ok, true);
  const book = [{ ...first }];
  const second = run({ sku: 'A020', phone: '0987654321', customer_name: 'Khách 2' }, book, NOW + 60e3);
  assert.equal(second.ok, false); assert.equal(second.available, 0); assert.match(second.message, /còn 0/);
});
test('pending hold expires after 24h; cancelled/shipped hold nothing; confirmed/paid hold 7 days', () => {
  const o = (status, h, q = 1) => ({ order_id: 'x' + status + h, sku: 'A020', quantity: q, status, created_at: hAgo(h), phone: '0900000009' });
  assert.equal(reservedQty([o('pending', 23)], 'A020', NOW), 1);
  assert.equal(reservedQty([o('pending', 25)], 'A020', NOW), 0);
  assert.equal(reservedQty([o('cancelled', 1), o('shipped', 1), o('done', 1)], 'A020', NOW), 0);
  assert.equal(reservedQty([o('confirmed', 100), o('paid', 160)], 'A020', NOW), 2);
  assert.equal(reservedQty([o('paid', 169)], 'A020', NOW), 0);
  assert.equal(reservedQty([{ order_id: 'q', sku: 'a020', quantity: '2', status: 'Pending', created_at: '' }], 'A020', NOW), 2, 'unknown date keeps holding');
});
test('real demo Sheet: old Nov test orders do not block today (holds expired)', () => {
  const old = [
    { order_id: 'ORD-20261108132937-5612', sku: 'A001', quantity: '2', status: 'paid', created_at: '2026-11-08T13:29:37.746Z', phone: '0900000000' },
    { order_id: 'ORD-20261121162042-2323', sku: 'A003', quantity: '1', status: 'pending', created_at: '2026-11-21T16:20:42.978Z', phone: '0900000001' },
  ];
  assert.equal(reservedQty(old, 'A003', NOW), 0); assert.equal(reservedQty(old, 'A001', NOW), 0);
});
test('duplicate within 30 min reported as duplicate, not out of stock', () => {
  const first = run({ sku: 'A020' });
  const again = run({ sku: 'A020' }, [first], NOW + 5 * 60e3);
  assert.equal(again.action, 'duplicate'); assert.equal(again.order_id, first.order_id);
});
test('bad phone / qty / missing fields refused', () => {
  assert.equal(run({ phone: '12345' }).ok, false);
  assert.equal(run({ quantity: 0 }).ok, false);
  assert.equal(run({ quantity: 1.5 }).ok, false);
  assert.equal(run({ address: '' }).ok, false);
  assert.equal(run({ phone: '+84 912 345 678' }).phone, '0912345678');
});
test('VND parser rejects "1.2tr" and "12abc"', () => {
  assert.ok(Number.isNaN(toVnd('1.2tr'))); assert.ok(Number.isNaN(toVnd('12abc'))); assert.equal(toVnd('1,234,000.00'), 1234000);
});
test('generated n8n node behaves like the library (vm, fake $)', () => {
  const code = buildValidateOrderCode();
  assert.doesNotMatch(code, /httpRequest|fetch\(|require\(/);
  const items = { 'Order Input': [{ json: { ...base, sku: 'A020' } }], 'Read Products': products.map((json) => ({ json })), 'Read Orders': [] };
  const $ = (n) => ({ first: () => items[n][0], all: () => items[n] });
  const out = vm.runInNewContext('(function(){' + code + '})()', { $, $execution: { id: '7001' }, Date, Math, JSON, Number, String, Object, Array });
  assert.equal(out[0].json.ok, true); assert.equal(out[0].json.total, 300000); assert.equal(out[0].json.available_after, 0);
  items['Read Orders'] = [{ json: { ...out[0].json, phone: '0911111111' } }];
  const out2 = vm.runInNewContext('(function(){' + code + '})()', { $, $execution: { id: '7002' }, Date, Math, JSON, Number, String, Object, Array });
  assert.equal(out2[0].json.ok, false); assert.equal(out2[0].json.available, 0);
});
