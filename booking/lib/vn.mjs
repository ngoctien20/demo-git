// Small Vietnam helpers shared by booking/ and setup/ (pure, no I/O).
// Vietnam has one time zone (UTC+7) and no daylight saving, so a fixed offset is exact.

export const ICT_OFFSET_MS = 7 * 3600e3;

// Money in VND is always a nonnegative safe integer. Accepts 159000, "159.000đ", "1,234,000.00".
export function toVnd(v) {
  if (typeof v === 'number') return Number.isSafeInteger(v) && v >= 0 ? v : NaN;
  let s = String(v ?? '').trim().toLowerCase().replace(/(?:vnd|₫|đ)\s*$/u, '').replace(/\s+/g, '');
  if (/^\d{1,3}(?:,\d{3})+\.00$/.test(s)) s = s.replace(/,/g, '').slice(0, -3);
  else if (/^\d{1,3}(?:\.\d{3})+,00$/.test(s)) s = s.replace(/\./g, '').slice(0, -3);
  else if (/^\d{1,3}(?:[.,]\d{3})+$/.test(s)) s = s.replace(/[.,]/g, '');
  else if (/^\d+\.00$/.test(s)) s = s.slice(0, -3);
  if (!/^\d+$/.test(s)) return NaN;
  const n = Number(s);
  return Number.isSafeInteger(n) ? n : NaN;
}

// "+84 912 345 678" -> "0912345678". Google Sheets drops the leading 0 ("912345678"), so add it back.
export function normPhone(p) {
  let d = String(p ?? '').replace(/\D/g, '');
  if (d.startsWith('84') && d.length === 11) d = '0' + d.slice(2);
  if (d.length === 9 && !d.startsWith('0')) d = '0' + d;
  return d;
}
export const isVnPhone = (p) => /^0\d{9}$/.test(p);

// Text going to customers or the owner: no control chars, no links, capped length.
export function clean(v, max) {
  if (typeof v !== 'string') return '';
  return v.normalize('NFC').replace(/https?:\/\/\S+|www\.\S+/gi, '[link]')
    .replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2028-\u202e\u2066-\u2069]/g, ' ')
    .replace(/\s+/g, ' ').trim().slice(0, max);
}

// "2026-11-25 10:00" or "2026-11-25T10:00" (Vietnam local time) -> epoch ms, NaN if invalid.
export function parseLocal(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/.exec(String(s ?? '').trim());
  if (!m) return NaN;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return NaN;
  const ms = Date.UTC(y, mo - 1, d, h, mi) - ICT_OFFSET_MS;
  return new Date(ms + ICT_OFFSET_MS).getUTCDate() === d ? ms : NaN; // rejects 31/11
}

// epoch ms -> { date: "2026-11-25", time: "10:00", weekday: 0..6 (0 = Sunday), label: "10:00 thứ 4, 25/11" }
export function local(ms) {
  const t = new Date(ms + ICT_OFFSET_MS);
  const p = (n) => String(n).padStart(2, '0');
  const date = t.getUTCFullYear() + '-' + p(t.getUTCMonth() + 1) + '-' + p(t.getUTCDate());
  const time = p(t.getUTCHours()) + ':' + p(t.getUTCMinutes());
  const weekday = t.getUTCDay();
  const day = weekday === 0 ? 'chủ nhật' : 'thứ ' + (weekday + 1);
  return { date, time, weekday, label: time + ' ' + day + ', ' + p(t.getUTCDate()) + '/' + p(t.getUTCMonth() + 1) };
}

export const vnd = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + 'đ';
