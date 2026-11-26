// Isolated QA entrypoint only. Production Worker never imports this module.
// Each HTTP call advances one small step, keeping D1 calls below the Free limit.
// The continuation is authenticated/encrypted and contains synthetic state only.
// No global fetch, real Zalo credentials, new state table, or cleanup deletion.
import { route } from '../src/worker.mjs';
import { b64, randomBytes, randomId, randomSecret, secureEqual, seal, open } from '../src/crypto.mjs';
import { classifyIntent } from '../src/lite-intent.mjs';

const VERSION = 'zalo-lite-self-serve-runtime-v2';
const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const HUB = 'https://qa-hub.example.test';
const FLOW = 'https://qa-flow.example.test/shared';
const MAX_BODY = 64 * 1024, MAX_STATE = 64000, STATE_TTL = 30 * 60 * 1000;
const json = (status, data) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
});
const check = (s, name, passed) => { s.checks.push({ name, status: passed ? 'PASS' : 'FAIL' }); if (!passed) s.failed = true; return !!passed; };
const tokensFor = runId => ({ A: '1000000001:FAKE_QA_' + runId + '_A', B: '1000000002:FAKE_QA_' + runId + '_B' });
const actorsFor = runId => Object.fromEntries(['A', 'B'].map(shop => [shop, {
  registrant: 'qa-registrant-' + shop + '-' + runId,
  owner: { user: 'qa-owner-user-' + shop + '-' + runId, chat: 'qa-owner-chat-' + shop + '-' + runId },
  customer: { user: 'qa-buyer-user-' + shop + '-' + runId, chat: 'qa-buyer-chat-' + shop + '-' + runId },
}]));

function createSession(bindings) {
  return {
    v: 2, runId: randomId(8), now: Date.now(), step: 0, failed: false,
    keys: { admin: randomSecret(32), master: b64(randomBytes(32)), lite: randomSecret(32), inbound: randomSecret(32), send: randomSecret(32) },
    hooks: {}, connections: {}, checks: [], transcript: [],
    sendsCount: 0, forwardAttempts: 0, unexpectedOutbound: 0, logs: 0, routesCorrect: true,
    aiSmoke: { requested: bindings.ZH_QA_REAL_AI_ENABLED === 'true', binding_present: typeof bindings.AI?.run === 'function', binding_called: false, status: 'NOT_REQUESTED', label: null },
  };
}

