// TIEN404 V17.ZALO-SOURCE-03: OFFLINE-ONLY OA grant custody + atomic registry admission.
// No network, no token exchange, no real OA admin or hosted Store proof.
// All dependencies below are PRIVATE server-side interfaces simulated in tests.
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';

const PROVIDER = 'ZALO_OA';
const MODE = 'OFFLINE_FIXTURE_ONLY';
const MAX_GRANT_AGE_MS = 300000;
const ID = /^[A-Za-z0-9_-]{1,128}$/;
const OA_ID = /^[0-9]{5,25}$/;
const APP_ID = /^[0-9]{5,25}$/;
const SHA = /^[a-f0-9]{64}$/;

const digest = value => createHash('sha256').update(value, 'utf8').digest('hex');
const good = (x, max = 128) => typeof x === 'string' && x.length > 0 && x.length <= max;
const fail = reason => ({
  accepted: false, reason, noSend: true, noOrderWrite: true,
  canActivate: false, canReceiveRealTraffic: false, hostedWrite: false
});
function exactSHA(a, b) {
  return SHA.test(a ?? '') && SHA.test(b ?? '') &&
    timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}
export function grantBindingDigest(grant) {
  if (!grant || !ID.test(grant.tenantId ?? '') || !ID.test(grant.storeId ?? '') ||
      !APP_ID.test(grant.appId ?? '') || !OA_ID.test(grant.verifiedOaId ?? '') ||
      !ID.test(grant.grantId ?? '')) return null;
  return digest(JSON.stringify([
    PROVIDER, 'staging', grant.tenantId, grant.storeId,
    grant.appId, grant.verifiedOaId, grant.grantId
  ]));
}

/**
 * PRIVATE adapter interface, all simulated in this version:
 * authenticateOwner(sessionProof) -> verified actor, session, not revoked
 * authorizeStoreOwner({actorId,tenantId,storeId,action}) -> true ONLY for verified owner
 * getApprovedApp() -> pinned appId, trustedIssuerId, staging, OA
 * grants.consume(handle) -> signed and independently provider-verified, one-use grant record
 * approvals.consume(handle) -> signed independent operator approval, one-use record
 * vault.inspect(ref) -> METADATA ONLY of sealed token bundle (never raw tokens)
 * registry.reserveGlobal(record) -> atomic GLOBAL unique (ZALO_OA, OA ID) reservation
 *
 * Only OFFLINE_FIXTURE_ONLY mode is enabled; this is not a real provider verifier.
 */
