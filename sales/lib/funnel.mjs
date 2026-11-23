// TIEN404 Sale — GĐ1 message→order counters WITHOUT personal data.
// n8n stopped saving execution data (PII), so this is the only way to measure the sales funnel.
// Each event row stores: day (Asia/Ho_Chi_Minh), shop, channel, kind, and a sender hash that
// changes every day (HMAC of sender id + day with a secret salt). No text, name, phone or raw id.

export const KINDS = Object.freeze(['inbound', 'price_shown', 'order_created', 'order_rejected_stock', 'order_duplicate', 'handoff']);
export const CHANNELS = Object.freeze(['messenger', 'zalo', 'telegram', 'web']);

// Vietnam is UTC+7 all year (no DST).
export function vnDay(ms) { return new Date(ms + 7 * 3600e3).toISOString().slice(0, 10); }

async function hmacHex(secret, msg) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const s = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg));
  return [...new Uint8Array(s)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function counterEvent({ shop, channel, kind, senderId, atMs, salt }) {
  if (typeof salt !== 'string' || salt.length < 32) throw new Error('SALT_TOO_SHORT');
  if (!/^[a-z0-9_-]{1,40}$/.test(String(shop))) throw new Error('BAD_SHOP');
  if (!CHANNELS.includes(channel)) throw new Error('BAD_CHANNEL');
  if (!KINDS.includes(kind)) throw new Error('BAD_KIND');
  if (typeof senderId !== 'string' || !senderId) throw new Error('BAD_SENDER');
  const day = vnDay(atMs);
  const sender = (await hmacHex(salt, shop + '|' + channel + '|' + senderId + '|' + day)).slice(0, 16);
  return { day, shop, channel, kind, sender };
}

// Rows for the owner's daily report: unique people who wrote, how many ordered, the rate.
export function dailyReport(events) {
  const by = new Map();
  for (const e of events) {
    const k = e.day + '|' + e.shop + '|' + e.channel;
    if (!by.has(k)) by.set(k, { day: e.day, shop: e.shop, channel: e.channel, people: new Set(), buyers: new Set(), messages: 0, orders: 0, out_of_stock: 0, handoff: 0 });
    const r = by.get(k);
    if (e.kind === 'inbound') { r.people.add(e.sender); r.messages++; }
    if (e.kind === 'order_created') { r.orders++; r.buyers.add(e.sender); }
    if (e.kind === 'order_rejected_stock') r.out_of_stock++;
    if (e.kind === 'handoff') r.handoff++;
  }
  return [...by.values()].map((r) => ({
    day: r.day, shop: r.shop, channel: r.channel, people: r.people.size, messages: r.messages, orders: r.orders,
    out_of_stock: r.out_of_stock, handoff: r.handoff,
    // share of people who wrote that day and placed at least one order
    conversion_pct: r.people.size ? Math.round((1000 * [...r.buyers].filter((s) => r.people.has(s)).length) / r.people.size) / 10 : 0,
  })).sort((a, b) => (a.day + a.shop + a.channel).localeCompare(b.day + b.shop + b.channel));
}
