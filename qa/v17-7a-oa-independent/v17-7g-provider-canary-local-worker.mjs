// TIEN404 V17.7G — REQUEST-LEVEL OFFLINE provider canary.
// Cloudflare Workers Web Crypto-compatible, no Node APIs or network calls.
// IMPORTANT: this is intentionally NOT deployable as a live provider callback.
// export default.fetch() has no trusted local deps, so ALWAYS returns HTTP 404.
// Accepted 204 results can occur ONLY via direct local fixture test harness
// at https://canary.invalid with QA_ONLY_ secrets and fake installation/replay.
// No Meta/Zalo webhook URL changes, OAuth, real secrets, n8n writes or sends.
const textEncoder = new TextEncoder();
const utf8 = new TextDecoder('utf-8', { fatal: true });
const ref = (s) => typeof s === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{7,95}$/.test(s);
const hex64 = /^[0-9a-f]{64}$/;
const QA_ONLY = /^QA_ONLY_[A-Za-z0-9_-]{12,80}$/;
const MAX_BYTES = 16 * 1024;
const fiveMinutes = 5 * 60 * 1000;

const rejected = () => new Response(null, {
  status: 404,
  headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
});
const accepted = () => new Response(null, {
  status: 204,
  headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
});
const bytesFromHex = (hex) => {
  if (!hex64.test(hex)) return null;
  return Uint8Array.from(hex.match(/../g), h => Number.parseInt(h, 16));
};
async function constantTimeTextEquals(a, b) {
  const [da, db] = await Promise.all([
    crypto.subtle.digest('SHA-256', textEncoder.encode(a)),
    crypto.subtle.digest('SHA-256', textEncoder.encode(b))
  ]);
  const x = new Uint8Array(da), y = new Uint8Array(db);
  let mismatch = 0;
  for (let i = 0; i < 32; i++) mismatch |= x[i] ^ y[i];
  return mismatch === 0;
}
async function sha256Hex(s) {
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(s));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}
async function verifyMeta(rawBody, header, secret) {
  if (typeof header !== 'string' || !header.startsWith('sha256=')) return false;
  const signature = bytesFromHex(header.slice(7));
  if (!signature) return false;
  const key = await crypto.subtle.importKey(
    'raw', textEncoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
  );
  return crypto.subtle.verify('HMAC', key, signature, rawBody);
}
function saneTimestamp(timestamp, nowMs) {
  return Number.isSafeInteger(timestamp) && timestamp > 0 &&
    Math.abs(nowMs - timestamp) <= fiveMinutes;
}
function noClientAuthority(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  const forbidden = ['tenantId','tenant_id','storeId','store_id','isAdmin',
    'ownerApproved','sku','unit_price','expected_total','price','order_id'];
  return forbidden.every(k => !Object.hasOwn(body, k));
}
function parseMetaTextOnly(body, reg, nowMs) {
  if (!noClientAuthority(body) || body.object !== 'page' ||
    !Array.isArray(body.entry) || body.entry.length !== 1) return null;
  const entry = body.entry[0];
  if (!entry || entry.id !== reg.providerRef ||
    !Array.isArray(entry.messaging) || entry.messaging.length !== 1) return null;
  const message = entry.messaging[0];
  if (!message || message.recipient?.id !== reg.providerRef ||
    !ref(message.sender?.id) ||
    message.sender?.id === reg.providerRef ||
    message.message?.is_echo === true ||
    !ref(message.message?.mid) ||
    typeof message.message?.text !== 'string' ||
    !message.message.text || message.message.text.length > 4096 ||
    !saneTimestamp(message.timestamp ?? entry.time, nowMs)) return null;
  if (!noClientAuthority(message) || !noClientAuthority(message.message)) return null;
  return message.message.mid;
}
function parseZaloBotTextOnly(body, nowMs) {
  // Official BOT webhook envelope is {ok:true,result:{event_name,message}}.
  // V17.7F's *root* event_name fixture was NOT the official structure.
  if (!noClientAuthority(body) || body.ok !== true ||
    !body.result || !noClientAuthority(body.result) ||
    body.result.event_name !== 'message.text.received') return null;
  const msg = body.result.message;
  if (!msg || !noClientAuthority(msg) ||
    !ref(msg.message_id) ||
    !ref(msg.from?.id) || msg.from?.is_bot === true ||
    !ref(msg.chat?.id) ||
    msg.chat.chat_type !== 'PRIVATE' ||
    typeof msg.text !== 'string' || !msg.text ||
    msg.text.length > 4096 ||
    !saneTimestamp(msg.date, nowMs)) return null;
  return msg.message_id;
}

