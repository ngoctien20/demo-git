// TIEN404 Đơn chắc tiền — lõi xử lý cho MỘT shop. Hàm thuần: nhận trạng thái + sự kiện, trả trạng thái mới + tin gửi chủ.
// Không đọc/ghi gì bên ngoài, nên chạy được trong Worker, n8n Code node, trình duyệt (trang mô phỏng) và test.
//
//   ownerMessage(state, text, ctx)  chủ shop nhắn bot
//   bankTransfer(state, tx, ctx)    SePay/Casso báo có tiền vào tài khoản shop
//   tick(state, ctx)                chạy mỗi 15 phút: nhả hàng hết hạn giữ, báo cáo tối 21:00
//   monthFee(state, month)          phí TIEN404 tháng đó (chỉ tính đơn ĐÃ THU TIỀN)
// ctx = { now: epoch ms, rand: () => [0,1) }
//
// Tin trả về (out): { text } hoặc { text, qr: { payload, code, order_no } } — nơi gửi tự đổi qr thành ảnh/link.

import { vnd, local, clean, fold } from './vn.mjs';
import { vietQrPayload, bankName } from './vietqr.mjs';
import { parseOwner } from './parse-owner.mjs';
import { newCode, findCode } from './reconcile.mjs';
import * as M from './messages.mjs';

export const DEFAULTS = Object.freeze({
  hold_hours: 12,      // đơn chờ chuyển khoản giữ hàng 12 giờ rồi tự nhả
  cod_hold_days: 7,    // đơn COD giữ hàng 7 ngày (nhắc trong báo cáo, không tự huỷ)
  low_stock: 3,        // còn ≤ 3 thì báo sắp hết
  report_hour: 21,     // báo cáo tối lúc 21:00 giờ Việt Nam
  dup_minutes: 30,     // cùng khách + cùng hàng trong 30 phút → hỏi lại trước khi tạo thêm
  ask_minutes: 30,     // câu hỏi có/không còn hiệu lực 30 phút
  keep_days: 90,       // đơn đã xong cũ hơn 90 ngày thì xoá khỏi trạng thái (đã tính phí)
});

// Phí TIEN404 (PROPOSED theo tài liệu hướng đi 25/11, chưa chốt giá): 30 đơn đã thu đầu tiên mỗi tháng miễn phí,
// sau đó 1.500đ/đơn, tối đa 299.000đ/tháng. Đơn chưa thu được tiền không bao giờ bị tính.
export const FEE = Object.freeze({ free: 30, per_order: 1500, cap: 299000 });

const HELD = new Set(['cho_tra', 'tra_thieu', 'da_tra', 'cod']);
const OPEN = new Set(['cho_tra', 'tra_thieu']);

export function newShop({ name = 'Shop', now = 0, settings = {} } = {}) {
  return {
    v: 1, created_at: now, shop: { name: clean(name, 40), bank: null }, settings: { ...DEFAULTS, ...settings },
    products: {}, orders: [], next_no: 1, seen_tx: [], ask: null, last_report_day: null, paid_log: [],
  };
}

/* ---------------- kho ---------------- */

export function heldQty(state, sku, now) {
  let n = 0;
  for (const o of state.orders) {
    if (!HELD.has(o.status)) continue;
    if (o.status === 'cho_tra' && now > o.hold_until) continue; // hết hạn nhưng tick chưa chạy: coi như đã nhả
    for (const i of o.items) if (i.sku === sku) n += i.qty;
  }
  return n;
}
export const available = (state, sku, now) => Math.max(0, (state.products[sku]?.stock ?? 0) - heldQty(state, sku, now));

/* ---------------- tiện ích ---------------- */

function findOrders(state, ref, statuses) {
  const pool = state.orders.filter((o) => !statuses || statuses.has(o.status));
  if (ref?.code) return pool.filter((o) => o.code === ref.code);
  if (ref?.no) return pool.filter((o) => o.no === ref.no);
  if (ref?.name) {
    const q = ref.name;
    return pool.filter((o) => o.name && fold(o.name).replace(/[^a-z ]/g, ' ').split(/\s+/).some((w) => w && q.split(' ').includes(w)));
  }
  return [];
}

