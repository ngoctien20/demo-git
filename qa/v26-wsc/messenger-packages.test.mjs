// WS-C offline test: Messenger Z7FdV7uDvApfbURQ nodes, Published 1f4069a5 vs Draft 41bcea84.
// Code copied verbatim from n8n version history (read-only). No network, no Meta send.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import path from 'node:path';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'nodes');
const load = (f) => readFileSync(path.join(dir, f), 'utf8');
const require = createRequire(import.meta.url);

function runNode(code, { refs = {}, input = [] } = {}) {
  const $ = (name) => {
    const items = (refs[name] ?? []).map((json) => ({ json }));
    return { first: () => items[0], all: () => items, context: { currentRunIndex: 0 } };
  };
  const $input = { all: () => input.map((json) => ({ json })), first: () => ({ json: input[0] }) };
  return new Function('$', '$input', 'require', code)($, $input, require);
}

// ---------------- B-P0-05: Meta HMAC (X-Hub-Signature-256) ----------------
const SIG = load('messenger-verify-signature.1f4069a5.js');
const SECRET = 'test-app-secret-not-real';
const RAW = Buffer.from('{"object":"page","entry":[]}');
const digest = crypto.createHmac('sha256', SECRET).update(RAW).digest('hex'); // what the Crypto node outputs
const verify = (header, computed = digest) => runNode(SIG, {
  refs: { Webhook1: [{ headers: header === undefined ? {} : { 'x-hub-signature-256': header } }] },
  input: [{ computed_hmac: computed }],
})[0].json.verified;

test('HMAC: correct signature -> verified', () => assert.equal(verify('sha256=' + digest), true));
test('HMAC: missing header -> not verified (403 branch)', () => assert.equal(verify(undefined), false));
test('HMAC: wrong secret -> not verified', () => {
  const bad = crypto.createHmac('sha256', 'other').update(RAW).digest('hex');
  assert.equal(verify('sha256=' + bad), false);
});
test('HMAC: tampered body -> not verified', () => {
  const other = crypto.createHmac('sha256', SECRET).update(Buffer.from('{"object":"page","entry":[1]}')).digest('hex');
  assert.equal(verify('sha256=' + other), false);
});
test('HMAC: sha1 header / uppercase / truncated -> not verified, no throw', () => {
  assert.equal(verify('sha1=' + digest.slice(0, 40)), false);
  assert.equal(verify('sha256=' + digest.toUpperCase()), false);
  assert.equal(verify('sha256=' + digest.slice(0, 63)), false);
  assert.equal(verify(['sha256=' + digest]), false);
});
test('HMAC: Crypto node producing non-sha256 digest (e.g. MD5) fails closed', () => {
  const md5 = crypto.createHmac('md5', SECRET).update(RAW).digest('hex');
  assert.equal(verify('sha256=' + digest, md5), false);
});

// ---------------- Package P5: Verify Send Result (reply-count exactness) ----------------
const SEND_PUB = load('messenger-verify-send.1f4069a5.js');
const SEND_DRAFT = load('messenger-verify-send.41bcea84.js');
const sendRun = (code, results, plan = { messageIndex: 1, messageCount: results.length }) =>
  () => runNode(code, { refs: { 'Prepare Messenger Reply': [{ senderId: '1000000000000001', ...plan }] }, input: results });
const ok = (id) => ({ message_id: id, recipient_id: '1000000000000001' });

test('VerifySend: 2 planned, 2 confirmed -> both pass', () => {
  assert.equal(sendRun(SEND_PUB, [ok('m1'), ok('m2')])()[0].json.sentMessageCount, 2);
  assert.equal(sendRun(SEND_DRAFT, [ok('m1'), ok('m2')])()[0].json.sentMessageCount, 2);
});
test('VerifySend: 3 planned, only 2 confirmed -> PUBLISHED records answered (bug), DRAFT throws', () => {
  const plan = { messageIndex: 1, messageCount: 3 };
  assert.equal(sendRun(SEND_PUB, [ok('m1'), ok('m2')], plan)()[0].json.sentMessageCount, 2);
  assert.throws(sendRun(SEND_DRAFT, [ok('m1'), ok('m2')], plan), /Incomplete/);
});
test('VerifySend: duplicate message_id -> DRAFT throws', () => {
  assert.throws(sendRun(SEND_DRAFT, [ok('m1'), ok('m1')]), /duplicate/);
});
test('VerifySend: wrong recipient -> both throw', () => {
  const bad = [{ message_id: 'm1', recipient_id: '999' }];
  assert.throws(sendRun(SEND_PUB, bad));
  assert.throws(sendRun(SEND_DRAFT, bad));
});

// ---------------- Package P2: menu correlation scoped by (page, sender, mid) ----------------
const FIND_PUB = load('messenger-find-menu.1f4069a5.js');
const FIND_DRAFT = load('messenger-find-menu.41bcea84.js');
const PAGE = '1000000000000099';
const body = (events) => ({ body: { object: 'page', entry: events.map(([page, e]) => ({ id: page, messaging: [e] })) } });
const qr = (sid, mid, payload) => ({ sender: { id: sid }, recipient: { id: PAGE }, timestamp: Date.now(), message: { mid, text: 'x', quick_reply: { payload } } });

