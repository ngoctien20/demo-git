import test from 'node:test';
import assert from 'node:assert/strict';
import { decide, messengerProfileBody, directReply } from '../lib/bot-bridge.mjs';
import { templateConfig } from '../lib/templates.mjs';

// Shape returned by public.get_channel_menu: only enabled+released items.
const published = (cfg) => ({ ...cfg, version_no: 1, config_sha256: 'x', menu: cfg.menu.filter((m) => m.enabled) });

test('no config rejects new menu payload safely; non-config payload keeps legacy', () => {
  const unavailable = decide(null, { payload: 'T404:M:catalog' });
  assert.equal(unavailable.mode, 'rejected');
  assert.equal(unavailable.reason, 'menu_unavailable');
  assert.match(unavailable.message.text, /không khả dụng/);
  assert.deepEqual(decide(null, { payload: 'TIEN404:VIEW:A003' }), { mode: 'legacy' });
  const m = published(templateConfig('shop'));
  assert.deepEqual(decide(m, { text: 'áo A003 giá sao' }), { mode: 'legacy' });
  assert.deepEqual(decide(m, { payload: 'TIEN404:VIEW:A003' }), { mode: 'legacy' });
  assert.deepEqual(decide(m, { payload: 'TIEN404:ASK:human' }), { mode: 'legacy' });
});

test('shop: catalog/order go to the existing AI, handoff uses the live handoff sentence + team wording', () => {
  const m = published(templateConfig('shop'));
  assert.deepEqual(decide(m, { payload: 'T404:M:catalog' }), { mode: 'catalog', itemId: 'catalog', catalogPage: 1, catalogCategory: null });
  assert.equal(decide(m, { payload: 'T404:M:order_lookup' }).chatInput, 'Tôi muốn tra cứu đơn hàng của tôi');
  const h = decide(m, { payload: 'T404:M:handoff' });
  assert.equal(h.mode, 'handoff');
  // must match the live classifier regex in Z7Fd "Classify explicit human request"
  const norm = h.chatInput.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();
  assert.match(norm, /^(?:(?:toi|minh|em) muon |cho (?:toi|minh|em) )?(?:gap|noi chuyen voi|ket noi voi) (?:nhan vien(?: tu van)?|nguoi that)(?: (?:a|voi|nhe))?$/);
  assert.match(h.ackText, /nhân viên bán hàng/);
});

test('artist: profile missing -> says no data; manager handoff never promises the artist', () => {
  const m = published(templateConfig('artist'));
  assert.match(decide(m, { payload: 'T404:M:profile' }).replyText, /chưa có thông tin/);
  m.profile = { display_name: 'Ca sĩ Demo', bio: 'Tiểu sử do chủ tài khoản nhập.' };
  assert.equal(decide(m, { payload: 'T404:M:profile' }).replyText, 'Ca sĩ Demo\nTiểu sử do chủ tài khoản nhập.');
  const h = decide(m, { payload: 'T404:M:manager' });
  assert.match(h.ackText, /đội ngũ quản lý/);
  assert.doesNotMatch(h.ackText, /nghệ sĩ/);
});

test('service: services/prices only from owner data; empty list says no data', () => {
  const cfg = templateConfig('service');
  const m = published(cfg);
  assert.match(decide(m, { payload: 'T404:M:services' }).replyText, /chưa có thông tin/);
  m.menu[0].action_config = { items: [{ name: 'Cắt tóc', price_vnd: 80000 }, { name: 'Gội', price_vnd: null, note: 'liên hệ' }] };
  assert.equal(decide(m, { payload: 'T404:M:services' }).replyText, '• Cắt tóc: 80.000đ\n• Gội (liên hệ)');
});

test('forged / disabled / experimental payloads are rejected with the greeting', () => {
  const cfg = templateConfig('service'); cfg.menu[2].enabled = true; // BOOKING experimental
  const m = published(cfg);
  for (const p of ['T404:M:booking', 'T404:M:website', 'T404:M:../x', 'T404:M:nope']) {
    const r = decide(m, { payload: p });
    assert.equal(r.mode, 'rejected', p);
    assert.ok(r.message.text);
  }
});

test('get started -> greeting with quick replies from the menu (max 13, title <= 20)', () => {
  const r = decide(published(templateConfig('shop')), { payload: 'TIEN404:START' });
  assert.equal(r.mode, 'greeting');
  assert.deepEqual(r.message.quick_replies.map((q) => q.payload), ['T404:M:catalog', 'T404:M:order_lookup', 'T404:M:handoff']);
});

test('persistent menu body is produced but never sent here', () => {
  const b = messengerProfileBody(published(templateConfig('shop')));
  assert.equal(b.persistent_menu[0].call_to_actions.length, 3);
  assert.equal(b.get_started.payload, 'TIEN404:START');
});

test('contact info renders only provided fields', () => {
  assert.equal(directReply({ action_type: 'CONTACT_INFO', action_config: { phone: '0912345678', hours: '8h-21h' } }, {}), 'Điện thoại: 0912345678\nGiờ làm việc: 8h-21h');
});

test('Messenger catalogue cursor is bound to current published version and SHOW_CATALOG item', () => {
  const cfg = published(templateConfig('shop'));
  cfg.version_no = 42;
  assert.deepEqual(decide(cfg, { payload: 'T404:C:catalog:42:2' }), {
    mode: 'catalog', itemId: 'catalog', catalogPage: 2, catalogCategory: null,
  });
  const stale = decide(cfg, { payload: 'T404:C:catalog:41:2' });
  assert.equal(stale.mode, 'rejected');
  assert.equal(stale.reason, 'catalog_version_stale');
  for (const payload of [
    'T404:C:catalog:42:0', 'T404:C:catalog:42:100', 'T404:C:catalog:42:-1',
    'T404:C:order_lookup:42:1', 'T404:C:manager:42:1',
    'T404:C:catalog:42:2:admin', 'T404:C:../catalog:42:2',
  ]) assert.equal(decide(cfg, { payload }).mode, 'rejected', payload);
  const hidden = published(templateConfig('shop'));
  hidden.version_no = 42;
  hidden.menu.find(it => it.id === 'catalog').enabled = false;
  assert.equal(decide(hidden, { payload: 'T404:C:catalog:42:2' }).reason, 'catalog_item_inactive');
  assert.equal(decide(null, { payload: 'T404:C:catalog:42:2' }).reason, 'menu_unavailable');
  assert.equal(decide(cfg, { payload: 'T404:C:catalog:42:2' }, 'zalo_bot').mode, 'rejected');
});

test('custom published catalog item id/category routes by action, not by hardcoded id', () => {
  const cfg = published(templateConfig('shop'));
  cfg.menu[0].id = 'ao_nam';
  cfg.menu[0].action_config = { category: 'áo' };
  cfg.version_no = 8;
  assert.deepEqual(decide(cfg, { payload: 'T404:M:ao_nam' }), {
    mode: 'catalog', itemId: 'ao_nam', catalogPage: 1, catalogCategory: 'áo',
  });
  assert.deepEqual(decide(cfg, { payload: 'T404:C:ao_nam:8:2' }), {
    mode: 'catalog', itemId: 'ao_nam', catalogPage: 2, catalogCategory: 'áo',
  });
  const fallback = decide(cfg, { payload: 'T404:M:ao_nam' }, 'web');
  assert.equal(fallback.mode, 'ai');
});
