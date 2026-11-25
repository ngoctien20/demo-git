import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { validateBooking, freeSlots, readServices, holdsSlot, slotStillFree, DEFAULT_SETTINGS } from '../lib/booking-rules.mjs';
import { depositFor, newTransferCode, vietQrUrl, readTransfer, matchTransfer } from '../lib/deposit.mjs';
import { bookingCreatedText, dueReminders, ownerText } from '../lib/messages.mjs';
import { parseLocal, normPhone, toVnd } from '../lib/vn.mjs';
import { buildNode } from '../n8n/build-nodes.mjs';

// Same shape as the real Sheet tab Dich_vu (AI_SALES_DEMO, 2026-11-23), plus one nail service.
const SERVICES = [
  { ma: 'DV-01', ten_dich_vu: 'Gội đầu dưỡng sinh', gia: '120.000đ', thoi_luong_phut: '45', dat_lich: 'có', trang_thai: 'đang nhận' },
  { ma: 'DV-02', ten_dich_vu: 'Chăm sóc da cơ bản', gia: '250.000đ', thoi_luong_phut: '60', dat_lich: 'có', trang_thai: 'đang nhận' },
  { ma: 'DV-05', ten_dich_vu: 'Tư vấn thiết kế logo', gia: '500.000đ', thoi_luong_phut: '90', dat_lich: 'có', trang_thai: 'tạm ngưng' },
  { ma: 'DV-06', ten_dich_vu: 'Tư vấn mở shop online', gia: '0đ', thoi_luong_phut: '30', dat_lich: 'có', trang_thai: 'đang nhận' },
  { ma: 'NAIL-01', ten_dich_vu: 'Sơn gel tay', gia: 180000, thoi_luong_phut: 60, dat_lich: 'có', trang_thai: 'đang nhận' },
];
// "Now" = Tuesday 24/11/2026 09:00 Vietnam time.
const NOW = parseLocal('2026-11-24 09:00');
const seq = () => { let i = 0; return () => [0.1, 0.5, 0.9, 0.3, 0.7, 0.2, 0.6][i++ % 7]; };
const base = { customer_name: 'Khách QA', phone: '0900000002', service_code: 'NAIL-01', time: '2026-11-24 14:00' };
const book = (input = {}, bookings = [], nowMs = NOW, settings) => validateBooking({ input: { ...base, ...input }, services: SERVICES, bookings, nowMs, rand: seq(), settings });

test('vn helpers: Sheet phone without leading 0, VND text, invalid dates', () => {
  assert.equal(normPhone('900000002'), '0900000002');
  assert.equal(normPhone('+84 912 345 678'), '0912345678');
  assert.equal(toVnd('120.000đ'), 120000);
  assert.ok(Number.isNaN(parseLocal('2026-11-31 10:00')));
  assert.ok(Number.isNaN(parseLocal('mai 10h')));
  assert.equal(new Date(parseLocal('2026-11-24 09:00')).toISOString(), '2026-11-24T02:00:00.000Z');
});

test('happy path: price and deposit come from the Sheet, never from the customer', () => {
  const r = book({ price: 1 });
  assert.equal(r.ok, true);
  assert.equal(r.gia_vnd, 180000);
  assert.equal(r.coc_vnd, 54000); // 30% rounded up to 1.000đ
  assert.match(r.ma_chuyen_khoan, /^T404[2-9A-HJKMNP-Z]{6}$/);
  assert.match(r.request_id, /^BK-20261124020000-\d{6}$/);
  assert.equal(r.thoi_gian_mong_muon, '2026-11-24 14:00');
  assert.equal(r.status, 'pending');
  assert.equal(r.giu_cho_den, new Date(NOW + 30 * 60e3).toISOString());
});

