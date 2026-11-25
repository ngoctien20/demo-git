// V27.4 offline: planCards -> per-channel adapters + Messenger webhook classifier. Synthetic only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { planCards } from '../lib/context-card-planner.mjs';
import { toTelegram, toWebWidget, toZaloText, adaptPlan } from '../lib/channel-adapters.mjs';
import { classifyMessengerEvent, RECOMMENDED_FIELDS } from '../lib/messenger-webhook-events.mjs';
import { templateConfig } from '../lib/templates.mjs';

const shop = () => templateConfig('shop');
const artist = () => {
  const c = templateConfig('artist');
  c.menu = c.menu.map((m) => (m.id === 'music' ? { ...m, enabled: true, action_config: { url: 'https://www.youtube.com/@demo' } } : m));
  c.profile = { card_title: 'Khám phá âm nhạc', cover_image_url: 'https://cdn.example.vn/cover.jpg' };
  return c;
};
const rows = (n) => Array.from({ length: n }, (_, i) => {
  const k = 'A00' + (i + 1);
  return { key: k, title: k + ' · Áo <thun> & polo', subtitle: '159.000đ · Còn 18', payload: 'TIEN404:VIEW:' + k, image_url: 'https://i.imgur.com/' + k + '.jpg' };
});
const NEXT = [{ content_type: 'text', title: 'Trang tiếp', payload: 'T404:C:catalog:7:0a1b2c3d:2' }];
const browse = (ch) => planCards({ channel: ch, context: 'browse', config: shop(), rows: rows(3), pageControls: NEXT, text: 'Sản phẩm · trang 1/7', imageHosts: ['i.imgur.com'] });
const kbFlat = (call) => call.params.reply_markup.inline_keyboard.flat();
const allBytes = (s) => new TextEncoder().encode(s).length;

test('A-01 Telegram carousel -> one HTML list message + inline keyboard (3 per row) + nav row', () => {
  const { calls } = toTelegram(browse('telegram'));
  assert.equal(calls.length, 1);
  const c = calls[0];
  assert.equal(c.method, 'sendMessage');
  assert.equal(c.params.parse_mode, 'HTML');
  assert.match(c.params.text, /<b>A001 · Áo &lt;thun&gt; &amp; polo<\/b>/, 'HTML escaped');
  const kb = c.params.reply_markup.inline_keyboard;
  assert.deepEqual(kb[0].map((b) => b.callback_data), ['TIEN404:VIEW:A001', 'TIEN404:VIEW:A002', 'TIEN404:VIEW:A003']);
  assert.deepEqual(kb.at(-1).map((b) => b.text), ['Trang tiếp']);
  assert.ok(kbFlat(c).every((b) => !b.callback_data || allBytes(b.callback_data) <= 64));
});

test('A-02 Telegram greeting chips -> inline keyboard; detail buttons -> one per row (mock-up 03)', () => {
  const g = toTelegram(planCards({ channel: 'telegram', context: 'greeting', config: shop(), text: 'Chào bạn!' })).calls[0];
  assert.deepEqual(kbFlat(g).map((b) => b.callback_data), ['T404:M:catalog', 'T404:M:order_lookup', 'T404:M:handoff']);
  const d = toTelegram(planCards({ channel: 'telegram', context: 'detail', config: shop(), text: 'A001 · 245.000đ',
    actions: [{ title: 'Đặt sản phẩm', payload: 'TIEN404:QR:1' }, { title: 'Xem mẫu tương tự', payload: 'TIEN404:QR:2' }] })).calls[0];
  assert.ok(d.params.reply_markup.inline_keyboard.every((r) => r.length === 1));
});

test('A-03 Telegram artist content card with photo -> sendPhoto + url/callback buttons, no sales', () => {
  const { calls } = toTelegram(planCards({ channel: 'telegram', context: 'greeting', config: artist(), imageHosts: ['cdn.example.vn'] }));
  const photo = calls.find((c) => c.method === 'sendPhoto');
  assert.ok(photo);
  assert.equal(photo.params.photo, 'https://cdn.example.vn/cover.jpg');
  const kb = kbFlat(photo);
  assert.deepEqual(kb.map((b) => b.text), ['Nghe nhạc', 'Thông tin nghệ sĩ', 'Liên hệ quản lý']);
  assert.equal(kb[0].url, 'https://www.youtube.com/@demo');
  assert.ok(!JSON.stringify(calls).includes('TIEN404:VIEW'));
});

test('A-04 Telegram callback_data over 64 bytes is dropped and reported, never sent truncated', () => {
  const plan = { kind: 'quick_replies', degraded: [], messages: [{ text: 'x', quick_replies: [{ content_type: 'text', title: 'Dài', payload: 'T404:M:' + 'a'.repeat(60) }, { content_type: 'text', title: 'Ngắn', payload: 'T404:M:ok' }] }] };
  const r = toTelegram(plan);
  assert.deepEqual(kbFlat(r.calls[0]).map((b) => b.text), ['Ngắn']);
  assert.ok(r.degraded.some((d) => d.startsWith('tg_callback_too_long')));
});

