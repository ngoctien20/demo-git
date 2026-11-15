import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';

export function reject(code) {
  throw Object.assign(new Error(code), { code });
}
const opaque = /^[A-Za-z0-9:_-]{2,128}$/;
const verified = new WeakSet();
export const isVerified = (obj) => verified.has(obj);
export const codePattern = /^T404-[0-9A-F]{16}$/;
export const money = (n) => BigInt(n).toLocaleString('vi-VN') + 'đ';
const normal = (v) =>
  v.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/gi, 'd').trim().toUpperCase().replace(/\s+/g, ' ');
const orderPatterns = [
  /^([A-Z]{1,4}\d{2,6})\s*[X×*]\s*([1-9]\d{0,3})$/,
  /^(?:(?:TOI|MINH|EM|CHO TOI|CHO MINH)\s+)?(?:MUON\s+)?(?:MUA|LAY|DAT)\s+([1-9]\d{0,3})\s+(?:(?:CAI|AO|GOI|HOP|CHIEC|BO|SAN PHAM)\s+)?(?:MA\s+)?([A-Z]{1,4}\d{2,6})[.!]?$/
];
export function parseOrder(text) {
  if (typeof text !== 'string' || text.length > 256) return null;
  const source = normal(text);
  let m = source.match(orderPatterns[0]);
  if (m) return { sku: m[1], quantity: Number(m[2]) };
  m = source.match(orderPatterns[1]);
  return m ? { sku: m[2], quantity: Number(m[1]) } : null;
}
export function parseOwner(text) {
  if (typeof text !== 'string' || text.length > 100) return null;
  const [command, arg, ...extra] = normal(text).split(' ');
  if (extra.length) return null;
  if (command === '/DONMOI' && !arg) return { action: 'new' };
  if (command === '/BAOCAO' && !arg) return { action: 'summary', period: 'today' };
  if (command === '/DOANHTHU' && (!arg || ['7NGAY', 'THANG'].includes(arg)))
    return { action: 'revenue', period: arg === '7NGAY' ? 'week' : arg === 'THANG' ? 'month' : 'today' };
  const action = { '/DON': 'detail', '/XACNHAN': 'confirm', '/TUCHOI': 'cancel' }[command];
  return action && codePattern.test(arg || '') ? { action, code: arg } : null;
}
const hash = (key, data) => createHmac('sha256', key).update(data).digest('hex');
const compare = (a, b) =>
  typeof a === 'string' &&
  /^[a-f0-9]{64}$/.test(a) &&
  timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
const fields = ['route', 'event', 'actor', 'text', 'time'];
export const canonical = (message) => JSON.stringify(fields.map((k) => message[k]));
// QA adapter only. No provider endpoint accepts this synthetic signature.
export function createQaIngress(routes, clock = Date.now) {
  const map = new Map();
  for (const r of routes) {
    if (
      ![r.route, r.tenant, r.store, r.bot].every((v) => typeof v === 'string' && opaque.test(v)) ||
      !Buffer.isBuffer(r.key) ||
      r.key.length < 32 ||
      map.has(r.route) ||
      [...map.values()].some((x) => x.bot === r.bot || x.key.equals(r.key))
    )
      reject('INVALID_REGISTRY');
    map.set(r.route, Object.freeze({ ...r, key: Buffer.from(r.key) }));
  }
  return function verify(m) {
    if (
      !m ||
      typeof m !== 'object' ||
      Array.isArray(m) ||
      Object.keys(m).length !== 6 ||
      ![...fields, 'signature'].every((k) => Object.hasOwn(m, k)) ||
      ![m.route, m.event, m.actor].every((x) => typeof x === 'string' && opaque.test(x)) ||
      typeof m.text !== 'string' ||
      !m.text.trim() ||
      m.text.length > 512 ||
      !Number.isSafeInteger(m.time)
    )
      reject('UNVERIFIED_INPUT');
    const now = clock(),
      r = map.get(m.route);
    if (
      !r ||
      !Number.isFinite(now) ||
      Math.abs(now - m.time) > 120000 ||
      !compare(m.signature, hash(r.key, canonical(m)))
    )
      reject('UNVERIFIED_INPUT');
    const e = Object.freeze({
      tenant: r.tenant,
      store: r.store,
      bot: r.bot,
      source: 'qa_inbound',
      text: m.text,
      receivedAt: m.time,
      payloadHash: hash(r.key, JSON.stringify(['content', m.text])),
      actorHash: hash(r.key, JSON.stringify(['actor', r.route, m.actor])),
      recipientRef: 'qa-recipient-' + hash(r.key, JSON.stringify(['recipient', r.route, m.actor])),
      eventHash: hash(r.key, JSON.stringify(['event', r.route, m.event]))
    });
    verified.add(e);
    return e;
  };
}
export function createProofs(key, clock = Date.now) {
  if (!Buffer.isBuffer(key) || key.length < 32) reject('QA_PROOF_KEY_REQUIRED');
  return {
    issue(type, e, fields) {
      if (!isVerified(e)) reject('UNVERIFIED_INPUT');
      const payload = {
        type,
        tenant: e.tenant,
        store: e.store,
        bot: e.bot,
        actor: e.actorHash,
        until: clock() + 300000,
        ...fields
      };
      const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
      return data + '.' + hash(key, data);
    },
    read(type, e, token) {
      if (!isVerified(e) || typeof token !== 'string' || token.length > 2048) reject('INVALID_CONFIRMATION');
      const parts = token.split('.');
      if (parts.length !== 2 || !compare(parts[1], hash(key, parts[0]))) reject('INVALID_CONFIRMATION');
      const p = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
      if (
        p.type !== type ||
        p.actor !== e.actorHash ||
        p.tenant !== e.tenant ||
        p.store !== e.store ||
        p.bot !== e.bot
      )
        reject('INVALID_CONFIRMATION');
      return { ...p, expired: p.until <= clock() };
    }
  };
}

// Called by the server only after it authenticates a Dashboard session and resolves the selected shop.
// The user's verified Supabase subject is compared to the current R1 challenge on every Owner operation.
export function dashboardEvents(scope, subject, key, clock=Date.now) {
  if(!scope || ![scope.tenant,scope.store,scope.bot].every(x=>typeof x==='string'&&opaque.test(x))
    || typeof subject!=='string' || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(subject)
    ||!Buffer.isBuffer(key)||key.length<32)reject('UNVERIFIED_INPUT');
  const {tenant,store,bot}=scope, actorHash=hash(key,JSON.stringify(['dashboard-owner',tenant,store,bot,subject]));
  return (text,event=randomUUID())=>{
    if(typeof text!=='string'||text.length>512||typeof event!=='string'||!opaque.test(event))reject('UNVERIFIED_INPUT');
    const e=Object.freeze({tenant,store,bot,text,source:'dashboard_session',ownerUserId:subject,authTenant:scope.authTenant,actorHash,
      eventHash:hash(key,JSON.stringify(['dashboard-event',tenant,store,bot,subject,event])),receivedAt:clock()});
    verified.add(e);return e;
  };
}
