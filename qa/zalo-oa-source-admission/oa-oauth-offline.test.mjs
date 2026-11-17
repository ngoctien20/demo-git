import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { beginOaConnect, admitOaCallback } from './oa-oauth-offline.mjs';

const NOW = 1794900000000;
const APP_ID = '360846524940903967';
const OA_ID = '388613280879808645';
const APP = Object.freeze({ provider: 'ZALO_OA', environment: 'staging', appId: APP_ID,
  redirectUri: 'https://qa.example.invalid/oa/callback', oauthEnabled: true });
const AUTH = Object.freeze({ authenticated: true, sessionRevoked: false,
  actorId: 'actor-A', sessionId: 'session-A' });
const BEGIN = Object.freeze({ tenantId: 'tenant-1', storeId: 'store-A', sessionProof: 'qa-session' });
function fixture() {
  const states = new Map();
  const f = {
    nowMs: NOW,
    states,
    storedRecords: [],
    app: { ...APP },
    actor: { ...AUTH },
    allowedOwner: true,
    existingInstallation: null,
    authenticateSession: async () => f.actor,
    authorizeStoreOwner: async () => f.allowedOwner,
    getOaApp: async () => f.app,
    findOaInstallation: async () => f.existingInstallation,
    transactionStore: {
      create: async (rec) => {
        if (states.has(rec.stateDigest)) return false;
        states.set(rec.stateDigest, { ...rec });
        f.storedRecords.push({ ...rec });
        return true;
      },
      consume: async (digest) => {
        const r = states.get(digest) ?? null;
        states.delete(digest);
        return r;
      }
    }
  };
  return f;
}
const callback = (state) => ({ state, code: 'AbCdEfG0123456', oaId: OA_ID,
  sessionProof: 'qa-session' });
async function beginOk(f = fixture()) {
  const begin = await beginOaConnect({ ...BEGIN }, f);
  assert.equal(begin.allowed, true);
  return begin;
}
async function denyBegin(code, input, f = fixture()) {
  const res = await beginOaConnect(input, f);
  assert.equal(res.allowed, false);
  assert.equal(res.reason, code);
  assert.equal(res.canActivate, false);
  assert.equal(res.noSend, true);
  assert.equal(res.noWrite, true);
}
async function denyEnd(code, input, f) {
  const res = await admitOaCallback(input, f);
  assert.equal(res.allowed, false);
  assert.equal(res.reason, code);
  assert.equal(res.canActivate, false);
  assert.equal(res.noSend, true);
  assert.equal(res.noWrite, true);
}

