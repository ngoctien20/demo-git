import test from 'node:test';
import assert from 'node:assert/strict';
import { parseOwner, parseBankNotice } from '../lib/parse-owner.mjs';
import { parseMoney } from '../lib/vn.mjs';

const skus = ['A003', 'A006', 'A010'];
const P = (t) => parseOwner(t, { skus });

test('số tiền kiểu Việt Nam', () => {
  const cases = { '318k': 318000, '318.000': 318000, '318,000đ': 318000, '1tr2': 1200000, '1,5tr': 1500000, '2 triệu': 2000000, '150 nghìn': 150000, '1tr250': 1250000, '45000': 45000 };
  for (const [s, v] of Object.entries(cases)) assert.equal(parseMoney(s), v, s);
  assert.ok(Number.isNaN(parseMoney('abc')));
});

test('đơn có mã hàng, số lượng, địa chỉ, SĐT, có dấu và không dấu như nhau', () => {
  for (const t of ['chị Lan 2 cái A003 giao Q7 0912345678', 'chi lan 2 cai a003 giao q7 0912345678']) {
    const d = P(t);
    assert.equal(d.kind, 'order');
    assert.deepEqual(d.items, [{ sku: 'A003', qty: 2 }]);
    assert.equal(d.phone, '0912345678');
    assert.match(d.address, /^[qQ]7$/);
    assert.match(d.name, /^ch[iị] [lL]an$/);
  }
});

test('nhiều món, phí ship, giảm giá, cọc, COD', () => {
  const d = P('2A003 1 A006 ship 30k giảm 20k tổng 600k giao 12 Lê Lợi, Q1');
  assert.deepEqual(d.items, [{ sku: 'A003', qty: 2 }, { sku: 'A006', qty: 1 }]);
  assert.equal(d.ship, 30000); assert.equal(d.discount, 20000); assert.equal(d.amount, 600000);
  assert.equal(d.address, '12 Lê Lợi, Q1');
  const c = P('anh Tuấn 1tr2 cod cọc 200k');
  assert.equal(c.amount, 1200000); assert.equal(c.cod, true); assert.equal(c.deposit, 200000); assert.equal(c.name, 'anh Tuấn');
  assert.deepEqual(P('Lan A003 x2').items, [{ sku: 'A003', qty: 2 }]);
});

test('đơn chỉ có số tiền (không cần kho)', () => {
  const d = P('cô Hoa 350k');
  assert.equal(d.kind, 'order'); assert.equal(d.amount, 350000); assert.deepEqual(d.items, []); assert.equal(d.name, 'cô Hoa');
});

test('mã hàng chưa có trong kho được báo, Q7/P12 không bị coi là mã hàng', () => {
  assert.deepEqual(P('A099 2 cái').unknown, ['A099']);
  assert.deepEqual(P('chị Lan 300k giao P12 Q10').unknown, []);
});

test('các lệnh của chủ', () => {
  assert.deepEqual(P('đã nhận đơn 12'), { kind: 'paid', ref: { no: 12 }, amount: null });
  assert.deepEqual(P('đã nhận 100k chị Lan'), { kind: 'paid', ref: { name: 'lan' }, amount: 100000 });
  assert.deepEqual(P('huỷ T404ABCDEF'), { kind: 'cancel', ref: { code: 'T404ABCDEF' } });
  assert.deepEqual(P('gia hạn chị Lan'), { kind: 'extend', ref: { name: 'lan' } });
  assert.deepEqual(P('đã giao 12'), { kind: 'shipped', ref: { no: 12 } });
  assert.deepEqual(P('qr 12'), { kind: 'resend', ref: { no: 12 } });
  for (const [t, k] of [['ai chưa trả', 'unpaid'], ['hôm nay', 'report'], ['kho', 'stock'], ['phí', 'fee'], ['in qr', 'shopqr'], ['1', 'yes'], ['ok', 'yes'], ['2', 'no'], ['giúp', 'help'], ['xin chào', 'help'], ['abc xyz', 'unknown']]) {
    assert.equal(P(t).kind, k, t);
  }
});

test('nhắn số tài khoản', () => {
  const b = P('ngân hàng Vietcombank 1012 345 678 Trần Thị Bé');
  assert.equal(b.kind, 'bank'); assert.equal(b.bank.bin, '970436'); assert.equal(b.account, '1012345678'); assert.equal(b.holder, 'Trần Thị Bé');
});

test('thêm hàng / nhập hàng / đổi giá', () => {
  assert.deepEqual(P('thêm hàng A020 áo khoác nữ 250k còn 10'), { kind: 'product', sku: 'A020', name: 'áo khoác nữ', price: 250000, stock: 10 });
  assert.deepEqual(P('nhập 10 A003'), { kind: 'restock', sku: 'A003', qty: 10 });
  assert.deepEqual(P('giá A003 165k'), { kind: 'price', sku: 'A003', price: 165000 });
});

test('tin biến động số dư chủ dán vào', () => {
  const n = parseBankNotice('TK 0123456789 +318,000VND 25/11/26 10:02 SD: 1,234,000VND ND: MBVCB.123.T404AB CDEF.CT tu');
  assert.equal(n.amount, 318000); assert.equal(n.code, 'T404ABCDEF');
  assert.equal(P('TK 0123456789 +318,000VND ND: T404ABCDEF').kind, 'bank_notice');
  assert.equal(parseBankNotice('chị Lan 300k'), null);
});