export async function admitPendingOaInstallation(input, deps) {
  if (!deps || deps.executionMode !== MODE || deps.liveEnabled !== false ||
      typeof deps.authenticateOwner !== 'function' ||
      typeof deps.authorizeStoreOwner !== 'function' ||
      typeof deps.getApprovedApp !== 'function' ||
      typeof deps.grants?.consume !== 'function' ||
      typeof deps.approvals?.consume !== 'function' ||
      typeof deps.vault?.inspect !== 'function' ||
      typeof deps.registry?.reserveGlobal !== 'function')
    return fail('NOT_AUTHORIZED_FOR_REAL_ADMISSION');
  if (!good(input?.sessionProof, 2048) || !good(input?.grantHandle, 256) ||
      !good(input?.approvalHandle, 256)) return fail('INVALID_REQUEST');
  const now = deps.nowMs ?? Date.now();
  if (!Number.isSafeInteger(now) || now <= 0) return fail('INVALID_CLOCK');
  let actor, app;
  try {
    actor = await deps.authenticateOwner(input.sessionProof);
    app = await deps.getApprovedApp();
  } catch { return fail('IDENTITY_OR_APP_UNAVAILABLE'); }
  if (!actor || actor.authenticated !== true || actor.revoked !== false ||
      !ID.test(actor.actorId ?? '') || !good(actor.sessionId, 256)) return fail('OWNER_NOT_AUTHENTICATED');
  if (!app || app.provider !== PROVIDER || app.environment !== 'staging' ||
      app.approved !== true || !APP_ID.test(app.appId ?? '') ||
      !ID.test(app.trustedIssuerId ?? '')) return fail('APP_NOT_APPROVED');

  let grant;
  try { grant = await deps.grants.consume(input.grantHandle); }
  catch { return fail('GRANT_RECEIPT_UNAVAILABLE'); }
  if (!grant || grant.provider !== PROVIDER || grant.environment !== 'staging' ||
      grant.source !== 'PRIVATE_BACKEND_OAUTH_EXCHANGE' ||
      grant.issuerId !== app.trustedIssuerId ||
      grant.providerTokenExchanged !== true || grant.oaProfileReadbackVerified !== true ||
      grant.appId !== app.appId || !OA_ID.test(grant.verifiedOaId ?? '') ||
      !ID.test(grant.grantId ?? '') || !ID.test(grant.tenantId ?? '') ||
      !ID.test(grant.storeId ?? '') || !good(grant.vaultRef, 256) ||
      grant.ownerId !== actor.actorId || !exactSHA(grant.sessionDigest, digest(actor.sessionId)) ||
      !Number.isSafeInteger(grant.issuedAtMs) ||
      now < grant.issuedAtMs || now - grant.issuedAtMs > MAX_GRANT_AGE_MS)
    return fail('GRANT_NOT_INDEPENDENTLY_VERIFIED');

  if (grant.claimedOaId !== grant.verifiedOaId)
    return fail('OA_CALLBACK_PROFILE_MISMATCH');
  let ownerAllowed = false;
  try {
    ownerAllowed = await deps.authorizeStoreOwner({
      actorId: actor.actorId, tenantId: grant.tenantId, storeId: grant.storeId,
      action: 'CONNECT_ZALO_OA'
    }) === true;
  } catch { return fail('OWNER_AUTHORITY_UNAVAILABLE'); }
  if (!ownerAllowed) return fail('OWNER_NOT_AUTHORIZED');

  let approval;
  try { approval = await deps.approvals.consume(input.approvalHandle); }
  catch { return fail('OPERATOR_APPROVAL_UNAVAILABLE'); }
  if (!approval || approval.approvalType !== 'INDEPENDENT_OPERATOR' ||
      approval.verified === true && approval.operatorId === actor.actorId ||
      approval.verified !== true || !ID.test(approval.operatorId ?? '') ||
      approval.operatorId === actor.actorId ||
      !exactSHA(approval.bindingDigest, grantBindingDigest(grant)) ||
      !Number.isSafeInteger(approval.expiresAtMs) || now >= approval.expiresAtMs ||
      approval.noSendOnly !== true || approval.hostedDeploymentApproved !== false)
    return fail('INDEPENDENT_OPERATOR_APPROVAL_DENIED');

  let tokenMeta;
  try { tokenMeta = await deps.vault.inspect(grant.vaultRef); }
  catch { return fail('TOKEN_VAULT_UNAVAILABLE'); }
  if (!tokenMeta || tokenMeta.status !== 'SEALED' ||
      tokenMeta.provider !== PROVIDER || tokenMeta.environment !== 'staging' ||
      tokenMeta.vaultRef !== grant.vaultRef || tokenMeta.appId !== app.appId ||
      tokenMeta.oaId !== grant.verifiedOaId ||
      tokenMeta.tenantId !== grant.tenantId || tokenMeta.storeId !== grant.storeId ||
      !exactSHA(tokenMeta.bindingDigest, grantBindingDigest(grant)) ||
      !ID.test(tokenMeta.keyVersion ?? '') ||
      tokenMeta.refreshGeneration !== 1 || tokenMeta.refreshTokenPresent !== true ||
      !Number.isSafeInteger(tokenMeta.accessExpiresAtMs) ||
      tokenMeta.accessExpiresAtMs <= now)
    return fail('TOKEN_CUSTODY_NOT_VERIFIED');

  // No scan-then-insert race: reserveGlobal MUST be one atomic operation with a
  // unique provider+oaId constraint, including revoked/disabled registry rows.
  const record = {
    installationId: randomUUID(), provider: PROVIDER, status: 'PENDING_REVIEW',
    appId: app.appId, oaId: grant.verifiedOaId,
    tenantId: grant.tenantId, storeId: grant.storeId,
    vaultRef: tokenMeta.vaultRef, ownerId: actor.actorId,
    grantId: grant.grantId, tokenKeyVersion: tokenMeta.keyVersion,
    installedAtMs: now, sendEnabled: false, catalogReadEnabled: false
  };
  let reserved;
  try { reserved = await deps.registry.reserveGlobal(record); }
  catch { return fail('ATOMIC_REGISTRY_UNAVAILABLE'); }
  if (!reserved || reserved.reserved !== true || reserved.installationId !== record.installationId)
    return fail('OA_ALREADY_BOUND_OR_REGISTRY_REJECTED');
  return {
    accepted: true, stage: 'PENDING_REVIEW', candidateId: record.installationId,
    provider: PROVIDER, noSend: true, noOrderWrite: true,
    canActivate: false, canReceiveRealTraffic: false, hostedWrite: false,
    actualProviderCanaryVerified: false,
    next: 'INDEPENDENT_REAL_PROVIDER_NO_SEND_UAT_REQUIRES_NEW_APPROVAL'
  };
}
