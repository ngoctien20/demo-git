// V21 Phase 2: isolated route simulation using a sanitized snapshot of real n8n DRAFT Code nodes.
// No webhook invoked, no external send, no database writes. Node.js vm uses synthetic inputs only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { decide } from '../lib/bot-bridge.mjs';
import { templateConfig } from '../lib/templates.mjs';

const snapshot = JSON.parse(fs.readFileSync(new URL('./fixtures/messenger-phase2-draft.json', import.meta.url), 'utf8'));
const source = snapshot.nodes;
const ID = 'msg.synthetic.same';
const pageA = '11111111111', pageB = '22222222222';
const senderA = '33333333333', senderB = '44444444444';

function fakeNode(name, items, { webhook = null, original = [], current = null } = {}) {
  const code = source[name]?.code;
  assert.ok(code, 'Missing audited code snapshot for ' + name);
  const $ = (target) => {
    if (target === 'Webhook1') return { first: () => ({ json: { body: webhook } }) };
    if (target === 'Nút menu đã cấu hình?') return { all: () => original };
    if (target === 'Loop One Message') return {
      first: () => ({ json: current }),
      context: { currentRunIndex: 0 },
    };
    throw new Error('Unexpected dependency: ' + target);
  };
  const $input = { all: () => items, first: () => items[0] };
  const out = vm.runInNewContext('(function(){\n' + code + '\n})()', { $, $input }, { timeout: 1000 });
  return JSON.parse(JSON.stringify(out));
}

function item(json) { return { json }; }
function messengerBody(pageId, senderId, payload, { postback = true, id = ID, ts = 1785000000000 } = {}) {
  const event = {
    sender: { id: senderId }, recipient: { id: pageId }, timestamp: ts,
    ...(postback ? { postback: { payload, mid: id } } : {
      message: { mid: id, text: 'Chọn mục', quick_reply: { payload } },
    }),
  };
  return { object: 'page', entry: [{ id: pageId, messaging: [event] }] };
}
function published(config) {
  return { ...config, version_no: 7, config_sha256: 'synthetic-sha',
    menu: config.menu.filter(m => m.enabled) };
}
function simulatedPath({ pageId = pageA, senderId = senderA, payload, config, postback = true, id = ID }) {
  const ts = 1785000000000;
  const body = messengerBody(pageId, senderId, payload, { postback, id, ts });
  const extracted = item({ pageId, senderId, messageId: id, mediaType: postback ? 'postback' : 'text',
    chatInput: postback ? 'Khách nhấn nút' : 'Chọn mục', receivedAt: 'synthetic' });
  const tagged = fakeNode('Tìm nút menu', [extracted], { webhook: body });
  const mode = tagged[0].json.menuPayload ? decide(config, { payload: tagged[0].json.menuPayload }) : { mode: 'legacy' };
  const applied = fakeNode('Áp quyết định menu', [item(mode)], { original: tagged });
  const classified = fakeNode('Classify explicit human request', applied);
  return { tagged: tagged[0].json, mode, applied: applied[0].json, classified: classified[0].json };
}
function messagePreview(current) {
  return fakeNode('Prepare Messenger Reply', [item({ output: '' })], { current })
    .map(x => x.json.messengerMessage);
}
function preTransferMessage(classified) {
  const expression = source['Notify customer and Inbox of handoff request'].jsonBody;
  assert.ok(expression.startsWith('={{') && expression.endsWith('}}'));
  const result = vm.runInNewContext(expression.slice(3, -2), { $json: classified }, { timeout: 1000 });
  return JSON.parse(result).message.text;
}

test('snapshot corresponds to the reviewed draft, not a published workflow', () => {
  assert.equal(snapshot.workflow, 'Z7FdV7uDvApfbURQ');
  assert.equal(snapshot.activeVersionBaseline, '47b48f6d-bc3d-40ae-afe6-96c5fd5452ac');
  assert.ok(snapshot.draftVersion && snapshot.draftVersion !== snapshot.activeVersionBaseline);
  assert.match(source['Tìm nút menu'].code, /JSON\.stringify\(\[page,sid,id\]\)/);
});

test('postback: shop catalog is translated into the existing AI path, not a direct send', () => {
  const s = simulatedPath({ payload: 'T404:M:catalog', config: published(templateConfig('shop')) });
  assert.equal(s.tagged.menuPayload, 'T404:M:catalog');
  assert.equal(s.mode.mode, 'ai');
  assert.equal(s.applied.mediaType, 'text');
  assert.match(s.classified.chatInput, /sản phẩm/);
  assert.equal(s.classified.pauseAction, '');
});

test('quick reply: artist profile returns only approved text in one outgoing message', () => {
  const c = templateConfig('artist');
  c.profile = { display_name: 'Nghệ sĩ QA', bio: 'Thông tin thử nghiệm được duyệt.' };
  const s = simulatedPath({ payload: 'T404:M:profile', config: published(c), postback: false });
  assert.equal(s.mode.mode, 'direct');
  assert.equal(s.classified.mediaType, 'menu_reply');
  assert.deepEqual(messagePreview(s.classified), [{ text: 'Nghệ sĩ QA\nThông tin thử nghiệm được duyệt.' }]);
});

