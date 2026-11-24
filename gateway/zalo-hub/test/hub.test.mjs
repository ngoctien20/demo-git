// Offline tests: fake Zalo API + fake shop flow; real SQL via node:sqlite. No network, no real token.
import test from 'node:test';
import assert from 'node:assert/strict';
import { route, normalize, forwardUrlAllowed } from '../src/worker.mjs';
import { extractToken, redact } from '../src/zalo-api.mjs';
import { signBody, verifyBody, seal, open, b64, randomBytes } from '../src/crypto.mjs';
import { makeD1 } from './d1-shim.mjs';

const ADMIN = 'a'.repeat(40);
const TOKEN_A = '1111111111:FAKE_token_shop_A_xyz';
const TOKEN_B = '2222222222:FAKE_token_shop_B_xyz';
const FWD = 'https://flow.example.test/webhook/zalo-qa';

function harness(over = {}) {
  const env = {
    ZH_DB: makeD1(), ZH_ADMIN_KEY: ADMIN, ZH_MASTER_KEY: b64(randomBytes(32)), ZH_ENABLED: 'true', ZH_SEND_ENABLED: 'true',
    ZH_PUBLIC_BASE_URL: 'https://hub.example.test', ZH_FORWARD_HOSTS: 'flow.example.test', ...over,
  };
  const st = { now: Date.parse('2026-11-23T15:00:00Z'), zalo: [], forwards: [], pending: [], logs: [], webhooks: {}, zaloFail: {}, users: {}, members: [], sb: [] };
  const bots = { [TOKEN_A]: { id: 'bot-a', account_name: 'bot.ShopA' }, [TOKEN_B]: { id: 'bot-b', account_name: 'bot.ShopB' } };
  const fetchImpl = async (url, init) => {
    const u = String(url);
    if (u.startsWith('https://bot-api.zaloplatforms.com/bot')) {
      const m = u.match(/\.com\/bot(.+)\/(\w+)$/);
      const token = m[1], method = m[2];
      const body = JSON.parse(init.body);
      st.zalo.push({ token, method, body });
      const fail = st.zaloFail[method];
      if (fail) return new Response(JSON.stringify({ ok: false, error_code: fail, description: `fail for bot${token}` }), { status: 200 });
      if (!bots[token]) return new Response(JSON.stringify({ ok: false, error_code: 401, description: 'Unauthorized' }), { status: 200 });
      if (method === 'getMe') return new Response(JSON.stringify({ ok: true, result: { ...bots[token], account_type: 'BASIC' } }));
      if (method === 'setWebhook') { st.webhooks[token] = body; return new Response(JSON.stringify({ ok: true, result: { url: body.url, verification: { ok: true, outcome: 'webhook.ok' } } })); }
      if (method === 'deleteWebhook') { delete st.webhooks[token]; return new Response(JSON.stringify({ ok: true, result: true })); }
      return new Response(JSON.stringify({ ok: true, result: { message_id: 'z' + st.zalo.length, date: st.now } }));
    }
    if (u.startsWith('https://fakeproj.supabase.co/')) {
      const jwt = String(init.headers.authorization || '').slice(7);
      const user = st.users[jwt];
      if (u.endsWith('/auth/v1/user')) return user ? new Response(JSON.stringify({ id: user.id })) : new Response('{}', { status: 401 });
      const q = new URL(u).searchParams;
      const rows = (st.members || []).filter((m) => 'eq.' + m.user_id === q.get('user_id') && 'eq.' + m.store_id === q.get('store_id'));
      st.sb.push(u);
      return new Response(JSON.stringify(rows.map((m) => ({ role: m.role }))));
    }
    if (u.startsWith('https://flow.example.test/')) {
      st.forwards.push({ url: u, headers: init.headers, body: init.body });
      return new Response('{}', { status: 200 });
    }
    throw new Error('unexpected fetch ' + u);
  };
  const deps = { fetch: fetchImpl, now: () => st.now, waitUntil: (p) => st.pending.push(p), log: (...a) => st.logs.push(a.join(' ')) };
  const req = async (method, path, body, headers = {}) => {
    const r = await route(new Request('https://hub.example.test' + path, { method, headers: { 'content-type': 'application/json', ...headers }, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) }), env, deps);
    await Promise.all(st.pending.splice(0));
    return { status: r.status, headers: Object.fromEntries(r.headers), body: await r.json() };
  };
  const admin = (path, body) => req('POST', path, body, { authorization: 'Bearer ' + ADMIN });
  return { env, st, req, admin };
}

