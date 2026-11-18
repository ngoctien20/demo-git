import { verifyPrivateAccess } from '../channel-v1854/cloudflare-access-context-gate.mjs';

const HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store, max-age=0',
  'pragma': 'no-cache',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  'x-frame-options': 'DENY',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()'
};

const MAX_REQUEST_BYTES = 8192;
const MAX_RESPONSE_BYTES = 32768;
const N8N_HOST = 'ngoctien20.app.n8n.cloud';
const READ_PATH = '/v1/widget/commerce/read';
const INSTALLATIONS = new Set([
  'v1855-materials-sandbox',
  'v1855-grocery-sandbox'
]);
const FORBIDDEN_FIELDS = [
  'accountId', 'channelType', 'tenantId', 'storeId',
  'customerId', 'orderId', 'userId', 'recipientId'
];

function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: HEADERS });
}

async function readBoundedStream(stream, maxBytes) {
  if (!stream) return { ok: false, status: 400, code: 'BODY_REQUIRED' };
  const reader = stream.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      total += part.value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return { ok: false, status: 413, code: 'PAYLOAD_TOO_LARGE' };
      }
      chunks.push(part.value);
    }
  } catch {
    return { ok: false, status: 400, code: 'BODY_READ_FAILED' };
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, text: new TextDecoder().decode(bytes) };
}

function upstreamConfig(env) {
  const rawUrl = String(env?.T404_N8N_READONLY_WEBHOOK_URL ?? '').trim();
  const token = String(env?.T404_N8N_READONLY_ADAPTER_TOKEN ?? '');
  if (!rawUrl || token.length < 32) {
    return { ok: false, missing: true };
  }
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, missing: false };
  }
  if (
    url.protocol !== 'https:' ||
    url.hostname !== N8N_HOST ||
    !url.pathname.startsWith('/webhook/') ||
    url.pathname.includes('/webhook-test/') ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    return { ok: false, missing: false };
  }
  return { ok: true, url: url.toString(), token };
}

function validateClientBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, status: 400, code: 'INVALID_JSON_OBJECT' };
  }
  for (const field of FORBIDDEN_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      return { ok: false, status: 400, code: 'CLIENT_AUTHORITY_FIELD_FORBIDDEN' };
    }
  }
  const allowedKeys = new Set(['installationId', 'operation', 'query', 'limit', 'cart']);
  if (Object.keys(body).some(key => !allowedKeys.has(key))) {
    return { ok: false, status: 400, code: 'UNEXPECTED_REQUEST_FIELD' };
  }

  const installationId = typeof body.installationId === 'string' ? body.installationId.trim() : '';
  if (!INSTALLATIONS.has(installationId)) {
    return { ok: false, status: 404, code: 'UNKNOWN_INSTALLATION' };
  }

  const operation = typeof body.operation === 'string' ? body.operation.trim() : '';
  if (!['catalog.search', 'cart.preview'].includes(operation)) {
    return { ok: false, status: 403, code: 'READ_OPERATION_NOT_ALLOWED' };
  }

  if (operation === 'catalog.search') {
    const query = typeof body.query === 'string' ? body.query.trim() : '';
    const limit = body.limit === undefined ? 5 : Number(body.limit);
    if (!query || query.length > 240 || !Number.isInteger(limit) || limit < 1 || limit > 8) {
      return { ok: false, status: 400, code: 'INVALID_CATALOG_QUERY' };
    }
    return { ok: true, installationId, operation, query, limit };
  }

  if (!Array.isArray(body.cart) || body.cart.length < 1 || body.cart.length > 30) {
    return { ok: false, status: 400, code: 'INVALID_CART_SIZE' };
  }
  const seen = new Set();
  const cart = [];
  for (const line of body.cart) {
    if (!line || typeof line !== 'object' || Array.isArray(line)) {
      return { ok: false, status: 400, code: 'INVALID_CART_LINE' };
    }
    if (Object.keys(line).some(key => !['sku', 'quantity'].includes(key))) {
      return { ok: false, status: 400, code: 'INVALID_CART_LINE_FIELDS' };
    }
    const sku = typeof line.sku === 'string' ? line.sku.trim() : '';
    const quantity = Number(line.quantity);
    if (!sku || sku.length > 64 || !Number.isFinite(quantity) || quantity <= 0 ||
        quantity > 50000 || Math.round(quantity * 1000) !== quantity * 1000) {
      return { ok: false, status: 400, code: 'INVALID_CART_LINE' };
    }
    if (seen.has(sku)) return { ok: false, status: 400, code: 'DUPLICATE_SKU' };
    seen.add(sku);
    cart.push({ sku, quantity });
  }
  return { ok: true, installationId, operation, cart };
}

