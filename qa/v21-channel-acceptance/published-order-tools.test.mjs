// V21 channel acceptance — offline replay of PUBLISHED n8n Code nodes behind the live Messenger bot.
// Level: local/mock. Products = live AI_SALES_DEMO snapshot read 2026-11-21 ~13:50Z (sku/price/stock only).
// Orders = synthetic only (no customer data). Nothing here touches n8n, Sheets or Meta.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runCode } from './harness.mjs';

const src = (f) => readFileSync(new URL('./published/' + f, import.meta.url), 'utf8');
const CREATE = src('krsn-4740251a-validate-order.js');
const STATUS = src('4dff-1faaa1ee-order-status.js');
const DETAIL = src('z7fd-f8c23034-format-selected-product.js');

// Shape returned by the n8n Google Sheets node in exec 5836 (numbers, not "159.000đ").
const PRODUCTS = [
  { sku: 'A002', name: 'Áo thun nam trắng basic size M', price: 159000, stock: 25 },
  { sku: 'A003', name: 'Áo thun nam đen basic size L', price: 159000, stock: 18 },
  { sku: 'A011', name: 'Áo polo nam đen size XL', price: 289000, stock: 0 },
];
const QA = { customer_name: 'QA Khach A', phone: '0900000001', address: 'Dia chi QA, Q1, HCM' };
const create = (input, orders = []) => runCode(CREATE, { 'Order Input': [input], 'Read Products': PRODUCTS, 'Read Orders': orders })[0].json;

test('create: missing phone/address -> rejected, no order', () => {
  const r = create({ customer_name: 'QA', sku: 'A003', quantity: 1 });
  assert.equal(r.action, 'rejected');
  assert.match(r.message, /số điện thoại/);
  assert.match(r.message, /địa chỉ/);
});
for (const q of [0, -1, 2.5, 'hai']) {
  test(`create: invalid quantity ${q} -> rejected`, () => {
    assert.equal(create({ ...QA, sku: 'A003', quantity: q }).action, 'rejected');
  });
}
test('create: over stock (A003 x19, stock 18) -> rejected with real stock', () => {
  const r = create({ ...QA, sku: 'A003', quantity: 19 });
  assert.equal(r.action, 'rejected');
  assert.match(r.message, /Hiện còn 18/);
});
test('create: out of stock A011 x1 -> rejected', () => {
  assert.equal(create({ ...QA, sku: 'A011', quantity: 1 }).action, 'rejected');
});
test('create: unknown SKU -> rejected', () => {
  assert.equal(create({ ...QA, sku: 'Z999', quantity: 1 }).action, 'rejected');
});
test('create: valid A003 x2 -> pending, 159000 x2 = 318000, stock untouched', () => {
  const r = create({ ...QA, phone: '+84 900 000 001', sku: 'a003', quantity: 2 });
  assert.equal(r.action, 'create');
  assert.match(r.order_id, /^ORD-\d{14}-\d{4}$/);
  assert.equal(r.unit_price, 159000);
  assert.equal(r.total, 318000);
  assert.equal(r.status, 'pending');
  assert.equal(r.phone, '0900000001');
  assert.equal(PRODUCTS[1].stock, 18);
});
test('create: replay of the same request within 30 min -> duplicate, same order_id', () => {
  const first = create({ ...QA, sku: 'A003', quantity: 2 });
  const sheet = [{ order_id: first.order_id, phone: "'0900000001", sku: 'A003', quantity: '2', total: 318000, status: 'pending', created_at: new Date(Date.now() - 60000).toISOString() }];
  const again = create({ ...QA, sku: 'A003', quantity: 2 }, sheet);
  assert.equal(again.action, 'duplicate');
  assert.equal(again.order_id, first.order_id);
});
test('create: KNOWN DEFECT (published) text price "1.2tr" parsed as 1.2đ', () => {
  const r = runCode(CREATE, { 'Order Input': [{ ...QA, sku: 'X001', quantity: 1 }], 'Read Products': [{ sku: 'X001', name: 'x', price: '1.2tr', stock: 5 }], 'Read Orders': [] })[0].json;
  assert.equal(r.total, 1.2); // documents the bug; draft af9ee686 rejects this
});

const ORDERS = [
  { order_id: 'ORD-SYN-A', phone: "'0900000001", sku: 'A003', quantity: 2, total: 318000, status: 'pending' },
  { order_id: 'ORD-SYN-B', phone: '0900000002', sku: 'A002', quantity: 1, total: 159000, status: 'pending' },
];
const status = (order_id, phone) => runCode(STATUS, { 'Order Status Input': [{ order_id, phone }], $input: ORDERS })[0].json;

test('status: owner A (order id + own phone) -> found with correct total', () => {
  const r = status('ORD-SYN-A', '+84900000001');
  assert.equal(r.status, 'found');
  assert.equal(r.order.total, 318000);
});
test('status: customer B knows order id but not phone -> generic reject, no data', () => {
  const r = status('ORD-SYN-A', '0900000002');
  assert.equal(r.status, 'rejected');
  assert.equal(r.order, undefined);
  assert.doesNotMatch(JSON.stringify(r), /A003|318000|0900000001/);
});
test('status: non-existent id gives the same message as wrong phone (no existence oracle)', () => {
  assert.equal(status('ORD-NOPE', '0900000002').message, status('ORD-SYN-A', '0900000002').message);
});

const detail = (sku, rows) => runCode(DETAIL, { 'Loop One Message': [{ selectedSku: sku }], $input: rows })[0].json.output;
test('postback detail A003 -> live catalog price/stock', () => {
  assert.equal(detail('A003', PRODUCTS.filter((p) => p.sku === 'A003')), 'A003 — Áo thun nam đen basic size L | 159.000đ/cái. Còn 18 cái.');
});
test('postback detail A011 -> says out of stock', () => {
  assert.match(detail('A011', PRODUCTS.filter((p) => p.sku === 'A011')), /đã hết hàng/);
});
test('postback detail text price -> refuses to quote', () => {
  assert.match(detail('X1', [{ sku: 'X1', name: 'x', price: '1.2tr', stock: 1 }]), /chưa xác minh/);
});