function qrOut(state, o) {
  const b = state.shop.bank;
  if (!b || !(o.due - o.paid > 0)) return null;
  return {
    text: M.customerMessage(o, state.shop),
    qr: { payload: vietQrPayload({ bin: b.bin, account: b.account, amount: o.due - o.paid, memo: o.code }), code: o.code, order_no: o.no },
  };
}

function notFound(ref) {
  if (ref?.no) return 'Không thấy đơn số ' + ref.no + '. Nhắn "ai chưa trả" để xem danh sách.';
  if (ref?.code) return 'Không thấy đơn có mã ' + ref.code + '.';
  if (ref?.name) return 'Không thấy đơn nào tên "' + ref.name + '". Bác nhắn số đơn, ví dụ: đơn 12.';
  return 'Bác nhắn thêm số đơn, ví dụ: đơn 12.';
}
function pickOne(list, ref, verb) {
  if (list.length === 1) return { o: list[0] };
  if (!list.length) return { err: notFound(ref) };
  return { err: 'Có ' + list.length + ' đơn khớp: ' + list.slice(0, 5).map((o) => 'đơn ' + o.no + (o.name ? ' (' + o.name + ')' : '')).join(', ') + '.\nBác nhắn lại kèm số đơn, ví dụ: ' + verb + ' ' + list[0].no };
}

/* ---------------- tiền về ---------------- */

/** Ghi nhận một khoản tiền cho một đơn. via: bank | notice | owner */
function applyPayment(state, o, amount, via, txId, now) {
  const r = { amount, via, extra: 0, late: false, restocked: false };
  o.payments.push({ id: txId || null, amount, via, at: now });
  const wasExpired = o.status === 'het_han' || o.status === 'huy';
  o.paid += amount;
  if (o.paid < o.due) {
    r.result = 'partial';
    if (o.status === 'cho_tra' || wasExpired) o.status = 'tra_thieu';
    return r;
  }
  r.result = 'paid';
  r.extra = o.paid - o.due;
  if (wasExpired) {
    r.late = true;
    r.restocked = o.items.every((i) => available(state, i.sku, now) >= i.qty);
  }
  o.status = o.cod ? 'cod' : 'da_tra';
  if (o.cod) o.hold_until = now + state.settings.cod_hold_days * 86400e3;
  if (!o.paid_at) {
    o.paid_at = now; o.paid_via = via;
    state.paid_log.push({ no: o.no, at: now, via, amount: o.due });
  }
  if (r.late && !r.restocked) o.notes.push('Tiền về khi đã hết hàng: cần hoàn tiền hoặc nhập thêm.');
  return r;
}

export function bankTransfer(state0, tx, ctx) {
  const state = structuredClone(state0);
  const out = [];
  if (!tx || !(tx.amount > 0)) return { state, out, result: 'ignored' };
  if (tx.id && state.seen_tx.includes(tx.id)) return { state, out, result: 'duplicate' };
  const b = state.shop.bank;
  if (b && tx.account && tx.account !== b.account) return { state, out, result: 'not_our_account' };
  if (tx.id) { state.seen_tx.push(tx.id); if (state.seen_tx.length > 500) state.seen_tx.splice(0, state.seen_tx.length - 500); }
  return settle(state, { amount: tx.amount, code: findCode(tx.memo), memo: tx.memo, id: tx.id }, tx.via || 'bank', ctx, out);
}

