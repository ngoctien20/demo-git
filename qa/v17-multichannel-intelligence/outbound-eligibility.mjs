// TIEN404 V17 — offline-only outbound send eligibility assessment.
// NEVER dispatch messages, mutate outbox or claim provider policy entitlement.
// Trusted inputs are private adapters; caller-supplied flags are NOT authentication.
import { createHash } from 'node:crypto';
import { canBotReply } from './handoff-planner.mjs';

const CHANNEL_PROVIDER = Object.freeze({
  messenger: 'META_MESSENGER', zalo_bot: 'ZALO_BOT',
  zalo_oa: 'ZALO_OA', website_widget: 'WEBSITE_WIDGET'
});
const ID = /^[A-Za-z0-9_.:-]{2,128}$/;
const isId = x => typeof x === 'string' && ID.test(x);
const DAY = 24 * 3600 * 1000;
const deny = reason => Object.freeze({
  eligibleOffline: false, reason, sendAuthorized: false, noSend: true,
  orderWriteAuthorized: false, providerCallExecuted: false
});
function safeInputs({ binding: b, event: e, conversation: c, policy: p,
  intent: i, nowMs: now }) {
  return b && e && c && p && i &&
    b.source === 'TRUSTED_SERVER_INSTALLATION' &&
    e.source === 'TRUSTED_SERVER_INBOUND' &&
    p.source === 'TRUSTED_PROVIDER_POLICY_SNAPSHOT' &&
    i.source === 'TRUSTED_REVIEWED_ASSISTANT_REPLY' &&
    e.providerAuthenticated === true && e.storeBound === true &&
    b.status === 'active' && b.storeActive === true &&
    b.subscriptionActive === true && p.policyVersionVerified === true &&
    Object.hasOwn(CHANNEL_PROVIDER, b.channel) &&
    b.provider === CHANNEL_PROVIDER[b.channel] && e.channel === b.channel &&
    [b.id, b.tenantId, b.storeId, b.accountRef,
      e.eventId, e.bindingId, e.tenantId, e.storeId, e.accountRef, e.conversationId,
      c.tenantId, c.storeId, c.bindingId, c.conversationId,
      p.bindingId, p.tenantId, p.storeId,
      i.replyIntentId, i.bindingId, i.tenantId, i.storeId, i.conversationId].every(isId) &&
    b.id === e.bindingId && b.id === c.bindingId && b.id === p.bindingId &&
    b.id === i.bindingId && e.accountRef === b.accountRef &&
    e.conversationId === c.conversationId && i.conversationId === c.conversationId &&
    b.tenantId === e.tenantId && b.tenantId === c.tenantId &&
    b.tenantId === p.tenantId && b.tenantId === i.tenantId &&
    b.storeId === e.storeId && b.storeId === c.storeId &&
    b.storeId === p.storeId && b.storeId === i.storeId &&
    Number.isSafeInteger(now) && now > 0 &&
    Number.isSafeInteger(e.lastUserInteractionAtMs) &&
    e.lastUserInteractionAtMs > 0 && e.lastUserInteractionAtMs <= now &&
    c.source === 'TRUSTED_SERVER_CONVERSATION' &&
    c.channel === b.channel && canBotReply(c) &&
    i.kind === 'ASSISTANT_TEXT' && typeof i.text === 'string' &&
    i.text.trim().length > 0 && i.text.length <= 1600 &&
    !/[\u0000-\u001f\u007f]/.test(i.text) &&
    i.serverReviewed === true &&
    i.catalogScopeValidated === true &&
    i.privacyReviewPassed === true &&
    i.transactionalActionRequested === false &&
    p.rateLimitApproved === true &&
    p.recipientBindingVerified === true &&
    Number.isSafeInteger(p.estCostVnd) && p.estCostVnd >= 0 &&
    Number.isSafeInteger(p.maxCostVnd) && p.maxCostVnd >= 0 &&
    p.estCostVnd <= p.maxCostVnd &&
    p.sendingPermissionApproved === true;
}
/**
 * Output is ONLY a non-authoritative planning verdict; no provider SEND can
 * be executed from this module. Real send admission requires an independent
 * provider runtime policy+atomic outbox+consent confirmation immediately before dispatch.
 */
export function assessOfflineReply({ binding, event, conversation, policy,
  intent, nowMs } = {}) {
  if (!safeInputs({ binding, event, conversation, policy, intent, nowMs }))
    return deny('TRUSTED_SCOPE_HUMAN_POLICY_OR_CONTENT_GATE_DENIED');

  const age = nowMs - event.lastUserInteractionAtMs;
  if (binding.channel === 'messenger') {
    if (policy.metaPagePermissionVerified !== true)
      return deny('META_PAGE_PERMISSION_UNVERIFIED');
    if (event.entryPoint === 'STANDARD') {
      if (age >= DAY) return deny('META_STANDARD_24H_WINDOW_EXPIRED');
    } else if (event.entryPoint === 'CLICK_TO_MESSENGER_AD') {
      // 2026 provider changelog says up to 7 days, not universally entitled.
      if (event.entryPointAttested !== true ||
          policy.metaAdExtendedWindowEntitlementVerified !== true)
        return deny('META_AD_WINDOW_NOT_INDEPENDENTLY_ATTESTED');
      if (age >= 7 * DAY) return deny('META_AD_EXTENDED_WINDOW_EXPIRED');
    } else return deny('META_ENTRY_POINT_NOT_VERIFIED');
  } else if (binding.channel === 'zalo_oa') {
    // NO hardcoded "7 days for every OA"; current OA policy/recipient
    // scope/charge must be proven for this installation by private server.
    if (policy.zaloOaPermissionVerified !== true ||
        policy.zaloSendClass !== 'CONSULTATION' ||
        !Number.isSafeInteger(policy.providerVerifiedUntilMs) ||
        nowMs >= policy.providerVerifiedUntilMs)
      return deny('ZALO_OA_ACCOUNT_WINDOW_OR_SCOPE_UNVERIFIED');
  } else if (binding.channel === 'zalo_bot') {
    if (policy.zaloBotCanReplyVerified !== true ||
        policy.providerAuthenticatedCapability !== 'ZALO_BOT')
      return deny('ZALO_BOT_POLICY_UNVERIFIED');
  } else {
    if (policy.websiteSessionVerified !== true ||
        policy.internalOnly !== true) return deny('WEBSITE_SESSION_UNVERIFIED');
  }

  const dedupeKey = createHash('sha256')
    .update(JSON.stringify([binding.provider, binding.id, event.eventId,
      intent.replyIntentId])).digest('hex');
  return Object.freeze({
    eligibleOffline: true, reason: 'ELIGIBLE_OFFLINE_NOT_AUTHORIZED',
    sendAuthorized: false, noSend: true, orderWriteAuthorized: false,
    providerCallExecuted: false, canCommitOutbox: false,
    needsAtomicOutboxReservation: true,
    needsFreshPreDispatchPolicy: true, dedupeKey
  });
}
