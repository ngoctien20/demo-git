import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import { admitOaEvent, verifyOaMac } from './oa-admission.mjs';

const NOW = 1794900000000;
const INSTALL = Object.freeze({
  id: 'install-shop-a', appId: 'app-a', oaId: 'oa-a', provider: 'ZALO_OA',
  tenantId: 'tenant-shared', storeId: 'store-a', status: 'active', secret: 'qa-only-secret'
});
function makeEvent(overrides = {}) {
  return {
    app_id: 'app-a', event_name: 'user_send_text', timestamp: NOW,
    recipient: { id: 'oa-a' }, sender: { id: 'customer-a' },
    message: { msg_id: 'msg-001', text: 'Còn hàng không?' }, ...overrides
  };
}
function signRaw(rawBody, ev, secret = INSTALL.secret) {
  return 'mac=' + createHash('sha256')
    .update(ev.app_id).update(rawBody).update(String(ev.timestamp)).update(secret).digest('hex');
}
function request(ev = makeEvent(), overrides = {}) {
  const rawBody = Buffer.from(JSON.stringify(ev), 'utf8');
  return {
    rawBody,
    headers: { 'x-zevent-signature': signRaw(rawBody, ev) },
    ...overrides
  };
}
function deps(installation = INSTALL) {
  const seen = new Set();
  return {
    nowMs: NOW,
    resolveInstallation: async ({ appId, oaId }) =>
      installation?.appId === appId && installation?.oaId === oaId ? installation : null,
    replay: { reserve: async (key, ttlMs) => {
      assert.equal(ttlMs, 24 * 60 * 60 * 1000);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    } }
  };
}
async function denied(expected, req, d = deps()) {
  const result = await admitOaEvent(req, d);
  assert.equal(result.accepted, false);
  assert.equal(result.reason, expected);
  assert.equal(result.noSend, true);
  assert.equal(result.noOrderWrite, true);
}
test('positive: signed text resolves server trusted Store A, no send/write', async () => {
  const r = await admitOaEvent(request(), deps());
  assert.equal(r.accepted, true);
  assert.equal(r.event.tenantId, 'tenant-shared');
  assert.equal(r.event.storeId, 'store-a');
  assert.equal(r.event.customerVerified, false);
  assert.equal(r.event.orderAuthorized, false);
  assert.equal(r.event.text, 'Còn hàng không?');
  assert.equal(r.noSend, true);
  assert.equal(r.noOrderWrite, true);
});
test('positive: image is reference-only with no untrusted media URL', async () => {
  const ev = makeEvent({ event_name: 'user_send_image', message: {
    msg_id: 'm-img', attachments: [{ payload: { url: 'http://127.0.0.1/admin' } }]
  } });
  const r = await admitOaEvent(request(ev), deps());
  assert.equal(r.accepted, true);
  assert.equal(r.event.kind, 'image');
  assert.equal(r.event.mediaPendingReview, true);
  assert.equal(r.event.text, null);
  assert.equal(JSON.stringify(r.event).includes('127.0.0.1'), false);
});
test('positive: spoofed tenant/store payload cannot override registry', async () => {
  const ev = makeEvent({ tenant_id: 'other', store_id: 'store-b' });
  const r = await admitOaEvent(request(ev), deps());
  assert.equal(r.accepted, true);
  assert.equal(r.event.storeId, 'store-a');
  assert.equal(r.event.tenantId, 'tenant-shared');
});
test('positive: Store B cannot be selected by Store A installation', async () => {
  const ev = makeEvent({ store_id: 'store-b', sender: { id: 'customer-b' } });
  const r = await admitOaEvent(request(ev), deps());
  assert.equal(r.event.storeId, 'store-a');
});
test('reject: missing replay or registry dependency', async () => {
  await denied('MISSING_TRUSTED_DEPENDENCY', request(), {});
});
test('reject: empty or oversized body', async () => {
  await denied('INVALID_RAW_BODY', { rawBody: Buffer.alloc(0), headers: {} });
  await denied('INVALID_RAW_BODY', { rawBody: Buffer.alloc(128 * 1024 + 1), headers: {} });
});
test('reject: malformed JSON', async () => {
  await denied('INVALID_JSON', { rawBody: Buffer.from('{'), headers: {} });
});
test('reject: unknown event type', async () => {
  await denied('UNSUPPORTED_EVENT', request(makeEvent({ event_name: 'oa_send_text' })));
});
test('reject: missing message ID', async () => {
  await denied('MISSING_IDENTITY', request(makeEvent({ message: { text: 'hello' } })));
});
test('reject: stale or future timestamp', async () => {
  await denied('TIMESTAMP_OUTSIDE_WINDOW', request(makeEvent({ timestamp: NOW - 300001 })));
  await denied('TIMESTAMP_OUTSIDE_WINDOW', request(makeEvent({ timestamp: NOW + 300001 })));
});
test('reject: forged OA/app identity', async () => {
  await denied('UNTRUSTED_INSTALLATION', request(makeEvent({ recipient: { id: 'oa-b' } })));
  await denied('UNTRUSTED_INSTALLATION', request(makeEvent({ app_id: 'app-b' })));
});
test('reject: revoked installation', async () => {
  await denied('UNTRUSTED_INSTALLATION', request(), deps({ ...INSTALL, status: 'revoked' }));
});
test('reject: invalid MAC or rewritten body', async () => {
  const r = request();
  r.headers['x-zevent-signature'] = 'mac=' + '0'.repeat(64);
  await denied('BAD_MAC', r);
  const original = request();
  original.rawBody = Buffer.from(original.rawBody.toString().replace('Còn', 'Hết'));
  await denied('BAD_MAC', original);
});
test('reject: signature fallback to HMAC is not permitted', async () => {
  const ev = makeEvent();
  const r = request(ev);
  r.headers['x-zevent-signature'] = 'mac=' + createHmac('sha256', INSTALL.secret)
    .update(r.rawBody).digest('hex');
  await denied('BAD_MAC', r);
});
test('reject: missing signature and poor signature formats', async () => {
  const r = request(); r.headers = {};
  await denied('BAD_MAC', r);
  const s = request(); s.headers['x-zevent-signature'] = 'mac=not-a-hex-value';
  await denied('BAD_MAC', s);
});
test('reject: same provider message replay including timestamp rewrite', async () => {
  const d = deps();
  const r1 = await admitOaEvent(request(), d);
  assert.equal(r1.accepted, true);
  await denied('DUPLICATE_OR_REPLAY', request(makeEvent({ timestamp: NOW + 1000 })), d);
});
test('reject: replay service error fails closed', async () => {
  const d = deps(); d.replay.reserve = async () => { throw Error('unavailable'); };
  await denied('REPLAY_SERVICE_ERROR', request(), d);
});
test('reject: registry error fails closed', async () => {
  const d = deps(); d.resolveInstallation = async () => { throw Error('unavailable'); };
  await denied('INSTALLATION_LOOKUP_FAILED', request(), d);
});
test('reject: empty text', async () => {
  await denied('INVALID_TEXT', request(makeEvent({ message: { msg_id: 'msg-2', text: '' } })));
});
test('verifier refuses parsed objects and noncanonical signature formatting', () => {
  const r = request();
  assert.equal(verifyOaMac({ appId: 'app-a', secret: INSTALL.secret, timestamp: NOW,
    rawBody: r.rawBody, signature: r.headers['x-zevent-signature'] }), true);
  assert.equal(verifyOaMac({ appId: 'app-a', secret: INSTALL.secret, timestamp: NOW,
    rawBody: JSON.parse(r.rawBody.toString()), signature: r.headers['x-zevent-signature'] }), false);
});