test('begin: returns 256-bit unpredictable state, PKCE S256 challenge and no secret', async () => {
  const f = fixture();
  const b = await beginOk(f);
  assert.match(b.state, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(b.codeChallengeMethod, 'S256');
  const rec = f.storedRecords[0];
  assert.equal(rec.stateDigest, createHash('sha256').update(b.state).digest('hex'));
  assert.equal(b.codeChallenge, createHash('sha256').update(rec.pkceVerifier).digest('base64url'));
  assert.equal(rec.pkceVerifier.length, 43);
  assert.match(rec.pkceVerifier, /[A-Z]/);
  assert.match(rec.pkceVerifier, /[a-z]/);
  assert.match(rec.pkceVerifier, /[0-9]/);
  assert.equal(b.expiresAt, NOW + 300000);
  assert.equal(b.canActivate, false);
  assert.equal(Object.hasOwn(b, 'codeVerifier'), false);
  assert.equal(JSON.stringify(b).includes(rec.pkceVerifier), false);
});
test('begin: unique opaque states on repeated requests', async () => {
  const f = fixture();
  const a = await beginOk(f); const b = await beginOk(f);
  assert.notEqual(a.state, b.state);
  assert.notEqual(a.codeChallenge, b.codeChallenge);
});
test('begin: no dependencies', async () => denyBegin('TRUSTED_DEPENDENCIES_MISSING', BEGIN, {}));
test('begin: invalid tenant, Store and session proof', async () => {
  await denyBegin('INVALID_CONNECT_REQUEST', { ...BEGIN, tenantId: '' });
  await denyBegin('INVALID_CONNECT_REQUEST', { ...BEGIN, storeId: '' });
  await denyBegin('INVALID_CONNECT_REQUEST', { ...BEGIN, sessionProof: '' });
});
test('begin: unauthenticated actor denied', async () => {
  const f = fixture(); f.actor.authenticated = false;
  await denyBegin('OWNER_AUTHORIZATION_DENIED', BEGIN, f);
});
test('begin: revoked actor session denied', async () => {
  const f = fixture(); f.actor.sessionRevoked = true;
  await denyBegin('OWNER_AUTHORIZATION_DENIED', BEGIN, f);
});
test('begin: false owner verification denied', async () => {
  const f = fixture(); f.allowedOwner = false;
  await denyBegin('OWNER_AUTHORIZATION_DENIED', BEGIN, f);
});
test('begin: owner authority failure denied', async () => {
  const f = fixture(); f.authorizeStoreOwner = async () => { throw Error('service down'); };
  await denyBegin('OWNER_AUTHORIZATION_DENIED', BEGIN, f);
});
test('begin: unapproved app is blocked', async () => {
  const f = fixture(); f.app.oauthEnabled = false;
  await denyBegin('APP_NOT_APPROVED', BEGIN, f);
});
test('begin: Zalo Bot and production app are blocked', async () => {
  const f = fixture(); f.app.provider = 'ZALO_BOT';
  await denyBegin('APP_NOT_APPROVED', BEGIN, f);
  const g = fixture(); g.app.environment = 'production';
  await denyBegin('APP_NOT_APPROVED', BEGIN, g);
});
test('begin: callback must be HTTPS and non-credentialed', async () => {
  for (const redirectUri of [
    'http://qa.example.invalid/oa/callback',
    'https://user:pass@qa.example.invalid/oa/callback',
    'https://qa.example.invalid/oa/callback#frag',
    'https://localhost/oa/callback',
    'not a URL'
  ]) {
    const f = fixture(); f.app.redirectUri = redirectUri;
    await denyBegin('APP_NOT_APPROVED', BEGIN, f);
  }
});
test('begin: transactions are fail-closed if durable storage is unavailable', async () => {
  const f = fixture(); f.transactionStore.create = async () => false;
  await denyBegin('STATE_STORAGE_UNAVAILABLE', BEGIN, f);
  const g = fixture(); g.transactionStore.create = async () => { throw Error('outage'); };
  await denyBegin('STATE_STORAGE_UNAVAILABLE', BEGIN, g);
});
test('callback: proof is PENDING, cannot activate and code/verifier never emitted', async () => {
  const f = fixture(); const b = await beginOk(f);
  const r = await admitOaCallback(callback(b.state), f);
  assert.equal(r.allowed, true);
  assert.equal(r.stage, 'PENDING_PROVIDER_GRANT_ATTESTATION');
  assert.equal(r.tenantId, 'tenant-1');
  assert.equal(r.storeId, 'store-A');
  assert.equal(r.claimedOaId, OA_ID);
  assert.equal(r.canActivate, false);
  assert.equal(r.noSend, true);
  assert.equal(r.noWrite, true);
  assert.equal(JSON.stringify(r).includes('AbCdEfG0123456'), false);
  assert.equal(JSON.stringify(r).includes(f.storedRecords[0].pkceVerifier), false);
});
test('callback: same callback state cannot be replayed', async () => {
  const f = fixture(); const b = await beginOk(f);
  const input = callback(b.state);
  assert.equal((await admitOaCallback(input, f)).allowed, true);
  await denyEnd('STATE_NOT_VALID', input, f);
});
test('callback: concurrent consumption permits only one', async () => {
  const f = fixture(); const b = await beginOk(f);
  const result = await Promise.all([admitOaCallback(callback(b.state), f),
    admitOaCallback(callback(b.state), f)]);
  assert.equal(result.filter(x => x.allowed).length, 1);
});
test('callback: wrong opaque state denied', async () => {
  const f = fixture(); await beginOk(f);
  await denyEnd('STATE_NOT_VALID', callback('A'.repeat(43)), f);
});
test('callback: invalid state alphabet, code, OA ID denied before consume', async () => {
  const f = fixture(); const b = await beginOk(f);
  await denyEnd('INVALID_OAUTH_CALLBACK', callback('!'.repeat(43)), f);
  await denyEnd('INVALID_OAUTH_CALLBACK', { ...callback(b.state), code: '' }, f);
  await denyEnd('INVALID_OAUTH_CALLBACK', { ...callback(b.state), oaId: 'oa-A' }, f);
  assert.equal(f.states.size, 1);
});
test('callback: expires after 5 minutes and consumes state', async () => {
  const f = fixture(); const b = await beginOk(f);
  f.nowMs = NOW + 300000;
  await denyEnd('STATE_NOT_VALID', callback(b.state), f);
  assert.equal(f.states.size, 0);
});
test('callback: clock moving backward blocked', async () => {
  const f = fixture(); const b = await beginOk(f);
  f.nowMs = NOW - 1;
  await denyEnd('STATE_NOT_VALID', callback(b.state), f);
});
test('callback: another authenticated owner cannot hijack original OAuth session', async () => {
  const f = fixture(); const b = await beginOk(f);
  f.actor.actorId = 'actor-B';
  await denyEnd('ACTOR_OR_APP_MISMATCH', callback(b.state), f);
});
test('callback: same owner in another session cannot hijack OAuth session', async () => {
  const f = fixture(); const b = await beginOk(f);
  f.actor.sessionId = 'session-B';
  await denyEnd('SESSION_MISMATCH', callback(b.state), f);
});
test('callback: now-revoked actor cannot proceed', async () => {
  const f = fixture(); const b = await beginOk(f);
  f.actor.sessionRevoked = true;
  await denyEnd('APP_OR_ACTOR_NOT_APPROVED', callback(b.state), f);
});
test('callback: changed Zalo App after redirect fails closed', async () => {
  const f = fixture(); const b = await beginOk(f);
  f.app.appId = '360846524940903968';
  await denyEnd('ACTOR_OR_APP_MISMATCH', callback(b.state), f);
});
test('callback: changed redirect URI after redirect fails closed', async () => {
  const f = fixture(); const b = await beginOk(f);
  f.app.redirectUri = 'https://qa.example.invalid/other';
  await denyEnd('ACTOR_OR_APP_MISMATCH', callback(b.state), f);
});
test('callback: owner permission revoked during OAuth requires fresh owner approval', async () => {
  const f = fixture(); const b = await beginOk(f);
  f.allowedOwner = false;
  await denyEnd('OWNER_AUTHORIZATION_DENIED', callback(b.state), f);
});
test('callback: OA bound to different Store in same Tenant denied', async () => {
  const f = fixture(); const b = await beginOk(f);
  f.existingInstallation = { tenantId: 'tenant-1', storeId: 'store-B', status: 'active' };
  await denyEnd('OA_ALREADY_BOUND_TO_ANOTHER_STORE', callback(b.state), f);
});
test('callback: OA bound to another Tenant denied', async () => {
  const f = fixture(); const b = await beginOk(f);
  f.existingInstallation = { tenantId: 'tenant-2', storeId: 'store-A', status: 'disabled' };
  await denyEnd('OA_ALREADY_BOUND_TO_ANOTHER_STORE', callback(b.state), f);
});
test('callback: even same Store existing OA requires independent review', async () => {
  const f = fixture(); const b = await beginOk(f);
  f.existingInstallation = { tenantId: 'tenant-1', storeId: 'store-A', status: 'active' };
  await denyEnd('OA_INSTALLATION_EXISTS_REQUIRES_REVIEW', callback(b.state), f);
});
test('callback: registry read failure denied', async () => {
  const f = fixture(); const b = await beginOk(f);
  f.findOaInstallation = async () => { throw Error('db offline'); };
  await denyEnd('INSTALLATION_LOOKUP_FAILED', callback(b.state), f);
});
test('callback: poisoned transaction cannot skip mandatory fields', async () => {
  const f = fixture(); const b = await beginOk(f);
  const digest = createHash('sha256').update(b.state).digest('hex');
  f.states.get(digest).pkceVerifier = '';
  await denyEnd('STATE_NOT_VALID', callback(b.state), f);
});
test('callback: missing trusted dependency denied', async () => {
  await denyEnd('TRUSTED_DEPENDENCIES_MISSING', callback('A'.repeat(43)), {});
});
test('callback: state storage failure denied', async () => {
  const f = fixture(); const b = await beginOk(f);
  f.transactionStore.consume = async () => { throw Error('outage'); };
  await denyEnd('STATE_STORAGE_UNAVAILABLE', callback(b.state), f);
});
test('callback: fake OA ID in callback is not treated as authenticated proof', async () => {
  const f = fixture(); const b = await beginOk(f);
  const r = await admitOaCallback(callback(b.state), f);
  assert.equal(r.allowed, true);
  assert.equal(r.canActivate, false);
  assert.equal(r.need.includes('REAL_PROVIDER_TOKEN_EXCHANGE_AND_OA_ID_MATCH'), true);
});
test('callback: approval cannot be inherited from fake client claims', async () => {
  const f = fixture(); const b = await beginOk(f);
  f.allowedOwner = false;
  await denyEnd('OWNER_AUTHORIZATION_DENIED',
    { ...callback(b.state), claimedMerchantOwnerVerified: true, tenantId: 'another', storeId: 'store-B' }, f);
});
