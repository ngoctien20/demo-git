'use strict';
// V17.2C.21 — dependency-injected PRIVATE BACKEND intake (NOT hosted).
// Verify real bearer session on server through independent Supabase Auth
// and active-session authority. No caller-supplied trust flags/tenant/Store.
const {preflight}=require('./v172c20-trusted-private-auth-pair-preflight.cjs');
const fail=(reason)=>({status:'DENY',reason});
const slots=['QA_A','QA_B'];
const scope='synthetic_catalog_readonly_no_send_no_write';
function createPrivateConsentBackend(services){
 const names=['verifySession','resolveStoreAuthority','verifyConsentChallenge','recordExplicitConsent','getPrivateEvidence',
  'getTrustedAuthority','getSignedReceipts'];
 if(!services || names.some(n=>typeof services[n]!=='function')) throw Error('MISSING_TRUSTED_SERVER_ADAPTERS');
 async function intake({bearer,requestedScope,consentAction,challenge}={}){
  // bearer is an internal server-side input from authorization header;
  // don't log, persist or return it. Never accept subject/store via request.
  if(typeof bearer!=='string'||!bearer.startsWith('Bearer ')||bearer.length>8192||
     bearer.length<20||requestedScope!==scope) return fail('INVALID_AUTH_OR_SCOPE');
  if(consentAction!=='accept' || typeof challenge!=='string' || challenge.length<16 || challenge.length>256)
   return fail('EXPLICIT_CONSENT_ACTION_REQUIRED');
  try{
   const session=await services.verifySession(bearer.slice(7));
   if(!session || session.verified!==true || session.active!==true ||
      session.expiresAtMs<=Date.now() || !session.sessionEvidenceRef ||
      !session.subjectRef || !session.sessionIdVerified) return fail('SESSION_NOT_VERIFIED');
   const binding=await services.resolveStoreAuthority(session.subjectRef);
   if(!binding || binding.active!==true || binding.ownerVerified!==true ||
      !binding.tenantRef || !binding.storeRef || !slots.includes(binding.slot))
      return fail('STORE_AUTHORITY_DENIED');
   const proof=await services.verifyConsentChallenge({
     challenge,subjectRef:session.subjectRef,sessionEvidenceRef:session.sessionEvidenceRef,
     tenantRef:binding.tenantRef,storeRef:binding.storeRef,scope
   });
   if(!proof || proof.verified!==true || proof.singleUseConsumed!==true ||
      proof.consentIntentVerified!==true) return fail('CONSENT_CHALLENGE_NOT_VERIFIED');
   const receipt=await services.recordExplicitConsent({
     slot:binding.slot,subjectRef:session.subjectRef,tenantRef:binding.tenantRef,
     storeRef:binding.storeRef,sessionEvidenceRef:session.sessionEvidenceRef,scope
   });
   if(!receipt || receipt.persisted!==true || receipt.verifiedProvenance!==true ||
      !receipt.consentEvidenceRef) return fail('CONSENT_NOT_PERSISTED');
   return {status:'PRIVATE_CONSENT_RECORDED_NOT_UAT_GO',slot:binding.slot};
  }catch{return fail('PRIVATE_SERVICE_UNAVAILABLE');}
 }
 async function reviewPair(){
  try{
   // Must be called only from an independently authenticated operator route.
   // This library is not HTTP middleware or an authorization boundary by itself.
   const [authority,evidence,receipts]=await Promise.all([
    services.getTrustedAuthority(),services.getPrivateEvidence(),services.getSignedReceipts()
   ]);
   if(!authority || !evidence || !receipts) return fail('MISSING_PRIVATE_EVIDENCE');
   return preflight({authority,evidence,receipts,now:Date.now()});
  }catch{return fail('PRIVATE_REVIEW_UNAVAILABLE');}
 }
 return {intake,reviewPair};
}
module.exports={createPrivateConsentBackend};
