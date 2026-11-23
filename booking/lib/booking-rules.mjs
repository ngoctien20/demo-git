// TIEN404 Đặt lịch — booking rules for service shops (spa, nail, salon...). Pure functions, no I/O.
// Data shape = Google Sheet AI_SALES_DEMO tabs "Dich_vu" (services) and "Lich_hen" (bookings).
// The AI never sets a price, a deposit or a free slot: it only passes what the customer asked for,
// and these rules decide from the Sheet.
import { toVnd, normPhone, isVnPhone, clean, parseLocal, local } from './vn.mjs';
import { depositFor, newTransferCode } from './deposit.mjs';

export const DEFAULT_SETTINGS = Object.freeze({
  open: '09:00',          // first start time of the day
  close: '20:00',         // the service must END by this time
  stepMin: 30,            // offered start times: every 30 minutes
  capacity: 1,            // how many customers can be served at the same time (staff / chairs)
  closedWeekdays: [],     // 0 = Sunday ... 6 = Saturday
  minLeadMin: 60,         // cannot book less than 60 minutes ahead
  maxDaysAhead: 30,
  depositHoldMin: 30,     // an unpaid booking that needs a deposit keeps its slot 30 minutes
  deposit: { percent: 30, min: 50000, fixed: null },
});

// Statuses (column "status" in Lich_hen):
//   pending       customer asked; if a deposit is due, the slot is held only depositHoldMin
//   deposit_paid  deposit received (set by the payment matcher) -> slot held
//   confirmed     shop confirmed (no deposit, or by hand)       -> slot held
//   done / cancelled / no_show / expired                           -> nothing held
const HOLDING = new Set(['pending', 'deposit_paid', 'confirmed']);

