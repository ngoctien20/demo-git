// TIEN404 V17.ZALO-SOURCE-03 — synthetic token vault cryptographic reference.
// No real OAuth access/refresh tokens; no provider calls or hosted secret manager.
// The private vault actor alone may own key bytes. Do not export open/decrypt to clients.
import { createCipheriv, createHash, randomBytes } from 'node:crypto';

const MODE = 'OFFLINE_FIXTURE_ONLY';
const ID = /^[A-Za-z0-9_-]{1,128}$/;
const OA_ID = /^[0-9]{5,25}$/;
const APP_ID = /^[0-9]{5,25}$/;
const KEY_VERSION = /^[A-Za-z0-9_-]{1,32}$/;
const b64 = x => Buffer.from(x).toString('base64url');
const sha = value => createHash('sha256').update(value).digest('hex');
const no = reason => ({ committed: false, reason, hostedWrite: false, providerSend: false });

function bindingAad(b) {
  if (!b || b.provider !== 'ZALO_OA' || b.environment !== 'staging' ||
      !OA_ID.test(b.oaId ?? '') || !APP_ID.test(b.appId ?? '') ||
      !ID.test(b.tenantId ?? '') || !ID.test(b.storeId ?? '') ||
      !KEY_VERSION.test(b.keyVersion ?? '') || !Number.isSafeInteger(b.tokenVersion) ||
      b.tokenVersion < 1 || b.tokenVersion > 1_000_000)
    throw Error('INVALID_BINDING');
  return Buffer.from(JSON.stringify([
    'TIEN404-ZALO-OA-TOKEN-V1', b.provider, b.environment,
    b.appId, b.oaId, b.tenantId, b.storeId, b.keyVersion, b.tokenVersion
  ]), 'utf8');
}

/** Illustrative AES-256-GCM envelope; keyBytes must be supplied from an external managed secret.
 * Not a deployed key-management or credential-vault service. Never log bundle or key.
 */
export function sealSyntheticOaTokens({ binding, keyBytes, bundle }) {
  const aad = bindingAad(binding);
  if (!Buffer.isBuffer(keyBytes) || keyBytes.length !== 32 ||
      !bundle || typeof bundle.accessToken !== 'string' ||
      bundle.accessToken.length < 8 || bundle.accessToken.length > 4096 ||
      typeof bundle.refreshToken !== 'string' || bundle.refreshToken.length < 8 ||
      bundle.refreshToken.length > 4096 ||
      !Number.isSafeInteger(bundle.accessExpiresAtMs) ||
      !Number.isSafeInteger(bundle.refreshExpiresAtMs) ||
      bundle.accessExpiresAtMs <= 0 || bundle.refreshExpiresAtMs <= bundle.accessExpiresAtMs)
    throw Error('INVALID_TOKEN_BUNDLE_OR_KEY');
  const iv = randomBytes(12); // AES-GCM unique 96-bit nonce per envelope.
  const cipher = createCipheriv('aes-256-gcm', keyBytes, iv);
  cipher.setAAD(aad);
  const payload = Buffer.from(JSON.stringify([
    bundle.accessToken, bundle.refreshToken,
    bundle.accessExpiresAtMs, bundle.refreshExpiresAtMs
  ]), 'utf8');
  const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
  payload.fill(0); // best-effort buffer cleanup; JS strings not guaranteed wipeable.
  return Object.freeze({
    scheme: 'AES-256-GCM', envelopeVersion: 1, keyVersion: binding.keyVersion,
    tokenVersion: binding.tokenVersion, bindingDigest: sha(aad),
    iv: b64(iv), ciphertext: b64(encrypted), tag: b64(cipher.getAuthTag())
  });
}

/** Generation CAS contract only. In production the vault must rotate refresh tokens
 * atomically under a single lock and retain recovery records for uncertain timeouts.
 */
export async function rotateSyntheticOaTokenReference(input, deps) {
  if (!deps || deps.executionMode !== MODE || deps.liveEnabled !== false ||
      typeof deps.vault?.compareAndSwap !== 'function')
    return no('SOURCE_ONLY_NO_HOSTED_ROTATION');
  const v = input?.sealedEnvelope;
  if (!ID.test(input?.vaultRef ?? '') ||
      !Number.isSafeInteger(input?.expectedVersion) || input.expectedVersion < 1 ||
      input.expectedVersion >= 1_000_000 ||
      !v || v.scheme !== 'AES-256-GCM' || v.envelopeVersion !== 1 ||
      v.tokenVersion !== input.expectedVersion + 1 ||
      !/^[a-f0-9]{64}$/.test(v.bindingDigest ?? '') ||
      !KEY_VERSION.test(v.keyVersion ?? '') ||
      !/^[A-Za-z0-9_-]{16}$/.test(v.iv ?? '') ||
      !/^[A-Za-z0-9_-]{22}$/.test(v.tag ?? '') ||
      typeof v.ciphertext !== 'string' || v.ciphertext.length < 12)
    return no('INVALID_ROTATION_ENVELOPE');
  let result;
  try {
    result = await deps.vault.compareAndSwap({
      vaultRef: input.vaultRef, expectedVersion: input.expectedVersion,
      nextVersion: v.tokenVersion, sealedEnvelope: v
    });
  } catch { return no('VAULT_ATOMIC_SWAP_UNAVAILABLE'); }
  if (!result || result.updated !== true || result.version !== v.tokenVersion)
    return no('STALE_REFRESH_GENERATION');
  return { committed: true, newVersion: v.tokenVersion,
    providerSend: false, hostedWrite: false, canUseRealToken: false };
}
