// TIEN404 V27.5 card style (pure, no I/O, NOT wired into any live bot).
// One owner-facing style config → each channel applies only what it really supports.
//
//   Web widget : everything (màu, cỡ, bo góc, kiểu nút, xếp nút, hiệu ứng, bố cục thẻ)
//   Messenger  : nội dung thẻ, tỉ lệ ảnh (ngang/vuông), thứ tự + số nút (≤3). Meta vẽ nút: màu/cỡ/hiệu ứng KHÔNG đổi được
//   Telegram   : nội dung, số nút mỗi hàng (xếp dọc/ngang), ảnh. Telegram vẽ nút: màu/cỡ/hiệu ứng KHÔNG đổi được
//   Zalo Bot   : chữ + số thứ tự; chỉ áp nội dung (giá/tồn/nhãn)

export const STYLE_OPTIONS = Object.freeze({
  size: ['sm', 'md', 'lg'],
  shape: ['square', 'rounded', 'pill'],
  variant: ['solid', 'outline', 'soft'],
  layout: ['stack', 'row'],
  animation: ['none', 'fade', 'slide', 'pop', 'shine'],
  card: ['photo_top', 'compact'],
  image_ratio: ['horizontal', 'square'],
});

export const DEFAULT_STYLE = Object.freeze({
  primary: '#1f6feb', size: 'md', shape: 'rounded', variant: 'solid', layout: 'stack',
  animation: 'fade', card: 'photo_top', image_ratio: 'horizontal',
  show: Object.freeze({ price: true, stock: true, badge: true }),
});

// What each channel can honour. `true` = applied, missing/false = ignored (reported, never faked).
export const STYLE_SUPPORT = Object.freeze({
  web: { primary: true, size: true, shape: true, variant: true, layout: true, animation: true, card: true, image_ratio: true, show: true },
  messenger: { image_ratio: true, show: true },
  telegram: { layout: true, show: true },
  zalo_bot: { show: true },
  zalo_oa: { show: true },
});

const HEX = /^#[0-9a-fA-F]{6}$/;

function lum(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
export function contrast(a, b) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** Validate an owner style. Unknown/invalid values fall back to defaults with a warning. */
export function normalizeCardStyle(input = {}) {
  const warnings = [];
  const style = { ...DEFAULT_STYLE, show: { ...DEFAULT_STYLE.show } };
  for (const [k, allowed] of Object.entries(STYLE_OPTIONS)) {
    if (input[k] === undefined) continue;
    if (allowed.includes(input[k])) style[k] = input[k];
    else warnings.push('invalid_' + k);
  }
  if (input.primary !== undefined) {
    if (HEX.test(String(input.primary))) style.primary = String(input.primary).toLowerCase();
    else warnings.push('invalid_primary');
  }
  for (const k of Object.keys(style.show)) if (typeof input.show?.[k] === 'boolean') style.show[k] = input.show[k];
  // Text on the button: pick white or near-black, whichever reads better (WCAG AA ≥ 4.5 for 14px text).
  const onW = contrast(style.primary, '#ffffff'), onB = contrast(style.primary, '#111418');
  style.on_primary = onW >= onB ? '#ffffff' : '#111418';
  if (Math.max(onW, onB) < 4.5) warnings.push('low_contrast');
  return { style, warnings };
}

/** Split a style into what this channel applies and what it ignores (so the App can grey those out). */
export function styleFor(channel, style) {
  const sup = STYLE_SUPPORT[channel] ?? {};
  const applied = {}, ignored = [];
  for (const k of [...Object.keys(STYLE_OPTIONS), 'primary', 'show']) {
    if (sup[k]) applied[k] = style[k];
    else if (style[k] !== DEFAULT_STYLE[k]) ignored.push(k);
  }
  return { applied, ignored };
}

const vnd = (n) => Number(n).toLocaleString('vi-VN').replace(/,/g, '.') + 'đ';

/**
 * One product → card text for any channel, honouring show.price/stock/badge.
 * row: { sku, name, price_clean, old_price?, stock, badge? }
 */
export function productCardText(row, style = DEFAULT_STYLE) {
  const show = style.show ?? DEFAULT_STYLE.show;
  const title = row.sku + ' · ' + row.name;
  const bits = [];
  if (show.price && Number.isFinite(Number(row.price_clean))) {
    bits.push(vnd(row.price_clean) + (Number(row.old_price) > Number(row.price_clean) ? ' (giá cũ ' + vnd(row.old_price) + ')' : ''));
  }
  if (show.stock) {
    const s = Number(row.stock);
    bits.push(s <= 0 ? 'Hết hàng' : s <= 5 ? 'Chỉ còn ' + s : 'Còn ' + s);
  }
  const badge = show.badge && row.badge ? String(row.badge) : '';
  return { title, subtitle: [badge, ...bits].filter(Boolean).join(' · '), soldOut: Number(row.stock) <= 0 };
}

/** CSS custom properties for the web widget (renderer maps them onto classes). */
export function toCssVars(style) {
  const pad = { sm: '6px 10px', md: '9px 14px', lg: '13px 18px' }[style.size];
  const fs = { sm: '13px', md: '14px', lg: '16px' }[style.size];
  const r = { square: '4px', rounded: '10px', pill: '999px' }[style.shape];
  return { '--t404-primary': style.primary, '--t404-on-primary': style.on_primary, '--t404-btn-pad': pad, '--t404-btn-fs': fs, '--t404-btn-radius': r };
}

/** Messenger generic template extras + Telegram buttons-per-row derived from the style. */
export function nativeHints(channel, style) {
  if (channel === 'messenger') return { image_aspect_ratio: style.image_ratio === 'square' ? 'square' : 'horizontal' };
  if (channel === 'telegram') return { buttonsPerRow: style.layout === 'row' ? 3 : 1 };
  return {};
}
