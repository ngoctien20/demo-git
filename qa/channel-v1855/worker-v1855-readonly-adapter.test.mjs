import test from 'node:test';
import assert from 'node:assert/strict';
import { handleReadOnlyRequest } from './worker-v1855-readonly-adapter-candidate.mjs';

const AUD = 'a'.repeat(64);
const ownerContext = {
  access: {
    aud: AUD,
    getIdentity: async () => ({ email: 'qa-owner@example.test' })
  }
};
const baseEnv = {
  T404_ACCESS_AUD: AUD,
  T404_QA_OPERATOR_EMAIL: 'qa-owner@example.test'
};
const upstreamEnv = {
  ...baseEnv,
  T404_N8N_READONLY_WEBHOOK_URL: 'https://ngoctien20.app.n8n.cloud/webhook/v1855-readonly-test',
  T404_N8N_READONLY_ADAPTER_TOKEN: 't'.repeat(48)
};
const path = '/v1/widget/commerce/read';

function post(body, target = path) {
  return new Request('https://widget.test' + target, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
}

function catalogResult(requestId) {
  return {
    success: true,
    operation: 'catalog.search',
    environment: 'sandbox',
    shopName: 'Materials Sandbox',
    products: [{ sku: 'VL-101', name: 'Xi măng mẫu', category: 'Xi măng', unit: 'bao', priceVnd: 79000, stock: 120, attributes: { weightKg: 50, demoOnly: true } }],
    count: 1,
    limited: false,
    note: 'Sandbox only',
    requestId,
    readOnly: true,
    canWrite: false,
    canConfirm: false,
    privateOrderAccess: false
  };
}

test('denies requests without native Cloudflare Access context', async () => {
  const response = await handleReadOnlyRequest(new Request('https://widget.test/__v1854/access-canary'), baseEnv, {});
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, 'ACCESS_CONTEXT_REQUIRED');
});

test('preserves the real Access canary while Commerce remains private', async () => {
  const response = await handleReadOnlyRequest(new Request('https://widget.test/__v1854/access-canary'), baseEnv, ownerContext);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.canary, 'CLOUDFLARE_ACCESS_CONTEXT_VERIFIED');
  assert.equal(body.privateOrderAccess, false);
  assert.equal(body.orderWrites, 0);
  assert.equal(body.providerSends, 0);
  assert.equal(body.productionReady, false);
});

test('reports adapter locked when upstream bindings are absent', async () => {
  const response = await handleReadOnlyRequest(new Request('https://widget.test/__v1855/adapter-health'), baseEnv, ownerContext);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.state, 'LOCKED_MISSING_UPSTREAM_BINDINGS');
  assert.deepEqual(body.allowedOperations, ['catalog.search', 'cart.preview']);
  assert.equal(body.productionReady, false);
});

test('does not process Commerce reads while the n8n adapter credential is absent', async () => {
  const response = await handleReadOnlyRequest(post({ installationId: 'v1855-materials-sandbox', operation: 'catalog.search', query: 'xi măng' }), baseEnv, ownerContext);
  assert.equal(response.status, 423);
  assert.equal((await response.json()).error, 'READONLY_ADAPTER_NOT_CONFIGURED');
});

test('rejects browser-supplied tenant, store and account authority', async () => {
  for (const field of ['tenantId', 'storeId', 'accountId', 'channelType', 'customerId', 'orderId']) {
    const body = { installationId: 'v1855-materials-sandbox', operation: 'catalog.search', query: 'VL-101', [field]: 'forged-value' };
    const response = await handleReadOnlyRequest(post(body), upstreamEnv, ownerContext, async () => {
      throw new Error('upstream_must_not_be_called');
    });
    assert.equal(response.status, 400, field);
    assert.equal((await response.json()).error, 'CLIENT_AUTHORITY_FIELD_FORBIDDEN', field);
  }
});

test('rejects an unregistered widget installation', async () => {
  const response = await handleReadOnlyRequest(post({ installationId: 'unknown-install', operation: 'catalog.search', query: '*' }), upstreamEnv, ownerContext);
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error, 'UNKNOWN_INSTALLATION');
});

test('rejects private order reads and order creation', async () => {
  for (const operation of ['order.read', 'order.create', 'order.status', 'payment.capture']) {
    const response = await handleReadOnlyRequest(post({ installationId: 'v1855-materials-sandbox', operation }), upstreamEnv, ownerContext);
    assert.equal(response.status, 403, operation);
    assert.equal((await response.json()).error, 'READ_OPERATION_NOT_ALLOWED', operation);
  }
});

test('rejects oversized catalog queries and invalid limits', async () => {
  const longQuery = await handleReadOnlyRequest(post({ installationId: 'v1855-materials-sandbox', operation: 'catalog.search', query: 'x'.repeat(241) }), upstreamEnv, ownerContext);
  assert.equal(longQuery.status, 400);
  assert.equal((await longQuery.json()).error, 'INVALID_CATALOG_QUERY');
  const largeLimit = await handleReadOnlyRequest(post({ installationId: 'v1855-materials-sandbox', operation: 'catalog.search', query: '*', limit: 9 }), upstreamEnv, ownerContext);
  assert.equal(largeLimit.status, 400);
});

test('rejects duplicate cart SKU and unexpected cart fields', async () => {
  const duplicate = await handleReadOnlyRequest(post({ installationId: 'v1855-materials-sandbox', operation: 'cart.preview', cart: [{ sku: 'VL-101', quantity: 1 }, { sku: 'VL-101', quantity: 2 }] }), upstreamEnv, ownerContext);
  assert.equal(duplicate.status, 400);
  assert.equal((await duplicate.json()).error, 'DUPLICATE_SKU');
  const forgedLine = await handleReadOnlyRequest(post({ installationId: 'v1855-materials-sandbox', operation: 'cart.preview', cart: [{ sku: 'VL-101', quantity: 1, unitPriceVnd: 1 }] }), upstreamEnv, ownerContext);
  assert.equal(forgedLine.status, 400);
  assert.equal((await forgedLine.json()).error, 'INVALID_CART_LINE_FIELDS');
});

