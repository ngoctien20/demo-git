// TIEN404 Đơn chắc tiền — hiểu tin nhắn của CHỦ SHOP (không phải của khách). Quy tắc cố định, không dùng AI,
// nên cùng một câu luôn ra cùng một kết quả và test được. Gõ có dấu hay không dấu đều hiểu.
//
// parseOwner(text, { skus }) → { kind, ... }
//   kind: help | unpaid | report | stock | fee | yes | no | bank | product | restock | price | paid | cancel |
//         shipped | extend | resend | shopqr | shopname | bank_notice | order | unknown

import { fold, parseMoney, normPhone, isVnPhone, clean } from './vn.mjs';
import { findBank } from './vietqr.mjs';

const CODE_RE = /T404([2-9A-HJKMNP-Z]{6})/;
const MONEY_TOKEN = /(\d+(?:[.,]\d{3})+(?:\s?(?:d|đ|vnd|dong))?|\d+(?:[.,]\d{1,3})?\s?(?:k|nghin|ngan|tr|trieu|cu)(?:\d{1,3})?\b|\d{4,}(?:\s?(?:d|đ|vnd|dong))?)/g;
const HONORIFIC = /(?:^|\s)(chi|anh|co|chu|bac|em|ban|khach|ong|ba|di|cau|thim|mo|me)\s+/;

const has = (f, re) => re.test(f);

