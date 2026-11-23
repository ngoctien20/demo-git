/* TIEN404 Zalo Hub — crypto helpers (WebCrypto only; runs on Cloudflare Workers and Node >= 20).
 * - Bot tokens and per-shop forward keys are sealed with AES-256-GCM under a master key (ZH_MASTER_KEY,
 *   base64 of 32 bytes, Worker secret). AAD binds the ciphertext to (connection, store, field), so a
 *   ciphertext copied to another row or shop does not decrypt.
 * - Webhook secrets and pairing codes are stored only as SHA-256 hex.
 */
const enc = new TextEncoder();
const dec = new TextDecoder();

export function b64(bytes) {
  let s = '';
  for (const x of bytes) s += String.fromCharCode(x);
  return btoa(s);
}
export function unb64(str) {
  const s = atob(str);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
export const b64url = (bytes) => b64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const hex = (bytes) => [...bytes].map((x) => x.toString(16).padStart(2, '0')).join('');

export function randomBytes(n) {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return a;
}
export const randomId = (n = 16) => hex(randomBytes(n));
export const randomSecret = (n = 32) => b64url(randomBytes(n));
/** 6-digit pairing code without modulo bias. */
export function randomCode() {
  const max = 4294000000; // 4294 * 10^6, multiple of 10^6
  for (;;) {
    const v = new Uint32Array(1);
    crypto.getRandomValues(v);
    if (v[0] < max) return String(v[0] % 1000000).padStart(6, '0');
  }
}

export async function sha256Hex(text) {
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(String(text)))));
}

/** Constant-time compare of two strings via their SHA-256 digests. */
export async function secureEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false;
  const [x, y] = await Promise.all([a, b].map((v) => crypto.subtle.digest('SHA-256', enc.encode(v))));
  const p = new Uint8Array(x), q = new Uint8Array(y);
  let d = 0;
  for (let i = 0; i < p.length; i++) d |= p[i] ^ q[i];
  return d === 0;
}

async function masterKey(env) {
  const raw = env && env.ZH_MASTER_KEY;
  if (typeof raw !== 'string') throw new Error('MASTER_KEY_MISSING');
  let bytes;
  try { bytes = unb64(raw.trim()); } catch { throw new Error('MASTER_KEY_INVALID'); }
  if (bytes.length !== 32) throw new Error('MASTER_KEY_INVALID');
  return crypto.subtle.importKey('raw', bytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}
const aad = (connectionId, storeId, field) => enc.encode(`tien404-zalo-hub:v1:${connectionId}:${storeId}:${field}`);

export async function seal(env, plaintext, connectionId, storeId, field) {
  const key = await masterKey(env);
  const iv = randomBytes(12);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad(connectionId, storeId, field) }, key, enc.encode(plaintext)));
  return `v1.${b64(iv)}.${b64(ct)}`;
}

export async function open(env, sealed, connectionId, storeId, field) {
  if (typeof sealed !== 'string' || !sealed.startsWith('v1.')) throw new Error('SEALED_MISSING');
  const [, ivB, ctB] = sealed.split('.');
  const key = await masterKey(env);
  try {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(ivB), additionalData: aad(connectionId, storeId, field) }, key, unb64(ctB));
    return dec.decode(pt);
  } catch {
    throw new Error('SEALED_INVALID');
  }
}

async function hmacKey(keyText) {
  return crypto.subtle.importKey('raw', enc.encode(keyText), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}
/** Signature over `${ts}.${body}` — same scheme both directions (hub → n8n forward, n8n → hub send). */
export async function signBody(keyText, ts, body) {
  const k = await hmacKey(keyText);
  return hex(new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(`${ts}.${body}`))));
}
export async function verifyBody(keyText, ts, body, signature, nowMs, windowSec = 300) {
  const t = Number(ts);
  if (!Number.isSafeInteger(t) || Math.abs(nowMs / 1000 - t) > windowSec) return false;
  if (typeof signature !== 'string' || !/^[0-9a-f]{64}$/.test(signature)) return false;
  return secureEqual(await signBody(keyText, ts, body), signature);
}