function harness(bindings, s) {
  const tokens = tokensFor(s.runId), actors = actorsFor(s.runId), pending = [], sends = [];
  // The real database is the only production-style binding copied into this env.
  // All flags, credentials, URLs, actors and token values are controlled by QA.
  const env = {
    ZH_DB: bindings.ZH_DB,
    ZH_ADMIN_KEY: s.keys.admin, ZH_MASTER_KEY: s.keys.master, ZH_LITE_KEY: s.keys.lite,
    ZH_SHARED_INBOUND_KEY: s.keys.inbound, ZH_SHARED_SEND_KEY: s.keys.send,
    ZH_ENABLED: 'true', ZH_SEND_ENABLED: 'true', ZH_LITE_CONNECT_ENABLED: 'true',
    ZH_LITE_COMMERCE_ENABLED: 'true', ZH_OWNER_CONNECT_ENABLED: 'false', ZH_LITE_AI_ENABLED: 'false',
    ZH_PUBLIC_BASE_URL: HUB, ZH_FORWARD_HOSTS: 'qa-flow.example.test', ZH_SHARED_FORWARD_URL: FLOW,
    ZH_MONTHLY_CAP: '100',
  };
  const fakeFetch = async (url, init) => {
    const address = new URL(String(url));
    if (address.origin === 'https://bot-api.zaloplatforms.com' && init?.method === 'POST') {
      const path = address.pathname.match(/^\/bot([^/]+)\/([A-Za-z]+)$/);
      const shop = path && Object.keys(tokens).find(key => tokens[key] === path[1]);
      if (!shop) { s.unexpectedOutbound++; throw Error('QA_UNEXPECTED_PROVIDER'); }
      const method = path[2], body = JSON.parse(init.body || '{}');
      if (method === 'getMe') return json(200, { ok: true, result: { id: 'qa-bot-' + shop + '-' + s.runId, account_name: 'bot.SyntheticQA' + shop, account_type: 'BASIC' } });
      if (method === 'setWebhook') {
        s.hooks[shop] = body;
        return json(200, { ok: true, result: { url: body.url, verification: { ok: true, outcome: 'webhook.ok' } } });
      }
      if (method === 'sendMessage') {
        sends.push({ shop, chat: body.chat_id, text: body.text }); s.sendsCount++;
        return json(200, { ok: true, result: { message_id: 'qa-reply-' + s.sendsCount, date: s.now } });
      }
      s.unexpectedOutbound++;
      throw Error('QA_UNEXPECTED_PROVIDER_METHOD');
    }
    if (address.href === FLOW) { s.forwardAttempts++; return json(200, { ok: true }); }
    s.unexpectedOutbound++;
    throw Error('QA_UNEXPECTED_OUTBOUND'); // Never expose token-bearing URL/body.
  };
  const deps = {
    fetch: fakeFetch, now: () => s.now, waitUntil: promise => pending.push(promise),
    log: () => { s.logs++; }, skipMaintenance: true,
  };
  const request = async (path, body, headers = {}) => {
    const response = await route(new Request(HUB + path, {
      method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body),
    }), env, deps);
    while (pending.length) await Promise.all(pending.splice(0));
    return { status: response.status, body: await response.json() };
  };
  const lite = (path, shop, data = {}) => request('/v1/lite/' + path, { zalo_user_id: actors[shop].registrant, ...data }, { authorization: 'Bearer ' + env.ZH_LITE_KEY });
  const say = async (shop, actor, text, { publicInput = text, from } = {}) => {
    const who = actors[shop][actor], hook = s.hooks[shop], before = sends.length;
    const result = await request(new URL(hook.url).pathname, {
      event_name: 'message.text.received', message: {
        // Stable per-step ID: a replayed continuation cannot apply the same edit twice.
        message_id: 'qa-msg-' + s.runId + '-' + s.step, date: s.now, message_type: 'CHAT_TEXT',
        from: { id: from || who.user, display_name: 'Tài khoản kiểm thử', is_bot: false },
        chat: { id: who.chat, chat_type: 'PRIVATE' }, text,
      },
    }, { 'x-bot-api-secret-token': hook.secret_token });
    const replies = sends.slice(before);
    s.routesCorrect &&= replies.every(reply => reply.shop === shop && reply.chat === who.chat);
    s.transcript.push({ shop, actor, input: publicInput, replies: replies.map(reply => reply.text) });
    return { ...result, replies: replies.map(reply => reply.text), text: replies.map(reply => reply.text).join('\n') };
  };
  const catalog = async connection => {
    const row = await env.ZH_DB.prepare('SELECT snapshot FROM zh_lite_catalog WHERE connection_id=? AND store_id=?').bind(connection.connection_id, connection.store_id).first();
    return row ? JSON.parse(row.snapshot) : null;
  };
  return { s, env, actors, tokens, request, lite, say, catalog, check: (name, passed) => check(s, name, passed) };
}