const textEvent = (chatId, text, mid) => ({ ok: true, result: { event_name: 'message.text.received', message: { message_id: mid, date: 1, message_type: 'CHAT_TEXT', from: { id: chatId, display_name: 'Khách', is_bot: false }, chat: { id: chatId, chat_type: 'PRIVATE' }, text } } });

async function connect(h, storeId = 'qa-zalo-bot', token = TOKEN_A, extra = {}) {
  const r = await h.admin('/v1/admin/connect', { store_id: storeId, token_text: `Thông tin Bot của bạn\nBot Token: ${token}\nGiữ bí mật nhé`, forward_url: FWD, ...extra });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const wh = h.st.webhooks[token];
  return { ...r.body, path: wh ? new URL(wh.url).pathname : null, secret: wh ? wh.secret_token : null };
}
const hook = (h, c, body, secret = c.secret) => h.req('POST', c.path, body, { 'x-bot-api-secret-token': secret });
async function signedSend(h, c, body, key = c.forward_key) {
  const text = JSON.stringify({ connection_id: c.connection_id, ...body });
  const ts = String(Math.floor(h.st.now / 1000));
  return h.req('POST', '/v1/send', text, { 'x-tien404-connection': c.connection_id, 'x-tien404-ts': ts, 'x-tien404-signature': await signBody(key, ts, text) });
}
async function pairOwner(h, c, chat = 'owner-chat') {
  const r = await hook(h, c, textEvent(chat, c.pairing_code, 'm-pair-' + chat));
  assert.equal(r.body.accepted, 'PAIRING');
}

test('token is extracted from a pasted Zalo message and redacted in logs', () => {
  assert.equal(extractToken(`Bot Token: ${TOKEN_A}.`), TOKEN_A);
  assert.equal(extractToken('không có mã'), null);
  assert.ok(!redact(`https://bot-api.zaloplatforms.com/bot${TOKEN_A}/sendMessage`).includes('FAKE_token'));
});

test('connect: getMe, per-shop path + secret, token sealed, nothing secret stored in clear', async () => {
  const h = harness();
  const c = await connect(h);
  assert.equal(c.status, 'pending_owner');
  assert.match(c.pairing_code, /^\d{6}$/);
  assert.equal(c.bot_name, 'bot.ShopA');
  assert.match(c.path, /^\/v1\/zalo\/wh\/[0-9a-f]{32}$/);
  assert.ok(c.secret.length >= 40);
  assert.equal(c.manual_webhook, undefined);
  const row = h.env.ZH_DB.sqlite.prepare('SELECT * FROM zh_connections').get();
  const dump = JSON.stringify(row);
  for (const s of [TOKEN_A, c.secret, c.forward_key, c.inbound_key, c.pairing_code]) assert.ok(!dump.includes(s), 'clear secret in DB');
  assert.equal(row.token_last4, TOKEN_A.slice(-4));
});

test('connect refuses: bad admin key, unknown forward host, bad token, bot already owned, second bot for same shop', async () => {
  const h = harness();
  assert.equal((await h.req('POST', '/v1/admin/connect', {}, { authorization: 'Bearer wrong' })).status, 401);
  assert.equal((await h.admin('/v1/admin/connect', { store_id: 'qa-zalo-bot', token_text: TOKEN_A, forward_url: 'https://evil.test/x' })).body.error, 'FORWARD_URL_NOT_ALLOWED');
  assert.equal((await h.admin('/v1/admin/connect', { store_id: 'qa-zalo-bot', token_text: '9999999:UNKNOWN_FAKE_token', forward_url: FWD })).body.error, 'TOKEN_REJECTED');
  await connect(h, 'shop-a', TOKEN_A);
  assert.equal((await h.admin('/v1/admin/connect', { store_id: 'shop-b', token_text: TOKEN_A, forward_url: FWD })).body.error, 'BOT_OWNED_BY_OTHER_STORE');
  assert.equal((await h.admin('/v1/admin/connect', { store_id: 'shop-a', token_text: TOKEN_B, forward_url: FWD })).body.error, 'STORE_HAS_LIVE_BOT');
});

test('setWebhook failure leaves no connection behind', async () => {
  const h = harness();
  h.st.zaloFail.setWebhook = 400;
  const r = await h.admin('/v1/admin/connect', { store_id: 'qa-zalo-bot', token_text: TOKEN_A, forward_url: FWD });
  assert.equal(r.body.error, 'SET_WEBHOOK_FAILED');
  assert.equal(h.env.ZH_DB.sqlite.prepare('SELECT COUNT(*) n FROM zh_connections').get().n, 0);
});

