/* TIEN404 Zalo Hub — one shared gateway for many shops' Zalo Bots (Zalo Bot Platform, official API).
 * Staging: 0001 live with the QA bot since 2026-11-24. 0002 (key split, shared flow, owner self-connect) offline only.
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
 *   POST /v1/admin/rotate-keys      New forward_key + inbound_key for an 'own'-flow shop (old ones die at once).
 *
 * Owner self-connect from the TIEN404 App (ZH_OWNER_CONNECT_ENABLED='true'); Bearer = the owner's Supabase
 * access token, checked against Supabase Auth + store_memberships (role owner/manager) on every call:
 *   GET  /v1/owner/status?store_id=    Masked status of that store's Zalo bot.
 *   POST /v1/owner/connect             {store_id, token_text} → shared flow, returns the 6-digit pairing code.
 *   POST /v1/owner/pairing             {store_id} → new pairing code.
 *   POST /v1/owner/disconnect          {store_id}.
 * Lite plan (elderly owners, Zalo only): Bot TIEN404 AI's flow relays "nối bot" + the pasted token here.
 * Bearer ZH_LITE_KEY; the shop is keyed by the owner's Zalo id on Bot TIEN404 AI (store_id 'zl-' + hash).
 *   POST /v1/lite/connect|status|pairing|disconnect   {zalo_user_id[, token_text]}   (ZH_LITE_CONNECT_ENABLED)
 *   POST /v1/lite/reply  {zalo_user_id, text}  Bot TIEN404 AI (secret ZH_SYSTEM_BOT_TOKEN) answers that user; capped per day.
 * Owner-connected shops use flow_mode 'shared': one TIEN404 flow (ZH_SHARED_FORWARD_URL), hub-level secrets
 * ZH_SHARED_INBOUND_KEY / ZH_SHARED_SEND_KEY, so the owner never sees or pastes any key.
 *
 * Kill switches: ZH_ENABLED='true' (whole hub), ZH_SEND_ENABLED='true' (outbound), per-shop status 'disabled'.
 */
