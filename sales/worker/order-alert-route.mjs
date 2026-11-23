/* TIEN404 Sale GĐ1 — Zalo new-order alert route for Worker tien404-zalo-outbound-v1-staging.
 * PROPOSED, NOT DEPLOYED. Deploy needs the owner's explicit approval.
 * Safety:
 *  - Bearer GATEWAY_AUTH_KEY (same n8n credential as the V22 owner-text route).
 *  - Own switch SALES_ORDER_ALERT_ENABLED='true'. Independent of ZALO_SEND_ENABLED (customer sends).
 *  - Recipient is ALWAYS env.ZALO_OWNER_CHAT_ID; the caller cannot choose who receives it.
 *  - Text is composed here from validated order facts (total = price × qty, VN phone, known channel).
 *  - Exactly one alert per order_id (D1 claim before send, never retried) + daily cap.
 */
import { checkOrderFacts, composeOrderAlert } from '../lib/order-alert.mjs';

export const ORDER_ALERT_PATH = '/v1/sales/order-alert';
export const DAILY_CAP = 200;

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
async function secureEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false;
  const [x, y] = await Promise.all([a, b].map((v) => crypto.subtle.digest('SHA-256', new TextEncoder().encode(v))));
  const p = new Uint8Array(x), q = new Uint8Array(y); let d = 0; for (let i = 0; i < p.length; i++) d |= p[i] ^ q[i]; return d === 0;
}

export async function orderAlertRoute(request, env, path, now = Date.now(), providerFetch = fetch) {
  if (path !== ORDER_ALERT_PATH) return null;
  if (request.method !== 'POST') return json(405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
  if (env.SALES_ORDER_ALERT_ENABLED !== 'true') return json(423, { ok: false, error: 'ORDER_ALERT_DISABLED' });
  const auth = request.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ') || !(await secureEqual(auth.slice(7), env.GATEWAY_AUTH_KEY))) return json(401, { ok: false, error: 'UNAUTHORIZED' });
  if (!env.ZALO_BOT_TOKEN || !env.ZALO_OWNER_CHAT_ID || !env.REPLAY_DB) return json(503, { ok: false, error: 'REQUIRED_BINDING_MISSING' });
  if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) return json(415, { ok: false, error: 'JSON_REQUIRED' });
  let b;
  try { const raw = await request.text(); if (raw.length > 1200) return json(413, { ok: false, error: 'BODY_TOO_LARGE' }); b = JSON.parse(raw); }
  catch { return json(400, { ok: false, error: 'INVALID_BODY' }); }
  if (b && typeof b === 'object' && 'chat_id' in b) return json(400, { ok: false, error: 'RECIPIENT_NOT_ALLOWED' });
  const chk = checkOrderFacts(b);
  if (!chk.ok) return json(422, { ok: false, error: chk.error });
  const msg = composeOrderAlert(chk.facts);
  const day = new Date(now).toISOString().slice(0, 10);
  try {
    const cnt = await env.REPLAY_DB.prepare('SELECT COUNT(*) AS n FROM outbound_claims WHERE idempotency_key LIKE ?1').bind('SALES_ORDER_ALERT_' + day + '_%').first();
    if (Number(cnt?.n) >= DAILY_CAP) return json(429, { ok: false, error: 'DAILY_CAP_REACHED' });
    // Key has the day only for the cap count; the order_id itself is globally unique (timestamp inside).
    const key = 'SALES_ORDER_ALERT_' + day + '_' + chk.facts.order_id;
    const c = await env.REPLAY_DB.prepare('INSERT INTO outbound_claims (idempotency_key, created_at, state) VALUES (?1,?2,?3) ON CONFLICT(idempotency_key) DO NOTHING').bind(key, Math.floor(now / 1000), 'CLAIMED_BEFORE_SEND').run();
    if (Number(c?.meta?.changes) !== 1) return json(409, { ok: false, error: 'ALREADY_ALERTED_NEVER_RETRY' });
    let outcome = 'UNKNOWN_AFTER_SEND_ATTEMPT', ack = false, status = 0;
    const send = async (payload) => {
      const r = await providerFetch('https://bot-api.zaloplatforms.com/bot' + env.ZALO_BOT_TOKEN + '/sendMessage', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload), redirect: 'manual', signal: AbortSignal.timeout(8000) });
      status = r.status; const x = await r.json().catch(() => ({})); return r.ok && x.ok === true;
    };
    try {
      ack = await send({ chat_id: env.ZALO_OWNER_CHAT_ID, text: msg.text, text_styles: msg.text_styles });
      outcome = ack ? 'API_ACCEPTED' : 'PROVIDER_REJECTED';
      if (!ack && status >= 200 && status < 500) {
        ack = await send({ chat_id: env.ZALO_OWNER_CHAT_ID, text: msg.text });
        outcome = ack ? 'API_ACCEPTED_PLAIN_FALLBACK' : 'PROVIDER_REJECTED';
      }
    } catch {}
    try { await env.REPLAY_DB.prepare('UPDATE outbound_claims SET state = ?1 WHERE idempotency_key = ?2').bind(outcome, key).run(); } catch {}
    // 502 tells n8n to use the email fallback; it must NOT call this route again for the same order.
    return json(ack ? 200 : 502, { ok: ack, result: outcome, provider_http_status: status, retry_allowed: false, fallback: ack ? null : 'email' });
  } catch { return json(503, { ok: false, error: 'IDEMPOTENCY_STORE_UNAVAILABLE', fallback: 'email' }); }
}
