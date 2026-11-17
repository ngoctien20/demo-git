// TIEN404 V17.ZALO-SOURCE-04: source-only provider compatibility and private OA UAT gate.
// OFFLINE ONLY. No HTTP server, OAuth exchange, token vault, provider send, DB mutation, or deployment.
import {createHash} from 'node:crypto';

const OA_ID = /^[0-9]{5,25}$/;
const APP_ID = /^[0-9]{5,25}$/;
const STATE = /^[A-Za-z0-9_-]{43}$/;
const CODE_CHALLENGE = /^[A-Za-z0-9_-]{43}$/;
const PKCE_VERIFIER = /^[A-Za-z0-9._~-]{43}$/;
const CODE_MAX = 2048;
const MAX_WEBHOOK_BYTES = 128 * 1024;
const ALLOWED_OA_EVENTS = new Set(['user_send_text', 'user_send_image', 'user_send_link']);
const no = reason => Object.freeze({ok:false,reason,providerVerified:false,storeAuthorized:false,canActivate:false,canSend:false,canWriteOrders:false});
const ok = tag => Object.freeze({ok:true,stage:tag,providerVerified:false,storeAuthorized:false,canActivate:false,canSend:false,canWriteOrders:false});

/** Zalo OA documentation prescribes 43 characters including uppercase/lowercase/digits.
 * Zalo's actual verifier/challenge acceptance must still be confirmed in a private OA canary.
 * Only SHA256/PKCE S256, never plain. No verifier is returned in public diagnostics.
 */
export function checkOaPkceCandidate(verifier, challenge) {
  if (typeof verifier !== 'string' || !PKCE_VERIFIER.test(verifier) ||
      !/[A-Z]/.test(verifier) || !/[a-z]/.test(verifier) || !/[0-9]/.test(verifier))
    return no('ZALO_OA_43_CHAR_VERIFIER_REQUIRED');
  const expected = createHash('sha256').update(verifier, 'ascii').digest('base64url');
  if (typeof challenge !== 'string' || !CODE_CHALLENGE.test(challenge) || challenge !== expected)
    return no('PKCE_S256_CHALLENGE_MISMATCH');
  return ok('OFFLINE_PKCE_SHAPE_COMPATIBLE_NOT_PROVIDER_VERIFIED');
}

/** Inspects callback shape without ever returning code, state, oa_id or full URL.
 * Separate same-session atomic state consumption, OA grant and Store auth are required.
 * OA docs illustrate code+oa_id but do not prove state echo for the approved OA app.
 */
export function inspectOaCallbackShape({callbackUrl, pinnedRedirectUri} = {}) {
  if (typeof callbackUrl !== 'string' || callbackUrl.length > 4096 ||
      typeof pinnedRedirectUri !== 'string' || pinnedRedirectUri.length > 2048)
    return no('INVALID_CALLBACK_INPUT');
  let callback, redirect;
  try { callback = new URL(callbackUrl); redirect = new URL(pinnedRedirectUri); }
  catch { return no('INVALID_CALLBACK_URL'); }
  if (redirect.protocol !== 'https:' || redirect.search || redirect.hash || redirect.username || redirect.password ||
      !redirect.hostname || redirect.port ||
      callback.protocol !== 'https:' || callback.username || callback.password || callback.hash ||
      callback.origin !== redirect.origin || callback.pathname !== redirect.pathname)
    return no('REDIRECT_NOT_EXACTLY_PINNED');
  if (callback.searchParams.has('error')) return no('OAUTH_PROVIDER_ERROR');
  const keys = [...callback.searchParams.keys()];
  if (keys.some(key => !['code','oa_id','state'].includes(key))) return no('UNKNOWN_CALLBACK_FIELDS_REQUIRES_PROVIDER_REVIEW');
  for (const key of ['code','oa_id','state']) {
    if (callback.searchParams.getAll(key).length > 1) return no('DUPLICATE_OAUTH_CALLBACK_PARAMETER');
  }
  const state = callback.searchParams.get('state');
  if (!state || !STATE.test(state)) return no('OA_STATE_ECHO_NOT_VERIFIED_FAIL_CLOSED');
  const code = callback.searchParams.get('code');
  if (typeof code !== 'string' || code.length < 8 || code.length > CODE_MAX ||
      !/^[A-Za-z0-9._~-]+$/.test(code)) return no('OAUTH_CODE_FORMAT_REQUIRES_PROVIDER_REVIEW');
  const claimedOaId = callback.searchParams.get('oa_id');
  if (typeof claimedOaId !== 'string' || !OA_ID.test(claimedOaId)) return no('INVALID_CLAIMED_OA_ID');
  return ok('CALLBACK_SHAPE_CANDIDATE_NO_GRANT_NO_OWNERSHIP');
}

