// V27 Native Messenger Adaptive UI — offline review of n8n Z7Fd draft 18c0473d.
// Runs the EXACT exported Code-node sources (renderer -> Prepare Messenger Reply -> Verify Send)
// in isolated VMs. Synthetic catalog only: no Page token, Meta Send API, Sheet or order writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src = (f) => fs.readFileSync(new URL('../n8n/' + f, import.meta.url), 'utf8');
const RENDER = src('messenger-catalog-page.code.mjs');
const PREPARE = src('messenger-prepare-reply.v27-draft.code.js');
const VERIFY = src('messenger-verify-send.v27-draft.code.js');
const DEMO_PAGE = '2379295362359912', SENDER = '33333333333';
const run = (code, ctx) => JSON.parse(JSON.stringify(
  vm.runInNewContext('(function(){\n' + code + '\n})()', ctx, { timeout: 1000 })));
const loop = (current) => (name) => {
  assert.equal(name, 'Loop One Message');
  return { first: () => ({ json: current }), context: { currentRunIndex: 0 } };
};

const mk = (n, over = {}) => Array.from({ length: n }, (_, i) => ({
  sku: 'A' + String(i + 1).padStart(3, '0'), name: 'Áo thun mẫu ' + (i + 1),
  price: 159000, stock: i === 1 ? 0 : 18, ...over,
}));

function current({ page = 1, digest = null, pageId = DEMO_PAGE } = {}) {
  return { pageId, senderId: SENDER, messageId: 'm_1', receivedAt: '2026-11-24T14:00:00Z',
    mediaType: 'catalog_page', catalogPage: page, catalogCategory: null,
    catalogItemId: 'catalog', catalogVersion: 7, catalogDigest: digest };
}
function renderer(rows, cur = current()) {
  return run(RENDER, { $: loop(cur), $input: { all: () => rows.map((r) => ({ json: r })) } })
    .map((x) => x.json);
}
function prepare(incoming, cur = current()) {
  return run(PREPARE, { $: loop(cur), $input: { first: () => ({ json: incoming }) } })
    .map((x) => x.json);
}
function pipeline(rows, cur = current()) {
  const r = renderer(rows, cur);
  return r.length ? prepare(r[0], cur) : [];
}
// Meta Send API stub (sequential, batchSize 1 in the live node) + Verify node.
function verify(plan, results) {
  const $ = (name) => { assert.equal(name, 'Prepare Messenger Reply');
    return { first: () => ({ json: plan[0] }), context: { currentRunIndex: 0 } }; };
  return run(VERIFY, { $, $input: { all: () => results.map((j) => ({ json: j })) } });
}
const ok = (plan) => plan.map((_, i) => ({ recipient_id: SENDER, message_id: 'mid.' + i }));

test('V27-01 page of 3 trusted SKUs -> generic carousel + text with page controls (2 messages)', () => {
  const plan = pipeline(mk(7));
  assert.equal(plan.length, 2);
  assert.ok(plan.every((p, i) => p.messageIndex === i + 1 && p.messageCount === 2));
  const g = plan[0].messengerMessage.attachment.payload;
  assert.equal(g.template_type, 'generic');
  assert.equal(g.elements.length, 3);
  assert.deepEqual(g.elements.map((e) => e.buttons[0].payload),
    ['TIEN404:VIEW:A001', 'TIEN404:VIEW:A002', 'TIEN404:VIEW:A003']);
  assert.ok(g.elements.every((e) => e.title.length <= 80 && e.subtitle.length <= 80 && !('image_url' in e)));
  assert.equal(g.elements[1].subtitle, '159.000đ · Hết hàng');
  assert.equal(g.elements[0].title, 'A001 · Áo thun mẫu 1');
  assert.equal(plan[0].messengerMessage.quick_replies, undefined, 'quick replies only on last message');
  const t = plan[1].messengerMessage;
  assert.equal(t.text, 'Sản phẩm · trang 1/3 · 7 mẫu\nBấm "Xem" trên thẻ hoặc nhắn mã mẫu (vd A001) để xem chi tiết.');
  assert.equal(g.image_aspect_ratio, undefined);
  assert.deepEqual(t.quick_replies.map((q) => q.title), ['Trang tiếp']);
  assert.ok(t.text.length <= 2000);
});

test('V27-02 S4 Verify accepts both confirmations and rejects partial / duplicate MIDs', () => {
  const plan = pipeline(mk(7));
  const out = verify(plan, ok(plan));
  assert.equal(out[0].json.sentMessageCount, 2);
  assert.throws(() => verify(plan, ok(plan).slice(0, 1)), /expected 2, confirmed 1/);
  assert.throws(() => verify(plan, [ok(plan)[0], ok(plan)[0]]), /duplicate message ID/);
});

test('V27-03 middle page keeps both page controls on the text message', () => {
  const first = renderer(mk(9))[0];
  const plan = pipeline(mk(9), current({ page: 2, digest: first.catalogDigest }));
  assert.equal(plan.length, 2);
  assert.deepEqual(plan[1].messengerMessage.quick_replies.map((q) => q.title), ['Trang trước', 'Trang tiếp']);
});

test('V27-04 single item -> legacy button template, 1 message (no 1-card carousel)', () => {
  const plan = pipeline(mk(1));
  assert.equal(plan.length, 1);
  assert.equal(plan[0].messengerMessage.attachment.payload.template_type, 'button');
});

