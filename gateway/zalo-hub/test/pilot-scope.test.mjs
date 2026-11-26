// Public CI verifies scope with synthetic handlers. No live-source fixture is needed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPilot } from '../pilot/router.mjs';

const QA_ID = 'a'.repeat(32), MERCHANT_ID = 'b'.repeat(32), OTHER_ID = 'c'.repeat(32), SHARED_QA_ID = 'd'.repeat(32);
const ADMIN = 'synthetic-admin-key-' + 'a'.repeat(32);

function harness() {
  const rows = new Map([
    [QA_ID, { store_id: 'qa-zalo-bot', flow_mode: 'own' }],
    [MERCHANT_ID, { store_id: 'zl-' + '1'.repeat(24), flow_mode: 'shared' }],
    [OTHER_ID, { store_id: 'qa-another-store', flow_mode: 'own' }],
    [SHARED_QA_ID, { store_id: 'qa-zalo-bot', flow_mode: 'shared' }],
  ]);
  const calls = [], queries = [], logs = [];
  const stub = name => ({
    MAX_BODY: 16 * 1024,
    async route(request, env, deps) {
      calls.push({ handler: name, operation: 'route', request, env, deps, body: await request.text() });
      return new Response(JSON.stringify({ handler: name }));
    },
    default: {
      async fetch(request, env, ctx) {
        calls.push({ handler: name, operation: 'fetch', request, env, ctx, body: await request.text() });
        return new Response(JSON.stringify({ handler: name }));
      },
    },
  });
  const legacy = stub('legacy'), candidate = stub('candidate');
  const pilot = createPilot(legacy, candidate);
  const env = {
    ZH_ADMIN_KEY: ADMIN,
    ZH_ENABLED: 'true',
    ZH_LITE_COMMERCE_ENABLED: 'true',
    ZH_LITE_COMMERCE_QA_STORES: 'qa-another-store,*',
    ZH_DB: {
      prepare(sql) {
        return { bind(value) {
          return { async first() {
            queries.push({ sql, value });
            return rows.get(value) || null;
          } };
        } };
      },
    },
  };
  const deps = { log: value => logs.push(value) };
  const request = (path, body = {}, headers = {}, method = 'POST') =>
    new Request('https://fixture.invalid' + path, {
      method, headers: { 'content-type': 'application/json', ...headers },
      ...(method === 'GET' ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
    });
  const send = async (path, body, headers, method) => {
    const response = await pilot.route(request(path, body, headers, method), env, deps);
    return { status: response.status, body: await response.json() };
  };
  return { pilot, legacy, candidate, env, deps, rows, calls, queries, logs, request, send };
}

test('public pilot dispatches only trusted exact QA-owned webhook rows', async () => {
  const h = harness();
  for (const [id, expected] of [[QA_ID, 'candidate'], [MERCHANT_ID, 'legacy'], [OTHER_ID, 'legacy'], [SHARED_QA_ID, 'legacy']]) {
    const response = await h.send('/v1/zalo/wh/' + id, { store_id: 'qa-zalo-bot', flow_mode: 'own' });
    assert.equal(response.body.handler, expected);
    const call = h.calls.at(-1);
    if (expected === 'legacy') assert.equal(call.env, h.env, 'legacy receives original bindings object');
    else {
      assert.equal(call.env.ZH_LITE_COMMERCE_QA_STORES, 'qa-zalo-bot');
      assert.equal(call.env.ZH_DB, h.env.ZH_DB);
    }
  }
  assert.equal(h.env.ZH_LITE_COMMERCE_QA_STORES, 'qa-another-store,*', 'router never mutates service env');
});

test('send selection uses header connection lookup and leaves original request intact for authentication', async () => {
  const h = harness();
  const body = '{"connection_id":"' + MERCHANT_ID + '","text":"fixture"}';
  assert.equal((await h.send('/v1/send', body, { 'x-tien404-connection': QA_ID, authorization: 'Bearer fixture' })).body.handler, 'candidate');
  const call = h.calls.at(-1);
  assert.equal(call.body, body, 'candidate must receive mismatched body unchanged to reject it itself');
  assert.equal(call.request.headers.get('authorization'), 'Bearer fixture');
  assert.equal((await h.send('/v1/send', { connection_id: QA_ID }, { 'x-tien404-connection': MERCHANT_ID })).body.handler, 'legacy');
  assert.equal((await h.send('/v1/send', { connection_id: QA_ID }, { 'x-tien404-connection': 'bad-id' })).body.handler, 'legacy');
  assert.equal(h.queries.length, 2);
});

test('admin auth is checked before body lookup; authorized QA body is preserved', async () => {
  const h = harness();
  const body = ' { "connection_id" : "' + QA_ID + '" } ';
  assert.equal((await h.send('/v1/admin/pairing', body)).body.handler, 'legacy');
  assert.equal((await h.send('/v1/admin/pairing', body, { authorization: 'Bearer wrong' })).body.handler, 'legacy');
  assert.equal(h.queries.length, 0);
  assert.equal((await h.send('/v1/admin/pairing', body, { authorization: 'Bearer ' + ADMIN })).body.handler, 'candidate');
  assert.equal(h.calls.at(-1).body, body);
  assert.equal(h.queries.length, 1);
});

test('all other routes, including Lite/system and admin connect, delegate unchanged to legacy', async () => {
  const h = harness();
  for (const path of [
    '/v1/lite/connect', '/v1/lite/status', '/v1/lite/reply', '/v1/lite/pairing',
    '/v1/lite/disconnect', '/v1/admin/connect', '/v1/owner/connect',
  ]) {
    assert.equal((await h.send(path, { connection_id: QA_ID, store_id: 'qa-zalo-bot' }, { authorization: 'Bearer ' + ADMIN })).body.handler, 'legacy');
    assert.equal(h.calls.at(-1).env, h.env);
  }
  assert.equal((await h.send('/health', undefined, undefined, 'GET')).body.handler, 'legacy');
  assert.equal((await h.send('/v1/admin/connections?store_id=qa-zalo-bot', undefined, undefined, 'GET')).body.handler, 'legacy');
  assert.equal(h.queries.length, 0);
});

test('commerce off or missing never changes admitted QA scope or enables another store', async () => {
  const h = harness();
  for (const flag of ['false', undefined]) {
    h.env.ZH_LITE_COMMERCE_ENABLED = flag;
    for (const path of ['/v1/zalo/wh/' + QA_ID, '/v1/send']) {
      assert.equal((await h.send(path, { connection_id: QA_ID }, { 'x-tien404-connection': QA_ID })).body.handler, 'candidate');
      assert.equal(h.calls.at(-1).env.ZH_LITE_COMMERCE_ENABLED, flag, 'candidate gets the disabled state to fail closed');
      assert.equal(h.calls.at(-1).env.ZH_LITE_COMMERCE_QA_STORES, 'qa-zalo-bot');
    }
    assert.equal((await h.send('/v1/zalo/wh/' + OTHER_ID, {})).body.handler, 'legacy');
  }
});

test('lookup failure returns a closed 503 and never invokes either handler', async () => {
  const h = harness();
  h.env.ZH_DB = { prepare() { throw Error('synthetic internal detail must not be exposed'); } };
  const response = await h.send('/v1/zalo/wh/' + QA_ID, {});
  assert.equal(response.status, 503);
  assert.deepEqual(response.body, { ok: false, error: 'PILOT_LOOKUP_UNAVAILABLE' });
  assert.deepEqual(h.logs, ['PILOT_LOOKUP_FAILED']);
  assert.equal(h.calls.length, 0);
  assert.equal((await h.send('/health', undefined, undefined, 'GET')).body.handler, 'legacy');
});

test('malformed, oversized and missing admin IDs retain legacy validation without pilot lookup', async () => {
  const h = harness();
  const headers = { authorization: 'Bearer ' + ADMIN };
  for (const body of ['{', '{"connection_id":"bad"}', '{"store_id":"qa-zalo-bot"}', ' '.repeat(16385)]) {
    assert.equal((await h.send('/v1/admin/pairing', body, headers)).body.handler, 'legacy');
    assert.equal(h.calls.at(-1).body, body);
  }
  assert.equal(h.queries.length, 0);
});

test('deployment fetch dispatch passes the original request and context to the selected handler', async () => {
  const h = harness();
  const ctx = { waitUntil() {} };
  const request = h.request('/v1/zalo/wh/' + QA_ID, { fixture: true });
  const response = await h.pilot.fetch(request, h.env, ctx);
  assert.deepEqual(await response.json(), { handler: 'candidate' });
  assert.equal(h.calls[0].operation, 'fetch');
  assert.equal(h.calls[0].request, request);
  assert.equal(h.calls[0].ctx, ctx);
  const health = h.request('/health', undefined, undefined, 'GET');
  await h.pilot.fetch(health, h.env, ctx);
  assert.equal(h.calls[1].handler, 'legacy');
  assert.equal(h.calls[1].env, h.env);
  assert.equal(h.calls[1].ctx, ctx);
});

