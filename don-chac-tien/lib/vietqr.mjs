// TIEN404 Đơn chắc tiền — VietQR payload theo chuẩn EMVCo / NAPAS 247 (chuyển nhanh tới tài khoản).
// Tạo chuỗi QR ngay tại chỗ (không gọi dịch vụ ngoài), có CRC16 để app ngân hàng kiểm lỗi.
// Tiền đi thẳng từ khách vào tài khoản của shop. TIEN404 không giữ tiền, không cần mật khẩu ngân hàng.

// Mã BIN NAPAS của các ngân hàng phổ biến (công khai). Bí danh không dấu để người lớn tuổi gõ tự nhiên.
export const BANKS = Object.freeze([
  { bin: '970436', short: 'Vietcombank', alias: ['vcb', 'vietcombank', 'ngoai thuong', 'vietcom'] },
  { bin: '970415', short: 'VietinBank', alias: ['ctg', 'vietinbank', 'vietin', 'cong thuong', 'icb'] },
  { bin: '970418', short: 'BIDV', alias: ['bidv', 'dau tu'] },
  { bin: '970405', short: 'Agribank', alias: ['agribank', 'agri', 'nong nghiep', 'vba'] },
  { bin: '970407', short: 'Techcombank', alias: ['tcb', 'techcombank', 'techcom', 'ky thuong'] },
  { bin: '970422', short: 'MB', alias: ['mb', 'mbbank', 'mb bank', 'quan doi'] },
  { bin: '970416', short: 'ACB', alias: ['acb', 'a chau'] },
  { bin: '970432', short: 'VPBank', alias: ['vpb', 'vpbank', 'vp bank', 'thinh vuong'] },
  { bin: '970423', short: 'TPBank', alias: ['tpb', 'tpbank', 'tp bank', 'tien phong'] },
  { bin: '970403', short: 'Sacombank', alias: ['stb', 'sacombank', 'sacom'] },
  { bin: '970441', short: 'VIB', alias: ['vib', 'quoc te'] },
  { bin: '970437', short: 'HDBank', alias: ['hdb', 'hdbank', 'hd bank'] },
  { bin: '970443', short: 'SHB', alias: ['shb', 'sai gon ha noi'] },
  { bin: '970448', short: 'OCB', alias: ['ocb', 'phuong dong'] },
  { bin: '970426', short: 'MSB', alias: ['msb', 'maritime', 'hang hai'] },
  { bin: '970440', short: 'SeABank', alias: ['seab', 'seabank', 'dong nam a'] },
  { bin: '970431', short: 'Eximbank', alias: ['eib', 'eximbank', 'exim'] },
  { bin: '970449', short: 'LPBank', alias: ['lpb', 'lpbank', 'lienvietpostbank', 'lien viet', 'buu dien lien viet'] },
  { bin: '970428', short: 'Nam A Bank', alias: ['nab', 'nam a', 'namabank'] },
  { bin: '970409', short: 'Bac A Bank', alias: ['bab', 'bac a', 'bacabank'] },
  { bin: '970425', short: 'ABBANK', alias: ['abb', 'abbank', 'an binh'] },
  { bin: '970412', short: 'PVcomBank', alias: ['pvcombank', 'pvcom'] },
  { bin: '970454', short: 'Viet Capital Bank', alias: ['vccb', 'ban viet', 'vietcapital'] },
  { bin: '970452', short: 'KienlongBank', alias: ['klb', 'kienlong', 'kien long'] },
  { bin: '970438', short: 'BaoViet Bank', alias: ['bvb', 'bao viet', 'baovietbank'] },
]);

import { fold } from "./vn.mjs";

