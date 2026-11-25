// V27.8 Demo page sales bot (assets/shop-demo): pure bot + shared renderer copies. Offline, synthetic.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { greeting, reply, DEMO_PRODUCTS } from '../../assets/shop-demo/shop-bot.mjs';
import { normalizeCardStyle } from '../lib/card-style.mjs';

const root = new URL('../../', import.meta.url);
const style = normalizeCardStyle({}).style;
const payloads = (blocks) => blocks.flatMap((b) => [...(b.actions ?? []), ...(b.items ?? []).flatMap((i) => i.actions ?? []), ...(b.type === 'card' ? b.actions : [])]).map((a) => a.payload);

test('D-01 copies on the Demo page are identical to config-core (no drift)', () => {
  execFileSync(process.execPath, [new URL('scripts/sync-shop-demo.mjs', root).pathname, '--check']);
});

test('D-02 catalog pages of 3 with Trang tiếp/Trang trước; prices match Sheet mirror', () => {
  const p1 = reply('CATALOG:1', style);
  assert.equal(p1[0].type, 'carousel'); assert.equal(p1[0].items.length, 3);
  assert.equal(p1[0].items[0].badge, 'Bán chạy');
  assert.equal(p1[0].items[0].subtitle, '245.000đ (giá cũ 299.000đ) · Chỉ còn 5', 'badge drawn on photo, not repeated in text');
  assert.deepEqual(payloads(p1).filter((x) => x.startsWith('CATALOG')), ['CATALOG:2']);
  const p3 = reply('CATALOG:3', style);
  assert.equal(p3[0].type, 'card', 'last page has 1 item');
  assert.deepEqual(payloads(p3).filter((x) => x.startsWith('CATALOG')), ['CATALOG:2']);
  assert.equal(reply('CATALOG:99', style)[1].text, 'Sản phẩm · trang 3/3 · 7 mẫu');
});

test('D-03 order flow never exceeds stock and never creates a real order', () => {
  assert.deepEqual(payloads(reply('ORDER:A001', style)), ['QTY:A001:1', 'QTY:A001:2', 'QTY:A001:3']);
  assert.match(reply('QTY:A001:2', style)[0].text, /A001 × 2 = 490\.000đ[\s\S]*không tạo đơn thật/);
  assert.match(reply('QTY:A001:9', style)[0].text, /chỉ còn 5/);
  const src = readFileSync(new URL('assets/shop-demo/shop-bot.mjs', root), 'utf8') + readFileSync(new URL('assets/shop-demo/shop-demo.js', root), 'utf8') + readFileSync(new URL('assets/shop-demo/shop-demo.bundle.js', root), 'utf8');
  assert.doesNotMatch(src, /\bfetch\(|XMLHttpRequest|sendBeacon|\.innerHTML\s*=/);
});

test('D-04 free text: SKU, product type, unknown SKU not invented, fallback', () => {
  assert.equal(reply('cho mình xem A003', style)[0].title, 'A003 · Áo thun nam đen basic size L');
  assert.equal(reply('áo polo', style)[0].items.length, 2);
  assert.match(reply('Z999 giá sao', style)[0].text, /không có mã Z999/);
  assert.match(reply('abcxyz', style)[0].text, /mô phỏng/);
  assert.equal(greeting()[1].type, 'chips');
});

test('D-05 show flags: hide price/stock/badge', () => {
  const s = normalizeCardStyle({ show: { price: false, stock: true, badge: false } }).style;
  const it = reply('CATALOG:1', s)[0].items[0];
  assert.equal(it.subtitle, 'Chỉ còn 5'); assert.equal(it.badge, undefined);
  assert.equal(DEMO_PRODUCTS.length, 7);
});

test('D-06 renderer draws badge over photo, sold-out disables action', async () => {
  const { renderBlocks } = await import('../web/widget-blocks.js');
  const made = [];
  const node = (tag) => { const n = { tag: tag.toUpperCase(), tagName: tag.toUpperCase(), children: [], style: { setProperty() {} }, dataset: {}, classList: { add(c) { n.className += ' ' + c; } }, className: '', append(...c) { n.children.push(...c); }, setAttribute() {}, addEventListener() {} }; made.push(n); return n; };
  globalThis.document = { createElement: node };
  const root = node('div');
  renderBlocks(root, [{ type: 'card', title: 'A011 · x', subtitle: 'Hết hàng', image: 'https://i.imgur.com/a.jpg', badge: 'Bán chạy', soldOut: true, actions: [{ kind: 'action', label: 'Hết hàng', payload: 'ORDER:A011', disabled: true }] }]);
  assert.ok(made.some((n) => n.className === 't4-badge' && n.textContent === 'Bán chạy'));
  assert.ok(made.some((n) => /t4-soldout/.test(n.className)));
  assert.ok(made.some((n) => n.tagName === 'BUTTON' && n.disabled === true));
  delete globalThis.document;
});
