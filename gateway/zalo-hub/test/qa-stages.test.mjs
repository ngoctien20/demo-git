import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../qa/runtime-check.mjs';
import { makeD1 } from './d1-shim.mjs';
import { b64, seal, open } from '../src/crypto.mjs';

const KEY = 'synthetic-runtime-test-key-'.repeat(2);
const url = 'https://qa.example.test/qa/run';

function counted(raw) {
  const count = { queries: 0 };
  const db = { prepare(sql) {
    const statement = raw.prepare(sql);
    return { bind(...args) {
      const bound = statement.bind(...args);
      return Object.fromEntries(Object.entries(bound).map(([method, fn]) => [method, async (...rest) => {
        count.queries++;
        if (count.queries > 30) throw Error('QA_STAGE_D1_BUDGET_EXCEEDED');
        return fn(...rest);
      }]));
    } };
  } };
  return { db, count };
}

const request = (input, key = KEY) => new Request(url, {
  method: 'POST', headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' }, body: JSON.stringify(input),
});

async function stagedRun(t, extra = {}) {
  const raw = makeD1(), perStage = [];
  let input = {}, final, imported = 0;
  while (perStage.length < 40) {
    const { db, count } = counted(raw);
    // A distinct module instance and bindings object on every request: no warm state.
    const fresh = (await import('../qa/runtime-check.mjs?cold=' + String(t.name) + '-' + (++imported))).default;
    const response = await fresh.fetch(request(input), { ZH_QA_RUN_KEY: KEY, ZH_DB: db, ...extra });
    const body = await response.json();
    assert.equal(response.status, 200, 'stage ' + perStage.length + ' HTTP status');
    perStage.push(count.queries);
    assert.ok(count.queries <= 30, 'stage exceeds conservative D1 budget');
    if (body.done) { final = body; break; }
    assert.equal(body.done, false);
    assert.equal(body.progress.step, perStage.length);
    assert.ok(body.progress.step < body.progress.total);
    assert.match(body.state, /^qa2\.[0-9a-f]{16}\.v1\./);
    assert.ok(body.state.length <= 64000);
    assert.doesNotMatch(JSON.stringify(body), /FAKE_QA_|secret_token|pairing_code|token_sealed|ZH_MASTER_KEY/);
    input = { state: body.state };
  }
  assert.ok(final?.done, 'run must finish within bounded stage count');
  assert.equal(Object.hasOwn(final, 'state'), false);
  assert.equal(final.report.ok, true);
  assert.equal(final.report.totals.failed, 0);
  assert.doesNotMatch(JSON.stringify(final.report), /FAKE_QA_|secret_token|pairing_code|token_sealed|ZH_MASTER_KEY/);
  t.diagnostic('D1 calls per stage: ' + perStage.join(', ') + '; maximum=' + Math.max(...perStage) + '; total=' + perStage.reduce((a, b) => a + b, 0));
  return final.report;
}

test('QA stages resume in fresh contexts, preserve all 20 checks and stay below Free D1 limit', async t => {
  const original = globalThis.fetch;
  let realCalls = 0;
  globalThis.fetch = async () => { realCalls++; throw Error('REAL_NETWORK_FORBIDDEN'); };
  try {
    const report = await stagedRun(t, { ZH_SYSTEM_BOT_TOKEN: '9999999999:FAKE_ignored_binding_value', ZH_MASTER_KEY: 'ignored-host-secret' });
    assert.equal(report.totals.checks, 20);
    assert.equal(report.observations.n8n_forward_attempts, 0);
    assert.equal(report.observations.unexpected_provider_attempts, 0);
    assert.equal(report.ai_smoke.status, 'NOT_REQUESTED');
    assert.equal(realCalls, 0);
    assert.doesNotMatch(JSON.stringify(report), /IGNORED_production_style_value|ignored-host-secret/);
  } finally { globalThis.fetch = original; }
});

