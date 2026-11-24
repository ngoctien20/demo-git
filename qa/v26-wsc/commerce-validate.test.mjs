// WS-C offline test: Create Order (KrSn4DNR9ALX5ng4) and Update Order (BkAi6TVUKAjCnI7v)
// "Validate" Code nodes, Published vs Draft, run in a minimal n8n-like sandbox.
// No network, no n8n, no Google Sheet. Run: node --test qa/v26-wsc/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'nodes');
const load = (f) => readFileSync(path.join(dir, f), 'utf8');

// Wrap the node body like n8n's Code node (runOnceForAllItems): `$`, `$input`, `$execution`.
function runNode(code, { refs = {}, input = [], executionId = '9876' } = {}) {
  const $ = (name) => {
    const items = (refs[name] ?? []).map((json) => ({ json }));
    return { first: () => items[0], all: () => items };
  };
  const $input = { all: () => input.map((json) => ({ json })), first: () => ({ json: input[0] }) };
  const $execution = { id: executionId };
  // eslint-disable-next-line no-new-func
  return new Function('$', '$input', '$execution', code)($, $input, $execution);
}

const CREATE_PUB = load('create-order-validate.4740251a.js');
const CREATE_DRAFT = load('create-order-validate.af9ee686.js');
const UPDATE_PUB = load('update-order-validate.93cf227a.js');
const UPDATE_DRAFT = load('update-order-validate.3bd7043f.js');

const order = (o = {}) => ({ customer_name: 'Khach QA', phone: '0901234567', address: '12 Nguyen Trai, Q1', sku: 'A003', quantity: 1, ...o });
const create = (code, { price = 159000, stock = 18, input = {}, orders = [] } = {}) =>
  runNode(code, { refs: {
    'Order Input': [order(input)],
    'Read Products': [{ sku: 'A003', name: 'Ao QA', price, stock }],
    'Read Orders': orders,
  } })[0].json;

// ---------- Create Order: price parsing ----------
const PRICE_CASES = [
  // [label, sheet value, expected unit_price (null = must reject)]
  ['number 159000', 159000, 159000],
  ['"159000"', '159000', 159000],
  ['"159.000đ"', '159.000đ', 159000],
  ['"159.000 đ"', '159.000 đ', 159000],
  ['"159,000"', '159,000', 159000],
  ['"1,234,000.00"', '1,234,000.00', 1234000],
  ['"1.234.000,00"', '1.234.000,00', 1234000],
  ['"159000 VND"', '159000 VND', 159000],
  ['"12abc" (garbage)', '12abc', null],
  ['"1.2tr" (shorthand)', '1.2tr', null],
  ['"159,5" (decimal)', '159,5', null],
  ['159.5 (float number)', 159.5, null],
  ['"-159000" (negative)', '-159000', null],
  ['"" (blank)', '', null],
  ['"abc"', 'abc', null],
  ['"đ159.000" (prefix)', 'đ159.000', null],
];

for (const [label, price, expected] of PRICE_CASES) {
  test(`Create DRAFT price ${label} -> ${expected ?? 'reject'}`, () => {
    const r = create(CREATE_DRAFT, { price });
    if (expected === null) assert.equal(r.action, 'rejected', JSON.stringify(r));
    else { assert.equal(r.action, 'create'); assert.equal(r.unit_price, expected); assert.equal(r.total, expected); }
  });
}

// Prove the bug in Published so the report can show "before".
test('Create PUBLISHED accepts garbage price "12abc" as 12đ (P0 bug reproduced)', () => {
  const r = create(CREATE_PUB, { price: '12abc' });
  assert.equal(r.action, 'create');
  assert.equal(r.unit_price, 12);
});
test('Create PUBLISHED accepts "1.2tr" as 1.2đ (P0 bug reproduced)', () => {
  const r = create(CREATE_PUB, { price: '1.2tr' });
  assert.equal(r.action, 'create');
  assert.equal(r.unit_price, 1.2);
});
test('Create PUBLISHED accepts float 159.5 (non-integer VND)', () => {
  const r = create(CREATE_PUB, { price: 159.5 });
  assert.equal(r.action, 'create');
  assert.equal(r.unit_price, 159.5);
});
test('Create PUBLISHED: "159.000 VNĐ" -> 159000 (draft rejects, see known gap)', () => {
  assert.equal(create(CREATE_PUB, { price: '159.000 VNĐ' }).unit_price, 159000);
  assert.equal(create(CREATE_DRAFT, { price: '159.000 VNĐ' }).action, 'rejected');
});

