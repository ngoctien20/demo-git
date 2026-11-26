// QA-only pilot regression: real SQL, fake provider transports, no network.
import nodeTest from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { isAbsolute } from 'node:path';
import { createPilot } from '../pilot/router.mjs';
import * as candidate from '../src/worker.mjs';

// Private exact-live fixture is deliberately not published in Git. CI runs the
// independent scope contract tests; deployment checks must provide this file.
const legacyPath = process.env.ZH_PILOT_LEGACY_MODULE;
const expectedLegacyHash = '4b367bb483f7bd2cbde17d92180b8b0f3574754a98d5a1b7726263e34c57e012';
let legacy, legacyBytes;
if (legacyPath) {
  assert.ok(isAbsolute(legacyPath), 'private legacy fixture must use an absolute path');
  legacyBytes = readFileSync(legacyPath);
  assert.equal(createHash('sha256').update(legacyBytes).digest('hex'), expectedLegacyHash);
  legacy = await import(pathToFileURL(legacyPath).href);
}
const legacyRoute = legacy?.route;
const pilotRoute = legacy ? createPilot(legacy, candidate).route : undefined;
const test = (name, fn) => nodeTest(name, { skip: !legacy && 'private live fixture not provided; run before deployment' }, fn);
import { seal, sha256Hex, b64 } from '../src/crypto.mjs';
import { makeD1 } from './d1-shim.mjs';

const ADMIN = 'test-admin-' + 'a'.repeat(32);
const LITE_KEY = 'test-lite-' + 'l'.repeat(32);
const SHARED_SEND = 'test-shared-send-' + 's'.repeat(32);
const SHARED_INBOUND = 'test-shared-inbound-' + 'i'.repeat(32);
const FWD_KEY = 'test-own-forward-' + 'f'.repeat(32);
const INBOUND_KEY = 'test-own-inbound-' + 'i'.repeat(32);
const QA_TOKEN = '1111111111:FAKE_pilot_qa_token_xyz';
const LITE_TOKEN = '2222222222:FAKE_pilot_lite_token_xyz';
const OTHER_TOKEN = '3333333333:FAKE_pilot_other_token_xyz';
const SYSTEM_TOKEN = '4444444444:FAKE_pilot_system_token_xyz';
const RELAY_OWNER = 'fixture-relay-owner';
const NOW = Date.parse('2026-11-26T10:00:00Z');

