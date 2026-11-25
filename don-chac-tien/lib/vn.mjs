// Vietnam helpers (pure). Vietnam is UTC+7 all year, so a fixed offset is exact.
export const ICT = 7 * 3600e3;

export const fold = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

/** 159000 → "159.000đ" */
export const vnd = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + 'đ';

/**
 * One money amount as Vietnamese shop owners type it → safe integer VND, or NaN.
 * "318k", "318K", "318.000", "318,000đ", "318000", "1tr2", "1,5tr", "2 triệu", "150 nghìn", "1 củ".
 */
export function parseMoney(raw) {
  const s = fold(raw).replace(/\s+/g, '').replace(/vnd$|d$|dong$/, '');
  let m;
  if ((m = /^(\d+)(?:[.,](\d{1,3}))?(?:tr|trieu|cu|m)(\d{1,3})?$/.exec(s))) {
    // 1tr2 = 1.200.000; 1,5tr = 1.500.000; 1tr250 = 1.250.000
    const frac = m[2] ?? m[3] ?? '';
    const n = Number(m[1]) * 1e6 + (frac ? Math.round(Number(frac.padEnd(3, '0').slice(0, 3)) * 1000) : 0);
    return Number.isSafeInteger(n) && n > 0 ? n : NaN;
  }
  if ((m = /^(\d+)(?:[.,](\d{1,2}))?(?:k|nghin|ngan|ng)$/.exec(s))) {
    const n = Number(m[1]) * 1000 + (m[2] ? Math.round(Number(m[2].padEnd(3, '0'))) : 0);
    return Number.isSafeInteger(n) && n > 0 ? n : NaN;
  }
  if (/^\d{1,3}(?:[.,]\d{3})+$/.test(s)) return Number(s.replace(/[.,]/g, ''));
  if (/^\d+$/.test(s)) return Number(s);
  return NaN;
}

/** "+84 912 345 678" / "0912.345.678" → "0912345678" */
export function normPhone(p) {
  let d = String(p ?? '').replace(/\D/g, '');
  if (d.startsWith('84') && d.length === 11) d = '0' + d.slice(2);
  if (d.length === 9 && !d.startsWith('0')) d = '0' + d;
  return d;
}
export const isVnPhone = (p) => /^0[35789]\d{8}$/.test(p);

/** Text shown to owner/customer: no control chars, links neutralised, capped. */
// Control chars, zero-width and bidi overrides (built from code points so the source stays plain ASCII).
const CTRL = new RegExp('[' + [[0, 31], [127, 127], [0x200b, 0x200f], [0x2028, 0x202e], [0x2066, 0x2069]].map(([a, b]) => '\\u' + a.toString(16).padStart(4, '0') + '-\\u' + b.toString(16).padStart(4, '0')).join('') + ']', 'g');
export function clean(v, max = 120) {
  return String(v ?? '').normalize('NFC').replace(/https?:\/\/\S+|www\.\S+/gi, '[link]')
    .replace(CTRL, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

/** epoch ms → { day: "2026-11-25", month: "2026-11", hm: "22:15", label: "22:15 hôm nay" | "08:00 26/11" } */
export function local(ms, nowMs = ms) {
  const t = new Date(ms + ICT); const n = new Date(nowMs + ICT);
  const p = (x) => String(x).padStart(2, '0');
  const day = t.getUTCFullYear() + '-' + p(t.getUTCMonth() + 1) + '-' + p(t.getUTCDate());
  const nday = n.getUTCFullYear() + '-' + p(n.getUTCMonth() + 1) + '-' + p(n.getUTCDate());
  const hm = p(t.getUTCHours()) + ':' + p(t.getUTCMinutes());
  const tomorrow = new Date(nowMs + ICT + 86400e3);
  const tday = tomorrow.getUTCFullYear() + '-' + p(tomorrow.getUTCMonth() + 1) + '-' + p(tomorrow.getUTCDate());
  const label = day === nday ? hm + ' hôm nay' : day === tday ? hm + (t.getUTCHours() < 12 ? ' sáng mai' : ' mai') : hm + ' ' + p(t.getUTCDate()) + '/' + p(t.getUTCMonth() + 1);
  return { day, month: day.slice(0, 7), hm, label, hour: t.getUTCHours() };
}
