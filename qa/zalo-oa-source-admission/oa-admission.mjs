// TIEN404 AI — V17 Zalo OA source-only admission candidate.
// No HTTP server, provider calls, media fetch, model calls, customer writes or outbound sends.
// Protocol formula based on public Zalo OA webhook documentation and source review;
// NOT certified against real Zalo events. Real provider canary is a separate gate.
import { createHash, timingSafeEqual } from 'node:crypto';

const EVENTS = new Set(['user_send_text', 'user_send_image', 'user_send_link']);
const MAX_BODY = 128 * 1024;
const WINDOW_MS = 5 * 60 * 1000;
const REPLAY_TTL_MS = 24 * 60 * 60 * 1000;

function nonempty(value, max = 200) {
  return typeof value === 'string' && value.length > 0 && value.length <= max;
}
function reject(reason) {
  return { accepted: false, reason, noSend: true, noOrderWrite: true };
}
function hexFromHeader(header) {
  if (typeof header !== 'string') return null;
  const match = /^mac\s*=\s*([a-f0-9]{64})$/i.exec(header.trim());
  return match ? Buffer.from(match[1], 'hex') : null;
}

/** Signed bytes MUST be the exact request body bytes, never JSON.stringify(parsedBody). */
export function verifyOaMac({ appId, secret, timestamp, rawBody, signature }) {
  if (!nonempty(appId) || !nonempty(secret, 10000) ||
      !Buffer.isBuffer(rawBody) || !Number.isSafeInteger(timestamp)) return false;
  const received = hexFromHeader(signature);
  if (!received || received.length !== 32) return false;
  // Zalo OA documented formula: SHA256(appId + data + timestamp + OAsecretKey).
  // Provider conformance still requires a real signed no-send fixture.
  const expected = createHash('sha256')
    .update(appId, 'utf8').update(rawBody)
    .update(String(timestamp), 'utf8').update(secret, 'utf8').digest();
  return timingSafeEqual(expected, received);
}

/**
 * Strict offline OA event admission. Dependencies are trusted *server-side* services:
 * resolveInstallation({appId, oaId}) -> trusted {id,appId,oaId,tenantId,storeId,status,secret,provider}
 * replay.reserve(key, ttlMs) -> Promise<boolean>, atomic + durable in hosted implementation.
 * Never accept tenant/store/secret from event payload.
 */
export async function admitOaEvent(request, deps) {
  if (!deps || typeof deps.resolveInstallation !== 'function' ||
      !deps.replay || typeof deps.replay.reserve !== 'function') return reject('MISSING_TRUSTED_DEPENDENCY');
  if (!request || !Buffer.isBuffer(request.rawBody) ||
      request.rawBody.length === 0 || request.rawBody.length > MAX_BODY) return reject('INVALID_RAW_BODY');
  let event;
  try { event = JSON.parse(request.rawBody.toString('utf8')); }
  catch { return reject('INVALID_JSON'); }
  if (!event || typeof event !== 'object' || Array.isArray(event)) return reject('INVALID_EVENT');
  if (!EVENTS.has(event.event_name)) return reject('UNSUPPORTED_EVENT');
  if (!nonempty(event.app_id) || !nonempty(event.recipient?.id) ||
      !nonempty(event.sender?.id) || !nonempty(event.message?.msg_id)) return reject('MISSING_IDENTITY');
  const timestamp = Number(event.timestamp);
  const now = deps.nowMs ?? Date.now();
  if (!Number.isSafeInteger(timestamp) || !Number.isSafeInteger(now) ||
      Math.abs(now - timestamp) > WINDOW_MS) return reject('TIMESTAMP_OUTSIDE_WINDOW');
  let installation;
  try {
    installation = await deps.resolveInstallation({ appId: event.app_id, oaId: event.recipient.id });
  } catch { return reject('INSTALLATION_LOOKUP_FAILED'); }
  if (!installation || installation.status !== 'active' || installation.provider !== 'ZALO_OA' ||
      !nonempty(installation.id) || !nonempty(installation.tenantId) ||
      !nonempty(installation.storeId) || !nonempty(installation.secret, 10000) ||
      installation.appId !== event.app_id || installation.oaId !== event.recipient.id) {
    return reject('UNTRUSTED_INSTALLATION');
  }
  const header = request.headers?.['x-zevent-signature'];
  if (!verifyOaMac({ appId: installation.appId, secret: installation.secret,
    timestamp, rawBody: request.rawBody, signature: header })) return reject('BAD_MAC');

  let kind, text = null;
  if (event.event_name === 'user_send_text') {
    kind = 'text';
    if (!nonempty(event.message.text, 4000)) return reject('INVALID_TEXT');
    text = event.message.text;
  } else if (event.event_name === 'user_send_image') {
    kind = 'image';
    // No URL, file bytes, user-supplied file name or MIME is trusted or fetched here.
  } else {
    kind = 'link';
    // Link is not dereferenced; additional URL safety checks are separate.
  }
  // Key uses trusted installation id, event type and provider message id.
  // Timestamp deliberately omitted to reject replay after timestamp rewriting.
  const replayKey = createHash('sha256').update([
    'zalo-oa', installation.id, event.event_name, event.message.msg_id
  ].join(':')).digest('hex');
  let reserved;
  try { reserved = await deps.replay.reserve(replayKey, REPLAY_TTL_MS); }
  catch { return reject('REPLAY_SERVICE_ERROR'); }
  if (reserved !== true) return reject('DUPLICATE_OR_REPLAY');

  return {
    accepted: true, noSend: true, noOrderWrite: true,
    event: {
      channel: 'ZALO_OA', installationId: installation.id,
      tenantId: installation.tenantId, storeId: installation.storeId,
      oaId: installation.oaId, senderId: event.sender.id,
      providerMessageId: event.message.msg_id, timestamp,
      kind, text, mediaPendingReview: kind === 'image',
      customerVerified: false, orderAuthorized: false
    }
  };
}