/** "vietcombank", "VCB", "970436", "ngoại thương" → bank row or null */
export function findBank(text) {
  const t = fold(text).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t) return null;
  const bin = /\b(9\d{5})\b/.exec(t);
  if (bin) return BANKS.find((b) => b.bin === bin[1]) || null;
  const nospace = t.replace(/ /g, '');
  let best = null;
  for (const b of BANKS) for (const a of b.alias) {
    const hit = a.includes(' ') ? (' ' + t + ' ').includes(' ' + a + ' ') : (' ' + t + ' ').includes(' ' + a + ' ') || nospace === a.replace(/ /g, '');
    if (hit && (!best || a.length > best.len)) best = { bank: b, len: a.length };
  }
  return best ? best.bank : null;
}

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF), 4 chữ HEX in hoa — như EMVCo quy định. */
export function crc16(str) {
  let crc = 0xffff;
  for (const b of new TextEncoder().encode(str)) {
    crc ^= b << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

const tlv = (id, value) => {
  const v = String(value);
  if (v.length > 99) throw new Error('TLV_TOO_LONG');
  return id + String(v.length).padStart(2, '0') + v;
};

/** Tên chủ tài khoản kiểu ngân hàng: IN HOA, không dấu. */
export function bankName(s) {
  return fold(s).toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 50);
}

/**
 * Chuỗi VietQR. bin: 6 số NAPAS; account: số tài khoản của shop; amount: số nguyên VND (bỏ trống = khách tự nhập);
 * memo: nội dung chuyển khoản (chữ/số không dấu, ≤ 25 ký tự). Trả về chuỗi để vẽ QR.
 */
export function vietQrPayload({ bin, account, amount, memo }) {
  if (!/^\d{6}$/.test(String(bin))) throw new Error('BAD_BANK_BIN');
  if (!/^[0-9A-Za-z]{4,19}$/.test(String(account))) throw new Error('BAD_ACCOUNT');
  if (amount != null && (!Number.isSafeInteger(amount) || amount <= 0 || amount > 999999999999)) throw new Error('BAD_AMOUNT');
  const m = memo == null ? '' : String(memo);
  if (m && !/^[0-9A-Za-z .-]{1,25}$/.test(m)) throw new Error('BAD_MEMO');
  const merchant = tlv('00', 'A000000727') + tlv('01', tlv('00', bin) + tlv('01', account)) + tlv('02', 'QRIBFTTA');
  let s = tlv('00', '01') + tlv('01', amount ? '12' : '11') + tlv('38', merchant) + tlv('53', '704');
  if (amount) s += tlv('54', String(amount));
  s += tlv('58', 'VN');
  if (m) s += tlv('62', tlv('08', m));
  s += '6304';
  return s + crc16(s);
}

/** Đọc lại chuỗi VietQR (để tự kiểm và để test). Trả null nếu sai CRC hoặc sai cấu trúc. */
export function parseVietQr(payload) {
  const s = String(payload ?? '');
  if (s.length < 30 || s.slice(-8, -4) !== '6304' || crc16(s.slice(0, -4)) !== s.slice(-4)) return null;
  const read = (str) => {
    const out = {};
    for (let i = 0; i < str.length;) {
      const id = str.slice(i, i + 2); const len = Number(str.slice(i + 2, i + 4));
      if (!/^\d{2}$/.test(id) || !Number.isInteger(len) || i + 4 + len > str.length) return null;
      out[id] = str.slice(i + 4, i + 4 + len); i += 4 + len;
    }
    return out;
  };
  const top = read(s.slice(0, -8) + '');
  if (!top || top['00'] !== '01' || !top['38']) return null;
  const mai = read(top['38']); const ben = mai && mai['01'] ? read(mai['01']) : null;
  if (!mai || mai['00'] !== 'A000000727' || !ben) return null;
  const add = top['62'] ? read(top['62']) : {};
  return {
    dynamic: top['01'] === '12', bin: ben['00'], account: ben['01'], service: mai['02'],
    currency: top['53'], amount: top['54'] ? Number(top['54']) : null, country: top['58'], memo: add ? add['08'] ?? null : null,
  };
}
