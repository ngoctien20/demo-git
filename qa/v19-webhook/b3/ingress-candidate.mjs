// TIEN404 V19.0-B3 — SOURCE ONLY / OFFLINE QA.
// Not a deployed Worker. No credential values, real webhook registration, provider
// sends, Commerce API, Store authority, customer data or production D1 writes.
// The default module handler is deliberately LOCKED (423).
import { inspectStrictZaloQaEnvelope } from "../strict-zalo-contract-candidate.mjs";

const HEADERS = { "cache-control": "no-store", "x-content-type-options": "nosniff" };
const response = (status) => new Response(null, { status, headers: HEADERS });
const encoder = new TextEncoder();
const MAX_BODY_BYTES = 8192;
const MAX_QA_WINDOW_MS = 30 * 60_000;
const RATE_BUCKET_MS = 60_000;
const VALID_PATH = /^\/qa\/zalo-bot\/[A-Za-z0-9_-]{24,80}$/;
const VALID_INSTALLATION = /^qa-install-[A-Za-z0-9_-]{8,64}$/;

// One SQLite statement per rate decision, using D1 RETURNING.
// No per-isolate mutable Map or read/then-write race.
// Fixed time buckets allow boundary bursts up to 2x; NOT a WAF replacement.
export const RATE_SQL = [
  "INSERT INTO v19_b3_rate_windows",
  "(scope_key,window_start_ms,hits,updated_at_ms)",
  "VALUES (?1,?2,1,?3)",
  "ON CONFLICT(scope_key,window_start_ms) DO UPDATE SET",
  "hits=v19_b3_rate_windows.hits+1,",
  "updated_at_ms=excluded.updated_at_ms",
  "WHERE v19_b3_rate_windows.hits < ?4",
  "RETURNING hits"
].join(" ");

// Atomic uniqueness is scoped by trusted installation key.
// Matching retry increments attempts, not event count; same event identity
// with changed payload returns no row (409). Downstream handoff NOT included.
export const EVENT_SQL = [
  "INSERT INTO v19_b3_event_claims",
  "(scope_key,event_key,payload_key,admitted_at_ms,attempts,state)",
  "VALUES (?1,?2,?3,?4,1,'QA_ADMITTED_NO_SEND')",
  "ON CONFLICT(scope_key,event_key) DO UPDATE SET",
  "attempts=v19_b3_event_claims.attempts+1",
  "WHERE v19_b3_event_claims.payload_key=excluded.payload_key",
  "RETURNING attempts"
].join(" ");

/** Global stream deadline; never buffers more than maxBytes.
 * Cancellation is not awaited: a stuck upstream cannot prolong timeout. */
export async function readBoundedBody(request, {
  maxBytes = MAX_BODY_BYTES, timeoutMs = 1200
} = {}) {
  if (!Number.isInteger(maxBytes) || maxBytes < 1 || maxBytes > MAX_BODY_BYTES ||
      !Number.isInteger(timeoutMs) || timeoutMs < 10 || timeoutMs > 5000) {
    return { status: 503, bytes: null };
  }
  const lengthHeader = request.headers.get("content-length");
  if (lengthHeader !== null) {
    if (!/^(?:0|[1-9]\d*)$/.test(lengthHeader)) return { status: 400, bytes: null };
    if (Number(lengthHeader) > maxBytes) return { status: 413, bytes: null };
  }
  if (!request.body) return { status: 400, bytes: null };
  const reader = request.body.getReader();
  let timeoutId;
  let complete = false;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("READ_DEADLINE")), timeoutMs);
  });
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const part = await Promise.race([reader.read(), timeout]);
      if (part.done) break;
      if (!(part.value instanceof Uint8Array)) return { status: 400, bytes: null };
      size += part.value.byteLength;
      if (size > maxBytes) return { status: 413, bytes: null };
      chunks.push(part.value);
    }
    complete = true;
    if (size === 0) return { status: 400, bytes: null };
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const c of chunks) { bytes.set(c, offset); offset += c.byteLength; }
    return { status: 200, bytes };
  } catch (err) {
    return { status: err?.message === "READ_DEADLINE" ? 408 : 400, bytes: null };
  } finally {
    clearTimeout(timeoutId);
    if (!complete) {
      try { void reader.cancel("QA_READ_ABORT").catch(() => {}); } catch {}
    }
    try { reader.releaseLock(); } catch {}
  }
}

