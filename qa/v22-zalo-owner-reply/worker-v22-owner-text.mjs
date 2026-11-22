/* TIEN404 V22 — Zalo Bot owner-only QA text reply route for tien404-zalo-outbound-v1-staging.
 * PROPOSED (not deployed). Owner approved the scope on 2026-11-21: reply ONLY to the allowlisted
 * staging owner chat, sandbox wording, no orders, no stock change.
 * Safety:
 *  - Bearer GATEWAY_AUTH_KEY (same n8n credential TIEN404_ZALO_OUTBOUND_GATEWAY_AUTH_V1).
 *  - Global ZALO_SEND_ENABLED must stay 'false'; this route has its own switch ZALO_OWNER_TEXT_ENABLED='true'
 *    and expiry ZALO_OWNER_TEXT_EXPIRES (ISO), capped by HARD_EXPIRES below.
 *  - chat_id must equal secret ZALO_OWNER_CHAT_ID (constant-time compare). Anyone else: 403, no send.
 *  - Worker composes the text from fixed templates; n8n cannot send free text.
 *  - One reply per inbound Zalo message_id (D1 claim before send, never retried) + daily cap.
 */
export const OWNER_TEXT_PATH = '/v1/qa-v22/owner-text';
const HARD_EXPIRES = '2026-11-28T00:00:00Z';
const DAILY_CAP = 30;
// V22.4 owner rule (2026-11-21): 1 reply per customer message preferred, 2 when useful, NEVER more than 3.
export const PER_MESSAGE_CAP = 3;
// V22.2: show Zalo 'typing…' before replying. Best-effort (failure never blocks the reply), not a message.
const TYPING_MS = { VOICE_HEARD: 400, IMAGE_MATCH: 500, IMAGE_NO_MATCH: 500, PRICE_PREVIEW: 900, QUANTITY_REQUIRED: 700, ORDER_DRAFT_PREVIEW: 1500, INVALID_QUANTITY: 600, BLOCKED_STALE_SNAPSHOT: 600 };
const KINDS = ['PRICE_PREVIEW', 'QUANTITY_REQUIRED', 'ORDER_DRAFT_PREVIEW', 'INVALID_QUANTITY', 'BLOCKED_STALE_SNAPSHOT', 'VOICE_HEARD', 'IMAGE_MATCH', 'IMAGE_NO_MATCH'];

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
async function secureEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false;
  const [x, y] = await Promise.all([a, b].map((v) => crypto.subtle.digest('SHA-256', new TextEncoder().encode(v))));
  const p = new Uint8Array(x), q = new Uint8Array(y); let d = 0; for (let i = 0; i < p.length; i++) d |= p[i] ^ q[i]; return d === 0;
}
const vnd = (n) => n.toLocaleString('vi-VN') + 'đ';
const safeInt = (n, min, max) => Number.isSafeInteger(n) && n >= min && n <= max;

// V22.1 rich reply: icons (BMP-only symbols so offsets match in UTF-16 and code points) + Zalo text_styles
// (bold "b", italic "i", colour "c_<hex>"). If Zalo rejects the styled message, the route sends the same text once
// without styles. Facts (price/stock/total) are still validated here; n8n cannot send free text.
const C = { green: 'c_15a85f', red: 'c_db342e', orange: 'c_f27806', blue: 'c_0068ff', gray: 'c_7f8c8d' };
function build(parts) {
  let text = ''; const text_styles = [];
  for (const [str, st] of parts) { if (st && st.length) text_styles.push({ start: text.length, len: str.length, st }); text += str; }
  return { text, text_styles };
}
const HEAD = ['\u2605 TIEN404 SANDBOX \u00b7 Shop B\n', ['b', C.gray]];
// V22.3: owner's own voice transcript / AI image description echoed back to the owner only.
// Strip control chars, links and non-BMP chars (keeps text_styles offsets exact), cap length.
export function cleanEcho(v, max) {
  if (typeof v !== 'string') return '';
  return v.normalize('NFC').replace(/https?:\/\/\S+|www\.\S+/gi, '[link]').replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2028-\u202e\u2066-\u2069]/g, ' ')
    .replace(/[\uD800-\uDFFF]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}
