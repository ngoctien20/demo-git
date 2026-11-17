'use strict';
// V17.2C.16 private QA consent admission verifier — source-only, no network.
// Signatures attest registered keys, NOT Supabase session authentication.
// Real server-side signed-session binding and actual human consent must be proven separately.
const crypto = require('node:crypto');
const SLOT = ['QA_A','QA_B'];
const canonical = (o) => JSON.stringify({
  version:o.version, slot:o.slot, receiptId:o.receiptId, project:o.project, tenant:o.tenant,
  store:o.store, subjectRef:o.subjectRef, issuerRef:o.issuerRef,
  scope:o.scope, issuedAt:o.issuedAt, expiresAt:o.expiresAt,
  authProofRef:o.authProofRef, consentProofRef:o.consentProofRef,
  reviewerRef:o.reviewerRef
});
function validate(input, trust, now=Date.now()) {
 const reasons=[];
 if (!input || !trust || !Array.isArray(input.receipts) || input.receipts.length!==2) return {status:'DENY',reasons:['missing_receipt_pair']};
 const r=input.receipts;
 if(r.some(x=>!x || typeof x!=='object')) return {status:'DENY',reasons:['invalid_receipt_shape']};
 if (!trust.project || !trust.tenant || !trust.publicKeys || !trust.expectedIssuerRefs || !trust.expectedSubjectRefs || !trust.expectedStoreRefs || !trust.expectedReviewerRef || !Array.isArray(trust.revokedReceiptIds) || !Array.isArray(trust.usedReceiptIds) || trust.releaseApproved!==true) reasons.push('missing_trusted_config_or_scope_approval');
 if(!trust.publicKeys?.QA_A || !trust.publicKeys?.QA_B || trust.publicKeys.QA_A===trust.publicKeys.QA_B) reasons.push('issuer_keys_not_distinct');
 if (!trust.recoveryApproved || !trust.disposableApproved || !trust.reviewerApproved) reasons.push('missing_disposable_recovery_or_review');
 if (r.some(x=>!x || !SLOT.includes(x.slot)) || new Set(r.map(x=>x.slot)).size!==2) reasons.push('actor_slots_not_independent');
 if (r.some(x=>x.project!==trust.project || x.tenant!==trust.tenant)) reasons.push('project_or_tenant_mismatch');
 if (r.some(x=>!x.store || !x.subjectRef || !x.issuerRef || !x.authProofRef || !x.consentProofRef || !x.reviewerRef)) reasons.push('missing_subject_store_or_private_proof_reference');
 if (new Set(r.map(x=>x.store)).size!==2 || new Set(r.map(x=>x.subjectRef)).size!==2 || new Set(r.map(x=>x.issuerRef)).size!==2) reasons.push('stores_subjects_or_issuers_not_distinct');
 if(r.some(x=>typeof x.receiptId!=='string' || !/^[a-f0-9]{32}$/.test(x.receiptId)) ||
    new Set(r.map(x=>x.receiptId)).size!==2) reasons.push('receipt_id_missing_or_duplicate');
 if(new Set(r.map(x=>x.authProofRef)).size!==2 ||
    new Set(r.map(x=>x.consentProofRef)).size!==2) reasons.push('proof_references_not_independent');
 for(const x of r){
   if(!x) continue;
   if(x.version!==1 || x.scope!=='synthetic_catalog_readonly_no_send_no_write') reasons.push('scope_or_version_mismatch');
   const a=Date.parse(x.issuedAt), b=Date.parse(x.expiresAt);
   if(!Number.isFinite(a)||!Number.isFinite(b)||a>now||b<=now||b-a>24*3600*1000) reasons.push('invalid_or_expired_receipt');
   if(x.issuerRef!==trust.expectedIssuerRefs?.[x.slot] || x.subjectRef!==trust.expectedSubjectRefs?.[x.slot]) reasons.push('issuer_or_subject_not_independently_bound');
   if(x.store!==trust.expectedStoreRefs?.[x.slot]) reasons.push('store_not_bound_to_trusted_authority');
   if(x.reviewerRef!==trust.expectedReviewerRef || x.reviewerRef===x.issuerRef) reasons.push('independent_reviewer_not_pinned');
   if(trust.revokedReceiptIds?.includes(x.receiptId) || trust.usedReceiptIds?.includes(x.receiptId)) reasons.push('receipt_revoked_or_replayed');
   const publicKey=trust.publicKeys?.[x.slot];
   try{
     if(!publicKey || typeof x.signature!=='string' ||
        !crypto.verify(null,Buffer.from(canonical(x)),publicKey,Buffer.from(x.signature,'base64'))) reasons.push('signature_invalid_'+x.slot);
   }catch{reasons.push('signature_invalid_'+x.slot);}
 }
 if(!trust.privateActorSessionBindingVerified || !trust.independentConsentAudited) reasons.push('private_session_or_consent_not_verified');
 if(reasons.length) return {status:'DENY',reasons:[...new Set(reasons)]};
 return {status:'REVIEW_REQUIRED_NOT_JWT_GO',reasons:['human_reviewer_must_authorize_real_jwt_uat']};
}
module.exports={canonical,validate};