function equalsSharedSecret(received, expected) {
  if (typeof received !== "string" || typeof expected !== "string" ||
      expected.length < 32 || expected.length > 256 || received.length > 256) return false;
  const a = encoder.encode(received), b = encoder.encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < 256; i++) diff |= (a[i] || 0) ^ (b[i] || 0);
  return diff === 0;
}
async function hmacHex(pepper, data) {
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(pepper),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return [...new Uint8Array(digest)]
    .map(b => b.toString(16).padStart(2, "0")).join("");
}
const validSettings = (env, now) =>
  env?.QA_B3_MODE === "OFFLINE_QA_NO_SEND" &&
  VALID_PATH.test(env.QA_B3_CALLBACK_PATH || "") &&
  VALID_INSTALLATION.test(env.QA_B3_INSTALLATION_ID || "") &&
  typeof env.QA_B3_HEADER_SECRET === "string" &&
  env.QA_B3_HEADER_SECRET.length >= 32 &&
  env.QA_B3_HEADER_SECRET.length <= 256 &&
  typeof env.QA_B3_HASH_PEPPER === "string" &&
  env.QA_B3_HASH_PEPPER.length >= 32 &&
  env.QA_B3_HASH_PEPPER.length <= 256 &&
  /^TIEN404-QA-[A-Za-z0-9_-]{16,64}$/.test(env.QA_B3_CHALLENGE || "") &&
  Number.isSafeInteger(env.QA_B3_RATE_LIMIT) &&
  env.QA_B3_RATE_LIMIT >= 1 && env.QA_B3_RATE_LIMIT <= 20 &&
  Number.isSafeInteger(env.QA_B3_BODY_TIMEOUT_MS) &&
  env.QA_B3_BODY_TIMEOUT_MS >= 10 && env.QA_B3_BODY_TIMEOUT_MS <= 5000 &&
  Number.isSafeInteger(now) &&
  Number.isSafeInteger(Number(env.QA_B3_START_MS)) &&
  Number.isSafeInteger(Number(env.QA_B3_END_MS)) &&
  Number(env.QA_B3_END_MS) > Number(env.QA_B3_START_MS) &&
  Number(env.QA_B3_END_MS) - Number(env.QA_B3_START_MS) <= MAX_QA_WINDOW_MS &&
  typeof env.QA_B3_DB?.prepare === "function";

/** Only exported for offline QA; default Worker handler does NOT call it.
 * Installation ID must originate in a trusted server registry, never JSON.
 */
export async function handleB3OfflineQa(request, env = {}, now = Date.now()) {
  if (env.QA_B3_MODE !== "OFFLINE_QA_NO_SEND") return response(423);
  if (!validSettings(env, now)) return response(503);
  const url = new URL(request.url);
  if (url.pathname !== env.QA_B3_CALLBACK_PATH || url.search !== "") return response(404);
  if (request.method !== "POST") return response(405);
  if (now < Number(env.QA_B3_START_MS) || now > Number(env.QA_B3_END_MS)) return response(410);
  if (!equalsSharedSecret(request.headers.get("x-bot-api-secret-token"), env.QA_B3_HEADER_SECRET)) {
    return response(403);
  }
  if (!/^application\/json(?:;\s*charset=utf-8)?$/i.test(
    request.headers.get("content-type") || ""
  )) return response(415);
  // Consume a durable rate budget before parsing the body. Bad secret guesses
  // remain a separate WAF edge-abuse concern; no IP identity is assumed here.
  let scopeKey, limitResult;
  try {
    scopeKey = await hmacHex(env.QA_B3_HASH_PEPPER,
      ["scope:", env.QA_B3_INSTALLATION_ID].join(""));
    const bucketStart = Math.floor(now / RATE_BUCKET_MS) * RATE_BUCKET_MS;
    limitResult = await env.QA_B3_DB.prepare(RATE_SQL)
      .bind(scopeKey, bucketStart, now, env.QA_B3_RATE_LIMIT).first();
  } catch { return response(503); }
  if (limitResult === null) return response(429);
  if (!Number.isInteger(limitResult?.hits) || limitResult.hits < 1 ||
      limitResult.hits > env.QA_B3_RATE_LIMIT) return response(503);

  const read = await readBoundedBody(request, { timeoutMs: env.QA_B3_BODY_TIMEOUT_MS });
  if (read.status !== 200) return response(read.status);
  let parsed;
  try {
    parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(read.bytes));
  } catch { return response(400); }
  // Client-provided authority is never accepted, even as an override.
  if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
    for (const prohibited of ["tenant_id", "tenantId", "store_id", "storeId",
      "installation_id", "installationId", "customer_id", "customerId", "role"]) {
      if (Object.hasOwn(parsed, prohibited) ||
          (parsed.result && typeof parsed.result === "object" &&
           Object.hasOwn(parsed.result, prohibited))) return response(422);
    }
  }
  const decision = inspectStrictZaloQaEnvelope(parsed, {
    nowMs: now, expectedChallenge: env.QA_B3_CHALLENGE
  });
  if (decision.decision !== "REVIEW_ONLY") return response(422);
  const msg = parsed.result.message;
  let admitted;
  try {
    const eventKey = await hmacHex(env.QA_B3_HASH_PEPPER, JSON.stringify({
      event: parsed.result.event_name,
      from: msg.from.id, chat: msg.chat.id, messageId: msg.message_id
    }));
    const payloadKey = await hmacHex(env.QA_B3_HASH_PEPPER, JSON.stringify({
      date: msg.date, type: msg.chat.chat_type, isBot: msg.from.is_bot, text: msg.text
    }));
    admitted = await env.QA_B3_DB.prepare(EVENT_SQL)
      .bind(scopeKey, eventKey, payloadKey, now).first();
  } catch { return response(503); }
  if (admitted === null) return response(409);
  if (!Number.isInteger(admitted?.attempts) || admitted.attempts < 1) return response(503);
  return response(200); // Only an admitted QA receipt; no downstream processor
}

// Default fetch stays hard-locked, even if someone deploys this file as-is.
// A separately reviewed caller and authority registry are required to unlock.
export default { fetch() { return response(423); } };
