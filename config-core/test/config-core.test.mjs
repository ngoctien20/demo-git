// node --test config-core/test/
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateConfig, ACTION_REGISTRY, HANDOFF_DEFAULT_ACK, HANDOFF_TEAMS } from '../lib/action-registry.mjs';
import { TEMPLATES, templateConfig } from '../lib/templates.mjs';
import { render, resolveInbound, visibleItems, LEGACY_PAYLOADS, PAYLOAD_PREFIX } from '../lib/channel-render.mjs';
import { FIXTURES } from './fixtures.mjs';

const codes = (r) => r.errors.map((e) => e.code).sort();

for (const f of FIXTURES) {
  test('validate/' + f.name, () => {
    assert.deepEqual(codes(validateConfig(f.cfg, { mode: f.mode })), [...f.codes].sort());
  });
}

test('templates: every template is a valid, publishable config and uses only registry actions', () => {
  for (const key of Object.keys(TEMPLATES)) {
    const cfg = templateConfig(key);
    assert.deepEqual(validateConfig(cfg, { mode: 'publish' }).errors, [], key);
    for (const it of cfg.menu) assert.ok(ACTION_REGISTRY[it.action_type], key + ':' + it.action_type);
  }
});

test('templates: no prices, stock, bio or schedule invented in any template', () => {
  const s = JSON.stringify(TEMPLATES);
  assert.doesNotMatch(s, /\d{2,}\.?000|đ\b|VND|còn \d+|sinh năm|lịch diễn/i);
  assert.equal(templateConfig('artist').profile, undefined);
});

test('templates: links are placeholders and disabled until the owner enters a real one', () => {
  for (const key of Object.keys(TEMPLATES)) {
    for (const it of templateConfig(key).menu) {
      if (it.action_config.url) { assert.match(it.action_config.url, /THAY-LINK/); assert.equal(it.enabled, false); }
    }
  }
});

test('templateConfig returns a copy (editing a draft never mutates the template)', () => {
  const a = templateConfig('shop'); a.menu[0].label = 'X';
  assert.equal(templateConfig('shop').menu[0].label, 'Xem sản phẩm');
});

test('one action reused by several templates; label change does not change the action', () => {
  const handoffs = Object.keys(TEMPLATES).map((k) => templateConfig(k).menu.find((m) => m.action_type === 'HUMAN_HANDOFF'));
  assert.equal(new Set(handoffs.map((h) => h.label)).size > 1, true);
  const cfg = templateConfig('shop');
  const before = resolveInbound({ channel: 'messenger', payload: PAYLOAD_PREFIX + 'handoff' }, cfg);
  cfg.menu.find((m) => m.id === 'handoff').label = 'Liên hệ chủ shop';
  const after = resolveInbound({ channel: 'messenger', payload: PAYLOAD_PREFIX + 'handoff' }, cfg);
  assert.deepEqual(after, before);
  assert.equal(after.action_type, 'HUMAN_HANDOFF');
});

test('handoff ack names the team and never promises the artist in person', () => {
  for (const t of HANDOFF_TEAMS) {
    assert.ok(HANDOFF_DEFAULT_ACK[t]);
    assert.doesNotMatch(HANDOFF_DEFAULT_ACK[t], /nghệ sĩ|trực tiếp/i);
  }
  const r = resolveInbound({ channel: 'messenger', payload: PAYLOAD_PREFIX + 'manager' }, templateConfig('artist'));
  assert.match(r.ack_text, /đội ngũ quản lý/);
});

test('messenger render: persistent menu + quick replies, disabled/experimental hidden, payload is item id only', () => {
  const r = render(templateConfig('shop'), 'messenger');
  assert.equal(r.verified, true);
  assert.deepEqual(r.shown, ['catalog', 'order_lookup', 'handoff']);
  const ctas = r.persistent_menu[0].call_to_actions;
  assert.deepEqual(ctas.map((c) => c.payload), ['T404:M:catalog', 'T404:M:order_lookup', 'T404:M:handoff']);
  for (const c of ctas) assert.ok(c.title.length <= 30);
  assert.equal(r.greeting_message.quick_replies.length, 3);
  assert.doesNotMatch(JSON.stringify(r), /HUMAN_HANDOFF|ORDER_LOOKUP|tenant|team/);
});

test('messenger render: link -> web_url in persistent menu, not a quick reply; long label truncated with warning', () => {
  const cfg = templateConfig('shop');
  Object.assign(cfg.menu[2], { enabled: true, action_config: { url: 'https://shop.vn', link_kind: 'website' } });
  cfg.menu[0].label = 'Xem tất cả sản phẩm đang có tại shop';
  const r = render(cfg, 'messenger');
  assert.deepEqual(r.persistent_menu[0].call_to_actions[2], { type: 'web_url', title: 'Xem website', url: 'https://shop.vn' });
  assert.ok(!r.greeting_message.quick_replies.some((q) => q.payload === 'T404:M:website'));
  assert.ok(r.warnings.some((w) => w.id === 'catalog' && w.code === 'label_truncated'));
  assert.ok(r.warnings.some((w) => w.id === 'catalog' && w.code === 'quick_label_truncated'));
  assert.ok(r.greeting_message.quick_replies.every((q) => q.title.length <= 20));
});