function safeAttributes(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const allowed = ['size', 'color', 'material', 'weightKg', 'packSize', 'volumeMl', 'minOrder', 'quoteRequired', 'deliveryQuoteRequired', 'demoOnly'];
  const out = {};
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(value, key)) out[key] = value[key];
  }
  return out;
}

function sanitizeUpstreamResult(raw, operation, requestId) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  for (const field of ['tenantId', 'storeId', 'accountId', 'customerId', 'orderId', 'phone', 'email', 'address']) {
    if (Object.prototype.hasOwnProperty.call(raw, field)) return null;
  }
  if (
    raw.operation !== operation ||
    raw.requestId !== requestId ||
    raw.environment !== 'sandbox' ||
    raw.readOnly !== true ||
    raw.canWrite !== false ||
    raw.canConfirm !== false ||
    raw.privateOrderAccess !== false ||
    typeof raw.success !== 'boolean'
  ) return null;

  const shopName = String(raw.shopName ?? '').slice(0, 120);
  if (operation === 'catalog.search') {
    if (!Array.isArray(raw.products) || raw.products.length > 8) return null;
    const products = [];
    for (const product of raw.products) {
      if (!product || typeof product !== 'object') return null;
      const sku = String(product.sku ?? '').trim();
      const name = String(product.name ?? '').trim();
      const priceVnd = Number(product.priceVnd);
      const stock = Number(product.stock);
      if (!sku || !name || !Number.isSafeInteger(priceVnd) || priceVnd < 0 ||
          !Number.isSafeInteger(stock) || stock < 0) return null;
      products.push({
        sku: sku.slice(0, 64),
        name: name.slice(0, 180),
        category: String(product.category ?? '').slice(0, 80),
        unit: String(product.unit ?? '').slice(0, 30),
        priceVnd,
        stock,
        attributes: safeAttributes(product.attributes)
      });
    }
    return {
      success: raw.success,
      operation,
      environment: 'sandbox',
      shopName,
      products,
      count: products.length,
      limited: raw.limited === true,
      note: String(raw.note ?? 'Dữ liệu Sandbox; chưa có giao dịch thật.').slice(0, 240),
      requestId,
      readOnly: true,
      canWrite: false,
      canConfirm: false,
      privateOrderAccess: false
    };
  }

  if (raw.previewOnly !== true || !Array.isArray(raw.lines) || raw.lines.length > 30) return null;
  const lines = [];
  for (const line of raw.lines) {
    if (!line || typeof line !== 'object') return null;
    const sku = String(line.sku ?? '').trim();
    const name = String(line.name ?? '').trim();
    const quantity = Number(line.quantity);
    const unitPriceVnd = Number(line.unitPriceVnd);
    const lineTotalVnd = Number(line.lineTotalVnd);
    const stock = Number(line.stock);
    if (!sku || !name || !Number.isFinite(quantity) || quantity <= 0 ||
        !Number.isSafeInteger(unitPriceVnd) || unitPriceVnd < 0 ||
        !Number.isSafeInteger(lineTotalVnd) || lineTotalVnd < 0 ||
        !Number.isSafeInteger(stock) || stock < 0) return null;
    lines.push({
      sku: sku.slice(0, 64),
      name: name.slice(0, 180),
      unit: String(line.unit ?? '').slice(0, 30),
      quantity,
      unitPriceVnd,
      lineTotalVnd,
      stock,
      needsQuote: line.needsQuote === true
    });
  }
  const subtotal = raw.subtotalVnd === null ? null : Number(raw.subtotalVnd);
  if (subtotal !== null && (!Number.isSafeInteger(subtotal) || subtotal < 0)) return null;
  return {
    success: raw.success,
    operation,
    environment: 'sandbox',
    shopName,
    lines,
    subtotalVnd: subtotal,
    errors: Array.isArray(raw.errors) ? raw.errors.map(value => String(value).slice(0, 120)).slice(0, 30) : [],
    requiresHumanQuote: raw.requiresHumanQuote === true,
    previewOnly: true,
    requestId,
    readOnly: true,
    canConfirm: false,
    canWrite: false,
    privateOrderAccess: false
  };
}

