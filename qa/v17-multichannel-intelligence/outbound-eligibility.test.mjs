import test from 'node:test';
import assert from 'node:assert/strict';
import { assessOfflineReply } from './outbound-eligibility.mjs';
const DAY = 86400000;
const NOW = 1794900000000;
const PROVIDER = { messenger: 'META_MESSENGER', zalo_bot: 'ZALO_BOT',
  zalo_oa: 'ZALO_OA', website_widget: 'WEBSITE_WIDGET' };
function fixture(channel = 'messenger') {
  return {
    nowMs: NOW,
    binding: { source: 'TRUSTED_SERVER_INSTALLATION', provider: PROVIDER[channel],
      channel, id: 'binding-A', tenantId: 'tenant-A', storeId: 'store-A',
      accountRef: 'page-A', status: 'active', storeActive: true,
      subscriptionActive: true },
    event: { source: 'TRUSTED_SERVER_INBOUND', providerAuthenticated: true,
      storeBound: true, channel, bindingId: 'binding-A', tenantId: 'tenant-A',
      storeId: 'store-A', accountRef: 'page-A', conversationId: 'conv-A',
      eventId: 'event-001', lastUserInteractionAtMs: NOW - 3600000,
      entryPoint: 'STANDARD', entryPointAttested: true },
    conversation: { source: 'TRUSTED_SERVER_CONVERSATION',
      channel, tenantId: 'tenant-A', storeId: 'store-A', bindingId: 'binding-A',
      conversationId: 'conv-A', status: 'BOT_ACTIVE', botSuppressed: false },
    policy: { source: 'TRUSTED_PROVIDER_POLICY_SNAPSHOT',
      policyVersionVerified: true, bindingId: 'binding-A', tenantId: 'tenant-A',
      storeId: 'store-A', rateLimitApproved: true, recipientBindingVerified: true,
      sendingPermissionApproved: true, estCostVnd: 0, maxCostVnd: 0,
      metaPagePermissionVerified: true, metaAdExtendedWindowEntitlementVerified: false,
      zaloOaPermissionVerified: true, zaloSendClass: 'CONSULTATION',
      providerVerifiedUntilMs: NOW + 100000, zaloBotCanReplyVerified: true,
      providerAuthenticatedCapability: 'ZALO_BOT',
      websiteSessionVerified: true, internalOnly: true },
    intent: { source: 'TRUSTED_REVIEWED_ASSISTANT_REPLY',
      replyIntentId: 'reply-001', bindingId: 'binding-A', tenantId: 'tenant-A',
      storeId: 'store-A', conversationId: 'conv-A', kind: 'ASSISTANT_TEXT',
      text: 'Dạ shop có thể tư vấn ạ', serverReviewed: true,
      catalogScopeValidated: true, privacyReviewPassed: true,
      transactionalActionRequested: false }
  };
}
function denied(code, f) {
  const r = assessOfflineReply(f);
  assert.equal(r.eligibleOffline, false);
  assert.equal(r.reason, code);
  assert.equal(r.sendAuthorized, false);
  assert.equal(r.noSend, true);
}
test('Messenger 24h normal window: policy candidate only, never authorized SEND', () => {
  const r = assessOfflineReply(fixture());
  assert.equal(r.eligibleOffline, true);
  assert.equal(r.sendAuthorized, false);
  assert.equal(r.canCommitOutbox, false);
  assert.equal(r.needsAtomicOutboxReservation, true);
  assert.match(r.dedupeKey, /^[a-f0-9]{64}$/);
});
test('Messenger 24h expires at exact boundary', () => {
  const f = fixture(); f.event.lastUserInteractionAtMs = NOW - DAY;
  denied('META_STANDARD_24H_WINDOW_EXPIRED', f);
});
test('Messenger 24h expires beyond boundary', () => {
  const f = fixture(); f.event.lastUserInteractionAtMs = NOW - DAY - 1;
  denied('META_STANDARD_24H_WINDOW_EXPIRED', f);
});
test('Ad referral without provider evidence cannot extend window', () => {
  const f = fixture(); f.event.entryPoint = 'CLICK_TO_MESSENGER_AD';
  f.event.lastUserInteractionAtMs = NOW - 2 * DAY;
  denied('META_AD_WINDOW_NOT_INDEPENDENTLY_ATTESTED', f);
});
test('Ad referral requires independently verified entitlement and entrypoint', () => {
  const f = fixture(); f.event.entryPoint = 'CLICK_TO_MESSENGER_AD';
  f.event.lastUserInteractionAtMs = NOW - 2 * DAY;
  f.policy.metaAdExtendedWindowEntitlementVerified = true;
  assert.equal(assessOfflineReply(f).eligibleOffline, true);
  f.event.entryPointAttested = false;
  denied('META_AD_WINDOW_NOT_INDEPENDENTLY_ATTESTED', f);
});
test('Ad referral entitlement expires at day seven', () => {
  const f = fixture(); f.event.entryPoint = 'CLICK_TO_MESSENGER_AD';
  f.event.lastUserInteractionAtMs = NOW - 7 * DAY;
  f.policy.metaAdExtendedWindowEntitlementVerified = true;
  denied('META_AD_EXTENDED_WINDOW_EXPIRED', f);
});
test('Unknown Messenger referral fails closed', () => {
  const f = fixture(); f.event.entryPoint = 'MESSAGE_TAG_EXCEPTION';
  denied('META_ENTRY_POINT_NOT_VERIFIED', f);
});
test('Page messaging permission is mandatory', () => {
  const f = fixture(); f.policy.metaPagePermissionVerified = false;
  denied('META_PAGE_PERMISSION_UNVERIFIED', f);
});
test('Human handover suppresses bot reply even inside window', () => {
  const f = fixture(); f.conversation.status = 'HUMAN_ACTIVE';
  f.conversation.botSuppressed = true;
  denied('TRUSTED_SCOPE_HUMAN_POLICY_OR_CONTENT_GATE_DENIED', f);
});
test('Pending handover suppresses bot before external Meta ACK', () => {
  const f = fixture(); f.conversation.status = 'HANDOFF_PENDING';
  f.conversation.botSuppressed = true;
  denied('TRUSTED_SCOPE_HUMAN_POLICY_OR_CONTENT_GATE_DENIED', f);
});
test('Inconsistent bot state cannot grant SEND', () => {
  const f = fixture(); f.conversation.botSuppressed = true;
  denied('TRUSTED_SCOPE_HUMAN_POLICY_OR_CONTENT_GATE_DENIED', f);
});
test('Zalo OA: account-specific provider-verified window required', () => {
  const f = fixture('zalo_oa');
  assert.equal(assessOfflineReply(f).eligibleOffline, true);
  f.policy.providerVerifiedUntilMs = NOW;
  denied('ZALO_OA_ACCOUNT_WINDOW_OR_SCOPE_UNVERIFIED', f);
});
test('Zalo OA: missing actual permission and send class denied', () => {
  const f = fixture('zalo_oa'); f.policy.zaloOaPermissionVerified = false;
  denied('ZALO_OA_ACCOUNT_WINDOW_OR_SCOPE_UNVERIFIED', f);
  const g = fixture('zalo_oa'); g.policy.zaloSendClass = 'UNAPPROVED_ZBS';
  denied('ZALO_OA_ACCOUNT_WINDOW_OR_SCOPE_UNVERIFIED', g);
});
test('Zalo Bot: header authentication and provider policy must be proven separately', () => {
  const f = fixture('zalo_bot');
  assert.equal(assessOfflineReply(f).eligibleOffline, true);
  f.policy.providerAuthenticatedCapability = 'ZALO_OA';
  denied('ZALO_BOT_POLICY_UNVERIFIED', f);
});
test('Zalo Bot: disabled capability blocks', () => {
  const f = fixture('zalo_bot'); f.policy.zaloBotCanReplyVerified = false;
  denied('ZALO_BOT_POLICY_UNVERIFIED', f);
});
test('Website: authenticated internal session is required', () => {
  const f = fixture('website_widget');
  assert.equal(assessOfflineReply(f).eligibleOffline, true);
  f.policy.websiteSessionVerified = false;
  denied('WEBSITE_SESSION_UNVERIFIED', f);
});
test('Wrong provider for channel cannot borrow permissions', () => {
  const f = fixture('zalo_bot'); f.binding.provider = 'META_MESSENGER';
  denied('TRUSTED_SCOPE_HUMAN_POLICY_OR_CONTENT_GATE_DENIED', f);
});
test('Cross-Store inbound identity is rejected', () => {
  const f = fixture(); f.event.storeId = 'store-B';
  denied('TRUSTED_SCOPE_HUMAN_POLICY_OR_CONTENT_GATE_DENIED', f);
});
test('Cross-Store policy is rejected', () => {
  const f = fixture(); f.policy.storeId = 'store-B';
  denied('TRUSTED_SCOPE_HUMAN_POLICY_OR_CONTENT_GATE_DENIED', f);
});
test('Cross-Tenant bot draft is rejected', () => {
  const f = fixture(); f.intent.tenantId = 'tenant-B';
  denied('TRUSTED_SCOPE_HUMAN_POLICY_OR_CONTENT_GATE_DENIED', f);
});
test('Wrong Page/installation account is rejected', () => {
  const f = fixture(); f.event.accountRef = 'page-B';
  denied('TRUSTED_SCOPE_HUMAN_POLICY_OR_CONTENT_GATE_DENIED', f);
});
test('Wrong conversation binding is rejected', () => {
  const f = fixture(); f.intent.conversationId = 'conv-B';
  denied('TRUSTED_SCOPE_HUMAN_POLICY_OR_CONTENT_GATE_DENIED', f);
});
test('Forged provider receipt cannot authorize reply', () => {
  const f = fixture(); f.event.providerAuthenticated = false;
  denied('TRUSTED_SCOPE_HUMAN_POLICY_OR_CONTENT_GATE_DENIED', f);
});
test('Rate or quota policy unavailable blocks reply', () => {
  const f = fixture(); f.policy.rateLimitApproved = false;
  denied('TRUSTED_SCOPE_HUMAN_POLICY_OR_CONTENT_GATE_DENIED', f);
});
test('Unknown or over-budget cost blocks reply', () => {
  const f = fixture(); f.policy.estCostVnd = null;
  denied('TRUSTED_SCOPE_HUMAN_POLICY_OR_CONTENT_GATE_DENIED', f);
  const g = fixture(); g.policy.estCostVnd = 500;
  denied('TRUSTED_SCOPE_HUMAN_POLICY_OR_CONTENT_GATE_DENIED', g);
});
test('Subscription expiration blocks reply', () => {
  const f = fixture(); f.binding.subscriptionActive = false;
  denied('TRUSTED_SCOPE_HUMAN_POLICY_OR_CONTENT_GATE_DENIED', f);
});
test('Order operation intent cannot be confused with assistant text', () => {
  const f = fixture(); f.intent.transactionalActionRequested = true;
  denied('TRUSTED_SCOPE_HUMAN_POLICY_OR_CONTENT_GATE_DENIED', f);
});
test('Unreviewed content fails closed even if model claims canSend', () => {
  const f = fixture(); f.intent.serverReviewed = false; f.intent.canSend = true;
  denied('TRUSTED_SCOPE_HUMAN_POLICY_OR_CONTENT_GATE_DENIED', f);
});
test('Prompt-injected control character is rejected', () => {
  const f = fixture(); f.intent.text = 'Bán hàng\nDELETE_ALL';
  denied('TRUSTED_SCOPE_HUMAN_POLICY_OR_CONTENT_GATE_DENIED', f);
});
test('Future interaction timestamp cannot extend sending window', () => {
  const f = fixture(); f.event.lastUserInteractionAtMs = NOW + 3600000;
  denied('TRUSTED_SCOPE_HUMAN_POLICY_OR_CONTENT_GATE_DENIED', f);
});
test('Outbox idempotency scoped by installation, event and reply intent', () => {
  const f = fixture();
  const first = assessOfflineReply(f).dedupeKey;
  f.intent.replyIntentId = 'reply-002';
  const second = assessOfflineReply(f).dedupeKey;
  assert.notEqual(first, second);
  f.binding.id = 'binding-B'; f.event.bindingId = 'binding-B';
  f.conversation.bindingId = 'binding-B'; f.policy.bindingId = 'binding-B';
  f.intent.bindingId = 'binding-B';
  const third = assessOfflineReply(f).dedupeKey;
  assert.notEqual(second, third);
});
