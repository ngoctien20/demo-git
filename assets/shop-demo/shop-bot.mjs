// TIEN404 Demo page: scripted sales bot (mô phỏng). Pure, no I/O: input → web widget blocks.
// Same block shape as config-core toWebWidget(); product text comes from card-style.mjs productRow().
// Nothing here creates a real order or calls a server.
import { productRow } from './card-style.mjs';

// Mirror of AI_SALES_DEMO Products A001–A007 (2026-11-25). Photos are demo illustrations.
export const DEMO_PRODUCTS = [
  { sku: 'A001', name: 'Áo polo nam xanh navy size S', price: 245000, stock: 5, badge: 'Bán chạy', old_price: 299000 },
  { sku: 'A002', name: 'Áo thun nam trắng basic size M', price: 159000, stock: 25 },
  { sku: 'A003', name: 'Áo thun nam đen basic size L', price: 159000, stock: 18 },
  { sku: 'A004', name: 'Áo polo nam xanh navy size M', price: 289000, stock: 14 },
  { sku: 'A005', name: 'Áo sơ mi nam trắng slimfit size L', price: 329000, stock: 12 },
  { sku: 'A006', name: 'Áo khoác bomber đen size L', price: 599000, stock: 8, badge: 'Mới' },
  { sku: 'A007', name: 'Áo hoodie xám size XL', price: 449000, stock: 10 },
].map((p) => ({ ...p, image_url: 'assets/shop-demo/products/' + p.sku + '.jpg' }));

export const PAGE_SIZE = 3;
const vnd = (n) => Number(n).toLocaleString('vi-VN').replace(/,/g, '.') + 'đ';
const fold = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();
const bySku = (sku) => DEMO_PRODUCTS.find((p) => p.sku === sku);

const MAIN_CHIPS = [
  { kind: 'action', label: 'Xem sản phẩm', payload: 'CATALOG:1' },
  { kind: 'action', label: 'Bán chạy', payload: 'BADGE:Bán chạy' },
  { kind: 'action', label: 'Hàng mới', payload: 'BADGE:Mới' },
  { kind: 'action', label: 'Gặp nhân viên', payload: 'HUMAN' },
];

function cardItem(p, style) {
  // Web draws the label over the photo, so the text line leaves it out (Messenger keeps it in text).
  const showBadge = style?.show?.badge !== false;
  const r = productRow(p, { ...(style ?? {}), show: { price: style?.show?.price !== false, stock: style?.show?.stock !== false, badge: !p.image_url && showBadge } });
  return {
    title: r.title, subtitle: r.subtitle, image: p.image_url, soldOut: r.soldOut,
    ...(p.badge && p.image_url && showBadge ? { badge: p.badge } : {}),
    actions: [
      { kind: 'action', label: r.soldOut ? 'Hết hàng' : 'Đặt ngay', payload: 'ORDER:' + p.sku, disabled: r.soldOut },
      { kind: 'action', label: 'Xem chi tiết', payload: 'VIEW:' + p.sku },
    ],
  };
}

function list(products, style, lead) {
  if (products.length === 1) return [{ type: 'card', ...cardItem(products[0], style) }, { type: 'text', text: lead }];
  return [{ type: 'carousel', items: products.map((p) => cardItem(p, style)) }, { type: 'text', text: lead }];
}

export function greeting() {
  return [
    { type: 'text', text: 'Chào bạn 👋 Mình là trợ lý của Shop Mẫu TIEN404. Bạn muốn xem sản phẩm hay cần mình tư vấn gì?' },
    { type: 'chips', actions: MAIN_CHIPS },
  ];
}

