// Isolated test for the exact published DEMO order-status verifier, with synthetic rows only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/demo-order-status.json', import.meta.url), 'utf8'));
const order = {
  order_id: 'QA-ORDER-01',
  phone: '0912345678',
  status: 'pending',
  sku: 'A002',
  quantity: 2,
  total: 318000,
  customer_name: 'SYNTHETIC CUSTOMER',
  address: 'SYNTHETIC ADDRESS',
  created_at: '2026-11-22T08:00:00Z',
};
const json = (x) => ({ json: x });
function call({ order_id = order.order_id, phone = order.phone, rows = [order] } = {}) {
  const $ = (name) => {
    assert.equal(name, 'Order Status Input');
    return { first: () => ({ json: { order_id, phone } }) };
  };
  const $input = { all: () => rows.map(json) };
  const output = vm.runInNewContext('(function(){\n' + fixture.verifyCode + '\n})()', { $, $input }, { timeout: 1000 });
  return JSON.parse(JSON.stringify(output[0].json));
}

test('status verifier belongs to isolated AI_SALES_DEMO and reads by order_id', () => {
  assert.equal(fixture.sourceMode, 'AI_SALES_DEMO_ONLY');
  assert.equal(fixture.readNode.operation, 'read');
  assert.equal(fixture.readNode.lookupKey, 'order_id');
  assert.equal(fixture.readNode.alwaysOutputData, true);
  assert.ok(fixture.publishedVersion);
});

test('valid synthetic order id + phone returns only verified order metadata', () => {
  const r = call();
  assert.equal(r.success, true);
  assert.equal(r.status, 'found');
  assert.equal(r.order.sku, 'A002');
  assert.equal(r.order.quantity, 2);
  assert.equal(r.order.total, 318000);
  assert.equal(r.order.status, 'pending');
  assert.equal(r.order.phone, undefined);
  assert.equal(r.order.address, undefined);
  assert.equal(r.order.customer_name, undefined);
});

test('wrong phone cannot read the order and rejection message reveals no metadata', () => {
  const r = call({ phone: '0988888888' });
  assert.equal(r.success, false);
  assert.equal(r.status, 'rejected');
  assert.equal(r.order, undefined);
  assert.doesNotMatch(JSON.stringify(r), /A002|318000|0912345678|SYNTHETIC/);
});

test('wrong order id cannot read the order despite correct phone', () => {
  const r = call({ order_id: 'QA-ORDER-WRONG' });
  assert.equal(r.success, false);
  assert.equal(r.order, undefined);
  assert.doesNotMatch(JSON.stringify(r), /A002|318000|0912345678|SYNTHETIC/);
});

test('missing order id or phone must not invoke an authorized status return', () => {
  for(const input of [
    { order_id: '', phone: '0912345678' },
    { order_id: 'QA-ORDER-01', phone: '' },
    { order_id: 'QA-ORDER-01', phone: 'x' },
    { order_id: 'QA-ORDER-01', phone: '1234567' },
  ]) {
    const r = call(input);
    assert.equal(r.success, false, JSON.stringify(input));
    assert.equal(r.status, 'rejected');
  }
});

test('VN +84 phone normalization matches the same order', () => {
  const r = call({ phone: '+84912345678' });
  assert.equal(r.success, true);
  assert.equal(r.status, 'found');
});

test('no matching row emits safe rejection and does not claim fulfillment', () => {
  const r = call({ rows: [{}] });
  assert.equal(r.success, false);
  assert.equal(r.status, 'rejected');
  assert.doesNotMatch(r.message, /đã thanh toán|đã giao|đã hoàn thành/i);
});

test('duplicate order ID fails closed instead of exposing either record', () => {
  const r = call({ rows: [{...order}, {...order, status: 'delivered', total: 500000}] });
  assert.equal(r.success, false);
  assert.equal(r.order, undefined);
});

test('unrecognized order status is not reported as successful verification', () => {
  const r = call({ rows: [{ ...order, status: 'made_up_success' }] });
  assert.equal(r.success, false);
  assert.equal(r.status, 'unverified');
  assert.equal(r.order, undefined);
});

test('known paid status only reflects a DEMO order status, not independent payment verification', () => {
  const r = call({ rows: [{ ...order, status: 'paid' }] });
  assert.equal(r.success, true);
  assert.equal(r.order.status, 'paid');
  assert.equal(r.payment_verified, undefined);
  assert.equal(r.order.payment_verified, undefined);
});