test('manual mode returns webhook url + secret once for Zalo Bot Creator, no setWebhook call', async () => {
  const h = harness();
  const r = await h.admin('/v1/admin/connect', { store_id: 'qa-zalo-bot', token_text: TOKEN_A, forward_url: FWD, set_webhook: false });
  assert.equal(r.status, 200);
  assert.match(r.body.manual_webhook.url, /^https:\/\/hub\.example\.test\/v1\/zalo\/wh\/[0-9a-f]{32}$/);
  assert.ok(!h.st.zalo.some((x) => x.method === 'setWebhook'));
});

test('webhook: wrong secret 403, unknown path 404, verification ping 200 without forward', async () => {
  const h = harness();
  const c = await connect(h);
  assert.equal((await hook(h, c, textEvent('u1', 'hi', 'm1'), 'wrong-secret')).status, 403);
  assert.equal((await h.req('POST', '/v1/zalo/wh/' + '0'.repeat(32), {}, { 'x-bot-api-secret-token': c.secret })).status, 404);
  const ping = await hook(h, c, {});
  assert.equal(ping.body.ignored, 'NO_MESSAGE');
  assert.equal(h.st.forwards.length, 0);
});

test('pairing: strangers are ignored, wrong codes are limited, right code activates and greets the owner', async () => {
  const h = harness();
  const c = await connect(h);
  await hook(h, c, textEvent('stranger', 'xin chào', 'm1'));
  assert.equal(h.st.forwards.length, 0);
  assert.ok(!h.st.zalo.some((x) => x.method === 'sendMessage'));
  const wrong = c.pairing_code === '000000' ? '111111' : '000000';
  for (let i = 0; i < 5; i++) await hook(h, c, textEvent('guesser', wrong, 'mg' + i));
  await hook(h, c, textEvent('guesser', c.pairing_code, 'mg-right'));
  let row = h.env.ZH_DB.sqlite.prepare('SELECT status FROM zh_connections').get();
  assert.equal(row.status, 'pending_owner', 'locked after 5 wrong tries');
  const fresh = await h.admin('/v1/admin/pairing', { connection_id: c.connection_id });
  await pairOwner(h, { ...c, pairing_code: fresh.body.pairing_code });
  row = h.env.ZH_DB.sqlite.prepare('SELECT status, owner_chat_id FROM zh_connections').get();
  assert.deepEqual({ ...row }, { status: 'active', owner_chat_id: 'owner-chat' });
  const greet = h.st.zalo.find((x) => x.method === 'sendMessage');
  assert.equal(greet.body.chat_id, 'owner-chat');
  assert.equal(greet.token, TOKEN_A);
});

test('pairing code expires after 30 minutes', async () => {
  const h = harness();
  const c = await connect(h);
  h.st.now += 31 * 60 * 1000;
  await pairOwner(h, c);
  assert.equal(h.env.ZH_DB.sqlite.prepare('SELECT status FROM zh_connections').get().status, 'pending_owner');
});

test('active: customer message is forwarded once, signed, with store decided by path', async () => {
  const h = harness();
  const c = await connect(h);
  await pairOwner(h, c);
  const evil = textEvent('cust-1', 'còn áo hoa không', 'm100');
  evil.result.store_id = 'shop-b'; // payload cannot choose the shop
  assert.equal((await hook(h, c, evil)).body.accepted, 'FORWARDED');
  assert.equal((await hook(h, c, evil)).body.ignored, 'DUPLICATE');
  assert.equal(h.st.forwards.length, 1);
  const f = h.st.forwards[0];
  const body = JSON.parse(f.body);
  assert.equal(body.store_id, 'qa-zalo-bot');
  assert.equal(body.event.text, 'còn áo hoa không');
  assert.equal(body.is_owner, false);
  assert.equal(body.usage.users, 2);
  assert.ok(await verifyBody(c.forward_key, f.headers['x-tien404-ts'], f.body, f.headers['x-tien404-signature'], h.st.now));
  assert.ok(!f.body.includes(TOKEN_A));
});

