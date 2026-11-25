import test from 'node:test';
import assert from 'node:assert/strict';
import { shop, T0 } from './helpers.mjs';
import { parseVietQr } from '../lib/vietqr.mjs';
import { available, monthFee, FEE, newShop, ownerMessage } from '../lib/engine.mjs';

test('vòng đầy đủ: chủ nhắn → đơn → giữ hàng → QR đúng tiền → tiền về → báo chủ', () => {
  const s = shop();
  const out = s.say('chị Lan 2 cái A003 giao Q7 0912345678');
  assert.match(out[0].text, /ĐƠN SỐ 1 · chị Lan[\s\S]*TỔNG: 318\.000đ[\s\S]*giữ hàng tới 22:00 hôm nay/);
  const q = parseVietQr(out[1].qr.payload);
  assert.equal(q.amount, 318000); assert.equal(q.account, '0123456789'); assert.equal(q.bin, '970422');
  assert.equal(q.memo, s.order(1).code);
  assert.match(out[1].text, /Shop Thử gửi chị Lan:[\s\S]*Số tiền: 318\.000đ[\s\S]*Nội dung: T404/);
  assert.equal(available(s.st, 'A003', s.ctx.now), 16);
  const r = s.bank({ id: 'sepay:1', amount: 318000, memo: 'MBVCB.9.' + s.order(1).code + '.CT', account: '0123456789' });
  assert.equal(r.result, 'paid');
  assert.match(r.out[0].text, /TIỀN VỀ · ĐƠN 1[\s\S]*Đã đủ tiền/);
  assert.equal(s.order(1).status, 'da_tra');
  s.say('đã giao 1');
  assert.equal(s.st.products.A003.stock, 16);
  assert.equal(available(s.st, 'A003', s.ctx.now), 16);
});

test('không bán quá tồn: món cuối đã có người giữ thì khách sau bị từ chối', () => {
  const s = shop();
  s.say('chị Hà A011');
  const out = s.say('anh Nam A011');
  assert.match(out[0].text, /chỉ còn 0 cái[\s\S]*Chưa tạo đơn/);
  assert.equal(s.st.orders.length, 1);
});

test('hết giờ giữ hàng thì tự nhả, tiền về trễ vẫn ghi nhận và báo có còn hàng không', () => {
  const s = shop();
  s.say('chị Hà A011');
  s.ctx.now = T0 + 13 * 3600e3;
  const out = s.tick();
  assert.match(out[0].text, /Hết giờ giữ hàng[\s\S]*Đơn 1/);
  assert.equal(s.order(1).status, 'het_han');
  assert.equal(available(s.st, 'A011', s.ctx.now), 1);
  s.say('anh Nam A011');
  const r = s.bank({ id: 'x2', amount: 289000, memo: s.order(1).code });
  assert.equal(r.result, 'paid');
  assert.match(r.out[0].text, /Tiền về trễ và hàng đã hết/);
});

test('chuyển thiếu, chuyển dư, chuyển trùng, sai tài khoản', () => {
  const s = shop();
  s.say('cô Hoa 350k');
  const code = s.order(1).code;
  let r = s.bank({ id: 'a', amount: 300000, memo: code });
  assert.equal(r.result, 'partial'); assert.match(r.out[0].text, /Còn thiếu 50\.000đ/);
  assert.equal(s.order(1).status, 'tra_thieu');
  assert.equal(s.bank({ id: 'a', amount: 300000, memo: code }).result, 'duplicate');
  assert.equal(s.bank({ id: 'z', amount: 50000, memo: code, account: '999999999' }).result, 'not_our_account');
  r = s.bank({ id: 'b', amount: 70000, memo: code });
  assert.equal(r.result, 'paid'); assert.match(r.out[0].text, /chuyển dư 20\.000đ/);
});

test('tiền về không có mã: chỉ HỎI khi đúng 1 đơn cùng số tiền, chủ bấm 1 mới ghi', () => {
  const s = shop();
  s.say('cô Hoa 350k'); s.say('anh Tú 120k');
  const r = s.bank({ id: 'n1', amount: 350000, memo: 'chuyen tien hang' });
  assert.equal(r.result, 'ask_match');
  assert.equal(s.order(1).status, 'cho_tra');
  s.say('1');
  assert.equal(s.order(1).status, 'da_tra');
  s.say('chị Mơ 120k');
  assert.equal(s.bank({ id: 'n2', amount: 120000, memo: 'ck' }).result, 'unmatched'); // 2 đơn cùng 120k → không đoán
});

