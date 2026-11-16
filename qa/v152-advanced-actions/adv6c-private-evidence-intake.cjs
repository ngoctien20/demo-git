'use strict';
/**
 * TIEN404 V15.2 ADV6C. Read-only PRIVATE receipt verifier, not a public
 * evidence storage service, real signing enrollment or backup authorization.
 * Uses only injected public keys; NEVER obtains raw JWT, PII or private data.
 */
const crypto=require('node:crypto');
const CONTRACT='T404_ADV6C_PRIVATE_EVIDENCE_RECEIPT_V1';
const PURPOSES=Object.freeze([
 'PRIVATE_EVIDENCE_REVIEW','ONE_TIME_BACKUP_EXPORT_REVIEW',
 'HOSTED_STORE_MIGRATION_REVIEW','PRIVATE_NONCE_DB_ROLE_REVIEW',
 'RPC_PRIVILEGE_CHANGE_REVIEW'
]);
const LANES=Object.freeze([
 'OWNER_A_AUTH_SESSION','OWNER_B_AUTH_SESSION','CROSS_STORE_NEGATIVE_RLS',
 'CONTROLLER_BACKUP_APPROVAL','ENCRYPTED_EXPORT_AND_ISOLATED_RESTORE',
 'PRIVATE_DB_ROLE_REVIEW','HOSTED_NONCE_TRANSACTION_PROOF','RPC_SECURITY_REVIEW'
]);
const ROLES=Object.freeze(['CONTROLLER','SECURITY_REVIEWER','BACKUP_OPERATOR']);
const HEX=/^[0-9a-f]{64}$/;
const REF=/^private:[A-Za-z0-9][A-Za-z0-9._/-]{7,95}$/;
const REQ=/^QA-[A-Z0-9]{12,48}$/;
const ID=/^[A-Za-z0-9][A-Za-z0-9._-]{5,63}$/;
const TS=/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/;
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const exact=(x,keys)=>plain(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const when=x=>typeof x==='string'&&TS.test(x)&&Number.isFinite(Date.parse(x))?Date.parse(x):NaN;
function safeManifest(m,projectDigest,now){
 if(!exact(m,['contract','requestId','projectDigest','purpose','createdAtUtc','expiresAtUtc','evidence'])||
    m.contract!==CONTRACT||!REQ.test(m.requestId)||!HEX.test(m.projectDigest)||
    !HEX.test(projectDigest)||m.projectDigest!==projectDigest||
    !PURPOSES.includes(m.purpose))return 'MANIFEST_OR_PROJECT_SCOPE_INVALID';
 const created=when(m.createdAtUtc),expires=when(m.expiresAtUtc);
 if(!Number.isFinite(created)||!Number.isFinite(expires)||created>now+30000||
    now<created-30000||expires<=now||expires<=created||expires-created>900000)
   return 'REQUEST_TIME_SCOPE_INVALID';
 if(!Array.isArray(m.evidence)||m.evidence.length!==LANES.length)
   return 'PRIVATE_REFERENCE_LANES_INCOMPLETE';
 const digests=new Set(),refs=new Set();
 for(let i=0;i<LANES.length;i++){
   const x=m.evidence[i];
   if(!exact(x,['lane','reference','sha256','capturedAtUtc'])||
     x.lane!==LANES[i]||!REF.test(x.reference)||!HEX.test(x.sha256)||
     !Number.isFinite(when(x.capturedAtUtc))||
     when(x.capturedAtUtc)>now+300000||now-when(x.capturedAtUtc)>7*86400000||
     refs.has(x.reference)||digests.has(x.sha256))
     return 'PRIVATE_REFERENCE_LANES_INVALID';
   refs.add(x.reference);digests.add(x.sha256);
 }
 return null;
}
function canonicalBytes(m){
 if(!plain(m)||!Array.isArray(m.evidence))throw Error('ADV6C_MANIFEST_SHAPE_REQUIRED');
 return Buffer.from(JSON.stringify({
  contract:m.contract,requestId:m.requestId,projectDigest:m.projectDigest,
  purpose:m.purpose,createdAtUtc:m.createdAtUtc,expiresAtUtc:m.expiresAtUtc,
  evidence:m.evidence.map(e=>({
   lane:e.lane,reference:e.reference,sha256:e.sha256,capturedAtUtc:e.capturedAtUtc
  }))
 }),'utf8');
}
function receiptReview({manifest,attestations,registry,expectedProjectDigest,now=Date.now()}={}){
 const blockers=[];
 if(!Number.isSafeInteger(now)||now<=0)blockers.push('INVALID_REVIEW_CLOCK');
 const t=Number.isSafeInteger(now)&&now>0?now:0;
 const err=safeManifest(manifest,expectedProjectDigest,t);
 if(err)blockers.push(err);
 if(!Array.isArray(attestations)||attestations.length!==ROLES.length||
    !attestations.every((x,i)=>exact(x,['role','keyId','signature'])&&
     x.role===ROLES[i]&&ID.test(x.keyId)&&typeof x.signature==='string'&&
     /^[A-Za-z0-9_-]{80,100}$/.test(x.signature))){
   blockers.push('INDEPENDENT_SIGNATURE_SET_INVALID');
 }
 if(!(registry instanceof Map)||registry.size===0)
   blockers.push('TRUSTED_SIGNER_ENROLLMENT_UNAVAILABLE');
 if(!blockers.length){
   const principals=new Set(),keys=new Set(),message=canonicalBytes(manifest);
   for(const a of attestations){
     const r=registry.get(a.keyId);
     const ok=r&&exact(r,['role','principalDigest','publicKey','enrollmentReceipt','state','purposes'])&&
       r.role===a.role&&HEX.test(r.principalDigest)&&REF.test(r.enrollmentReceipt)&&
       r.state==='ACTIVE'&&Array.isArray(r.purposes)&&r.purposes.includes(manifest.purpose)&&
       r.publicKey instanceof crypto.KeyObject&&r.publicKey.type==='public'&&
       r.publicKey.asymmetricKeyType==='ed25519'&&
       !keys.has(a.keyId)&&!principals.has(r.principalDigest);
     if(!ok){blockers.push('INDEPENDENT_SIGNER_ENROLLMENT_OR_ROLE_INVALID');break}
     const bytes=Buffer.from(a.signature,'base64url');
     if(bytes.length!==64||!crypto.verify(null,message,r.publicKey,bytes)){
       blockers.push('ED25519_ATTESTATION_INVALID');break;
     }
     keys.add(a.keyId);principals.add(r.principalDigest);
   }
 }
 // NEVER disclose private proof paths, hashes, IDs, signatures or actors.
 return Object.freeze({
   contract:CONTRACT,
   status:blockers.length?'BLOCKED':'PENDING_EXTERNAL_INDEPENDENT_VERIFICATION',
   blockers:Object.freeze(blockers),
   requiredLanes:LANES.length,requiredIndependentRoles:ROLES.length,
   purpose:typeof manifest?.purpose==='string'&&PURPOSES.includes(manifest.purpose)?
     manifest.purpose:null,
   signatureVerificationPerformed:blockers.length===0,
   signerAuthorityCertified:false,
   realEvidenceContentReviewed:false,
   jwtSessionOwnershipCertified:false,
   independentBackupRestoreCertified:false,
   privateDbRoleApproved:false,hostedNonceCertified:false,rpcSafetyCertified:false,
   durableApprovalLeaseCertified:false,
   privateExportAuthorized:false,hostedMigrationAuthorized:false,
   dbRoleChangeAuthorized:false,rpcPrivilegeChangeAuthorized:false,
   providerSendsAuthorized:false,commerceWritesAuthorized:false,
   productionReleaseAuthorized:false,noNetworkNoHostedWrites:true
 });
}
const disabled=()=>{throw Error('ADV6C_NO_PRIVATE_OPERATION_EXECUTOR')};
module.exports=Object.freeze({CONTRACT,PURPOSES,LANES,ROLES,canonicalBytes,
 receiptReview,exportBackup:disabled,restoreBackup:disabled,
 migrateHosted:disabled,grantDbRole:disabled,changeRpcPrivilege:disabled,
 executeAction:disabled,sendProvider:disabled});
