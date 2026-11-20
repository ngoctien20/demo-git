/**
 * TIEN404 V20.1-P0-S1 -- SYNTHETIC / OFFLINE CONTRACT ONLY.
 * No network, credentials, database, provider send, or production entitlement.
 * The HMAC key in tests is synthetic; this does not attest a real Zalo provider.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

const SCOPES = Object.freeze({ OWNER: 'owner-consent', PROVIDER: 'provider-identity', LINK: 'provider-link', TRANSPORT: 'webhook-transport' });
export const PROOF_SCOPES = SCOPES;

function signable(proof) {
  return JSON.stringify({
    scope: proof.scope, installationId: proof.installationId,
    storeId: proof.storeId, botId: proof.botId,
    eventId: proof.eventId ?? '', url: proof.url ?? '',
    issuedAt: proof.issuedAt, expiresAt: proof.expiresAt,
    nonce: proof.nonce,
  });
}

/** Fixture-only. Real receipts must be minted by separate trusted verifier components. */
export function signSyntheticProof(proof, fixtureKey) {
  return { ...proof, signature: createHmac('sha256', fixtureKey).update(signable(proof)).digest('hex') };
}

function proofValid(proof, scope, expected, fixtureKey, now) {
  if (!proof || proof.scope !== scope || !fixtureKey || typeof proof.signature !== 'string' ||
      !/^[a-f0-9]{64}$/.test(proof.signature) ||
      !Number.isFinite(proof.issuedAt) || !Number.isFinite(proof.expiresAt) ||
      !Number.isFinite(now) || proof.issuedAt > now || proof.expiresAt <= now ||
      proof.expiresAt - proof.issuedAt > 15 * 60_000 ||
      typeof proof.nonce !== 'string' || proof.nonce.length < 12 ||
      proof.installationId !== expected.installationId ||
      proof.storeId !== expected.storeId || proof.botId !== expected.botId ||
      (expected.eventId !== undefined && proof.eventId !== expected.eventId)) return false;
  const anticipated = createHmac('sha256', fixtureKey).update(signable(proof)).digest('hex');
  return timingSafeEqual(Buffer.from(anticipated, 'hex'), Buffer.from(proof.signature, 'hex'));
}

function secureProviderLink(url, allowedOrigin) {
  if (typeof url !== 'string' || url.length > 512 || typeof allowedOrigin !== 'string' || url.includes('..') || /%2e/i.test(url)) return false;
  try {
    const u = new URL(url);
    const allowed = new URL(allowedOrigin);
    // Domain/origin is operator verified, NOT guessed from a Zalo deep-link format.
    return u.protocol === 'https:' && allowed.protocol === 'https:' &&
      u.origin === allowed.origin && !u.username && !u.password && !u.hash &&
      !/(token|secret|credential|api[_-]?key|jwt|access[_-]?key)/i.test(u.search) &&
      !/\.\./.test(u.pathname) && u.pathname !== '/';
  } catch { return false; }
}

const denied = (reason) => ({ status: 'DENIED', reason, qrPayload: null, canSend: false, canWrite: false, liveReady: false });

/**
 * Verifies a synthetic operator-approved admission *candidate*.
 * Even a perfect fixture may NEVER issue a live QR or enable sending.
 */
export function evaluateQrAdmission({ store, installation, ownerProof, providerProof, linkProof, fixtureKey, now }) {
  if (!store || !installation || store.status !== 'active' ||
      installation.status !== 'verified' || installation.revokedAt ||
      !store.id || !store.tenantId || !installation.id || !installation.botId ||
      store.id !== installation.storeId || store.tenantId !== installation.tenantId) return denied('registry_or_store_inactive');
  const expect = { installationId: installation.id, storeId: store.id, botId: installation.botId };
  if (!proofValid(ownerProof, SCOPES.OWNER, expect, fixtureKey, now)) return denied('owner_proof_invalid');
  if (!proofValid(providerProof, SCOPES.PROVIDER, expect, fixtureKey, now)) return denied('provider_proof_invalid');
  if (!proofValid(linkProof, SCOPES.LINK, expect, fixtureKey, now) ||
      !secureProviderLink(linkProof.url, installation.operatorVerifiedOrigin)) return denied('link_unverified');
  return {
    status: 'OFFLINE_CANDIDATE', reason: 'synthetic_evidence_complete_real_provider_and_device_uat_pending',
    installationId: installation.id, storeId: store.id,
    qrPayload: null, canSend: false, canWrite: false, liveReady: false,
  };
}

/**
 * Simulates a fail-closed inbound Store resolver. Never use query/body store claims as authority.
 * The webhook transport proof is synthetic; provider authenticity not proven here.
 */
export function resolveInboundReadOnly({ event, installation, store, transportProof, fixtureKey, now, seenEventIds }) {
  if (!event || !installation || !store || event.botId !== installation.botId ||
      installation.revokedAt || installation.status !== 'verified' ||
      store.id !== installation.storeId || store.tenantId !== installation.tenantId || store.status !== 'active') return denied('invalid_installation');
  if (typeof event.id !== 'string' || !event.id ||
      (seenEventIds && seenEventIds.has(event.id))) return denied('duplicate_or_missing_event');
  if ((event.storeId && event.storeId !== store.id) ||
      (event.tenantId && event.tenantId !== store.tenantId)) return denied('untrusted_store_claim');
  if (!proofValid(transportProof, SCOPES.TRANSPORT,
      { installationId: installation.id, storeId: store.id, botId: installation.botId, eventId: event.id }, fixtureKey, now))
    return denied('unverified_transport');
  return { status: 'READ_ONLY_CANDIDATE', storeId: store.id, tenantId: store.tenantId,
    eventId: event.id, qrPayload: null, canSend: false, canWrite: false, liveReady: false };
}