test('deposit rule: min 50.000đ, never above price, free service has none, fixed amount', () => {
  assert.equal(depositFor(120000), 50000);
  assert.equal(depositFor(40000), 40000);
  assert.equal(depositFor(0), 0);
  assert.equal(depositFor(250000, { fixed: 100000 }), 100000);
  const free = book({ service_code: 'DV-06' });
  assert.equal(free.ok, true); assert.equal(free.coc_vnd, 0); assert.equal(free.ma_chuyen_khoan, ''); assert.equal(free.giu_cho_den, '');
});

test('refusals: unknown, paused, missing fields, too soon, outside hours, closed day, too far', () => {
  assert.equal(book({ service_code: 'Z-99' }).ok, false);
  assert.match(book({ service_code: 'DV-05' }).message, /tạm ngưng/);
  assert.match(book({ phone: '123' }).message, /số điện thoại/);
  assert.match(book({ time: 'chiều mai' }).message, /ngày giờ/);
  assert.equal(book({ time: '2026-11-24 09:30' }).reason, 'TOO_SOON');
  const late = book({ time: '2026-11-24 19:30' });
  assert.equal(late.reason, 'OUTSIDE_HOURS'); // 60 min service must end by 20:00
  assert.ok(late.suggestions.length > 0);
  assert.equal(book({ time: '2026-11-29 10:00' }, [], NOW, { closedWeekdays: [0] }).reason, 'CLOSED_DAY');
  assert.equal(book({ time: '2027-01-24 10:00' }).reason, 'TOO_FAR');
});

test('NO DOUBLE BOOKING: capacity 1 -> second customer refused and offered free times', () => {
  const first = book();
  const second = book({ phone: '0911111111', customer_name: 'Khách 2' }, [first], NOW + 60e3);
  assert.equal(second.ok, false); assert.equal(second.reason, 'FULL');
  assert.ok(!second.suggestions.includes('14:00') && !second.suggestions.includes('13:30'), 'overlapping starts are not offered');
  // 13:00 overlaps? 13:00-14:00 ends exactly when 14:00 starts -> allowed.
  assert.equal(book({ phone: '0911111111', time: '2026-11-24 13:00' }, [first], NOW + 60e3).ok, true);
  // capacity 2 -> second customer fits
  assert.equal(book({ phone: '0911111111' }, [first], NOW + 60e3, { capacity: 2 }).ok, true);
});

test('unpaid hold expires after 30 minutes; free / paid / confirmed hold; cancelled does not', () => {
  const first = book();
  assert.equal(holdsSlot(first, NOW + 29 * 60e3), true);
  assert.equal(holdsSlot(first, NOW + 31 * 60e3), false);
  assert.equal(book({ phone: '0911111111' }, [first], NOW + 31 * 60e3).ok, true);
  assert.equal(holdsSlot({ ...first, status: 'deposit_paid' }, NOW + 5 * 3600e3), true);
  assert.equal(holdsSlot({ ...first, status: 'cancelled' }, NOW), false);
  const free = book({ service_code: 'DV-06' });
  assert.equal(holdsSlot(free, NOW + 3 * 3600e3), true, 'no-deposit booking waits for the shop');
  assert.equal(holdsSlot({ ...first, created_at: '' }, NOW + 99 * 3600e3), true, 'unknown date keeps holding');
});

test('resent message is a duplicate, not a second booking', () => {
  const first = book();
  const again = book({}, [first], NOW + 2 * 60e3);
  assert.equal(again.action, 'duplicate'); assert.equal(again.request_id, first.request_id);
});

test('freeSlots lists only bookable times', () => {
  const services = readServices(SERVICES);
  const slots = freeSlots({ date: '2026-11-24', serviceCode: 'NAIL-01', services, bookings: [book()], nowMs: NOW });
  assert.equal(slots[0], '10:00'); // 09:00, 09:30 too soon
  assert.ok(!slots.includes('14:00') && slots.includes('15:00') && slots.at(-1) === '19:00');
  assert.deepEqual(freeSlots({ date: '2026-11-24', serviceCode: 'DV-05', services, bookings: [], nowMs: NOW }), []);
});

