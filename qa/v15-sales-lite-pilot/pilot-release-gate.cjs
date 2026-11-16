'use strict';
/**
 * TIEN404 Sales Lite: source-only evidence review, NEVER a production gate.
 * It does not verify attached evidence, credentials, provider signatures,
 * database authorization or owner identity. Always requires human release approval.
 */
const GATES = Object.freeze({
  canonical_store: 'AUTHENTICATED_STORE_RLS_AND_FOUR_ROW_OWNER_PROOF',
  provider_identity: 'NATIVE_PROVIDER_IDENTITY_AND_CONSENT',
  durable_replay: 'HOSTED_IDEMPOTENCY_AND_REPLAY_QA',
  catalog_quote: 'AUTHORITATIVE_STORE_PRICE_STOCK_QA',
  order_request: 'AUTHORIZED_ORDER_DRAFT_AND_NO_DUPLICATE_QA',
  owner_notification: 'VERIFIED_OWNER_NOTIFICATION_DELIVERY',
  handoff: 'REAL_MERCHANT_HUMAN_HANDOFF_UAT',
  privacy: 'PRIVACY_DATA_PROCESSING_AND_CONSENT_REVIEW',
  cost: 'PER_STORE_BUDGET_AND_RATE_LIMIT_TEST',
  recovery: 'BACKUP_RESTORE_AND_ROLLBACK_REHEARSAL',
  owner_signoff: 'INDEPENDENT_MERCHANT_PILOT_APPROVAL'
});
const LITE_FEATURES = Object.freeze([
  'catalog_read', 'price_quote', 'order_request_draft',
  'owner_notification', 'basic_store_profile', 'pause_bot', 'human_handoff'
]);
const FUTURE_PREMIUM = Object.freeze([
  'unified_operations_dashboard', 'advanced_bot_customization',
  'merchant_model_selection', 'premium_model_tier',
  'multi_store_analytics', 'advanced_automation', 'multi_agent_studio'
]);
const banned = new Set(FUTURE_PREMIUM);
const allowed = new Set(LITE_FEATURES);
function reviewPilotManifest(manifest = {}) {
  const requested = manifest && Array.isArray(manifest.features) ? manifest.features : [];
  const scopesInvalid = !requested.every(x => typeof x === 'string' && allowed.has(x)) ||
    requested.some(x => banned.has(x));
  const proofs = manifest && typeof manifest === 'object' && !Array.isArray(manifest) &&
    manifest.gates && typeof manifest.gates === 'object' && !Array.isArray(manifest.gates)
      ? manifest.gates : {};
  const missing = [];
  for (const [gate, kind] of Object.entries(GATES)) {
    const p = proofs[gate];
    if (!p || p.status !== 'PASS' || p.evidence_kind !== kind ||
      p.scope !== 'REAL_HOSTED_OR_PROVIDER_INDEPENDENT' ||
      typeof p.evidence_ref !== 'string' || !/^https:\/\/\S{8,500}$/.test(p.evidence_ref)) {
      missing.push(gate);
    }
  }
  const reviewComplete = missing.length === 0 && !scopesInvalid && requested.length > 0;
  return Object.freeze({
    status: reviewComplete ? 'MANUAL_SECURITY_REVIEW_REQUIRED' : 'BLOCKED',
    candidate_only: true, can_publish: false, can_send: false,
    can_write_orders: false, paid_model_calls: 0,
    enterprise_scope_blocked: scopesInvalid,
    missing_gates: Object.freeze(missing),
    disclaimer: 'SOURCE_ONLY_EVIDENCE_INDEX_NOT_AN_AUTHORIZATION_OR_RELEASE_DECISION'
  });
}
module.exports = {GATES, LITE_FEATURES, FUTURE_PREMIUM, reviewPilotManifest};
