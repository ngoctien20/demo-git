import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { admitPendingOaInstallation, grantBindingDigest } from './oa-grant-registry-offline.mjs';

const NOW = 1794900000000;
const APP_ID = '360846524940903967';
const OA_ID = '388613280879808645';
const sha = x => createHash('sha256').update(x).digest('hex');
const input = { sessionProof: 'qa-owner-session-proof', grantHandle: 'private-grant-1',
  approvalHandle: 'private-independent-approval-1' };

function fixture(grantId = 'grant-1') {
  const actor = { authenticated: true, revoked: false, actorId: 'owner-A', sessionId: 'auth-session-A' };
  const grant = { grantId, provider: 'ZALO_OA', environment: 'staging',
    source: 'PRIVATE_BACKEND_OAUTH_EXCHANGE', issuerId: 'pinned-private-issuer',
    providerTokenExchanged: true, oaProfileReadbackVerified: true,
    appId: APP_ID, claimedOaId: OA_ID, verifiedOaId: OA_ID,
    tenantId: 'tenant-1', storeId: 'store-A', ownerId: actor.actorId,
    sessionDigest: sha(actor.sessionId), vaultRef: 'vault-ref-1', issuedAtMs: NOW };
  const approval = { approvalType: 'INDEPENDENT_OPERATOR', verified: true,
    operatorId: 'operator-B', bindingDigest: grantBindingDigest(grant),
    expiresAtMs: NOW + 100000, noSendOnly: true, hostedDeploymentApproved: false };
  const meta = { status: 'SEALED', provider: 'ZALO_OA', environment: 'staging',
    vaultRef: grant.vaultRef, appId: APP_ID, oaId: OA_ID,
    tenantId: grant.tenantId, storeId: grant.storeId,
    bindingDigest: grantBindingDigest(grant), keyVersion: 'key-v1',
    refreshGeneration: 1, refreshTokenPresent: true, accessExpiresAtMs: NOW + 100000 };
  const reservations = new Map();
  const seen = new Set();
  const f = { executionMode: 'OFFLINE_FIXTURE_ONLY', liveEnabled: false, nowMs: NOW,
    actor, grant, approval, meta, reservations, ownerAllowed: true,
    authenticateOwner: async () => actor,
    authorizeStoreOwner: async () => f.ownerAllowed,
    getApprovedApp: async () => ({ provider: 'ZALO_OA', environment: 'staging',
      approved: true, appId: APP_ID, trustedIssuerId: 'pinned-private-issuer' }),
    grants: { consume: async () => {
      if (seen.has('grant')) return null;
      seen.add('grant'); return { ...grant };
    } },
    approvals: { consume: async () => {
      if (seen.has('approval')) return null;
      seen.add('approval'); return { ...approval };
    } },
    vault: { inspect: async () => ({ ...meta }) },
    registry: { reserveGlobal: async record => {
      const k = record.provider + ':' + record.oaId;
      if (reservations.has(k)) return { reserved: false };
      reservations.set(k, { ...record });
      return { reserved: true, installationId: record.installationId };
    } }
  };
  return f;
}
async function denied(reason, f, i = input) {
  const r = await admitPendingOaInstallation(i, f);
  assert.equal(r.accepted, false, JSON.stringify(r));
  assert.equal(r.reason, reason);
  assert.equal(r.noSend, true);
  assert.equal(r.hostedWrite, false);
  assert.equal(r.canActivate, false);
}

