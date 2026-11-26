// Đối soát chuyển khoản: chuẩn hoá tin báo từ SePay / Casso, tìm mã đơn T404XXXXXX trong nội dung.
// TIEN404 chỉ ĐỌC biến động số dư của tài khoản shop (qua dịch vụ shop tự đăng ký), không giữ tiền.

// Mã chuyển khoản: bỏ 0/O/1/I/L để khách khỏi gõ nhầm. 31^6 ≈ 887 triệu tổ hợp.
export const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const CODE_RE = /T404([2-9A-HJKMNP-Z]{6})/;

export function newCode(rand, taken = new Set()) {
  for (let tries = 0; tries < 50; tries++) {
    let s = 'T404';
    for (let i = 0; i < 6; i++) s += CODE_ALPHABET[Math.floor(rand() * CODE_ALPHABET.length) % CODE_ALPHABET.length];
    if (!taken.has(s)) return s;
  }
  throw new Error('CODE_SPACE_EXHAUSTED');
}

/** Ngân hàng hay chèn chữ, dấu chấm, cắt dòng: "MBVCB.123.T404ABC DEF.CT tu..." → "T404ABCDEF" */
export function findCode(memo) {
  const up = String(memo ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const m = CODE_RE.exec(up);
  return m ? 'T404' + m[1] : null;
}

/**
 * Webhook body của SePay hoặc Casso → { id, amount, memo, account, at } hoặc null (tiền ra / không hợp lệ).
 * SePay: { id, gateway, transactionDate, accountNumber, content, transferType: "in"|"out", transferAmount, referenceCode }
 * Casso v1: { error, data: [{ id, tid, description, amount, when, bank_sub_acc_id }] }
 * Casso v2: { error, data: { id, reference, description, amount, transactionDateTime, accountNumber } }
 */
export function readBankWebhook(body) {
  if (!body || typeof body !== 'object') return [];
  if ('transferAmount' in body) {
    if (body.transferType !== 'in') return [];
    const t = pack('sepay:' + body.id, body.transferAmount, body.content ?? body.description, body.accountNumber, body.transactionDate);
    return t ? [t] : [];
  }
  const list = Array.isArray(body.data) ? body.data : body.data && typeof body.data === 'object' ? [body.data] : [];
  return list.map((x) => pack('casso:' + (x.id ?? x.tid), x.amount, x.description, x.accountNumber ?? x.bank_sub_acc_id ?? x.subAccId, x.transactionDateTime ?? x.when))
    .filter(Boolean);
}

function pack(id, amount, memo, account, at) {
  const n = Number(amount);
  if (!Number.isSafeInteger(n) || n <= 0 || /undefined|null/.test(String(id))) return null; // amount ≤ 0 = money out
  return { id: String(id).slice(0, 80), amount: n, memo: String(memo ?? '').slice(0, 300), account: String(account ?? '').replace(/\s/g, ''), at: String(at ?? '') };
}
