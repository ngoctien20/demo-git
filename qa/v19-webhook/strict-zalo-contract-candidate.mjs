// TIEN404 V19.0-B2 — OFFLINE QA-ONLY strict Zalo Bot shape admission.
// This is NOT a deployed Worker, a provider authentication gate, or an order/customer authority.
// Zalo Bot uses X-Bot-Api-Secret-Token; Zalo OA must have its own separate validator.
// Source: https://docs.zaloplatforms.com/docs/BOT/webhook (checked 2026-11-18).
// Return only non-PII decisions. Never store raw sender/chat/message IDs or raw text here.

const ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const MAX_SKEW_MS = 180000;
const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const judgment = (decision, reason) => Object.freeze({
  contract: "V19_ZALO_BOT_STRICT_QA_ONLY",
  decision,
  reason,
  providerHeaderAuthenticated: false,
  providerDeliveryVerified: false,
  durableEventStored: false,
  storeAuthorityVerified: false,
  customerIdentityVerified: false,
  orderReadAllowed: false,
  orderWriteAllowed: false,
  providerSendAllowed: false,
  webhookPublishAllowed: false,
  containsPII: false
});

/**
 * Pure parser for an already decoded JSON object from an independent authenticated ingress.
 * A result of REVIEW_ONLY is not authorization.  Any verification of the shared header and
 * durable write must occur separately, before a hosted provider ACK.
 */
export function inspectStrictZaloQaEnvelope(body, { nowMs, expectedChallenge } = {}) {
  if (!Number.isSafeInteger(nowMs) ||
      typeof expectedChallenge !== "string" ||
      !/^TIEN404-QA-[A-Za-z0-9_-]{16,64}$/.test(expectedChallenge)) {
    return judgment("DENY", "QA_CONFIGURATION_INVALID");
  }
  // Official Zalo Bot webhook uses {ok:true, result:{event_name,message}}.
  // Do not grant authority to the flat layout that the old snapshot currently admits.
  if (!isObject(body) || body.ok !== true || !isObject(body.result) ||
      Object.hasOwn(body, "event_name") || Object.hasOwn(body, "message")) {
    return judgment("DENY", "NONCANONICAL_ENVELOPE");
  }
  const event = body.result;
  if (event.event_name === "message.unsupported.received") {
    return judgment("IGNORE", "PRIVACY_UNSUPPORTED_EVENT");
  }
  if (event.event_name !== "message.text.received") {
    return judgment("IGNORE", "UNSUPPORTED_EVENT_TYPE");
  }
  const msg = event.message;
  if (!isObject(msg) || !isObject(msg.from) || !isObject(msg.chat)) {
    return judgment("DENY", "MALFORMED_MESSAGE");
  }
  if (msg.from.is_bot !== false) {
    return judgment("IGNORE", "BOT_OR_UNKNOWN_SENDER");
  }
  if (msg.chat.chat_type !== "PRIVATE") {
    return judgment("IGNORE", "NON_PRIVATE_CHAT");
  }
  if (typeof msg.from.id !== "string" || !ID_RE.test(msg.from.id) ||
      typeof msg.chat.id !== "string" || !ID_RE.test(msg.chat.id) ||
      typeof msg.message_id !== "string" || !ID_RE.test(msg.message_id) ||
      msg.message_id.length < 8) {
    return judgment("DENY", "MISSING_OR_INVALID_EVENT_IDENTIFIERS");
  }
  // Equality of private chat and sender IDs is a QA-only restrictive policy, not a
  // documented guarantee for every future Zalo Bot channel/event shape.
  if (msg.from.id !== msg.chat.id) {
    return judgment("DENY", "PRIVATE_SENDER_CHAT_CONFLICT");
  }
  if (!Number.isSafeInteger(msg.date) || msg.date <= 0 ||
      Math.abs(nowMs - msg.date) > MAX_SKEW_MS) {
    return judgment("DENY", "INVALID_OR_STALE_TIMESTAMP");
  }
  if (typeof msg.text !== "string" || msg.text !== expectedChallenge) {
    return judgment("DENY", "NOT_QA_CHALLENGE");
  }
  return judgment("REVIEW_ONLY", "CANONICAL_QA_TEXT_SHAPE");
}
