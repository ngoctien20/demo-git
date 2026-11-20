// TIEN404 V19.8.14 - deterministic fail-closed guard; not a server authorizer.
// Its input must ONLY be constructed by a trusted server from independently verified evidence.
export const READ_SCOPE = 'readonly_catalog_qa_only';
export const requiredEvidence = Object.freeze([
  'providerGetMeMatched','providerGetWebhookInfoMatched','webhookSecretBindingReviewed',
  'attestationSignedAndFresh','installationRegistryActive','installationVersionMatched',
  'ownerHostedJwtAuthenticated','ownerTenantMembershipActive','ownerStoreMembershipActive',
  'ownerChallengeConsumedOnce','ownerConsentNotRevoked','storeScopedReaderVerified',
  'durableReplayGuardVerified','backupAndRollbackVerified'
]);
export function evaluateHostedAdmission(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    return Object.freeze({decision:'NO_GO',missing:['trusted_evidence_aggregate'],canReadCatalog:false,canSend:false,canWriteOrders:false});
  const missing=requiredEvidence.filter(k=>input[k] !== true);
  if (input.scope !== READ_SCOPE) missing.push('exact_readonly_scope');
  if (input.evidenceOrigin !== 'trusted_server_verified') missing.push('trusted_provenance');
  if (typeof input.installationRef !== 'string' || !/^QA_INSTALL_[A-Z0-9_]{1,40}$/.test(input.installationRef)) missing.push('installation_ref');
  if (typeof input.boundStoreRef !== 'string' || !/^QA_STORE_[A-Z0-9_]{1,40}$/.test(input.boundStoreRef)) missing.push('bound_store_ref');
  if (input.requestedStoreRef !== input.boundStoreRef) missing.push('store_mismatch');
  if (!Number.isSafeInteger(input.registryVersion)||input.registryVersion<=0||input.registryVersion!==input.consentVersion) missing.push('consent_registry_version_mismatch');
  return Object.freeze({decision:missing.length?'NO_GO':'READ_ONLY_QA_ADMITTED',missing,canReadCatalog:missing.length===0,canSend:false,canWriteOrders:false});
}