test('A-05 Web widget gets the richest form: carousel with allowed images + sticky chips', () => {
  const { blocks, degraded } = toWebWidget(browse('web'), { imageOrigins: ['https://i.imgur.com'] });
  assert.equal(blocks[0].type, 'carousel');
  assert.equal(blocks[0].items.length, 3);
  assert.equal(blocks[0].items[0].image, 'https://i.imgur.com/A001.jpg');
  assert.deepEqual(blocks.find((b) => b.type === 'chips'), { type: 'chips', placement: 'sticky-bottom', actions: [{ kind: 'action', label: 'Trang tiếp', payload: 'T404:C:catalog:7:0a1b2c3d:2' }] });
  const noImg = toWebWidget(browse('web'), { imageOrigins: [] });
  assert.equal(noImg.blocks[0].items[0].image, undefined);
  assert.ok(noImg.degraded.includes('web_image_dropped'));
  assert.equal(degraded.includes('web_image_dropped'), false);
});

test('A-06 Web widget artist card keeps link actions as links', () => {
  const { blocks } = toWebWidget(planCards({ channel: 'web', context: 'greeting', config: artist(), imageHosts: ['cdn.example.vn'] }), { imageOrigins: ['https://cdn.example.vn'] });
  const card = blocks.find((b) => b.type === 'card');
  assert.equal(card.image, 'https://cdn.example.vn/cover.jpg');
  assert.deepEqual(card.actions.map((a) => a.kind), ['link', 'action', 'action']);
});

test('A-07 Zalo text fallback keeps every action as a numbered choice', () => {
  const z = toZaloText(browse('messenger'));
  assert.match(z.text, /1\. Xem A001/);
  assert.equal(z.numberMap['4'], 'T404:C:catalog:7:0a1b2c3d:2');
});

test('A-08 same plan on every channel exposes the same action payloads (sync across channels)', () => {
  const pay = (arr) => [...new Set(arr)].sort();
  const m = browse('messenger');
  const fromMessenger = pay(JSON.stringify(m.messages).match(/(TIEN404|T404):[A-Za-z0-9:_]+/g));
  const fromTelegram = pay(kbFlat(toTelegram(browse('telegram')).calls[0]).map((b) => b.callback_data));
  const fromWeb = pay(JSON.stringify(toWebWidget(browse('web')).blocks).match(/(TIEN404|T404):[A-Za-z0-9:_]+/g));
  const fromZalo = pay(Object.values(toZaloText(m).numberMap));
  assert.deepEqual(fromTelegram, fromMessenger);
  assert.deepEqual(fromWeb, fromMessenger);
  assert.deepEqual(fromZalo, fromMessenger);
  assert.equal(adaptPlan(m, 'messenger').messages, m.messages);
});

const PAGE = '2379295362359912', APP = '1637989744444198', PSID = '4422525834444451';
test('W-01 webhook classifier: customer turns may reply; non-turn events never reply', () => {
  const ctx = { pageId: PAGE, appId: APP };
  const s = { sender: { id: PSID }, recipient: { id: PAGE }, timestamp: 1 };
  assert.equal(classifyMessengerEvent({ ...s, message: { mid: 'm', text: 'hi' } }, ctx).reply, true);
  assert.equal(classifyMessengerEvent({ ...s, postback: { payload: 'T404:M:catalog' } }, ctx).kind, 'postback');
  for (const ev of [{ read: { watermark: 1 } }, { delivery: { mids: [] } }, { reaction: { reaction: 'love', action: 'react' } },
    { policy_enforcement: { action: 'block', reason: 'x' } }, { pass_thread_control: {} }, { take_thread_control: {} }, { message_edit: {} }]) {
    assert.equal(classifyMessengerEvent({ ...s, ...ev }, ctx).reply, false, Object.keys(ev)[0]);
  }
  assert.equal(classifyMessengerEvent({ ...s, message: { text: 'x' } }, { ...ctx, standby: true }).kind, 'standby');
});
test('W-02 echoes: own app echo ignored, staff reply from Inbox pauses the bot for that customer', () => {
  const echo = (app) => ({ sender: { id: PAGE }, recipient: { id: PSID }, timestamp: 1, message: { is_echo: true, mid: 'm', text: 'ok', ...(app ? { app_id: app } : {}) } });
  assert.equal(classifyMessengerEvent(echo(APP), { pageId: PAGE, appId: APP }).action, 'ignore');
  const staff = classifyMessengerEvent(echo(null), { pageId: PAGE, appId: APP });
  assert.equal(staff.action, 'pause_bot_for_thread');
  assert.equal(staff.customer, PSID);
});
test('W-03 opt-in token: stored server-side, never surfaced; STOP revokes', () => {
  const s = { sender: { id: PSID }, recipient: { id: PAGE }, timestamp: 1 };
  const yes = classifyMessengerEvent({ ...s, optin: { type: 'notification_messages', payload: 'restock:A011', notification_messages_token: 'SECRET', token_expiry_timestamp: 2 } }, { pageId: PAGE });
  assert.equal(yes.action, 'store_token_server_side');
  assert.equal(JSON.stringify(yes).includes('SECRET'), false);
  const stop = classifyMessengerEvent({ ...s, optin: { type: 'notification_messages', notification_messages_status: 'STOP NOTIFICATIONS' } }, { pageId: PAGE });
  assert.equal(stop.action, 'revoke_token');
  assert.ok(RECOMMENDED_FIELDS.filter((f) => f.status === 'add').length === 3);
});