test('two shops stay isolated: each path forwards only its own shop', async () => {
  const h = harness();
  const a = await connect(h, 'shop-a', TOKEN_A);
  const b = await connect(h, 'shop-b', TOKEN_B);
  await pairOwner(h, a, 'owner-a');
  await pairOwner(h, b, 'owner-b');
  await hook(h, b, textEvent('cust-b', 'giá?', 'mb1'));
  assert.equal(JSON.parse(h.st.forwards.at(-1).body).store_id, 'shop-b');
  assert.equal((await hook(h, a, textEvent('x', 'y', 'mx'), b.secret)).status, 403, "shop B's secret cannot post to shop A's path");
  const cross = await signedSend(h, a, { chat_id: 'cust-b', text: 'hi' });
  assert.equal(cross.body.error, 'UNKNOWN_CHAT', "shop A cannot message shop B's customer");
  const forged = await signedSend(h, a, { chat_id: 'owner-a', text: 'hi' }, b.forward_key);
  assert.equal(forged.status, 401, "shop B's key cannot sign for shop A");
});

test('send: signed reply reaches Zalo with the right token, counts quota, rejects replay and stale signatures', async () => {
  const h = harness({ ZH_MONTHLY_CAP: '3' });
  const c = await connect(h);
  await pairOwner(h, c); // greeting = 1 send
  await hook(h, c, textEvent('cust-1', 'giá?', 'm1'));
  const ok = await signedSend(h, c, { chat_id: 'cust-1', text: 'Dạ áo A003 giá 159.000đ', typing: true });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.sent_count, 2);
  const sent = h.st.zalo.filter((x) => x.method === 'sendMessage').at(-1);
  assert.equal(sent.token, TOKEN_A);
  assert.equal(sent.body.chat_id, 'cust-1');
  await signedSend(h, c, { chat_id: 'cust-1', text: 'tin 3' });
  assert.equal((await signedSend(h, c, { chat_id: 'cust-1', text: 'tin 4' })).body.error, 'MONTHLY_CAP');
  const text = JSON.stringify({ connection_id: c.connection_id, chat_id: 'cust-1', text: 'x' });
  const oldTs = String(Math.floor(h.st.now / 1000) - 3600);
  const stale = await h.req('POST', '/v1/send', text, { 'x-tien404-connection': c.connection_id, 'x-tien404-ts': oldTs, 'x-tien404-signature': await signBody(c.forward_key, oldTs, text) });
  assert.equal(stale.status, 401);
});

test('Zalo 401 marks the shop needs_reconnect (owner reset the token in Zalo)', async () => {
  const h = harness();
  const c = await connect(h);
  await pairOwner(h, c);
  await hook(h, c, textEvent('cust-1', 'hi', 'm1'));
  h.st.zaloFail.sendMessage = 401;
  const r = await signedSend(h, c, { chat_id: 'cust-1', text: 'x' });
  assert.equal(r.body.error, 'ZALO_401');
  assert.equal(h.env.ZH_DB.sqlite.prepare('SELECT status FROM zh_connections').get().status, 'needs_reconnect');
  assert.ok(!JSON.stringify(r.body).includes('FAKE_token'));
});

test('kill switches: hub off ignores webhooks; send off returns 503; disabled shop is silent', async () => {
  const h = harness();
  const c = await connect(h);
  await pairOwner(h, c);
  h.env.ZH_SEND_ENABLED = 'false';
  assert.equal((await signedSend(h, c, { chat_id: 'owner-chat', text: 'x' })).status, 503);
  h.env.ZH_SEND_ENABLED = 'true';
  await h.admin('/v1/admin/disable', { connection_id: c.connection_id });
  assert.equal((await hook(h, c, textEvent('cust', 'hi', 'm9'))).body.ignored, 'CONNECTION_DISABLED');
  assert.equal((await h.admin('/v1/admin/enable', { connection_id: c.connection_id })).body.status, 'active');
  h.env.ZH_ENABLED = 'false';
  assert.equal((await hook(h, c, textEvent('cust', 'hi', 'm10'))).body.ignored, 'HUB_DISABLED');
  assert.equal(h.st.forwards.length, 0);
});

test('disconnect deletes the webhook, wipes sealed secrets, frees the bot for a new connect', async () => {
  const h = harness();
  const c = await connect(h);
  const r = await h.admin('/v1/admin/disconnect', { connection_id: c.connection_id });
  assert.equal(r.body.webhook, 'DELETED');
  const row = h.env.ZH_DB.sqlite.prepare('SELECT status, token_sealed, forward_key_sealed FROM zh_connections').get();
  assert.deepEqual({ ...row }, { status: 'revoked', token_sealed: null, forward_key_sealed: null });
  assert.equal((await hook(h, c, textEvent('u', 'x', 'm1'))).body.ignored, 'CONNECTION_REVOKED');
  assert.equal((await signedSend(h, c, { chat_id: 'u', text: 'x' })).status, 401);
  await connect(h, 'qa-zalo-bot', TOKEN_A);
});