const CONF = { high: 'cao', medium: 'trung b\u00ecnh' };
// V22.4: merge "what the bot saw/heard" into the answer itself, so an understood photo/voice gets ONE message.
function leadParts(b) {
  if (b.lead_kind === 'IMAGE' && CONF[b.lead_confidence]) {
    const seen = cleanEcho(b.lead_text, 80);
    return [['\u25a3 \u1ea2nh gi\u1ed1ng ' + b.sku, ['b', C.green]], [' (\u0111\u1ed9 tin c\u1eady ' + CONF[b.lead_confidence] + ')', ['i', C.gray]], ['\n' + (seen ? 'Bot th\u1ea5y: ' + seen + '\n' : '')]];
  }
  if (b.lead_kind === 'VOICE') {
    const t = cleanEcho(b.lead_text, 160);
    if (t) return [['\u266a Bot nghe: ', ['b', C.blue]], ['\u201c' + t + '\u201d\n', ['i']]];
  }
  return [];
}
export function composeMessage(b) {
  const m = composeBody(b);
  if (!m || !b.lead_kind || !['PRICE_PREVIEW', 'QUANTITY_REQUIRED', 'ORDER_DRAFT_PREVIEW', 'INVALID_QUANTITY', 'BLOCKED_STALE_SNAPSHOT'].includes(b.kind)) return m;
  const lead = build(leadParts(b));
  if (!lead.text) return m;
  const h = HEAD[0].length, n = lead.text.length;
  return { text: m.text.slice(0, h) + lead.text + m.text.slice(h),
    text_styles: [...m.text_styles.filter((x) => x.start < h), ...lead.text_styles.map((x) => ({ ...x, start: x.start + h })), ...m.text_styles.filter((x) => x.start >= h).map((x) => ({ ...x, start: x.start + n }))] };
}
function composeBody(b) {
  switch (b.kind) {
    case 'VOICE_HEARD': {
      const t = cleanEcho(b.transcript, 160);
      const parts = [HEAD, ['\u266a Bot nghe \u0111\u01b0\u1ee3c:', ['b', C.blue]], ['\n\u201c' + (t || '(kh\u00f4ng nghe r\u00f5)') + '\u201d', ['i']]];
      if (b.understood !== true) parts.push(['\n\u26a0 Ch\u01b0a hi\u1ec3u l\u1ec7nh. Th\u1eed n\u00f3i: \u201cGi\u00e1 F01\u201d ho\u1eb7c \u201cMua F01 hai c\u00e1i\u201d', ['b', C.orange]]);
      return build(parts);
    }
    case 'IMAGE_MATCH': {
      if (!CONF[b.confidence]) return null;
      const seen = cleanEcho(b.seen, 80);
      return build([HEAD, ['\u25a3 \u1ea2nh gi\u1ed1ng ' + b.sku, ['b', C.green]], [' (\u0111\u1ed9 tin c\u1eady ' + CONF[b.confidence] + ')', ['i', C.gray]],
        ...(seen ? [['\nBot th\u1ea5y: ' + seen]] : [])]);
    }
    case 'IMAGE_NO_MATCH': {
      const seen = cleanEcho(b.seen, 80);
      return build([HEAD, ['\u25a3 Ch\u01b0a t\u00ecm th\u1ea5y s\u1ea3n ph\u1ea9m gi\u1ed1ng \u1ea3nh', ['b', C.orange]], ...(seen ? [['\nBot th\u1ea5y: ' + seen]] : []),
        ['\n\u24d8 Th\u1eed \u1ea3nh r\u00f5 h\u01a1n ho\u1eb7c nh\u1eafn m\u00e3 s\u1ea3n ph\u1ea9m.', ['i', C.gray]]]);
    }
    case 'PRICE_PREVIEW':
      if (!safeInt(b.unit_price_vnd, 1, 1e9) || !safeInt(b.stock, 0, 1e6)) return null;
      return build([HEAD, ['\u2714 ' + b.sku + ' \u2013 gi\u00e1 ', ['b']], [vnd(b.unit_price_vnd), ['b', C.green]],
        ['\n\u2302 T\u1ed3n QA: ' + b.stock + '\n'], ['\u24d8 Ch\u1ec9 xem gi\u00e1, ch\u01b0a t\u1ea1o \u0111\u01a1n.', ['i', C.gray]]]);
    case 'QUANTITY_REQUIRED':
      if (!safeInt(b.unit_price_vnd, 1, 1e9)) return null;
      return build([HEAD, ['\u2753 ' + b.sku + ' gi\u00e1 '], [vnd(b.unit_price_vnd), ['b', C.green]],
        ['\nB\u1ea1n mu\u1ed1n th\u1eed mua bao nhi\u00eau?', ['b', C.blue]],
        ['\n\u270e Nh\u1eafn: TEST SHOP B CHAT MUA ' + b.sku + ' 2\n'], ['\u24d8 Ch\u01b0a t\u1ea1o \u0111\u01a1n.', ['i', C.gray]]]);
    case 'ORDER_DRAFT_PREVIEW':
      if (!safeInt(b.unit_price_vnd, 1, 1e9) || !safeInt(b.quantity, 1, 9999) || b.total_vnd !== b.unit_price_vnd * b.quantity) return null;
      return build([HEAD, ['\u270d B\u1ea3n nh\u00e1p QA\n', ['b', C.blue]],
        [b.sku + ': ' + b.quantity + ' \u00d7 ' + vnd(b.unit_price_vnd) + '\n'], ['T\u1ed5ng: '], [vnd(b.total_vnd), ['b', C.orange]],
        ['\n\u26a0 Ch\u01b0a ghi \u0111\u01a1n, ch\u01b0a tr\u1eeb kho.', ['i', C.gray]]]);
    case 'INVALID_QUANTITY':
      if (!safeInt(b.stock, 0, 1e6)) return null;
      return build([HEAD, ['\u26a0 S\u1ed1 l\u01b0\u1ee3ng kh\u00f4ng h\u1ee3p l\u1ec7', ['b', C.orange]],
        ['\nCh\u1ec9 nh\u1eadn t\u1eeb 1 \u0111\u1ebfn ' + b.stock + '.\n'], ['\u24d8 Ch\u01b0a t\u1ea1o \u0111\u01a1n.', ['i', C.gray]]]);
    case 'BLOCKED_STALE_SNAPSHOT':
      return build([HEAD, ['\u26d4 D\u1eef li\u1ec7u gi\u00e1 th\u1eed \u0111\u00e3 c\u0169', ['b', C.red]],
        ['\nShop ch\u01b0a b\u00e1o gi\u00e1 l\u00fac n\u00e0y.\n'], ['\u24d8 Ch\u01b0a t\u1ea1o \u0111\u01a1n.', ['i', C.gray]]]);
    default: return null;
  }
}
export function composeText(b) { const m = composeMessage(b); return m ? m.text : null; }