test('FindMenu: same mid from two senders -> DRAFT keeps each payload with its sender', () => {
  const b = body([[PAGE, qr('111111', 'mid.1', 'T404:M:catalog')], [PAGE, qr('222222', 'mid.1', 'T404:M:handoff')]]);
  const items = [{ pageId: PAGE, senderId: '222222', messageId: 'mid.1', mediaType: 'text' }];
  assert.equal(runNode(FIND_DRAFT, { refs: { Webhook1: [b] }, input: items })[0].json.menuPayload, 'T404:M:handoff');
  // Published keys only by mid -> last writer wins; would mis-route if mids collided.
  assert.equal(runNode(FIND_PUB, { refs: { Webhook1: [b] }, input: items })[0].json.menuPayload, 'T404:M:handoff');
  const items1 = [{ pageId: PAGE, senderId: '111111', messageId: 'mid.1', mediaType: 'text' }];
  assert.equal(runNode(FIND_DRAFT, { refs: { Webhook1: [b] }, input: items1 })[0].json.menuPayload, 'T404:M:catalog');
  assert.equal(runNode(FIND_PUB, { refs: { Webhook1: [b] }, input: items1 })[0].json.menuPayload, 'T404:M:handoff', 'published cross-contaminates');
});

// ---------------- Package P3: catalog pagination wiring ----------------
const BRIDGE_CURSOR_0d04c978 = /^T404:C:([a-z][a-z0-9_]{1,31}):([1-9][0-9]{0,8}):([0-9a-f]{8}):([1-9][0-9]?)$/; // published bridge
const PREPARE_QR_9342025c = /^T404:C:[a-z][a-z0-9_]{1,31}:[1-9][0-9]{0,8}:[0-9a-f]{8}:[1-9][0-9]?$/;
const PREPARE_QR_18125761 = /^T404:C:[a-z][a-z0-9_]{1,31}:[1-9][0-9]{0,8}:[1-9][0-9]?$/;
const cursor18125761 = (id, v, p) => 'T404:C:' + id + ':' + v + ':' + p;
const cursor9342025c = (id, v, d, p) => 'T404:C:' + id + ':' + v + ':' + d + ':' + p;

test('Catalog: 18125761 cursor (no digest) is REJECTED by published bridge -> must ship with 9342025c', () => {
  const c = cursor18125761('catalog', 1, 2);
  assert.equal(PREPARE_QR_18125761.test(c), true);
  assert.equal(BRIDGE_CURSOR_0d04c978.test(c), false);
});
test('Catalog: 9342025c cursor accepted by Prepare and published bridge', () => {
  const c = cursor9342025c('catalog', 1, '0a1b2c3d', 2);
  assert.equal(PREPARE_QR_9342025c.test(c), true);
  assert.deepEqual(BRIDGE_CURSOR_0d04c978.exec(c).slice(1), ['catalog', '1', '0a1b2c3d', '2']);
});
test('Catalog: longest cursor fits new 100-char limit but not old 40-char limit', () => {
  const c = cursor9342025c('a'.repeat(32), 999999999, 'ffffffff', 99);
  assert.ok(c.length > 40 && c.length <= 100, String(c.length));
  const b = body([[PAGE, qr('111111', 'mid.9', c)]]);
  const it = [{ pageId: PAGE, senderId: '111111', messageId: 'mid.9', mediaType: 'text' }];
  assert.equal(runNode(FIND_DRAFT, { refs: { Webhook1: [b] }, input: it })[0].json.menuPayload, c);
  assert.equal(runNode(FIND_PUB, { refs: { Webhook1: [b] }, input: it })[0].json.menuPayload, undefined);
});

const APPLY_PUB = load('messenger-apply-menu.1f4069a5.js');
const APPLY_DRAFT = load('messenger-apply-menu.41bcea84.js');
const apply = (code, decision, orig = { pageId: PAGE, senderId: '111111', messageId: 'pb_1', mediaType: 'postback', chatInput: 'Khách vừa nhấn Bắt đầu trò chuyện. Chào khách và hỏi muốn tư vấn sản phẩm hay hỗ trợ đơn hàng.', menuPayload: 'T404:M:catalog' }) =>
  runNode(code, { refs: { 'Nút menu đã cấu hình?': [orig] }, input: [decision] })[0].json;
// Exactly what published bridge 0d04c978 returns for T404:M:catalog with published menu version 1 (number).
const BRIDGE_CATALOG = { mode: 'catalog', itemId: 'catalog', catalogPage: 1, catalogCategory: null, configVersion: 1, configSource: 'published' };

test('LIVE DRIFT: published Z7Fd ignores bridge mode "catalog" -> customer gets greeting/AI path', () => {
  const o = apply(APPLY_PUB, BRIDGE_CATALOG);
  assert.equal(o.menuMode, 'catalog');
  assert.equal(o.mediaType, 'postback');
  assert.match(o.chatInput, /Bắt đầu trò chuyện/);
});
test('Catalog: draft Apply turns bridge catalog decision into catalog_page', () => {
  const o = apply(APPLY_DRAFT, BRIDGE_CATALOG);
  assert.equal(o.mediaType, 'catalog_page');
  assert.equal(o.catalogPage, 1);
  assert.equal(o.catalogDigest, null);
});
test('Catalog: draft Apply rejects malformed bridge decision with safe text', () => {
  const o = apply(APPLY_DRAFT, { ...BRIDGE_CATALOG, configVersion: '1' });
  assert.equal(o.mediaType, 'menu_reply');
});

// ---------------- Package P1: role-aware handoff team allowlist ----------------
test('Handoff: draft Apply propagates only allowlisted teams', () => {
  const base = { mode: 'handoff', chatInput: 'Tôi muốn gặp nhân viên tư vấn', configVersion: 1 };
  assert.equal(apply(APPLY_DRAFT, { ...base, team: 'sales' }).menuHandoffTeam, 'sales');
  assert.equal(apply(APPLY_DRAFT, { ...base, team: 'root' }).menuHandoffTeam, undefined);
  assert.equal(apply(APPLY_PUB, { ...base, team: 'sales' }).menuHandoffTeam, undefined);
});