test('chủ dán tin ngân hàng → tự khớp đơn', () => {
  const s = shop();
  s.say('cô Hoa 350k');
  const out = s.say('TK 0123456789 +350,000VND 25/11 ND: ' + s.order(1).code + ' chuyen tien');
  assert.match(out[0].text, /TIỀN VỀ · ĐƠN 1[\s\S]*tin ngân hàng bác chuyển/);
});

test('giá bác nhắn khác giá kho → hỏi, không tự chọn', () => {
  const s = shop();
  const out = s.say('chị Lan 2 A003 tổng 300k');
  assert.match(out[0].text, /Giá trong kho: 318\.000đ, bác nhắn 300\.000đ/);
  assert.equal(s.st.orders.length, 0);
  const ok = s.say('1');
  assert.equal(s.order(1).total, 300000);
  assert.equal(parseVietQr(ok[1].qr.payload).amount, 300000);
});

test('gửi trùng đơn trong 30 phút → hỏi trước khi tạo thêm', () => {
  const s = shop();
  s.say('chị Lan 2 A003');
  assert.match(s.say('chị Lan 2 A003')[0].text, /giống hệt/);
  s.say('2');
  assert.equal(s.st.orders.length, 1);
});

test('COD có cọc: QR chỉ cho tiền cọc; COD không cọc: không QR', () => {
  const s = shop();
  const a = s.say('anh Tuấn 1tr2 cod cọc 200k');
  assert.equal(parseVietQr(a[1].qr.payload).amount, 200000);
  const b = s.say('chị Mai 500k cod');
  assert.equal(b.length, 1); assert.equal(s.order(2).status, 'cod');
  s.bank({ id: 'c', amount: 200000, memo: s.order(1).code });
  assert.equal(s.order(1).status, 'cod');
});

test('chưa có số tài khoản: vẫn tạo đơn, nhắc cài tài khoản, không có QR', () => {
  const st = newShop({ now: T0 });
  const r = ownerMessage(st, 'cô Hoa 350k', { now: T0, rand: Math.random });
  assert.equal(r.out.length, 1); assert.match(r.out[0].text, /Chưa có số tài khoản/);
});

test('huỷ đơn đã nhận tiền thì nhắc hoàn tiền; ai chưa trả; báo cáo tối 1 lần/ngày', () => {
  const s = shop();
  s.say('cô Hoa 350k'); s.say('anh Tú 120k');
  s.bank({ id: 'p', amount: 120000, memo: s.order(2).code });
  assert.match(s.say('ai chưa trả')[0].text, /CHƯA TRẢ: 1 đơn · 350\.000đ/);
  assert.match(s.say('huỷ đơn 2')[0].text, /hoàn lại/);
  s.ctx.now = T0 + 11.5 * 3600e3; // 21:30
  const rep = s.tick();
  assert.match(rep.map((x) => x.text).join('\n'), /TỔNG KẾT 25\/11[\s\S]*Đã thu: 1 đơn · 120\.000đ/);
  assert.equal(s.tick().length, 0);
});

test('phí: chỉ tính đơn đã thu tiền, 30 đơn đầu miễn phí, có trần', () => {
  const s = shop();
  for (let i = 0; i < 40; i++) s.say('khách ' + (100 + i) + 'k');
  s.say('cô Hoa 999k'); // không trả → không tính
  for (let i = 1; i <= 40; i++) s.bank({ id: 't' + i, amount: s.order(i).total, memo: s.order(i).code });
  const f = monthFee(s.st, '2026-11');
  assert.equal(f.paid_orders, 40); assert.equal(f.fee, 10 * FEE.per_order);
  const big = { paid_log: Array.from({ length: 1000 }, () => ({ at: T0 })) };
  assert.equal(monthFee(big, '2026-11').fee, FEE.cap);
});

test('mã đơn không trùng và không có ký tự dễ nhầm (0 O 1 I L)', () => {
  const s = shop();
  for (let i = 0; i < 60; i++) s.say('khách ' + i + ' ' + (100 + i) + 'k');
  const codes = s.st.orders.map((o) => o.code);
  assert.equal(new Set(codes).size, codes.length);
  for (const c of codes) assert.match(c, /^T404[2-9A-HJKMNP-Z]{6}$/);
});