function settle(state, t, via, ctx, out) {
  const now = ctx.now;
  if (t.code) {
    const o = state.orders.find((x) => x.code === t.code);
    if (!o) { out.push({ text: '❓ Có ' + vnd(t.amount) + ' về với mã ' + t.code + ' nhưng không thấy đơn này. Bác kiểm tra lại.' }); return { state, out, result: 'unknown_code' }; }
    if (o.status === 'da_tra' || o.status === 'da_giao' || (o.status === 'cod' && o.paid >= o.due)) {
      o.payments.push({ id: t.id || null, amount: t.amount, via, at: now });
      o.paid += t.amount;
      out.push({ text: '❗ Đơn ' + o.no + ' đã trả đủ từ trước, khách chuyển thêm ' + vnd(t.amount) + '. Bác nhớ trả lại nếu khách chuyển nhầm.' });
      return { state, out, result: 'overpaid_again' };
    }
    const r = applyPayment(state, o, t.amount, via, t.id, now);
    out.push({ text: M.paidNotice(o, r, state.shop) });
    return { state, out, result: r.result, order_no: o.no };
  }
  // Không có mã: chỉ GỢI Ý khi đúng 1 đơn đang chờ đúng số tiền đó; không tự ghi.
  const cands = state.orders.filter((o) => OPEN.has(o.status) && o.due - o.paid === t.amount);
  if (cands.length === 1) {
    const o = cands[0];
    state.ask = { kind: 'match', order_no: o.no, amount: t.amount, id: t.id || null, via, until: now + state.settings.ask_minutes * 60e3 };
    out.push({ text: '❓ Có ' + vnd(t.amount) + ' về nhưng nội dung không có mã đơn.\nCó phải tiền ĐƠN ' + o.no + (o.name ? ' · ' + o.name : '') + ' không?\nNhắn 1 = đúng, 2 = không phải.' });
    return { state, out, result: 'ask_match' };
  }
  out.push({ text: '❓ Có ' + vnd(t.amount) + ' về nhưng không khớp đơn nào' + (cands.length > 1 ? ' (có ' + cands.length + ' đơn cùng số tiền)' : '') + '.\nNếu là của đơn nào, bác nhắn: đã nhận đơn <số>.' });
  return { state, out, result: 'unmatched' };
}

/* ---------------- chủ shop nhắn ---------------- */

