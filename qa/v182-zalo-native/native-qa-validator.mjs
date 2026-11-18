// TIEN404 V18.2 — Zalo QA native webhook shape validator. SOURCE ONLY.
// No HTTP listener, persistence, callback forwarding, provider messaging, orders, or authorization.
// All test inputs, including "trusted" booleans, are untrusted unless checked at a real perimeter.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const QA_CANARY = "QA_ZALO_NATIVE_182";
export const EXPECTED_EVENT = "message.text.received";
const REF_RE = /^[A-Za-z0-9_-]{1,128}$/;
const MAX_SKEW_MS = 120000;
const MAX_PAYLOAD_BYTES = 4096;

function report(reason, digest = null) {
  return Object.freeze({
    contract: "TIEN404_V182_ZALO_QA_NATIVE_INGRESS_SOURCE_ONLY",
    decision: reason === "CANDIDATE_METADATA_ONLY" ? "REVIEW_ONLY" : "DENY",
    reason,
    evidenceDigest: digest,
    headerEqualityChecked: reason !== "MISSING_HEADER" && reason !== "SERVER_NOT_CONFIGURED",
    actualZaloDeliveryVerified: false,
    canonicalBotToStoreVerified: false,
    durableReplayPersisted: false,
    authorizedToAcknowledgeProvider: false,
    authorizedToCallCore: false,
    authorizedToReadOrder: false,
    authorizedToWriteOrder: false,
    authorizedToSendMessage: false,
    authorizedToPublishWebhook: false,
    containsPII: false
  });
}

function singleHeader(headers, name) {
  if (!headers || typeof headers !== "object" || Array.isArray(headers)) return null;
  const vals = Object.entries(headers)
    .filter(([key]) => key.toLowerCase() === name)
    .map(([, value]) => value);
  return vals.length === 1 && typeof vals[0] === "string" ? vals[0] : null;
}

function equalsConstantTime(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const left = createHash("sha256").update(a, "utf8").digest();
  const right = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(left, right) && a.length === b.length;
}

export function checkNativeQaEvent(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return report("INVALID_REQUEST");
  const { headers, body, expectedSecret, evidenceKey, nowMs } = input;
  if (typeof expectedSecret !== "string" || expectedSecret.length < 8 ||
      expectedSecret.length > 256 || typeof evidenceKey !== "string" ||
      evidenceKey.length < 32 || !Number.isSafeInteger(nowMs))
    return report("SERVER_NOT_CONFIGURED");

  const received = singleHeader(headers, "x-bot-api-secret-token");
  if (!received) return report("MISSING_HEADER");
  if (!equalsConstantTime(received, expectedSecret)) return report("BAD_HEADER");
  const contentType = singleHeader(headers, "content-type");
  if (!contentType || !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(contentType))
    return report("UNSUPPORTED_MEDIA_TYPE");

  if (!body || typeof body !== "object" || Array.isArray(body)) return report("INVALID_BODY");
  let payloadSize;
  try { payloadSize = Buffer.byteLength(JSON.stringify(body), "utf8"); }
  catch { return report("INVALID_BODY"); }
  if (payloadSize > MAX_PAYLOAD_BYTES) return report("BODY_TOO_LARGE");
  const event = body.result;
  if (body.ok !== true || !event || typeof event !== "object" ||
      Array.isArray(event) || event.event_name !== EXPECTED_EVENT)
    return report("UNSUPPORTED_EVENT");
  const msg = event.message;
  if (!msg || typeof msg !== "object" || Array.isArray(msg) ||
      !msg.from || !msg.chat || msg.from.is_bot === true ||
      msg.chat.chat_type !== "PRIVATE" ||
      typeof msg.from.id !== "string" || !REF_RE.test(msg.from.id) ||
      typeof msg.chat.id !== "string" || !REF_RE.test(msg.chat.id) ||
      msg.from.id !== msg.chat.id ||
      typeof msg.message_id !== "string" || !REF_RE.test(msg.message_id) ||
      !Number.isSafeInteger(msg.date) || Math.abs(nowMs - msg.date) > MAX_SKEW_MS)
    return report("MALFORMED_OR_STALE_EVENT");
  if (typeof msg.text !== "string" || msg.text !== QA_CANARY)
    return report("NOT_QA_CANARY");

  const digest = createHmac("sha256", evidenceKey)
    .update("ZALO_BOT_QA_V182\0" + event.event_name + "\0" + msg.message_id, "utf8")
    .digest("hex");
  // Digest only; never output the raw user ID, message ID, text, secret, or body.
  // Actual verified provider identity and durable replay require a separate hosted integration.
  return report("CANDIDATE_METADATA_ONLY", digest);
}
