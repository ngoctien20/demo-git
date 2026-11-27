// Public routing logic only. Handler implementations are injected; no deployed
// source, private bundle, credentials or binding values are included in this file.
import { secureEqual } from '../src/crypto.mjs';

const QA_STORE = 'qa-zalo-bot';
const ID_RE = /^[0-9a-f]{32}$/;
const ADMIN_CONNECTION_ROUTES = new Set([
  '/v1/admin/pairing', '/v1/admin/disable', '/v1/admin/enable',
  '/v1/admin/disconnect', '/v1/admin/rotate-keys',
]);

const unavailable = () => new Response(JSON.stringify({ ok: false, error: 'PILOT_LOOKUP_UNAVAILABLE' }), {
  status: 503,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
});

export function createPilot(legacy, candidate) {
  if (typeof legacy?.route !== 'function' || typeof legacy?.default?.fetch !== 'function'
      || !Number.isSafeInteger(legacy.MAX_BODY) || legacy.MAX_BODY < 1
      || typeof candidate?.route !== 'function' || typeof candidate?.default?.fetch !== 'function') {
    throw new TypeError('PILOT_HANDLER_CONTRACT');
  }

  async function connectionIdFromBody(request) {
    // Preserve the body for the actual handler, which still performs full
    // validation. Invalid/oversize authenticated admin input stays with legacy.
    if (Number(request.headers.get('content-length') || 0) > legacy.MAX_BODY) return null;
    try {
      const raw = await request.clone().text();
      if (raw.length > legacy.MAX_BODY) return null;
      const value = JSON.parse(raw);
      return value && typeof value.connection_id === 'string' && ID_RE.test(value.connection_id) ? value.connection_id : null;
    } catch {
      return null;
    }
  }

  async function selectedHandler(request, env) {
    if (env.ZH_WEB_STORE_LINK==='true' && new URL(request.url).pathname.startsWith('/v1/owner/web-store/')) {
      return { handler:candidate, env:{...env, ZH_OWNER_CONNECT_ENABLED:'true',
        ZH_WEB_STORE_SCOPE:env.ZH_QA_WEB_STORE_ID || 'unassigned',
        ZH_SUPABASE_URL:env.ZH_QA_SUPABASE_URL, ZH_SUPABASE_KEY:env.ZH_QA_SUPABASE_KEY,
        ZH_APP_ORIGINS:env.ZH_QA_WEB_ORIGIN} };
    }
    if (request.method !== 'POST') return { handler: legacy, env };
    const path = new URL(request.url).pathname;
    let row;
    const webhook = /^\/v1\/zalo\/wh\/([0-9a-f]{32})$/.exec(path);
    if (webhook) {
      row = await env.ZH_DB.prepare('SELECT store_id,flow_mode FROM zh_connections WHERE path_id=?').bind(webhook[1]).first();
    } else if (path === '/v1/send') {
      const id = request.headers.get('x-tien404-connection') || '';
      if (ID_RE.test(id)) row = await env.ZH_DB.prepare('SELECT store_id,flow_mode FROM zh_connections WHERE id=?').bind(id).first();
    } else if (ADMIN_CONNECTION_ROUTES.has(path)) {
      // Legacy authenticates before reading admin bodies; preserve that boundary.
      const key = env.ZH_ADMIN_KEY, auth = request.headers.get('authorization') || '';
      if (typeof key !== 'string' || key.length < 32 || !auth.startsWith('Bearer ') || !(await secureEqual(auth.slice(7), key))) return { handler: legacy, env };
      const id = await connectionIdFromBody(request);
      if (id) row = await env.ZH_DB.prepare('SELECT store_id,flow_mode FROM zh_connections WHERE id=?').bind(id).first();
    }
    if (row?.store_id === QA_STORE && row.flow_mode === 'own') {
      // Immutable QA admission is separate from enable flags. Disabling commerce
      // keeps QA closed, including its old /v1/send, with no legacy fallback.
      return { handler: candidate, env: { ...env, ZH_LITE_COMMERCE_QA_STORES: QA_STORE } };
    }
    return { handler: legacy, env };
  }

  return {
    async route(request, env, deps) {
      let selected;
      try {
        selected = await selectedHandler(request, env);
      } catch {
        deps.log('PILOT_LOOKUP_FAILED');
        return unavailable();
      }
      return selected.handler.route(request, selected.env, deps);
    },
    async fetch(request, env, ctx) {
      let selected;
      try {
        selected = await selectedHandler(request, env);
      } catch {
        console.log('PILOT_LOOKUP_FAILED');
        return unavailable();
      }
      return selected.handler.default.fetch(request, selected.env, ctx);
    },
  };
}

