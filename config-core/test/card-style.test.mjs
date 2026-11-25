// V27.5 card style — offline, synthetic.
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCardStyle, styleFor, productCardText, toCssVars, nativeHints, contrast, DEFAULT_STYLE } from '../lib/card-style.mjs';

test('S-01 valid style kept; invalid values fall back with warnings', () => {
  const { style, warnings } = normalizeCardStyle({ primary: '#E8590C', size: 'lg', shape: 'pill', animation: 'explode', primaryX: 1 });
  assert.equal(style.primary, '#e8590c');
  assert.equal(style.size, 'lg');
  assert.equal(style.shape, 'pill');
  assert.equal(style.animation, DEFAULT_STYLE.animation);
  assert.deepEqual(warnings, ['invalid_animation']);
  assert.ok(normalizeCardStyle({ primary: 'red; background:url(x)' }).warnings.includes('invalid_primary'));
});

test('S-02 button text colour always readable', () => {
  for (const c of ['#ffd43b', '#1f6feb', '#2b8a3e', '#000000', '#ffffff', '#e8590c']) {
    const { style } = normalizeCardStyle({ primary: c });
    assert.ok(contrast(style.primary, style.on_primary) >= 4.5 || normalizeCardStyle({ primary: c }).warnings.includes('low_contrast'), c);
  }
  assert.equal(normalizeCardStyle({ primary: '#ffd43b' }).style.on_primary, '#111418');
  assert.equal(normalizeCardStyle({ primary: '#1f6feb' }).style.on_primary, '#ffffff');
});

test('S-03 channels only apply what they support and report the rest', () => {
  const { style } = normalizeCardStyle({ primary: '#e8590c', size: 'lg', animation: 'pop', layout: 'row', image_ratio: 'square' });
  const web = styleFor('web', style);
  assert.equal(web.ignored.length, 0);
  const m = styleFor('messenger', style);
  assert.equal(m.applied.image_ratio, 'square');
  assert.deepEqual(m.ignored.sort(), ['animation', 'layout', 'primary', 'size']);
  const t = styleFor('telegram', style);
  assert.equal(t.applied.layout, 'row');
  assert.ok(t.ignored.includes('primary'));
  assert.deepEqual(Object.keys(styleFor('zalo_bot', style).applied), ['show']);
});

test('S-04 product card text: price, low stock, sold out, badge, show flags', () => {
  const a001 = { sku: 'A001', name: 'Áo polo nam xanh navy size S', price_clean: 245000, stock: 5, badge: 'Bán chạy' };
  assert.deepEqual(productCardText(a001), { title: 'A001 · Áo polo nam xanh navy size S', subtitle: 'Bán chạy · 245.000đ · Chỉ còn 5', soldOut: false });
  const sale = productCardText({ ...a001, old_price: 299000, stock: 18, badge: '' });
  assert.equal(sale.subtitle, '245.000đ (giá cũ 299.000đ) · Còn 18');
  assert.equal(productCardText({ ...a001, stock: 0 }).subtitle.endsWith('Hết hàng'), true);
  const { style } = normalizeCardStyle({ show: { stock: false, badge: false } });
  assert.equal(productCardText(a001, style).subtitle, '245.000đ');
});

test('S-05 web CSS vars + native hints', () => {
  const { style } = normalizeCardStyle({ size: 'sm', shape: 'pill', layout: 'row', image_ratio: 'square' });
  const v = toCssVars(style);
  assert.equal(v['--t404-btn-radius'], '999px');
  assert.equal(v['--t404-btn-fs'], '13px');
  assert.deepEqual(nativeHints('messenger', style), { image_aspect_ratio: 'square' });
  assert.deepEqual(nativeHints('telegram', style), { buttonsPerRow: 3 });
  assert.deepEqual(nativeHints('zalo_bot', style), {});
});

import { validateCardStyle, resolveCardStyle, productRow } from '../lib/card-style.mjs';
import { validateConfig } from '../lib/action-registry.mjs';
import { templateConfig } from '../lib/templates.mjs';
import { planCards } from '../lib/context-card-planner.mjs';
import { toTelegram, toWebWidget } from '../lib/channel-adapters.mjs';