// One step per HTTP invocation. No step depends on warm-isolate memory.
// Maximum measured D1 use at v2: initial registration 14, one webhook step <=12.
const STEPS = [
  async h => {
    if (!h.check('isolated_database_binding_present', !!h.env.ZH_DB)) return;
    const a = await h.lite('connect', 'A', { token_text: h.tokens.A });
    const b = await h.lite('connect', 'B', { token_text: h.tokens.B });
    if (!h.check('two_independent_lite_registrations', a.status === 200 && b.status === 200 && a.body.connection_id !== b.body.connection_id && !!h.s.hooks.A && !!h.s.hooks.B)) return;
    const as = await h.lite('status', 'A'), bs = await h.lite('status', 'B');
    h.s.connections.A = { connection_id: a.body.connection_id, store_id: as.body.store_id, pairing_code: a.body.pairing_code };
    h.s.connections.B = { connection_id: b.body.connection_id, store_id: bs.body.store_id, pairing_code: b.body.pairing_code };
    h.check('separate_store_scopes', as.body.store_id !== bs.body.store_id && /^zl-[0-9a-f]{24}$/.test(as.body.store_id) && /^zl-[0-9a-f]{24}$/.test(bs.body.store_id));
  },
  h => h.say('A', 'owner', h.s.connections.A.pairing_code, { publicInput: '[Mã ghép nối thử nghiệm]' }),
  async h => {
    await h.say('B', 'owner', h.s.connections.B.pairing_code, { publicInput: '[Mã ghép nối thử nghiệm]' });
    const a = await h.env.ZH_DB.prepare('SELECT status,owner_chat_id,owner_user_id FROM zh_connections WHERE id=?').bind(h.s.connections.A.connection_id).first();
    const b = await h.env.ZH_DB.prepare('SELECT status,owner_chat_id,owner_user_id FROM zh_connections WHERE id=?').bind(h.s.connections.B.connection_id).first();
    h.check('pairing_persists_sender_and_chat_separately', a?.status === 'active' && b?.status === 'active' && a.owner_user_id === h.actors.A.owner.user && a.owner_chat_id === h.actors.A.owner.chat && b.owner_user_id === h.actors.B.owner.user && b.owner_chat_id === h.actors.B.owner.chat);
  },
  ...['Bắt đầu', 'Shop QA A', 'Bỏ qua', 'F01', 'Gạo QA A', '12.000'].map(text => h => h.say('A', 'owner', text)),
  async h => {
    const result = await h.say('A', 'owner', '5');
    h.check('guided_setup_reaches_private_review', result.text.includes('Bản xem trước') && result.text.includes('12.000'));
  },
  async h => h.check('draft_is_not_visible_to_customer', (await h.say('A', 'customer', 'F01 giá bao nhiêu?')).replies.length === 0),
  async h => {
    const result = await h.say('A', 'owner', 'Thử F01');
    h.check('owner_can_preview_own_draft', result.text.includes('12.000') && result.text.includes('Gạo QA A'));
  },
  async h => {
    await h.say('A', 'owner', 'Lưu');
    const saved = await h.catalog(h.s.connections.A);
    h.check('guided_save_keeps_replies_off', saved?.name === 'Shop QA A' && saved.products?.[0]?.price === 12000 && saved.enabled === false && !saved.setup);
  },
  async h => h.check('saved_shop_needs_explicit_enable', (await h.say('A', 'customer', 'F01 giá bao nhiêu?')).replies.length === 0),
  h => h.say('A', 'owner', 'Bật bot'),
  h => h.say('B', 'owner', 'Cài shop | Shop QA B | -'),
  h => h.say('B', 'owner', 'Sản phẩm | F01 | Gạo QA B | 33000 | 0'),
  async h => {
    await h.say('B', 'owner', 'Bật bot');
    const a = await h.catalog(h.s.connections.A), b = await h.catalog(h.s.connections.B);
    h.check('owners_enable_only_their_own_catalogs', a?.enabled === true && b?.enabled === true && a.products?.[0]?.price === 12000 && b.products?.[0]?.price === 33000);
  },
  async h => {
    const a = await h.say('A', 'customer', 'F01 giá bao nhiêu?');
    h.check('customer_a_receives_a_price_and_stock', a.replies.length === 1 && a.text.includes('12.000') && a.text.includes('còn 5') && !a.text.includes('33.000') && !a.text.includes('Gạo QA B'));
    h.s.priceAEventAccepted = a.body.accepted === 'LITE_COMMERCE' && a.replies.length === 1;
  },
  async h => {
    const b = await h.say('B', 'customer', 'F01 giá bao nhiêu?');
    h.check('customer_b_receives_b_price_and_stock', b.replies.length === 1 && b.text.includes('33.000') && b.text.includes('hết hàng') && !b.text.includes('12.000') && !b.text.includes('Gạo QA A'));
    h.check('flat_private_event_with_distinct_sender_and_chat_is_supported', h.s.priceAEventAccepted && b.body.accepted === 'LITE_COMMERCE' && b.replies.length === 1);
  },
  async h => {
    await h.say('A', 'customer', 'Sản phẩm | F01 | Không được đổi | 1 | 999');
    const a = await h.catalog(h.s.connections.A);
    h.check('customer_cannot_change_catalog', a?.products?.[0]?.name === 'Gạo QA A' && a.products[0].price === 12000 && a.products[0].stock === 5);
  },
  async h => {
    await h.say('A', 'owner', 'Tạm dừng', { from: h.actors.A.customer.user, publicInput: '[Người gửi khác thử lệnh Tạm dừng trong chat chủ shop]' });
    h.check('owner_chat_without_owner_sender_cannot_pause', (await h.catalog(h.s.connections.A))?.enabled === true);
  },
  h => h.say('A', 'owner', 'Tạm dừng'),
  async h => { h.s.aPausedSilent = (await h.say('A', 'customer', 'F01 giá bao nhiêu?')).replies.length === 0; },
  async h => {
    const b = await h.say('B', 'customer', 'F01 giá bao nhiêu?');
    h.check('pause_silences_only_shop_a', h.s.aPausedSilent && b.replies.length === 1 && b.text.includes('33.000'));
  },
  async (h, bindings) => {
    if (!h.s.aiSmoke.requested || bindings.ZH_QA_REAL_AI_ENABLED !== 'true') return;
    let called = false, provider = 'NOT_CALLED';
    const present = typeof bindings.AI?.run === 'function';
    const aiEnv = {
      ZH_DB: bindings.ZH_DB, ZH_LITE_AI_ENABLED: 'true', ZH_LITE_AI_MODEL: MODEL,
      ZH_LITE_AI_DAILY_CAP: '2', ZH_LITE_AI_GLOBAL_DAILY_CAP: '10', ZH_LITE_AI_TIMEOUT_MS: '4000',
      AI: present ? { async run(...args) {
        called = true; provider = 'PENDING';
        try { const result = await bindings.AI.run(...args); provider = 'RETURNED'; return result; }
        catch { provider = 'FAILED'; throw Error('QA_AI_PROVIDER_FAILED'); }
      } } : undefined,
    };
    const label = await classifyIntent(aiEnv, 'Mình muốn khám phá những mặt hàng mà cửa hàng đang kinh doanh', { id: h.s.connections.A.connection_id }, h.s.now);
    h.s.aiSmoke = { ...h.s.aiSmoke, binding_present: present, binding_called: called, label,
      status: !called ? 'CONFIG_OR_BUDGET_FALLBACK' : provider !== 'RETURNED' ? 'PROVIDER_OR_TIMEOUT_FALLBACK' : label === 'CATALOG' ? 'CLASSIFIED' : 'OTHER_OR_INVALID_RESPONSE' };
    h.check('optional_real_ai_binding_was_called', called);
    h.check('optional_real_ai_classifies_synthetic_catalog_request', called && label === 'CATALOG');
  },
];

