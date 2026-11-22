// TIEN404 V21.1 Reaction Admission — pure and fail closed.
// No network requests, database writes, credentials or release permission.
import { classifyLightweightReaction } from './social-reactions.mjs';

export const REACTION_ADMISSION_VERSION = 't404.reaction-admission.v1';
export const REACTION_POLICY_SCHEMA_VERSION = 1;
const BLOCK = reason => Object.freeze({ mode: 'blocked', reason });
const safeId = x => typeof x === 'string' && x.length >= 2 && x.length <= 256 && /^[A-Za-z0-9._:$-]+$/.test(x);
const safeMillis = x => Number.isSafeInteger(x) && x > 0;
const fresh = (stamp, now, maxAge) => safeMillis(stamp) && stamp <= now + 5000 && stamp >= now - maxAge;
const allowedKeys = (object, keys) => !!object && typeof object === 'object' && !Array.isArray(object) &&
  Object.keys(object).every(k => keys.includes(k));
const validPolicyIntents = intents => allowedKeys(intents, ['thanks', 'praise']) &&
  typeof intents.thanks === 'boolean' && typeof intents.praise === 'boolean' &&
  (intents.thanks || intents.praise);

/**
 * POLICY INPUT CONTRACT (not cryptographic authentication):
 * - record MUST come from an internal owner-authorized published policy registry,
 *   never from a Messenger webhook, customer input or LLM output.
 * - authority must be assembled exclusively by a trusted server-side resolver.
 * Client-supplied boolean "attestations" are NOT sufficient authentication.
 * Result contains no permission to call the Meta Send API.
 */
export function verifyPublishedPageReactionPolicy(record, authority, now = Date.now()) {
  if (!safeMillis(now)) return BLOCK('invalid_clock');
  if (!authority || authority.source !== 'trusted_server' ||
      authority.resolverVerified !== true || authority.policyReadAuthorized !== true ||
      !safeId(authority.tenantId) || !safeId(authority.pageId) ||
      !safeId(authority.installationId) || !safeId(authority.ownerId)) return BLOCK('untrusted_policy_source');
  if (!record || record.schemaVersion !== REACTION_POLICY_SCHEMA_VERSION ||
      record.provider !== 'meta_messenger' || record.lifecycle !== 'published' ||
      !Number.isSafeInteger(record.revision) || record.revision < 1 ||
      !safeId(record.tenantId) || !safeId(record.pageId) || !safeId(record.installationId) ||
      !safeId(record.ownerId) || record.enabled !== true) return BLOCK('policy_not_published_enabled');
  if (record.tenantId !== authority.tenantId || record.pageId !== authority.pageId ||
      record.installationId !== authority.installationId || record.ownerId !== authority.ownerId)
    return BLOCK('policy_scope_mismatch');
  if (!fresh(record.publishedAtMs, now, 365*24*3600_000) ||
      !safeMillis(record.expiresAtMs) || record.expiresAtMs <= now ||
      record.expiresAtMs - now > 365*24*3600_000) return BLOCK('policy_expired_or_unpublished');
  if (!record.ownerConsent || record.ownerConsent.approved !== true ||
      record.ownerConsent.revision !== record.revision ||
      record.ownerConsent.ownerId !== authority.ownerId ||
      !fresh(record.ownerConsent.approvedAtMs, now, 365*24*3600_000) ||
      !safeMillis(record.ownerConsent.expiresAtMs) || record.ownerConsent.expiresAtMs <= now ||
      record.ownerConsent.expiresAtMs - now > 365*24*3600_000)
    return BLOCK('owner_consent_missing_or_expired');
  if (!record.settings || !validPolicyIntents(record.settings.intents) ||
      !Number.isSafeInteger(record.settings.cooldownSeconds) ||
      record.settings.cooldownSeconds < 60 || record.settings.cooldownSeconds > 3600 ||
      !Number.isSafeInteger(record.settings.maxPerHour) ||
      record.settings.maxPerHour < 1 || record.settings.maxPerHour > 6)
    return BLOCK('policy_limits_invalid');
  return Object.freeze({
    mode: 'verified_policy', provider: 'meta_messenger', tenantId: record.tenantId,
    pageId: record.pageId, installationId: record.installationId, ownerId: record.ownerId,
    revision: record.revision,
    intents: Object.freeze({thanks: record.settings.intents.thanks, praise: record.settings.intents.praise}),
    cooldownSeconds: record.settings.cooldownSeconds, maxPerHour: record.settings.maxPerHour,
  });
}

