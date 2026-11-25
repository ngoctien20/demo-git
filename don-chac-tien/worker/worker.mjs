/* TIEN404 Đơn chắc tiền — Cloudflare Worker (BẢN NHÁP, CHƯA DEPLOY).
 *
 *   POST /v1/hub/owner              Zalo Hub chuyển tin CHỦ SHOP tới (ký HMAC như hub ký cho n8n) → lõi → trả lời qua hub /v1/send
 *   POST /v1/bank/sepay/<link_id>   SePay báo tiền vào (header Authorization: Apikey <key>)
 *   POST /v1/bank/casso/<link_id>   Casso báo tiền vào (header Secure-Token: <key>)
 *   GET  /qr/<store>/<code>.png?s=  Ảnh mã VietQR của đơn (chữ ký chống đoán link) — .svg cũng được
 *   GET  /health
 *   cron mỗi 15 phút                   nhả hàng hết hạn giữ, báo cáo tối 21:00
 *
 * Biến môi trường: DCT_ENABLED ("true" mới chạy), DCT_PUBLIC_BASE (https://… của Worker này),
 * HUB_BASE (https://tien404-zalo-hub-…workers.dev). Secret: DCT_HUB_INBOUND_KEY (kiểm chữ ký hub gửi tới),
 * DCT_HUB_SEND_KEY (gọi hub /v1/send), DCT_QR_SIGN_KEY (ký link ảnh QR). D1 binding: DCT_DB.
 * Không có số tài khoản/khoá thật nào trong repo: tài khoản nhận tiền do CHỦ SHOP tự nhắn cho bot, lưu trong D1.
 */
import { ownerMessage, bankTransfer, tick, newShop } from '../lib/engine.mjs';
import { readBankWebhook } from '../lib/reconcile.mjs';
import { encodeQr, qrSvg } from '../lib/qr.mjs';
import { qrPng } from '../lib/png.mjs';
import { vietQrPayload } from '../lib/vietqr.mjs';

const enc = new TextEncoder();
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
const hex = (buf) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');

async function hmacHex(key, text) {
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', k, enc.encode(text)));
}
export const sha256Hex = async (t) => hex(await crypto.subtle.digest('SHA-256', enc.encode(t)));
function sameText(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
export const qrSig = async (env, store, code) => (await hmacHex(env.DCT_QR_SIGN_KEY, 'qr|' + store + '|' + code)).slice(0, 20);

/* ---------------- lưu trữ: đọc → xử lý → ghi nếu version chưa đổi (thử lại 3 lần) ---------------- */

const openOf = (st) => (st.orders.some((o) => ['cho_tra', 'tra_thieu', 'cod'].includes(o.status)) ? 1 : 0);

export async function withShop(env, storeId, now, fn) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const row = await env.DCT_DB.prepare('SELECT state, version, connection_id, owner_chat_id FROM shops WHERE store_id = ?').bind(storeId).first();
    const state = row ? JSON.parse(row.state) : newShop({ now });
    const r = await fn(state, row);
    if (!r || r.state === state) return { ...r, row };
    const text = JSON.stringify(r.state);
    if (text.length > 900_000) throw new Error('STATE_TOO_LARGE');
    const res = row
      ? await env.DCT_DB.prepare('UPDATE shops SET state = ?, version = version + 1, has_open = ?, updated_at = ?, connection_id = COALESCE(?, connection_id), owner_chat_id = COALESCE(?, owner_chat_id) WHERE store_id = ? AND version = ?')
        .bind(text, openOf(r.state), now, r.connection_id ?? null, r.owner_chat_id ?? null, storeId, row.version).run()
      : await env.DCT_DB.prepare('INSERT OR IGNORE INTO shops (store_id, connection_id, owner_chat_id, state, version, has_open, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)')
        .bind(storeId, r.connection_id ?? null, r.owner_chat_id ?? null, text, openOf(r.state), now).run();
    if (res.meta.changes === 1) return { ...r, row: { ...row, connection_id: r.connection_id ?? row?.connection_id, owner_chat_id: r.owner_chat_id ?? row?.owner_chat_id } };
  }
  throw new Error('STATE_CONFLICT');
}

/* ---------------- gửi tin cho chủ qua Zalo Hub ---------------- */

async function qrLink(env, storeId, code) {
  return env.DCT_PUBLIC_BASE.replace(/\/+$/, '') + '/qr/' + encodeURIComponent(storeId) + '/' + code + '.png?s=' + (await qrSig(env, storeId, code));
}

