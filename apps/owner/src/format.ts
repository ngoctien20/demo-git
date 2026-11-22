export const vnd = (n: number | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('vi-VN').format(n) + 'đ';
export const dateTime = (s: string | null | undefined) =>
  s ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(s)) : '—';
/** Parses "289000", "289.000", "289,000đ" → 289000. Refuses text prices like "1.2tr" (owner must type digits). */
export function parseVnd(input: string): number | null {
  const t = input.trim().replace(/[đ₫\s]/gi, '');
  if (!/^\d{1,3}([.,]\d{3})*$|^\d+$/.test(t)) return null;
  const n = Number(t.replace(/[.,]/g, ''));
  return Number.isSafeInteger(n) && n >= 0 && n <= 1_000_000_000_000 ? n : null;
}
