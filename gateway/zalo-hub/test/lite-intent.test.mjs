import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyIntent } from '../src/lite-intent.mjs';
import { makeD1 } from './d1-shim.mjs';

const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const NOW = Date.parse('2026-11-26T03:00:00Z');
const A = { id: 'synthetic-connection-a', store_id: 'synthetic-shop-a', owner_chat_id: 'synthetic-owner-a' };
const B = { id: 'synthetic-connection-b', store_id: 'synthetic-shop-b', owner_chat_id: 'synthetic-owner-b' };
const QUESTION = 'Mình muốn biết cửa hàng có thể giúp mình thế nào';

function harness(overrides = {}, answer = { response: { intent: 'CATALOG' } }) {
  const calls = [];
  const env = {
    ZH_DB: makeD1(), ZH_LITE_AI_ENABLED: 'true', ZH_LITE_AI_MODEL: MODEL,
    AI: { async run(...args) { calls.push(args); return answer; } },
    ...overrides,
  };
  return { env, calls };
}

test('intent: useful Vietnamese paths are deterministic with AI disabled and no DB', async () => {
  for (const [text, label] of [
    ['Gặp chăm sóc khách hàng', 'CONTACT'], ['Mình muốn xem sản phẩm', 'CATALOG'],
    ['Có những gì vậy shop?', 'CATALOG'], ['Xin chào!', 'GREETING'], ['hi shop', 'GREETING'],
    ['Đặt hàng giúp tôi', 'OTHER'],
  ]) assert.equal(await classifyIntent({}, text, A, NOW), label);
});

test('intent: AI request contains only the question and fixed classification instructions', async () => {
  const h = harness({ ZH_MASTER_KEY: 'never-forward-credential', privateCatalog: [{ name: 'Secret product', price: 7654321 }] });
  assert.equal(await classifyIntent(h.env, QUESTION, A, NOW), 'CATALOG');
  assert.equal(h.calls.length, 1);
  const [model, input, options] = h.calls[0];
  assert.equal(model, MODEL);
  assert.equal(input.messages.length, 2);
  assert.equal(input.messages[1].content, QUESTION);
  assert.deepEqual(options, { rejectIfBusy: true });
  assert.equal(input.max_tokens, 64);
  assert.equal(input.temperature, 0);
  assert.deepEqual(input.response_format.json_schema.properties.intent.enum, ['CATALOG', 'CONTACT', 'GREETING', 'OTHER']);
  const request = JSON.stringify(h.calls[0]);
  for (const sensitive of [A.id, A.store_id, A.owner_chat_id, h.env.ZH_MASTER_KEY, 'Secret product', '7654321']) assert.ok(!request.includes(sensitive));
});

test('intent: requires explicit feature, supported model, binding, scope and budget', async () => {
  for (const overrides of [
    { ZH_LITE_AI_ENABLED: 'false' }, { ZH_LITE_AI_ENABLED: true },
    { ZH_LITE_AI_MODEL: undefined }, { ZH_LITE_AI_MODEL: '@cf/meta/llama-3.2-3b-instruct' },
    { ZH_LITE_AI_MODEL: 'https://untrusted.example/model' }, { AI: undefined },
    { ZH_LITE_AI_DAILY_CAP: '0' }, { ZH_LITE_AI_GLOBAL_DAILY_CAP: '0' },
  ]) {
    const h = harness(overrides);
    assert.equal(await classifyIntent(h.env, QUESTION, A, NOW), 'OTHER');
    assert.equal(h.calls.length, 0);
  }
  const h = harness();
  assert.equal(await classifyIntent(h.env, QUESTION, {}, NOW), 'OTHER');
  assert.equal(await classifyIntent(h.env, QUESTION, A, NaN), 'OTHER');
  assert.equal(h.calls.length, 0);
});

