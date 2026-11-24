// V27 Context Card Planner — offline, synthetic configs only. No Meta/n8n/Sheet I/O.
import test from 'node:test';
import assert from 'node:assert/strict';
import { planCards, validMessage, clipCp, imageAllowed } from '../lib/context-card-planner.mjs';
import { templateConfig } from '../lib/templates.mjs';

const shop = () => templateConfig('shop');
const artist = () => {
  const c = templateConfig('artist');
  c.menu = c.menu.map((m) => (m.id === 'music' ? { ...m, enabled: true, action_config: { url: 'https://www.youtube.com/@demo-artist' } } : m));
  c.profile = { card_title: 'Khám phá âm nhạc', cover_image_url: 'https://cdn.example.vn/cover.jpg' };
  return c;
};
const rows = (n) => Array.from({ length: n }, (_, i) => {
  const k = 'A' + String(i + 2).padStart(3, '0');
  return { key: k, title: k + ' — Mẫu sản phẩm', subtitle: '159.000đ | Còn 18', payload: 'TIEN404:VIEW:' + k };
});
const QR_NEXT = [{ content_type: 'text', title: 'Trang tiếp', payload: 'T404:C:catalog:7:0a1b2c3d:2' }];
const kinds = (p) => p.messages.map((m) => m.attachment?.payload?.template_type ?? (m.quick_replies ? 'text+qr' : 'text'));

test('P-01 mock-up 01: shop greeting -> quick replies (nút ngang), no link items', () => {
  const p = planCards({ channel: 'messenger', context: 'greeting', config: shop(), text: 'Chào bạn! Mình có thể hỗ trợ gì cho bạn?' });
  assert.equal(p.kind, 'quick_replies');
  assert.deepEqual(p.messages[0].quick_replies.map((q) => q.title), ['Xem sản phẩm', 'Tra cứu đơn hàng', 'Gặp nhân viên']);
  assert.ok(p.messages[0].quick_replies.every((q) => q.payload.startsWith('T404:M:')));
});

test('P-02 mock-up 02: 3 products -> carousel + text with Trang tiếp (2 messages)', () => {
  const p = planCards({ channel: 'messenger', context: 'browse', config: shop(), rows: rows(3), pageControls: QR_NEXT, text: 'Đây là các mẫu bạn có thể tham khảo.' });
  assert.equal(p.kind, 'carousel');
  assert.deepEqual(kinds(p), ['generic', 'text+qr']);
  assert.deepEqual(p.messages[0].attachment.payload.elements.map((e) => e.buttons[0].title), ['Xem A002', 'Xem A003', 'Xem A004']);
});

test('P-03 mock-up 03: product detail -> vertical buttons on the message', () => {
  const p = planCards({ channel: 'messenger', context: 'detail', config: shop(),
    text: 'Thông tin mẫu A002\nBạn muốn xem thêm thông tin hay đặt mẫu này?',
    actions: [{ title: 'Đặt sản phẩm', payload: 'TIEN404:QR:1' }, { title: 'Xem mẫu tương tự', payload: 'TIEN404:QR:2' }] });
  assert.equal(p.kind, 'button_card');
  assert.equal(p.messages.length, 1);
  assert.equal(p.messages[0].attachment.payload.buttons.length, 2);
});

test('P-04 mock-up 04: artist greeting -> content card with link + profile + manager, no sales buttons', () => {
  const p = planCards({ channel: 'messenger', context: 'greeting', config: artist(), imageHosts: ['cdn.example.vn'] });
  assert.equal(p.kind, 'content_card');
  const el = p.messages.at(-1).attachment.payload.elements[0];
  assert.equal(el.title, 'Khám phá âm nhạc');
  assert.equal(el.image_url, 'https://cdn.example.vn/cover.jpg');
  assert.deepEqual(el.buttons.map((b) => [b.type, b.title]),
    [['web_url', 'Nghe nhạc'], ['postback', 'Thông tin nghệ sĩ'], ['postback', 'Liên hệ quản lý']]);
  const all = JSON.stringify(p.messages);
  assert.ok(!/Xem sản phẩm|TIEN404:VIEW|Đặt/.test(all));
});

test('P-05 artist Page asked to browse a catalog -> text, never shop cards', () => {
  const p = planCards({ channel: 'messenger', context: 'browse', config: artist(), rows: rows(3) });
  assert.equal(p.kind, 'text');
  assert.ok(p.degraded.includes('no_catalog_action'));
  assert.ok(!JSON.stringify(p).includes('generic'));
});

test('P-06 artist image host not allowlisted -> card kept, image dropped', () => {
  const p = planCards({ channel: 'messenger', context: 'greeting', config: artist(), imageHosts: [] });
  assert.equal(p.kind, 'content_card');
  assert.equal(p.messages.at(-1).attachment.payload.elements[0].image_url, undefined);
  assert.ok(p.degraded.includes('image_dropped'));
});

