'use strict';
/*
 * TIEN404 V15.2-ADV.6C — PRIVATE EVIDENCE SIGNATURE INTAKE (QA ONLY).
 *
 * All evidence here is OPAQUE REFERENCES and hashes. No JWT, DB exports,
 * account emails, phone numbers, credential material or business rows.
 * Signed references still DO NOT attest their underlying facts. The
 * independent reviewer must inspect each record in approved private storage.
 * This module does NOT create approvals, perform hosted GETs/SQL, backup,
 * deploy, send, or change production state.
 *
 * Trust anchors MUST be provided out-of-band by a separately-authorized
 * private enrollment process, NEVER extracted from an uploaded packet.
 */
const crypto=require('node:crypto');
const CONTRACT='T404_ADV6C_PRIVATE_EVIDENCE_INTAKE_V1';
const PROJECT='ifxlvrhyjhbzbrkdsida';
const AUDITED_BASE_SHA='212691647ded23a6c02adac85295c09b079619ed';
const REQUIRED_EVIDENCE=Object.freeze([
 'HOSTED_STORE_SCHEMA_RLS',
 'HOSTED_OWNER_A_AUTH_JWT_RLS',
 'HOSTED_OWNER_B_AUTH_JWT_RLS',
 'HOSTED_SAME_TENANT_CROSS_STORE_DENIAL',
 'AUTHORIZED_BACKUP_EXPORT_RECEIPT',
 'INDEPENDENT_BACKUP_RESTORE_RECEIPT',
 'RPC_CALLER_AND_PRIVILEGE_REVIEW',
 'PRIVATE_DB_ROLE_APPROVAL_REVIEW'
]);
const ROLES=Object.freeze(['CONTROLLER','SECURITY_REVIEWER','BACKUP_OPERATOR']);
const ref=x=>typeof x==='string'&&/^EV-[A-Z0-9]{12,32}$/.test(x);
const sha=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const exact=(x,keys)=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 Object.getPrototypeOf(x)===Object.prototype&&Object.keys(x).length===keys.length&&
 keys.every(k=>Object.hasOwn(x,k));
const fail=code=>{const e=new Error(code);e.code=code;throw e;};
const bytes=(payload,role)=>Buffer.from('TIEN404:ADV6C:EVIDENCE:V1:'+role+':'+
 JSON.stringify(payload),'utf8');