/** Stage one: pure preflight. It does not acquire a dedupe lock or send a reaction. */
export function prepareReactionAdmission({event, policy, authority, thread, business} = {}, now = Date.now()) {
  if (!event || event.channel !== 'messenger' || event.kind !== 'message' || event.messageType !== 'text')
    return BLOCK('not_customer_text');
  const emoji = classifyLightweightReaction(event.text);
  if (!emoji) return BLOCK('not_social_only');
  const verified = verifyPublishedPageReactionPolicy(policy, authority, now);
  if (verified.mode !== 'verified_policy') return verified;
  if (!safeId(event.tenantId) || !safeId(event.pageId) || !safeId(event.senderId) ||
      !safeId(event.messageId) || event.pageId === event.senderId ||
      event.tenantId !== verified.tenantId || event.pageId !== verified.pageId)
    return BLOCK('message_scope_invalid');
  if (authority.webhookHmacVerified !== true || authority.recipientPageVerified !== true ||
      authority.sourceMessageId !== event.messageId || authority.sourceSenderId !== event.senderId ||
      !fresh(authority.messageTimestampMs, now, 3600_000) || authority.notEcho !== true ||
      authority.messageIsOriginalText !== true) return BLOCK('message_attestation_invalid');
  if (!thread || thread.source !== 'trusted_meta_thread_lookup' || thread.verified !== true ||
      thread.botIsOwner !== true || thread.pageId !== event.pageId ||
      thread.senderId !== event.senderId || !fresh(thread.checkedAtMs, now, 60_000))
    return BLOCK('thread_ownership_not_fresh');
  if (!business || business.source !== 'trusted_business_state' || business.verified !== true ||
      business.tenantId !== event.tenantId || business.pageId !== event.pageId ||
      business.senderId !== event.senderId || !fresh(business.checkedAtMs, now, 15_000) ||
      business.handoffClear !== true || business.ordersClear !== true ||
      business.approvalsClear !== true || business.billingClear !== true ||
      business.menuClear !== true || business.privilegedClear !== true ||
      business.pendingToolsClear !== true) return BLOCK('business_state_not_clear');
  if ((emoji === '❤️' && !verified.intents.thanks) ||
      (emoji === '👍' && !verified.intents.praise)) return BLOCK('intent_disabled_by_owner');
  return Object.freeze({
    mode: 'claim_required', phase: 'preflight', reaction: emoji,
    provider: 'meta_messenger', tenantId: event.tenantId, pageId: event.pageId,
    senderId: event.senderId, messageId: event.messageId,
    policyRevision: verified.revision, installationId: verified.installationId,
    dedupeKey: JSON.stringify([event.tenantId, event.pageId, event.senderId, event.messageId, 'react']),
    limits: Object.freeze({cooldownSeconds: verified.cooldownSeconds, maxPerHour: verified.maxPerHour}),
    sendAllowed: false,
  });
}

/**
 * Stage two: check a receipt from an actual durable ATOMIC store.
 * This function CANNOT enforce a database UNIQUE constraint itself.
 * The receipt must be authenticated server-to-server; never from client JSON.
 */
export function verifyAtomicReactionClaim(preflight, receipt, now = Date.now()) {
  if (!preflight || preflight.mode !== 'claim_required' || preflight.sendAllowed !== false)
    return BLOCK('preflight_required');
  if (!receipt || receipt.source !== 'trusted_durable_atomic_store' ||
      receipt.serverVerified !== true || receipt.acquired !== true ||
      !safeId(receipt.claimId) || receipt.action !== 'react' ||
      receipt.dedupeKey !== preflight.dedupeKey ||
      receipt.tenantId !== preflight.tenantId || receipt.pageId !== preflight.pageId ||
      receipt.senderId !== preflight.senderId || receipt.messageId !== preflight.messageId ||
      receipt.policyRevision !== preflight.policyRevision ||
      receipt.cooldownEnforced !== true || receipt.hourlyLimitEnforced !== true ||
      !fresh(receipt.acquiredAtMs, now, 15_000) ||
      !safeMillis(receipt.expiresAtMs) || receipt.expiresAtMs <= now)
    return BLOCK('atomic_claim_missing_or_invalid');
  return Object.freeze({
    mode: 'dispatch_candidate', status: 'NOT_RELEASED', provider: 'meta_messenger',
    reaction: preflight.reaction, pageId: preflight.pageId, senderId: preflight.senderId,
    messageId: preflight.messageId, installationId: preflight.installationId,
    dedupeKey: preflight.dedupeKey, claimId: receipt.claimId,
    sendAllowed: false, requiresExplicitReleaseApproval: true,
  });
}

/** Only a verified provider acceptance for this exact MID may suppress text; no automatic retry. */
export function planSocialResponseAfterProvider(candidate, outcome) {
  if (!candidate || candidate.mode !== 'dispatch_candidate')
    return Object.freeze({mode: 'normal_text', reason: 'no_verified_candidate', retryReaction: false});
  if (outcome && outcome.source === 'trusted_meta_send_result' &&
      outcome.requestCorrelationVerified === true && outcome.claimId === candidate.claimId &&
      outcome.recipientId === candidate.senderId && outcome.action === 'react' &&
      outcome.messageId === candidate.messageId && outcome.pageId === candidate.pageId &&
      outcome.transportConfirmed === true && outcome.providerAccepted === true &&
      outcome.providerError === false)
    return Object.freeze({mode: 'reaction_only', reason: 'provider_accepted', retryReaction: false});
  return Object.freeze({mode: 'normal_text', reason: 'reaction_not_confirmed', retryReaction: false});
}
