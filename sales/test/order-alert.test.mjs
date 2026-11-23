import test from 'node:test';
import assert from 'node:assert/strict';
import { orderAlertRoute, ORDER_ALERT_PATH, DAILY_CAP } from '../worker/order-alert-route.mjs';
import { checkOrderFacts, composeOrderAlert, composeOrderEmail } from '../lib/order-alert.mjs';

function fakeDb(preset = []) {
  const rows = new Map(preset.map((k) => [k, 'X']));
  return { rows, prepare(sql) { return { bind(...a) { return {
    first: async () => ({ n: [...rows.keys()].filter((k) => k.startsWith(a[0].replace('%', ''))).length }),
    run: async () => { if (sql.startsWith('INSERT')) { if (rows.has(a[0])) return { meta: { changes: 0 } }; rows.set(a[0], a[2]); return { meta: { changes: 1 } }; } rows.set(a[1], a[0]); return { meta: { changes: 1 } }; },
  }; } }; } };
}
const NOW = Date.parse('2026-11-24T03:00:00Z');
const KEY = 'k'.repeat(40);
const env = (o = {}) => ({ SALES_ORDER_ALERT_ENABLED: 'true', GATEWAY_AUTH_KEY: KEY, ZALO_BOT_TOKEN: 'TOKEN', ZALO_OWNER_CHAT_ID: 'owner-chat', REPLAY_DB: fakeDb(), ...o });
const order = (o = {}) => ({ order_id: 'ORD-20261124030000-exec6999-550000', sku: 'A003', product_name: 'Áo thun nam đen basic size L', quantity: 2, unit_price: 159000, total: 318000, phone: '0912345678', customer_name: 'QA Tien', address: '12 Lê Duẩn, Đà Nẵng', channel: 'messenger', available_after: 16, ...o });
const req = (b, auth = 'Bearer ' + KEY) => new Request('https://w' + ORDER_ALERT_PATH, { method: 'POST', headers: { authorization: auth, 'content-type': 'application/json' }, body: JSON.stringify(b) });
let sends = [], reply = { status: 200, body: { ok: true } };
const provider = async (url, init) => { sends.push({ url, body: JSON.parse(init.body) }); return new Response(JSON.stringify(reply.body), { status: reply.status }); };
const call = async (e, b, auth) => { const r = await orderAlertRoute(req(b, auth), e, ORDER_ALERT_PATH, NOW, provider); return { status: r.status, body: await r.json() }; };

test('new order -> exactly one Zalo message to the owner with exact facts', async () => {
  sends = []; reply = { status: 200, body: { ok: true } };
  const r = await call(env(), order());
  assert.equal(r.status, 200); assert.equal(r.body.result, 'API_ACCEPTED'); assert.equal(sends.length, 1);
  assert.equal(sends[0].body.chat_id, 'owner-chat');
  assert.equal(sends[0].body.text, '★ ĐƠN MỚI qua Messenger\nORD-20261124030000-exec6999-550000\nA003 · Áo thun nam đen basic size L\n2 × 159.000đ = 318.000đ\n☎ QA Tien · 0912345678\n⌂ 12 Lê Duẩn, Đà Nẵng\nⓘ Gọi khách xác nhận rồi đổi trạng thái trong Sheet.');
  const t = sends[0].body; assert.ok(t.text_styles.some((s) => t.text.substr(s.start, s.len) === '318.000đ'));
});
test('same order replayed -> 409, never a second message', async () => {
  sends = []; const e = env();
  await call(e, order()); const r = await call(e, order());
  assert.equal(r.status, 409); assert.equal(sends.length, 1);
});
test('caller cannot pick the recipient', async () => {
  sends = []; const r = await call(env(), { ...order(), chat_id: 'attacker' });
  assert.equal(r.status, 400); assert.equal(sends.length, 0);
});
test('wrong key 401, switch off 423, GET 405', async () => {
  sends = [];
  assert.equal((await call(env(), order(), 'Bearer nope')).status, 401);
  assert.equal((await call(env({ SALES_ORDER_ALERT_ENABLED: 'false' }), order())).status, 423);
  const g = await orderAlertRoute(new Request('https://w' + ORDER_ALERT_PATH), env(), ORDER_ALERT_PATH, NOW, provider);
  assert.equal(g.status, 405); assert.equal(sends.length, 0);
});
test('inconsistent / suspicious facts refused before any send', async () => {
  sends = [];
  for (const bad of [{ total: 1 }, { unit_price: 0, total: 0 }, { quantity: 1.5 }, { phone: '12345' }, { order_id: 'hello' }, { channel: 'email' }, { customer_name: '   ' }, { sku: 'a003; drop' }]) {
    assert.equal((await call(env(), order(bad))).status, 422, JSON.stringify(bad));
  }
  assert.equal(sends.length, 0);
});
test('links and control chars in name/address are neutralised', () => {
  const f = checkOrderFacts(order({ customer_name: 'Bấm https://evil.example‮', address: 'A\u0000B www.x.y' })).facts;
  assert.equal(f.name, 'Bấm [link]'); assert.equal(f.address, 'A B [link]');
});
test('low stock warning when 3 or fewer left', () => {
  assert.match(composeOrderAlert(checkOrderFacts(order({ available_after: 2 })).facts).text, /A003 chỉ còn 2 có thể đặt/);
  assert.doesNotMatch(composeOrderAlert(checkOrderFacts(order()).facts).text, /chỉ còn/);
});
test('Zalo rejects styles -> one plain retry; timeout -> no retry, email fallback', async () => {
  sends = []; reply = { status: 400, body: { ok: false } };
  const r = await call(env(), order()); assert.equal(r.status, 502); assert.equal(sends.length, 2); assert.equal(r.body.fallback, 'email');
  assert.equal(sends[1].body.text_styles, undefined);
  sends = []; const e = env();
  const boom = async () => { throw new Error('timeout'); };
  const x = await orderAlertRoute(req(order()), e, ORDER_ALERT_PATH, NOW, boom);
  assert.equal(x.status, 502); assert.equal((await x.json()).retry_allowed, false);
  reply = { status: 200, body: { ok: true } };
});
test('daily cap', async () => {
  sends = []; const pre = Array.from({ length: DAILY_CAP }, (_, i) => 'SALES_ORDER_ALERT_2026-11-24_ORD-' + i);
  const r = await call(env({ REPLAY_DB: fakeDb(pre) }), order());
  assert.equal(r.status, 429); assert.equal(sends.length, 0);
});
test('email fallback text', () => {
  const m = composeOrderEmail(checkOrderFacts(order()).facts);
  assert.equal(m.subject, '[TIEN404] Đơn mới A003 × 2 = 318.000đ (Messenger)');
  assert.match(m.body, /Khách: QA Tien - 0912345678/);
});