async function harness(handler = pilotRoute, over = {}) {
  const env = {
    ZH_DB: makeD1(), ZH_MASTER_KEY: b64(new Uint8Array(32).fill(7)),
    ZH_ADMIN_KEY: ADMIN, ZH_ENABLED: 'true', ZH_SEND_ENABLED: 'true',
    ZH_PUBLIC_BASE_URL: 'https://hub.example.test', ZH_FORWARD_HOSTS: 'flow.example.test',
    ZH_SHARED_FORWARD_URL: 'https://flow.example.test/webhook/shared',
    ZH_SHARED_SEND_KEY: SHARED_SEND, ZH_SHARED_INBOUND_KEY: SHARED_INBOUND,
    ZH_LITE_CONNECT_ENABLED: 'true', ZH_LITE_KEY: LITE_KEY,
    ZH_SYSTEM_BOT_TOKEN: SYSTEM_TOKEN, ZH_LITE_COMMERCE_ENABLED: 'true',
    ...over,
  };
  const st = { pending: [], zalo: [], forwards: [], logs: [] };
  const fetchImpl = async (url, init = {}) => {
    const value = String(url);
    if (value.startsWith('https://bot-api.zaloplatforms.com/bot')) {
      const match = /\.com\/bot(.+)\/(\w+)$/.exec(value);
      assert.ok(match, 'unexpected fake provider path');
      assert.ok([QA_TOKEN, LITE_TOKEN, OTHER_TOKEN, SYSTEM_TOKEN].includes(match[1]), 'unexpected fake token');
      const body = JSON.parse(init.body);
      st.zalo.push({ token: match[1], method: match[2], body });
      return new Response(JSON.stringify({ ok: true, result: { message_id: 'fixture-send-' + st.zalo.length, date: NOW } }));
    }
    if (value.startsWith('https://flow.example.test/')) {
      st.forwards.push({ url: value, headers: init.headers, body: init.body });
      return new Response('{}');
    }
    throw Error('Unexpected test transport');
  };
  const deps = {
    fetch: fetchImpl, now: () => NOW,
    waitUntil: p => st.pending.push(p),
    log: (...values) => st.logs.push(values.join(' ')),
    skipMaintenance: true,
  };
  const fixtures = [
    { key: 'qa', id: 'a'.repeat(32), path: 'd'.repeat(32), store_id: 'qa-zalo-bot', flow_mode: 'own', token: QA_TOKEN, owner: 'qa-owner' },
    { key: 'lite', id: 'b'.repeat(32), path: 'e'.repeat(32), store_id: 'zl-' + (await sha256Hex('tien404-lite:' + RELAY_OWNER)).slice(0, 24), flow_mode: 'shared', token: LITE_TOKEN, owner: 'lite-owner' },
    { key: 'other', id: 'c'.repeat(32), path: 'f'.repeat(32), store_id: 'qa-another-store', flow_mode: 'own', token: OTHER_TOKEN, owner: 'other-owner' },
  ];
  const connections = {};
  for (const c of fixtures) {
    c.secret = 'test-webhook-secret-' + c.key + '-'.repeat(32);
    const token = await seal(env, c.token, c.id, c.store_id, 'token');
    const forward = await seal(env, FWD_KEY, c.id, c.store_id, 'forward_key');
    const inbound = await seal(env, INBOUND_KEY, c.id, c.store_id, 'inbound_key');
    env.ZH_DB.sqlite.prepare('INSERT INTO zh_connections(id,store_id,status,bot_id,bot_name,token_sealed,path_id,wh_secret_hash,forward_url,forward_key_sealed,inbound_key_sealed,flow_mode,owner_chat_id,connected_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(c.id, c.store_id, 'active', 'fixture-bot-' + c.key, 'bot.Fixture' + c.key, token, c.path, await sha256Hex(c.secret), 'https://flow.example.test/webhook/' + c.key, forward, inbound, c.flow_mode, c.owner, NOW, NOW);
    // A recipient known before migration, with no row in the new zh_seen_chats.
    env.ZH_DB.sqlite.prepare('INSERT INTO zh_seen_users(connection_id,user_id,first_seen_at) VALUES(?,?,?)').run(c.id, 'old-buyer', NOW);
    connections[c.key] = c;
  }
  const req = async (method, path, body, headers = {}) => {
    const response = await handler(new Request('https://hub.example.test' + path, {
      method, headers: { 'content-type': 'application/json', ...headers },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    }), env, deps);
    await Promise.all(st.pending.splice(0));
    return { status: response.status, body: await response.json() };
  };
  const hook = (c, body, secret = c.secret) => req('POST', '/v1/zalo/wh/' + c.path, body, { 'x-bot-api-secret-token': secret });
  const send = (c, text = 'Phản hồi QA cũ', key = c.flow_mode === 'shared' ? SHARED_SEND : FWD_KEY) =>
    req('POST', '/v1/send', { connection_id: c.id, chat_id: 'old-buyer', text }, { 'x-tien404-connection': c.id, authorization: 'Bearer ' + key });
  const admin = (path, body) => req('POST', path, body, { authorization: 'Bearer ' + ADMIN });
  return { env, st, deps, req, hook, send, admin, ...connections };
}

function event(chat, text, id, user = chat) {
  return {
    event_name: 'message.text.received',
    message: { message_id: id, date: NOW, from: { id: user, display_name: 'Người thử QA', is_bot: false }, chat: { id: chat, chat_type: 'PRIVATE' }, text },
  };
}

test('pilot freezes the exact deployed legacy bundle with a verified SHA-256', () => {
  assert.equal(createHash('sha256').update(legacyBytes).digest('hex'), expectedLegacyHash);
});

test('shared merchant forwarding matches legacy exactly despite commerce flags and payload claiming QA', async () => {
  const before = await harness(legacyRoute);
  const after = await harness(pilotRoute, { ZH_LITE_COMMERCE_QA_STORES: 'qa-another-store,*' });
  const body = { ...event('merchant-buyer', 'Xin chào', 'merchant-1'), store_id: 'qa-zalo-bot' };
  assert.deepEqual(await after.hook(after.lite, body), await before.hook(before.lite, body));
  assert.deepEqual(after.st.forwards, before.st.forwards);
  assert.deepEqual(after.st.zalo, before.st.zalo);
  assert.equal(after.env.ZH_DB.sqlite.prepare('SELECT COUNT(*) n FROM zh_seen_chats').get().n, 0);
  assert.equal(after.env.ZH_DB.sqlite.prepare('SELECT COUNT(*) n FROM zh_lite_catalog').get().n, 0);
});

test('merchant send to historical zh_seen_users stays accepted with an empty new chat table', async () => {
  const before = await harness(legacyRoute);
  const after = await harness();
  const old = await before.send(before.lite, 'Câu trả lời merchant');
  const current = await after.send(after.lite, 'Câu trả lời merchant');
  assert.equal(current.status, 200);
  assert.deepEqual(current, old);
  assert.deepEqual(after.st.zalo, before.st.zalo);
  assert.equal(after.env.ZH_DB.sqlite.prepare('SELECT COUNT(*) n FROM zh_seen_chats').get().n, 0);
});

test('merchant webhook with missing sender retains legacy behavior', async () => {
  const before = await harness(legacyRoute);
  const after = await harness();
  const body = event('merchant-chat', 'Nội dung QA', 'sender-missing');
  delete body.message.from;
  assert.deepEqual(await after.hook(after.lite, body), await before.hook(before.lite, body));
  assert.equal(after.st.forwards.length, 1);
  assert.deepEqual(after.st.forwards, before.st.forwards);
});

test('Lite relay status, system reply, and Lite pairing remain on legacy', async () => {
  const before = await harness(legacyRoute);
  const after = await harness();
  const headers = { authorization: 'Bearer ' + LITE_KEY };
  const body = { zalo_user_id: RELAY_OWNER };
  assert.deepEqual(await after.req('POST', '/v1/lite/status', body, headers), await before.req('POST', '/v1/lite/status', body, headers));
  const reply = { ...body, text: 'Hướng dẫn đăng ký QA' };
  assert.deepEqual(await after.req('POST', '/v1/lite/reply', reply, headers), await before.req('POST', '/v1/lite/reply', reply, headers));
  assert.deepEqual(after.st.zalo, before.st.zalo);
  assert.equal(after.st.zalo.at(-1).token, SYSTEM_TOKEN);
  const pairing = await after.req('POST', '/v1/lite/pairing', body, headers);
  assert.equal(pairing.status, 200);
  assert.match(pairing.body.pairing_code, /^\d{6}$/);
  const paired = await after.hook(after.lite, event('legacy-owner-chat', pairing.body.pairing_code, 'lite-repair', 'legacy-owner-user'));
  assert.equal(paired.body.accepted, 'PAIRING');
  const row = after.env.ZH_DB.sqlite.prepare('SELECT owner_chat_id,owner_user_id,owner_epoch FROM zh_connections WHERE id=?').get(after.lite.id);
  assert.equal(row.owner_chat_id, 'legacy-owner-chat');
  assert.equal(row.owner_user_id, null);
  assert.equal(row.owner_epoch, 0);
  assert.match(after.st.zalo.at(-1).body.text, /Đã nối xong/);
  assert.equal(after.env.ZH_DB.sqlite.prepare('SELECT COUNT(*) n FROM zh_seen_chats').get().n, 0);
});

test('exact QA scope uses candidate setup and customer replies without any n8n forward', async () => {
  const h = await harness(pilotRoute, { ZH_LITE_COMMERCE_QA_STORES: '' });
  let n = 0;
  const say = async (text, chat = h.qa.owner, user = chat) => {
    const start = h.st.zalo.length;
    const response = await h.hook(h.qa, event(chat, text, 'qa-msg-' + ++n, user));
    assert.equal(response.body.accepted, 'LITE_COMMERCE');
    return h.st.zalo.slice(start).filter(x => x.method === 'sendMessage').at(-1)?.body.text || null;
  };
  assert.match(await say('Bắt đầu'), /tên cửa hàng/);
  await say('Cửa hàng QA');
  await say('Bỏ qua');
  await say('QA1');
  await say('Sản phẩm QA');
  await say('12000');
  await say('5');
  assert.equal(await say('QA1', 'buyer-chat', 'buyer-user'), null);
  await say('Bật bot');
  assert.match(await say('QA1', 'buyer-chat', 'buyer-user'), /12\.000 đ.*còn 5/);
  assert.equal(h.st.forwards.length, 0);
  assert.ok(h.st.zalo.every(x => x.token === QA_TOKEN));
});

test('old QA /v1/send is blocked after authentication, including commerce off or missing', async () => {
  for (const flag of ['true', 'false', undefined]) {
    const h = await harness(pilotRoute, { ZH_LITE_COMMERCE_ENABLED: flag });
    assert.equal((await h.send(h.qa, 'QA cũ', 'wrong-key')).status, 401);
    const response = await h.send(h.qa);
    assert.equal(response.status, 409);
    assert.equal(response.body.error, 'LITE_REPLY_MANAGED');
    assert.equal(h.st.zalo.length, 0);
  }
});

test('turning commerce off or omitting it pauses QA without resuming legacy or affecting merchant', async () => {
  for (const flag of ['false', undefined]) {
    const h = await harness(pilotRoute, { ZH_LITE_COMMERCE_ENABLED: flag });
    const response = await h.hook(h.qa, event('qa-buyer', 'Xin chào', 'qa-disabled'));
    assert.equal(response.body.ignored, 'LITE_COMMERCE_DISABLED');
    assert.equal(h.st.forwards.length, 0);
    assert.equal(h.st.zalo.length, 0);
    assert.equal((await h.hook(h.lite, event('merchant-buyer', 'Xin chào', 'merchant-enabled'))).body.accepted, 'FORWARDED');
    assert.equal((await h.send(h.lite)).status, 200);
    assert.equal(h.st.forwards.length, 1);
    assert.equal(h.st.zalo.length, 1);
  }
});

test('a broad environment QA allowlist cannot enroll another store into the pilot', async () => {
  const h = await harness(pilotRoute, { ZH_LITE_COMMERCE_QA_STORES: 'qa-zalo-bot,qa-another-store' });
  const response = await h.hook(h.other, event('other-buyer', 'Bắt đầu', 'other-1'));
  assert.equal(response.body.accepted, 'FORWARDED');
  assert.equal(h.st.forwards.length, 1);
  assert.equal(h.st.zalo.length, 0);
  assert.equal((await h.send(h.other)).status, 200);
  assert.equal(h.env.ZH_DB.sqlite.prepare('SELECT COUNT(*) n FROM zh_seen_chats').get().n, 0);
});

test('QA admin pairing is authenticated and records candidate owner identity and epoch', async () => {
  const h = await harness();
  const body = { connection_id: h.qa.id };
  assert.equal((await h.req('POST', '/v1/admin/pairing', body)).status, 401);
  assert.equal(h.env.ZH_DB.sqlite.prepare('SELECT owner_epoch FROM zh_connections WHERE id=?').get(h.qa.id).owner_epoch, 0);
  const pairing = await h.admin('/v1/admin/pairing', body);
  assert.equal(pairing.status, 200);
  assert.equal(h.env.ZH_DB.sqlite.prepare('SELECT owner_epoch FROM zh_connections WHERE id=?').get(h.qa.id).owner_epoch, 1);
  await h.hook(h.qa, event('qa-new-thread', pairing.body.pairing_code, 'qa-new-owner', 'qa-new-person'));
  const row = h.env.ZH_DB.sqlite.prepare('SELECT owner_chat_id,owner_user_id,owner_epoch FROM zh_connections WHERE id=?').get(h.qa.id);
  assert.equal(row.owner_chat_id, 'qa-new-thread');
  assert.equal(row.owner_user_id, 'qa-new-person');
  assert.equal(row.owner_epoch, 1);
  assert.match(h.st.zalo.at(-1).body.text, /Bắt đầu/);
  assert.equal(h.st.forwards.length, 0);
});

test('trusted lookup failures stop dispatch rather than falling back to legacy', async () => {
  const h = await harness();
  h.env.ZH_DB = { prepare() { throw Error('synthetic lookup failure'); } };
  const response = await h.hook(h.qa, event('qa-buyer', 'hello', 'db-down'));
  assert.equal(response.status, 503);
  assert.equal(response.body.error, 'PILOT_LOOKUP_UNAVAILABLE');
  assert.equal(h.st.zalo.length, 0);
  assert.equal(h.st.forwards.length, 0);
  assert.deepEqual(h.st.logs, ['PILOT_LOOKUP_FAILED']);
  assert.deepEqual(await h.req('GET', '/health'), { status: 200, body: { ok: true, enabled: true } });
});

test('malformed admin input keeps legacy rejection and cannot select a pilot connection', async () => {
  const h = await harness();
  assert.equal((await h.admin('/v1/admin/pairing', '{')).body.error, 'BAD_JSON');
  assert.equal((await h.admin('/v1/admin/pairing', { connection_id: 'bad', store_id: 'qa-zalo-bot' })).body.error, 'BAD_CONNECTION_ID');
  assert.equal(h.env.ZH_DB.sqlite.prepare('SELECT owner_epoch FROM zh_connections WHERE id=?').get(h.qa.id).owner_epoch, 0);
  assert.equal(h.st.zalo.length, 0);
});

