import test from 'node:test';
import assert from 'node:assert/strict';
import { v22OwnerTextRoute, composeText, OWNER_TEXT_PATH } from './worker-v22-owner-text.mjs';

function fakeDb() {
  const rows = new Map();
  return { rows, prepare(sql) { return { bind(...a) { return {
    first: async () => sql.startsWith('SELECT COUNT') ? { n: [...rows.keys()].filter((k) => k.startsWith(a[0].replace('%', ''))).length } : null,
    run: async () => { if (sql.startsWith('INSERT')) { if (rows.has(a[0])) return { meta: { changes: 0 } }; rows.set(a[0], a[2]); return { meta: { changes: 1 } }; } rows.set(a[1], a[0]); return { meta: { changes: 1 } }; },
  }; } }; } };
}
const NOW = Date.parse('2026-11-21T15:00:00Z');
const env = (o = {}) => ({ ZALO_SEND_ENABLED: 'false', ZALO_OWNER_TEXT_ENABLED: 'true', ZALO_OWNER_TEXT_EXPIRES: '2026-11-22T14:10:00Z', GATEWAY_AUTH_KEY: 'k'.repeat(40), ZALO_BOT_TOKEN: 'TOKEN', ZALO_OWNER_CHAT_ID: 'owner-chat', REPLAY_DB: fakeDb(), ...o });
const body = (o = {}) => ({ chat_id: 'owner-chat', event_message_id: 'mid0001', kind: 'PRICE_PREVIEW', sku: 'F01', unit_price_vnd: 456000, stock: 5, ...o });
const req = (b, auth = 'Bearer ' + 'k'.repeat(40)) => new Request('https://w' + OWNER_TEXT_PATH, { method: 'POST', headers: { authorization: auth, 'content-type': 'application/json' }, body: JSON.stringify(b) });
const sends = []; const provider = async (url, init) => { sends.push({ url, body: JSON.parse(init.body) }); return new Response(JSON.stringify({ ok: true, result: { message_id: 'z1' } }), { status: 200 }); };
const call = async (e, b, auth) => { const r = await v22OwnerTextRoute(req(b, auth), e, OWNER_TEXT_PATH, NOW, provider); return { status: r.status, body: await r.json() }; };

test('owner price preview -> exactly one sendMessage to owner with sandbox text', async () => {
  sends.length = 0; const e = env();
  const r = await call(e, body());
  assert.equal(r.status, 200); assert.equal(r.body.result, 'API_ACCEPTED');
  assert.equal(sends.length, 1); assert.match(sends[0].url, /sendMessage$/);
  assert.equal(sends[0].body.chat_id, 'owner-chat');
  assert.equal(sends[0].body.text, '[TIEN404 SANDBOX - Shop B] F01: 456.000đ, tồn QA 5. Chỉ xem giá, chưa tạo đơn.');
});
test('same inbound message replayed -> 409, no second send', async () => {
  sends.length = 0; const e = env();
  await call(e, body()); const r = await call(e, body());
  assert.equal(r.status, 409); assert.equal(sends.length, 1);
});
test('another chat id (customer B) -> 403, no send', async () => {
  sends.length = 0; const r = await call(env(), body({ chat_id: 'someone-else' }));
  assert.equal(r.status, 403); assert.equal(sends.length, 0);
});
test('wrong gateway key -> 401; disabled switch -> 423; expired -> 403; global switch on -> 423', async () => {
  sends.length = 0;
  assert.equal((await call(env(), body(), 'Bearer nope')).status, 401);
  assert.equal((await call(env({ ZALO_OWNER_TEXT_ENABLED: 'false' }), body())).status, 423);
  assert.equal((await call(env({ ZALO_OWNER_TEXT_EXPIRES: '2026-11-21T14:00:00Z' }), body())).status, 403);
  assert.equal((await call(env({ ZALO_SEND_ENABLED: 'true' }), body())).status, 423);
  assert.equal(sends.length, 0);
});
test('free text / unknown kind / other SKU / inconsistent total rejected', async () => {
  sends.length = 0;
  assert.equal((await call(env(), body({ kind: 'FREE_TEXT', text: 'hi' }))).status, 422);
  assert.equal((await call(env(), body({ sku: 'A003' }))).status, 422);
  assert.equal((await call(env(), body({ kind: 'ORDER_DRAFT_PREVIEW', quantity: 2, total_vnd: 1 }))).status, 422);
  assert.equal(sends.length, 0);
});
test('order draft text has correct total', () => {
  assert.equal(composeText({ kind: 'ORDER_DRAFT_PREVIEW', sku: 'F01', unit_price_vnd: 456000, quantity: 2, total_vnd: 912000 }),
    '[TIEN404 SANDBOX - Shop B] F01: 2 × 456.000đ = 912.000đ. Bản nháp QA: chưa ghi đơn, chưa trừ kho.');
});
test('daily cap 30', async () => {
  const e = env();
  for (let i = 0; i < 30; i++) await call(e, body({ event_message_id: 'mid' + String(i).padStart(4, '0') }));
  assert.equal((await call(e, body({ event_message_id: 'mid9999' }))).status, 429);
});