export function ownerMessage(state0, text, ctx) {
  const state = structuredClone(state0);
  const out = [];
  const now = ctx.now;
  const say = (t) => out.push({ text: t });
  const cmd = parseOwner(text, { skus: Object.keys(state.products) });
  const ask = state.ask && now <= state.ask.until ? state.ask : null;
  if (cmd.kind !== 'yes' && cmd.kind !== 'no') state.ask = null;

  switch (cmd.kind) {
    case 'yes':
    case 'no': {
      state.ask = null;
      if (!ask) { say(M.HELP); break; }
      if (cmd.kind === 'no') { say(ask.kind === 'match' ? 'Dạ, bot không ghi khoản đó vào đơn nào.' : 'Dạ, đã bỏ qua.'); break; }
      if (ask.kind === 'bank') {
        state.shop.bank = ask.bank;
        say('✅ Đã lưu tài khoản ' + ask.bank.short + ' · ' + ask.bank.account + ' · ' + ask.bank.holder + '.\nTừ giờ mỗi đơn có mã QR đúng số tiền. Bác thử: cô Hoa 350k');
      } else if (ask.kind === 'match') {
        const o = state.orders.find((x) => x.no === ask.order_no);
        if (o && OPEN.has(o.status)) out.push({ text: M.paidNotice(o, applyPayment(state, o, ask.amount, ask.via, ask.id, now), state.shop) });
        else say('Đơn ' + ask.order_no + ' không còn chờ tiền nữa.');
      } else if (ask.kind === 'order') {
        createOrder(state, ask.draft, ctx, out, { skipDup: true, total: ask.choice_yes });
      }
      break;
    }
    case 'help': say(M.HELP); break;
    case 'shopname': {
      if (!cmd.name) { say('Ví dụ: tên shop Thời trang Hoa'); break; }
      state.shop.name = cmd.name;
      say('✅ Tên shop: ' + cmd.name + '. Tin gửi khách sẽ ghi tên này.');
      break;
    }
    case 'bank': {
      if (!cmd.bank || !cmd.account || !cmd.holder) {
        say('Bác nhắn đủ 3 thứ: tên ngân hàng, số tài khoản, tên chủ tài khoản (IN HOA không dấu).\nVí dụ: ngân hàng MB 0123456789 NGUYEN VAN A');
        break;
      }
      const bank = { bin: cmd.bank.bin, short: cmd.bank.short, account: cmd.account, holder: bankName(cmd.holder) };
      state.ask = { kind: 'bank', bank, until: now + state.settings.ask_minutes * 60e3 };
      say('Bot sẽ làm mã QR vào tài khoản:\n' + bank.short + '\nSố: ' + bank.account + '\nTên: ' + bank.holder + '\nĐúng chưa? Nhắn 1 = đúng, 2 = sai.');
      break;
    }
    case 'product': {
      if (!cmd.sku || !(cmd.price > 0)) { say('Ví dụ thêm hàng: thêm hàng A020 áo khoác 250k còn 10'); break; }
      const prev = state.products[cmd.sku];
      state.products[cmd.sku] = { sku: cmd.sku, name: cmd.name ? cmd.name.charAt(0).toUpperCase() + cmd.name.slice(1) : prev?.name || cmd.sku, price: cmd.price, stock: Number.isSafeInteger(cmd.stock) ? cmd.stock : prev?.stock ?? 0 };
      const p = state.products[cmd.sku];
      say('✅ ' + (prev ? 'Đã sửa ' : 'Đã thêm ') + p.sku + ' · ' + p.name + ' · ' + vnd(p.price) + ' · còn ' + p.stock + '.');
      break;
    }
    case 'restock': {
      const p = state.products[cmd.sku];
      if (!p || !(cmd.qty > 0)) { say(p ? 'Ví dụ: nhập 10 ' + p.sku : 'Chưa có mã ' + (cmd.sku || '') + '. Thêm bằng: thêm hàng A020 áo khoác 250k còn 10'); break; }
      p.stock += cmd.qty;
      say('✅ ' + p.sku + ' nhập thêm ' + cmd.qty + '. Tồn ' + p.stock + ', còn bán được ' + available(state, p.sku, now) + '.');
      break;
    }
    case 'price': {
      const p = state.products[cmd.sku];
      if (!p || !(cmd.price > 0)) { say('Ví dụ đổi giá: giá A003 165k'); break; }
      p.price = cmd.price;
      say('✅ Giá mới ' + p.sku + ': ' + vnd(p.price) + '. Đơn đã tạo giữ giá cũ.');
      break;
    }
    case 'stock': {
      const rows = Object.values(state.products);
      if (!rows.length) { say('Kho chưa có hàng. Thêm: thêm hàng A020 áo khoác 250k còn 10\nKhông cần kho cũng được: nhắn tên khách + số tiền.'); break; }
      say('📦 KHO\n' + rows.map((p) => {
        const a = available(state, p.sku, now); const h = heldQty(state, p.sku, now);
        return (a <= state.settings.low_stock ? '❗ ' : '') + p.sku + ' ' + p.name + ': bán được ' + a + (h ? ' (đang giữ ' + h + ')' : '');
      }).join('\n'));
      break;
    }
    case 'unpaid': {
      const list = state.orders.filter((o) => OPEN.has(o.status) || (o.status === 'cod' && o.paid < o.total));
      if (!list.length) { say('🎉 Không có đơn nào đang chờ tiền.'); break; }
      const sum = list.reduce((s, o) => s + (OPEN.has(o.status) ? o.due - o.paid : o.total - o.paid), 0);
      say('⏳ CHƯA TRẢ: ' + list.length + ' đơn · ' + vnd(sum) + '\n' + list.slice(0, 15).map((o) => M.orderLine(o, now)).join('\n') + '\n\nGửi lại mã QR: qr <số đơn>');
      break;
    }
    case 'report': say(report(state, now)); break;
    case 'fee': {
      const f = monthFee(state, local(now).month);
      say('Phí TIEN404 tháng ' + f.month.slice(5) + '/' + f.month.slice(0, 4) + ':\nĐơn đã thu tiền: ' + f.paid_orders + '\nMiễn phí ' + FEE.free + ' đơn đầu.\nPhí tạm tính: ' + vnd(f.fee) + (f.capped ? ' (đã chạm mức tối đa)' : '') + '\nĐơn chưa thu được tiền không tính phí.');
      break;
    }
    case 'shopqr': {
      const b = state.shop.bank;
      if (!b) { say('Chưa có số tài khoản. Nhắn: ngân hàng MB 0123456789 NGUYEN VAN A'); break; }
      out.push({ text: 'Mã QR của shop (khách tự nhập số tiền). In ra dán ở quầy được.', qr: { payload: vietQrPayload({ bin: b.bin, account: b.account }), code: 'SHOP', order_no: 0 } });
      break;
    }
    case 'bank_notice': {
      settle(state, { amount: cmd.amount, code: cmd.code, memo: cmd.memo, id: null }, 'notice', ctx, out);
      break;
    }
    case 'paid': {
      const { o, err } = pickOne(findOrders(state, cmd.ref, new Set(['cho_tra', 'tra_thieu', 'het_han', 'huy'])), cmd.ref, 'đã nhận đơn');
      if (err) { say(err); break; }
      const amount = Number.isSafeInteger(cmd.amount) && cmd.amount > 0 ? cmd.amount : o.due - o.paid;
      out.push({ text: M.paidNotice(o, applyPayment(state, o, amount, 'owner', null, now), state.shop) });
      break;
    }
    case 'cancel': {
      const { o, err } = pickOne(findOrders(state, cmd.ref, new Set(['cho_tra', 'tra_thieu', 'da_tra', 'cod'])), cmd.ref, 'huỷ đơn');
      if (err) { say(err); break; }
      o.status = 'huy'; o.done_at = now;
      say('Đã huỷ đơn ' + o.no + (o.name ? ' · ' + o.name : '') + '. Hàng đã trả lại kho.' + (o.paid ? '\n❗ Khách đã chuyển ' + vnd(o.paid) + ', bác nhớ hoàn lại.' : ''));
      break;
    }
    case 'shipped': {
      const { o, err } = pickOne(findOrders(state, cmd.ref, new Set(['cho_tra', 'tra_thieu', 'da_tra', 'cod'])), cmd.ref, 'đã giao');
      if (err) { say(err); break; }
      for (const i of o.items) if (state.products[i.sku]) state.products[i.sku].stock = Math.max(0, state.products[i.sku].stock - i.qty);
      const unpaid = o.status !== 'da_tra' && !(o.status === 'cod');
      o.status = 'da_giao'; o.done_at = now;
      say('🚚 Đơn ' + o.no + ' đã giao. Đã trừ kho.' + (unpaid ? '\n❗ Đơn này chưa trả đủ tiền (còn ' + vnd(o.due - o.paid) + ').' : ''));
      break;
    }
    case 'extend': {
      const { o, err } = pickOne(findOrders(state, cmd.ref, new Set(['cho_tra', 'het_han'])), cmd.ref, 'gia hạn');
      if (err) { say(err); break; }
      if (o.status === 'het_han' && !o.items.every((i) => available(state, i.sku, now) >= i.qty)) { say('Hàng của đơn ' + o.no + ' đã bán cho người khác, không giữ lại được.'); break; }
      o.status = 'cho_tra'; o.hold_until = now + state.settings.hold_hours * 3600e3;
      say('✅ Giữ hàng đơn ' + o.no + ' tới ' + local(o.hold_until, now).label + '.');
      break;
    }
    case 'resend': {
      const { o, err } = pickOne(findOrders(state, cmd.ref), cmd.ref, 'qr');
      if (err) { say(err); break; }
      const q = qrOut(state, o);
      if (q) out.push(q); else say('Đơn ' + o.no + ': ' + M.STATUS_VI[o.status] + '. ' + (state.shop.bank ? 'Không còn tiền phải chuyển.' : 'Chưa có số tài khoản.'));
      break;
    }
    case 'order': createOrder(state, cmd, ctx, out, {}); break;
    default:
      say('Bot chưa hiểu ạ. Bác nhắn theo mẫu:\nchị Lan 2 cái A003 giao Q7\nhoặc: cô Hoa 350k\nNhắn "giúp" để xem hết các lệnh.');
  }
  return { state, out };
}

