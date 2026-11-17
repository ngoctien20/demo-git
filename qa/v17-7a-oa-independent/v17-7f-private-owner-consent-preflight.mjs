// TIEN404 V17.7F — private Merchant evidence consent preflight, SOURCE ONLY.
// This is not an authentication or signature verifier. It must never accept
// actual merchant secrets, personal data, signed JWT or source row values.
// RPC16 and RPC17.2 are separate unchanged projects; no hosted intake is made.

const CASES=Object.freeze(['T1_PRODUCT_1','T1_ORDER_1','T2_PRODUCT_1','T2_ORDER_1']);
const DIGEST=/^[a-f0-9]{64}$/;
const SLOT=/^[A-Za-z][A-Za-z0-9_-]{7,95}$/;
const STATUS=Object.freeze({
 sourceOnly:true,realMerchantAuthorized:false,realOwnerVerified:false,
 independentReviewerVerified:false,realStoreMembershipVerified:false,
 originalRecordSourceVerified:false,hostedR2IntakePermitted:false,
 databaseMigrationPermitted:false,realProviderCanaryPermitted:false,
 canReadCustomerRows:false,canSendProvider:false,canPublish:false
});
const reject=(reason,detail={})=>Object.freeze({
 candidate:false,reason,...STATUS,...detail
});
const shape=(detail={})=>Object.freeze({
 candidate:true,reason:'REDACTED_OWNER_CONSENT_PACKET_SHAPE_ONLY',...STATUS,...detail
});
const allowedTop=new Set(['mode','caseRefs','witnesses','expiryMs','consentScope',
 'invitationDigest','privateIntakeRef','noUpload','noStoreRead','noSend']);
const allowedWit=new Set(['caseRef','issuerDigest','ownerSessionDigest',
  'reviewerSessionDigest','originalSourceDigest','observedAtMs','scope']);
/**
 * Validates synthetic redacted metadata, NOT whether owner/reviewer truly
 * control a Store. Real Auth identity must be checked via private issuer,
 * real Supabase Auth JWKS / getUser and current membership + source readback.
 */
export function inspectPrivateMerchantConsentPacket(packet,nowMs){
 if(!packet||typeof packet!=='object'||Array.isArray(packet)||
    !Number.isSafeInteger(nowMs)||nowMs<=0||
    packet.mode!=='OFFLINE_REDACTED_FIXTURE'||
    packet.noUpload!==true||packet.noStoreRead!==true||packet.noSend!==true||
    packet.consentScope!=='FOUR_ORIGINAL_STORE_PROVENANCE_ONLY')
   return reject('PRIVATE_CONSENT_MODE_NOT_ESTABLISHED');
 if(Object.keys(packet).some(k=>!allowedTop.has(k)))
   return reject('RAW_IDENTITY_OR_UNTRUSTED_TOP_LEVEL_FIELD');
 if(!SLOT.test(packet.privateIntakeRef??'')||
    !DIGEST.test(packet.invitationDigest??'')||
    !Number.isSafeInteger(packet.expiryMs)||
    packet.expiryMs<=nowMs||packet.expiryMs>nowMs+15*60*1000)
   return reject('PRIVATE_INVITATION_BOUND_OR_EXPIRED');
 if(!Array.isArray(packet.caseRefs)||packet.caseRefs.length!==4||
    new Set(packet.caseRefs).size!==4||!CASES.every(k=>packet.caseRefs.includes(k))||
    !Array.isArray(packet.witnesses)||packet.witnesses.length!==4)
   return reject('FOUR_EXACT_SOURCE_RECORDS_MISSING');
 if(new Set(packet.witnesses.map(w=>w?.caseRef)).size!==4||
    !CASES.every(k=>packet.witnesses.some(w=>w?.caseRef===k)))
   return reject('FOUR_WITNESS_BINDINGS_MISSING');
 for(const witness of packet.witnesses){
   if(!witness||typeof witness!=='object'||Array.isArray(witness)||
      Object.keys(witness).some(k=>!allowedWit.has(k)))
     return reject('PII_OR_UNKNOWN_WITNESS_FIELD');
   if(![witness.issuerDigest,witness.ownerSessionDigest,
     witness.reviewerSessionDigest,witness.originalSourceDigest].every(v=>DIGEST.test(v??'')))
     return reject('MISSING_WITNESS_PROVENANCE_DIGEST');
   if(witness.issuerDigest===witness.ownerSessionDigest||
      witness.issuerDigest===witness.reviewerSessionDigest||
      witness.ownerSessionDigest===witness.reviewerSessionDigest)
     return reject('NON_INDEPENDENT_ISSUER_OWNER_REVIEWER');
   if(witness.scope!=='READONLY_ORIGINAL_STORE_BINDING'||
      !Number.isSafeInteger(witness.observedAtMs)||
      Math.abs(nowMs-witness.observedAtMs)>5*60*1000)
     return reject('WITNESS_SCOPE_OR_FRESHNESS_INVALID');
 }
 return shape({caseCount:4,realUserSessionsInspected:0,
   actualSourceRowsRead:0,independentExternalVerifierStillRequired:true});
}