test('VietQR link: shop own account, amount + code prefilled, bad input refused', () => {
  const u = new URL(vietQrUrl({ bank: '970436', account: '0123456789', accountName: 'Nguyễn Văn Đức', amount: 54000, code: 'T404ABCDEF' }));
  assert.equal(u.hostname, 'img.vietqr.io');
  assert.equal(u.pathname, '/image/970436-0123456789-compact2.png');
  assert.equal(u.searchParams.get('amount'), '54000');
  assert.equal(u.searchParams.get('addInfo'), 'T404ABCDEF');
  assert.equal(u.searchParams.get('accountName'), 'NGUYEN VAN DUC');
  assert.throws(() => vietQrUrl({ bank: 'VCB', account: '1', amount: 1, code: 'T404ABCDEF' }));
  assert.throws(() => vietQrUrl({ bank: '970436', account: '0123456789', amount: 1.5, code: 'T404ABCDEF' }));
});

test('transfer code never uses look-alike characters', () => {
  for (let i = 0; i < 200; i++) assert.doesNotMatch(newTransferCode(Math.random).slice(4), /[01OIL]/);
});

test('payment matching: SePay + Casso, spaces/lowercase in memo, underpaid, replay, late', () => {
  const row = book();
  const code = row.ma_chuyen_khoan;
  const sepay = { id: 9001, transferType: 'in', transferAmount: 54000, content: 'MBVCB.123 ' + code.toLowerCase().replace('t404', 't404 ') + ' chuyen tien', accountNumber: '0123456789' };
  const t = readTransfer(sepay);
  assert.deepEqual(matchTransfer({ transfer: t, bookings: [row], shopAccount: '0123456789', nowMs: NOW + 10 * 60e3 }), { action: 'mark_paid', request_id: row.request_id, amount: 54000 });
  assert.equal(readTransfer({ ...sepay, transferType: 'out' }), null);
  assert.equal(matchTransfer({ transfer: t, bookings: [row], shopAccount: '999', nowMs: NOW }).reason, 'NOT_OUR_ACCOUNT');
  assert.equal(matchTransfer({ transfer: t, bookings: [{ ...row, ma_giao_dich: 'sepay:9001' }], nowMs: NOW }).reason, 'ALREADY_PROCESSED');
  const under = matchTransfer({ transfer: { ...t, amount: 50000 }, bookings: [row], nowMs: NOW });
  assert.equal(under.action, 'underpaid'); assert.equal(under.due, 54000);
  assert.equal(matchTransfer({ transfer: { ...t, memo: 'chuyen tien coc' }, bookings: [row], nowMs: NOW }).action, 'unmatched');
  const casso = readTransfer({ error: 0, data: [{ id: 77, amount: 60000, description: 'CK ' + code }] });
  assert.equal(matchTransfer({ transfer: casso, bookings: [row], nowMs: NOW }).action, 'mark_paid');
  // Late payment: hold over, someone else took the slot -> owner must act.
  const other = { ...book({ phone: '0911111111' }, [], NOW + 40 * 60e3), status: 'deposit_paid' };
  const bookings = [row, other];
  const late = matchTransfer({ transfer: t, bookings, nowMs: NOW + 45 * 60e3, slotStillFree: (b) => slotStillFree(b, SERVICES, bookings, NOW + 45 * 60e3) });
  assert.equal(late.action, 'late_slot_taken');
  const lateFree = matchTransfer({ transfer: t, bookings: [row], nowMs: NOW + 45 * 60e3, slotStillFree: (b) => slotStillFree(b, SERVICES, [row], NOW + 45 * 60e3) });
  assert.equal(lateFree.action, 'mark_paid'); assert.equal(lateFree.late, true);
  assert.match(ownerText('late_slot_taken', row, late), /hoàn tiền/);
});