export async function deliver(env, deps, storeId, connectionId, chatId, out) {
  const sent = [];
  for (const m of out) {
    let text = m.text;
    // Hub /v1/send hiện chỉ gửi chữ: kèm link ảnh QR (ngân hàng/khách bấm mở ra quét được).
    // Khi hub có gửi ảnh (đề xuất trong README) thì gửi ảnh thay link.
    if (m.qr) text += '\nẢnh mã QR: ' + (await qrLink(env, storeId, m.qr.code));
    const res = await deps.fetch(env.HUB_BASE.replace(/\/+$/, '') + '/v1/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + env.DCT_HUB_SEND_KEY, 'x-tien404-connection': connectionId },
      body: JSON.stringify({ connection_id: connectionId, chat_id: chatId, text: text.slice(0, 2000) }),
      redirect: 'manual',
      signal: AbortSignal.timeout(10000),
    }).catch((e) => ({ ok: false, status: 0, e }));
    sent.push(res.status);
    if (!res.ok) deps.log('HUB_SEND_' + res.status, storeId);
  }
  return sent;
}

/* ---------------- routes ---------------- */

async function handleHub(request, env, deps) {
  const body = await request.text();
  if (body.length > 64_000) return json(413, { ok: false });
  const ts = request.headers.get('x-tien404-ts') || '';
  const sig = request.headers.get('x-tien404-signature') || '';
  const now = deps.now();
  if (!/^\d{10}$/.test(ts) || Math.abs(now / 1000 - Number(ts)) > 300) return json(401, { ok: false, error: 'STALE' });
  if (!sameText(await hmacHex(env.DCT_HUB_INBOUND_KEY, ts + '.' + body), sig)) return json(401, { ok: false, error: 'BAD_SIGNATURE' });
  let p;
  try { p = JSON.parse(body); } catch { return json(400, { ok: false, error: 'BAD_JSON' }); }
  const ev = p && p.event;
  if (!p || p.v !== 1 || typeof p.store_id !== 'string' || !/^[A-Za-z0-9_-]{3,64}$/.test(p.store_id) || !ev || !ev.chat || typeof ev.chat.id !== 'string') return json(400, { ok: false, error: 'BAD_EVENT' });
  // Chỉ chủ shop (hub đã ghép bằng mã 6 số) mới ra lệnh được. Khách nhắn vào đây thì bỏ qua.
  if (p.is_owner !== true) return json(200, { ok: true, ignored: 'NOT_OWNER' });

  const text = ev.type === 'text' ? ev.text
    : ev.type === 'image' || ev.type === 'voice' || ev.type === 'file' ? null : '';
  const r = await withShop(env, p.store_id, now, async (state, row) => {
    if (row && row.owner_chat_id && row.owner_chat_id !== ev.chat.id) return { state, out: [], refused: true };
    if (text === null) {
      return { state, out: [{ text: 'Bot chưa đọc được ảnh hay ghi âm ạ. Bác bấm biểu tượng micro trên bàn phím để NÓI, máy sẽ tự gõ ra chữ rồi gửi nhé.' }], connection_id: p.connection_id, owner_chat_id: ev.chat.id };
    }
    const res = ownerMessage(state, String(text || ''), { now, rand: deps.rand });
    return { ...res, connection_id: p.connection_id, owner_chat_id: ev.chat.id };
  });
  if (r.refused) return json(200, { ok: true, ignored: 'OTHER_OWNER' });
  deps.waitUntil(deliver(env, deps, p.store_id, p.connection_id, ev.chat.id, r.out));
  return json(200, { ok: true, replies: r.out.length });
}

async function handleBank(request, env, deps, provider, linkId) {
  if (!/^[0-9a-f]{32}$/.test(linkId)) return json(404, { ok: false });
  const link = await env.DCT_DB.prepare('SELECT id, store_id, provider, key_hash FROM bank_links WHERE id = ?').bind(linkId).first();
  if (!link || link.provider !== provider) return json(404, { ok: false });
  const auth = provider === 'sepay' ? (request.headers.get('authorization') || '').replace(/^Apikey\s+/i, '') : request.headers.get('secure-token') || '';
  if (!auth || !sameText(await sha256Hex(auth), link.key_hash)) return json(401, { ok: false });
  let body;
  try { body = JSON.parse(await request.text()); } catch { return json(400, { ok: false }); }
  const txs = readBankWebhook(body);
  const now = deps.now();
  const results = [];
  const r = await withShop(env, link.store_id, now, async (state, row) => {
    let s = state; const out = [];
    for (const tx of txs) { const x = bankTransfer(s, { ...tx, via: 'bank' }, { now, rand: deps.rand }); s = x.state; out.push(...x.out); results.push(x.result); }
    return { state: s, out, row };
  });
  await env.DCT_DB.prepare('UPDATE bank_links SET last_at = ? WHERE id = ?').bind(now, linkId).run();
  if (r.out?.length && r.row?.connection_id && r.row?.owner_chat_id) deps.waitUntil(deliver(env, deps, link.store_id, r.row.connection_id, r.row.owner_chat_id, r.out));
  // SePay cần {success:true} và HTTP 200/201 để không gửi lại.
  return json(200, { success: true, results });
}

