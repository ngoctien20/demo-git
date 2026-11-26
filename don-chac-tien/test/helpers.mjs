import * as E from '../lib/engine.mjs';
export const T0 = Date.UTC(2026, 10, 25, 3, 0); // 10:00 giờ VN
export function shop() {
  let seed = 7;
  const ctx = { now: T0, rand: () => (seed = (seed * 16807) % 2147483647) / 2147483647 };
  let st = E.newShop({ name: 'Shop Thử', now: T0 });
  const say = (text) => { const r = E.ownerMessage(st, text, ctx); st = r.state; return r.out; };
  const bank = (tx) => { const r = E.bankTransfer(st, tx, ctx); st = r.state; return r; };
  const tick = () => { const r = E.tick(st, ctx); st = r.state; return r.out; };
  say('ngân hàng MB 0123456789 NGUYEN VAN A'); say('1');
  say('thêm hàng A003 áo thun đen 159k còn 18');
  say('thêm hàng A011 áo len 289k còn 1');
  return { ctx, say, bank, tick, get st() { return st; }, order: (no) => st.orders.find((o) => o.no === no) };
}