async function advance(bindings, s) {
  try { await STEPS[s.step](harness(bindings, s), bindings); }
  catch { check(s, 'runtime_scenario_completed', false); }
  s.step++;
}

function finish(s) {
  check(s, 'simulated_reply_routes_match_shop_and_chat', s.routesCorrect);
  check(s, 'no_n8n_forwarding', s.forwardAttempts === 0);
  check(s, 'no_unexpected_provider_requests', s.unexpectedOutbound === 0);
  check(s, 'no_internal_runtime_errors', s.logs === 0);
  const passed = s.checks.filter(item => item.status === 'PASS').length;
  return {
    ok: passed === s.checks.length, qa_version: VERSION, run_id: s.runId,
    started_at: new Date(s.now).toISOString(), completed_at: new Date().toISOString(),
    data_kind: 'SYNTHETIC_ONLY', outbound_mode: 'IN_MEMORY_STUB_ONLY',
    totals: { checks: s.checks.length, passed, failed: s.checks.length - passed }, checks: s.checks,
    observations: { simulated_zalo_sends: s.sendsCount, n8n_forward_attempts: s.forwardAttempts, unexpected_provider_attempts: s.unexpectedOutbound },
    ai_smoke: s.aiSmoke, transcript: s.transcript,
  };
}

// Whole-run API is for offline/local use. The hosted handler below always stages it.
export async function runSelfServeQA(bindings) {
  const s = createSession(bindings);
  while (!s.failed && s.step < STEPS.length) await advance(bindings, s);
  return finish(s);
}