/** One step of the demo bot. `input` is a button payload or free text typed by the visitor. */
export function reply(input, style) {
  const s = String(input ?? '').trim();
  let m;
  if ((m = /^CATALOG:(\d+)$/.exec(s))) {
    const pages = Math.ceil(DEMO_PRODUCTS.length / PAGE_SIZE);
    const page = Math.min(Math.max(1, Number(m[1])), pages);
    const items = DEMO_PRODUCTS.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const nav = [];
    if (page > 1) nav.push({ kind: 'action', label: 'Trang trước', payload: 'CATALOG:' + (page - 1) });
    if (page < pages) nav.push({ kind: 'action', label: 'Trang tiếp', payload: 'CATALOG:' + (page + 1) });
    return [...list(items, style, 'Sản phẩm · trang ' + page + '/' + pages + ' · ' + DEMO_PRODUCTS.length + ' mẫu'), ...(nav.length ? [{ type: 'buttons', actions: nav }] : [])];
  }
  if ((m = /^BADGE:(.+)$/.exec(s))) {
    const hit = DEMO_PRODUCTS.filter((p) => p.badge === m[1]);
    if (!hit.length) return [{ type: 'text', text: 'Hiện chưa có mẫu nào gắn nhãn "' + m[1] + '".' }, { type: 'chips', actions: MAIN_CHIPS }];
    return [...list(hit, style, 'Mẫu "' + m[1] + '" của shop đây ạ.'), { type: 'chips', actions: MAIN_CHIPS.filter((c) => c.payload !== s) }];
  }
  if ((m = /^VIEW:([A-Z]\d{3})$/.exec(s)) && bySku(m[1])) {
    const p = bySku(m[1]);
    return [
      { type: 'card', ...cardItem(p, style) },
      { type: 'text', text: p.sku + ' · ' + p.name + '\nGiá ' + vnd(p.price) + (p.old_price > p.price ? ' (giá cũ ' + vnd(p.old_price) + ')' : '') + ' · ' + (p.stock > 0 ? 'còn ' + p.stock + ' cái' : 'tạm hết hàng') + '.' },
      { type: 'chips', actions: [{ kind: 'action', label: 'Xem mẫu khác', payload: 'CATALOG:1' }, { kind: 'action', label: 'Gặp nhân viên', payload: 'HUMAN' }] },
    ];
  }
  if ((m = /^ORDER:([A-Z]\d{3})$/.exec(s)) && bySku(m[1])) {
    const p = bySku(m[1]);
    if (p.stock <= 0) return [{ type: 'text', text: p.sku + ' tạm hết hàng ạ. Bạn xem mẫu khác nhé.' }, { type: 'chips', actions: MAIN_CHIPS }];
    const qty = [1, 2, 3].filter((q) => q <= p.stock);
    return [
      { type: 'text', text: 'Bạn lấy mấy cái ' + p.sku + ' ạ? (còn ' + p.stock + ')' },
      { type: 'chips', actions: qty.map((q) => ({ kind: 'action', label: String(q), payload: 'QTY:' + p.sku + ':' + q })) },
    ];
  }
  if ((m = /^QTY:([A-Z]\d{3}):(\d{1,2})$/.exec(s)) && bySku(m[1])) {
    const p = bySku(m[1]); const q = Number(m[2]);
    if (q < 1 || q > p.stock) return [{ type: 'text', text: 'Shop chỉ còn ' + p.stock + ' cái ' + p.sku + ' thôi ạ.' }];
    return [
      { type: 'text', text: 'Tạm tính: ' + p.sku + ' × ' + q + ' = ' + vnd(p.price * q) + '.\nỞ shop thật, trợ lý sẽ hỏi tên, số điện thoại, địa chỉ rồi báo đơn cho chủ shop. Đây là bản mô phỏng nên không tạo đơn thật.' },
      { type: 'chips', actions: [{ kind: 'action', label: 'Xem mẫu khác', payload: 'CATALOG:1' }, { kind: 'action', label: 'Gặp nhân viên', payload: 'HUMAN' }] },
    ];
  }
  if (s === 'HUMAN') {
    return [{ type: 'text', text: 'Mình đã báo nhân viên shop. Khi nhân viên vào trả lời, trợ lý sẽ tự im để không chen ngang. (Mô phỏng)' }];
  }
  // Free text.
  const t = fold(s);
  const sku = (t.match(/\b[a-z]\d{3}\b/g) ?? [])[0]?.toUpperCase();
  if (sku) return bySku(sku) ? reply('VIEW:' + sku, style) : [{ type: 'text', text: 'Shop không có mã ' + sku + ' ạ. Mình không đoán giá mã lạ.' }, { type: 'chips', actions: MAIN_CHIPS }];
  if (/ban chay|hot/.test(t)) return reply('BADGE:Bán chạy', style);
  if (/\bmoi\b|hang moi/.test(t)) return reply('BADGE:Mới', style);
  if (/nhan vien|gap nguoi|tu van vien/.test(t)) return reply('HUMAN', style);
  const kinds = [['polo', 'polo'], ['thun', 'thun'], ['so mi', 'sơ mi'], ['khoac', 'khoác'], ['bomber', 'bomber'], ['hoodie', 'hoodie']];
  const k = kinds.find(([key]) => t.includes(key));
  if (k) {
    const hit = DEMO_PRODUCTS.filter((p) => fold(p.name).includes(k[0]));
    return [...list(hit, style, 'Các mẫu áo ' + k[1] + ' shop đang có ạ.'), { type: 'chips', actions: MAIN_CHIPS }];
  }
  if (/san pham|co gi|mau nao|xem|ao|gia/.test(t)) return reply('CATALOG:1', style);
  if (/chao|hello|hi\b|alo/.test(t)) return greeting();
  return [{ type: 'text', text: 'Bản mô phỏng này hiểu mã sản phẩm (vd A003), loại áo (polo, thun, sơ mi, khoác, hoodie) và các nút bên dưới. Trợ lý thật của shop sẽ trả lời tự do bằng AI.' }, { type: 'chips', actions: MAIN_CHIPS }];
}
