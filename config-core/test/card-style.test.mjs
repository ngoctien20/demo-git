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
