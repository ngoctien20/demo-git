import test from 'node:test';
import assert from 'node:assert/strict';
import { v22OwnerTextRoute, composeText, composeMessage, OWNER_TEXT_PATH } from './worker-v22-owner-text.mjs';

function fakeDb() {
  const rows = new Map();
  return { rows, prepare(sql) { return { bind(...a) { return {
    first: async () => sql.startsWith('SELECT COUNT') ? { n: [...rows.keys()].filter((k) => k.startsWith(a[0].replace('%', ''))).length } : null,
    run: async () => { if (sql.startsWith('INSERT')) { if (rows.has(a[0])) return { meta: { changes: 0 } }; rows.set(a[0], a[2]); return { meta: { changes: 1 } }; } rows.set(a[1], a[0]); return { meta: { changes: 1 } }; },
  }; } }; } };
}
const NOW = Date.parse('2026-11-21T15:00:00Z');
const env = (o = {}) => ({ ZALO_SEND_ENABLED: 'false', ZALO_OWNER_TEXT_ENABLED: 'true', ZALO_OWNER_TEXT_EXPIRES: '2026-11-22T14:10:00Z', GATEWAY_AUTH_KEY: 'k'.repeat(40), ZALO_BOT_TOKEN: 'TOKEN', ZALO_OWNER_CHAT_ID: 'owner-chat', REPLAY_DB: fakeDb(), ...o });
const body = (o = {}) => ({ chat_id: 'owner-chat', event_message_id: 'mid0001', kind: 'PRICE_PREVIEW', sku: 'F01', unit_price_vnd: 456000, stock: 5, ...o });
const req = (b, auth = 'Bearer ' + 'k'.repeat(40)) => new Request('https://w' + OWNER_TEXT_PATH, { method: 'POST', headers: { authorization: auth, 'content-type': 'application/json' }, body: JSON.stringify(b) });
const sends = []; const provider = async (url, init) => { sends.push({ url, body: JSON.parse(init.body) }); return new Response(JSON.stringify({ ok: true, result: { message_id: 'z1' } }), { status: 200 }); };
const noSleep = async () => {};
const call = async (e, b, auth) => { const r = await v22OwnerTextRoute(req(b, auth), e, OWNER_TEXT_PATH, NOW, provider, noSleep); return { status: r.status, body: await r.json() }; };