test('QA optional AI smoke is isolated to its final small stage', async t => {
  let calls = 0;
  const report = await stagedRun(t, {
    ZH_QA_REAL_AI_ENABLED: 'true',
    AI: { async run(model, input) { calls++; assert.equal(model, '@cf/meta/llama-3.3-70b-instruct-fp8-fast'); assert.equal(input.messages.length, 2); return { response: { intent: 'CATALOG' } }; } },
  });
  assert.equal(calls, 1);
  assert.equal(report.totals.checks, 22);
  assert.equal(report.ai_smoke.binding_called, true);
  assert.equal(report.ai_smoke.status, 'CLASSIFIED');
});

test('QA continuation rejects tampering, wrong key, plaintext injection and oversized body before D1', async () => {
  const raw = makeD1();
  const first = await worker.fetch(request({}), { ZH_DB: raw, ZH_QA_RUN_KEY: KEY });
  const { state } = await first.json();
  const { db, count } = counted(raw);
  const bindings = { ZH_DB: db, ZH_QA_RUN_KEY: KEY };
  const pos = state.length - 4;
  const tampered = state.slice(0, pos) + (state[pos] === 'A' ? 'B' : 'A') + state.slice(pos + 1);
  const badRunId = state.replace(/^qa2\.[0-9a-f]{16}/, 'qa2.' + '0'.repeat(16));
  for (const input of [{ state: tampered }, { state: badRunId }, { state: {} }, { state, token_text: '123456789:DO_NOT_ACCEPT_TOKEN' }, { state: '' }]) {
    const response = await worker.fetch(request(input), bindings);
    assert.equal(response.status, 400);
  }
  const otherKey = 'different-synthetic-runtime-key-'.repeat(2);
  assert.equal((await worker.fetch(request({ state }, otherKey), { ...bindings, ZH_QA_RUN_KEY: otherKey })).status, 400);
  assert.equal((await worker.fetch(request({ state }, 'wrong'), bindings)).status, 401);
  assert.equal((await worker.fetch(request({ state: 'x'.repeat(65537) }), bindings)).status, 413);
  assert.equal(count.queries, 0);
});

async function alteredState(token, alter) {
  const [, runId, ...parts] = token.split('.');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('tien404-qa-continuation-v2:' + KEY));
  const env = { ZH_MASTER_KEY: b64(new Uint8Array(digest)) };
  const value = JSON.parse(await open(env, parts.join('.'), runId, 'isolated-zalo-qa', 'continuation-v2'));
  alter(value);
  return 'qa2.' + runId + '.' + await seal(env, JSON.stringify(value), runId, 'isolated-zalo-qa', 'continuation-v2');
}

test('QA authenticated state is bounded by expiry, step range and synthetic webhook host', async () => {
  const raw = makeD1();
  const { state } = await (await worker.fetch(request({}), { ZH_DB: raw, ZH_QA_RUN_KEY: KEY })).json();
  const { db, count } = counted(raw);
  for (const alter of [s => { s.now = Date.now() - 31 * 60 * 1000; }, s => { s.step = 999; }, s => { s.step = -1; }, s => { s.hooks.A.url = 'https://untrusted.example.test/webhook'; }]) {
    const token = await alteredState(state, alter);
    assert.equal((await worker.fetch(request({ state: token }), { ZH_DB: db, ZH_QA_RUN_KEY: KEY })).status, 400);
  }
  assert.equal(count.queries, 0);
});

test('QA replay of an owner mutation uses the same webhook message ID and cannot edit twice', async () => {
  const raw = makeD1(), bindings = { ZH_DB: raw, ZH_QA_RUN_KEY: KEY };
  let input = {}, beforeName;
  for (let i = 0; i < 4; i++) {
    const body = await (await worker.fetch(request(input), bindings)).json();
    assert.equal(body.done, false);
    input = { state: body.state };
    if (i === 3) beforeName = input;
  }
  assert.equal((await worker.fetch(request(beforeName), bindings)).status, 200);
  const firstRevision = raw.sqlite.prepare('SELECT revision FROM zh_lite_catalog').get().revision;
  assert.equal((await worker.fetch(request(beforeName), bindings)).status, 200);
  assert.equal(raw.sqlite.prepare('SELECT revision FROM zh_lite_catalog').get().revision, firstRevision);
});