test('manager handoff carries allowed team and pre-transfer wording, without claiming transfer completed', () => {
  const s = simulatedPath({ payload: 'T404:M:manager', config: published(templateConfig('artist')) });
  assert.equal(s.mode.mode, 'handoff');
  assert.equal(s.applied.menuHandoffTeam, 'manager');
  assert.equal(s.classified.pauseAction, 'handoff');
  const pre = preTransferMessage(s.classified);
  assert.match(pre, /đội ngũ quản lý/);
  assert.match(pre, /đang gửi yêu cầu chuyển/);
  assert.doesNotMatch(pre, /đã chuyển|gặp trực tiếp nghệ sĩ/i);
});

test('shop legacy button does not get hijacked by new menu correlation', () => {
  const s = simulatedPath({ payload: 'TIEN404:VIEW:A002', config: published(templateConfig('shop')) });
  assert.equal(s.tagged.menuPayload, undefined);
  assert.equal(s.mode.mode, 'legacy');
});

test('disabled/stale new item produces current-menu fallback, no AI/tool execution', () => {
  const cfg = templateConfig('shop');
  const disabled = cfg.menu.find(i => i.id === 'catalog');
  assert.ok(disabled);
  disabled.enabled = false;
  const s = simulatedPath({ payload: 'T404:M:catalog', config: published(cfg) });
  assert.equal(s.mode.mode, 'rejected');
  assert.equal(s.classified.mediaType, 'menu_reply');
  assert.match(messagePreview(s.classified)[0].text, /Chào|shop|trợ lý/i);
  assert.ok(messagePreview(s.classified)[0].quick_replies.every(x => x.payload !== 'T404:M:catalog'));
});

test('new item with no configuration returns a safe message; forged payload is rejected', () => {
  const noMenu = simulatedPath({ payload: 'T404:M:manager', config: null });
  assert.equal(noMenu.mode.mode, 'rejected');
  assert.equal(noMenu.mode.reason, 'menu_unavailable');
  assert.match(messagePreview(noMenu.classified)[0].text, /không khả dụng/);
  const forged = simulatedPath({ payload: 'T404:M:__proto__', config: published(templateConfig('shop')) });
  assert.equal(forged.mode.mode, 'rejected');
  assert.equal(forged.classified.mediaType, 'menu_reply');
});

test('GET STARTED uses published menu and does not force a shop-specific assistant reply', () => {
  const s = simulatedPath({ payload: 'TIEN404:START', config: published(templateConfig('artist')) });
  assert.equal(s.mode.mode, 'greeting');
  assert.equal(s.classified.mediaType, 'menu_reply');
  const reply = messagePreview(s.classified)[0];
  assert.ok(reply.quick_replies?.some(q => q.payload === 'T404:M:manager'));
});

test('mixed-page batch: same message id never crosses Page or sender boundaries', () => {
  const body = { object: 'page', entry: [
    { id: pageA, messaging: [{ sender: { id: senderA }, message: { mid: ID, quick_reply: { payload: 'T404:M:catalog' } } }] },
    { id: pageB, messaging: [{ sender: { id: senderB }, message: { mid: ID, quick_reply: { payload: 'T404:M:profile' } } }] },
  ] };
  const base = { messageId: ID, mediaType: 'text', chatInput: 'Chọn mục' };
  const items = [item({ ...base, pageId: pageA, senderId: senderA }),
    item({ ...base, pageId: pageB, senderId: senderB }),
    item({ ...base, pageId: pageB, senderId: senderA })];
  const tagged = fakeNode('Tìm nút menu', items, { webhook: body }).map(x => x.json.menuPayload);
  assert.deepEqual(tagged, ['T404:M:catalog', 'T404:M:profile', undefined]);
});

test('same composite event id duplicated in webhook cannot change first selected action', () => {
  const body = messengerBody(pageA, senderA, 'T404:M:catalog', { postback: false });
  body.entry[0].messaging.push({
    sender: { id: senderA }, message: { mid: ID, quick_reply: { payload: 'T404:M:handoff' } },
  });
  const tagged = fakeNode('Tìm nút menu', [item({ pageId: pageA, senderId: senderA, messageId: ID, mediaType: 'text' })], { webhook: body });
  assert.equal(tagged[0].json.menuPayload, 'T404:M:catalog');
});

test('Meta handoff success gate protects waiting label; failure has no path to label', () => {
  const edges = snapshot.connections;
  const main = edges['Handoff succeeded?'].main;
  assert.ok(main[0].some(x => x.node === 'Apply waiting staff Inbox label'));
  assert.ok(!main[1] || !main[1].some(x => x.node === 'Apply waiting staff Inbox label'));
  assert.ok(source['Handoff succeeded?'].conditions.conditions[0].leftValue.includes('$json.success === true'));
  assert.ok(edges['Notify customer and Inbox of handoff request'].main[0].some(x => x.node === 'Pass Messenger Thread to Page Inbox'));
  assert.ok(edges['Pass Messenger Thread to Page Inbox'].main[0].some(x => x.node === 'Handoff succeeded?'));
});

test('normal non-menu text remains on legacy text route', () => {
  const body = { object: 'page', entry: [{ id: pageA, messaging: [{
    sender: { id: senderA }, message: { mid: ID, text: 'Cho xem áo' },
  }] }] };
  const tags = fakeNode('Tìm nút menu', [item({ pageId: pageA, senderId: senderA, messageId: ID,
    mediaType: 'text', chatInput: 'Cho xem áo' })], { webhook: body });
  assert.equal(tags[0].json.menuPayload, undefined);
});