function createPrivateEvidenceIntake({mode,trustRegistry,nonceStore,clock=()=>Date.now()}={}){
 if(mode!=='SYNTHETIC_OFFLINE_NO_EXPORT'||!trustRegistry||
   trustRegistry.authority!=='OFFLINE_QA_ANCHORS_ONLY'||
   !exact(trustRegistry, ['authority','keys'])||
   !Array.isArray(trustRegistry.keys)||
   !nonceStore||typeof nonceStore.claimOnce!=='function'||
   typeof clock!=='function')fail('PRIVATE_TRUST_ENROLLMENT_REQUIRED');
 const keys=new Map(),actors=new Set();
 for(const k of trustRegistry.keys){
   if(!exact(k,['keyId','actorDigest','role','publicKey'])||
      !ref(k.keyId)||!sha(k.actorDigest)||!ROLES.includes(k.role)||
      !(k.publicKey instanceof crypto.KeyObject)||k.publicKey.type!=='public'||
      k.publicKey.asymmetricKeyType!=='ed25519'||keys.has(k.keyId)||
      actors.has(k.actorDigest))fail('INDEPENDENT_TRUST_KEY_INVALID');
   keys.set(k.keyId,k);actors.add(k.actorDigest);
 }
 if(keys.size!==3||ROLES.some(role=>![...keys.values()].some(k=>k.role===role)))
   fail('THREE_INDEPENDENT_TRUST_ROLES_REQUIRED');
 async function reviewSignedPacket(packet){
   if(!exact(packet,['payload','signatures'])||
      !exact(packet.payload,[
       'contract','projectRef','auditedBaseSha','scope','nonceHex',
       'issuedAtMs','expiresAtMs','evidence','backupIntent'
      ]))fail('PRIVATE_PACKET_KEYS_DENIED');
   const p=packet.payload, now=clock();
   if(!Number.isSafeInteger(now)||now<0||
      p.contract!==CONTRACT||p.projectRef!==PROJECT||
      p.auditedBaseSha!==AUDITED_BASE_SHA||
      p.scope!=='PRIVATE_JWT_RLS_AND_BACKUP_DECISION_REVIEW_ONLY'||
      typeof p.nonceHex!=='string'||!/^[a-f0-9]{64}$/.test(p.nonceHex)||
      !Number.isSafeInteger(p.issuedAtMs)||!Number.isSafeInteger(p.expiresAtMs)||
      p.issuedAtMs>now+30000||p.expiresAtMs<=now||
      p.expiresAtMs-p.issuedAtMs>900000||p.expiresAtMs<=p.issuedAtMs)
      fail('PACKET_SCOPE_OR_TTL_DENIED');
   if(!exact(p.backupIntent,[
      'operation','projectRef','scopeDigest','destinationDigest',
      'maxEstimatedCostVnd','retentionDays','controllerDecision'
     ])||
     p.backupIntent.operation!=='REVIEW_ONE_TIME_BACKUP_EXPORT_ONLY'||
     p.backupIntent.projectRef!==PROJECT||
     !sha(p.backupIntent.scopeDigest)||!sha(p.backupIntent.destinationDigest)||
     !Number.isSafeInteger(p.backupIntent.maxEstimatedCostVnd)||
     p.backupIntent.maxEstimatedCostVnd<0||
     p.backupIntent.maxEstimatedCostVnd>1_000_000||
     !Number.isSafeInteger(p.backupIntent.retentionDays)||
     p.backupIntent.retentionDays<1||p.backupIntent.retentionDays>90||
     p.backupIntent.controllerDecision!=='PENDING_SEPARATE_EXPLICIT_APPROVAL')
     fail('BACKUP_REQUEST_NOT_INDEPENDENTLY_AUTHORIZED');
   if(!Array.isArray(p.evidence)||p.evidence.length!==REQUIRED_EVIDENCE.length)
     fail('PRIVATE_EVIDENCE_SET_INCOMPLETE');
   const seenKinds=new Set(),seenRefs=new Set();
   for(const e of p.evidence){
     if(!exact(e,['kind','reference','sha256','observedAtMs'])||
       !REQUIRED_EVIDENCE.includes(e.kind)||!ref(e.reference)||
       !sha(e.sha256)||!Number.isSafeInteger(e.observedAtMs)||
       e.observedAtMs<=0||e.observedAtMs>now||
       seenKinds.has(e.kind)||seenRefs.has(e.reference))
       fail('PRIVATE_EVIDENCE_REFERENCE_INVALID');
     seenKinds.add(e.kind);seenRefs.add(e.reference);
   }
   if(REQUIRED_EVIDENCE.some(k=>!seenKinds.has(k)))
     fail('PRIVATE_EVIDENCE_SET_INCOMPLETE');
   if(!Array.isArray(packet.signatures)||packet.signatures.length!==3)
     fail('THREE_SIGNED_REVIEWS_REQUIRED');
   const signedRoles=new Set(),signedActors=new Set();
   for(const sig of packet.signatures){
     if(!exact(sig,['role','keyId','actorDigest','signatureBase64Url'])||
       !ROLES.includes(sig.role)||!ref(sig.keyId)||!sha(sig.actorDigest)||
       typeof sig.signatureBase64Url!=='string'||
       !/^[a-zA-Z0-9_-]{80,100}$/.test(sig.signatureBase64Url)||
       signedRoles.has(sig.role)||signedActors.has(sig.actorDigest))
       fail('INDEPENDENT_SIGNER_SCOPE_INVALID');
     const enrolled=keys.get(sig.keyId);
     if(!enrolled||enrolled.role!==sig.role||
        enrolled.actorDigest!==sig.actorDigest)
       fail('SIGNER_NOT_INDEPENDENTLY_ENROLLED');
     let valid=false;
     try{
       const signature=Buffer.from(sig.signatureBase64Url,'base64url');
       valid=signature.length===64&&crypto.verify(null,
         bytes(p,sig.role),enrolled.publicKey,signature);
     }catch{valid=false}
     if(!valid)fail('DETACHED_SIGNATURE_INVALID');
     signedRoles.add(sig.role);signedActors.add(sig.actorDigest);
   }
   if(ROLES.some(role=>!signedRoles.has(role)))
     fail('THREE_SIGNED_REVIEWS_REQUIRED');
   const digest=crypto.createHash('sha256')
     .update('TIEN404:ADV6C:SYNTHETIC:NONCE:').update(p.nonceHex).digest('hex');
   if(await nonceStore.claimOnce(digest,p.expiresAtMs)!==true)
     fail('PRIVATE_PACKET_REPLAY_DENIED');
   return Object.freeze({
      contract:CONTRACT,
      status:'SIGNED_METADATA_ONLY_PENDING_INDEPENDENT_PRIVATE_INSPECTION',
      inspectedReferenceCount:p.evidence.length,
      distinctSignerRoles:ROLES.length,
      syntheticNonceClaimed:true,
      actualHostedJwtVerified:false,actualRestoreVerified:false,
      realControllerApprovalVerified:false,
      oneTimeBackupExportApproved:false,
      actualBackupExportPerformed:false,
      publishAuthorized:false,dbRoleChangeAuthorized:false,
      hostedWrites:0,realDataAccessed:false
   });
 }
 return Object.freeze({
   reviewSignedPacket,
   exportBackup(){fail('REAL_BACKUP_EXPORT_REQUIRES_SEPARATE_OPERATOR_APPROVAL')},
   hostedJwt(){fail('REAL_JWT_READ_REQUIRES_AUTHORIZED_PRIVATE_OPERATOR')},
   grant(){fail('DB_GRANT_REQUIRES_INDEPENDENT_APPROVAL')},
   release(){fail('P0_RELEASE_GATE_NO_GO')}
 });
}
module.exports=Object.freeze({
 CONTRACT,PROJECT,AUDITED_BASE_SHA,REQUIRED_EVIDENCE,ROLES,
 createPrivateEvidenceIntake
});