// ---------- Create Order: totals / quantity / stock ----------
test('Create DRAFT rejects unsafe total (price*qty > MAX_SAFE_INTEGER)', () => {
  const r = create(CREATE_DRAFT, { price: 9007199254740991, stock: 10, input: { quantity: 2 } });
  assert.equal(r.action, 'rejected');
  assert.match(r.message, /giới hạn an toàn/);
});
test('Create PUBLISHED creates unsafe total (bug reproduced)', () => {
  const r = create(CREATE_PUB, { price: 9007199254740991, stock: 10, input: { quantity: 2 } });
  assert.equal(r.action, 'create');
  assert.equal(Number.isSafeInteger(r.total), false);
});
for (const q of [0, -1, 1.5, '', 'abc', null]) {
  test(`Create DRAFT rejects quantity ${JSON.stringify(q)}`, () => {
    assert.equal(create(CREATE_DRAFT, { input: { quantity: q } }).action, 'rejected');
  });
}
test('Create DRAFT stock "18" string ok, stock "18.5" rejected, stock < qty rejected', () => {
  assert.equal(create(CREATE_DRAFT, { stock: '18' }).action, 'create');
  assert.equal(create(CREATE_DRAFT, { stock: '18.5' }).action, 'rejected');
  assert.equal(create(CREATE_DRAFT, { stock: 1, input: { quantity: 2 } }).action, 'rejected');
});
test('Create DRAFT +84 phone normalised; short phone rejected', () => {
  assert.equal(create(CREATE_DRAFT, { input: { phone: '+84 901 234 567' } }).phone, '0901234567');
  assert.equal(create(CREATE_DRAFT, { input: { phone: '090123' } }).action, 'rejected');
});
test('Create DRAFT duplicate within 30 min returns duplicate, not create', () => {
  const recent = { order_id: 'ORD-X', phone: '0901234567', sku: 'A003', quantity: 1, status: 'pending', created_at: new Date(Date.now() - 60_000).toISOString(), total: 159000 };
  assert.equal(create(CREATE_DRAFT, { orders: [recent] }).action, 'duplicate');
});
test('Create DRAFT order_id embeds execution id and 6-digit suffix', () => {
  const r = create(CREATE_DRAFT);
  assert.match(r.order_id, /^ORD-\d{14}-9876-\d{6}$/);
});
test('Create DRAFT output schema keys unchanged vs PUBLISHED (Append Order mapping compatible)', () => {
  assert.deepEqual(Object.keys(create(CREATE_DRAFT)).sort(), Object.keys(create(CREATE_PUB)).sort());
});

// ---------- Update Order ----------
const upd = (code, { input = {}, rows } = {}) => runNode(code, {
  refs: { 'When Executed by Another Workflow': [{ order_id: 'ORD-1', phone: '0901234567', new_address: '45 Le Loi, Quan 1, HCM', ...input }] },
  input: rows ?? [{ order_id: 'ORD-1', phone: 901234567, status: 'pending', address: '12 Nguyen Trai', row_number: 2 }],
})[0].json;

test('Update DRAFT accepts valid mobile + address, phone stored as number (leading 0 lost)', () => {
  const r = upd(UPDATE_DRAFT);
  assert.equal(r.ok, true);
  assert.equal(r.row_number, 2);
});
for (const p of ['0123456789', '0212345678', '0412345678', '0612345678', '1234567890']) {
  test(`Update DRAFT rejects non-mobile prefix ${p}; PUBLISHED accepted length-10`, () => {
    assert.equal(upd(UPDATE_DRAFT, { input: { phone: p } }).reason, 'invalid_phone');
    assert.notEqual(upd(UPDATE_PUB, { input: { phone: p } }).reason, 'invalid_phone');
  });
}
for (const p of ['0312345678', '0512345678', '0712345678', '0812345678', '0912345678', '+84912345678']) {
  test(`Update DRAFT accepts mobile prefix ${p}`, () => {
    assert.notEqual(upd(UPDATE_DRAFT, { input: { phone: p } }).reason, 'invalid_phone');
  });
}
test('Update DRAFT rejects digits-only address "1234567890"; PUBLISHED accepted it', () => {
  assert.equal(upd(UPDATE_DRAFT, { input: { new_address: '1234567890' } }).reason, 'address_too_short');
  assert.equal(upd(UPDATE_PUB, { input: { new_address: '1234567890' } }).ok, true);
});
test('Update DRAFT keeps anti-enumeration: wrong phone == not found message', () => {
  const a = upd(UPDATE_DRAFT, { input: { phone: '0987654321' } });
  const b = upd(UPDATE_DRAFT, { rows: [{}] });
  assert.equal(a.reason, 'order_not_matched');
  assert.equal(a.message, b.message);
});
test('Update DRAFT rejects non-pending order', () => {
  assert.equal(upd(UPDATE_DRAFT, { rows: [{ order_id: 'ORD-1', phone: '0901234567', status: 'shipped', address: 'x' }] }).reason, 'not_editable');
});

// ---------- Residual gaps NOT fixed by the draft (documented, PROPOSED follow-up) ----------
test('GAP: Create DRAFT still coerces quantity "1e2"->100, "0x10"->16, true->1 via Number()', () => {
  assert.equal(create(CREATE_DRAFT, { stock: 500, input: { quantity: '1e2' } }).quantity, 100);
  assert.equal(create(CREATE_DRAFT, { stock: 500, input: { quantity: '0x10' } }).quantity, 16);
  assert.equal(create(CREATE_DRAFT, { input: { quantity: true } }).quantity, 1);
});
test('GAP: Create accepts landline 02x phone, Update DRAFT then refuses self-service address change', () => {
  assert.equal(create(CREATE_DRAFT, { input: { phone: '0283456789' } }).action, 'create');
  assert.equal(upd(UPDATE_DRAFT, { input: { phone: '0283456789' } }).reason, 'invalid_phone');
});