test('channel override changes label/visibility on one channel only, never the action or the base config', () => {
  const cfg = templateConfig('shop');
  cfg.menu[0].channel_overrides = { zalo_bot: { label: 'Sản phẩm' }, web: { enabled: false } };
  const snapshot = JSON.stringify(cfg);
  assert.match(render(cfg, 'zalo_bot').text, /1\. Sản phẩm/);
  assert.ok(!render(cfg, 'web').shown.includes('catalog'));
  assert.ok(render(cfg, 'messenger').shown.includes('catalog'));
  assert.equal(JSON.stringify(cfg), snapshot);
  assert.equal(resolveInbound({ channel: 'web', payload: 'T404:M:catalog' }, cfg).kind, 'rejected');
});

test('text-only channels get a numbered fallback with the same actions; number reply resolves server-side', () => {
  const cfg = templateConfig('artist');
  for (const ch of ['zalo_bot', 'telegram', 'zalo_oa']) {
    const r = render(cfg, ch);
    assert.equal(r.mode, 'text');
    assert.match(r.text, /1\. Thông tin nghệ sĩ\n2\. Liên hệ quản lý/);
    const x = resolveInbound({ channel: ch, text: ' 2 ', numberMap: r.number_map }, cfg);
    assert.equal(x.action_type, 'HUMAN_HANDOFF');
  }
  assert.equal(render(cfg, 'zalo_oa').verified, false);
  assert.equal(resolveInbound({ channel: 'zalo_bot', text: '9', numberMap: render(cfg, 'zalo_bot').number_map }, cfg).kind, 'free_text');
});

test('web render: buttons + link buttons', () => {
  const cfg = templateConfig('education');
  cfg.menu[1].enabled = true; cfg.menu[1].action_config.url = 'https://drive.google.com/x';
  const r = render(cfg, 'web');
  assert.deepEqual(r.buttons.map((b) => b.kind), ['action', 'link', 'action', 'action']);
});

test('unknown channel is reported, not guessed', () => {
  assert.deepEqual(render(templateConfig('shop'), 'whatsapp'), { channel: 'whatsapp', supported: false, reason: 'channel_unknown' });
});

test('resolver: payload cannot choose action/tenant; unknown or disabled ids rejected', () => {
  const cfg = templateConfig('shop');
  const bad = [
    'T404:M:website', // disabled in template
    'T404:M:../../x', 'T404:M:{"action_type":"ORDER_LOOKUP"}', 'T404:M:catalog;tenant=b',
    'TIEN404:RUN:create_order', 'T404:X:catalog',
  ];
  for (const p of bad) assert.equal(resolveInbound({ channel: 'messenger', payload: p }, cfg).kind, 'rejected', p);
  assert.equal(resolveInbound({ channel: 'messenger', payload: 'x'.repeat(2000) }, cfg).kind, 'free_text');
  const ok = resolveInbound({ channel: 'messenger', payload: 'T404:M:order_lookup' }, cfg);
  assert.deepEqual(ok, { kind: 'menu', item_id: 'order_lookup', action_type: 'ORDER_LOOKUP', action_config: {} });
});

test('legacy Messenger payloads (live d1ec9147) are recognised and keep their old behaviour', () => {
  const cfg = templateConfig('artist'); // even when the new config has no catalog, old buttons still map
  for (const p of Object.keys(LEGACY_PAYLOADS)) assert.equal(resolveInbound({ channel: 'messenger', payload: p }, cfg).kind, 'legacy', p);
  assert.deepEqual(resolveInbound({ channel: 'messenger', payload: 'TIEN404:VIEW:A003' }, cfg), { kind: 'legacy', action_type: 'PRODUCT_DETAIL', sku: 'A003' });
  assert.equal(resolveInbound({ channel: 'messenger', payload: 'TIEN404:VIEW:a003' }, cfg).kind, 'rejected');
  assert.equal(resolveInbound({ channel: 'messenger', payload: 'TIEN404:ASK:human' }, cfg).action_type, 'HUMAN_HANDOFF');
});

test('visibleItems sorts by sort_order then id and hides experimental even if enabled', () => {
  const cfg = templateConfig('service');
  cfg.menu[2].enabled = true; // BOOKING_REQUEST experimental
  cfg.menu[0].sort_order = 50;
  assert.deepEqual(visibleItems(cfg, 'web').map((i) => i.id), ['price_list', 'handoff', 'services']);
});
