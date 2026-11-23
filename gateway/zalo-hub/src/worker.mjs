/* TIEN404 Zalo Hub — one shared gateway for many shops' Zalo Bots (Zalo Bot Platform, official API).
 * PROPOSED, not deployed. Owner approved building the shared gateway on 2026-11-23 (code + Draft PR first).
 *
 * Routes
 *   POST /v1/zalo/wh/:path_id      Zalo → hub. Per-shop path + per-shop secret (header X-Bot-Api-Secret-Token).
 *                                   The shop is decided by the path, never by the payload. Answers 200 fast,
 *                                   forwards a normalized, HMAC-signed event to that shop's flow (forward_url).
 *   POST /v1/send                   Shop flow (n8n) → hub → Zalo. Signed with the shop's forward key; the flow
 *                                   never holds the Zalo token. chat_id must be a user who wrote to that bot.
 *   POST /v1/admin/connect          Bearer ZH_ADMIN_KEY. Paste token (whole Zalo message OK) → getMe → setWebhook.
 *   POST /v1/admin/disconnect       deleteWebhook (best effort) + wipe sealed secrets.
 *   POST /v1/admin/pairing          New 6-digit owner code (e.g. after it expired).
 *   POST /v1/admin/disable|enable   Pause / resume one shop without touching its Zalo settings.
 *   GET  /v1/admin/connections?store_id=   Masked status only.
 *
 * Kill switches: ZH_ENABLED='true' (whole hub), ZH_SEND_ENABLED='true' (outbound), per-shop status 'disabled'.
 */
import { seal, open, sha256Hex, secureEqual, randomId, randomSecret, randomCode, signBody, verifyBody } from './crypto.mjs';
import * as zalo from './zalo-api.mjs';
import * as db from './store.mjs';

export const MAX_BODY = 16 * 1024;
const PAIRING_TTL_MS = 30 * 60 * 1000;
const PAIRING_MAX_ATTEMPTS = 5;
const DEDUPE_KEEP_MS = 3 * 24 * 3600 * 1000;
const DEFAULT_MONTHLY_CAP = 3000; // Zalo Basic plan, bot.zapps.me (2026-11-23)
const DEFAULT_USER_WARN = 40; // Basic plan allows 50 users per bot

const json = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
});
const monthOf = (ms) => new Date(ms).toISOString().slice(0, 7);
const intEnv = (v, d) => (Number.isSafeInteger(Number(v)) && Number(v) > 0 ? Number(v) : d);
const STORE_ID_RE = /^[a-z0-9][a-z0-9_-]{1,63}$/;
const ID_RE = /^[0-9a-f]{32}$/;
const CHAT_ID_RE = /^[A-Za-z0-9._-]{1,64}$/;

async function readJson(request) {
  const len = Number(request.headers.get('content-length') || 0);
  if (len > MAX_BODY) return { error: 'BODY_TOO_LARGE' };
  const text = await request.text();
  if (text.length > MAX_BODY) return { error: 'BODY_TOO_LARGE' };
  if (!text) return { text, body: {} };
  try { return { text, body: JSON.parse(text) }; } catch { return { error: 'BAD_JSON' }; }
}

export function forwardUrlAllowed(env, url) {
  let u;
  try { u = new URL(url); } catch { return false; }
  if (u.protocol !== 'https:' || u.username || u.password || u.port) return false;
  const hosts = String(env.ZH_FORWARD_HOSTS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return hosts.includes(u.hostname.toLowerCase());
}

function publicView(c, userCount) {
  return {
    connection_id: c.id, store_id: c.store_id, status: c.status, bot_id: c.bot_id, bot_name: c.bot_name,
    token_last4: c.token_last4, owner_paired: !!c.owner_chat_id, sent_month: c.sent_month, sent_count: Number(c.sent_count || 0),
    users: userCount, connected_at: c.connected_at, revoked_at: c.revoked_at, last_ok_at: c.last_ok_at,
  };
}

/** Zalo webhook body → channel-neutral event. Unknown/unsupported content is kept as type only. */
export function normalize(body) {
  const ev = body && typeof body === 'object' ? (body.result && body.result.event_name ? body.result : body) : null;
  if (!ev || typeof ev.event_name !== 'string' || !ev.message || typeof ev.message !== 'object') return null;
  const m = ev.message;
  const type = ({
    'message.text.received': 'text', 'message.image.received': 'image', 'message.sticker.received': 'sticker',
    'message.voice.received': 'voice', 'message.file.received': 'file', 'message.link.received': 'link',
    'message.unsupported.received': 'unsupported',
  })[ev.event_name] || 'other';
  const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : undefined);
  const from = m.from || {};
  const chat = m.chat || {};
  return {
    type,
    event_name: ev.event_name,
    message_id: str(m.message_id, 128),
    date: Number.isFinite(m.date) ? m.date : undefined,
    user: { id: str(from.id, 64), display_name: str(from.display_name, 120), is_bot: from.is_bot === true },
    chat: { id: str(chat.id, 64), type: str(chat.chat_type, 16) },
    text: str(m.text, 4000),
    caption: str(m.caption, 2000),
    photo_url: str(m.photo_url, 2000),
    sticker: str(m.sticker, 128),
    voice_url: str(m.voice_url, 2000),
    file_url: str(m.file_url, 2000),
    file_name: str(m.file_name, 255),
    file_size: Number.isFinite(m.file_size) ? m.file_size : undefined,
    link_url: str(m.link_url, 2000),
  };
}