function createOrder(state, d, ctx, out, { skipDup = false, total: forcedTotal } = {}) {
  const now = ctx.now;
  const say = (t) => out.push({ text: t });
  if (d.unknown?.length) {
    say('Kho chưa có mã ' + d.unknown.join(', ') + '.\nThêm trước: thêm hàng ' + d.unknown[0] + ' <tên> <giá> còn <số lượng>\nHoặc tạo đơn bằng số tiền: chị Lan 350k');
    return;
  }
  const items = d.items.map((i) => ({ sku: i.sku, name: state.products[i.sku].name, qty: i.qty, price: state.products[i.sku].price }));
  for (const i of items) {
    if (!(i.qty > 0 && i.qty <= 999)) { say('Số lượng ' + i.sku + ' không hợp lệ.'); return; }
    const a = available(state, i.sku, now);
    if (a < i.qty) { say('❌ ' + i.sku + ' ' + i.name + ' chỉ còn ' + a + ' cái bán được. Chưa tạo đơn.\n' + (a ? 'Nhắn lại với số lượng ≤ ' + a + '.' : 'Nhập thêm: nhập 10 ' + i.sku)); return; }
  }
  const goods = items.reduce((s, i) => s + i.qty * i.price, 0);
  const catalogTotal = goods + d.ship - d.discount;
  let total;
  if (forcedTotal) total = forcedTotal;
  else if (items.length && d.amount && d.amount !== catalogTotal && d.amount !== goods) {
    // Bác nhắn số tiền khác giá trong kho: hỏi, không tự chọn.
    state.ask = { kind: 'order', draft: d, choice_yes: d.amount, until: now + state.settings.ask_minutes * 60e3 };
    say('Giá trong kho: ' + vnd(catalogTotal) + ', bác nhắn ' + vnd(d.amount) + '.\nDùng số bác nhắn (' + vnd(d.amount) + ')?\nNhắn 1 = dùng ' + vnd(d.amount) + ', 2 = huỷ để nhắn lại.');
    return;
  } else if (items.length) total = d.amount === goods ? goods + d.ship - d.discount : catalogTotal;
  else total = (d.amount || 0) + d.ship - d.discount;
  if (!Number.isSafeInteger(total) || total <= 0) { say('Tổng tiền không hợp lệ. Bác nhắn lại số tiền, ví dụ: cô Hoa 350k'); return; }
  if (d.deposit && d.deposit > total) { say('Tiền cọc lớn hơn tổng đơn. Bác kiểm tra lại.'); return; }

  if (!skipDup) {
    const key = JSON.stringify(items.map((i) => [i.sku, i.qty])) + '|' + total;
    const dup = state.orders.find((o) => now - o.created_at < state.settings.dup_minutes * 60e3 && o.status !== 'huy'
      && fold(o.name || '') === fold(d.name || '') && JSON.stringify(o.items.map((i) => [i.sku, i.qty])) + '|' + o.total === key);
    if (dup) {
      state.ask = { kind: 'order', draft: d, choice_yes: total, until: now + state.settings.ask_minutes * 60e3 };
      say('Vừa có ĐƠN ' + dup.no + ' giống hệt (' + (dup.name || 'khách') + ', ' + vnd(dup.total) + ').\nTạo thêm 1 đơn nữa? Nhắn 1 = tạo thêm, 2 = không.');
      return;
    }
  }

  const cod = !!d.cod;
  const due = cod ? d.deposit || 0 : total;
  const o = {
    no: state.next_no++, code: newCode(ctx.rand, new Set(state.orders.map((x) => x.code))),
    name: d.name || null, phone: d.phone || null, address: d.address || null,
    items, ship: d.ship || 0, discount: d.discount || 0, total, due, paid: 0, cod,
    status: due > 0 ? 'cho_tra' : 'cod', created_at: now,
    hold_until: now + (due > 0 ? state.settings.hold_hours * 3600e3 : state.settings.cod_hold_days * 86400e3),
    paid_at: null, paid_via: null, done_at: null, payments: [], notes: [],
  };
  state.orders.push(o);
  say(M.orderCreated(o, state.shop, now));
  const q = qrOut(state, o);
  if (q) out.push(q);
}