test('intent: sensitive content never reaches AI or consumes budget', async () => {
  const h = harness();
  for (const text of [
    '0912345678', '+84 (912) 345 678', 'mã là 1234567', '０９１２３４５６７８', '٠٩١٢٣٤٥٦٧٨',
    'email a@example.test', 'https://example.test', 'shop.example.vn/path',
    'token 1111111111:FAKE_token_shop_A_xyz', 'mật khẩu này dùng được không',
    'Địa chỉ 12 Trần Hưng Đạo', 'giao đến số nhà này',
    'Bí mật abcdefghijklmnopqrstuvwxyz12345678', 'x'.repeat(301),
    'Nội dung\u202eẩn', 'một\nđoạn',
  ]) assert.equal(await classifyIntent(h.env, text, A, NOW), 'OTHER', text);
  assert.equal(h.calls.length, 0);
  assert.equal(h.env.ZH_DB.sqlite.prepare('SELECT COUNT(*) AS n FROM zh_lite_ai_usage').get().n, 0);
});

test('intent: strict output validation never returns provider prose or extra data', async () => {
  for (const response of [
    'CATALOG', 'Price is 1 dong; secret data', '{"intent":"CATALOG","price":1}',
    { intent: 'CATALOG', secret: 'must not appear' }, { intent: 'WRITE_ORDER' },
    { intent: ['CATALOG'] }, ['CATALOG'], null, '{"intent":"CATALOG"',
    { label: 'CATALOG' },
  ]) {
    const h = harness({}, { response });
    assert.equal(await classifyIntent(h.env, QUESTION, A, NOW), 'OTHER');
    assert.equal(h.calls.length, 1);
  }
  const h = harness({}, { response: '{"intent":"CONTACT"}' });
  assert.equal(await classifyIntent(h.env, QUESTION, A, NOW), 'CONTACT');
});

test('intent: tenant and global limits hold across concurrent shops and reset by UTC day', async () => {
  const h = harness({ ZH_LITE_AI_DAILY_CAP: '2', ZH_LITE_AI_GLOBAL_DAILY_CAP: '3' });
  const results = await Promise.all(Array.from({ length: 8 }, (_, i) => classifyIntent(h.env, QUESTION, i % 2 ? A : B, NOW)));
  const allowed = results.filter(x => x === 'CATALOG').length;
  assert.ok(allowed <= 3);
  assert.equal(h.calls.length, allowed);
  const usage = h.env.ZH_DB.sqlite.prepare('SELECT scope,n FROM zh_lite_ai_usage').all();
  assert.ok(usage.find(r => r.scope === 'global').n <= 3);
  for (const row of usage.filter(r => r.scope !== 'global')) assert.ok(row.n <= 2);
  assert.equal(await classifyIntent(h.env, QUESTION, A, NOW + 24 * 60 * 60 * 1000), 'CATALOG');
});

test('intent: an exhausted shop does not repeatedly consume another shop global budget', async () => {
  const h = harness({ ZH_LITE_AI_DAILY_CAP: '1', ZH_LITE_AI_GLOBAL_DAILY_CAP: '2' });
  assert.equal(await classifyIntent(h.env, QUESTION, A, NOW), 'CATALOG');
  for (let i = 0; i < 4; i++) assert.equal(await classifyIntent(h.env, QUESTION, A, NOW), 'OTHER');
  assert.equal(await classifyIntent(h.env, QUESTION, B, NOW), 'CATALOG');
  assert.equal(h.calls.length, 2);
});

test('intent: provider failures and deadlines fail closed and still consume a reservation', async () => {
  for (const run of [async () => { throw Error('provider error'); }, () => new Promise(() => {})]) {
    let calls = 0;
    const h = harness({ ZH_LITE_AI_TIMEOUT_MS: '10', ZH_LITE_AI_DAILY_CAP: '1', AI: { run() { calls++; return run(); } } });
    assert.equal(await classifyIntent(h.env, QUESTION, A, NOW), 'OTHER');
    assert.equal(await classifyIntent(h.env, QUESTION, A, NOW), 'OTHER');
    assert.equal(calls, 1);
    assert.equal(h.env.ZH_DB.sqlite.prepare("SELECT n FROM zh_lite_ai_usage WHERE scope='global'").get().n, 1);
  }
});

test('intent: a missing quota table disables inference safely', async () => {
  const h = harness();
  h.env.ZH_DB.sqlite.exec('DROP TABLE zh_lite_ai_usage');
  assert.equal(await classifyIntent(h.env, QUESTION, A, NOW), 'OTHER');
  assert.equal(h.calls.length, 0);
});
