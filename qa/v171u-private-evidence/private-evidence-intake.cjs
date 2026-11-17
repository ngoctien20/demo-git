'use strict';
// TIEN404 V17.1U — source-only private evidence intake; no upload, DB, Auth write, or provider call.
const crypto=require('node:crypto');
const {createPrivateAdmissionGate}=require('../v171t-private-uat/private-admission.cjs');
const REF=/^ev_[A-Za-z0-9_-]{20,72}$/;
const HEX=/^[a-f0-9]{64}$/;
const VERSION=/^[A-Za-z0-9_-]{8,96}$/;
const KID=/^[A-Za-z0-9_.:-]{1,96}$/;
const TYPES=['OWNER_A_PROOF','OWNER_B_PROOF','OPERATOR_SCOPE','SECURITY_REVIEW'];
function deny(reason){return Object.freeze({ok:false,reason});}
function exactKeys(x,keys){
 return x&&typeof x==='object'&&!Array.isArray(x)&&
 Object.keys(x).sort().join('|')===keys.slice().sort().join('|');
}
function createPrivateEvidenceIntake({privateGateOptions,lookupEvidenceRecord,
 lookupAttestorKey,reserveEvidenceReviewOnce,clock=()=>Date.now()}={}){
 if(!privateGateOptions||[lookupEvidenceRecord,lookupAttestorKey,
  reserveEvidenceReviewOnce,clock].some(x=>typeof x!=='function'))
  throw Error('PRIVATE_INTAKE_TRUST_BACKEND_REQUIRED');
 // The V17.1T private gate is instantiated internally; caller may not submit a
 // fake success plan or substitute an untrusted JWKS with each request.
 const gate=createPrivateAdmissionGate(privateGateOptions);
 async function planPrivateIdentityProvisioningReview({intent,approvals,owners,evidenceRefs}={}){
  if(!Array.isArray(evidenceRefs)||evidenceRefs.length!==4||
     !evidenceRefs.every(x=>exactKeys(x,['type','ref'])))
    return deny('INTAKE_REFERENCE_SHAPE');
  if(evidenceRefs.some(x=>!TYPES.includes(x.type)||!REF.test(String(x.ref||'')))||
     new Set(evidenceRefs.map(x=>x.type)).size!==4||
     new Set(evidenceRefs.map(x=>x.ref)).size!==4)
    return deny('INTAKE_REFERENCE_DUPLICATE_OR_UNSAFE');
  // V17.1T verifies two signed, live owner JWT receipts and four pinned,
  // independently enrolled Ed25519 signers with exact commit/scope.
  const authorized=await gate.planOperatorAuthorizedTwoStoreAuth({intent,approvals,owners});
  if(!authorized.ok)return authorized;
  const now=clock();
  if(!Number.isSafeInteger(now)||now<=0)return deny('INTAKE_TRUSTED_CLOCK');
  const reviewDigest=crypto.createHash('sha256').update(JSON.stringify([
    intent.projectRef,intent.tenantId,intent.commitSha,intent.nonce,evidenceRefs
  ])).digest('hex');
  let reserved;
  try{reserved=await reserveEvidenceReviewOnce({
   digest:reviewDigest,ttlMs:600000,tenantId:intent.tenantId
  });}catch{return deny('INTAKE_REPLAY_BACKEND_UNAVAILABLE');}
  if(reserved!==true)return deny('INTAKE_REPLAY_OR_NON_ATOMIC');
  for(const slot of evidenceRefs){
   const storeId=slot.type==='OWNER_A_PROOF'?intent.stores[0]:
    slot.type==='OWNER_B_PROOF'?intent.stores[1]:'SCOPE_ALL';
   let record;
   try{record=await lookupEvidenceRecord({
    ref:slot.ref,kind:slot.type,tenantId:intent.tenantId,storeId
   });}catch{return deny('INTAKE_REGISTRY_UNAVAILABLE');}
   // Never accept raw documents, URLs, object keys, JWTs, scanned bytes,
   // or client-controlled metadata. The registry is private + access-controlled.
   const expected=['ref','kind','tenantId','storeId','status','visibility',
    'sha256','objectVersion','bytes','mime','scan','cdr','scannedAtMs',
    'reviewedAtMs','expiresAtMs','attestorKid','attestationSignature'];
   if(!exactKeys(record,expected)||record.ref!==slot.ref||
     record.kind!==slot.type||record.tenantId!==intent.tenantId||
     record.storeId!==storeId||
     record.status!=='PRIVATE_REVIEW_APPROVED'||
     record.visibility!=='PRIVATE_NO_PUBLIC_URL'||
     !HEX.test(String(record.sha256||''))||
     !VERSION.test(String(record.objectVersion||''))||
     !Number.isSafeInteger(record.bytes)||record.bytes<=0||record.bytes>5_000_000||
     !['application/pdf','image/png','image/jpeg'].includes(record.mime)||
     record.scan!=='CLEAN_INDEPENDENT_SCANNER'||
     record.cdr!=='SANITIZED_AND_VERIFIED'||
     !Number.isSafeInteger(record.scannedAtMs)||
     !Number.isSafeInteger(record.reviewedAtMs)||
     !Number.isSafeInteger(record.expiresAtMs)||
     record.scannedAtMs>record.reviewedAtMs||
     record.reviewedAtMs>now+30000||record.expiresAtMs<=now||
     now-record.reviewedAtMs>600000||
     !KID.test(String(record.attestorKid||'')))
    return deny('INTAKE_EVIDENCE_NOT_PRIVATE_APPROVED');
   let key;
   try{key=await lookupAttestorKey({
    kid:record.attestorKid,role:'INDEPENDENT_EVIDENCE_ATTESTOR'
   });}catch{return deny('INTAKE_ATTESTOR_SERVICE_UNAVAILABLE');}
   if(!key||key.active!==true||
     key.role!=='INDEPENDENT_EVIDENCE_ATTESTOR'||
     key.kid!==record.attestorKid||
     key.enrollment!=='PRIVATELY_ENROLLED'||
     key.publicJwk?.kty!=='OKP'||key.publicJwk.crv!=='Ed25519'||
     typeof key.publicJwk.x!=='string'||key.publicJwk.d!==undefined)
    return deny('INTAKE_ATTESTOR_NOT_TRUSTED');
   // Attestation covers private visibility, scan/CDR, MIME, object version,
   // digest and expiry: no one can upgrade an unscanned file by changing flags.
   const bytes=Buffer.from('TIEN404_V171U_PRIVATE_EVIDENCE_ATTESTATION_V1\0'+
    JSON.stringify({ref:record.ref,kind:record.kind,tenantId:record.tenantId,
     storeId:record.storeId,status:record.status,visibility:record.visibility,
     scan:record.scan,cdr:record.cdr,sha256:record.sha256,
     objectVersion:record.objectVersion,bytes:record.bytes,mime:record.mime,
     scannedAtMs:record.scannedAtMs,reviewedAtMs:record.reviewedAtMs,
     expiresAtMs:record.expiresAtMs}),'utf8');
   let verified=false;
   try{
    if(typeof record.attestationSignature==='string'&&
      /^[A-Za-z0-9_-]{85,88}$/.test(record.attestationSignature)){
     const sig=Buffer.from(record.attestationSignature,'base64url');
     if(sig.length===64&&sig.toString('base64url')===record.attestationSignature)
      verified=crypto.verify(null,bytes,
       crypto.createPublicKey({key:key.publicJwk,format:'jwk'}),sig);
    }
   }catch{verified=false;}
   if(!verified)return deny('INTAKE_EVIDENCE_ATTESTATION_INVALID');
   let fresh;
   try{fresh=await lookupAttestorKey({
    kid:record.attestorKid,role:'INDEPENDENT_EVIDENCE_ATTESTOR'
   });}catch{return deny('INTAKE_ATTESTOR_RECHECK_UNAVAILABLE');}
   if(!fresh||fresh.active!==true||
      fresh.enrollment!=='PRIVATELY_ENROLLED'||
      fresh.role!==key.role||fresh.kid!==key.kid||
      fresh.publicJwk?.x!==key.publicJwk.x)
    return deny('INTAKE_ATTESTOR_REVOKED');
  }
  if(clock()>intent.expiresAtMs)return deny('INTAKE_APPROVAL_EXPIRED_DURING_REVIEW');
  // A review is NOT permission to provision a user or change merchant access.
  return {ok:true,plan:Object.freeze({
   kind:'PRIVATE_QA_IDENTITY_PROVISIONING_REVIEW_ONLY',
   projectRef:authorized.plan.projectRef,tenantId:authorized.plan.tenantId,
   stores:Object.freeze([...authorized.plan.stores]),
   evidenceReferenceCount:4,independentEvidenceAttestationsChecked:true,
   authenticatedApproverRoleCount:4,
   actualEvidenceContentOpened:false,actualAuthUsersCreated:0,
   actualMembershipsWritten:0,actualCommerceReads:0,actualMessagesSent:0,
   identityProvisioningApproved:false,allowAuthWrites:false,
   allowMembershipWrites:false,allowRoleChanges:false,
   allowProviderCalls:false,allowStorageUpload:false,
   productionReleaseApproved:false,realHostedUatAttested:false,
   release:'HOSTED_NO_GO'
  })};
 }
 return Object.freeze({admitOwnerJwt:gate.admitOwnerJwt,planPrivateIdentityProvisioningReview});
}
module.exports={createPrivateEvidenceIntake};