/* ---------------- định kỳ ---------------- */

export function tick(state0, ctx) {
  const state = structuredClone(state0);
  const now = ctx.now;
  const out = [];
  const expired = [];
  for (const o of state.orders) {
    if (o.status === 'cho_tra' && now > o.hold_until) { o.status = 'het_han'; o.done_at = now; expired.push(o); }
  }
  if (expired.length) {
    out.push({ text: '⌛ Hết giờ giữ hàng, khách chưa chuyển:\n' + expired.map((o) => 'Đơn ' + o.no + (o.name ? ' · ' + o.name : '') + ' · ' + vnd(o.due)).join('\n') + '\nHàng đã trả lại kho. Muốn giữ tiếp nhắn: gia hạn ' + expired[0].no });
  }
  const t = local(now);
  if (t.hour >= state.settings.report_hour && state.last_report_day !== t.day && state.orders.some((o) => local(o.created_at).day === t.day || (o.paid_at && local(o.paid_at).day === t.day) || OPEN.has(o.status))) {
    state.last_report_day = t.day;
    out.push({ text: report(state, now) });
  }
  // Dọn đơn đã xong quá lâu (phí đã nằm trong paid_log).
  const cutoff = now - state.settings.keep_days * 86400e3;
  state.orders = state.orders.filter((o) => !(o.done_at && o.done_at < cutoff && !HELD.has(o.status)));
  state.paid_log = state.paid_log.filter((p) => p.at >= now - 400 * 86400e3);
  return { state, out };
}