import { seal, open, sha256Hex, secureEqual, randomId, randomSecret, randomCode, signBody, verifyBody } from './crypto.mjs';
import * as zalo from './zalo-api.mjs';
import * as care from './care.mjs';
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
    token_last4: c.token_last4, flow_mode: c.flow_mode || 'own', owner_paired: !!c.owner_chat_id, sent_month: c.sent_month, sent_count: Number(c.sent_count || 0),
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
async function inboundKeyOf(env, c) {
  return c.inbound_key_sealed ? open(env, c.inbound_key_sealed, c.id, c.store_id, 'inbound_key') : null;
}
async function sealKeys(env, id, storeId) {
  const forwardKey = randomSecret(32);
  const inboundKey = randomSecret(32);
  return {
    forwardKey, inboundKey,
    forward_key_sealed: await seal(env, forwardKey, id, storeId, 'forward_key'),
    inbound_key_sealed: await seal(env, inboundKey, id, storeId, 'inbound_key'),
  };
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
  if (c.status === 'active' && ev.chat.id !== c.owner_chat_id && care.tier(env,c.store_id)) {
    if (ev.chat.type !== 'PRIVATE') return json(200,{ok:true,ignored:'PRIVATE_CHAT_ONLY'});
    const state = await care.record(env.ZH_DB,c,ev,now);
    if (state !== 'pending') return json(200,{ok:true,ignored:state});
    if (ev.user.id) await db.rememberUser(env.ZH_DB,c.id,ev.user.id,now);
    if (care.contactRequest(ev.text)) {
      const reply = {chat_id:ev.chat.id, source_message_id:ev.message_id, action_type:'HUMAN_HANDOFF'};
      deps.waitUntil(sendReply(env,deps,c,reply,now,true));
    } else {
      deps.waitUntil(forward(env,deps,c,ev,now));
    }
    return json(200,{ok:true,accepted:'INBOX'});
  }
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

const sharedKey = (k) => typeof k === 'string' && k.length >= 32;

async function forward(env, deps, c, ev, now) {
  const shared = c.flow_mode === 'shared';
  if (shared && !sharedKey(env.ZH_SHARED_INBOUND_KEY)) { deps.log('SHARED_FLOW_NOT_CONFIGURED', c.id); return; }
  const key = shared ? env.ZH_SHARED_INBOUND_KEY : await forwardKeyOf(env, c);
  const inbound = shared ? env.ZH_SHARED_INBOUND_KEY : await inboundKeyOf(env, c);
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
    const res = await deps.fetch(shared ? env.ZH_SHARED_FORWARD_URL : c.forward_url, {
      method: 'POST',
      // Signature for code flows. The header key is for an n8n Webhook Header Auth credential; n8n logs request
      // headers, so it is a separate inbound_key and never the send key. Legacy rows (no inbound_key yet) still
      // send the forward_key header until POST /v1/admin/rotate-keys.
      headers: {
        'content-type': 'application/json', 'x-tien404-ts': ts, 'x-tien404-signature': await signBody(key, ts, payload), 'x-tien404-connection': c.id,
        ...(inbound ? { 'x-tien404-inbound-key': inbound } : { 'x-tien404-forward-key': key }),
      },
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
  if (!c || c.status === 'revoked') return json(401, { ok: false, error: 'UNAUTHORIZED' });
  const shared = c.flow_mode === 'shared';
  if (shared ? !sharedKey(env.ZH_SHARED_SEND_KEY) : !c.forward_key_sealed) return json(401, { ok: false, error: 'UNAUTHORIZED' });
  const now = deps.now();
  const fk = shared ? env.ZH_SHARED_SEND_KEY : await forwardKeyOf(env, c);
  // Two ways to authenticate, same per-shop key: HMAC over ts.body (code flows), or
  // "Authorization: Bearer <forward_key>" (n8n Header Auth credential, no code needed).
  const auth = request.headers.get('authorization') || '';
  const ok = request.headers.get('x-tien404-signature')
    ? await verifyBody(fk, request.headers.get('x-tien404-ts'), r.text, request.headers.get('x-tien404-signature'), now)
    : auth.startsWith('Bearer ') && (await secureEqual(auth.slice(7), fk));
  if (!ok) return json(401, { ok: false, error: 'UNAUTHORIZED' });

  if (c.status !== 'active') return json(409, { ok: false, error: 'CONNECTION_' + String(c.status).toUpperCase() });
  if (typeof b.chat_id !== 'string' || !CHAT_ID_RE.test(b.chat_id)) return json(400, { ok: false, error: 'BAD_CHAT_ID' });
  const managed = !!care.tier(env,c.store_id) && b.chat_id !== c.owner_chat_id;
  return sendReply(env,deps,c,b,now,managed);
}

async function sendReply(env,deps,c,b,now,managed) {
  if (env.ZH_SEND_ENABLED !== 'true' || env.ZH_ENABLED !== 'true') return json(503,{ok:false,error:'SEND_DISABLED'});
  if (managed && b.action_type === 'HUMAN_HANDOFF') b.text = care.answer(await care.contact(env.ZH_DB,c.store_id));
  if (typeof b.text !== 'string' || b.text.length < 1 || b.text.length > 2000) return json(400, { ok: false, error: 'BAD_TEXT' });
  if (!managed && b.chat_id !== c.owner_chat_id && !(await db.isKnownUser(env.ZH_DB, c.id, b.chat_id))) return json(403, { ok: false, error: 'UNKNOWN_CHAT' });

  const cap = intEnv(env.ZH_MONTHLY_CAP, DEFAULT_MONTHLY_CAP);
  if (c.sent_month === monthOf(now) && Number(c.sent_count) >= cap) return json(429, { ok: false, error: 'MONTHLY_CAP' });

  const token = await tokenOf(env, c);
  if (managed && !await care.reserve(env.ZH_DB,c,b)) return json(409,{ok:false,error:'REPLY_INELIGIBLE'});
  if (!managed && b.typing === true) await zalo.sendChatAction(deps.fetch, token, b.chat_id, 'typing');
  const styles = Array.isArray(b.text_styles) ? b.text_styles.slice(0, 50) : undefined;
  let res = await zalo.sendMessage(deps.fetch, token, b.chat_id, b.text, styles);
  if (!managed && !res.ok && styles && res.error_code === 400) res = await zalo.sendMessage(deps.fetch, token, b.chat_id, b.text);

  if (managed) await care.finish(env.ZH_DB,c,b,res.ok);
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

async function handleConnect(env, deps, b, shared = false) {
  const storeId = b.store_id;
  if (typeof storeId !== 'string' || !STORE_ID_RE.test(storeId)) return json(400, { ok: false, error: 'BAD_STORE_ID' });
  if (shared) {
    if (!forwardUrlAllowed(env, env.ZH_SHARED_FORWARD_URL) || !sharedKey(env.ZH_SHARED_INBOUND_KEY) || !sharedKey(env.ZH_SHARED_SEND_KEY)) {
      return json(503, { ok: false, error: 'SHARED_FLOW_NOT_CONFIGURED' });
    }
  } else if (!forwardUrlAllowed(env, b.forward_url)) return json(400, { ok: false, error: 'FORWARD_URL_NOT_ALLOWED' });
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
  const keys = shared ? null : await sealKeys(env, id, storeId);
  const p = await newPairing(env, id, now);
  await db.insert(env.ZH_DB, {
    id, store_id: storeId, status: 'pending_owner', bot_id: botId, bot_name: botName,
    token_sealed: await seal(env, token, id, storeId, 'token'), token_last4: zalo.last4(token), key_version: 1,
    path_id: pathId, wh_secret_hash: await sha256Hex(whSecret), forward_url: shared ? 'shared' : b.forward_url,
    forward_key_sealed: keys ? keys.forward_key_sealed : null, inbound_key_sealed: keys ? keys.inbound_key_sealed : null,
    flow_mode: shared ? 'shared' : 'own',
    pairing_code_hash: p.hash, pairing_expires_at: p.expiresAt, connected_at: now,
  });

  const webhookUrl = `${base}/v1/zalo/wh/${pathId}`;
  const manual = !shared && b.set_webhook === false;
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
    // Shown once each. forward_key → credential of the /v1/send request (Bearer) or HMAC signing.
    // inbound_key → Header Auth credential of the n8n Webhook node (header x-tien404-inbound-key).
    forward_key: keys ? keys.forwardKey : undefined,
    inbound_key: keys ? keys.inboundKey : undefined,
    flow_mode: shared ? 'shared' : 'own',
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
  if (path === '/v1/admin/rotate-keys') {
    if (c.flow_mode === 'shared') return json(400, { ok: false, error: 'SHARED_FLOW_USES_HUB_KEYS' });
    const keys = await sealKeys(env, c.id, c.store_id);
    await db.setKeys(env.ZH_DB, c.id, keys.forward_key_sealed, keys.inbound_key_sealed, now);
    return json(200, { ok: true, connection_id: c.id, store_id: c.store_id, forward_key: keys.forwardKey, inbound_key: keys.inboundKey });
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

/* ---------------- owner self-connect (TIEN404 App) ---------------- */
function corsHeaders(env, request) {
  const origin = request.headers.get('origin') || '';
  const allowed = String(env.ZH_APP_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!allowed.includes(origin)) return null;
  return { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'GET, POST', 'access-control-allow-headers': 'authorization, content-type', 'access-control-max-age': '600', vary: 'origin' };
}
function withHeaders(res, extra) {
  if (!extra) return res;
  const h = new Headers(res.headers);
  for (const [k, v] of Object.entries(extra)) h.set(k, v);
  return new Response(res.body, { status: res.status, headers: h });
}

/** Who is calling, and may they manage this store? Asks Supabase with the caller's own token (RLS applies). */
async function ownerOf(request, env, deps, storeId) {
  const h = request.headers.get('authorization') || '';
  const jwt = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(jwt) || jwt.length > 4096) return { error: 401 };
  if (typeof storeId !== 'string' || !STORE_ID_RE.test(storeId)) return { error: 400 };
  const base = String(env.ZH_SUPABASE_URL || '').replace(/\/+$/, '');
  const apikey = String(env.ZH_SUPABASE_KEY || '');
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(base) || !apikey) return { error: 503 };
  const headers = { apikey, authorization: 'Bearer ' + jwt, accept: 'application/json' };
  const u = await deps.fetch(base + '/auth/v1/user', { headers, signal: AbortSignal.timeout(8000) });
  if (!u.ok) return { error: 401 };
  const user = await u.json().catch(() => null);
  const uid = user && typeof user.id === 'string' ? user.id : '';
  if (!/^[0-9a-f-]{36}$/.test(uid)) return { error: 401 };
  const q = `${base}/rest/v1/store_memberships?select=role&active=eq.true&user_id=eq.${uid}&store_id=eq.${encodeURIComponent(storeId)}`;
  const m = await deps.fetch(q, { headers, signal: AbortSignal.timeout(8000) });
  if (!m.ok) return { error: 403 };
  const rows = await m.json().catch(() => []);
  const role = Array.isArray(rows) && rows[0] ? rows[0].role : null;
  if (role !== 'owner' && role !== 'manager') return { error: 403 };
  return { uid, role };
}

async function handleOwner(request, env, deps, path) {
  const cors = corsHeaders(env, request);
  if (request.method === 'OPTIONS') return cors ? new Response(null, { status: 204, headers: cors }) : json(403, { ok: false });
  const out = async () => {
    if (env.ZH_OWNER_CONNECT_ENABLED !== 'true') return json(503, { ok: false, error: 'OWNER_CONNECT_DISABLED' });
    let b = {};
    if (request.method === 'POST') {
      const r = await readJson(request);
      if (r.error) return json(400, { ok: false, error: r.error });
      b = r.body || {};
    } else if (request.method === 'GET') {
      b = { store_id: new URL(request.url).searchParams.get('store_id') || '' };
    } else return json(405, { ok: false });
    const who = await ownerOf(request, env, deps, b.store_id);
    if (who.error) return json(who.error, { ok: false, error: { 400: 'BAD_STORE_ID', 401: 'SIGN_IN_AGAIN', 403: 'NOT_STORE_MANAGER', 503: 'AUTH_NOT_CONFIGURED' }[who.error] });
    if (path.startsWith('/v1/owner/care/') && request.method === 'POST')
      return care.owner(env.ZH_DB,care.tier(env,b.store_id),who,path.slice('/v1/owner/care/'.length),b,deps.now(),json);
    const live = await db.liveByStore(env.ZH_DB, b.store_id);
    const now = deps.now();
    if (request.method === 'GET' && path === '/v1/owner/status') {
      return json(200, { ok: true, connection: live ? publicView(live, await db.countUsers(env.ZH_DB, live.id)) : null });
    }
    if (request.method !== 'POST') return json(405, { ok: false });
    if (path === '/v1/owner/connect') {
      if (env.ZH_ENABLED !== 'true') return json(503, { ok: false, error: 'HUB_DISABLED' });
      if (live && live.flow_mode !== 'shared') return json(409, { ok: false, error: 'STORE_MANAGED_BY_TIEN404' });
      return handleConnect(env, deps, { store_id: b.store_id, token_text: b.token_text }, true);
    }
    if (!live) return json(404, { ok: false, error: 'NOT_CONNECTED' });
    if (live.flow_mode !== 'shared') return json(409, { ok: false, error: 'STORE_MANAGED_BY_TIEN404' });
    if (path === '/v1/owner/pairing') {
      const p = await newPairing(env, live.id, now);
      await db.setPairing(env.ZH_DB, live.id, p.hash, p.expiresAt, now);
      return json(200, { ok: true, status: 'pending_owner', pairing_code: p.code, pairing_expires_at: new Date(p.expiresAt).toISOString() });
    }
    if (path === '/v1/owner/disconnect') return handleDisconnect(env, deps, { connection_id: live.id });
    return json(404, { ok: false });
  };
  return withHeaders(await out(), cors);
}

/* ---------------- Lite: connect from Zalo via Bot TIEN404 AI ---------------- */
async function liteStoreId(zaloUserId) {
  return 'zl-' + (await sha256Hex('tien404-lite:' + zaloUserId)).slice(0, 24);
}

async function handleLite(request, env, deps, path) {
  if (env.ZH_LITE_CONNECT_ENABLED !== 'true') return json(503, { ok: false, error: 'LITE_CONNECT_DISABLED' });
  const key = env.ZH_LITE_KEY;
  const h = request.headers.get('authorization') || '';
  if (!sharedKey(key) || !h.startsWith('Bearer ') || !(await secureEqual(h.slice(7), key))) return json(401, { ok: false, error: 'UNAUTHORIZED' });
  if (request.method !== 'POST') return json(405, { ok: false });
  const r = await readJson(request);
  if (r.error) return json(400, { ok: false, error: r.error });
  const b = r.body || {};
  if (typeof b.zalo_user_id !== 'string' || !CHAT_ID_RE.test(b.zalo_user_id)) return json(400, { ok: false, error: 'BAD_ZALO_USER' });
  const storeId = await liteStoreId(b.zalo_user_id);
  const live = await db.liveByStore(env.ZH_DB, storeId);
  const now = deps.now();
  if (path === '/v1/lite/status') return json(200, { ok: true, store_id: storeId, connection: live ? publicView(live, await db.countUsers(env.ZH_DB, live.id)) : null });
  if (path === '/v1/lite/reply') {
    // Bot TIEN404 AI answers the same Zalo user who wrote to it. Text comes from the Lite flow (n8n).
    const sys = env.ZH_SYSTEM_BOT_TOKEN;
    if (!zalo.extractToken(sys || '')) return json(503, { ok: false, error: 'SYSTEM_BOT_NOT_CONFIGURED' });
    if (env.ZH_SEND_ENABLED !== 'true') return json(503, { ok: false, error: 'SEND_DISABLED' });
    if (typeof b.text !== 'string' || b.text.length < 1 || b.text.length > 1500) return json(400, { ok: false, error: 'BAD_TEXT' });
    const n = await db.bumpLiteReply(env.ZH_DB, new Date(now).toISOString().slice(0, 10), b.zalo_user_id);
    if (n > intEnv(env.ZH_LITE_REPLY_DAILY_CAP, 30)) return json(429, { ok: false, error: 'LITE_REPLY_CAP' });
    const res = await zalo.sendMessage(deps.fetch, zalo.extractToken(sys), b.zalo_user_id, b.text);
    return res.ok ? json(200, { ok: true }) : json(502, { ok: false, error: 'ZALO_' + res.error_code });
  }
  if (path === '/v1/lite/connect') {
    if (env.ZH_ENABLED !== 'true') return json(503, { ok: false, error: 'HUB_DISABLED' });
    return handleConnect(env, deps, { store_id: storeId, token_text: b.token_text }, true);
  }
  if (!live) return json(404, { ok: false, error: 'NOT_CONNECTED' });
  if (path === '/v1/lite/pairing') {
    const p = await newPairing(env, live.id, now);
    await db.setPairing(env.ZH_DB, live.id, p.hash, p.expiresAt, now);
    return json(200, { ok: true, status: 'pending_owner', bot_name: live.bot_name, pairing_code: p.code, pairing_expires_at: new Date(p.expiresAt).toISOString() });
  }
  if (path === '/v1/lite/disconnect') return handleDisconnect(env, deps, { connection_id: live.id });
  return json(404, { ok: false });
}

export async function route(request, env, deps) {
  const path = new URL(request.url).pathname;
  try {
    if (request.method === 'POST' && path.startsWith('/v1/zalo/wh/')) return await handleWebhook(request, env, deps, path.slice('/v1/zalo/wh/'.length));
    if (request.method === 'POST' && path === '/v1/send') return await handleSend(request, env, deps);
    if (path.startsWith('/v1/admin/')) return await handleAdmin(request, env, deps, path);
    if (path.startsWith('/v1/owner/')) return await handleOwner(request, env, deps, path);
    if (path.startsWith('/v1/lite/')) return await handleLite(request, env, deps, path);
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
