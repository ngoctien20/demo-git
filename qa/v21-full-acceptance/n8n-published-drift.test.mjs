// TIEN404 V21.0 Round 2 — n8n Published vs Draft differential (OFFLINE, no n8n call).
// Code below is copied verbatim (read-only) from n8n on 2026-11-21:
//   KrSn4DNR9ALX5ng4 "Create Order Tool (AI_SALES_DEMO)"  published=4740251a… draft=af9ee686…
//   U2DJsxzSYPH5hRop "AI SALES - Revenue Report"         published=978b5a8d… draft=e4e16b90…
// Purpose: prove whether the PUBLISHED (live) parser accepts wrong VND prices that the
// unpublished DRAFT already rejects. No secrets, no customer data.
// Reachability (independent review): price is read from the owner's Products sheet, never from
// the customer/AI. The defect fires only if the owner types a TEXT price such as "1.2tr";
// numeric cells take the typeof-number path. Revenue zero-count fires only on hand-formatted totals.
import test from 'node:test';
import assert from 'node:assert/strict';

// --- Create Order: published toNumber (live) ---
const publishedToNumber = (v) => {
  if (typeof v === 'number') return v;
  const s = String(v ?? '')
    .replace(/[^0-9.,-]/g, '')
    .replace(/[.,](?=\d{3}(\D|$))/g, '')
    .replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
};
// --- Create Order: draft toNumber (NOT published) ---
const draftToNumber = (v) => {
  if (typeof v === 'number') return Number.isSafeInteger(v) && v >= 0 ? v : NaN;
  let s = String(v ?? '').trim().toLowerCase().replace(/(?:vnd|₫|đ)\s*$/u, '').replace(/\s+/g, '');
  if (/^\d{1,3}(?:,\d{3})+\.00$/.test(s)) s = s.replace(/,/g, '').slice(0, -3);
  else if (/^\d{1,3}(?:\.\d{3})+,00$/.test(s)) s = s.replace(/\./g, '').slice(0, -3);
  else if (/^\d{1,3}(?:[.,]\d{3})+$/.test(s)) s = s.replace(/[.,]/g, '');
  else if (/^\d+\.00$/.test(s)) s = s.slice(0, -3);
  if (!/^\d+$/.test(s)) return NaN;
  const n = Number(s);
  return Number.isSafeInteger(n) ? n : NaN;
};
// Published acceptance rule for price: finite and > 0. Draft: safe integer and > 0.
const publishedAcceptsPrice = (p) => { const n = publishedToNumber(p); return Number.isFinite(n) && n > 0 ? n : null; };
const draftAcceptsPrice = (p) => { const n = draftToNumber(p); return Number.isSafeInteger(n) && n > 0 ? n : null; };

test('both versions parse ordinary VND prices identically', () => {
  for (const [raw, want] of [['159000', 159000], ['159.000', 159000], ['159.000đ', 159000], ['1.234.000', 1234000], ['1,234,000.00', 1234000], [329000, 329000]]) {
    assert.equal(publishedAcceptsPrice(raw), want, `published ${raw}`);
    assert.equal(draftAcceptsPrice(raw), want, `draft ${raw}`);
  }
});

test('DEFECT (published): shorthand "1.2tr" becomes 1.2 VND and an order can be created at the wrong price', () => {
  assert.equal(publishedAcceptsPrice('1.2tr'), 1.2);   // live behaviour: wrong price accepted
  assert.equal(draftAcceptsPrice('1.2tr'), null);       // draft: rejected (invalid_price)
});

test('DEFECT (published): "12.5k" becomes 12.5 VND', () => {
  assert.equal(publishedAcceptsPrice('12.5k'), 12.5);
  assert.equal(draftAcceptsPrice('12.5k'), null);
});

test('DEFECT (published): decimal comma "1,5" becomes 1.5 VND; fractional numeric cell accepted', () => {
  assert.equal(publishedAcceptsPrice('1,5'), 1.5);
  assert.equal(publishedAcceptsPrice(159000.7), 159000.7);
  assert.equal(draftAcceptsPrice('1,5'), null);
  assert.equal(draftAcceptsPrice(159000.7), null);
});

test('LATENT (published, not reachable live: stock < qty rejects first): quantity 1e20 passes Number.isInteger', () => {
  const qty = 1e20;
  assert.equal(Number.isInteger(qty), true);          // published guard
  assert.equal(Number.isSafeInteger(qty), false);     // draft guard rejects
  assert.equal(Number.isSafeInteger(329000 * qty), false);
});

test('NOTE (draft stricter): stock cell "10 cái" accepted by published, rejected by draft (possible false reject)', () => {
  assert.equal(publishedToNumber('10 cái'), 10);
  assert.ok(Number.isNaN(draftToNumber('10 cái')));
});

// --- Revenue Report: published revenue reducer (live, runs daily 21:00 Asia/Ho_Chi_Minh) ---
const publishedRevenue = (orders) => orders
  .filter((o) => String(o.status || '').trim().toLowerCase() === 'paid')
  .reduce((sum, o) => sum + (Number(o.total) || 0), 0);

test('DEFECT (published revenue): formatted totals are silently counted as 0', () => {
  const orders = [
    { status: 'paid', total: '987000' },
    { status: 'paid', total: '1.200.000' },
    { status: 'paid', total: '987.000₫' },
  ];
  assert.equal(publishedRevenue(orders), 987000);     // expected 3,174,000 — 2,187,000 lost silently
  const draftTotal = orders.reduce((s, o) => s + draftToNumber(o.total), 0);
  assert.equal(draftTotal, 3174000);
});

// --- Published order id: 'ORD-'+yyyymmddHHMMSS+'-'+4 random digits, no uniqueness check ---
test('RISK (published order id): birthday bound for 2 orders in the same second is ~1/9000', () => {
  const p = 1 / 9000;
  assert.ok(p > 1e-4 && p < 2e-4);
});