async function tokenOf(env, c) {
  return open(env, c.token_sealed, c.id, c.store_id, 'token');
}
async function forwardKeyOf(env, c) {
  return open(env, c.forward_key_sealed, c.id, c.store_id, 'forward_key');
}

/* ---------------- Zalo → hub ---------------- */
async function handleWebhook(request, env, deps, pathId) {
  if (!/^[0-9a-f]{32}$/.test(pathId)) return json(404, { ok: false });
  const c = await db.byPath(env.ZH_DB, pathId);
  if (!c) return json(404, { ok: false });
  if (!(await sha256Hex(request.headers.get('x-bot-api-secret-token') || '').then((h) => secureEqual(h, c.wh_secret_hash)))) {
    return json(403, { ok: false });
  }
  if (env.ZH_ENABLED !== 'true') return json(200, { ok: true, ignored: 'HUB_DISABLED' });
  if (c.status === 'revoked' || c.status === 'disabled') return json(200, { ok: true, ignored: 'CONNECTION_' + c.status.toUpperCase() });

  const r = await readJson(request);
  if (r.error) return json(200, { ok: true, ignored: r.error });
  const ev = normalize(r.body);
  if (!ev) return json(200, { ok: true, ignored: 'NO_MESSAGE' }); // e.g. setWebhook / testWebhook verification ping
  if (!ev.message_id || !ev.chat.id || !CHAT_ID_RE.test(ev.chat.id)) return json(200, { ok: true, ignored: 'BAD_EVENT' });
  if (ev.user.is_bot) return json(200, { ok: true, ignored: 'FROM_BOT' });

  const now = deps.now();
  if (!(await db.claimInbound(env.ZH_DB, c.id, ev.message_id, now))) return json(200, { ok: true, ignored: 'DUPLICATE' });

  if (c.status === 'pending_owner') {
    deps.waitUntil(pairOwner(env, deps, c, ev, now));
    return json(200, { ok: true, accepted: 'PAIRING' });
  }

  if (ev.user.id) await db.rememberUser(env.ZH_DB, c.id, ev.user.id, now);
  deps.waitUntil(forward(env, deps, c, ev, now));
  if (Math.random() < 0.02) deps.waitUntil(db.pruneInbound(env.ZH_DB, now - DEDUPE_KEEP_MS));
  return json(200, { ok: true, accepted: 'FORWARDED' });
}

async function pairOwner(env, deps, c, ev, now) {
  const code = typeof ev.text === 'string' ? ev.text.replace(/\s+/g, '') : '';
  if (!/^\d{6}$/.test(code)) return; // stay silent to strangers while pairing
  if (!c.pairing_code_hash || !c.pairing_expires_at || now > Number(c.pairing_expires_at)) return;
  if (Number(c.pairing_attempts) >= PAIRING_MAX_ATTEMPTS) return;
  if (!(await secureEqual(await sha256Hex(code), c.pairing_code_hash))) {
    await db.bumpPairingAttempts(env.ZH_DB, c.id, now);
    return;
  }
  const res = await db.activateOwner(env.ZH_DB, c.id, ev.chat.id, now);
  if (!res || !res.meta || res.meta.changes !== 1) return;
  if (ev.user.id) await db.rememberUser(env.ZH_DB, c.id, ev.user.id, now);
  const token = await tokenOf(env, c);
  const r = await zalo.sendMessage(deps.fetch, token, ev.chat.id, 'Đã nối xong. Từ giờ trợ lý TIEN404 sẽ trả lời khách nhắn vào bot này, và báo đơn cho bác ở đây.');
  if (r.ok) await db.countSend(env.ZH_DB, c.id, monthOf(now), now);
}

