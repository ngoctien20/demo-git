// TIEN404 Tự dựng trợ lý — turn what the AI read from a price-list photo / website into a DRAFT
// the owner reviews. Pure functions, no I/O. Nothing here publishes anything: the owner presses
// "Xác nhận" in the App, then the existing import (Products / Dich_vu) runs as today.
import { clean } from '../../booking/lib/vn.mjs';

export const MODULES = ['sell', 'booking', 'course', 'artist'];

// JSON schema for Claude structured output (output_config.format). Every field required, no extras.
export const DRAFT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['business_name', 'industry_label', 'customer_word', 'modules', 'opening_hours', 'items', 'faqs', 'unreadable'],
  properties: {
    business_name: { type: 'string', description: 'Tên shop đúng như in trên ảnh/trang, rỗng nếu không thấy' },
    industry_label: { type: 'string', description: 'Ngành, tiếng Việt, ngắn: "Tiệm nail", "Spa", "Shop thời trang"...' },
    customer_word: { type: 'string', description: 'Cách gọi khách hợp với ngành: khách, khách hàng, học viên, bệnh nhân...' },
    modules: { type: 'array', items: { type: 'string', enum: MODULES } },
    opening_hours: { type: 'string', description: 'Giờ mở cửa đúng như in, rỗng nếu không thấy' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'group', 'kind', 'price_text', 'price_vnd', 'duration_min'],
        properties: {
          name: { type: 'string' },
          group: { type: 'string', description: 'Nhóm/mục trên bảng giá, rỗng nếu không có' },
          kind: { type: 'string', enum: ['product', 'service', 'course'] },
          price_text: { type: 'string', description: 'Giá CHÉP NGUYÊN VĂN như in (vd "120k", "1.200.000đ"), rỗng nếu không có giá' },
          price_vnd: { anyOf: [{ type: 'integer' }, { type: 'null' }], description: 'Giá quy ra đồng, null nếu không có giá rõ ràng hoặc là khoảng giá' },
          duration_min: { anyOf: [{ type: 'integer' }, { type: 'null' }], description: 'Thời lượng phút nếu có in, không thì null' },
        },
      },
    },
    faqs: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['question', 'answer'],
        properties: { question: { type: 'string' }, answer: { type: 'string' } },
      },
    },
    unreadable: { type: 'string', description: 'Phần nào mờ/không đọc chắc được, để chủ shop kiểm tra' },
  },
};

// "120k" / "120K" / "1tr2" / "1,5tr" / "1.200.000đ" / "200.000 VND" -> integer VND, or null when unclear.
export function parsePriceText(t) {
  const s = String(t ?? '').toLowerCase().replace(/\s+/g, '').replace(/(?:vnđ|vnd|₫|đ|dong|đồng)$/u, '');
  if (!s) return null;
  let m;
  if ((m = /^(\d{1,3}(?:[.,]\d{3})+|\d+)$/.exec(s))) return safe(Number(m[1].replace(/[.,]/g, '')));
  if ((m = /^(\d+)(?:[.,](\d{1,3}))?k$/.exec(s))) return safe(Number(m[1]) * 1000 + (m[2] ? Math.round(Number('0.' + m[2]) * 1000) : 0));
  if ((m = /^(\d+)(?:tr|triệu|m)(\d{1,3})?$/u.exec(s))) return safe(Number(m[1]) * 1e6 + (m[2] ? Number(m[2].padEnd(3, '0')) * 1000 : 0));
  if ((m = /^(\d+)[.,](\d{1,2})(?:tr|triệu|m)$/u.exec(s))) return safe(Number(m[1]) * 1e6 + Number(m[2].padEnd(2, '0')) * 1e4);
  return null; // ranges ("150-200k"), "liên hệ", "từ 99k"... -> the owner fills it in
}
const safe = (n) => (Number.isSafeInteger(n) && n >= 0 && n <= 1e9 ? n : null);

const squash = (s) => String(s ?? '').toLowerCase().normalize('NFC').replace(/\s+/g, '');

// "9h - 21h", "09:00-21:30", "8h30 đến 20h" -> { open: "09:00", close: "21:00" } or null.
export function parseHours(t) {
  const m = /(\d{1,2})\s*(?:h|:|giờ)\s*(\d{2})?\s*(?:-|–|đến|toi|tới)\s*(\d{1,2})\s*(?:h|:|giờ)?\s*(\d{2})?/iu.exec(String(t ?? ''));
  if (!m) return null;
  const p = (h, mi) => String(h).padStart(2, '0') + ':' + String(mi ?? '00').padStart(2, '0');
  const [oh, om, ch, cm] = [Number(m[1]), m[2], Number(m[3]), m[4]];
  if (oh > 23 || ch > 24 || ch <= oh) return null;
  return { open: p(oh, om), close: p(Math.min(ch, 23), ch === 24 ? 59 : cm) };
}

