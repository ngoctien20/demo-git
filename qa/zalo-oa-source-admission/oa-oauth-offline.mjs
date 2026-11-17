// TIEN404 V17.ZALO-SOURCE-02 — source-only Zalo OA OAuth authorization preflight.
// No network, no OAuth exchange, no token read/write, no installation mutation.
// This is NOT a provider-approved callback handler; it only gates offline authorization.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const TTL_MS = 5 * 60 * 1000;
const MAX_STATE_LENGTH = 128;
const VALID_STATE = /^[A-Za-z0-9_-]{43}$/; // 32 cryptographically random bytes in base64url.
const VALID_OA_ID = /^[0-9]{5,25}$/;
const VALID_APP_ID = /^[0-9]{5,25}$/;
const VALID_CODE = /^[A-Za-z0-9._~\-]{8,1024}$/;
const ALLOWED_ENVIRONMENT = 'staging';

const sha256 = (s) => createHash('sha256').update(s, 'utf8').digest('hex');
const deny = (reason) => ({ allowed: false, reason, noSend: true, noWrite: true, canActivate: false });
const good = (value, max = 128) => typeof value === 'string' && value.length > 0 && value.length <= max;
const nowSafe = (n) => Number.isSafeInteger(n) && n > 0;

function cleanApp(app) {
  if (!app || app.provider !== 'ZALO_OA' || app.environment !== ALLOWED_ENVIRONMENT ||
      !VALID_APP_ID.test(app.appId ?? '') || app.oauthEnabled !== true ||
      !good(app.redirectUri, 2048)) return null;
  let parsed;
  try { parsed = new URL(app.redirectUri); } catch { return null; }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.hash ||
      parsed.search || !parsed.hostname || parsed.hostname === 'localhost' ||
      parsed.hostname.endsWith('.localhost')) return null;
  return { provider: 'ZALO_OA', environment: ALLOWED_ENVIRONMENT, appId: app.appId,
    redirectUri: app.redirectUri };
}

function isActor(actor) {
  return actor && actor.authenticated === true && actor.sessionRevoked === false &&
    good(actor.actorId) && good(actor.sessionId, 200);
}

async function trustedOwner(deps, actor, tenantId, storeId) {
  if (!isActor(actor) || typeof deps.authorizeStoreOwner !== 'function') return false;
  try { return (await deps.authorizeStoreOwner({ actorId: actor.actorId, tenantId, storeId,
    action: 'CONNECT_ZALO_OA' })) === true; } catch { return false; }
}

/**
 * Trusted adapters (server-only):
 * authenticateSession(sessionProof) -> {authenticated,sessionRevoked,actorId,sessionId}
 * authorizeStoreOwner({actorId,tenantId,storeId,action}) -> strict boolean
 * getOaApp() -> pinned trusted {provider,environment,appId,redirectUri,oauthEnabled}
 * transactionStore.create(record) -> boolean, atomic; storage encrypts verifier at rest
 * transactionStore.consume(stateDigest) -> record|null, atomic one-time, expiry enforced again here
 * findOaInstallation({oaId}) -> {tenantId,storeId,status}|null (GLOBAL across all Zalo Apps)
 * No callback fields may be treated as granted rights or proof of provider OA ownership.
 */
export async function beginOaConnect(input, deps) {
  if (!deps || typeof deps.authenticateSession !== 'function' ||
      typeof deps.getOaApp !== 'function' || !deps.transactionStore ||
      typeof deps.transactionStore.create !== 'function' ||
      typeof deps.authorizeStoreOwner !== 'function') return deny('TRUSTED_DEPENDENCIES_MISSING');
  if (!good(input?.tenantId) || !good(input?.storeId) || !good(input?.sessionProof, 2048))
    return deny('INVALID_CONNECT_REQUEST');
  const now = deps.nowMs ?? Date.now();
  if (!nowSafe(now)) return deny('INVALID_CLOCK');
  let actor, app;
  try {
    actor = await deps.authenticateSession(input.sessionProof);
    app = cleanApp(await deps.getOaApp());
  } catch { return deny('AUTHORITY_UNAVAILABLE'); }
  if (!app) return deny('APP_NOT_APPROVED');
  if (!await trustedOwner(deps, actor, input.tenantId, input.storeId))
    return deny('OWNER_AUTHORIZATION_DENIED');
  // Crypto material generated only in trusted runtime; do NOT accept client-supplied state/verifier.
  const state = randomBytes(32).toString('base64url');
  // Zalo OA documentation specifies a 43-character verifier, with upper/lowercase/digits.
  // 32 random bytes encoded as base64url produce exactly 43 URL-safe characters.
  let pkceVerifier;
  do {
    pkceVerifier = randomBytes(32).toString('base64url');
  } while (!/[A-Z]/.test(pkceVerifier) || !/[a-z]/.test(pkceVerifier) || !/[0-9]/.test(pkceVerifier));
  const pkceChallenge = createHash('sha256').update(pkceVerifier).digest('base64url');
  const record = {
    stateDigest: sha256(state), pkceVerifier, appId: app.appId,
    redirectUri: app.redirectUri, tenantId: input.tenantId, storeId: input.storeId,
    actorId: actor.actorId, sessionDigest: sha256(actor.sessionId),
    createdAt: now, expiresAt: now + TTL_MS, environment: ALLOWED_ENVIRONMENT,
    provider: 'ZALO_OA'
  };
  let created;
  try { created = await deps.transactionStore.create(record); }
  catch { return deny('STATE_STORAGE_UNAVAILABLE'); }
  if (created !== true) return deny('STATE_STORAGE_UNAVAILABLE');
  return {
    allowed: true, noSend: true, noWrite: true, canActivate: false,
    provider: 'ZALO_OA', appId: app.appId, redirectUri: app.redirectUri,
    state, codeChallenge: pkceChallenge, codeChallengeMethod: 'S256',
    expiresAt: record.expiresAt,
    next: 'PROVIDER_AUTHORIZATION_REQUIRES_SEPARATE_APPROVAL'
  };
}

