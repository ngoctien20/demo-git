import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, createHash } from 'node:crypto';
import { makeD1 } from './d1-shim.mjs';
import { route, cron, qrSig } from '../worker/worker.mjs';

const T0 = Date.UTC(2026, 10, 25, 3, 0);
const KEYS = { DCT_HUB_INBOUND_KEY: 'k-in-'.padEnd(40, 'x'), DCT_HUB_SEND_KEY: 'k-send-'.padEnd(40, 'y'), DCT_QR_SIGN_KEY: 'k-qr-'.padEnd(40, 'z') };

function rig() {
  const env = { ...KEYS, DCT_ENABLED: 'true', DCT_PUBLIC_BASE: 'https://dct.test', HUB_BASE: 'https://hub.test', DCT_DB: makeD1() };
  const sent = []; const pending = [];
  let now = T0; let seed = 3;
  const deps = {
    now: () => now, rand: () => (seed = (seed * 16807) % 2147483647) / 2147483647,
    fetch: async (url, init) => { sent.push({ url, init, body: JSON.parse(init.body) }); return new Response('{"ok":true}', { status: 200 }); },
    waitUntil: (p) => pending.push(p), log: () => {},
  };
  const hub = async (text, { isOwner = true, chat = 'owner-chat-1', key = KEYS.DCT_HUB_INBOUND_KEY, type = 'text', ts } = {}) => {
    const body = JSON.stringify({ v: 1, channel: 'zalo_bot', connection_id: 'conn1', store_id: 'zl-shop1', is_owner: isOwner, event: { type, text, chat: { id: chat }, message_id: 'm' + Math.random() } });
    const t = ts ?? String(Math.floor(now / 1000));
    const sig = createHmac('sha256', key).update(t + '.' + body).digest('hex');
    const res = await route(new Request('https://dct.test/v1/hub/owner', { method: 'POST', body, headers: { 'x-tien404-ts': t, 'x-tien404-signature': sig } }), env, deps);
    await Promise.all(pending.splice(0));
    return res;
  };
  return { env, deps, sent, hub, setNow: (n) => { now = n; }, flush: () => Promise.all(pending.splice(0)) };
}

test('tắt công tắc thì không làm gì', async () => {
  const r = rig(); r.env.DCT_ENABLED = 'false';
  assert.equal((await r.hub('cô Hoa 350k')).status, 503);
  assert.equal(r.sent.length, 0);
});

test('chữ ký sai / quá hạn / không phải chủ shop → từ chối hoặc bỏ qua', async () => {
  const r = rig();
  assert.equal((await r.hub('cô Hoa 350k', { key: 'sai'.padEnd(40, 'q') })).status, 401);
  assert.equal((await r.hub('cô Hoa 350k', { ts: String(Math.floor(T0 / 1000) - 3600) })).status, 401);
  const res = await r.hub('cô Hoa 350k', { isOwner: false });
  assert.deepEqual(await res.json(), { ok: true, ignored: 'NOT_OWNER' });
  assert.equal(r.sent.length, 0);
});

test('chủ nhắn qua hub → trả lời qua hub /v1/send đúng chat, kèm link ảnh QR có chữ ký', async () => {
  const r = rig();
  await r.hub('ngân hàng MB 0123456789 NGUYEN VAN A');
  await r.hub('1');
  r.sent.length = 0;
  await r.hub('cô Hoa 350k');
  assert.equal(r.sent.length, 2);
  for (const s of r.sent) {
    assert.equal(s.url, 'https://hub.test/v1/send');
    assert.equal(s.init.headers.authorization, 'Bearer ' + KEYS.DCT_HUB_SEND_KEY);
    assert.equal(s.body.chat_id, 'owner-chat-1');
    assert.equal(s.body.connection_id, 'conn1');
  }
  const link = /Ảnh mã QR: (\S+)/.exec(r.sent[1].body.text)[1];
  const png = await route(new Request(link), r.env, r.deps);
  assert.equal(png.status, 200); assert.equal(png.headers.get('content-type'), 'image/png');
  const bytes = new Uint8Array(await png.arrayBuffer());
  assert.deepEqual([...bytes.slice(1, 4)], [80, 78, 71]);
  const bad = await route(new Request(link.replace(/s=\w/, 's=0')), r.env, r.deps);
  assert.equal(bad.status, 404);
});