export async function handleReadOnlyRequest(request, env, ctx, fetchImpl = fetch) {
  const admission = await verifyPrivateAccess(ctx, env);
  if (!admission.ok) {
    return json(admission.status, { error: admission.code, productionReady: false });
  }

  const url = new URL(request.url);

  if (request.method === 'GET' && url.pathname === '/__v1854/access-canary') {
    return json(200, {
      service: 'tien404-widget-gateway',
      environment: 'private-staging',
      canary: 'CLOUDFLARE_ACCESS_CONTEXT_VERIFIED',
      principalType: admission.principalType,
      audienceVerified: true,
      operatorAllowlisted: true,
      commerce: 'READONLY_ADAPTER_CANDIDATE',
      privateOrderAccess: false,
      orderWrites: 0,
      providerSends: 0,
      productionReady: false
    });
  }

  if (request.method === 'GET' && url.pathname === '/__v144/health') {
    return json(200, {
      service: 'tien404-widget-gateway',
      environment: 'staging',
      state: 'LOCKED',
      accessRequired: true,
      sessionIssuanceEnabled: false,
      aiCallsEnabled: false,
      orderWritesEnabled: false,
      providerSendsEnabled: false,
      productionReady: false
    });
  }

  if (request.method === 'GET' && url.pathname === '/__v1855/adapter-health') {
    const config = upstreamConfig(env);
    return json(200, {
      service: 'tien404-widget-gateway',
      phase: 'V18.5.5',
      state: config.ok ? 'CONFIGURED_BUT_NOT_PUBLIC' : config.missing ? 'LOCKED_MISSING_UPSTREAM_BINDINGS' : 'LOCKED_INVALID_UPSTREAM_CONFIG',
      allowedOperations: ['catalog.search', 'cart.preview'],
      privateOrderAccess: false,
      orderWrites: 0,
      providerSends: 0,
      productionReady: false
    });
  }

  if (url.pathname !== READ_PATH) {
    if (request.method === 'OPTIONS') return json(405, { error: 'CORS_DISABLED_PRIVATE_ONLY' });
    return json(404, { error: 'NOT_FOUND' });
  }

  if (request.method !== 'POST') return json(405, { error: 'METHOD_NOT_ALLOWED' });
  const contentType = String(request.headers.get('content-type') ?? '').toLowerCase();
  if (!contentType.startsWith('application/json')) return json(415, { error: 'JSON_REQUIRED' });

  const bodyResult = await readBoundedStream(request.body, MAX_REQUEST_BYTES);
  if (!bodyResult.ok) return json(bodyResult.status, { error: bodyResult.code });
  let body;
  try {
    body = JSON.parse(bodyResult.text);
  } catch {
    return json(400, { error: 'INVALID_JSON' });
  }

  const validated = validateClientBody(body);
  if (!validated.ok) return json(validated.status, { error: validated.code });

  const config = upstreamConfig(env);
  if (!config.ok) {
    return json(config.missing ? 423 : 503, {
      error: config.missing ? 'READONLY_ADAPTER_NOT_CONFIGURED' : 'UPSTREAM_CONFIG_INVALID',
      productionReady: false
    });
  }

  const requestId = crypto.randomUUID();
  const issuedAt = Date.now();
  const payload = {
    installationId: validated.installationId,
    operation: validated.operation,
    requestId,
    issuedAt,
    ...(validated.operation === 'catalog.search'
      ? { query: validated.query, limit: validated.limit }
      : { cartJson: JSON.stringify(validated.cart) })
  };

  let upstream;
  try {
    upstream = await fetchImpl(config.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-t404-adapter-token': config.token
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000)
    });
  } catch (error) {
    const timeout = error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    return json(timeout ? 504 : 502, { error: timeout ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_UNAVAILABLE' });
  }

  if (!upstream.ok) return json(502, { error: 'UPSTREAM_REJECTED', productionReady: false });
  const responseBody = await readBoundedStream(upstream.body, MAX_RESPONSE_BYTES);
  if (!responseBody.ok) return json(502, { error: 'UPSTREAM_RESPONSE_TOO_LARGE_OR_UNREADABLE' });

  let raw;
  try {
    raw = JSON.parse(responseBody.text);
  } catch {
    return json(502, { error: 'UPSTREAM_INVALID_JSON' });
  }

  const safe = sanitizeUpstreamResult(raw, validated.operation, requestId);
  if (!safe) return json(502, { error: 'UPSTREAM_RESPONSE_NOT_READONLY_OR_INVALID' });
  return json(200, safe);
}

export default {
  async fetch(request, env, ctx) {
    return handleReadOnlyRequest(request, env, ctx);
  }
};
