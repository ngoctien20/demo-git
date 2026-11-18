/**
 * TIEN404 V18.5.6 — PRIVATE OWNER QA ONLY.
 *
 * Adds a server-owned installation binding *in front* of the existing V18.5.5
 * read-only Commerce adapter candidate. No new AI Core or Webhook is created.
 *
 * Never deploy this module as a customer/public Widget gateway.
 * Store A/B RLS and public tenant-authority design remain NOT VERIFIED.
 */
import { verifyPrivateAccess } from '../channel-v1854/cloudflare-access-context-gate.mjs';
import originalCanary from '../channel-v1854/worker-v144-access-canary-candidate.mjs';
import { handleReadOnlyRequest } from '../channel-v1855/worker-v1855-readonly-adapter-candidate.mjs';

const HOST = 'tien404-widget-gateway-v144-staging.tienmobi208.workers.dev';
const PRIVATE_PATH = '/__v1856/private-commerce/read';
const ENGINE_PATH = '/v1/widget/commerce/read';
const ALLOWED_INSTALLATIONS = new Set([
  'v1855-materials-sandbox',
  'v1855-grocery-sandbox'
]);
const ALLOWED_FIELDS = new Set(['operation', 'query', 'limit', 'cart']);
const MAX_BYTES = 8192;
const RESPONSE_HEADERS = Object.freeze({
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store, max-age=0',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  'permissions-policy': 'camera=(), microphone=(), geolocation=()'
});

const reply = (status, code) =>
  new Response(JSON.stringify({
    success: false, error: code, readOnly: true,
    canWrite: false, privateOrderAccess: false, productionReady: false
  }), {status, headers: RESPONSE_HEADERS});

async function readBounded(stream) {
  if (!stream) return {ok:false,status:400,code:'BODY_REQUIRED'};
  let total = 0;
  const reader = stream.getReader();
  const chunks = [];
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      total += part.value.byteLength;
      if (total > MAX_BYTES) {
        await reader.cancel();
        return {ok:false,status:413,code:'BODY_TOO_LARGE'};
      }
      chunks.push(part.value);
    }
    const bytes = new Uint8Array(total);
    let i = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, i);
      i += chunk.length;
    }
    const text = new TextDecoder('utf-8', {fatal:true}).decode(bytes);
    return {ok:true,text};
  } catch {
    return {ok:false,status:400,code:'INVALID_BODY_ENCODING'};
  } finally {
    try { reader.releaseLock(); } catch { /* cancelled stream */ }
  }
}

function safeRequestObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  if (keys.length === 0 || keys.some(k => !ALLOWED_FIELDS.has(k))) return false;
  if (!Object.hasOwn(value, 'operation')) return false;
  if (typeof value.operation !== 'string') return false;
  // Do not add installationId even transiently to an object from the client.
  return true;
}

export async function handlePrivateStagingRequest(request, env, ctx, fetchImpl = fetch) {
  const admission = await verifyPrivateAccess(ctx, env);
  if (!admission.ok) return reply(admission.status, admission.code);
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return reply(400, 'BAD_REQUEST_URL');
  }
  if (url.protocol !== 'https:' || url.hostname !== HOST || url.port !== '' ||
      url.username || url.password) {
    return reply(421, 'PRIVATE_GATEWAY_HOST_REQUIRED');
  }
  // Keep the *existing* V14.4 Access Canary, health and all locked /v1/widget/*
  // behavior byte-for-byte routed through its original handler.
  if (url.pathname !== PRIVATE_PATH) {
    return originalCanary.fetch(request, env, ctx);
  }

  if (request.method !== 'POST') return reply(405, 'PRIVATE_POST_ONLY');
  if (url.search || url.hash) return reply(400, 'URL_PARAMETERS_FORBIDDEN');

  const mode = env?.T404_V1856_GATE_MODE;
  const installationId = env?.T404_V1856_QA_INSTALLATION_ID;
  if (mode !== 'PRIVATE_OWNER_QA_ONLY') return reply(423, 'PRIVATE_QA_GATE_DISABLED');
  if (!ALLOWED_INSTALLATIONS.has(installationId)) return reply(423, 'TRUSTED_INSTALLATION_NOT_CONFIGURED');

  const contentType = String(request.headers.get('content-type') || '').trim().toLowerCase();
  if (contentType !== 'application/json' && contentType !== 'application/json; charset=utf-8') {
    return reply(415, 'JSON_REQUIRED');
  }
  const body = await readBounded(request.body);
  if (!body.ok) return reply(body.status, body.code);
  let parsed;
  try {
    parsed = JSON.parse(body.text);
  } catch {
    return reply(400, 'INVALID_JSON_BODY');
  }
  if (!safeRequestObject(parsed)) return reply(400, 'CLIENT_AUTHORITY_OR_UNEXPECTED_FIELD');

  // Construct a clean internal request. The browser cannot supply Store,
  // Tenant, installation, Account, recipient, role, authorization or any
  // upstream credential. Every header from the browser is discarded.
  const payload = Object.create(null);
  payload.installationId = installationId; // exclusively server-owned binding
  for (const key of ALLOWED_FIELDS) {
    if (Object.hasOwn(parsed, key)) payload[key] = parsed[key];
  }
  const syntheticRequest = new Request('https://' + HOST + ENGINE_PATH, {
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify(payload)
  });
  // The inherited V18.5.5 engine independently enforces native Access,
  // the exact n8n Webhook URL, mandatory durable admission and safe readback.
  return handleReadOnlyRequest(syntheticRequest, env, ctx, fetchImpl);
}

export default {
  async fetch(request, env, ctx) {
    return handlePrivateStagingRequest(request, env, ctx);
  }
};