export async function admitOaCallback(input, deps) {
  if (!deps || typeof deps.authenticateSession !== 'function' ||
      typeof deps.authorizeStoreOwner !== 'function' ||
      typeof deps.getOaApp !== 'function' || !deps.transactionStore ||
      typeof deps.transactionStore.consume !== 'function' ||
      typeof deps.findOaInstallation !== 'function') return deny('TRUSTED_DEPENDENCIES_MISSING');
  if (!good(input?.sessionProof, 2048) || typeof input.state !== 'string' ||
      input.state.length > MAX_STATE_LENGTH || !VALID_STATE.test(input.state) ||
      !VALID_CODE.test(input.code ?? '') || !VALID_OA_ID.test(input.oaId ?? ''))
    return deny('INVALID_OAUTH_CALLBACK');
  const now = deps.nowMs ?? Date.now();
  if (!nowSafe(now)) return deny('INVALID_CLOCK');
  let actor, app;
  try {
    actor = await deps.authenticateSession(input.sessionProof);
    app = cleanApp(await deps.getOaApp());
  } catch { return deny('AUTHORITY_UNAVAILABLE'); }
  if (!app || !isActor(actor)) return deny('APP_OR_ACTOR_NOT_APPROVED');
  // Consumed before any owner re-check: even denied callbacks cannot be replayed.
  let transaction;
  try { transaction = await deps.transactionStore.consume(sha256(input.state)); }
  catch { return deny('STATE_STORAGE_UNAVAILABLE'); }
  if (!transaction || transaction.provider !== 'ZALO_OA' ||
      transaction.environment !== ALLOWED_ENVIRONMENT ||
      !good(transaction.actorId) || !good(transaction.tenantId) ||
      !good(transaction.storeId) || !good(transaction.pkceVerifier, 128) ||
      !good(transaction.sessionDigest, 64) ||
      !nowSafe(transaction.createdAt) || !nowSafe(transaction.expiresAt) ||
      now < transaction.createdAt || now >= transaction.expiresAt ||
      transaction.expiresAt - transaction.createdAt !== TTL_MS)
    return deny('STATE_NOT_VALID');
  if (transaction.appId !== app.appId || transaction.redirectUri !== app.redirectUri ||
      transaction.actorId !== actor.actorId) return deny('ACTOR_OR_APP_MISMATCH');
  const digest = Buffer.from(sha256(actor.sessionId), 'hex');
  let sessionMatches = false;
  if (/^[a-f0-9]{64}$/.test(transaction.sessionDigest))
    sessionMatches = timingSafeEqual(digest, Buffer.from(transaction.sessionDigest, 'hex'));
  if (!sessionMatches) return deny('SESSION_MISMATCH');
  if (!await trustedOwner(deps, actor, transaction.tenantId, transaction.storeId))
    return deny('OWNER_AUTHORIZATION_DENIED');
  let installed;
  try { installed = await deps.findOaInstallation({ oaId: input.oaId }); }
  catch { return deny('INSTALLATION_LOOKUP_FAILED'); }
  // Any claimed OA occupied by another Store / Tenant, including disabled, requires independent recovery.
  if (installed && (installed.storeId !== transaction.storeId ||
      installed.tenantId !== transaction.tenantId)) return deny('OA_ALREADY_BOUND_TO_ANOTHER_STORE');
  if (installed) return deny('OA_INSTALLATION_EXISTS_REQUIRES_REVIEW');
  // We deliberately never exchange code, return verifier or create a registry row here.
  // Raw callback OA ID is NOT provider-authoritative until token + /getoa verified server-side.
  return {
    allowed: true, noSend: true, noWrite: true, canActivate: false,
    stage: 'PENDING_PROVIDER_GRANT_ATTESTATION',
    tenantId: transaction.tenantId, storeId: transaction.storeId,
    appId: app.appId, claimedOaId: input.oaId,
    ownerId: actor.actorId, need: [
      'REAL_PROVIDER_TOKEN_EXCHANGE_AND_OA_ID_MATCH',
      'PRIVATE_OWNER_AND_OPERATOR_APPROVAL',
      'MANAGED_TOKEN_CUSTODY', 'STORE_RLS_HOSTED_ACCEPTANCE'
    ]
  };
}
