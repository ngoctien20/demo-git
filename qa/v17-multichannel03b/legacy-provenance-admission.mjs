// TIEN404 V17.MULTI-CHANNEL-03B — offline-only, fail-closed legacy fixture provenance triage.
// This checker DOES NOT establish original data creator, genuine Merchant authority,
// a real signed Supabase session or actual Store A/B RLS. No I/O, provider calls or SQL.
const EXPECTED_TOP = ['contract','observedOn','source','projectRef','readOnlySqlPath','observed','classification','note'];
const EXPECTED_OBSERVED = [
  'tenantCount','products','orders','orderSourceManual','ordersWithCustomerLink',
  'tenantsWithTestLikeNameAndSlug',
  'tenantsWithMatchingTenantProductOrderCreationTimestamp',
  'sharedCreationTimestampUtc','auditEventsTotal','verifiedOriginalSeedArtifacts'
];
const REQUIRED_DENIALS = [
  'canCertifyDataSynthetic','canGrantMerchantOwnership','canUseAsRealStoreAbAuthProof',
  'merchantOriginalDocumentUploadRequiredNow','canPurgeOrMigrateRows',
  'canOpenMerchantUploadPortal','canEnableMetaNoSendCanary'
];
const EXACT_CLASS = [
  'label','sourceOfTruth',...REQUIRED_DENIALS,'shouldDeferSensitiveDocumentRequestPendingClassification'
];
const isPlain = x => x !== null && typeof x === 'object' && !Array.isArray(x) &&
  (Object.getPrototypeOf(x)===Object.prototype || Object.getPrototypeOf(x)===null);
const exactKeys = (v,keys) => isPlain(v) && Object.keys(v).length===keys.length &&
  keys.every(k=>Object.hasOwn(v,k));
const denied = reason => Object.freeze({
  status:'BLOCKED',reason,provenanceClassification:'UNCLASSIFIED',
  realMerchantOwnershipVerified:false,originalSeedSourceVerified:false,
  canCertifyDataSynthetic:false,canGrantMerchantOwnership:false,
  canAdmitRealUat:false,canApplyStoreRls:false,canDeploy:false,
  canWrite:false,canReadMerchantDocuments:false,canOpenMerchantUploadPortal:false,
  canEnableMetaNoSendCanary:false,canSendMessages:false,noSend:true
});

export function inspectLegacyFourRowProvenance({snapshot,claimedOriginalSource,nowIso}={}) {
  // A caller-supplied purported source, receipt, signer flag or URL never upgrades this
  // module; independently verified primary source validation is a DIFFERENT gated workflow.
  if (claimedOriginalSource !== undefined && claimedOriginalSource !== null)
    return denied('EXTERNAL_SOURCE_CLAIM_NOT_AN_INDEPENDENT_ATTESTATION');
  if(!exactKeys(snapshot,EXPECTED_TOP) ||
    snapshot.contract !== 'T404_MC03B_LIVE_PROVENANCE_CLASSIFICATION_V1' ||
    snapshot.source !== 'HOSTED_SUPABASE_READ_ONLY_AGGREGATES' ||
    snapshot.projectRef !== 'ifxlvrhyjhbzbrkdsida' ||
    snapshot.readOnlySqlPath !== 'qa/v17-multichannel03b/legacy-four-row-provenance-READ_ONLY.sql' ||
    snapshot.observedOn !== '2026-11-17' ||
    typeof snapshot.note !== 'string' || snapshot.note.length < 30 || snapshot.note.length > 600)
    return denied('SNAPSHOT_SCOPE_OR_CONTRACT_MISMATCH');
  const o=snapshot.observed, c=snapshot.classification;
  if(!exactKeys(o,EXPECTED_OBSERVED) || !exactKeys(c,EXACT_CLASS))
    return denied('UNTRUSTED_METADATA_FIELDS');
  if(c.label!=='QA_LIKELY_NOT_VERIFIED_SYNTHETIC' ||
    c.sourceOfTruth!=='NOT_ESTABLISHED' ||
    !REQUIRED_DENIALS.every(k=>c[k]===false) ||
    c.shouldDeferSensitiveDocumentRequestPendingClassification!==true)
    return denied('UNAPPROVED_PROVENANCE_PRIVILEGE_ESCALATION');
  const counts=[o.tenantCount,o.products,o.orders,o.orderSourceManual,
    o.ordersWithCustomerLink,o.tenantsWithTestLikeNameAndSlug,
    o.tenantsWithMatchingTenantProductOrderCreationTimestamp,
    o.auditEventsTotal,o.verifiedOriginalSeedArtifacts];
  if(!counts.every(n=>Number.isSafeInteger(n) && n>=0))
    return denied('INVALID_AGGREGATE_COUNT');
  if(o.tenantCount!==2 || o.products!==2 || o.orders!==2 ||
    o.orderSourceManual!==2 || o.ordersWithCustomerLink!==0 ||
    o.tenantsWithTestLikeNameAndSlug!==2 ||
    o.tenantsWithMatchingTenantProductOrderCreationTimestamp!==2 ||
    o.auditEventsTotal!==0 || o.verifiedOriginalSeedArtifacts!==0 ||
    o.sharedCreationTimestampUtc!=='2026-11-10T14:04:29.056346Z')
    return denied('OBSERVED_LEGACY_FOUR_ROW_AGGREGATE_DRIFT');
  if(nowIso!==undefined &&
    (typeof nowIso!=='string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(nowIso) ||
     !Number.isFinite(Date.parse(nowIso)) || Date.parse(nowIso)<Date.parse(o.sharedCreationTimestampUtc)))
    return denied('INVALID_REVIEW_TIME');
  return Object.freeze({
    status:'INDEPENDENT_SOURCE_REVIEW_REQUIRED',
    reason:'CIRCUMSTANTIAL_QA_SEED_PATTERN_NOT_ORIGINAL_SOURCE_PROOF',
    provenanceClassification:'QA_LIKELY_NOT_VERIFIED_SYNTHETIC',
    aggregateCountsMatch:true,sourceLineageNotEstablished:true,
    deferSensitiveMerchantDocumentRequest:true,
    realMerchantOwnershipVerified:false,originalSeedSourceVerified:false,
    canCertifyDataSynthetic:false,canGrantMerchantOwnership:false,
    canAdmitRealUat:false,canApplyStoreRls:false,canDeploy:false,
    canWrite:false,canReadMerchantDocuments:false,canOpenMerchantUploadPortal:false,
    canEnableMetaNoSendCanary:false,canSendMessages:false,noSend:true
  });
}