test('V27-05 last page with 1 leftover item falls back to button template', () => {
  const first = renderer(mk(4))[0];
  const plan = pipeline(mk(4), current({ page: 2, digest: first.catalogDigest }));
  assert.equal(plan.length, 1);
  assert.equal(plan[0].messengerMessage.attachment.payload.template_type, 'button');
  assert.deepEqual(plan[0].messengerMessage.quick_replies.map((q) => q.title), ['Trang trước']);
});

test('V27-06 tampered/mismatched card data never reaches the Send API as a carousel', () => {
  const r = renderer(mk(3))[0];
  const bad = [
    { ...r, catalogCards: r.catalogCards.map((c, i) => (i === 0 ? { ...c, buttons: [{ ...c.buttons[0], payload: 'TIEN404:VIEW:Z999' }] } : c)) },
    { ...r, catalogCards: r.catalogCards.slice(0, 2) },
    { ...r, catalogCards: r.catalogCards.map((c) => ({ ...c, title: 'X'.repeat(81) })) },
    { ...r, catalogCards: r.catalogCards.map((c) => ({ ...c, subtitle: '' })) },
    { ...r, catalogCards: 'not-an-array' },
    { ...r, catalogFollowText: undefined },
    { ...r, catalogFollowText: 'x'.repeat(301) },
    { ...r, catalogCards: r.catalogCards.map((c) => ({ ...c, image_url: 'https://evil.example/a.jpg' })) },
    { ...r, catalogCards: r.catalogCards.map((c) => ({ ...c, image_url: 'http://i.imgur.com/a.jpg' })) },
  ];
  for (const inc of bad) {
    const plan = prepare(inc);
    assert.equal(plan.length, 1);
    assert.equal(plan[0].messengerMessage.attachment.payload.template_type, 'button');
  }
});

test('V27-07 safe-text paths (wrong Page / stale digest / empty) stay one plain text message', () => {
  assert.deepEqual(pipeline(mk(3), current({ pageId: '999999999' })), []);
  const stale = pipeline(mk(7), current({ page: 2, digest: 'deadbeef' }));
  assert.equal(stale.length, 1);
  assert.match(stale[0].messengerMessage.text, /Danh mục đã thay đổi/);
  const empty = pipeline([{ sku: 'bad', name: '', price: -1, stock: 1 }]);
  assert.equal(empty.length, 1);
  assert.ok(typeof empty[0].messengerMessage.text === 'string');
});

test('V27-08 long product names: title clipped to 80 and still starts with "SKU — "', () => {
  const plan = pipeline(mk(3, { name: 'Áo khoác dù hai lớp chống nước phối màu '.repeat(5) }));
  assert.equal(plan.length, 2);
  for (const e of plan[0].messengerMessage.attachment.payload.elements) {
    assert.equal(e.title.length, 80);
    assert.match(e.title, /^A00\d · /);
  }
});

// F-V27-1 FIXED in V27.1: titles are clipped by code point, never leaving a lone surrogate.
test('V27-09 emoji at the 80-char boundary is kept whole', () => {
  const name = 'x'.repeat(80 - 'A001 · '.length - 1) + '👕 hàng mới';
  const r = renderer(mk(2, { name }))[0];
  const t = r.catalogCards[0].title;
  assert.equal([...t].length, 80);
  assert.equal(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(t), false);
});

test('V27-11 verified photos: allowlisted https kept (square), others dropped without losing the card', () => {
  const rows = mk(3).map((p, i) => ({ ...p, image_url: ['https://i.imgur.com/a1.jpg', 'https://evil.example/x.jpg', 'http://i.imgur.com/b.jpg'][i] }));
  const plan = pipeline(rows);
  assert.equal(plan.length, 2);
  const g = plan[0].messengerMessage.attachment.payload;
  assert.equal(g.image_aspect_ratio, 'square');
  assert.deepEqual(g.elements.map((e) => e.image_url), ['https://i.imgur.com/a1.jpg', undefined, undefined]);
});

test('V27-12 photo does not change the catalog digest (paging cursors stay valid)', () => {
  const a = renderer(mk(7))[0].catalogDigest;
  const b = renderer(mk(7).map((p) => ({ ...p, image_url: 'https://i.imgur.com/z.jpg' })))[0].catalogDigest;
  assert.equal(a, b);
});

test('V27-10 non-catalog paths are unchanged by V27 (greeting quick replies, SKU button card)', () => {
  const cur = { pageId: DEMO_PAGE, senderId: SENDER, messageId: 'm_2', receivedAt: 'x',
    mediaType: 'text', chatInput: 'xin chào' };
  const g = prepare({ output: 'Chào bạn!' }, cur);
  assert.equal(g.length, 1);
  assert.deepEqual(g[0].messengerMessage.quick_replies.map((q) => q.title),
    ['Xem áo', 'Xem quần', 'Tra cứu đơn', 'Gặp nhân viên']);
  const s = prepare({ output: '- A003 Áo thun 159.000đ\n- A006 Áo sơ mi' }, { ...cur, chatInput: 'có áo nào' });
  assert.equal(s.length, 1);
  assert.equal(s[0].messengerMessage.attachment.payload.template_type, 'button');
});
