// V17.MULTI-CHANNEL-03B — independent proof signature REVIEW, offline-only.
// Accepts *opaque aliases and public-key signatures*, NOT source documents,
// JWTs, Meta tokens, URLs or files. Trust anchors MUST be pre-pinned privately.
// A mathematically verified signature is NOT merchant identity or ownership.
import {verify as verifySignature} from 'node:crypto';

const CLAIM_KEYS = ['contract','ticket','tenantAlias','storeAlias','nonce','purpose','expiresAtMs'];
const SIGNER_KEYS = ['keyId','actorAlias','role','signature'];
const CLAIM_CONTRACT='T404_MC03B_OWNER_ATTESTATION_V1';
const ref=x=>typeof x==='string'&&/^[A-Za-z0-9_:-]{8,100}$/.test(x);
const ticket=x=>typeof x==='string'&&/^EV-[A-Z0-9]{16,48}$/.test(x);
const exact=(o,k)=>o!==null&&typeof o==='object'&&!Array.isArray(o)
 && Object.keys(o).length===k.length&&k.every(s=>Object.hasOwn(o,s));
const fail=reason=>Object.freeze({
 status:'BLOCKED',reason,signaturePairVerified:false,
 realMerchantOwnerVerified:false,realStaffAuthorized:false,
 independentReviewerCertified:false,realJwtVerified:false,
 canAdmitRealUat:false,canDeploy:false,noSend:true,canWrite:false
});
const canonical=claim=>Buffer.from(JSON.stringify(CLAIM_KEYS.map(k=>claim[k])),'utf8');

export function inspectSignedOwnerEvidence({claim,signatures,trustStore,nowMs}={}){
 if(!exact(claim,CLAIM_KEYS)||claim.contract!==CLAIM_CONTRACT||
  !ticket(claim.ticket)||![claim.tenantAlias,claim.storeAlias,claim.nonce].every(ref)||
  claim.purpose!=='READ_ONLY_STORE_AB_AUTH_UAT'||
  !Number.isSafeInteger(nowMs)||nowMs<=0||
  !Number.isSafeInteger(claim.expiresAtMs)||claim.expiresAtMs<=nowMs||
  claim.expiresAtMs>nowMs+24*3600*1000)
   return fail('INVALID_SCOPE_OR_TTL');
 if(!Array.isArray(signatures)||signatures.length!==2||
   !signatures.every(s=>exact(s,SIGNER_KEYS)&&ref(s.keyId)&&ref(s.actorAlias)&&
      ['MERCHANT_OWNER','INDEPENDENT_REVIEWER'].includes(s.role)&&
      typeof s.signature==='string'&&/^[A-Za-z0-9_-]{86}$/.test(s.signature))||
   new Set(signatures.map(s=>s.role)).size!==2||
   new Set(signatures.map(s=>s.actorAlias)).size!==2||
   new Set(signatures.map(s=>s.keyId)).size!==2)
   return fail('INDEPENDENT_TWO_SIGNERS_REQUIRED');
 if(!trustStore||trustStore.source!=='OPERATOR_PINNED_OFFLINE_PUBLIC_KEYS'||
   trustStore.readonly===false||typeof trustStore.resolveKey!=='function'||
   trustStore.realHostedAdmissionEnabled!==false)
   return fail('PRIVATE_PINNED_TRUST_STORE_REQUIRED');
 const payload=canonical(claim);
 for (const signer of signatures){
   let record;
   try {record=trustStore.resolveKey(signer.keyId)}catch{return fail('KEY_LOOKUP_FAILED');}
   if(!record||record.keyId!==signer.keyId||record.role!==signer.role||
     record.actorAlias!==signer.actorAlias||
     record.revoked!==false||record.active!==true||
     record.allowedTenantAlias!==claim.tenantAlias||
     !Number.isSafeInteger(record.validFromMs)||
     !Number.isSafeInteger(record.validUntilMs)||
     record.validFromMs>nowMs||record.validUntilMs<=nowMs||
     !record.publicKey||record.publicKey.asymmetricKeyType!=='ed25519')
       return fail('TRUSTED_SIGNER_OR_SCOPE_UNVERIFIED');
   let result=false;
   try{
     const bytes=Buffer.from(signer.signature,'base64url');
     result=bytes.length===64&&verifySignature(null,payload,record.publicKey,bytes);
   }catch {result=false;}
   if(!result)return fail('SIGNATURE_INVALID');
 }
 // No original documents, independent key custody, merchant consent or
 // durable anti-replay can be established by this source-only module.
 return Object.freeze({
  status:'SIGNATURE_MATH_ONLY_REQUIRES_PRIVATE_ORIGINAL_REVIEW',
  reason:'TWO_PINNED_ED25519_SIGNATURES_MATCH_OPAQUE_CLAIM',
  signaturePairVerified:true,
  ticket:claim.ticket,tenantAlias:claim.tenantAlias,
  storeAlias:claim.storeAlias,nonce:claim.nonce,
  ownerActorAlias:signatures.find(s=>s.role==='MERCHANT_OWNER').actorAlias,
  realMerchantOwnerVerified:false,realStaffAuthorized:false,
  independentReviewerCertified:false,realJwtVerified:false,
  durableReplayClaimed:false,canAdmitRealUat:false,canDeploy:false,
  canWrite:false,noSend:true
 });
}

export function inspectSameTenantOwnerPair(a,b){
 if(a?.signaturePairVerified!==true||b?.signaturePairVerified!==true)
   return fail('INDEPENDENT_STORE_PROOFS_NOT_STRUCTURALLY_READY');
 if(a.tenantAlias!==b.tenantAlias||a.storeAlias===b.storeAlias||
    a.ownerActorAlias===b.ownerActorAlias || a.ticket===b.ticket ||
    a.nonce===b.nonce)
   return fail('SAME_TENANT_DISTINCT_STORE_OWNERS_NOT_ESTABLISHED');
 return Object.freeze({
   status:'CRYPTO_REVIEW_CANDIDATE_ONLY',
   sameTenantTwoStoresStructurallyPlausible:true,
   realMerchantOwnerVerified:false,realStaffAuthorized:false,
   independentReviewerCertified:false,
   realJwtVerified:false,canAdmitRealUat:false,
   canDeploy:false,noSend:true,canWrite:false
 });
}
