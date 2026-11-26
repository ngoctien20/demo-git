// Isolated QA entrypoint only. Production Worker never imports this module.
// Real Workers/D1 execution, synthetic shops, and a closed in-memory provider stub.
// It never calls global fetch or accepts production tokens/keys from its bindings.
import { route } from '../src/worker.mjs';
import { b64, randomBytes, randomId, randomSecret, secureEqual } from '../src/crypto.mjs';
import { classifyIntent } from '../src/lite-intent.mjs';

const VERSION = 'zalo-lite-self-serve-runtime-v1';
const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const HUB = 'https://qa-hub.example.test';
const FLOW = 'https://qa-flow.example.test/shared';
const json = (status, data) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
});

export async function runSelfServeQA(bindings) {
  const now = Date.now(), runId = randomId(8);
  const checks = [], transcript = [];
  const state = { pending: [], sends: [], hooks: new Map(), forwardAttempts: 0, unexpectedOutbound: 0, logs: 0, routesCorrect: true };
  const tokens = { A: '1000000001:FAKE_QA_' + runId + '_A', B: '1000000002:FAKE_QA_' + runId + '_B' };
  const actors = Object.fromEntries(['A', 'B'].map(shop => [shop, {
    registrant: 'qa-registrant-' + shop + '-' + runId,
    owner: { user: 'qa-owner-user-' + shop + '-' + runId, chat: 'qa-owner-chat-' + shop + '-' + runId },
    customer: { user: 'qa-buyer-user-' + shop + '-' + runId, chat: 'qa-buyer-chat-' + shop + '-' + runId },
  }]));
  // Copy only the explicitly supplied database. Every credential below is disposable
  // and synthetic; real outbound bindings or hub secrets are deliberately ignored.
  const env = {
    ZH_DB: bindings.ZH_DB,
    ZH_ADMIN_KEY: randomSecret(32), ZH_MASTER_KEY: b64(randomBytes(32)), ZH_LITE_KEY: randomSecret(32),
    ZH_SHARED_INBOUND_KEY: randomSecret(32), ZH_SHARED_SEND_KEY: randomSecret(32),
    ZH_ENABLED: 'true', ZH_SEND_ENABLED: 'true', ZH_LITE_CONNECT_ENABLED: 'true',
    ZH_LITE_COMMERCE_ENABLED: 'true', ZH_OWNER_CONNECT_ENABLED: 'false', ZH_LITE_AI_ENABLED: 'false',
    ZH_PUBLIC_BASE_URL: HUB, ZH_FORWARD_HOSTS: 'qa-flow.example.test', ZH_SHARED_FORWARD_URL: FLOW,
    ZH_MONTHLY_CAP: '100',
  };
  const check = (name, passed) => { checks.push({ name, status: passed ? 'PASS' : 'FAIL' }); return !!passed; };
  let sequence = 0;
  const fakeFetch = async (url, init) => {
    const address = new URL(String(url));
    if (address.origin === 'https://bot-api.zaloplatforms.com' && init?.method === 'POST') {
      const path = address.pathname.match(/^\/bot([^/]+)\/([A-Za-z]+)$/);
      const shop = path && Object.keys(tokens).find(key => tokens[key] === path[1]);
      if (!shop) { state.unexpectedOutbound++; throw Error('QA_UNEXPECTED_PROVIDER'); }
      const method = path[2], body = JSON.parse(init.body || '{}');
      if (method === 'getMe') return json(200, { ok: true, result: { id: 'qa-bot-' + shop + '-' + runId, account_name: 'bot.SyntheticQA' + shop, account_type: 'BASIC' } });
      if (method === 'setWebhook') {
        state.hooks.set(shop, body);
        return json(200, { ok: true, result: { url: body.url, verification: { ok: true, outcome: 'webhook.ok' } } });
      }
      if (method === 'sendMessage') {
        state.sends.push({ shop, chat: body.chat_id, text: body.text });
        return json(200, { ok: true, result: { message_id: 'qa-reply-' + state.sends.length, date: now } });
      }
      state.unexpectedOutbound++;
      throw Error('QA_UNEXPECTED_PROVIDER_METHOD');
    }
    if (address.href === FLOW) { state.forwardAttempts++; return json(200, { ok: true }); }
    state.unexpectedOutbound++;
    // Never include a URL or body in the error: provider paths may contain tokens.
    throw Error('QA_UNEXPECTED_OUTBOUND');
  };
  const deps = {
    fetch: fakeFetch, now: () => now,
    waitUntil: promise => state.pending.push(promise),
    log: () => { state.logs++; },
    skipMaintenance: true, // Keep every synthetic run as evidence; do not prune rows.
  };
  const request = async (path, body, headers = {}) => {
    const response = await route(new Request(HUB + path, {
      method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body),
    }), env, deps);
    while (state.pending.length) await Promise.all(state.pending.splice(0));
    return { status: response.status, body: await response.json() };
  };
  const lite = (path, shop, data = {}) => request('/v1/lite/' + path, { zalo_user_id: actors[shop].registrant, ...data }, { authorization: 'Bearer ' + env.ZH_LITE_KEY });
  const say = async (shop, actor, text, { publicInput = text, from } = {}) => {
    const who = actors[shop][actor], hook = state.hooks.get(shop), before = state.sends.length;
    const result = await request(new URL(hook.url).pathname, {
      // Official flat event format. Sender and chat deliberately have different IDs.
      event_name: 'message.text.received', message: {
        message_id: 'qa-msg-' + runId + '-' + (++sequence), date: now, message_type: 'CHAT_TEXT',
        from: { id: from || who.user, display_name: 'Tài khoản kiểm thử', is_bot: false },
        chat: { id: who.chat, chat_type: 'PRIVATE' }, text,
      },
    }, { 'x-bot-api-secret-token': hook.secret_token });
    const replies = state.sends.slice(before);
    state.routesCorrect &&= replies.every(reply => reply.shop === shop && reply.chat === who.chat);
    transcript.push({ shop, actor, input: publicInput, replies: replies.map(reply => reply.text) });
    return { ...result, replies: replies.map(reply => reply.text), text: replies.map(reply => reply.text).join('\n') };
  };
  const catalog = async connection => {
    const row = await env.ZH_DB.prepare('SELECT snapshot FROM zh_lite_catalog WHERE connection_id=? AND store_id=?').bind(connection.connection_id, connection.store_id).first();
    return row ? JSON.parse(row.snapshot) : null;
  };
  let aiSmoke = { requested: bindings.ZH_QA_REAL_AI_ENABLED === 'true', binding_present: typeof bindings.AI?.run === 'function', binding_called: false, status: 'NOT_REQUESTED', label: null };
  const finish = () => {
    check('simulated_reply_routes_match_shop_and_chat', state.routesCorrect);
    check('no_n8n_forwarding', state.forwardAttempts === 0);
    check('no_unexpected_provider_requests', state.unexpectedOutbound === 0);
    check('no_internal_runtime_errors', state.logs === 0);
    const passed = checks.filter(item => item.status === 'PASS').length;
    return {
      ok: passed === checks.length, qa_version: VERSION, run_id: runId,
      started_at: new Date(now).toISOString(), completed_at: new Date().toISOString(),
      data_kind: 'SYNTHETIC_ONLY', outbound_mode: 'IN_MEMORY_STUB_ONLY',
      totals: { checks: checks.length, passed, failed: checks.length - passed }, checks,
      observations: { simulated_zalo_sends: state.sends.length, n8n_forward_attempts: state.forwardAttempts, unexpected_provider_attempts: state.unexpectedOutbound },
      ai_smoke: aiSmoke, transcript,
    };
  };
  try {
    if (!check('isolated_database_binding_present', !!env.ZH_DB)) return finish();
    const a = await lite('connect', 'A', { token_text: tokens.A });
    const b = await lite('connect', 'B', { token_text: tokens.B });
    if (!check('two_independent_lite_registrations', a.status === 200 && b.status === 200 && a.body.connection_id !== b.body.connection_id && state.hooks.has('A') && state.hooks.has('B'))) return finish();
    const aStatus = await lite('status', 'A'), bStatus = await lite('status', 'B');
    const ca = { ...a.body, store_id: aStatus.body.store_id }, cb = { ...b.body, store_id: bStatus.body.store_id };
    check('separate_store_scopes', ca.store_id !== cb.store_id && /^zl-[0-9a-f]{24}$/.test(ca.store_id) && /^zl-[0-9a-f]{24}$/.test(cb.store_id));

    await say('A', 'owner', ca.pairing_code, { publicInput: '[Mã ghép nối thử nghiệm]' });
    await say('B', 'owner', cb.pairing_code, { publicInput: '[Mã ghép nối thử nghiệm]' });
    const pairedA = await env.ZH_DB.prepare('SELECT status,owner_chat_id,owner_user_id FROM zh_connections WHERE id=?').bind(ca.connection_id).first();
    const pairedB = await env.ZH_DB.prepare('SELECT status,owner_chat_id,owner_user_id FROM zh_connections WHERE id=?').bind(cb.connection_id).first();
    if (!check('pairing_persists_sender_and_chat_separately', pairedA?.status === 'active' && pairedB?.status === 'active' && pairedA.owner_user_id === actors.A.owner.user && pairedA.owner_chat_id === actors.A.owner.chat && pairedB.owner_user_id === actors.B.owner.user && pairedB.owner_chat_id === actors.B.owner.chat)) return finish();

    // A follows the phone-friendly guided setup. B uses the supported quick commands.
    let guided = '';
    for (const text of ['Bắt đầu', 'Shop QA A', 'Bỏ qua', 'F01', 'Gạo QA A', '12.000', '5']) guided = (await say('A', 'owner', text)).text;
    check('guided_setup_reaches_private_review', guided.includes('Bản xem trước') && guided.includes('12.000'));
    check('draft_is_not_visible_to_customer', (await say('A', 'customer', 'F01 giá bao nhiêu?')).replies.length === 0);
    const preview = await say('A', 'owner', 'Thử F01');
    check('owner_can_preview_own_draft', preview.text.includes('12.000') && preview.text.includes('Gạo QA A'));
    await say('A', 'owner', 'Lưu');
    const savedA = await catalog(ca);
    check('guided_save_keeps_replies_off', savedA?.name === 'Shop QA A' && savedA.products?.[0]?.price === 12000 && savedA.enabled === false && !savedA.setup);
    check('saved_shop_needs_explicit_enable', (await say('A', 'customer', 'F01 giá bao nhiêu?')).replies.length === 0);
    await say('A', 'owner', 'Bật bot');
    await say('B', 'owner', 'Cài shop | Shop QA B | -');
    await say('B', 'owner', 'Sản phẩm | F01 | Gạo QA B | 33000 | 0');
    await say('B', 'owner', 'Bật bot');
    const readyA = await catalog(ca), readyB = await catalog(cb);
    check('owners_enable_only_their_own_catalogs', readyA?.enabled === true && readyB?.enabled === true && readyA.products?.[0]?.price === 12000 && readyB.products?.[0]?.price === 33000);

    const priceA = await say('A', 'customer', 'F01 giá bao nhiêu?');
    const priceB = await say('B', 'customer', 'F01 giá bao nhiêu?');
    check('customer_a_receives_a_price_and_stock', priceA.replies.length === 1 && priceA.text.includes('12.000') && priceA.text.includes('còn 5') && !priceA.text.includes('33.000') && !priceA.text.includes('Gạo QA B'));
    check('customer_b_receives_b_price_and_stock', priceB.replies.length === 1 && priceB.text.includes('33.000') && priceB.text.includes('hết hàng') && !priceB.text.includes('12.000') && !priceB.text.includes('Gạo QA A'));
    check('flat_private_event_with_distinct_sender_and_chat_is_supported', priceA.body.accepted === 'LITE_COMMERCE' && priceB.body.accepted === 'LITE_COMMERCE' && priceA.replies.length === 1 && priceB.replies.length === 1);

    await say('A', 'customer', 'Sản phẩm | F01 | Không được đổi | 1 | 999');
    const afterCustomer = await catalog(ca);
    check('customer_cannot_change_catalog', afterCustomer?.products?.[0]?.name === 'Gạo QA A' && afterCustomer.products[0].price === 12000 && afterCustomer.products[0].stock === 5);
    await say('A', 'owner', 'Tạm dừng', { from: actors.A.customer.user, publicInput: '[Người gửi khác thử lệnh Tạm dừng trong chat chủ shop]' });
    check('owner_chat_without_owner_sender_cannot_pause', (await catalog(ca))?.enabled === true);
    await say('A', 'owner', 'Tạm dừng');
    const paused = await say('A', 'customer', 'F01 giá bao nhiêu?');
    const stillB = await say('B', 'customer', 'F01 giá bao nhiêu?');
    check('pause_silences_only_shop_a', paused.replies.length === 0 && stillB.replies.length === 1 && stillB.text.includes('33.000'));

    if (aiSmoke.requested) {
      let called = false, provider = 'NOT_CALLED';
      const aiEnv = {
        ZH_DB: bindings.ZH_DB, ZH_LITE_AI_ENABLED: 'true', ZH_LITE_AI_MODEL: MODEL,
        ZH_LITE_AI_DAILY_CAP: '2', ZH_LITE_AI_GLOBAL_DAILY_CAP: '10', ZH_LITE_AI_TIMEOUT_MS: '4000',
        AI: aiSmoke.binding_present ? { async run(...args) {
          called = true; provider = 'PENDING';
          try { const result = await bindings.AI.run(...args); provider = 'RETURNED'; return result; }
          catch { provider = 'FAILED'; throw Error('QA_AI_PROVIDER_FAILED'); }
        } } : undefined,
      };
      const label = await classifyIntent(aiEnv, 'Mình muốn khám phá những mặt hàng mà cửa hàng đang kinh doanh', { id: ca.connection_id }, now);
      aiSmoke = { ...aiSmoke, binding_called: called, label,
        status: !called ? 'CONFIG_OR_BUDGET_FALLBACK' : provider !== 'RETURNED' ? 'PROVIDER_OR_TIMEOUT_FALLBACK' : label === 'CATALOG' ? 'CLASSIFIED' : 'OTHER_OR_INVALID_RESPONSE' };
      check('optional_real_ai_binding_was_called', called);
      check('optional_real_ai_classifies_synthetic_catalog_request', called && label === 'CATALOG');
    }
  } catch {
    // Report only a fixed check label, never exception text, SQL, keys or payloads.
    check('runtime_scenario_completed', false);
  }
  return finish();
}

export default {
  async fetch(request, bindings) {
    const path = new URL(request.url).pathname;
    if (request.method === 'GET' && path === '/health') return json(200, { ok: true, qa_version: VERSION, data_kind: 'SYNTHETIC_ONLY', outbound_mode: 'IN_MEMORY_STUB_ONLY' });
    if (path !== '/qa/run') return json(404, { ok: false });
    if (request.method !== 'POST') return json(405, { ok: false });
    const key = bindings.ZH_QA_RUN_KEY, authorization = request.headers.get('authorization') || '';
    if (typeof key !== 'string' || key.length < 32 || !authorization.startsWith('Bearer ') || !await secureEqual(authorization.slice(7), key)) return json(401, { ok: false, error: 'UNAUTHORIZED' });
    const report = await runSelfServeQA(bindings);
    return json(report.ok ? 200 : 500, report);
  },
};