test('rejects non-HTTPS, non-n8n and webhook-test upstream URLs', async () => {
  for (const invalidUrl of [
    'http://ngoctien20.app.n8n.cloud/webhook/x',
    'https://evil.example/webhook/x',
    'https://ngoctien20.app.n8n.cloud/webhook-test/x',
    'https://ngoctien20.app.n8n.cloud/webhook/x?debug=1'
  ]) {
    const env = { ...upstreamEnv, T404_N8N_READONLY_WEBHOOK_URL: invalidUrl };
    const response = await handleReadOnlyRequest(post({ installationId: 'v1855-materials-sandbox', operation: 'catalog.search', query: 'VL-101' }), env, ownerContext);
    assert.equal(response.status, 503, invalidUrl);
    assert.equal((await response.json()).error, 'UPSTREAM_CONFIG_INVALID', invalidUrl);
  }
});

test('forwards only the server-generated read-only envelope and sanitizes catalog response', async () => {
  let captured;
  const fetchImpl = async (url, init) => {
    captured = { url, headers: init.headers, payload: JSON.parse(init.body) };
    return new Response(JSON.stringify(catalogResult(captured.payload.requestId)), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const response = await handleReadOnlyRequest(post({ installationId: 'v1855-materials-sandbox', operation: 'catalog.search', query: 'VL-101', limit: 5 }), upstreamEnv, ownerContext, fetchImpl);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(captured.url, upstreamEnv.T404_N8N_READONLY_WEBHOOK_URL);
  assert.equal(captured.headers['x-t404-adapter-token'], upstreamEnv.T404_N8N_READONLY_ADAPTER_TOKEN);
  assert.equal(captured.payload.installationId, 'v1855-materials-sandbox');
  assert.equal(captured.payload.operation, 'catalog.search');
  assert.equal(captured.payload.query, 'VL-101');
  assert.equal(typeof captured.payload.requestId, 'string');
  assert.equal(Number.isSafeInteger(captured.payload.issuedAt), true);
  assert.equal(Object.hasOwn(captured.payload, 'accountId'), false);
  assert.equal(Object.hasOwn(captured.payload, 'tenantId'), false);
  assert.equal(body.products[0].sku, 'VL-101');
  assert.equal(body.canWrite, false);
  assert.equal(body.canConfirm, false);
  assert.equal(body.privateOrderAccess, false);
});

test('forwards cart preview as SKU and quantity only and never confirms it', async () => {
  let captured;
  const fetchImpl = async (_url, init) => {
    captured = JSON.parse(init.body);
    return new Response(JSON.stringify({
      success: true,
      operation: 'cart.preview',
      environment: 'sandbox',
      shopName: 'Materials Sandbox',
      lines: [{ sku: 'VL-101', name: 'Xi măng mẫu', unit: 'bao', quantity: 3, unitPriceVnd: 79000, lineTotalVnd: 237000, stock: 120, needsQuote: true }],
      subtotalVnd: 237000,
      errors: [],
      requiresHumanQuote: true,
      previewOnly: true,
      requestId: captured.requestId,
      readOnly: true,
      canConfirm: false,
      canWrite: false,
      privateOrderAccess: false
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const response = await handleReadOnlyRequest(post({ installationId: 'v1855-materials-sandbox', operation: 'cart.preview', cart: [{ sku: 'VL-101', quantity: 3 }] }), upstreamEnv, ownerContext, fetchImpl);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(JSON.parse(captured.cartJson)[0].quantity, 3);
  assert.equal(Object.hasOwn(captured, 'tenantId'), false);
  assert.equal(body.subtotalVnd, 237000);
  assert.equal(body.previewOnly, true);
  assert.equal(body.canConfirm, false);
  assert.equal(body.canWrite, false);
});

test('fails closed when upstream omits read-only safety flags', async () => {
  const fetchImpl = async () => new Response(JSON.stringify({
    success: true, operation: 'catalog.search', environment: 'sandbox',
    products: [], requestId: 'not-the-generated-id', readOnly: true
  }), { status: 200 });
  const response = await handleReadOnlyRequest(post({ installationId: 'v1855-materials-sandbox', operation: 'catalog.search', query: '*' }), upstreamEnv, ownerContext, fetchImpl);
  assert.equal(response.status, 502);
  assert.equal((await response.json()).error, 'UPSTREAM_RESPONSE_NOT_READONLY_OR_INVALID');
});

test('fails closed if upstream attempts to return tenant or customer data', async () => {
  const fetchImpl = async (_url, init) => {
    const payload = JSON.parse(init.body);
    return new Response(JSON.stringify({ ...catalogResult(payload.requestId), tenantId: 'leaked-tenant' }), { status: 200 });
  };
  const response = await handleReadOnlyRequest(post({ installationId: 'v1855-materials-sandbox', operation: 'catalog.search', query: '*' }), upstreamEnv, ownerContext, fetchImpl);
  assert.equal(response.status, 502);
  assert.equal((await response.json()).error, 'UPSTREAM_RESPONSE_NOT_READONLY_OR_INVALID');
});

test('rejects CORS preflight instead of bypassing Access', async () => {
  const response = await handleReadOnlyRequest(new Request('https://widget.test/v1/widget/commerce/read', { method: 'OPTIONS' }), baseEnv, ownerContext);
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('access-control-allow-origin'), null);
});
