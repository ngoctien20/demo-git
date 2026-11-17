'use strict';
// V17.2C.20 source-only private Auth admission orchestration.
// The protected backend MUST supply outputs from independent verified services.
// Never accept this evidence object from a user-supplied request body.
const {validate}=require('./v172c16-private-ab-consent-admission.cjs');
const deny=(reason)=>({status:'DENY',reason});
const pairs=['QA_A','QA_B'];
function preflight({receipts,evidence,authority,now=Date.now()}={}){
 if(!evidence || !authority || !Array.isArray(receipts) || receipts.length!==2) return deny('MISSING_TRUSTED_EVIDENCE');
 if(authority.environment!=='approved-disposable' ||
    authority.project==='ifxlvrhyjhbzbrkdsida' ||
    authority.bioProjectRef==='svxkwpmxgnfvewzwsbdt' && authority.project===authority.bioProjectRef ||
    authority.costApproved!==true || authority.restoreDrillVerified!==true ||
    authority.noSendApproved!==true || authority.independentSecurityReview!==true)
    return deny('DISPOSABLE_COST_RECOVERY_REVIEW_BLOCKED');
 const entries=pairs.map(slot=>evidence[slot]);
 if(entries.some(e=>!e || e.slotVerified!==true || e.authSessionVerified!==true ||
     e.sessionActive!==true || e.identityIndependentlyVerified!==true ||
     e.explicitConsentVerified!==true || e.consentWithdrawn!==false ||
     e.ownerStoreBindingVerified!==true || e.scopeVerified!==true ||
     e.proofTimestampMs>now || !Number.isFinite(e.proofTimestampMs) ||
     now-e.proofTimestampMs>5*60*1000))
   return deny('PRIVATE_AUTH_CONSENT_NOT_VERIFIED');
 if(entries[0].subjectRef===entries[1].subjectRef ||
    entries[0].sessionEvidenceRef===entries[1].sessionEvidenceRef ||
    entries[0].storeRef===entries[1].storeRef ||
    !entries.every(e=>typeof e.subjectRef==='string' && e.subjectRef.length &&
       typeof e.sessionEvidenceRef==='string' && e.sessionEvidenceRef.length &&
       typeof e.storeRef==='string' && e.storeRef.length))
    return deny('NOT_INDEPENDENT_PRINCIPALS_OR_STORES');
 if(authority.expectedStoreRefs?.QA_A!==entries[0].storeRef ||
    authority.expectedStoreRefs?.QA_B!==entries[1].storeRef ||
    authority.expectedSubjectRefs?.QA_A!==entries[0].subjectRef ||
    authority.expectedSubjectRefs?.QA_B!==entries[1].subjectRef)
    return deny('SERVER_AUTHORITY_MISMATCH');
 const trustedConsent={
  project:authority.project,tenant:authority.tenant,
  publicKeys:authority.publicKeys,
  expectedIssuerRefs:authority.expectedIssuerRefs,
  expectedSubjectRefs:authority.expectedSubjectRefs,
  expectedStoreRefs:authority.expectedStoreRefs,
  expectedReviewerRef:authority.expectedReviewerRef,
  revokedReceiptIds:authority.revokedReceiptIds,
  usedReceiptIds:authority.usedReceiptIds,
  releaseApproved:authority.costApproved,
  recoveryApproved:authority.restoreDrillVerified,
  disposableApproved:authority.environment==='approved-disposable',
  reviewerApproved:authority.independentSecurityReview,
  privateActorSessionBindingVerified:true,
  independentConsentAudited:true
 };
 const check=validate({receipts},trustedConsent,now);
 if(check.status!=='REVIEW_REQUIRED_NOT_JWT_GO') return deny('SIGNED_RECEIPT_CHECK_FAILED');
 return {status:'REVIEW_REQUIRED_NOT_JWT_GO',reason:'NO_AUTOMATIC_PAIR_CONSUME_OR_REAL_JWT_AUTHORIZATION'};
}
module.exports={preflight};
