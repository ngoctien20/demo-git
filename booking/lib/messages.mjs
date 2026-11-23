// TIEN404 Đặt lịch — customer/owner texts and appointment reminders. Pure functions, no I/O.
// Texts are built only from checked booking rows; nothing free-form from the AI goes into them.
import { clean, parseLocal, local, vnd } from './vn.mjs';

// Reply to the customer right after validateBooking() created the row.
export function bookingCreatedText(row, { qrUrl = '', holdMin = 30 } = {}) {
  const lines = ['Đã giữ lịch ' + clean(row.ten_dich_vu, 80) + ' lúc ' + row.thoi_gian_hien_thi + ' cho ' + clean(row.ten_khach, 60) + '.'];
  lines.push('Giá dịch vụ: ' + vnd(row.gia_vnd) + '.');
  if (row.coc_vnd > 0) {
    lines.push('Để giữ chỗ, bạn chuyển cọc ' + vnd(row.coc_vnd) + ' trong ' + holdMin + ' phút, nội dung: ' + row.ma_chuyen_khoan);
    if (qrUrl) lines.push('Quét mã QR (đã điền sẵn số tiền và nội dung): ' + qrUrl);
    lines.push('Shop tự xác nhận khi nhận được tiền. Quá ' + holdMin + ' phút chưa cọc thì lịch được mở lại cho khách khác.');
  } else {
    lines.push('Shop sẽ nhắn xác nhận lịch cho bạn sớm.');
  }
  return lines.join('\n');
}

export function depositReceivedText(row) {
  return 'Shop đã nhận cọc ' + vnd(Number(row.coc_vnd)) + '. Lịch ' + clean(row.ten_dich_vu, 80) + ' lúc '
    + local(parseLocal(row.thoi_gian_mong_muon)).label + ' đã chắc chắn. Shop sẽ nhắc bạn trước giờ hẹn.';
}

// Owner alert. kind: new | paid | underpaid | late_slot_taken | unmatched
export function ownerText(kind, row = {}, extra = {}) {
  const who = clean(String(row.ten_khach ?? ''), 60) + ' · ' + String(row.phone ?? '');
  const when = row.thoi_gian_mong_muon ? local(parseLocal(row.thoi_gian_mong_muon)).label : '';
  const svc = clean(String(row.ten_dich_vu ?? row.ma_muc ?? ''), 80);
  switch (kind) {
    case 'new': return '★ LỊCH MỚI: ' + svc + ' lúc ' + when + '\n☎ ' + who + (row.coc_vnd > 0 ? '\nChờ cọc ' + vnd(row.coc_vnd) + ' (' + row.ma_chuyen_khoan + ')' : '\nKhông cần cọc, anh/chị nhắn xác nhận khách.');
    case 'paid': return '✓ ĐÃ CỌC ' + vnd(extra.amount) + ': ' + svc + ' lúc ' + when + '\n☎ ' + who;
    case 'underpaid': return '⚠ CỌC THIẾU: khách chuyển ' + vnd(extra.got) + ', cần ' + vnd(extra.due) + ' cho ' + svc + ' lúc ' + when + '\n☎ ' + who + '\nLịch CHƯA được xác nhận.';
    case 'late_slot_taken': return '⚠ CỌC MUỘN: khách chuyển ' + vnd(extra.amount) + ' nhưng giờ ' + when + ' đã có người khác. Cần gọi khách đổi giờ hoặc hoàn tiền.\n☎ ' + who;
    default: return '⚠ Có tiền vào ' + vnd(extra.amount ?? 0) + ' không khớp lịch nào (nội dung không có mã T404). Anh/chị kiểm tra giúp.';
  }
}

// Reminders: 24 h before and 2 h before, only for bookings that are sure (deposit_paid / confirmed).
// sentKeys: Set of keys already sent (column "da_nhac"), so each reminder goes out once.
// 24h: sent once the appointment is less than 24 h away, but only if it was booked at least 12 h ahead
//      (a same-day booking does not need it). 2h: sent once it is less than 2 h away.
export function dueReminders({ bookings, nowMs, sentKeys = new Set(), shopName = 'Shop' }) {
  const out = [];
  for (const b of bookings || []) {
    const status = String(b?.status ?? '').toLowerCase();
    if (status !== 'deposit_paid' && status !== 'confirmed') continue;
    const start = parseLocal(b.thoi_gian_mong_muon);
    if (!Number.isFinite(start) || start <= nowMs) continue;
    const left = (start - nowMs) / 60e3;
    const bookedAhead = (start - Date.parse(b.created_at)) / 60e3;
    let kind = null;
    if (left <= 120) kind = '2h';
    else if (left <= 1440 && !(bookedAhead < 720)) kind = '24h';
    if (!kind) continue;
    const key = b.request_id + ':' + kind;
    if (sentKeys.has(key)) continue;
    const L = local(start);
    const text = kind === '24h'
      ? clean(shopName, 40) + ' nhắc lịch: ' + clean(String(b.ten_dich_vu ?? b.ma_muc), 80) + ' lúc ' + L.label + '. Bạn trả lời 1 để giữ lịch, 2 nếu cần đổi giờ.'
      : clean(shopName, 40) + ' hẹn bạn lúc ' + L.label + ' (' + clean(String(b.ten_dich_vu ?? b.ma_muc), 80) + '). Hẹn gặp bạn nhé!';
    out.push({ key, request_id: b.request_id, kind, phone: b.phone, channel: b.kenh, text });
  }
  return out;
}
