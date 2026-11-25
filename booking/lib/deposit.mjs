// TIEN404 Cọc — deposit amount, VietQR link and bank-transfer matching. Pure functions, no I/O.
// Money only moves customer -> shop's own bank account. TIEN404 never holds money or bank passwords.

// 30% of the price, at least 50.000đ, never more than the price, rounded UP to 1.000đ.
// fixed: a flat deposit instead (e.g. 100000). Free services (price 0) need no deposit.
export function depositFor(price, rule = { percent: 30, min: 50000, fixed: null }) {
  if (!Number.isSafeInteger(price) || price <= 0) return 0;
  let d = Number.isSafeInteger(rule?.fixed) && rule.fixed > 0
    ? rule.fixed
    : Math.max(Math.ceil((price * (rule?.percent ?? 30)) / 100 / 1000) * 1000, rule?.min ?? 0);
  if (d > price) d = price;
  return d;
}

// Transfer memo code. No 0/O/1/I/L so customers cannot mistype it. ~1 billion combinations.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const CODE_RE = /T404([2-9A-HJKMNP-Z]{6})/;
export function newTransferCode(rand) {
  let s = 'T404';
  for (let i = 0; i < 6; i++) s += ALPHABET[Math.floor(rand() * ALPHABET.length) % ALPHABET.length];
  return s;
}

// VietQR image (any banking app can scan it, amount and memo pre-filled).
// bank: 6-digit NAPAS BIN (e.g. 970436 = Vietcombank). account: the shop's own account number.
export function vietQrUrl({ bank, account, accountName, amount, code }) {
  if (!/^\d{6}$/.test(String(bank))) throw new Error('BAD_BANK_BIN');
  if (!/^\d{6,19}$/.test(String(account))) throw new Error('BAD_ACCOUNT');
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('BAD_AMOUNT');
  if (!CODE_RE.test(String(code)) || String(code).length !== 10) throw new Error('BAD_CODE');
  const q = new URLSearchParams({ amount: String(amount), addInfo: code });
  // Account holder name: banks show it in capitals without accents.
  const name = String(accountName ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'D')
    .toUpperCase().replace(/[^A-Z ]/g, '').trim().slice(0, 50);
  if (name) q.set('accountName', name);
  return 'https://img.vietqr.io/image/' + bank + '-' + account + '-compact2.png?' + q.toString();
}

// Normalise one incoming bank transfer from SePay or Casso webhooks -> { id, amount, memo, account } or null.
export function readTransfer(body) {
  if (!body || typeof body !== 'object') return null;
  // SePay: { id, transferType: "in", transferAmount, content, accountNumber, referenceCode }
  if ('transferAmount' in body) {
    if (body.transferType !== 'in') return null;
    return pack('sepay:' + body.id, body.transferAmount, body.content, body.accountNumber);
  }
  // Casso: { data: [{ id, amount, description, bank_sub_acc_id }] } -> first incoming item
  if (Array.isArray(body.data) && body.data[0]) {
    const x = body.data[0];
    return pack('casso:' + x.id, x.amount, x.description, x.bank_sub_acc_id ?? x.subAccId);
  }
  return null;
}
function pack(id, amount, memo, account) {
  const n = Number(amount);
  if (!Number.isSafeInteger(n) || n <= 0 || /undefined|null/.test(id)) return null;
  return { id: String(id).slice(0, 80), amount: n, memo: String(memo ?? '').slice(0, 300), account: String(account ?? '') };
}

// Match a transfer to a booking row (Lich_hen). Returns what to do; the caller writes the Sheet.
//   mark_paid      -> status = deposit_paid, da_coc_vnd = amount, ma_giao_dich = id
//   underpaid      -> do not confirm, tell the owner
//   mark_paid+late -> paid after the hold expired but the slot is still free
//   late_slot_taken-> paid too late and the slot was taken: owner must refund or move the booking
//   already_paid / unmatched / not_our_account -> ignore, tell the owner if unmatched
export function matchTransfer({ transfer, bookings, shopAccount, nowMs, slotStillFree }) {
  if (!transfer) return { action: 'ignore', reason: 'NOT_INCOMING' };
  if (shopAccount && transfer.account && transfer.account !== String(shopAccount)) return { action: 'ignore', reason: 'NOT_OUR_ACCOUNT' };
  if ((bookings || []).some((b) => b?.ma_giao_dich === transfer.id)) return { action: 'ignore', reason: 'ALREADY_PROCESSED' };
  const m = CODE_RE.exec(transfer.memo.toUpperCase().replace(/[^A-Z0-9]/g, ''));
  if (!m) return { action: 'unmatched', reason: 'NO_CODE' };
  const code = 'T404' + m[1];
  const b = (bookings || []).find((x) => x?.ma_chuyen_khoan === code);
  if (!b) return { action: 'unmatched', reason: 'UNKNOWN_CODE', code };
  const status = String(b.status ?? '').toLowerCase();
  if (status === 'deposit_paid' || status === 'confirmed') return { action: 'already_paid', request_id: b.request_id };
  const due = Number(b.coc_vnd);
  if (!(transfer.amount >= due)) return { action: 'underpaid', request_id: b.request_id, due, got: transfer.amount };
  if (status === 'pending') {
    const heldUntil = Date.parse(b.giu_cho_den);
    if (!Number.isFinite(heldUntil) || nowMs <= heldUntil) {
      return { action: 'mark_paid', request_id: b.request_id, amount: transfer.amount };
    }
  }
  // Paid after the hold ended (or the row was already expired/cancelled).
  if (status === 'pending' || status === 'expired') {
    return slotStillFree?.(b) ? { action: 'mark_paid', late: true, request_id: b.request_id, amount: transfer.amount }
      : { action: 'late_slot_taken', request_id: b.request_id, amount: transfer.amount };
  }
  return { action: 'unmatched', reason: 'BOOKING_' + status.toUpperCase(), request_id: b.request_id };
}
