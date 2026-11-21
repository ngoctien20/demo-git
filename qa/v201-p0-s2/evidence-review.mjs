/**
 * TIEN404 V20.1-P0-S2 -- EVIDENCE REVIEW ONLY, NOT AUTHORIZATION.
 *
 * Every value is a reviewer-facing claim. No boolean, signature, mock
 * evidence, URL, or status passed here can enable provider send, QR issuance,
 * hosted privilege changes, database writes or production. No I/O.
 */
export const REQUIRED_GATES = Object.freeze([
  'n8n_current_published_census',
  'n8n_dynamic_caller_review',
  'cloudflare_deployed_caller_review',
  'render_confirmed_workspace_caller_review',
  'browser_and_external_rpc_caller_review',
  'privileged_rpc_restore_snapshot',
  'hosted_store_schema_and_rls',
  'real_auth_owner_a',
  'real_auth_owner_b',
  'same_tenant_cross_store_denial',
  'revoked_owner_same_jwt_denial',
  'backed_up_and_restored_hosted_data',
  'bot_identity_from_authorized_provider',
  'merchant_owner_installation_consent',
  'official_bot_specific_chat_link',
  'two_device_customer_qr_uat',
  'authenticated_inbound_no_send_receipt'
]);

const safeClaim = x => x && typeof x === 'object' && !Array.isArray(x) &&
  x.status === 'VERIFIED' && typeof x.evidenceRef === 'string' &&
  x.evidenceRef.length >= 8 && x.evidenceRef.length <= 512 &&
  typeof x.verifiedAt === 'string' && Number.isFinite(Date.parse(x.verifiedAt)) &&
  typeof x.scope === 'string' && x.scope.length > 4;

/**
 * Evidence only. VERIFIED means that a reviewer supplied a structurally valid
 * receipt reference, not that this module validated an external system.
 */
export function reviewS2Evidence(input) {
  const claims = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const missing = REQUIRED_GATES.filter(g => !safeClaim(claims[g]));
  const present = REQUIRED_GATES.filter(g => safeClaim(claims[g]));
  return Object.freeze({
    classification: missing.length ? 'EVIDENCE_INCOMPLETE' : 'HUMAN_REVIEW_REQUIRED',
    structurallyPresent: present,
    missing,
    evidenceOnly: true,
    authenticatedOwner: false,
    verifiedProviderBot: false,
    qrIssuanceAllowed: false,
    rpcRevokeAllowed: false,
    hostedMigrationAllowed: false,
    providerSendAllowed: false,
    orderWriteAllowed: false,
    productionReady: false
  });
}

export function classifyZaloEvidence(item) {
  if (!item || typeof item !== 'object') return 'UNVERIFIED';
  if (item.product === 'ZALO_OA_CHATBOT' && item.kind === 'SCENARIO_SHARE_LINK')
    return 'OFFICIAL_OA_ONLY_NOT_BOT_API';
  if (item.product === 'ZALO_BOT_CREATOR' && item.kind === 'CREATOR_MINIAPP_QR')
    return 'CREATOR_QR_NOT_CUSTOMER_BOT_CHAT';
  if (item.product === 'ZALO_BOT_API' && item.kind === 'BOT_CHAT_LINK')
    return 'BOT_LINK_CANDIDATE_NEEDS_PROVIDER_AND_DEVICE_PROOF';
  return 'UNVERIFIED';
}