// Check the AI draft. sourceText = page text when it came from a link (prices must appear in it).
// Each item gets check: "ok" or a reason the owner must look at it. Never invents or fixes a price.
export function checkDraft(raw, { sourceText = '' } = {}) {
  if (!raw || typeof raw !== 'object') throw new Error('BAD_DRAFT');
  const source = squash(sourceText);
  const seen = new Set();
  const items = [];
  for (const it of Array.isArray(raw.items) ? raw.items.slice(0, 300) : []) {
    const name = clean(String(it?.name ?? ''), 80);
    const key = squash(name);
    if (!name || seen.has(key)) continue;
    seen.add(key);
    const kind = ['product', 'service', 'course'].includes(it.kind) ? it.kind : 'product';
    const priceText = clean(String(it?.price_text ?? ''), 40);
    const parsed = parsePriceText(priceText);
    const aiPrice = Number.isSafeInteger(it?.price_vnd) && it.price_vnd >= 0 ? it.price_vnd : null;
    let check = 'ok';
    if (!priceText) check = 'Chưa có giá';
    else if (parsed === null) check = 'Giá chưa rõ ("' + priceText + '")';
    else if (aiPrice !== null && aiPrice !== parsed) check = 'AI đọc giá lệch, cần xem lại';
    else if (source && !source.includes(squash(priceText))) check = 'Không thấy giá này trên trang';
    const dur = Number.isSafeInteger(it?.duration_min) && it.duration_min > 0 && it.duration_min <= 600 ? it.duration_min : null;
    items.push({ name, group: clean(String(it?.group ?? ''), 40), kind, price_text: priceText, price_vnd: parsed, duration_min: dur, check });
  }
  const modules = new Set((raw.modules || []).filter((m) => MODULES.includes(m)));
  if (items.some((i) => i.kind === 'product')) modules.add('sell');
  if (items.some((i) => i.kind === 'service')) modules.add('booking');
  if (items.some((i) => i.kind === 'course')) modules.add('course');
  const faqs = (Array.isArray(raw.faqs) ? raw.faqs : []).slice(0, 15)
    .map((f) => ({ question: clean(String(f?.question ?? ''), 160), answer: clean(String(f?.answer ?? ''), 400) }))
    .filter((f) => f.question && f.answer);
  const hoursText = clean(String(raw.opening_hours ?? ''), 80);
  return {
    business_name: clean(String(raw.business_name ?? ''), 80),
    industry_label: clean(String(raw.industry_label ?? ''), 40) || 'Cửa hàng',
    customer_word: clean(String(raw.customer_word ?? ''), 20) || 'khách',
    modules: MODULES.filter((m) => modules.has(m)),
    opening_hours: hoursText,
    hours: parseHours(hoursText),
    items,
    faqs,
    unreadable: clean(String(raw.unreadable ?? ''), 300),
    needs_check: items.filter((i) => i.check !== 'ok').length,
    status: 'draft_owner_must_confirm',
  };
}

// After the owner confirms: rows for the existing Sheet tabs (column names unchanged).
// Products: sku/name/price/stock (stock 0 until the owner counts it). Dich_vu: ma/ten_dich_vu/gia/...
// Items still not "ok" are left out; the owner adds them by hand.
export function toSheetRows(draft) {
  const products = [], services = [];
  let p = 0, s = 0;
  for (const it of draft.items) {
    if (it.check !== 'ok' || it.price_vnd === null) continue;
    if (it.kind === 'product') {
      products.push({ sku: 'M' + String(++p).padStart(3, '0'), name: it.name, price: it.price_vnd, stock: 0, nhom: it.group });
    } else {
      services.push({ ma: 'DV-' + String(++s).padStart(2, '0'), ten_dich_vu: it.name, nhom: it.group, gia: it.price_vnd,
        thoi_luong_phut: it.duration_min ?? 60, dat_lich: 'có', mo_ta: '', trang_thai: 'đang nhận',
        ghi_chu: it.duration_min ? '' : 'Thời lượng tạm 60 phút, chủ shop sửa' });
    }
  }
  return { products, services };
}