/** Offline injected-only integration; no outgoing calls, send, DB or logs.
 * A real provider rollout requires a separately reviewed Worker and durable
 * Ledger+Registry, verified provider account owner, and deliberate approval.
 */
export async function handleOfflineSignedProviderRequest(request, env, deps) {
  try {
    if (!request || !env || !deps ||
      env.V17_7G_MODE !== 'OFFLINE_FIXTURE_ONLY' ||
      deps.mode !== 'LOCAL_TEST_ONLY' ||
      deps.liveEnabled !== false ||
      typeof deps.reserveOnce !== 'function' ||
      typeof deps.ratePermit !== 'function' ||
      !Number.isSafeInteger(deps.nowMs) ||
      deps.nowMs < 1) return rejected();

    const u = new URL(request.url);
    if (u.protocol !== 'https:' || u.hostname !== 'canary.invalid' ||
      u.search !== '' || request.method !== 'POST') return rejected();
    const channel = u.pathname === '/_qa/v17-7g/meta' ? 'MESSENGER' :
      u.pathname === '/_qa/v17-7g/zalo-bot' ? 'ZALO_BOT' : null;
    if (!channel || request.headers.get('x-tien404-offline-fixture') !== '1' ||
      request.headers.get('content-encoding') ||
      !/^application\/json(?:;charset=utf-8)?$/i.test(
        (request.headers.get('content-type') || '').replace(/\s+/g, '')
      )) return rejected();

    const secret = channel === 'MESSENGER'
      ? env.META_APP_SECRET_QA : env.ZALO_BOT_WEBHOOK_SECRET_QA;
    if (!QA_ONLY.test(secret ?? '') ||
      !deps.registry || deps.registry.source !== 'OFFLINE_SERVER_REGISTRY' ||
      deps.registry.channel !== channel ||
      !ref(deps.registry.installationRef) ||
      !ref(deps.registry.tenantRef) ||
      !ref(deps.registry.storeRef) ||
      !ref(deps.registry.providerRef) ||
      deps.registry.ownerBindingReal !== false ||
      deps.registry.allowCommerce !== false ||
      deps.registry.allowSend !== false ||
      deps.registry.noWrite !== true) return rejected();

    const declared = request.headers.get('content-length');
    if (declared != null && (!/^[0-9]+$/.test(declared) ||
      Number(declared) > MAX_BYTES)) return rejected();
    const rawBody = new Uint8Array(await request.arrayBuffer());
    if (rawBody.byteLength < 2 || rawBody.byteLength > MAX_BYTES) return rejected();

    // Bound rate BEFORE expensive cryptographic verification.
    const capacity = await deps.ratePermit(channel, deps.registry.installationRef);
    if (capacity !== true) return rejected();
    let cryptographicallyValid = false;
    if (channel === 'MESSENGER') {
      cryptographicallyValid = await verifyMeta(rawBody,
        request.headers.get('x-hub-signature-256'), secret);
    } else {
      const header = request.headers.get('x-bot-api-secret-token');
      cryptographicallyValid = typeof header === 'string' && header.length > 0 &&
        !header.includes(',') &&
        await constantTimeTextEquals(header, secret);
    }
    if (!cryptographicallyValid) return rejected();
    let body;
    try { body = JSON.parse(utf8.decode(rawBody)); }
    catch { return rejected(); }
    const eventRef = channel === 'MESSENGER'
      ? parseMetaTextOnly(body, deps.registry, deps.nowMs)
      : parseZaloBotTextOnly(body, deps.nowMs);
    if (!eventRef) return rejected();

    // This is an injected local Set in CI, NOT hosted Durable Object SQLite.
    // Key incorporates installation + channel + eventRef, NEVER customer text.
    const replayKey = await sha256Hex(JSON.stringify([
      'TIEN404_V17_7G_LOCAL', channel, deps.registry.installationRef, eventRef
    ]));
    if (await deps.reserveOnce(replayKey) !== true) return rejected();
    return accepted(); // synthetic fixture only; no reply, DB, AI or provider call
  } catch {
    return rejected();
  }
}

// Deliberate 404: accidental production deploy cannot pass missing local deps.
export default {
  async fetch(request, env) {
    return handleOfflineSignedProviderRequest(request, env, null);
  }
};
