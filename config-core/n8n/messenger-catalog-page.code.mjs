// V21 Messenger DEMO catalog pager (n8n Code node, runOnceForAllItems).
// Scope: signed Messenger ingress -> published SHOW_CATALOG action -> isolated DEMO Products.
// Never reads/orders/writes Commerce. Never trusts SKU, price, tenant or Page from a cursor.
const current = $('Loop One Message').first(1, $('Loop One Message').context.currentRunIndex).json;
const PAGE_SIZE = 3;
const DEMO_PAGE_ID = '2379295362359912';
const safeText = (message) => [{ json: { catalogMessage: { text: message } } }];
const norm = (v) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/gi, 'd').toLowerCase().trim().replace(/\s+/g, ' ');
const catRaw = norm(current.catalogCategory);
const cat = ['', 'all', 'tat ca', 'san pham'].includes(catRaw) ? 'all'
  : catRaw === 'ao' ? 'ao' : catRaw === 'quan' ? 'quan' : null;
const page = Number(current.catalogPage);
const version = Number(current.catalogVersion);
const id = String(current.catalogItemId ?? '');
if (String(current.pageId) !== DEMO_PAGE_ID || !/^\d{5,30}$/.test(String(current.senderId ?? ''))) {
  return []; // Absolutely no DEMO catalog output on a different Page.
}
if (current.mediaType !== 'catalog_page' || !cat ||
  !/^[a-z][a-z0-9_]{1,31}$/.test(id) ||
  !Number.isSafeInteger(page) || page < 1 || page > 99 ||
  !Number.isSafeInteger(version) || version < 1 || version > 999999999) {
  return safeText('Danh mục chưa khả dụng. Bạn hãy mở lại mục Xem sản phẩm nhé.');
}
const validMoney = n => (typeof n === 'number'
  ? Number.isSafeInteger(n) && n >= 0
  : typeof n === 'string' && /^\d+$/.test(n) && Number.isSafeInteger(Number(n)));
const rows = $input.all().map(it => it.json).filter(Boolean);
const counts = new Map();
for (const r of rows) {
  const sku = String(r.sku ?? '');
  if (/^[A-Z][0-9]{3}$/.test(sku)) counts.set(sku, (counts.get(sku) ?? 0) + 1);
}
const products = rows.filter(r => {
  const sku = String(r.sku ?? '');
  const name = typeof r.name === 'string' ? r.name.trim() : '';
  if (!/^[A-Z][0-9]{3}$/.test(sku) || counts.get(sku) !== 1 ||
    !name || name.length > 200 || !validMoney(r.price) || !validMoney(r.stock)) return false;
  if (cat === 'ao' && !norm(name).startsWith('ao ')) return false;
  if (cat === 'quan' && !norm(name).startsWith('quan ')) return false;
  return true;
}).map(r => ({ sku: String(r.sku), name: r.name.trim(),
  price: Number(r.price), stock: Number(r.stock) })).sort((a,b) => a.sku.localeCompare(b.sku));
if (!products.length) {
  return safeText('Mình chưa xác minh được sản phẩm trong danh mục này. Bạn hãy nhắn mã sản phẩm hoặc liên hệ nhân viên nhé.');
}
const pages = Math.ceil(products.length / PAGE_SIZE);
if (page > pages) {
  return safeText('Danh mục đã thay đổi hoặc trang này không còn sản phẩm. Bạn hãy mở lại mục Xem sản phẩm nhé.');
}
const shown = products.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
const names = {all:'Sản phẩm',ao:'Áo',quan:'Quần'};
const line = p => '• ' + p.sku + ' — ' + p.name.slice(0,44) + ' | ' +
  p.price.toLocaleString('vi-VN') + 'đ | ' + (p.stock === 0 ? 'Hết hàng' : 'Còn ' + p.stock);
const intro = 'Danh mục ' + names[cat] + ' — trang ' + page + '/' + pages + '\n' +
  shown.map(line).join('\n') + '\nBấm Xem để nhận chi tiết mẫu:';
const cursor = p => 'T404:C:' + id + ':' + version + ':' + p;
const qr = [];
if (page > 1) qr.push({ content_type: 'text', title: 'Trang trước', payload: cursor(page - 1) });
if (page < pages) qr.push({ content_type: 'text', title: 'Trang tiếp', payload: cursor(page + 1) });
const msg = {
  attachment: { type: 'template', payload: { template_type: 'button',
    text: intro.slice(0, 640),
    buttons: shown.map(p => ({ type: 'postback', title: 'Xem ' + p.sku,
      payload: 'TIEN404:VIEW:' + p.sku })) } },
  ...(qr.length ? { quick_replies: qr } : {}),
};
return [{ json: { catalogMessage: msg, catalogPage: page, catalogPages: pages,
  catalogCount: products.length, catalogCategory: cat, configVersion: version } }];
