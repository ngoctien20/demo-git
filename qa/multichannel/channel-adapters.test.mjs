import test from 'node:test';
import assert from 'node:assert/strict';
import * as A from '../../channels/lib/channel-adapters.mjs';

const NOW = Date.UTC(2026, 10, 22, 1, 0, 0);
const tgMsg = (text, extra = {}) => ({ update_id: 1001, message: { message_id: 5, date: NOW / 1000, chat: { id: 777001, type: 'private' }, from: { id: 777001, is_bot: false }, text, ...extra } });

test('detectSku keeps the live Messenger rule', () => {
  assert.equal(A.detectSku('Xem A003'), 'A003');
  assert.equal(A.detectSku('a011 con ko'), 'A011');
  assert.equal(A.detectSku('A003 giá bao nhiêu?'), 'A003');
  assert.equal(A.detectSku('so sánh A003 với A005'), null);
  assert.equal(A.detectSku('A003 màu đen size M có không'), null);
});

test('telegram private text -> core request with channel-scoped session', () => {
  const [r] = A.normalizeTelegram(tgMsg('áo khoác nam dưới 300k'), { botId: '999', now: NOW });
  assert.equal(r.channel, 'telegram');
  assert.equal(r.sessionId, 'telegram:999:777001');
  assert.equal(r.messageId, 'tg_1001');
  assert.equal(r.mediaType, 'text');
  assert.equal(r.text, 'áo khoác nam dưới 300k');
});

test('telegram single-SKU text uses fast path', () => {
  const [r] = A.normalizeTelegram(tgMsg('xem a003'), { botId: '999', now: NOW });
  assert.equal(r.mediaType, 'product_detail');
  assert.equal(r.selectedSku, 'A003');
  assert.equal(r.fastPath, 'text');
});

test('telegram /start becomes greeting prompt', () => {
  const [r] = A.normalizeTelegram(tgMsg('/start'), { now: NOW });
  assert.equal(r.mediaType, 'postback');
  assert.match(r.text, /Bắt đầu trò chuyện/);
});

test('telegram ignores groups, bots, stale and oversize messages', () => {
  assert.deepEqual(A.normalizeTelegram({ update_id: 1, message: { date: NOW / 1000, chat: { id: -100, type: 'group' }, from: {}, text: 'hi' } }, { now: NOW }), []);
  assert.deepEqual(A.normalizeTelegram(tgMsg('hi', { from: { id: 1, is_bot: true } }), { now: NOW }), []);
  assert.deepEqual(A.normalizeTelegram(tgMsg('hi', { date: NOW / 1000 - 24 * 3600 }), { now: NOW }), []);
  assert.deepEqual(A.normalizeTelegram(tgMsg('x'.repeat(1801)), { now: NOW }), []);
  assert.deepEqual(A.normalizeTelegram({ update_id: 'x' }), []);
});

test('telegram photo asks for text description, never pretends to see it', () => {
  const [r] = A.normalizeTelegram(tgMsg(undefined, { photo: [{ file_id: 'f' }] }), { now: NOW });
  assert.equal(r.mediaType, 'image');
  assert.match(r.text, /Không giả vờ đã xem/);
});

test('telegram callback button TIEN404:VIEW:SKU -> postback fast path; other data ignored', () => {
  const cb = (data) => ({ update_id: 2, callback_query: { id: 'cq1', data, from: { id: 777001 }, message: { chat: { id: 777001, type: 'private' } } } });
  const [r] = A.normalizeTelegram(cb('TIEN404:VIEW:A008'), { botId: '999' });
  assert.equal(r.selectedSku, 'A008');
  assert.equal(r.fastPath, 'postback');
  assert.equal(r.callbackQueryId, 'cq1');
  assert.deepEqual(A.normalizeTelegram(cb('TIEN404:ADMIN:DROP')), []);
});

test('web widget validates origin, session and length', () => {
  const cfg = { siteId: 'shop-a', allowedOrigins: ['https://ngoctien20.github.io'], origin: 'https://ngoctien20.github.io', now: NOW };
  const ok = A.normalizeWeb({ action: 'sendMessage', sessionId: 'abcdefgh12345678', chatInput: ' Xem A003 ' }, cfg);
  assert.equal(ok.ok, true);
  assert.equal(ok.request.sessionId, 'web:shop-a:abcdefgh12345678');
  assert.equal(ok.request.selectedSku, 'A003');
  assert.deepEqual(A.normalizeWeb({ sessionId: 'abcdefgh12345678', chatInput: 'hi' }, { ...cfg, origin: 'https://evil.example' }).errors, ['origin_not_allowed']);
  assert.ok(A.normalizeWeb({ sessionId: 'short', chatInput: 'hi' }, cfg).errors.includes('bad_session'));
  assert.ok(A.normalizeWeb({ sessionId: 'abcdefgh12345678', chatInput: 'x'.repeat(501) }, cfg).errors.includes('text_too_long'));
  assert.ok(A.normalizeWeb({ sessionId: 'abcdefgh12345678:other', chatInput: 'hi' }, cfg).errors.includes('bad_session'));
});

