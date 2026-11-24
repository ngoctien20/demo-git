/* TIEN404 Tự dựng trợ lý — Worker route POST /v1/setup/draft. PROPOSED, NOT DEPLOYED.
 * Owner App sends a price-list photo, a public page link or pasted text; gets back a DRAFT to review.
 * Safety:
 *  - Off unless SETUP_DRAFT_ENABLED='true'.
 *  - Caller must be a signed-in owner: the Supabase access token is checked with Supabase itself.
 *  - 20 drafts per owner per day (D1), body max 7 MB, photo max 5 MB, JPEG/PNG/WebP only.
 *  - Links: public https pages only (setup/lib/page-text.mjs). No Facebook scraping.
 *  - Writes NOTHING to Sheet/Supabase. Saving happens only after the owner confirms, via the existing import.
 *  - ANTHROPIC_API_KEY / RELAY_API_KEY live only in Worker secrets; never returned, never logged.
 *  - AI_PROVIDER='relay' (test only, no real shop data) sends the request to AI_BASE_URL instead of Anthropic.
 */
import { checkDraft } from '../lib/draft.mjs';
import { fetchPageText } from '../lib/page-text.mjs';
import { readWithClaude, IMAGE_TYPES } from '../lib/read-with-claude.mjs';
import { readWithRelay, relayEndpoint } from '../lib/read-with-relay.mjs';

export const SETUP_PATH = '/v1/setup/draft';
export const DAILY_CAP_PER_OWNER = 20;
const MAX_BODY = 7_000_000;
const MAX_IMAGE_BYTES = 5_000_000;

const json = (status, body, origin) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff',
    ...(origin ? { 'access-control-allow-origin': origin, vary: 'Origin' } : {}),
  },
});

async function ownerId(request, env, fetchImpl) {
  const auth = request.headers.get('authorization') || '';
  if (!/^Bearer [\w-]+\.[\w-]+\.[\w-]+$/.test(auth)) return null;
  try {
    const r = await fetchImpl(env.SUPABASE_URL + '/auth/v1/user', { headers: { authorization: auth, apikey: env.SUPABASE_ANON_KEY }, signal: AbortSignal.timeout(5000) });
    if (!r.ok) return null;
    const u = await r.json();
    return typeof u?.id === 'string' && /^[0-9a-f-]{36}$/.test(u.id) ? u.id : null;
  } catch { return null; }
}

// makeClient(env) -> Anthropic client. Default loads the SDK only when the route is actually used.
async function defaultClient(env) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  return new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 90_000 });
}

export async function setupDraftRoute(request, env, path, { now = Date.now(), fetchImpl = fetch, makeClient = defaultClient } = {}) {
  if (path !== SETUP_PATH) return null;
  const origin = request.headers.get('origin');
  const allowed = String(env.APP_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const cors = origin && allowed.includes(origin) ? origin : null;
  if (request.method === 'OPTIONS' && cors) {
    return new Response(null, { status: 204, headers: { 'access-control-allow-origin': cors, 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'authorization, content-type', 'access-control-max-age': '600', vary: 'Origin' } });
  }
  if (request.method !== 'POST') return json(405, { ok: false, error: 'METHOD_NOT_ALLOWED' }, cors);
  if (origin && !cors) return json(403, { ok: false, error: 'ORIGIN_NOT_ALLOWED' });
  if (env.SETUP_DRAFT_ENABLED !== 'true') return json(423, { ok: false, error: 'SETUP_DRAFT_DISABLED' }, cors);
  const relay = env.AI_PROVIDER === 'relay';
  const aiReady = relay ? Boolean(env.RELAY_API_KEY && relayEndpoint(env.AI_BASE_URL)) : Boolean(env.ANTHROPIC_API_KEY);
  if (!aiReady || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !env.SETUP_DB) return json(503, { ok: false, error: 'REQUIRED_BINDING_MISSING' }, cors);
  const owner = await ownerId(request, env, fetchImpl);
  if (!owner) return json(401, { ok: false, error: 'UNAUTHORIZED' }, cors);
  if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) return json(415, { ok: false, error: 'JSON_REQUIRED' }, cors);
  if (Number(request.headers.get('content-length')) > MAX_BODY) return json(413, { ok: false, error: 'BODY_TOO_LARGE' }, cors);

  let b;
  try { const raw = await request.text(); if (raw.length > MAX_BODY) return json(413, { ok: false, error: 'BODY_TOO_LARGE' }, cors); b = JSON.parse(raw); }
  catch { return json(400, { ok: false, error: 'INVALID_BODY' }, cors); }

  // Exactly one source: image | url | text
  const sources = ['image', 'url', 'text'].filter((k) => b?.[k] !== undefined && b?.[k] !== null && b?.[k] !== '');
  if (sources.length !== 1) return json(400, { ok: false, error: 'ONE_SOURCE_REQUIRED' }, cors);
  let input;
  if (b.image) {
    const { media_type: type, data } = b.image || {};
    if (!IMAGE_TYPES.includes(type)) return json(415, { ok: false, error: 'IMAGE_TYPE_NOT_ALLOWED' }, cors);
    if (typeof data !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) return json(400, { ok: false, error: 'BAD_IMAGE_DATA' }, cors);
    if (Math.floor(data.length * 3 / 4) > MAX_IMAGE_BYTES) return json(413, { ok: false, error: 'IMAGE_TOO_LARGE' }, cors);
    input = { image: { media_type: type, data } };
  } else if (b.url) {
    const page = await fetchPageText(b.url, fetchImpl);
    if (!page.ok) return json(422, { ok: false, error: page.error, hint: page.hint }, cors);
    input = { text: page.text, url: page.url };
  } else {
    if (typeof b.text !== 'string' || b.text.trim().length < 30) return json(400, { ok: false, error: 'TEXT_TOO_SHORT' }, cors);
    input = { text: b.text.slice(0, 20_000) };
  }

  const day = new Date(now).toISOString().slice(0, 10);
  try {
    const row = await env.SETUP_DB.prepare('INSERT INTO setup_draft_usage (owner_id, day, n) VALUES (?1, ?2, 1) ON CONFLICT(owner_id, day) DO UPDATE SET n = n + 1 RETURNING n').bind(owner, day).first();
    if (Number(row?.n) > DAILY_CAP_PER_OWNER) return json(429, { ok: false, error: 'DAILY_CAP_REACHED' }, cors);
  } catch { return json(503, { ok: false, error: 'USAGE_STORE_UNAVAILABLE' }, cors); }

  const r = relay
    ? await readWithRelay(fetchImpl, { baseUrl: env.AI_BASE_URL, apiKey: env.RELAY_API_KEY, model: env.AI_MODEL }, input)
    : await readWithClaude(await makeClient(env), input);
  if (!r.ok) return json(r.error === 'AI_BUSY' ? 429 : 502, { ok: false, error: r.error, ...(r.detail ? { detail: r.detail } : {}) }, cors);
  let draft;
  try { draft = checkDraft(r.raw, { sourceText: input.text || '' }); } catch { return json(502, { ok: false, error: 'AI_BAD_DRAFT' }, cors); }
  return json(200, { ok: true, source: sources[0], draft }, cors);
}

// D1 table for the daily cap (apply once, needs approval):
export const SETUP_DB_DDL = 'CREATE TABLE IF NOT EXISTS setup_draft_usage (owner_id TEXT NOT NULL, day TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (owner_id, day))';