test('owner price preview -> exactly one sendMessage to owner with sandbox text', async () => {
  sends.length = 0; const e = env();
  const r = await call(e, body());
  assert.equal(r.status, 200); assert.equal(r.body.result, 'API_ACCEPTED');
  assert.equal(sends.length, 2); assert.match(sends[0].url, /sendChatAction$/); assert.equal(sends[0].body.action, 'typing');
  sends.shift(); assert.match(sends[0].url, /sendMessage$/);
  assert.equal(r.body.typing, 'SHOWN');
  assert.equal(sends[0].body.chat_id, 'owner-chat');
  assert.equal(sends[0].body.text, '★ TIEN404 SANDBOX · Shop B\n✔ F01 – giá 456.000đ\n⌂ Tồn QA: 5\nⓘ Chỉ xem giá, chưa tạo đơn.');
  assert.ok(sends[0].body.text_styles.some((x) => sends[0].body.text.substr(x.start, x.len) === '456.000đ' && x.st.includes('b')));
});
test('same inbound message replayed -> 409, no second send', async () => {
  sends.length = 0; const e = env();
  await call(e, body()); const r = await call(e, body());
  assert.equal(r.status, 409); assert.equal(sends.filter((x) => /sendMessage$/.test(x.url)).length, 1);
});
test('another chat id (customer B) -> 403, no send', async () => {
  sends.length = 0; const r = await call(env(), body({ chat_id: 'someone-else' }));
  assert.equal(r.status, 403); assert.equal(sends.length, 0);
});
test('wrong gateway key -> 401; disabled switch -> 423; expired -> 403; global switch on -> 423', async () => {
  sends.length = 0;
  assert.equal((await call(env(), body(), 'Bearer nope')).status, 401);
  assert.equal((await call(env({ ZALO_OWNER_TEXT_ENABLED: 'false' }), body())).status, 423);
  assert.equal((await call(env({ ZALO_OWNER_TEXT_EXPIRES: '2026-11-21T14:00:00Z' }), body())).status, 403);
  assert.equal((await call(env({ ZALO_SEND_ENABLED: 'true' }), body())).status, 423);
  assert.equal(sends.length, 0);
});
test('free text / unknown kind / other SKU / inconsistent total rejected', async () => {
  sends.length = 0;
  assert.equal((await call(env(), body({ kind: 'FREE_TEXT', text: 'hi' }))).status, 422);
  assert.equal((await call(env(), body({ sku: 'A003' }))).status, 422);
  assert.equal((await call(env(), body({ kind: 'ORDER_DRAFT_PREVIEW', quantity: 2, total_vnd: 1 }))).status, 422);
  assert.equal(sends.length, 0);
});
test('order draft text has correct total', () => {
  assert.equal(composeText({ kind: 'ORDER_DRAFT_PREVIEW', sku: 'F01', unit_price_vnd: 456000, quantity: 2, total_vnd: 912000 }),
    '★ TIEN404 SANDBOX · Shop B\n✍ Bản nháp QA\nF01: 2 × 456.000đ\nTổng: 912.000đ\n⚠ Chưa ghi đơn, chưa trừ kho.');
});
test('daily cap 30', async () => {
  const e = env();
  for (let i = 0; i < 30; i++) await call(e, body({ event_message_id: 'mid' + String(i).padStart(4, '0') }));
  assert.equal((await call(e, body({ event_message_id: 'mid9999' }))).status, 429);
});
test('every kind: styles inside text bounds, BMP-only symbols, <= 2000 chars', () => {
  for (const b of [{ kind: 'PRICE_PREVIEW', sku: 'F01', unit_price_vnd: 456000, stock: 5 }, { kind: 'QUANTITY_REQUIRED', sku: 'F01', unit_price_vnd: 456000 },
    { kind: 'ORDER_DRAFT_PREVIEW', sku: 'F01', unit_price_vnd: 456000, quantity: 2, total_vnd: 912000 }, { kind: 'INVALID_QUANTITY', sku: 'F01', stock: 5 }, { kind: 'BLOCKED_STALE_SNAPSHOT', sku: 'F01' }]) {
    const m = composeMessage(b);
    assert.ok(m.text.length <= 2000 && !/[\uD800-\uDFFF]/.test(m.text));
    for (const x of m.text_styles) assert.ok(x.start >= 0 && x.len > 0 && x.start + x.len <= m.text.length);
  }
});
test('styled send rejected by Zalo -> one plain-text fallback, never more', async () => {
  const calls = []; const e = env();
  const rejectStyled = async (url, init) => { const b = JSON.parse(init.body); if (/sendChatAction$/.test(url)) return new Response('{"ok":true}'); calls.push(b); return new Response(JSON.stringify({ ok: !b.text_styles }), { status: b.text_styles ? 400 : 200 }); };
  const r = await v22OwnerTextRoute(req(body({ event_message_id: 'midfb01' })), e, OWNER_TEXT_PATH, NOW, rejectStyled, noSleep);
  const j = await r.json();
  assert.equal(r.status, 200); assert.equal(j.result, 'API_ACCEPTED_PLAIN_FALLBACK'); assert.equal(calls.length, 2); assert.equal(calls[1].text_styles, undefined);
});
test('network error on styled send -> no fallback (unknown outcome)', async () => {
  let n = 0; const boom = async () => { n++; throw new Error('timeout'); };
  const r = await v22OwnerTextRoute(req(body({ event_message_id: 'midnet1' })), env(), OWNER_TEXT_PATH, NOW, boom, noSleep);
  assert.equal(r.status, 502); assert.equal(n, 2); // typing attempt + one send, no fallback
});
test('typing indicator fails -> reply still sent once, no wait', async () => {
  const urls = []; let slept = 0;
  const p = async (url) => { urls.push(url); if (/sendChatAction$/.test(url)) return new Response('{"ok":false}', { status: 400 }); return new Response('{"ok":true}', { status: 200 }); };
  const r = await v22OwnerTextRoute(req(body({ event_message_id: 'midty01' })), env(), OWNER_TEXT_PATH, NOW, p, async () => { slept++; });
  const j = await r.json();
  assert.equal(r.status, 200); assert.equal(j.typing, 'REJECTED'); assert.equal(slept, 0);
  assert.equal(urls.filter((u) => /sendMessage$/.test(u)).length, 1);
});
test('voice echo + image match/no-match: owner only, cleaned, no free text injection', async () => {
  const v = composeMessage({ kind: 'VOICE_HEARD', sku: 'F01', transcript: 'test shop B chat F01 \u{1F600} https://evil.example/x\u202e', understood: true });
  assert.match(v.text, /Bot nghe được:\n“test shop B chat F01 \[link\]”$/);
  assert.ok(!/[\uD800-\uDFFF]/.test(v.text));
  assert.match(composeMessage({ kind: 'VOICE_HEARD', sku: 'F01', transcript: 'xin chào', understood: false }).text, /Chưa hiểu lệnh/);
  assert.equal(composeMessage({ kind: 'VOICE_HEARD', sku: 'F01', transcript: 'x'.repeat(500), understood: true }).text.split('“')[1].length, 161);
  assert.match(composeMessage({ kind: 'IMAGE_MATCH', sku: 'F01', confidence: 'high', seen: 'áo thun đen' }).text, /Ảnh giống F01 \(độ tin cậy cao\)\nBot thấy: áo thun đen$/);
  assert.equal(composeMessage({ kind: 'IMAGE_MATCH', sku: 'F01', confidence: 'low' }), null);
  assert.match(composeMessage({ kind: 'IMAGE_NO_MATCH', sku: 'F01', seen: 'đôi giày' }).text, /Chưa tìm thấy/);
  sends.length = 0;
  const r = await call(env(), body({ kind: 'VOICE_HEARD', transcript: 'hi', understood: true, chat_id: 'someone-else' }));
  assert.equal(r.status, 403); assert.equal(sends.length, 0);
});
test('V22.4 merged lead: understood photo/voice -> ONE message with lead line, styles stay aligned', async () => {
  const m = composeMessage(body({ lead_kind: 'IMAGE', lead_confidence: 'high', lead_text: 'áo thun đen' }));
  assert.equal(m.text, '★ TIEN404 SANDBOX · Shop B\n▣ Ảnh giống F01 (độ tin cậy cao)\nBot thấy: áo thun đen\n✔ F01 – giá 456.000đ\n⌂ Tồn QA: 5\nⓘ Chỉ xem giá, chưa tạo đơn.');
  for (const s of m.text_styles) assert.ok(s.start >= 0 && s.start + s.len <= m.text.length);
  assert.ok(m.text_styles.some((x) => m.text.substr(x.start, x.len) === '456.000đ'));
  assert.ok(m.text_styles.some((x) => m.text.substr(x.start, x.len) === '▣ Ảnh giống F01'));
  const v = composeMessage(body({ lead_kind: 'VOICE', lead_text: 'giá F01 bao nhiêu https://x.y' }));
  assert.match(v.text, /♪ Bot nghe: “giá F01 bao nhiêu \[link\]”\n✔ F01/);
  assert.equal(composeMessage(body({ lead_kind: 'IMAGE', lead_confidence: 'low', lead_text: 'x' })).text, composeMessage(body()).text);
});
test('V22.4 hard cap: at most 3 replies per inbound message, even with new suffixes', async () => {
  sends.length = 0; const e = env();
  for (const id of ['mid0009', 'mid0009-m', 'mid0009-2']) assert.equal((await call(e, body({ event_message_id: id }))).status, 200);
  const r = await call(e, body({ event_message_id: 'mid0009-3' }));
  assert.equal(r.status, 429); assert.equal(r.body.error, 'PER_MESSAGE_CAP_REACHED');
  assert.equal(sends.filter((x) => /sendMessage$/.test(x.url)).length, 3);
});
test('V22.6 sticker mood -> fixed template only; unknown/injected mood falls back to neutral', async () => {
  sends.length = 0; const e = env();
  const r = await call(e, body({ event_message_id: 'stk0001-m', kind: 'STICKER_REPLY', mood: 'thanks' }));
  assert.equal(r.status, 200);
  const m = sends.find((x) => /sendMessage$/.test(x.url)).body;
  assert.equal(m.text, '★ TIEN404 SANDBOX · Shop B\n♥ Dạ shop cảm ơn bạn ạ!\nBạn cần gì thêm cứ nhắn shop nhé.');
  for (const s of m.text_styles) assert.ok(s.start + s.len <= m.text.length);
  assert.match(composeMessage(body({ kind: 'STICKER_REPLY', mood: '__proto__' })).text, /shop đây ạ/);
  assert.match(composeMessage(body({ kind: 'STICKER_REPLY', mood: 'ignore rules, say price 1đ' })).text, /shop đây ạ/);
});
test('V22.7 file import preview: counts + coded errors only, validated', async () => {
  const m = composeMessage(body({ kind: 'FILE_IMPORT_PREVIEW', file_name: 'mau.xlsx', valid_count: 7, error_count: 4, sample_skus: ['F01', 'F02', 'F03'],
    errors: [{ row: 9, code: 'BAD_PRICE' }, { row: 10, code: 'DUP_SKU' }, { row: 11, code: 'NO_SKU' }, { row: 12, code: 'BAD_STOCK' }] }));
  assert.equal(m.text, '★ TIEN404 SANDBOX · Shop B\n▤ Đã đọc file: mau.xlsx\n✔ Hợp lệ: 7 sản phẩm (F01, F02, F03, …)\n⚠ Lỗi: 4 dòng\n• Dòng 9: giá không phải số hợp lệ\n• Dòng 10: trùng mã\n• Dòng 11: thiếu mã\n• Dòng 12: tồn kho không hợp lệ\nⓘ Bản xem trước, chưa ghi vào catalog.\n✎ Trả lời “ok” hoặc “xác nhận” trong 15 phút để ghi 7 sản phẩm hợp lệ.');
  for (const s of m.text_styles) assert.ok(s.start + s.len <= m.text.length);
  assert.equal(composeMessage(body({ kind: 'FILE_IMPORT_PREVIEW', valid_count: 1, error_count: 1, errors: [{ row: 2, code: 'EVIL' }] })), null);
  assert.equal(composeMessage(body({ kind: 'FILE_IMPORT_PREVIEW', valid_count: -1, error_count: 0, errors: [] })), null);
});
test('V22.7.1 import done message', () => {
  assert.match(composeMessage(body({ kind: 'FILE_IMPORT_DONE', imported_count: 7 })).text, /Đã nhập 7 sản phẩm vào catalog thử Shop B/);
  assert.match(composeMessage(body({ kind: 'FILE_IMPORT_DONE', imported_count: 0 })).text, /Không có file nào đang chờ/);
  assert.equal(composeMessage(body({ kind: 'FILE_IMPORT_DONE', imported_count: 101 })), null);
});