const minutes = (hhmm) => {
  const m = /^(\d{2}):(\d{2})$/.exec(String(hhmm ?? ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
};

export function readServices(rows) {
  return (rows || []).map((r) => ({
    code: String(r?.ma ?? '').trim().toUpperCase(),
    name: clean(String(r?.ten_dich_vu ?? ''), 80),
    price: toVnd(r?.gia),
    durationMin: Number(r?.thoi_luong_phut),
    bookable: /^(có|co|yes|true|1)$/i.test(String(r?.dat_lich ?? '').trim()),
    active: !/ngưng|ngung|tắt|tat|off/i.test(String(r?.trang_thai ?? '')),
  })).filter((s) => s.code);
}

function bookingWindow(b, services) {
  const start = parseLocal(b?.thoi_gian_mong_muon);
  const svc = services.find((s) => s.code === String(b?.ma_muc ?? '').trim().toUpperCase());
  const dur = svc && Number.isSafeInteger(svc.durationMin) && svc.durationMin > 0 ? svc.durationMin : 60;
  return { start, end: start + dur * 60e3 };
}

// Does booking row `b` still hold its slot at time nowMs?
export function holdsSlot(b, nowMs, settings = DEFAULT_SETTINGS) {
  const status = String(b?.status ?? '').trim().toLowerCase();
  if (!HOLDING.has(status)) return false;
  if (status === 'pending' && toVnd(b?.coc_vnd) > 0) {
    const created = Date.parse(b?.created_at);
    // Unknown creation time: keep holding (safe side, never double-book).
    if (Number.isFinite(created) && nowMs - created > settings.depositHoldMin * 60e3) return false;
  }
  return true;
}

// How many held bookings overlap [start, end).
export function overlapCount(bookings, services, start, end, nowMs, settings = DEFAULT_SETTINGS, ignoreId = null) {
  let n = 0;
  for (const b of bookings || []) {
    if (ignoreId && b?.request_id === ignoreId) continue;
    if (!holdsSlot(b, nowMs, settings)) continue;
    const w = bookingWindow(b, services);
    if (!Number.isFinite(w.start)) continue;
    if (w.start < end && start < w.end) n++;
  }
  return n;
}

// Why can't this start time be booked? null = it can.
function slotProblem(start, svc, bookings, services, nowMs, s) {
  if (!Number.isFinite(start)) return 'BAD_TIME';
  if (start < nowMs + s.minLeadMin * 60e3) return 'TOO_SOON';
  if (start > nowMs + s.maxDaysAhead * 86400e3) return 'TOO_FAR';
  const L = local(start);
  if (s.closedWeekdays.includes(L.weekday)) return 'CLOSED_DAY';
  const startMin = minutes(L.time);
  if (startMin < minutes(s.open) || startMin + svc.durationMin > minutes(s.close)) return 'OUTSIDE_HOURS';
  const end = start + svc.durationMin * 60e3;
  if (overlapCount(bookings, services, start, end, nowMs, s) >= s.capacity) return 'FULL';
  return null;
}

// Free start times ("HH:mm") for one service on one local date ("YYYY-MM-DD").
export function freeSlots({ date, serviceCode, services, bookings, nowMs, settings = DEFAULT_SETTINGS }) {
  const s = { ...DEFAULT_SETTINGS, ...settings };
  const svc = services.find((x) => x.code === String(serviceCode ?? '').trim().toUpperCase());
  if (!svc || !svc.bookable || !svc.active || !(svc.durationMin > 0)) return [];
  const out = [];
  for (let m = minutes(s.open); m + svc.durationMin <= minutes(s.close); m += s.stepMin) {
    const hhmm = String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
    const start = parseLocal(date + ' ' + hhmm);
    if (!slotProblem(start, svc, bookings, services, nowMs, s)) out.push(hhmm);
  }
  return out;
}

const PROBLEM_TEXT = {
  BAD_TIME: 'Chưa rõ ngày giờ, bạn cho mình ngày và giờ cụ thể nhé.',
  TOO_SOON: 'Giờ này gấp quá, shop cần đặt trước ít nhất',
  TOO_FAR: 'Shop chỉ nhận lịch trong',
  CLOSED_DAY: 'Hôm đó shop nghỉ.',
  OUTSIDE_HOURS: 'Giờ này ngoài giờ làm của shop',
  FULL: 'Khung giờ này đã kín lịch.',
};

// Customer asks for service X at time T. Returns a new Lich_hen row or a refusal with suggestions.
export function validateBooking({ input, services: serviceRows, bookings, nowMs, rand, settings = DEFAULT_SETTINGS }) {
  const s = { ...DEFAULT_SETTINGS, ...settings };
  const services = readServices(serviceRows);
  const book = (bookings || []).filter((b) => b && b.request_id);
  const reject = (message, extra = {}) => ({ ok: false, action: 'rejected', message, ...extra });

  const name = clean(String(input?.customer_name ?? ''), 60);
  const phone = normPhone(input?.phone);
  const code = String(input?.service_code ?? '').trim().toUpperCase();
  const start = parseLocal(input?.time);
  const missing = [];
  if (!name) missing.push('tên');
  if (!isVnPhone(phone)) missing.push('số điện thoại');
  if (!code) missing.push('dịch vụ');
  if (!Number.isFinite(start)) missing.push('ngày giờ (dạng 2026-11-25 10:00)');
  if (missing.length) return reject('Còn thiếu: ' + missing.join(', ') + '. Chưa đặt lịch.');

  const svc = services.find((x) => x.code === code);
  if (!svc || !svc.bookable) return reject('Không tìm thấy dịch vụ ' + code + ' nhận đặt lịch. Chưa đặt lịch.');
  if (!svc.active) return reject('Dịch vụ ' + svc.name + ' đang tạm ngưng. Chưa đặt lịch.');
  if (!Number.isSafeInteger(svc.price)) return reject('Giá dịch vụ ' + code + ' chưa hợp lệ, cần shop kiểm tra.');
  if (!Number.isSafeInteger(svc.durationMin) || svc.durationMin <= 0 || svc.durationMin > 600) {
    return reject('Thời lượng dịch vụ ' + code + ' chưa hợp lệ, cần shop kiểm tra.');
  }

  // Same phone + service + time already booked (resent message): answer with the existing booking.
  const when = local(start);
  const dup = book.find((b) => normPhone(b.phone) === phone && String(b.ma_muc ?? '').toUpperCase() === code
    && parseLocal(b.thoi_gian_mong_muon) === start && holdsSlot(b, nowMs, s));
  if (dup) return { ok: false, action: 'duplicate', request_id: dup.request_id, message: 'Bạn đã có lịch ' + svc.name + ' lúc ' + when.label + ' rồi.' };

  const problem = slotProblem(start, svc, book, services, nowMs, s);
  if (problem) {
    let text = PROBLEM_TEXT[problem];
    if (problem === 'TOO_SOON') text += ' ' + s.minLeadMin + ' phút.';
    if (problem === 'TOO_FAR') text += ' ' + s.maxDaysAhead + ' ngày tới.';
    if (problem === 'OUTSIDE_HOURS') text += ' (' + s.open + ' - ' + s.close + ').';
    const suggestions = freeSlots({ date: when.date, serviceCode: code, services, bookings: book, nowMs, settings: s }).slice(0, 4);
    if (suggestions.length) text += ' Hôm đó còn trống: ' + suggestions.join(', ') + '.';
    return reject(text, { reason: problem, suggestions });
  }

  const deposit = depositFor(svc.price, s.deposit);
  const d = new Date(nowMs);
  const p = (n) => String(n).padStart(2, '0');
  const stamp = d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) + p(d.getUTCHours()) + p(d.getUTCMinutes()) + p(d.getUTCSeconds());
  const transferCode = deposit > 0 ? newTransferCode(rand) : '';
  return {
    ok: true, action: 'create',
    request_id: 'BK-' + stamp + '-' + String(Math.floor(100000 + rand() * 900000)),
    nganh: 'dich_vu', ma_muc: code, ten_dich_vu: svc.name, ten_khach: name, phone,
    thoi_gian_mong_muon: when.date + ' ' + when.time, thoi_gian_hien_thi: when.label,
    gia_vnd: svc.price, coc_vnd: deposit, ma_chuyen_khoan: transferCode,
    status: 'pending', created_at: d.toISOString(),
    giu_cho_den: deposit > 0 ? new Date(nowMs + s.depositHoldMin * 60e3).toISOString() : '',
  };
}

// For a late deposit: is this booking's slot still free if we ignore the booking itself?
export function slotStillFree(row, serviceRows, bookings, nowMs, settings = DEFAULT_SETTINGS) {
  const s = { ...DEFAULT_SETTINGS, ...settings };
  const services = readServices(serviceRows);
  const w = bookingWindow(row, services);
  if (!Number.isFinite(w.start) || w.start <= nowMs) return false;
  return overlapCount(bookings, services, w.start, w.end, nowMs, s, row.request_id) < s.capacity;
}
