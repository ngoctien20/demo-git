import { readFile } from 'node:fs/promises';
import { codePattern, reject } from './protocol.mjs';

const files = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css']],
  ['/app.js', ['app.js', 'text/javascript']]
]);
const root = new URL('../dashboard/', import.meta.url);
const publicErrors = new Set([
  'SHOP_UNAVAILABLE',
  'OWNER_REQUIRED',
  'UNVERIFIED_INPUT',
  'REQUEST_NOT_FOUND',
  'STALE_DECISION',
  'INSUFFICIENT_STOCK',
  'PRICE_CHANGED',
  'INVALID_STATE',
  'INVALID_CONFIRMATION',
  'CONFIRMATION_EXPIRED',
  'INVALID_CURSOR',
  'INVALID_TAB',
  'INVALID_PERIOD',
  'INVALID_SETTING',
  'EVENT_CONFLICT',
  'UNKNOWN_COMMAND',
  'RECIPIENT_UNAVAILABLE',
  'QUOTE_EXPIRED',
  'QUOTE_SELECTION_REQUIRED',
  'EXPLICIT_CONFIRMATION_REQUIRED',
  'OUT_OF_ORDER'
]);
async function body(req) {
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) reject('BAD_REQUEST');
  let bytes = 0;
  const chunks = [];
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 4096) reject('BAD_REQUEST');
    chunks.push(chunk);
  }
  try {
    const data = JSON.parse(Buffer.concat(chunks));
    if (data && typeof data === 'object' && !Array.isArray(data)) return data;
  } catch {}
  reject('BAD_REQUEST');
}
// bindOwner returns a function creating a verified event from the *server's* authenticated session.
export function handler({ service, bindOwner, origin, verifyQaInbound = null }) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
    );
    const json = (code, v) => {
      res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(v));
    };
    try {
      const u = new URL(req.url, origin);
      if (req.method === 'GET' && files.has(u.pathname)) {
        const [name, mime] = files.get(u.pathname);
        const buf = await readFile(new URL(name, root));
        res.writeHead(200, { 'Content-Type': mime });
        return res.end(buf);
      }
      if (u.pathname === '/qa/inbound' && verifyQaInbound) {
        if (req.method !== 'POST') return json(405, { error: 'METHOD_DENIED' });
        return json(200, await service.receive(verifyQaInbound(await body(req))));
      }
      if (!['/api/view', '/api/decision', '/api/settings'].includes(u.pathname))
        return json(404, { error: 'NOT_FOUND' });
      if (req.method === 'POST' && req.headers.origin !== origin)
        return json(403, { error: 'ORIGIN_DENIED' });
      const session = await bindOwner(req);
      if (!session) return json(401, { error: 'SIGN_IN_REQUIRED' });
      if (u.pathname === '/api/view' && req.method === 'GET') {
        if ([...u.searchParams.keys()].some((k) => !['tab', 'period', 'before'].includes(k)))
          return json(400, { error: 'BAD_REQUEST' });
        return json(
          200,
          await service.dashboard(session('/baocao'), {
            tab: u.searchParams.get('tab') || 'new',
            period: u.searchParams.get('period') || 'today',
            before: u.searchParams.get('before')
          })
        );
      }
      if (req.method !== 'POST') return json(405, { error: 'METHOD_DENIED' });
      const value = await body(req);
      if (typeof value.event !== 'string' || !/^[a-zA-Z0-9-]{12,64}$/.test(value.event))
        reject('BAD_REQUEST');
      if (u.pathname === '/api/settings' && Object.keys(value).sort().join(',') === 'enabled,event')
        return json(200, await service.setAlerts(session('cai-dat', value.event), value.enabled));
      if (
        u.pathname !== '/api/decision' ||
        Object.keys(value).some((k) => !['action', 'code', 'event', 'proof'].includes(k)) ||
        !['confirm', 'cancel'].includes(value.action) ||
        typeof value.code !== 'string' ||
        !codePattern.test(value.code)
      )
        reject('BAD_REQUEST');
      const message = (value.action === 'confirm' ? '/xacnhan ' : '/tuchoi ') + value.code;
      return json(200, await service.command(session(message, value.event), value.proof ?? null));
    } catch (error) {
      const code = error?.code;
      if (code === 'BAD_REQUEST') return json(400, { error: code });
      if (publicErrors.has(code))
        return json(
          ['SHOP_UNAVAILABLE', 'OWNER_REQUIRED', 'UNVERIFIED_INPUT'].includes(code)
            ? 403
            : code === 'REQUEST_NOT_FOUND'
              ? 404
              : 409,
          { error: code }
        );
      return json(503, { error: 'TEMPORARILY_UNAVAILABLE' });
    }
  };
}