/** Order reference inside a command: "đơn 12", "#12", "12", "T404ABCDEF", or a customer name. */
export function parseRef(rest) {
  const up = String(rest ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const code = CODE_RE.exec(up);
  if (code) return { code: 'T404' + code[1] };
  const f = fold(rest);
  const no = /(?:^|\s|#|don\s*)(\d{1,5})(?!\d|\s*(?:k|nghin|ngan|tr|trieu|d|đ|vnd)\b)/.exec(f);
  if (no) return { no: Number(no[1]) };
  const name = f.replace(/\b(don|cua|cho|khach|chi|anh|co|chu|bac|em|ban|ong|ba)\b/g, ' ').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
  return name ? { name } : {};
}

function moneyAfter(f, words) {
  const re = new RegExp('(?:' + words + ')\\s*:?\\s*' + MONEY_TOKEN.source.replace(/\/g$/, ''), '');
  const m = re.exec(f);
  return m ? parseMoney(m[1]) : NaN;
}

/** Text the owner forwarded from their bank app/SMS: "+318,000VND ... ND: T404ABCDEF ..." */
export function parseBankNotice(text) {
  const raw = String(text ?? '');
  const f = fold(raw);
  if (!/(\+\s?\d|so du|sd|bien dong|giao dich|gd|tk\s?\d|tai khoan|nhan duoc|da nhan|credit|\bnd\b|noi dung)/.test(f)) return null;
  const m = /\+\s?(\d{1,3}(?:[.,]\d{3})+|\d+)(?:\s?(?:vnd|d|đ|dong))?/.exec(f)
    || /(?:nhan duoc|da nhan|tang|credit)\s*:?\s*(\d{1,3}(?:[.,]\d{3})+|\d{4,})\s?(?:vnd|d|đ|dong)/.exec(f);
  if (!m) return null;
  const amount = parseMoney(m[1]);
  if (!Number.isSafeInteger(amount) || amount <= 0) return null;
  const code = CODE_RE.exec(raw.toUpperCase().replace(/[^A-Z0-9]/g, ''));
  return { amount, code: code ? 'T404' + code[1] : null, memo: clean(raw, 300) };
}

export function parseOwner(text, { skus = [] } = {}) {
  const raw = clean(text, 500);
  const f = fold(raw).replace(/\s+/g, ' ').trim();
  if (!f) return { kind: 'unknown' };

  // One-word answers first (the bot asks yes/no questions with numbers so old fingers only press 1 or 2).
  if (/^(1|ok|oke|okie|dung|dung roi|co|u|uh|uk|vang|da|chot|duoc|yes|y)\.?!?$/.test(f)) return { kind: 'yes' };
  if (/^(2|khong|ko|k|sai|thoi|huy bo|no|n)\.?!?$/.test(f)) return { kind: 'no' };
  if (/^(0|\?|menu|help|huong dan|giup|giup do|chi dan|lam sao|cach dung|bat dau|start|hi|alo|xin chao|chao)\b/.test(f) && f.length <= 30) return { kind: 'help' };

  if (has(f, /^(ai chua tra|chua tra|chua chuyen|ai no|con no|no tien|cho tien|don cho|don chua tra|ds no)/)) return { kind: 'unpaid' };
  if (has(f, /^(hom nay|bao cao|tong ket|tong ngay|doanh thu|thong ke|ket so)/)) return { kind: 'report' };
  if (has(f, /^(kho|ton kho|con hang|xem kho|hang con|het hang)\b/)) return { kind: 'stock' };
  if (has(f, /^(phi|cuoc|tien phi|phi thang|goi cuoc)\b/)) return { kind: 'fee' };
  if (has(f, /^(ten shop|ten cua hang|doi ten shop|shop ten)\s+\S/)) return { kind: 'shopname', name: clean(raw.replace(/^\s*\S+\s+\S+(\s+(shop|hàng|hang))?\s*/i, ''), 40) };
  if (has(f, /^(in qr|qr shop|qr cua hang|ma qr shop|the qr|qr quay)\b/)) return { kind: 'shopqr' };

  let m;
  // Forwarded bank notification (checked first: banks write "TK", "đã nhận", "+318,000")
  const notice = parseBankNotice(raw);
  if (notice && (notice.code || /\+\s?\d/.test(f))) return { kind: 'bank_notice', ...notice };

  if ((m = /^(gia han|giu them|giu tiep|giu hang)\s*(.*)$/.exec(f))) return { kind: 'extend', ref: parseRef(m[2]) };

  // Bank account setup: "ngân hàng MB 0123456789 NGUYEN VAN A"
  if (has(f, /^(cai |doi |sua )?(ngan hang|nh |stk|so tai khoan|tai khoan|tk )/)) {
    const bank = findBank(f.replace(/^(cai |doi |sua )?(ngan hang|nh |stk|so tai khoan|tai khoan|tk )/, ' '));
    const acc = /(?:^|\s)(\d[\d ]{5,22}\d)(?:\s|$)/.exec(f.replace(/\b9\d{5}\b/, ' '));
    const account = acc ? acc[1].replace(/\s/g, '') : null;
    // Tên chủ tài khoản: phần chữ đứng sau số tài khoản ("... 0123456789 Nguyễn Văn A").
    const digits = account ? raw.search(new RegExp(account.split('').join('\\s?'))) : -1;
    const tail = digits >= 0 ? raw.slice(digits).replace(/^[\d\s]+/, '') : '';
    const name = tail.replace(/[^\p{L} ]/gu, ' ').replace(/\s+/g, ' ').trim();
    return { kind: 'bank', bank, account: account && /^\d{6,19}$/.test(account) ? account : null, holder: name || null };
  }

  // Product setup: "thêm hàng A003 áo thun đen 159k còn 18"
  if (has(f, /^(them hang|them sp|them san pham|hang moi|sp moi|san pham moi|them ma)\b/)) {
    const body = raw.replace(/^\S+\s+\S+(\s+(phẩm|pham))?/i, ' ');
    const sku = /\b([A-Za-z]{1,3}\d{2,5})\b/.exec(body);
    const price = moneyAfter(fold(body), 'gia|ban|') ;
    const stock = /(?:con|ton|sl|so luong|co)\s*:?\s*(\d{1,6})\b(?!\s*(?:k|nghin|ngan|tr|d|đ))/.exec(fold(body)) || /(\d{1,6})\s*(?:cai|chiec|sp|doi|bo|hop|cuon|goi|chai|lo|tui)\b/.exec(fold(body));
    let name = body;
    if (sku) name = name.replace(sku[0], ' ');
    name = name.replace(/\d+(?:[.,]\d+)*\s*(?:k|nghìn|ngàn|tr|triệu|đ|vnd|cái|chiếc|sp)?/gi, ' ').replace(/\b(giá|gia|bán|ban|còn|con|tồn|ton|sl|số lượng|so luong)\b/gi, ' ').replace(/\s+/g, ' ').trim();
    return { kind: 'product', sku: sku ? sku[1].toUpperCase() : null, name: clean(name, 60) || null, price, stock: stock ? Number(stock[1]) : NaN };
  }
  // "nhập 10 A003" / "nhập thêm A003 10"
  if (has(f, /^(nhap|nhap them|them so luong|ve hang|hang ve)\b/)) {
    const sku = /\b([a-z]{1,3}\d{2,5})\b/.exec(f);
    const qty = /\b(\d{1,6})\b/.exec(f.replace(sku ? sku[0] : '\u0000', ' '));
    return { kind: 'restock', sku: sku ? sku[1].toUpperCase() : null, qty: qty ? Number(qty[1]) : NaN };
  }
  if (has(f, /^(gia|doi gia|sua gia)\s/)) {
    const sku = /\b([a-z]{1,3}\d{2,5})\b/.exec(f);
    const body = sku ? f.replace(sku[0], ' ') : f;
    const m = new RegExp(MONEY_TOKEN.source).exec(body.replace(/^(gia|doi gia|sua gia)/, ' '));
    return { kind: 'price', sku: sku ? sku[1].toUpperCase() : null, price: m ? parseMoney(m[1]) : NaN };
  }

  if ((m = /^(da nhan tien|da nhan|nhan tien|nhan du|tien ve|da tra|tra roi|da chuyen|chuyen roi|da thanh toan|xong tien)\s*(.*)$/.exec(f))) {
    const rest = m[2];
    const money = new RegExp(MONEY_TOKEN.source).exec(rest);
    const amount = money ? parseMoney(money[1]) : NaN;
    return { kind: 'paid', ref: parseRef(money ? rest.replace(money[0], ' ') : rest), amount: Number.isSafeInteger(amount) ? amount : null };
  }
  if ((m = /^(huy don|huy|bo don|khach huy|khach bom|bom)\s*(.*)$/.exec(f))) return { kind: 'cancel', ref: parseRef(m[2]) };
  if ((m = /^(da giao|giao roi|da gui|gui roi|da ship|ship roi|xong don)\s*(.*)$/.exec(f))) return { kind: 'shipped', ref: parseRef(m[2]) };
  if ((m = /^(gui lai|qr|ma qr|lay qr|xem don|don)\s+(.*)$/.exec(f)) && !/\b[a-z]{1,3}\d{2,5}\b.*\d|\d.*\b[a-z]{1,3}\d{2,5}\b/.test(m[2])) {
    return { kind: 'resend', ref: parseRef(m[2]) };
  }

  return parseOrder(raw, f, skus);
}

/** "chị Lan 2 cái A003 giao Q7 0912345678 ship 30k" → order draft */
export function parseOrder(raw, f = fold(raw), skus = []) {
  const known = new Set(skus.map((s) => String(s).toUpperCase()));
  let work = ' ' + f + ' ';

  // Phone
  let phone = null;
  const ph = /(?:\+?84|\b0)(?:[\s.-]?\d){9}\b/.exec(work);
  if (ph && isVnPhone(normPhone(ph[0]))) { phone = normPhone(ph[0]); work = work.replace(ph[0], ' '); }

  // Fees / discount / deposit with a keyword before the amount
  const cut = (words) => {
    const re = new RegExp('(?:^|\\s)(?:' + words + ')\\s*:?\\s*' + MONEY_TOKEN.source.replace(/\/g$/, ''));
    const mm = re.exec(work);
    if (!mm) return NaN;
    work = work.replace(mm[0], ' ');
    return parseMoney(mm[1]);
  };
  const ship = cut('phi ship|tien ship|ship|phi giao|cuoc|van chuyen');
  const discount = cut('giam gia|giam|bot|tru|chiet khau|ck');
  const deposit = cut('coc truoc|dat coc|coc');
  const cod = /(?:^|\s)(cod|thu ho|ship cod|nhan hang tra tien|tra khi nhan)(?:\s|$)/.test(work);
  if (cod) work = work.replace(/(?:^|\s)(cod|thu ho|ship cod|nhan hang tra tien|tra khi nhan)(?=\s|$)/g, ' ');

  // Items: "2 cái A003", "A003 x2", "A003 2 cái", "2A003", "A003" (qty 1)
  const items = [];
  const unknown = [];
  const UNIT = '(?:cai|c|chiec|sp|doi|bo|hop|cuon|goi|chai|lo|tui|x)?';
  const itemRe = new RegExp('(?:(\\d{1,4})\\s*' + UNIT + '\\s*)?(?<![a-z])([a-z]{1,3}\\d{2,5})(?![a-z0-9])(?:\\s*(?:x|\\*|sl|so luong)?\\s*(\\d{1,4})\\s*' + UNIT + '(?=\\s|$|,|;))?', 'g');
  work = work.replace(itemRe, (all, q1, sku, q2) => {
    const S = sku.toUpperCase();
    const isPrice = q2 && /^\s*(k|tr)/.test(all.slice(all.lastIndexOf(q2) + q2.length));
    const qty = Number(q1 || (!isPrice && q2) || 1);
    if (!known.has(S)) {
      // Looks like a product code the shop has not added yet (Q7/P12 are districts/wards, not codes).
      if (/^[A-Z]{1,3}\d{3,5}$/.test(S) && !/^[QP]\d/.test(S)) { unknown.push(S); return ' '; }
      return all;
    } else {
      const prev = items.find((i) => i.sku === S);
      if (prev) prev.qty += qty; else items.push({ sku: S, qty });
    }
    return ' ';
  });

  // Remaining amount = total the owner stated (the first money token left)
  let amount = NaN;
  const am = new RegExp('(?:^|\\s)(?:tong|tong cong|thu|lay|gia|het|la)?\\s*:?\\s*' + MONEY_TOKEN.source.replace(/\/g$/, '')).exec(work);
  if (am) { amount = parseMoney(am[1]); work = work.replace(am[0], ' '); }

  // Address: after giao/gửi/ship tới/địa chỉ… — taken from the original text to keep accents.
  let address = null;
  const ad = /(?:^|\s)(?:giao(?: toi| den| ve)?|gui(?: toi| den| ve)?|ship toi|ship den|dia chi|dc|d\/c|o)\s*:?\s+(.+)$/.exec(work.replace(/\s+/g, ' '));
  if (ad) {
    address = ad[1].trim();
    work = work.replace(ad[0], ' ');
  }

  // Name: honorific + up to 3 words, else leading words.
  let name = null;
  const hn = HONORIFIC.exec(work);
  if (hn) {
    const after = work.slice(hn.index + hn[0].length).trim().split(/\s+/).filter((w) => /^[a-z]+$/.test(w)).slice(0, 2);
    if (after.length) name = hn[1] + ' ' + after.join(' ');
  }
  if (!name) {
    const words = work.trim().split(/\s+/).filter((w) => /^[a-z]{2,}$/.test(w) && !/^(don|tao|len|moi|cho|khach|mua|lay|dat|ban)$/.test(w)).slice(0, 3);
    if (words.length) name = words.join(' ');
  }

  if (!items.length && !unknown.length && !Number.isSafeInteger(amount)) return { kind: 'unknown' };
  return {
    kind: 'order',
    items, unknown, amount: Number.isSafeInteger(amount) ? amount : null,
    ship: Number.isSafeInteger(ship) ? ship : 0, discount: Number.isSafeInteger(discount) ? discount : 0,
    deposit: Number.isSafeInteger(deposit) ? deposit : 0, cod,
    phone, address: address ? restoreAccents(raw, address) : null, name: name ? restoreAccents(raw, name) : null,
  };
}

/** Find the folded phrase back in the original text so "chi lan" shows as "chị Lan". */
function restoreAccents(raw, folded) {
  const words = raw.split(/\s+/);
  const target = folded.split(/\s+/);
  for (let i = 0; i + target.length <= words.length; i++) {
    const seg = words.slice(i, i + target.length);
    if (seg.map((w) => fold(w).replace(/[^a-z0-9/]/g, '')).join(' ') === target.map((w) => w.replace(/[^a-z0-9/]/g, '')).join(' ')) {
      return clean(seg.join(' ').replace(/[,;.]+$/, ''), 80);
    }
  }
  return clean(folded, 80);
}