test('S-06 card_style in shop config: strict validation, per-channel resolve', () => {
  const cfg = { ...templateConfig('shop'), card_style: { base: { primary: '#0f7b6c', size: 'lg', show: { badge: false } }, channels: { web: { animation: 'pop', size: 'sm' }, messenger: { image_ratio: 'horizontal' } } } };
  assert.equal(validateConfig(cfg, { mode: 'publish' }).ok, true);
  assert.equal(validateConfig(templateConfig('shop')).ok, true, 'card_style optional');
  const web = resolveCardStyle(cfg, 'web');
  assert.equal(web.size, 'sm'); assert.equal(web.animation, 'pop'); assert.equal(web.primary, '#0f7b6c'); assert.equal(web.show.badge, false);
  assert.equal(resolveCardStyle(cfg, 'messenger').image_ratio, 'horizontal');
  assert.equal(resolveCardStyle({}, 'telegram').size, 'md');
  const bad = validateCardStyle({ base: { primary: 'red', size: 'xl', foo: 1, show: { rating: true } }, channels: { tiktok: {} }, x: 1 }).map((e) => e.path + '|' + e.code).sort();
  assert.deepEqual(bad, ['card_style.base.foo|unknown_key', 'card_style.base.primary|card_style_color_invalid', 'card_style.base.show.rating|unknown_key',
    'card_style.base.size|card_style_value_invalid', 'card_style.channels.tiktok|channel_unknown', 'card_style.x|unknown_key']);
});

test('S-07 productRow reads Sheet rows (text prices too), optional columns, rejects untrusted rows', () => {
  const r = productRow({ sku: 'A001', name: 'Áo polo nam xanh navy size S', price: '245.000đ', stock: '5', badge: 'Bán chạy', old_price: '299.000đ', image_url: ' https://i.imgur.com/a.jpg ' });
  assert.deepEqual(r, { key: 'A001', title: 'A001 · Áo polo nam xanh navy size S', subtitle: 'Bán chạy · 245.000đ (giá cũ 299.000đ) · Chỉ còn 5',
    payload: 'TIEN404:VIEW:A001', soldOut: false, image_url: 'https://i.imgur.com/a.jpg', badge: 'Bán chạy' });
  assert.equal(productRow({ sku: 'A003', name: 'Áo thun', price_clean: 159000, stock: 18, badge: '<b>x</b>' }).subtitle, '159.000đ · Còn 18');
  for (const bad of [{ sku: 'a1', name: 'x', price: 1, stock: 1 }, { sku: 'A001', name: '', price: 1, stock: 1 }, { sku: 'A001', name: 'x', price: 'liên hệ', stock: 1 }, { sku: 'A001', name: 'x', price: 1, stock: -1 }])
    assert.equal(productRow(bad), null);
});

test('S-08 style flows into every channel: Messenger ratio, Telegram per-row, Web theme', () => {
  const cfg = { ...templateConfig('shop'), card_style: { base: { layout: 'stack', image_ratio: 'square', primary: '#e8590c', variant: 'outline', animation: 'shine' } } };
  const rows = ['A001', 'A003', 'A006'].map((k) => productRow({ sku: k, name: 'Áo ' + k, price: 159000, stock: 9, image_url: 'https://i.imgur.com/' + k + '.jpg' }));
  const plan = (ch) => planCards({ channel: ch, context: 'browse', config: cfg, rows, imageHosts: ['i.imgur.com'], style: resolveCardStyle(cfg, ch), text: 'Sản phẩm · trang 1/7' });
  assert.equal(plan('messenger').messages[0].attachment.payload.image_aspect_ratio, 'square');
  const noStyle = planCards({ channel: 'messenger', context: 'browse', config: cfg, rows, imageHosts: ['i.imgur.com'] });
  assert.equal(noStyle.messages[0].attachment.payload.image_aspect_ratio, undefined);
  const tg = toTelegram(plan('telegram'), { style: resolveCardStyle(cfg, 'telegram') }).calls[0];
  assert.ok(tg.params.reply_markup.inline_keyboard.every((r) => r.length === 1), 'stack = one button per row');
  const web = toWebWidget(plan('web'), { imageOrigins: ['https://i.imgur.com'], style: resolveCardStyle(cfg, 'web') });
  assert.equal(web.theme.vars['--t404-primary'], '#e8590c');
  assert.equal(web.theme.variant, 'outline'); assert.equal(web.theme.animation, 'shine');
  assert.equal(toWebWidget(plan('web')).theme, undefined, 'no style = unchanged output');
});

test('S-09 widget applyTheme only sets whitelisted vars and enum data attributes', async () => {
  const { applyTheme } = await import('../web/widget-blocks.js');
  const set = {}; const root = { style: { setProperty: (k, v) => { set[k] = v; } }, dataset: {} };
  applyTheme(root, { vars: { '--t404-primary': '#e8590c', '--x': 'red', '--t404-btn-pad': 'url(javascript:1)' }, variant: 'soft', animation: 'explode', image_ratio: 'square' });
  assert.deepEqual(set, { '--t404-primary': '#e8590c' });
  assert.deepEqual(root.dataset, { t4Variant: 'soft', t4ImageRatio: 'square' });
});