/** Test-only structural preflight for OA webhooks; NOT a signature validator.
 * Zalo Bot header auth and Meta HMAC are *not* interchangeable with Zalo OA MAC.
 * Never return payload, signed bytes, IDs, sender content, credentials or signature.
 */
export function inspectOaWebhookShape({headers, rawBody} = {}) {
  if (!Buffer.isBuffer(rawBody) || rawBody.length < 2 || rawBody.length > MAX_WEBHOOK_BYTES)
    return no('MISSING_OR_OVERSIZED_RAW_BODY');
  if (!headers || typeof headers !== 'object' || Array.isArray(headers)) return no('INVALID_HEADERS');
  const sigKeys = Object.keys(headers).filter(k => k.toLowerCase() === 'x-zevent-signature');
  if (sigKeys.length !== 1 || typeof headers[sigKeys[0]] !== 'string' ||
      !/^mac\s*=\s*[a-f0-9]{64}$/i.test(headers[sigKeys[0]].trim()))
    return no('OA_SIGNATURE_HEADER_MISSING_OR_MALFORMED');
  const contentTypes = Object.keys(headers).filter(k => k.toLowerCase() === 'content-type');
  if (contentTypes.length !== 1 || typeof headers[contentTypes[0]] !== 'string' ||
      !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(headers[contentTypes[0]]))
    return no('INVALID_OA_CONTENT_TYPE');
  let event;
  try { event = JSON.parse(rawBody.toString('utf8')); }
  catch { return no('INVALID_EVENT_JSON'); }
  if (!event || typeof event !== 'object' || Array.isArray(event) ||
      !APP_ID.test(event.app_id ?? '') || !ALLOWED_OA_EVENTS.has(event.event_name) ||
      !OA_ID.test(event.recipient?.id ?? '') ||
      typeof event.sender?.id !== 'string' || !event.sender.id ||
      typeof event.message?.msg_id !== 'string' || !event.message.msg_id)
    return no('OA_EVENT_SCHEMA_NOT_SUPPORTED');
  if (typeof event.timestamp !== 'string' || !/^[0-9]{12,16}$/.test(event.timestamp))
    return no('OA_TIMESTAMP_SHAPE_UNVERIFIED');
  // Admission requires server-side OA installation lookup, raw-byte signature verification,
  // durable replay reservation, and owner/Store policy; none are performed here.
  return ok('OA_WEBHOOK_SHAPE_CANDIDATE_UNTRUSTED');
}

/** Requires trusted, independently attested PRIVATE material to plan a real UAT.
 * The public module deliberately never attests or activates a real provider installation.
 */
export function assessPrivateOaNoSendReadiness(evidence = {}) {
  // Do not accept claimed checkboxes as provider evidence. Private operator must
  // verify actual named artifacts in restricted systems before real traffic.
  const required = [
    'PRIVATE_MERCHANT_OA_ADMIN_CONSENT',
    'INDEPENDENT_OPERATOR_APPROVAL',
    'APPROVED_STAGING_APP_AND_CALLBACK',
    'REAL_OA_PKCE_STATE_ECHO_AND_CODE_FORMAT',
    'PRIVATE_BACKEND_TOKEN_EXCHANGE_AND_OA_PROFILE_READBACK',
    'MANAGED_ENCRYPTED_TOKEN_VAULT_AND_REFRESH_LEASE',
    'ATOMIC_GLOBAL_OA_STORE_REGISTRY',
    'REAL_SAME_TENANT_STORE_A_B_OWNER_JWT_RLS',
    'SIGNED_OA_RAW_BODY_CANARY_AND_DURABLE_REPLAY',
    'INACTIVE_ACCESS_PROTECTED_NO_SEND_RUNNER',
    'INDEPENDENT_REDACTED_UAT_AUDIT_AND_ROLLBACK'
  ];
  const supplied = evidence && typeof evidence === 'object' && !Array.isArray(evidence)
    ? Object.keys(evidence).length : 0;
  return Object.freeze({
    stage:'PROPOSED_PRIVATE_REAL_OA_UAT_NOT_EXECUTED',
    missingEvidence:required,
    untrustedSelfReportedFields:supplied,
    canExecuteProviderOAuth:false,
    canReceiveRealTraffic:false,
    canActivate:false,
    canSend:false,
    canWriteOrders:false
  });
}