test('instagram: only own account, no echoes, postback + quick reply payloads', () => {
  const payload = { object: 'instagram', entry: [
    { id: '1784', messaging: [
      { sender: { id: '55555' }, recipient: { id: '1784' }, timestamp: NOW, message: { mid: 'm1', text: 'còn size M không shop' } },
      { sender: { id: '1784' }, recipient: { id: '55555' }, timestamp: NOW, message: { mid: 'm2', text: 'echo', is_echo: true } },
      { sender: { id: '55555' }, recipient: { id: '1784' }, timestamp: NOW, postback: { mid: 'm3', payload: 'TIEN404:VIEW:A002' } },
      { sender: { id: '55555' }, recipient: { id: '1784' }, timestamp: NOW, message: { mid: 'm1', text: 'dup' } },
    ] },
    { id: 'other', messaging: [{ sender: { id: '55555' }, recipient: { id: 'other' }, timestamp: NOW, message: { mid: 'x', text: 'hi' } }] },
  ] };
  const out = A.normalizeInstagram(payload, { igAccountId: '1784', now: NOW });
  assert.equal(out.length, 2);
  assert.equal(out[0].sessionId, 'instagram:1784:55555');
  assert.equal(out[1].selectedSku, 'A002');
  assert.deepEqual(A.normalizeInstagram({ object: 'page', entry: [] }, { igAccountId: '1784' }), []);
});

test('reply-count rule: never more than 3 messages on any channel', () => {
  const long = Array.from({ length: 40 }, (_, i) => 'Dòng ' + i + ' ' + 'x'.repeat(300)).join('\n');
  assert.ok(A.composeTelegram({ replyText: long }, 1).length <= 3);
  assert.ok(A.composeWeb({ replyText: long }).messages.length <= 3);
  assert.ok(A.composeInstagram({ replyText: long }, '1').length <= 3);
  assert.equal(A.composeTelegram({ replyText: 'Dạ còn ạ' }, 1).length, 1);
});

test('telegram compose: HTML-safe, bold kept, SKU buttons on last message only', () => {
  const msgs = A.composeTelegram({ replyText: 'Shop gợi ý:\n- **A002** Áo <đen> 250.000đ\n- A008 Áo trắng & xám', source: 'ai' }, 42);
  assert.equal(msgs.length, 1);
  assert.match(msgs[0].text, /<b>A002<\/b> Áo &lt;đen&gt;/);
  assert.match(msgs[0].text, /trắng &amp; xám/);
  assert.deepEqual(msgs[0].reply_markup.inline_keyboard[0].map((b) => b.callback_data), ['TIEN404:VIEW:A002', 'TIEN404:VIEW:A008']);
  assert.equal(A.composeTelegram({ replyText: 'A003 — Áo | 1đ', source: 'fast_path' }, 42)[0].reply_markup, undefined);
});

test('web compose returns output + quick replies', () => {
  const w = A.composeWeb({ replyText: '- A002 áo đen\n- A008 áo trắng', source: 'ai' });
  assert.equal(w.messages.length, 1);
  assert.deepEqual(w.quickReplies.map((q) => q.text), ['Xem A002', 'Xem A008']);
});

test('formatProduct mirrors Messenger fast path and never invents data', () => {
  assert.equal(A.formatProduct('A003', [{ sku: 'A003', name: 'Áo thun', price: 199000, stock: 4 }]), 'A003 — Áo thun | ' + (199000).toLocaleString('vi-VN') + 'đ/cái. Còn 4 cái.');
  assert.match(A.formatProduct('A011', [{ sku: 'A011', name: 'Áo', price: '150000', stock: '0' }]), /hết hàng/);
  assert.match(A.formatProduct('A999', []), /chưa tìm thấy/);
  assert.match(A.formatProduct('A003', [{ sku: 'A003', name: 'Áo', price: '1.2tr', stock: 3 }]), /chưa xác minh/);
});