test('người khác (không phải chat chủ đã lưu) không ra lệnh được', async () => {
  const r = rig();
  await r.hub('cô Hoa 350k');
  r.sent.length = 0;
  const res = await r.hub('ai chưa trả', { chat: 'stranger' });
  assert.deepEqual(await res.json(), { ok: true, ignored: 'OTHER_OWNER' });
  assert.equal(r.sent.length, 0);
});

test('ảnh/ghi âm → hướng dẫn bấm micro để nói thành chữ', async () => {
  const r = rig();
  await r.hub(undefined, { type: 'voice' });
  assert.match(r.sent[0].body.text, /micro/);
});

test('SePay báo tiền → khớp đơn → báo chủ; khoá sai bị từ chối; gửi lại không ghi 2 lần', async () => {
  const r = rig();
  await r.hub('ngân hàng MB 0123456789 NGUYEN VAN A'); await r.hub('1'); await r.hub('cô Hoa 350k');
  const row = await r.env.DCT_DB.prepare('SELECT state FROM shops WHERE store_id = ?').bind('zl-shop1').first();
  const code = JSON.parse(row.state).orders[0].code;
  const id = 'a'.repeat(32); const key = 'sepay-key-123456';
  await r.env.DCT_DB.prepare('INSERT INTO bank_links (id, store_id, provider, key_hash, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(id, 'zl-shop1', 'sepay', createHash('sha256').update(key).digest('hex'), T0).run();
  const body = JSON.stringify({ id: 92704, gateway: 'MBBank', transactionDate: '2026-11-25 10:30:00', accountNumber: '0123456789', content: 'MBVCB.1.' + code + '.CT', transferType: 'in', transferAmount: 350000, referenceCode: 'FT1' });
  const call = (k) => route(new Request('https://dct.test/v1/bank/sepay/' + id, { method: 'POST', body, headers: { authorization: 'Apikey ' + k } }), r.env, r.deps);
  assert.equal((await call('wrong')).status, 401);
  r.sent.length = 0;
  const res = await call(key);
  assert.deepEqual(await res.json(), { success: true, results: ['paid'] });
  await r.flush();
  assert.match(r.sent[0].body.text, /TIỀN VỀ · ĐƠN 1/);
  assert.deepEqual((await (await call(key)).json()).results, ['duplicate']);
});

test('cron: hết hạn giữ hàng thì nhả và báo chủ; link QR của đơn hết hạn không dùng được nữa', async () => {
  const r = rig();
  await r.hub('ngân hàng MB 0123456789 NGUYEN VAN A'); await r.hub('1'); await r.hub('cô Hoa 350k');
  const link = /Ảnh mã QR: (\S+)/.exec(r.sent.at(-1).body.text)[1];
  r.setNow(T0 + 13 * 3600e3); r.sent.length = 0;
  await cron(r.env, r.deps);
  assert.match(r.sent.map((s) => s.body.text).join('\n'), /Hết giờ giữ hàng/);
  assert.equal((await route(new Request(link), r.env, r.deps)).status, 410);
});

test('ảnh QR của shop dạng SVG (in dán quầy) qua link đã ký', async () => {
  const r = rig();
  await r.hub('ngân hàng MB 0123456789 NGUYEN VAN A'); await r.hub('1'); await r.hub('in qr');
  const sig = await qrSig(r.env, 'zl-shop1', 'SHOP');
  const svg = await route(new Request('https://dct.test/qr/zl-shop1/SHOP.svg?s=' + sig), r.env, r.deps);
  assert.equal(svg.headers.get('content-type'), 'image/svg+xml');
  assert.match(await svg.text(), /^<svg[\s\S]*<\/svg>$/);
});