test('P-07 artist with playlist link disabled -> plain quick replies (no link needed)', () => {
  const c = templateConfig('artist'); // music + youtube disabled placeholders
  const p = planCards({ channel: 'messenger', context: 'greeting', config: c });
  assert.equal(p.kind, 'quick_replies');
  assert.deepEqual(p.messages[0].quick_replies.map((q) => q.title), ['Thông tin nghệ sĩ', 'Liên hệ quản lý']);
});

test('P-08 browse fallbacks: 1 row -> button card, 0 rows -> text', () => {
  assert.equal(planCards({ channel: 'messenger', context: 'browse', config: shop(), rows: rows(1) }).kind, 'button_card');
  assert.equal(planCards({ channel: 'messenger', context: 'browse', config: shop(), rows: [] }).kind, 'text');
});

test('P-09 invalid carousel (title too long after clip impossible / bad payload) degrades to button card', () => {
  const bad = rows(3).map((r) => ({ ...r, payload: 'x'.repeat(1001) }));
  const p = planCards({ channel: 'messenger', context: 'browse', config: shop(), rows: bad });
  assert.notEqual(p.kind, 'carousel');
  assert.ok(p.degraded.includes('carousel:invalid'));
  assert.ok(p.messages.every(validMessage));
});

test('P-10 text-only channels (Zalo Bot/OA, Telegram) -> numbered text, same actions', () => {
  for (const ch of ['zalo_bot', 'zalo_oa', 'telegram']) {
    const g = planCards({ channel: ch, context: 'greeting', config: shop(), text: 'Chào bạn!' });
    assert.equal(g.kind, 'text');
    assert.match(g.messages[0].text, /1\. Xem sản phẩm/);
    const b = planCards({ channel: ch, context: 'browse', config: shop(), rows: rows(3) });
    assert.match(b.messages[0].text, /A002 — Mẫu sản phẩm/);
  }
});

test('P-11 handoff -> plain text only; order inquiry -> at most one action', () => {
  const h = planCards({ channel: 'messenger', context: 'handoff', config: shop(), text: 'Nhân viên sẽ trả lời bạn sớm.' });
  assert.equal(h.kind, 'text');
  assert.equal(h.messages[0].quick_replies, undefined);
  const o = planCards({ channel: 'messenger', context: 'order_inquiry', config: shop(), text: 'Cần xác minh số điện thoại đặt hàng.',
    actions: [{ title: 'Xác minh', payload: 'T404:M:order_lookup' }, { title: 'Gặp nhân viên', payload: 'T404:M:handoff' }] });
  assert.equal(o.messages[0].attachment.payload.buttons.length, 1);
});

test('P-12 every planned output respects Meta limits and the 3-message cap', () => {
  const long = 'Ố'.repeat(3000);
  const cases = [
    { context: 'greeting', config: shop(), text: long },
    { context: 'browse', config: shop(), rows: rows(12), text: long, pageControls: QR_NEXT },
    { context: 'detail', config: shop(), text: long, actions: [{ title: 'Đặt sản phẩm ngay hôm nay nhé', payload: 'a' }] },
    { context: 'greeting', config: artist(), text: long, imageHosts: ['cdn.example.vn'] },
  ];
  for (const c of cases) {
    const p = planCards({ channel: 'messenger', ...c });
    assert.ok(p.messages.length >= 1 && p.messages.length <= 3, c.context);
    assert.ok(p.messages.every(validMessage), c.context + ' ' + p.kind);
    assert.ok(p.messages.slice(0, -1).every((m) => !m.quick_replies), 'quick replies only on last message');
  }
  const b = planCards({ channel: 'messenger', context: 'browse', config: shop(), rows: rows(12) });
  assert.equal(b.messages[0].attachment.payload.elements.length, 10);
});

test('P-13 clipCp never splits an emoji; imageAllowed is https + allowlist only', () => {
  const s = 'x'.repeat(78) + '👕👕';
  const c = clipCp(s, 79);
  assert.ok(!/[\uD800-\uDBFF]$/.test(c.slice(0, -1)));
  assert.equal([...c].length, 79);
  assert.equal(imageAllowed('https://cdn.example.vn/a.jpg', ['cdn.example.vn']), true);
  assert.equal(imageAllowed('http://cdn.example.vn/a.jpg', ['cdn.example.vn']), false);
  assert.equal(imageAllowed('https://evil.example/a.jpg', ['cdn.example.vn']), false);
  assert.equal(imageAllowed('javascript:alert(1)', ['cdn.example.vn']), false);
});
