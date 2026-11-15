'use strict';
/*
 * TIEN404 V14.6-01 — SOURCE-ONLY composition of the inherited V14.4.8
 * Messenger synthetic four-flow engine with the V14.3 channel response contract.
 * NO NETWORK, NO OPENAI/META CALL, NO ORDERS DATABASE AND NO PROVIDER SEND.
 * Synthetic inputs have no authority outside this in-process QA fixture.
 */
const REQUIRED_L2 = Object.freeze([
 'trusted_page_store_identity', 'store_scoped_catalog_readback',
 'real_ai_bounded_inference', 'atomic_order_request_adapter',
 'durable_unsent_outbox', 'store_rls_jwt_acceptance',
 'independent_qa_trace_review'
]);
const fail = (msg) => { throw new Error(msg); };
function assessLevel2Evidence(candidate = {}) {
  // The supplied evidence is ALWAYS untrusted metadata; independently review it.
  if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate))
    fail('L2_EVIDENCE_INVALID');
  const missing = REQUIRED_L2.filter(key => {
    const x = Object.hasOwn(candidate, key) ? candidate[key] : undefined;
    return !x || typeof x !== 'object' || x.status !== 'VERIFIED' ||
      typeof x.evidenceRef !== 'string' || x.evidenceRef.length < 8 || x.evidenceRef.length > 240;
  });
  return Object.freeze({
    phase: 'V14.6-01', currentCertification: 'LEVEL1_ONLY',
    metadataCompleteness: missing.length === 0 ? 'CANDIDATE_FOR_INDEPENDENT_REVIEW' : 'INCOMPLETE',
    unverifiedOrMissing: Object.freeze(missing),
    independentlyVerified: false, canClaimLevel2: false,
    canSendProviderMessage: false, canWriteHostedOrders: false,
    canMergeOrPublish: false,
    reason: 'Metadata and synthetic passes cannot authorize hosted or provider actions'
  });
}
function createScopedOfflineBridge() {
  // Load pre-existing source from the same GitHub branch; do not duplicate it.
  const {createMessengerQaLab, PAGES} = require('../messenger-sales-v1448/messenger-four-flow-offline.cjs');
  const {build} = require('../channel-v143/channel-core.cjs');
  const lab = createMessengerQaLab();
  function simulateSyntheticMessage(input = {}) {
    const branded = lab.gateway.fixtureEnvelope(input);
    const raw = lab.handle(branded);
    const shop = PAGES[input.pageId];
    if (!shop) fail('SYNTHETIC_STORE_NOT_FOUND');
    const tenantId = 'qa_tenant_' + shop.tenant.toLowerCase();
    const storeId = 'qa_store_' + shop.store.toLowerCase();
    const binding = {
      source: 'SERVER_VERIFIED_CHANNEL_SCOPE', verified: true,
      serverDerived: true, tenantId, storeId, channel: 'MESSENGER',
      subscriptionActive: true, shopActive: true, allowedImageOrigins: []
    };
    const type = raw.awaitingConfirmation ? 'ORDER_CONFIRMATION_REQUIRED' :
      raw.flow === 'ORDER' && raw.requestCode ? 'ORDER_REQUEST_SUMMARY' :
      raw.flow === 'ORDER_SUPPORT' ? 'STAFF_HANDOFF' : 'TEXT';
    const intent = {source: 'TRUSTED_SALES_CORE', verified: true,
      tenantId, storeId, type, text: raw.message, dispatch_authorized: false};
    const response = build({binding, intent});
    if (response.dispatchAuthorized !== false || response.providerSends !== 0 ||
        response.orderWrites !== 0 || response.outboxWrites !== 0 ||
        raw.providerSends !== 0 || raw.writes !== 0)
      fail('NO_SEND_NO_WRITE_INVARIANT_VIOLATED');
    return Object.freeze({
      mode: 'SYNTHETIC_COMPOSITION_ONLY', contractVersion: response.contractVersion,
      flow: raw.flow, responseType: response.type, previewText: response.text,
      fixtureTenant: shop.tenant, fixtureStore: shop.store,
      requestCode: raw.requestCode || null, awaitingConfirmation: raw.awaitingConfirmation === true,
      replayed: raw.replayed === true, providerSends: 0, hostedWrites: 0,
      realAiCalled: false, metaSignatureVerified: false,
      jwtRlsVerified: false, durableOutboxVerified: false,
      canClaimLevel2: false, canPublish: false
    });
  }
  return Object.freeze({simulateSyntheticMessage, inspect: lab.inspect});
}
module.exports = {REQUIRED_L2, assessLevel2Evidence, createScopedOfflineBridge};