async function forward(env, deps, c, ev, now) {
  const key = await forwardKeyOf(env, c);
  const users = await db.countUsers(env.ZH_DB, c.id);
  const payload = JSON.stringify({
    v: 1,
    channel: 'zalo_bot',
    connection_id: c.id,
    store_id: c.store_id,
    is_owner: !!c.owner_chat_id && ev.chat.id === c.owner_chat_id,
    usage: { users, user_warn: users >= intEnv(env.ZH_USER_WARN, DEFAULT_USER_WARN), sent_month: c.sent_month, sent_count: Number(c.sent_count || 0) },
    event: ev,
  });
  const ts = String(Math.floor(now / 1000));
  try {
    const res = await deps.fetch(c.forward_url, {
      method: 'POST',
      // Signature for code flows; x-tien404-forward-key lets an n8n Webhook node check it with a Header Auth credential.
      headers: { 'content-type': 'application/json', 'x-tien404-ts': ts, 'x-tien404-signature': await signBody(key, ts, payload), 'x-tien404-connection': c.id, 'x-tien404-forward-key': key },
      body: payload,
      redirect: 'manual',
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) deps.log('FORWARD_HTTP_' + res.status, c.id);
  } catch (e) {
    deps.log('FORWARD_FAILED ' + (e && e.name ? e.name : 'ERR'), c.id);
  }
}

/* ---------------- shop flow → hub → Zalo ---------------- */
async function handleSend(request, env, deps) {
  if (env.ZH_ENABLED !== 'true' || env.ZH_SEND_ENABLED !== 'true') return json(503, { ok: false, error: 'SEND_DISABLED' });
  const r = await readJson(request);
  if (r.error) return json(400, { ok: false, error: r.error });
  const b = r.body;
  const connId = request.headers.get('x-tien404-connection') || '';
  if (!ID_RE.test(connId) || b.connection_id !== connId) return json(401, { ok: false, error: 'UNAUTHORIZED' });
  const c = await db.byId(env.ZH_DB, connId);
  if (!c || !c.forward_key_sealed) return json(401, { ok: false, error: 'UNAUTHORIZED' });
  const now = deps.now();
  const fk = await forwardKeyOf(env, c);
  // Two ways to authenticate, same per-shop key: HMAC over ts.body (code flows), or
  // "Authorization: Bearer <forward_key>" (n8n Header Auth credential, no code needed).
  const auth = request.headers.get('authorization') || '';
  const ok = request.headers.get('x-tien404-signature')
    ? await verifyBody(fk, request.headers.get('x-tien404-ts'), r.text, request.headers.get('x-tien404-signature'), now)
    : auth.startsWith('Bearer ') && (await secureEqual(auth.slice(7), fk));
  if (!ok) return json(401, { ok: false, error: 'UNAUTHORIZED' });

  if (c.status !== 'active') return json(409, { ok: false, error: 'CONNECTION_' + String(c.status).toUpperCase() });
  if (typeof b.chat_id !== 'string' || !CHAT_ID_RE.test(b.chat_id)) return json(400, { ok: false, error: 'BAD_CHAT_ID' });
  if (typeof b.text !== 'string' || b.text.length < 1 || b.text.length > 2000) return json(400, { ok: false, error: 'BAD_TEXT' });
  if (b.chat_id !== c.owner_chat_id && !(await db.isKnownUser(env.ZH_DB, c.id, b.chat_id))) return json(403, { ok: false, error: 'UNKNOWN_CHAT' });

  const cap = intEnv(env.ZH_MONTHLY_CAP, DEFAULT_MONTHLY_CAP);
  if (c.sent_month === monthOf(now) && Number(c.sent_count) >= cap) return json(429, { ok: false, error: 'MONTHLY_CAP' });

  const token = await tokenOf(env, c);
  if (b.typing === true) await zalo.sendChatAction(deps.fetch, token, b.chat_id, 'typing');
  const styles = Array.isArray(b.text_styles) ? b.text_styles.slice(0, 50) : undefined;
  let res = await zalo.sendMessage(deps.fetch, token, b.chat_id, b.text, styles);
  if (!res.ok && styles && res.error_code === 400) res = await zalo.sendMessage(deps.fetch, token, b.chat_id, b.text);

  if (res.ok) {
    const n = await db.countSend(env.ZH_DB, c.id, monthOf(now), now);
    return json(200, { ok: true, message_id: res.result && res.result.message_id, sent_count: n, cap_warn: n >= Math.floor(cap * 0.8) });
  }
  if (res.error_code === 401) await db.setStatus(env.ZH_DB, c.id, 'needs_reconnect', now);
  if (res.error_code === 429) await db.setStatus(env.ZH_DB, c.id, 'quota_exceeded', now);
  return json(502, { ok: false, error: 'ZALO_' + res.error_code });
}

/* ---------------- admin ---------------- */
async function adminAuthorized(request, env) {
  const key = env.ZH_ADMIN_KEY;
  if (typeof key !== 'string' || key.length < 32) return false;
  const h = request.headers.get('authorization') || '';
  return h.startsWith('Bearer ') && secureEqual(h.slice(7), key);
}

async function newPairing(env, id, now) {
  const code = randomCode();
  const expiresAt = now + PAIRING_TTL_MS;
  return { code, expiresAt, hash: await sha256Hex(code) };
}

async function handleConnect(env, deps, b) {
  const storeId = b.store_id;
  if (typeof storeId !== 'string' || !STORE_ID_RE.test(storeId)) return json(400, { ok: false, error: 'BAD_STORE_ID' });
  if (!forwardUrlAllowed(env, b.forward_url)) return json(400, { ok: false, error: 'FORWARD_URL_NOT_ALLOWED' });
  const token = zalo.extractToken(b.token_text);
  if (!token) return json(400, { ok: false, error: 'TOKEN_NOT_FOUND' });
  const base = String(env.ZH_PUBLIC_BASE_URL || '').replace(/\/+$/, '');
  if (!/^https:\/\/[^/]+$/.test(base)) return json(500, { ok: false, error: 'PUBLIC_BASE_URL_MISSING' });

  const me = await zalo.getMe(deps.fetch, token);
  if (!me.ok || !me.result || !me.result.id) return json(400, { ok: false, error: 'TOKEN_REJECTED', zalo_error: me.error_code });
  const botId = String(me.result.id);
  const botName = typeof me.result.account_name === 'string' ? me.result.account_name.slice(0, 120) : null;

  const other = await db.liveByBot(env.ZH_DB, botId);
  if (other) return json(409, { ok: false, error: other.store_id === storeId ? 'BOT_ALREADY_CONNECTED' : 'BOT_OWNED_BY_OTHER_STORE' });
  if (await db.liveByStore(env.ZH_DB, storeId)) return json(409, { ok: false, error: 'STORE_HAS_LIVE_BOT' });

  const now = deps.now();
  const id = randomId(16);
  const pathId = randomId(16);
  const whSecret = randomSecret(32);
  const forwardKey = randomSecret(32);
  const p = await newPairing(env, id, now);
  await db.insert(env.ZH_DB, {
    id, store_id: storeId, status: 'pending_owner', bot_id: botId, bot_name: botName,
    token_sealed: await seal(env, token, id, storeId, 'token'), token_last4: zalo.last4(token), key_version: 1,
    path_id: pathId, wh_secret_hash: await sha256Hex(whSecret), forward_url: b.forward_url,
    forward_key_sealed: await seal(env, forwardKey, id, storeId, 'forward_key'),
    pairing_code_hash: p.hash, pairing_expires_at: p.expiresAt, connected_at: now,
  });

  const webhookUrl = `${base}/v1/zalo/wh/${pathId}`;
  const manual = b.set_webhook === false;
  if (!manual) {
    const wh = await zalo.setWebhook(deps.fetch, token, webhookUrl, whSecret);
    const verification = wh.ok && wh.result && wh.result.verification;
    if (!wh.ok || (verification && verification.ok === false)) {
      await db.hardDelete(env.ZH_DB, id);
      return json(502, { ok: false, error: 'SET_WEBHOOK_FAILED', zalo_error: wh.error_code, outcome: verification ? verification.outcome : undefined });
    }
  }
  return json(200, {
    ok: true,
    connection_id: id,
    store_id: storeId,
    bot_id: botId,
    bot_name: botName,
    token_last4: zalo.last4(token),
    status: 'pending_owner',
    pairing_code: p.code,
    pairing_expires_at: new Date(p.expiresAt).toISOString(),
    // Shown once. Goes into the shop flow's credential (verifies forwards, signs /v1/send).
    forward_key: forwardKey,
    // Only in manual mode: the owner pastes these two into Zalo Bot Creator → Thiết lập chung.
    manual_webhook: manual ? { url: webhookUrl, secret_token: whSecret } : undefined,
  });
}

async function handleDisconnect(env, deps, b) {
  if (!ID_RE.test(b.connection_id || '')) return json(400, { ok: false, error: 'BAD_CONNECTION_ID' });
  const c = await db.byId(env.ZH_DB, b.connection_id);
  if (!c) return json(404, { ok: false, error: 'NOT_FOUND' });
  if (c.status === 'revoked') return json(200, { ok: true, status: 'revoked', already: true });
  let webhook = 'SKIPPED';
  if (c.token_sealed) {
    try {
      const r = await zalo.deleteWebhook(deps.fetch, await tokenOf(env, c));
      webhook = r.ok ? 'DELETED' : 'ZALO_' + r.error_code;
    } catch { webhook = 'TOKEN_UNREADABLE'; }
  }
  await db.revoke(env.ZH_DB, c.id, deps.now());
  return json(200, { ok: true, status: 'revoked', webhook, advice: 'Nếu nghi lộ mã bot: Zalo Bot Creator → Thiết lập chung → Reset token.' });
}

async function handleAdmin(request, env, deps, path) {
  if (!(await adminAuthorized(request, env))) return json(401, { ok: false, error: 'UNAUTHORIZED' });
  if (request.method === 'GET' && path === '/v1/admin/connections') {
    const storeId = new URL(request.url).searchParams.get('store_id') || '';
    if (!STORE_ID_RE.test(storeId)) return json(400, { ok: false, error: 'BAD_STORE_ID' });
    const rows = await db.listByStore(env.ZH_DB, storeId);
    const out = [];
    for (const c of rows) out.push(publicView(c, await db.countUsers(env.ZH_DB, c.id)));
    return json(200, { ok: true, connections: out });
  }
  if (request.method !== 'POST') return json(405, { ok: false });
  const r = await readJson(request);
  if (r.error) return json(400, { ok: false, error: r.error });
  const b = r.body || {};
  if (path === '/v1/admin/connect') return handleConnect(env, deps, b);
  if (path === '/v1/admin/disconnect') return handleDisconnect(env, deps, b);
  if (!ID_RE.test(b.connection_id || '')) return json(400, { ok: false, error: 'BAD_CONNECTION_ID' });
  const c = await db.byId(env.ZH_DB, b.connection_id);
  if (!c || c.status === 'revoked') return json(404, { ok: false, error: 'NOT_FOUND' });
  const now = deps.now();
  if (path === '/v1/admin/pairing') {
    const p = await newPairing(env, c.id, now);
    await db.setPairing(env.ZH_DB, c.id, p.hash, p.expiresAt, now);
    return json(200, { ok: true, status: 'pending_owner', pairing_code: p.code, pairing_expires_at: new Date(p.expiresAt).toISOString() });
  }
  if (path === '/v1/admin/disable') {
    await db.setStatus(env.ZH_DB, c.id, 'disabled', now);
    return json(200, { ok: true, status: 'disabled' });
  }
  if (path === '/v1/admin/enable') {
    const next = c.owner_chat_id ? 'active' : 'pending_owner';
    await db.setStatus(env.ZH_DB, c.id, next, now);
    return json(200, { ok: true, status: next });
  }
  return json(404, { ok: false });
}

export async function route(request, env, deps) {
  const path = new URL(request.url).pathname;
  try {
    if (request.method === 'POST' && path.startsWith('/v1/zalo/wh/')) return await handleWebhook(request, env, deps, path.slice('/v1/zalo/wh/'.length));
    if (request.method === 'POST' && path === '/v1/send') return await handleSend(request, env, deps);
    if (path.startsWith('/v1/admin/')) return await handleAdmin(request, env, deps, path);
    if (path === '/health') return json(200, { ok: true, enabled: env.ZH_ENABLED === 'true' });
    return json(404, { ok: false });
  } catch (e) {
    deps.log('UNHANDLED ' + zalo.redact(e && e.message ? e.message : 'ERR'));
    return json(500, { ok: false, error: 'INTERNAL' });
  }
}

export default {
  async fetch(request, env, ctx) {
    return route(request, env, {
      fetch: (u, i) => fetch(u, i),
      now: () => Date.now(),
      waitUntil: (p) => ctx.waitUntil(p.catch((e) => console.log('ASYNC_ERROR', zalo.redact(e && e.message ? e.message : 'ERR')))),
      log: (...a) => console.log(...a.map((x) => zalo.redact(x))),
    });
  },
};