async function stateCryptoEnv(key) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('tien404-qa-continuation-v2:' + key));
  return { ZH_MASTER_KEY: b64(new Uint8Array(bytes)) };
}
async function encodeState(key, s) {
  const value = JSON.stringify(s);
  if (new TextEncoder().encode(value).byteLength > 44000) throw Error('QA_STATE_TOO_LARGE');
  const encrypted = await seal(await stateCryptoEnv(key), value, s.runId, 'isolated-zalo-qa', 'continuation-v2');
  const token = 'qa2.' + s.runId + '.' + encrypted;
  if (token.length > MAX_STATE) throw Error('QA_STATE_TOO_LARGE');
  return token;
}
async function decodeState(key, token) {
  if (typeof token !== 'string' || token.length > MAX_STATE) throw Error('INVALID_QA_STATE');
  const match = token.match(/^qa2\.([0-9a-f]{16})\.(v1\.[A-Za-z0-9+/]{16}\.[A-Za-z0-9+/]+=*)$/);
  if (!match) throw Error('INVALID_QA_STATE');
  const s = JSON.parse(await open(await stateCryptoEnv(key), match[2], match[1], 'isolated-zalo-qa', 'continuation-v2'));
  if (!s || s.v !== 2 || s.runId !== match[1] || !Number.isSafeInteger(s.now) || s.now > Date.now() + 60000 || Date.now() - s.now > STATE_TTL
    || !Number.isInteger(s.step) || s.step < 1 || s.step >= STEPS.length || s.failed !== false
    || !Array.isArray(s.checks) || s.checks.length > 30 || !Array.isArray(s.transcript) || s.transcript.length > 30
    || !s.keys || !s.hooks || !s.connections || !s.aiSmoke) throw Error('INVALID_QA_STATE');
  for (const field of ['admin', 'lite', 'inbound', 'send']) if (!/^[A-Za-z0-9_-]{43}$/.test(s.keys[field])) throw Error('INVALID_QA_STATE');
  if (!/^[A-Za-z0-9+/]{43}=$/.test(s.keys.master)) throw Error('INVALID_QA_STATE');
  for (const shop of ['A', 'B']) {
    const hook = s.hooks[shop], c = s.connections[shop];
    if (!hook || typeof hook.url !== 'string' || !new RegExp('^https://qa-hub\\.example\\.test/v1/zalo/wh/[0-9a-f]{32}$').test(hook.url) || !/^[A-Za-z0-9_-]{43}$/.test(hook.secret_token)
      || !c || !/^[0-9a-f]{32}$/.test(c.connection_id) || !/^zl-[0-9a-f]{24}$/.test(c.store_id) || !/^\d{6}$/.test(c.pairing_code)) throw Error('INVALID_QA_STATE');
  }
  return s;
}

export default {
  async fetch(request, bindings) {
    const path = new URL(request.url).pathname;
    if (request.method === 'GET' && path === '/health') return json(200, { ok: true, qa_version: VERSION, protocol: 'staged-v1', total_steps: STEPS.length, data_kind: 'SYNTHETIC_ONLY', outbound_mode: 'IN_MEMORY_STUB_ONLY' });
    if (path !== '/qa/run') return json(404, { ok: false });
    if (request.method !== 'POST') return json(405, { ok: false });
    const key = bindings.ZH_QA_RUN_KEY, authorization = request.headers.get('authorization') || '';
    if (typeof key !== 'string' || key.length < 32 || !authorization.startsWith('Bearer ') || !await secureEqual(authorization.slice(7), key)) return json(401, { ok: false, error: 'UNAUTHORIZED' });
    let input;
    try {
      if (Number(request.headers.get('content-length') || 0) > MAX_BODY) return json(413, { ok: false, error: 'BODY_TOO_LARGE' });
      const raw = await request.text();
      if (new TextEncoder().encode(raw).byteLength > MAX_BODY) return json(413, { ok: false, error: 'BODY_TOO_LARGE' });
      input = raw ? JSON.parse(raw) : {};
      if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(name => name !== 'state') || (Object.hasOwn(input, 'state') && typeof input.state !== 'string')) throw Error('BAD_REQUEST');
    } catch { return json(400, { ok: false, error: 'BAD_QA_REQUEST' }); }
    let session;
    try { session = Object.hasOwn(input, 'state') ? await decodeState(key, input.state) : createSession(bindings); }
    catch { return json(400, { ok: false, error: 'INVALID_QA_STATE' }); }
    await advance(bindings, session);
    if (session.failed || session.step >= STEPS.length) {
      const report = finish(session);
      return json(report.ok ? 200 : 500, { done: true, report });
    }
    try { return json(200, { done: false, state: await encodeState(key, session), progress: { step: session.step, total: STEPS.length } }); }
    catch { return json(500, { ok: false, error: 'QA_STATE_UNAVAILABLE' }); }
  },
};