test('offline verified-shaped grant reserves pending non-live installation', async () => {
  const f = fixture();
  const r = await admitPendingOaInstallation(input, f);
  assert.equal(r.accepted, true);
  assert.equal(r.stage, 'PENDING_REVIEW');
  assert.equal(r.canReceiveRealTraffic, false);
  assert.equal(r.actualProviderCanaryVerified, false);
  assert.equal(r.noSend, true);
  assert.equal(r.noOrderWrite, true);
  assert.equal(r.hostedWrite, false);
  const rec = [...f.reservations.values()][0];
  assert.equal(rec.sendEnabled, false);
  assert.equal(rec.catalogReadEnabled, false);
  assert.equal(rec.status, 'PENDING_REVIEW');
  assert.equal(rec.tenantId, 'tenant-1');
  assert.equal(rec.storeId, 'store-A');
  assert.equal(rec.vaultRef, 'vault-ref-1');
  assert.equal(JSON.stringify(r).includes(OA_ID), false);
  assert.equal(JSON.stringify(r).includes('vault-ref-1'), false);
});
test('no source-only mode: refuses real hosted admission', async () => {
  const f = fixture(); f.executionMode = 'PRODUCTION';
  await denied('NOT_AUTHORIZED_FOR_REAL_ADMISSION', f);
});
test('liveEnabled true cannot be upgraded by caller', async () => {
  const f = fixture(); f.liveEnabled = true;
  await denied('NOT_AUTHORIZED_FOR_REAL_ADMISSION', f);
});
test('missing dependencies denied', async () => {
  await denied('NOT_AUTHORIZED_FOR_REAL_ADMISSION', {});
});
test('grant and approval must be private handles', async () => {
  await denied('INVALID_REQUEST', fixture(), { ...input, grantHandle: '' });
  await denied('INVALID_REQUEST', fixture(), { ...input, approvalHandle: '' });
});
test('owner session must be authenticated', async () => {
  const f = fixture(); f.actor.authenticated = false;
  await denied('OWNER_NOT_AUTHENTICATED', f);
});
test('revoked owner session rejected', async () => {
  const f = fixture(); f.actor.revoked = true;
  await denied('OWNER_NOT_AUTHENTICATED', f);
});
test('app must be pinned/approved in staging', async () => {
  const f = fixture(); f.getApprovedApp = async () => ({ provider: 'ZALO_BOT' });
  await denied('APP_NOT_APPROVED', f);
});
test('untrusted attestor cannot mint verified grant', async () => {
  const f = fixture(); f.grant.issuerId = 'attacker-issuer';
  await denied('GRANT_NOT_INDEPENDENTLY_VERIFIED', f);
});
test('wrong app ID in grant denied', async () => {
  const f = fixture(); f.grant.appId = '360846524940903968';
  await denied('GRANT_NOT_INDEPENDENTLY_VERIFIED', f);
});
test('self-declared provider exchange without private verification denied', async () => {
  const f = fixture(); f.grant.providerTokenExchanged = false;
  await denied('GRANT_NOT_INDEPENDENTLY_VERIFIED', f);
});
test('OA profile not read back from trusted source denied', async () => {
  const f = fixture(); f.grant.oaProfileReadbackVerified = false;
  await denied('GRANT_NOT_INDEPENDENTLY_VERIFIED', f);
});
test('OA claimed in callback must equal provider profile readback', async () => {
  const f = fixture(); f.grant.claimedOaId = '388613280879808646';
  await denied('OA_CALLBACK_PROFILE_MISMATCH', f);
});
test('grant from another session cannot be consumed', async () => {
  const f = fixture(); f.actor.sessionId = 'hijacked-session';
  await denied('GRANT_NOT_INDEPENDENTLY_VERIFIED', f);
});
test('grant from a different owner denied', async () => {
  const f = fixture(); f.grant.ownerId = 'owner-C';
  await denied('GRANT_NOT_INDEPENDENTLY_VERIFIED', f);
});
test('grant expired after 5-minute bound', async () => {
  const f = fixture(); f.nowMs = NOW + 300001;
  await denied('GRANT_NOT_INDEPENDENTLY_VERIFIED', f);
});
test('future issued grant denied', async () => {
  const f = fixture(); f.grant.issuedAtMs = NOW + 500;
  await denied('GRANT_NOT_INDEPENDENTLY_VERIFIED', f);
});
test('Owner-to-Store authorization denied at backend', async () => {
  const f = fixture(); f.ownerAllowed = false;
  await denied('OWNER_NOT_AUTHORIZED', f);
});
test('owner authority service failure denied', async () => {
  const f = fixture(); f.authorizeStoreOwner = async () => { throw Error('lost'); };
  await denied('OWNER_AUTHORITY_UNAVAILABLE', f);
});
test('operator must be independently verified', async () => {
  const f = fixture(); f.approval.verified = false;
  await denied('INDEPENDENT_OPERATOR_APPROVAL_DENIED', f);
});
test('owner cannot approve own OA installation', async () => {
  const f = fixture(); f.approval.operatorId = 'owner-A';
  await denied('INDEPENDENT_OPERATOR_APPROVAL_DENIED', f);
});
test('approval cannot bind to another OA or Store', async () => {
  const f = fixture(); f.approval.bindingDigest = sha('other-store-and-oa');
  await denied('INDEPENDENT_OPERATOR_APPROVAL_DENIED', f);
});
test('expired independent operator approval denied', async () => {
  const f = fixture(); f.approval.expiresAtMs = NOW;
  await denied('INDEPENDENT_OPERATOR_APPROVAL_DENIED', f);
});
test('operator cannot authorize live hosted deploy via no-send grant', async () => {
  const f = fixture(); f.approval.hostedDeploymentApproved = true;
  await denied('INDEPENDENT_OPERATOR_APPROVAL_DENIED', f);
});
test('operator approval must be no-send only', async () => {
  const f = fixture(); f.approval.noSendOnly = false;
  await denied('INDEPENDENT_OPERATOR_APPROVAL_DENIED', f);
});
test('token bundle must be sealed in managed vault', async () => {
  const f = fixture(); f.meta.status = 'RAW';
  await denied('TOKEN_CUSTODY_NOT_VERIFIED', f);
});
test('vault metadata for another Store denied', async () => {
  const f = fixture(); f.meta.storeId = 'store-B';
  await denied('TOKEN_CUSTODY_NOT_VERIFIED', f);
});
test('vault metadata for wrong OA denied', async () => {
  const f = fixture(); f.meta.oaId = '388613280879808646';
  await denied('TOKEN_CUSTODY_NOT_VERIFIED', f);
});
test('vault receipt binding cannot be tampered', async () => {
  const f = fixture(); f.meta.bindingDigest = sha('tampered');
  await denied('TOKEN_CUSTODY_NOT_VERIFIED', f);
});
test('missing refresh token or stale access expiry denied', async () => {
  const f = fixture(); f.meta.refreshTokenPresent = false;
  await denied('TOKEN_CUSTODY_NOT_VERIFIED', f);
  const g = fixture(); g.meta.accessExpiresAtMs = NOW;
  await denied('TOKEN_CUSTODY_NOT_VERIFIED', g);
});
test('vault read exception fails closed', async () => {
  const f = fixture(); f.vault.inspect = async () => { throw Error('offline'); };
  await denied('TOKEN_VAULT_UNAVAILABLE', f);
});
test('registry read/write failure fails closed', async () => {
  const f = fixture(); f.registry.reserveGlobal = async () => { throw Error('outage'); };
  await denied('ATOMIC_REGISTRY_UNAVAILABLE', f);
});
test('existing OA binding including disabled blocks takeover', async () => {
  const f = fixture();
  f.reservations.set('ZALO_OA:' + OA_ID, { storeId: 'store-B', status: 'revoked' });
  await denied('OA_ALREADY_BOUND_OR_REGISTRY_REJECTED', f);
});
test('same OA linked twice to same Store is blocked until review', async () => {
  const f = fixture();
  assert.equal((await admitPendingOaInstallation(input, f)).accepted, true);
  await denied('GRANT_NOT_INDEPENDENTLY_VERIFIED', f);
});
test('two separate provider receipts race: global unique OA allows only one', async () => {
  const f1 = fixture('grant-1'), f2 = fixture('grant-2');
  f2.registry = f1.registry;
  const [a, b] = await Promise.all([
    admitPendingOaInstallation(input, f1),
    admitPendingOaInstallation(input, f2)
  ]);
  assert.equal([a, b].filter(x => x.accepted).length, 1);
  assert.equal(f1.reservations.size, 1);
});
test('caller-provided tenant/store/oa cannot override trusted grant', async () => {
  const f = fixture();
  const res = await admitPendingOaInstallation(
    { ...input, tenantId: 'tenant-evil', storeId: 'store-evil', oaId: '12345' }, f);
  assert.equal(res.accepted, true);
  const record = [...f.reservations.values()][0];
  assert.equal(record.storeId, 'store-A');
  assert.equal(record.tenantId, 'tenant-1');
  assert.equal(record.oaId, OA_ID);
});
test('single-use verified receipt cannot be replayed', async () => {
  const f = fixture();
  assert.equal((await admitPendingOaInstallation(input, f)).accepted, true);
  await denied('GRANT_NOT_INDEPENDENTLY_VERIFIED', f);
});
