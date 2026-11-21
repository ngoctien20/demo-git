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
const KINDS = ['PRICE_PREVIEW', 'QUANTITY_REQUIRED', 'ORDER_DRAFT_PREVIEW', 'INVALID_QUANTITY', 'BLOCKED_STALE_SNAPSHOT'];

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
async function secureEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false;
  const [x, y] = await Promise.all([a, b].map((v) => crypto.subtle.digest('SHA-256', new TextEncoder().encode(v))));
  const p = new Uint8Array(x), q = new Uint8Array(y); let d = 0; for (let i = 0; i < p.length; i++) d |= p[i] ^ q[i]; return d === 0;
}
const vnd = (n) => n.toLocaleString('vi-VN') + 'đ';
const safeInt = (n, min, max) => Number.isSafeInteger(n) && n >= min && n <= max;

export function composeText(b) {
  const P = '[TIEN404 SANDBOX - Shop B] ';
  switch (b.kind) {
    case 'PRICE_PREVIEW':
      if (!safeInt(b.unit_price_vnd, 1, 1e9) || !safeInt(b.stock, 0, 1e6)) return null;
      return P + b.sku + ': ' + vnd(b.unit_price_vnd) + ', tồn QA ' + b.stock + '. Chỉ xem giá, chưa tạo đơn.';
    case 'QUANTITY_REQUIRED':
      if (!safeInt(b.unit_price_vnd, 1, 1e9)) return null;
      return P + b.sku + ' giá ' + vnd(b.unit_price_vnd) + '. Bạn muốn thử mua bao nhiêu? Chưa tạo đơn.';
    case 'ORDER_DRAFT_PREVIEW':
      if (!safeInt(b.unit_price_vnd, 1, 1e9) || !safeInt(b.quantity, 1, 9999) || b.total_vnd !== b.unit_price_vnd * b.quantity) return null;
      return P + b.sku + ': ' + b.quantity + ' × ' + vnd(b.unit_price_vnd) + ' = ' + vnd(b.total_vnd) + '. Bản nháp QA: chưa ghi đơn, chưa trừ kho.';
    case 'INVALID_QUANTITY':
      if (!safeInt(b.stock, 0, 1e6)) return null;
      return P + 'Số lượng thử hợp lệ từ 1 đến ' + b.stock + '. Chưa tạo đơn.';
    case 'BLOCKED_STALE_SNAPSHOT':
      return P + 'Dữ liệu giá thử đã cũ nên shop chưa báo giá. Chưa tạo đơn.';
    default: return null;
  }
}

export async function v22OwnerTextRoute(request, env, path, now = Date.now(), providerFetch = fetch) {
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
  const text = composeText(b);
  if (!text) return json(422, { ok: false, error: 'INVALID_FACTS' });
  const day = new Date(now).toISOString().slice(0, 10);
  try {
    const cnt = await env.REPLAY_DB.prepare('SELECT COUNT(*) AS n FROM outbound_claims WHERE idempotency_key LIKE ?1').bind('V22_OWNER_TEXT_' + day + '_%').first();
    if (Number(cnt?.n) >= DAILY_CAP) return json(429, { ok: false, error: 'DAILY_CAP_REACHED' });
    const key = 'V22_OWNER_TEXT_' + day + '_' + b.event_message_id;
    const c = await env.REPLAY_DB.prepare('INSERT INTO outbound_claims (idempotency_key, created_at, state) VALUES (?1,?2,?3) ON CONFLICT(idempotency_key) DO NOTHING').bind(key, Math.floor(now / 1000), 'CLAIMED_BEFORE_SEND').run();
    if (Number(c?.meta?.changes) !== 1) return json(409, { ok: false, error: 'ALREADY_REPLIED_NEVER_RETRY' });
    let outcome = 'UNKNOWN_AFTER_SEND_ATTEMPT', ack = false, status = 0;
    try {
      const r = await providerFetch('https://bot-api.zaloplatforms.com/bot' + env.ZALO_BOT_TOKEN + '/sendMessage', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: env.ZALO_OWNER_CHAT_ID, text }), redirect: 'manual', signal: AbortSignal.timeout(8000) });
      status = r.status; const x = await r.json().catch(() => ({})); ack = r.ok && x.ok === true; outcome = ack ? 'API_ACCEPTED' : 'PROVIDER_REJECTED';
    } catch {}
    try { await env.REPLAY_DB.prepare('UPDATE outbound_claims SET state = ?1 WHERE idempotency_key = ?2').bind(outcome, key).run(); } catch {}
    return json(ack ? 200 : 502, { ok: ack, result: outcome, provider_http_status: status, attempts: 1, orders_written: 0, retry_allowed: false });
  } catch { return json(503, { ok: false, error: 'IDEMPOTENCY_STORE_UNAVAILABLE' }); }
}