async function handleQr(env, url, storeId, code, ext) {
  if (!/^[A-Za-z0-9_-]{3,64}$/.test(storeId) || !/^(T404[2-9A-HJKMNP-Z]{6}|SHOP)$/.test(code)) return new Response('not found', { status: 404 });
  if (!sameText(url.searchParams.get('s') || '', await qrSig(env, storeId, code))) return new Response('not found', { status: 404 });
  const row = await env.DCT_DB.prepare('SELECT state FROM shops WHERE store_id = ?').bind(storeId).first();
  const st = row && JSON.parse(row.state);
  const b = st && st.shop.bank;
  if (!b) return new Response('not found', { status: 404 });
  let payload;
  if (code === 'SHOP') payload = vietQrPayload({ bin: b.bin, account: b.account });
  else {
    const o = st.orders.find((x) => x.code === code);
    const left = o ? o.due - o.paid : 0;
    if (!o || !(left > 0) || !['cho_tra', 'tra_thieu'].includes(o.status)) return new Response('Đơn này không còn chờ chuyển khoản.', { status: 410, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    payload = vietQrPayload({ bin: b.bin, account: b.account, amount: left, memo: o.code });
  }
  const qr = encodeQr(payload);
  const headers = { 'cache-control': 'private, max-age=60', 'x-content-type-options': 'nosniff' };
  if (ext === 'svg') return new Response(qrSvg(qr), { headers: { ...headers, 'content-type': 'image/svg+xml' } });
  return new Response(qrPng(qr, { scale: 10 }), { headers: { ...headers, 'content-type': 'image/png' } });
}

export async function route(request, env, deps) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (path === '/health') return json(200, { ok: true, enabled: env.DCT_ENABLED === 'true' });
  if (env.DCT_ENABLED !== 'true') return json(503, { ok: false, error: 'DISABLED' });
  try {
    if (request.method === 'POST' && path === '/v1/hub/owner') return await handleHub(request, env, deps);
    let m;
    if (request.method === 'POST' && (m = /^\/v1\/bank\/(sepay|casso)\/([^/]+)$/.exec(path))) return await handleBank(request, env, deps, m[1], m[2]);
    if (request.method === 'GET' && (m = /^\/qr\/([^/]+)\/([^/]+)\.(png|svg)$/.exec(path))) return await handleQr(env, url, decodeURIComponent(m[1]), m[2], m[3]);
  } catch (e) {
    deps.log('ERROR ' + (e && e.message ? e.message : 'UNKNOWN'));
    return json(500, { ok: false, error: 'INTERNAL' });
  }
  return json(404, { ok: false });
}

export async function cron(env, deps) {
  if (env.DCT_ENABLED !== 'true') return { shops: 0 };
  const now = deps.now();
  const { results } = await env.DCT_DB.prepare('SELECT store_id FROM shops WHERE has_open = 1 OR updated_at > ? LIMIT 500').bind(now - 2 * 86400e3).all();
  let n = 0;
  for (const { store_id } of results) {
    const r = await withShop(env, store_id, now, async (state, row) => ({ ...tick(state, { now, rand: deps.rand }), row }));
    if (r.out?.length && r.row?.connection_id && r.row?.owner_chat_id) await deliver(env, deps, store_id, r.row.connection_id, r.row.owner_chat_id, r.out);
    n++;
  }
  return { shops: n };
}

const rand = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;

export default {
  fetch(request, env, ctx) {
    return route(request, env, { now: () => Date.now(), rand, fetch: (...a) => fetch(...a), waitUntil: (p) => ctx.waitUntil(p), log: (...a) => console.log(...a) });
  },
  scheduled(_event, env, ctx) {
    ctx.waitUntil(cron(env, { now: () => Date.now(), rand, fetch: (...a) => fetch(...a), waitUntil: (p) => ctx.waitUntil(p), log: (...a) => console.log(...a) }));
  },
};