test('status listing is masked', async () => {
  const h = harness();
  const c = await connect(h);
  const r = await h.req('GET', '/v1/admin/connections?store_id=qa-zalo-bot', undefined, { authorization: 'Bearer ' + ADMIN });
  assert.equal(r.body.connections[0].token_last4, TOKEN_A.slice(-4));
  const s = JSON.stringify(r.body);
  for (const x of [TOKEN_A, c.forward_key, c.secret]) assert.ok(!s.includes(x));
});

test('sealed values are bound to their connection, store and field', async () => {
  const env = { ZH_MASTER_KEY: b64(randomBytes(32)) };
  const s = await seal(env, 'secret', 'c1', 's1', 'token');
  assert.equal(await open(env, s, 'c1', 's1', 'token'), 'secret');
  await assert.rejects(open(env, s, 'c1', 's2', 'token'), /SEALED_INVALID/);
  await assert.rejects(open(env, s, 'c2', 's1', 'token'), /SEALED_INVALID/);
  await assert.rejects(open(env, s, 'c1', 's1', 'forward_key'), /SEALED_INVALID/);
  await assert.rejects(open({ ZH_MASTER_KEY: b64(randomBytes(32)) }, s, 'c1', 's1', 'token'), /SEALED_INVALID/);
});

test('helpers: forward host allowlist, normalize unsupported events', () => {
  const env = { ZH_FORWARD_HOSTS: 'ngoctien20.app.n8n.cloud' };
  assert.ok(forwardUrlAllowed(env, 'https://ngoctien20.app.n8n.cloud/webhook/x'));
  assert.ok(!forwardUrlAllowed(env, 'http://ngoctien20.app.n8n.cloud/webhook/x'));
  assert.ok(!forwardUrlAllowed(env, 'https://ngoctien20.app.n8n.cloud:8443/x'));
  assert.ok(!forwardUrlAllowed(env, 'https://user:pw@ngoctien20.app.n8n.cloud/x'));
  const ev = normalize({ event_name: 'message.unsupported.received', message: { message_id: 'm', from: { id: 'u' }, chat: { id: 'u', chat_type: 'PRIVATE' } } });
  assert.equal(ev.type, 'unsupported');
  assert.equal(ev.text, undefined);
});

test('n8n snippets use the same signature scheme as the hub', async () => {
  const { createHmac } = await import('node:crypto');
  const key = 'k'.repeat(43), ts = '1763910000', body = '{"a":1}';
  const n8nSig = createHmac('sha256', key).update(ts + '.' + body).digest('hex');
  assert.equal(n8nSig, await signBody(key, ts, body));
  assert.ok(await verifyBody(key, ts, body, n8nSig, Number(ts) * 1000));
});

test('n8n mode: Bearer forward_key works for /v1/send; wrong or other shop key is refused', async () => {
  const h = harness();
  const a = await connect(h, 'shop-a', TOKEN_A);
  const b = await connect(h, 'shop-b', TOKEN_B);
  await pairOwner(h, a, 'owner-a');
  await hook(h, a, textEvent('cust-a', 'hi', 'ma1'));
  const fh = h.st.forwards.at(-1).headers;
  assert.equal(fh['x-tien404-inbound-key'], a.inbound_key);
  assert.equal(fh['x-tien404-forward-key'], undefined, 'send key must never travel to n8n (n8n logs headers)');
  assert.notEqual(a.inbound_key, a.forward_key);
  assert.equal((await h.req('POST', '/v1/send', { connection_id: a.connection_id, chat_id: 'cust-a', text: 'x' }, { 'x-tien404-connection': a.connection_id, authorization: 'Bearer ' + a.inbound_key })).status, 401, 'inbound key cannot send');
  const send = (key) => h.req('POST', '/v1/send', { connection_id: a.connection_id, chat_id: 'cust-a', text: 'Dạ shop chào anh/chị' }, { 'x-tien404-connection': a.connection_id, authorization: 'Bearer ' + key });
  assert.equal((await send(a.forward_key)).status, 200);
  assert.equal((await send(b.forward_key)).status, 401);
  assert.equal((await send('x'.repeat(43))).status, 401);
});

