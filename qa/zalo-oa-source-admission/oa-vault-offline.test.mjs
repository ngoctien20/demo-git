import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, createDecipheriv } from 'node:crypto';
import { sealSyntheticOaTokens, rotateSyntheticOaTokenReference } from './oa-vault-offline.mjs';

const NOW = 1794900000000;
const binding = Object.freeze({
  provider: 'ZALO_OA', environment: 'staging',
  appId: '360846524940903967', oaId: '388613280879808645',
  tenantId: 'tenant-1', storeId: 'store-A', keyVersion: 'key-v1', tokenVersion: 1
});
const tokens = Object.freeze({
  accessToken: 'synthetic-only-access-token-1',
  refreshToken: 'synthetic-only-refresh-token-1',
  accessExpiresAtMs: NOW + 90000,
  refreshExpiresAtMs: NOW + 600000
});
function aad(b) {
  return Buffer.from(JSON.stringify(['TIEN404-ZALO-OA-TOKEN-V1', b.provider,
    b.environment, b.appId, b.oaId, b.tenantId, b.storeId,
    b.keyVersion, b.tokenVersion]));
}
function decryptForFixture(envelope, key, b = binding) {
  const d = createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64url'));
  d.setAAD(aad(b));
  d.setAuthTag(Buffer.from(envelope.tag, 'base64url'));
  return JSON.parse(Buffer.concat([
    d.update(Buffer.from(envelope.ciphertext, 'base64url')), d.final()
  ]).toString('utf8'));
}
function seal(b = binding) {
  return sealSyntheticOaTokens({ binding: b, keyBytes: Buffer.alloc(32, 7), bundle: tokens });
}
test('AEAD sealed envelope roundtrip with private fixture key and exact binding', () => {
  const r = seal();
  assert.deepEqual(decryptForFixture(r, Buffer.alloc(32, 7)), [
    tokens.accessToken, tokens.refreshToken,
    tokens.accessExpiresAtMs, tokens.refreshExpiresAtMs
  ]);
  assert.equal(r.scheme, 'AES-256-GCM');
  assert.equal(r.envelopeVersion, 1);
  assert.equal(r.keyVersion, 'key-v1');
});
test('sealed envelope never includes token plaintext', () => {
  const r = seal();
  assert.equal(JSON.stringify(r).includes(tokens.accessToken), false);
  assert.equal(JSON.stringify(r).includes(tokens.refreshToken), false);
  assert.equal(Object.hasOwn(r, 'accessToken'), false);
});
test('AES-GCM fresh IV for each envelope with same binding', () => {
  const x = seal(), y = seal();
  assert.notEqual(x.iv, y.iv);
  assert.notEqual(x.ciphertext, y.ciphertext);
});
test('wrong key cannot open ciphertext', () => {
  const e = seal();
  assert.throws(() => decryptForFixture(e, randomBytes(32)));
});
test('different Store AAD cannot open ciphertext', () => {
  const e = seal();
  assert.throws(() => decryptForFixture(e, Buffer.alloc(32, 7),
    { ...binding, storeId: 'store-B' }));
});
test('different Tenant AAD cannot open ciphertext', () => {
  const e = seal();
  assert.throws(() => decryptForFixture(e, Buffer.alloc(32, 7),
    { ...binding, tenantId: 'tenant-2' }));
});
test('different OA AAD cannot open ciphertext', () => {
  const e = seal();
  assert.throws(() => decryptForFixture(e, Buffer.alloc(32, 7),
    { ...binding, oaId: '388613280879808646' }));
});
test('different key version or token generation cannot open ciphertext', () => {
  const e = seal();
  assert.throws(() => decryptForFixture(e, Buffer.alloc(32, 7),
    { ...binding, tokenVersion: 2 }));
  assert.throws(() => decryptForFixture(e, Buffer.alloc(32, 7),
    { ...binding, keyVersion: 'key-v2' }));
});
test('tampered ciphertext and tag fail authentication', () => {
  const e = seal();
  // Flip an actual ciphertext byte, not the final base64url character:
  // trailing base64url bits may be non-significant and decode unchanged.
  const corrupted = Buffer.from(e.ciphertext, 'base64url');
  corrupted[0] ^= 0x01;
  const t = { ...e, ciphertext: corrupted.toString('base64url') };
  assert.notEqual(t.ciphertext, e.ciphertext);
  assert.throws(() => decryptForFixture(t, Buffer.alloc(32, 7)));
  const v = { ...e, tag: 'A'.repeat(22) };
  assert.throws(() => decryptForFixture(v, Buffer.alloc(32, 7)));
});
test('reject wrong key length', () => {
  assert.throws(() => sealSyntheticOaTokens({
    binding, keyBytes: Buffer.alloc(16), bundle: tokens
  }), /INVALID_TOKEN_BUNDLE_OR_KEY/);
});
test('reject invalid binding/environment', () => {
  assert.throws(() => seal({ ...binding, environment: 'production' }), /INVALID_BINDING/);
});
test('reject raw empty or invalid token bundle', () => {
  assert.throws(() => sealSyntheticOaTokens({
    binding, keyBytes: Buffer.alloc(32, 7),
    bundle: { ...tokens, refreshToken: '' }
  }), /INVALID_TOKEN_BUNDLE_OR_KEY/);
});
test('reject expired or reversed expires', () => {
  assert.throws(() => sealSyntheticOaTokens({
    binding, keyBytes: Buffer.alloc(32, 7),
    bundle: { ...tokens, refreshExpiresAtMs: tokens.accessExpiresAtMs }
  }), /INVALID_TOKEN_BUNDLE_OR_KEY/);
});
function rotationFixture() {
  const versions = new Map([['vault-ref-1', 1]]);
  const d = { executionMode: 'OFFLINE_FIXTURE_ONLY', liveEnabled: false,
    versions, vault: { compareAndSwap: async ({ vaultRef, expectedVersion, nextVersion }) => {
      if (versions.get(vaultRef) !== expectedVersion) return { updated: false };
      versions.set(vaultRef, nextVersion);
      return { updated: true, version: nextVersion };
    } } };
  return d;
}
function rotationInput() {
  return { vaultRef: 'vault-ref-1', expectedVersion: 1,
    sealedEnvelope: seal({ ...binding, tokenVersion: 2 }) };
}
test('refresh rotation CAS changes generation once, no hosted write', async () => {
  const f = rotationFixture();
  const x = await rotateSyntheticOaTokenReference(rotationInput(), f);
  assert.equal(x.committed, true);
  assert.equal(x.newVersion, 2);
  assert.equal(x.hostedWrite, false);
  assert.equal(x.providerSend, false);
});
test('old generation cannot overwrite new refresh token', async () => {
  const f = rotationFixture(), i = rotationInput();
  assert.equal((await rotateSyntheticOaTokenReference(i, f)).committed, true);
  const later = await rotateSyntheticOaTokenReference(i, f);
  assert.equal(later.committed, false);
  assert.equal(later.reason, 'STALE_REFRESH_GENERATION');
  assert.equal(f.versions.get('vault-ref-1'), 2);
});
test('two concurrent rotations allow only one CAS winner', async () => {
  const f = rotationFixture(), i = rotationInput();
  const results = await Promise.all([
    rotateSyntheticOaTokenReference(i, f),
    rotateSyntheticOaTokenReference(i, f)
  ]);
  assert.equal(results.filter(x => x.committed).length, 1);
});
test('rotation cannot run with live mode or production mode', async () => {
  const f = rotationFixture(); f.executionMode = 'PRODUCTION';
  assert.equal((await rotateSyntheticOaTokenReference(rotationInput(), f)).committed, false);
  const g = rotationFixture(); g.liveEnabled = true;
  assert.equal((await rotateSyntheticOaTokenReference(rotationInput(), g)).committed, false);
});
test('rotation rejects malformed envelope', async () => {
  const f = rotationFixture();
  const i = rotationInput(); i.sealedEnvelope = { ...i.sealedEnvelope, iv: 'x' };
  const r = await rotateSyntheticOaTokenReference(i, f);
  assert.equal(r.committed, false);
  assert.equal(r.reason, 'INVALID_ROTATION_ENVELOPE');
});
test('rotation refuses mismatched tokenVersion', async () => {
  const f = rotationFixture();
  const i = rotationInput();
  i.sealedEnvelope = { ...i.sealedEnvelope, tokenVersion: 3 };
  assert.equal((await rotateSyntheticOaTokenReference(i, f)).committed, false);
});
test('rotation storage outage is fail-closed', async () => {
  const f = rotationFixture();
  f.vault.compareAndSwap = async () => { throw Error('db offline'); };
  const r = await rotateSyntheticOaTokenReference(rotationInput(), f);
  assert.equal(r.reason, 'VAULT_ATOMIC_SWAP_UNAVAILABLE');
  assert.equal(r.committed, false);
});
