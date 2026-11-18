/**
 * TIEN404 V18.1: read-only CROSS-CHANNEL E2E EVIDENCE CHECKLIST.
 * This is NOT an auth verifier, JWT parser, provider signature checker,
 * database permission grant, webhook forwarder, or deploy gate.
 * An untrusted input can never grant a right, regardless of all flags.
 * NO HTTP, NO DB, NO secrets, NO external effects.
 */
export const REQUIRED_SIGNALS = Object.freeze([
  "messengerWebhookObserved",
  "zaloNativeWebhookObserved",
  "zaloQaWorkerToN8nTraceObserved",
  "serverTrustedBotToStoreBinding",
  "canonicalSameTenantStoreAuthority",
  "customerCrossChannelProofConsumed",
  "commerceStagingOrderPersisted",
  "zaloOrderLookupOwnedAndAuthorized",
  "independentCustomerBDenialObserved",
  "independentStoreBDenialObserved",
  "durableReplayRejectionObserved",
  "independentBackupRestoreVerified",
  "privateOwnerABSessionsVerified",
  "separateHostedChangeApproved"
]);

export function assessCrossChannelEvidence(input) {
  // Read-only metadata, not authorization. Input can be hostile or forged.
  const signals = input && typeof input === "object" &&
    !Array.isArray(input) && input.signals &&
    typeof input.signals === "object" && !Array.isArray(input.signals)
    ? input.signals : {};
  const passing = REQUIRED_SIGNALS.filter(key => signals[key] === true);
  const missing = REQUIRED_SIGNALS.filter(key => signals[key] !== true);
  return Object.freeze({
    contract: "TIEN404_V181_CROSS_CHANNEL_E2E_EVIDENCE_NO_SEND",
    status: missing.length ? "HOSTED_E2E_NO_GO" : "CHECKLIST_COMPLETE_INDEPENDENT_REVIEW_REQUIRED",
    evidenceSatisfied: passing.length,
    evidenceRequired: REQUIRED_SIGNALS.length,
    missing: Object.freeze(missing),
    sourceMetadataCannotAuthorize: true,
    realProviderIdentityEstablishedByThisCode: false,
    signedOwnerSessionVerifiedByThisCode: false,
    merchantCustomerDataReadAuthorized: false,
    orderWriteAuthorized: false,
    outboundMessageAuthorized: false,
    hostedReleaseAuthorized: false,
    productionReleaseAuthorized: false
  });
}