test('rotate-keys: new forward + inbound keys, old ones stop at once; legacy rows fall back until rotated', async () => {
  const h = harness();
  const a = await connect(h, 'shop-a', TOKEN_A);
  await pairOwner(h, a, 'owner-a');
  // Simulate a row connected before 0002 (no inbound key): hub still sends the forward_key header.
  h.env.ZH_DB.sqlite.prepare('UPDATE zh_connections SET inbound_key_sealed = NULL').run();
  await hook(h, a, textEvent('cust-a', 'hi', 'mr1'));
  assert.equal(h.st.forwards.at(-1).headers['x-tien404-forward-key'], a.forward_key);

  assert.equal((await h.req('POST', '/v1/admin/rotate-keys', { connection_id: a.connection_id })).status, 401, 'admin only');
  const r = await h.admin('/v1/admin/rotate-keys', { connection_id: a.connection_id });
  assert.equal(r.status, 200);
  assert.ok(r.body.forward_key !== a.forward_key && r.body.inbound_key && r.body.inbound_key !== r.body.forward_key);
  await hook(h, a, textEvent('cust-a', 'hi again', 'mr2'));
  const fh = h.st.forwards.at(-1).headers;
  assert.equal(fh['x-tien404-inbound-key'], r.body.inbound_key);
  assert.equal(fh['x-tien404-forward-key'], undefined);
  const send = (key) => h.req('POST', '/v1/send', { connection_id: a.connection_id, chat_id: 'cust-a', text: 'Dạ' }, { 'x-tien404-connection': a.connection_id, authorization: 'Bearer ' + key });
  assert.equal((await send(a.forward_key)).status, 401, 'old key dead');
  assert.equal((await send(r.body.forward_key)).status, 200);
  const row = JSON.stringify(h.env.ZH_DB.sqlite.prepare('SELECT * FROM zh_connections').get());
  for (const k of [r.body.forward_key, r.body.inbound_key]) assert.ok(!row.includes(k));

  await h.admin('/v1/admin/disconnect', { connection_id: a.connection_id });
  const wiped = h.env.ZH_DB.sqlite.prepare('SELECT inbound_key_sealed FROM zh_connections').get();
  assert.equal(wiped.inbound_key_sealed, null);
  assert.equal((await h.admin('/v1/admin/rotate-keys', { connection_id: a.connection_id })).status, 404);
});

const UID_OWNER = '11111111-1111-4111-8111-111111111111';
const UID_STAFF = '22222222-2222-4222-8222-222222222222';
const STORE_UUID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_UUID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const JWT_OWNER = 'eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiJvd25lciJ9.c2lnb3duZXI';
const JWT_STAFF = 'eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiJzdGFmZiJ9.c2lnc3RhZmY';
const SHARED = { ZH_OWNER_CONNECT_ENABLED: 'true', ZH_SUPABASE_URL: 'https://fakeproj.supabase.co', ZH_SUPABASE_KEY: 'sb_publishable_fake',
  ZH_APP_ORIGINS: 'https://app.example.test', ZH_SHARED_FORWARD_URL: 'https://flow.example.test/webhook/zalo-shared',
  ZH_SHARED_INBOUND_KEY: 'i'.repeat(40), ZH_SHARED_SEND_KEY: 's'.repeat(40) };
function ownerHarness(over = {}) {
  const h = harness({ ...SHARED, ...over });
  h.st.users[JWT_OWNER] = { id: UID_OWNER };
  h.st.users[JWT_STAFF] = { id: UID_STAFF };
  h.st.members.push({ user_id: UID_OWNER, store_id: STORE_UUID, role: 'owner' }, { user_id: UID_STAFF, store_id: STORE_UUID, role: 'staff' });
  h.owner = (method, path, body, jwt = JWT_OWNER) => h.req(method, path, body, { authorization: 'Bearer ' + jwt, origin: 'https://app.example.test' });
  return h;
}