export async function v22OwnerTextRoute(request, env, path, now = Date.now(), providerFetch = fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms))) {
  if (path !== OWNER_TEXT_PATH) return null;
  if (request.method !== 'POST') return json(405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
  if (env.ZALO_SEND_ENABLED !== 'false') return json(423, { ok: false, error: 'GLOBAL_KILL_SWITCH_UNEXPECTED' });
  if (env.ZALO_OWNER_TEXT_ENABLED !== 'true') return json(423, { ok: false, error: 'OWNER_TEXT_DISABLED' });
  const exp = Date.parse(String(env.ZALO_OWNER_TEXT_EXPIRES || ''));
  if (!Number.isFinite(exp) || now >= exp || now >= Date.parse(HARD_EXPIRES)) return json(403, { ok: false, error: 'QA_APPROVAL_EXPIRED' });
  const auth = request.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ') || !(await secureEqual(auth.slice(7), env.GATEWAY_AUTH_KEY))) return json(401, { ok: false, error: 'UNAUTHORIZED' });
  if (!env.ZALO_BOT_TOKEN || !env.ZALO_OWNER_CHAT_ID || !env.REPLAY_DB) return json(503, { ok: false, error: 'REQUIRED_BINDING_MISSING' });
  if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) return json(415, { ok: false, error: 'JSON_REQUIRED' });
  let b;
  try { const raw = await request.text(); if (raw.length > 600) return json(413, { ok: false, error: 'BODY_TOO_LARGE' }); b = JSON.parse(raw); }
  catch { return json(400, { ok: false, error: 'INVALID_BODY' }); }
  if (!b || typeof b !== 'object' || Array.isArray(b)) return json(400, { ok: false, error: 'INVALID_BODY' });
  if (typeof b.chat_id !== 'string' || !(await secureEqual(b.chat_id, env.ZALO_OWNER_CHAT_ID))) return json(403, { ok: false, error: 'OWNER_ONLY' });
  if (typeof b.event_message_id !== 'string' || !/^[A-Za-z0-9_-]{4,128}$/.test(b.event_message_id)) return json(400, { ok: false, error: 'EVENT_ID_REQUIRED' });
  if (!KINDS.includes(b.kind) || b.sku !== 'F01') return json(422, { ok: false, error: 'KIND_NOT_APPROVED' });
  const msg = composeMessage(b);
  if (!msg) return json(422, { ok: false, error: 'INVALID_FACTS' });
  const text = msg.text;
  const day = new Date(now).toISOString().slice(0, 10);
  try {
    const cnt = await env.REPLAY_DB.prepare('SELECT COUNT(*) AS n FROM outbound_claims WHERE idempotency_key LIKE ?1').bind('V22_OWNER_TEXT_' + day + '_%').first();
    if (Number(cnt?.n) >= DAILY_CAP) return json(429, { ok: false, error: 'DAILY_CAP_REACHED' });
    const base = b.event_message_id.split('-')[0];
    const per = await env.REPLAY_DB.prepare('SELECT COUNT(*) AS n FROM outbound_claims WHERE idempotency_key LIKE ?1').bind('V22_OWNER_TEXT_' + day + '_' + base + '%').first();
    if (Number(per?.n) >= PER_MESSAGE_CAP) return json(429, { ok: false, error: 'PER_MESSAGE_CAP_REACHED' });
    const key = 'V22_OWNER_TEXT_' + day + '_' + b.event_message_id;
    const c = await env.REPLAY_DB.prepare('INSERT INTO outbound_claims (idempotency_key, created_at, state) VALUES (?1,?2,?3) ON CONFLICT(idempotency_key) DO NOTHING').bind(key, Math.floor(now / 1000), 'CLAIMED_BEFORE_SEND').run();
    if (Number(c?.meta?.changes) !== 1) return json(409, { ok: false, error: 'ALREADY_REPLIED_NEVER_RETRY' });
    let outcome = 'UNKNOWN_AFTER_SEND_ATTEMPT', ack = false, status = 0, attempts = 0;
    const send = async (payload) => {
      attempts++;
      const r = await providerFetch('https://bot-api.zaloplatforms.com/bot' + env.ZALO_BOT_TOKEN + '/sendMessage', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload), redirect: 'manual', signal: AbortSignal.timeout(8000) });
      status = r.status; const x = await r.json().catch(() => ({})); return r.ok && x.ok === true;
    };
    let typing = 'SKIPPED';
    try {
      const t = await providerFetch('https://bot-api.zaloplatforms.com/bot' + env.ZALO_BOT_TOKEN + '/sendChatAction', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: env.ZALO_OWNER_CHAT_ID, action: 'typing' }), redirect: 'manual', signal: AbortSignal.timeout(1500) });
      const tx = await t.json().catch(() => ({})); typing = t.ok && tx.ok === true ? 'SHOWN' : 'REJECTED';
      if (typing === 'SHOWN') await sleep(TYPING_MS[b.kind] || 800);
    } catch { typing = 'ERROR'; }
    try {
      ack = await send({ chat_id: env.ZALO_OWNER_CHAT_ID, text, text_styles: msg.text_styles });
      outcome = ack ? 'API_ACCEPTED' : 'PROVIDER_REJECTED';
      // Only an explicit provider rejection (not a timeout/unknown) may fall back to the same text without styles.
      if (!ack && status >= 200 && status < 500) {
        ack = await send({ chat_id: env.ZALO_OWNER_CHAT_ID, text });
        outcome = ack ? 'API_ACCEPTED_PLAIN_FALLBACK' : 'PROVIDER_REJECTED';
      }
    } catch {}
    try { await env.REPLAY_DB.prepare('UPDATE outbound_claims SET state = ?1 WHERE idempotency_key = ?2').bind(outcome, key).run(); } catch {}
    return json(ack ? 200 : 502, { ok: ack, result: outcome, provider_http_status: status, attempts, typing, orders_written: 0, retry_allowed: false });
  } catch { return json(503, { ok: false, error: 'IDEMPOTENCY_STORE_UNAVAILABLE' }); }
}