export function report(state, now) {
  const day = local(now).day;
  const today = state.orders.filter((o) => local(o.created_at).day === day);
  const paidToday = state.orders.filter((o) => o.paid_at && local(o.paid_at).day === day);
  const open = state.orders.filter((o) => OPEN.has(o.status));
  const cod = state.orders.filter((o) => o.status === 'cod');
  const low = Object.values(state.products).filter((p) => available(state, p.sku, now) <= state.settings.low_stock);
  const L = ['📊 TỔNG KẾT ' + day.slice(8) + '/' + day.slice(5, 7),
    'Đơn mới: ' + today.length,
    'Đã thu: ' + paidToday.length + ' đơn · ' + vnd(paidToday.reduce((s, o) => s + o.due, 0)),
    'Chưa trả: ' + open.length + ' đơn · ' + vnd(open.reduce((s, o) => s + o.due - o.paid, 0))];
  if (open.length) L.push(...open.slice(0, 8).map((o) => '  ' + M.orderLine(o, now)));
  if (cod.length) L.push('Chờ giao thu hộ: ' + cod.length + ' đơn');
  if (low.length) L.push('Sắp hết: ' + low.map((p) => p.sku + ' (còn ' + available(state, p.sku, now) + ')').join(', '));
  return L.join('\n');
}

export function monthFee(state, month) {
  const paid = state.paid_log.filter((p) => local(p.at).month === month).length;
  const raw = Math.max(0, paid - FEE.free) * FEE.per_order;
  return { month, paid_orders: paid, fee: Math.min(raw, FEE.cap), capped: raw > FEE.cap };
}