test('owner self-connect: signed-in owner pastes token → shared flow, pairing code, no key ever shown', async () => {
  const h = ownerHarness();
  const r = await h.owner('POST', '/v1/owner/connect', { store_id: STORE_UUID, token_text: `Bot Token: ${TOKEN_A}` });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.flow_mode, 'shared');
  assert.match(r.body.pairing_code, /^\d{6}$/);
  assert.equal(r.body.forward_key, undefined);
  assert.equal(r.body.inbound_key, undefined);
  assert.equal(r.body.manual_webhook, undefined);
  const c = { ...r.body, path: new URL(h.st.webhooks[TOKEN_A].url).pathname, secret: h.st.webhooks[TOKEN_A].secret_token };
  await pairOwner(h, c, 'owner-zalo');
  await hook(h, c, textEvent('cust-1', 'A003 còn không', 'mo1'));
  const f = h.st.forwards.at(-1);
  assert.equal(f.url, SHARED.ZH_SHARED_FORWARD_URL);
  assert.equal(f.headers['x-tien404-inbound-key'], SHARED.ZH_SHARED_INBOUND_KEY);
  assert.equal(JSON.parse(f.body).store_id, STORE_UUID);
  const send = (key) => h.req('POST', '/v1/send', { connection_id: c.connection_id, chat_id: 'cust-1', text: 'Dạ còn ạ' }, { 'x-tien404-connection': c.connection_id, authorization: 'Bearer ' + key });
  assert.equal((await send(SHARED.ZH_SHARED_INBOUND_KEY)).status, 401, 'inbound key cannot send');
  assert.equal((await send(SHARED.ZH_SHARED_SEND_KEY)).status, 200);
  const st = await h.owner('GET', '/v1/owner/status?store_id=' + STORE_UUID);
  assert.equal(st.body.connection.status, 'active');
  assert.equal(st.body.connection.flow_mode, 'shared');
  assert.equal(JSON.stringify(st.body).includes(TOKEN_A), false);
  assert.equal((await h.admin('/v1/admin/rotate-keys', { connection_id: c.connection_id })).body.error, 'SHARED_FLOW_USES_HUB_KEYS');
});

test('owner self-connect is refused for staff, other stores, bad tokens, wrong origin, or when switched off', async () => {
  const h = ownerHarness();
  const body = { store_id: STORE_UUID, token_text: TOKEN_A };
  assert.equal((await h.owner('POST', '/v1/owner/connect', body, JWT_STAFF)).body.error, 'NOT_STORE_MANAGER');
  assert.equal((await h.owner('POST', '/v1/owner/connect', { ...body, store_id: OTHER_UUID })).body.error, 'NOT_STORE_MANAGER');
  assert.equal((await h.owner('POST', '/v1/owner/connect', body, 'not.a.jwt!')).body.error, 'SIGN_IN_AGAIN');
  assert.equal((await h.owner('POST', '/v1/owner/connect', body, 'eyJx.eyJy.unknown')).body.error, 'SIGN_IN_AGAIN');
  assert.equal((await h.req('POST', '/v1/owner/connect', body)).status, 401, 'no token');
  assert.equal(Object.keys(h.st.webhooks).length, 0, 'nothing reached Zalo');
  const pre = await route(new Request('https://hub.example.test/v1/owner/connect', { method: 'OPTIONS', headers: { origin: 'https://evil.example' } }), h.env, { fetch: () => { throw new Error('no'); }, now: () => 0, waitUntil() {}, log() {} });
  assert.equal(pre.status, 403);
  const ok = await h.owner('POST', '/v1/owner/connect', body);
  assert.equal(ok.status, 200);
  assert.equal(ok.headers['access-control-allow-origin'], 'https://app.example.test');
  const off = ownerHarness({ ZH_OWNER_CONNECT_ENABLED: 'false' });
  assert.equal((await off.owner('POST', '/v1/owner/connect', body)).body.error, 'OWNER_CONNECT_DISABLED');
  const noShared = ownerHarness({ ZH_SHARED_SEND_KEY: '' });
  assert.equal((await noShared.owner('POST', '/v1/owner/connect', body)).body.error, 'SHARED_FLOW_NOT_CONFIGURED');
});

test('owner cannot take over a store TIEN404 connected by hand (QA bot), and can disconnect own bot', async () => {
  const h = ownerHarness();
  await connect(h, STORE_UUID, TOKEN_A);
  assert.equal((await h.owner('POST', '/v1/owner/connect', { store_id: STORE_UUID, token_text: TOKEN_B })).body.error, 'STORE_MANAGED_BY_TIEN404');
  assert.equal((await h.owner('POST', '/v1/owner/disconnect', { store_id: STORE_UUID })).body.error, 'STORE_MANAGED_BY_TIEN404');
  const h2 = ownerHarness();
  await h2.owner('POST', '/v1/owner/connect', { store_id: STORE_UUID, token_text: TOKEN_B });
  assert.equal((await h2.owner('POST', '/v1/owner/connect', { store_id: STORE_UUID, token_text: TOKEN_A })).body.error, 'STORE_HAS_LIVE_BOT');
  const p = await h2.owner('POST', '/v1/owner/pairing', { store_id: STORE_UUID });
  assert.match(p.body.pairing_code, /^\d{6}$/);
  const d = await h2.owner('POST', '/v1/owner/disconnect', { store_id: STORE_UUID });
  assert.equal(d.body.status, 'revoked');
  assert.equal(h2.st.webhooks[TOKEN_B], undefined, 'webhook deleted at Zalo');
  assert.equal((await h2.owner('GET', '/v1/owner/status?store_id=' + STORE_UUID)).body.connection, null);
});