/**
 * Private merchant operator application and external provider callback cannot
 * be one combined Access app: a browser-only Access policy would reject
 * provider POSTs, while a public provider endpoint must NOT serve Merchant docs.
 * RPC16 remains DENY ALL + 404 until separately approved. A signed provider
 * endpoint, if approved later, needs a separate script/hostname/rate guard.
 */
export function inspectProposedCanaryIsolation(plan){
 if(!plan||plan.mode!=='NO_DEPLOY_SOURCE_ONLY'||
    plan.evidenceWorker!=='tien404-rpc16-merchant-evidence-inactive-staging'||
    plan.evidenceAccessAppId!=='f994d4b2-d4f9-419b-8585-5d33be506f13'||
    plan.evidenceAccessAllowCount!==0||
    plan.evidenceAccessBypassCount!==0||
    plan.evidencePublicRoutesEnabled!==false||
    plan.merchantUploadsAllowed!==false||
    plan.providerCanaryDeployed!==false||
    plan.providerCanarySharesEvidenceWorker!==false||
    plan.providerCanarySharesCommerceCredential!==false||
    plan.providerCanaryHasOutboundBindings!==false||
    plan.providerCanaryHasDatabaseWriteBindings!==false||
    plan.activateProduction!==false)
   return reject('PRIVATE_RPC16_AND_PROVIDER_ISOLATION_NOT_PROVEN');
 return shape({isolatedInfrastructurePlan:true,
   hostedExternalAccessDeniedProved:false,
   providerSignedWebhookProved:false,
   noDeployedProviderCanary:true});
}

export function prohibitClaimedRelease(_userReportedApproval){
 return Object.freeze({
   ...STATUS,reason:'G0_MERCHANT_OWNER_AND_NATIVE_PROVIDER_GATE_UNVERIFIED',
   prerequisites:Object.freeze([
     'PRIVATE_SIGNED_OWNER_AND_INDEPENDENT_REVIEWER_IDENTITY',
     'FOUR_ORIGINAL_RECORD_SOURCE_PROVENANCE',
     'M0_RESTORE_SCOPE_AND_AUTHORIZATION',
     'CANONICAL_STORE_RLS_REAL_SAME_TENANT_JWT_AB_PROOF',
     'DEDICATED_PROVIDER_CANARY_EDGE_GATE_NATIVE_SIGNATURE',
     'EXTERNAL_DENY_AND_DURABLE_REPLAY_REVIEW',
     'NO_SEND_ZERO_COMMERCE_WRITE_INDEPENDENT_OBSERVABILITY'
   ]),
   sourceOnly:true,realCanaryApproved:false
 });
}

export const originalStoreCaseRefs=CASES;