test('reminders: 24h then 2h, once each, only for sure bookings, none for same-day bookings', () => {
  const paid = { ...book({ time: '2026-11-25 15:00' }), status: 'deposit_paid', kenh: 'messenger' };
  const at = (s) => parseLocal(s);
  assert.deepEqual(dueReminders({ bookings: [paid], nowMs: at('2026-11-24 14:00') }), []);
  const r24 = dueReminders({ bookings: [paid], nowMs: at('2026-11-24 15:30'), shopName: 'Nail Hoa' });
  assert.equal(r24.length, 1); assert.equal(r24[0].kind, '24h'); assert.match(r24[0].text, /^Nail Hoa nhắc lịch: Sơn gel tay lúc 15:00 thứ 4, 25\/11/);
  assert.deepEqual(dueReminders({ bookings: [paid], nowMs: at('2026-11-24 15:40'), sentKeys: new Set([r24[0].key]) }), []);
  const r2 = dueReminders({ bookings: [paid], nowMs: at('2026-11-25 13:30'), sentKeys: new Set([r24[0].key]) });
  assert.equal(r2[0].kind, '2h');
  assert.deepEqual(dueReminders({ bookings: [{ ...paid, status: 'pending' }], nowMs: at('2026-11-25 13:30') }), []);
  const sameDay = { ...book({ time: '2026-11-24 18:00' }), status: 'confirmed' };
  assert.deepEqual(dueReminders({ bookings: [sameDay], nowMs: at('2026-11-24 10:00') }), []);
  assert.equal(dueReminders({ bookings: [sameDay], nowMs: at('2026-11-24 16:30') })[0].kind, '2h');
});

test('customer text has no link from the AI, only the QR we built', () => {
  const row = book({ customer_name: 'Lan http://evil.example' });
  const text = bookingCreatedText(row, { qrUrl: 'https://img.vietqr.io/image/x.png' });
  assert.doesNotMatch(text, /evil/);
  assert.match(text, /chuyển cọc 54\.000đ trong 30 phút, nội dung: T404/);
});

test('generated n8n nodes behave like the library (vm, fake $)', () => {
  const shop = { json: { shop_name: 'Nail Hoa', bank_bin: '970436', bank_account: '0123456789', bank_name: 'Hoa', booking: { capacity: 1 } } };
  const items = {
    'Shop Settings': [shop], 'Read Services': SERVICES.map((json) => ({ json })), 'Read Bookings': [],
    // Real clock inside the node: book 3 days from now at 14:00 Vietnam time (never in the past).
    'Booking Input': [{ json: { ...base, time: new Date(Date.now() + 3 * 864e5 + 7 * 36e5).toISOString().slice(0, 10) + ' 14:00' } }],
  };
  const $ = (n) => ({ first: () => items[n][0], all: () => items[n] });
  const run = (name) => vm.runInNewContext('(function(){' + buildNode(name) + '})()', { $, Date, Math, JSON, Number, String, Object, Array, Set, URL, URLSearchParams, Error, RegExp });
  for (const n of ['validate', 'payment', 'reminders']) assert.doesNotMatch(buildNode(n), /fetch\(|require\(|httpRequest|process\./);
  const [v] = run('validate');
  assert.equal(v.json.ok, true); assert.match(v.json.qr_url, /^https:\/\/img\.vietqr\.io\/image\/970436-0123456789-compact2\.png\?amount=54000&addInfo=T404/);
  items['Read Bookings'] = [{ json: v.json }];
  items['Bank Webhook'] = [{ json: { body: { id: 1, transferType: 'in', transferAmount: 54000, content: v.json.ma_chuyen_khoan, accountNumber: '0123456789' } } }];
  const [p] = run('payment');
  assert.equal(p.json.action, 'mark_paid'); assert.equal(p.json.notify_owner, true); assert.match(p.json.customer_text, /đã nhận cọc 54\.000đ/);
  assert.ok(Array.isArray(run('reminders')));
});