test('Lite: Bot TIEN404 AI relays the pasted token → shop keyed by owner Zalo id, shared flow, pairing code', async () => {
  const LITE = 'l'.repeat(40);
  const h = harness({ ...SHARED, ZH_LITE_CONNECT_ENABLED: 'true', ZH_LITE_KEY: LITE });
  const lite = (path, body, key = LITE) => h.req('POST', path, body, { authorization: 'Bearer ' + key });
  assert.equal((await lite('/v1/lite/connect', { zalo_user_id: 'owner-z1', token_text: TOKEN_A }, 'x'.repeat(40))).status, 401);
  assert.equal((await lite('/v1/lite/connect', { zalo_user_id: 'bad id!', token_text: TOKEN_A })).body.error, 'BAD_ZALO_USER');
  const r = await lite('/v1/lite/connect', { zalo_user_id: 'owner-z1', token_text: `Mã bot của bạn: ${TOKEN_A}` });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.match(r.body.store_id, /^zl-[0-9a-f]{24}$/);
  assert.equal(r.body.flow_mode, 'shared');
  assert.match(r.body.pairing_code, /^\d{6}$/);
  assert.equal(r.body.forward_key, undefined);
  // Same Zalo owner → same shop; a second bot is refused until the first is disconnected.
  assert.equal((await lite('/v1/lite/connect', { zalo_user_id: 'owner-z1', token_text: TOKEN_B })).body.error, 'STORE_HAS_LIVE_BOT');
  // Another Zalo owner cannot take this bot.
  assert.equal((await lite('/v1/lite/connect', { zalo_user_id: 'owner-z2', token_text: TOKEN_A })).body.error, 'BOT_OWNED_BY_OTHER_STORE');
  const s1 = await lite('/v1/lite/status', { zalo_user_id: 'owner-z1' });
  assert.equal(s1.body.connection.status, 'pending_owner');
  assert.equal((await lite('/v1/lite/status', { zalo_user_id: 'owner-z2' })).body.connection, null);
  const c = { ...r.body, path: new URL(h.st.webhooks[TOKEN_A].url).pathname, secret: h.st.webhooks[TOKEN_A].secret_token };
  await pairOwner(h, c, 'owner-own-bot');
  assert.equal((await lite('/v1/lite/status', { zalo_user_id: 'owner-z1' })).body.connection.status, 'active');
  assert.equal((await lite('/v1/lite/disconnect', { zalo_user_id: 'owner-z1' })).body.status, 'revoked');
  assert.equal(h.st.webhooks[TOKEN_A], undefined);
  // Reply through Bot TIEN404 AI: only with the system token configured, capped per user per day.
  assert.equal((await lite('/v1/lite/reply', { zalo_user_id: 'owner-z1', text: 'Gần xong rồi ạ' })).body.error, 'SYSTEM_BOT_NOT_CONFIGURED');
  h.env.ZH_SYSTEM_BOT_TOKEN = TOKEN_B; h.env.ZH_LITE_REPLY_DAILY_CAP = '2';
  assert.equal((await lite('/v1/lite/reply', { zalo_user_id: 'owner-z1', text: 'Gần xong rồi ạ' })).status, 200);
  const sent = h.st.zalo.at(-1);
  assert.deepEqual([sent.token, sent.method, sent.body.chat_id], [TOKEN_B, 'sendMessage', 'owner-z1']);
  assert.equal((await lite('/v1/lite/reply', { zalo_user_id: 'owner-z1', text: 'x' })).status, 200);
  assert.equal((await lite('/v1/lite/reply', { zalo_user_id: 'owner-z1', text: 'x' })).body.error, 'LITE_REPLY_CAP');
  assert.equal((await lite('/v1/lite/reply', { zalo_user_id: 'owner-z2', text: 'x' })).status, 200, 'cap is per user');
  const off = harness({ ...SHARED, ZH_LITE_KEY: LITE });
  assert.equal((await off.req('POST', '/v1/lite/status', { zalo_user_id: 'owner-z1' }, { authorization: 'Bearer ' + LITE })).body.error, 'LITE_CONNECT_DISABLED');
});
