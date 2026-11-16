'use strict';
/**
 * TIEN404 V15.0-03H.9 — Independent signer evidence consistency, OFFLINE ONLY.
 * Values are synthetic QA statements, not verified source artifacts or a
 * real identity/approval service. Never returns permission to export.
 */
const {createHash}=require('node:crypto');
const {reviewSyntheticEnrollment,PROJECT}=require('../v1503h8-lease/signer-enrollment-review.cjs');
const CONTRACT='TIEN404_V15_03H9_INDEPENDENT_SIGNER_EVIDENCE_V1';
const MODE='SYNTHETIC_EVIDENCE_REVIEW_ONLY';
const HEX=/^[a-f0-9]{64}$/;
const ID=/^[A-Z][A-Z0-9_:-]{11,79}$/;
const BUNDLE_KEYS=['contract','mode','environment','projectRef','requestRef',
  'reviewerRef','reviewedAtMs','expiresAtMs','vaultStatus','humanIdentitiesVerified',
  'realSignaturesPresent','operatorPrivilegesVerified','releaseAuthorized',
  'privateVaultVerified','backupExists','maxAdditionalCostUsd','evidence'];
const PROOF_KEYS=['role','signerRef','issuerRef','witnessRef','identityReceiptRef',
  'possessionReceiptRef','principalDigest','sourceDigest','keyFingerprint',
  'observedAtMs','expiresAtMs','revoked','sourceLabel','syntheticOnly'];
const deny=reason=>Object.freeze({
 status:'BLOCKED',reason,scope:'SYNTHETIC_OFFLINE_ONLY',
 verifiedIndependentIdentity:false,verifiedSourceAuthenticity:false,
 verifiedActualSigner:false,verifiedOperator:false,
 verifiedPrivateVault:false,verifiedBackup:false,
 authorizedToExport:false,authorizedToRestore:false,
 authorizedToMigrate:false,authorizedToSend:false,hostedDataTouched:false
});
function plain(x){return x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;}
function exact(x,keys){return plain(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));}
function safe(x,seen=new WeakSet()){
 if(x===null||typeof x==='string'||typeof x==='number'||typeof x==='boolean')return true;
 if((!plain(x)&&!Array.isArray(x))||seen.has(x))return false;
 seen.add(x);
 if(Array.isArray(x))return x.every(z=>safe(z,seen));
 return Object.entries(x).every(([k,v])=>!/(password|secret|private.?key|credential|raw.?jwt|token|phone|email|psid|recipient|pairing.?code|connection.?string)/i.test(k)&&safe(v,seen));
}
function fixtureDigest(p){
 return createHash('sha256').update(
   ['TIEN404_H9_EVIDENCE_FIXTURE',p.role,p.sourceRef,
    p.identityReceiptRef,p.possessionReceiptRef].join('\0')).digest('hex');
}
function assessIndependentSignerEvidence(enrollment,bundle,{now=()=>Date.now()}={}){
 if(!safe(bundle)||!safe(enrollment)||!exact(bundle,BUNDLE_KEYS))
   return deny('MALFORMED_OR_SENSITIVE_INPUT');
 const t=now();
 if(!Number.isSafeInteger(t))return deny('INVALID_CLOCK');
 const inherited=reviewSyntheticEnrollment(enrollment,{now:()=>t});
 if(inherited.status!=='SYNTHETIC_SIGNER_ENROLLMENT_SHAPE_REVIEWED_NOT_TRUSTED')
   return deny('INHERITED_ENROLLMENT_REJECTED');
 if(bundle.contract!==CONTRACT||bundle.mode!==MODE||
    bundle.projectRef!==PROJECT||bundle.environment!=='staging'||
    bundle.requestRef!==enrollment.requestRef||!ID.test(bundle.reviewerRef||'')||
    !Number.isSafeInteger(bundle.reviewedAtMs)||!Number.isSafeInteger(bundle.expiresAtMs)||
    bundle.reviewedAtMs<enrollment.observedAtMs||bundle.reviewedAtMs>t||
    bundle.expiresAtMs<=t||bundle.expiresAtMs>enrollment.expiresAtMs||
    bundle.vaultStatus!=='PRIVATE_VAULT_RECEIPTS_NOT_VERIFIED'||
    bundle.humanIdentitiesVerified!==false||bundle.realSignaturesPresent!==false||
    bundle.operatorPrivilegesVerified!==false||bundle.releaseAuthorized!==false||
    bundle.privateVaultVerified!==false||bundle.backupExists!==false||
    bundle.maxAdditionalCostUsd!==0)
   return deny('WRONG_SCOPE_OR_FALSE_REAL_APPROVAL');
 if(!Array.isArray(bundle.evidence)||bundle.evidence.length!==3)
   return deny('THREE_INDEPENDENT_EVIDENCE_LANES_REQUIRED');
 const byRole=Object.fromEntries(enrollment.signers.map(s=>[s.role,s]));
 const principals=new Set(),issuers=new Set(),sources=new Set();
 const held=new Set(enrollment.signers.flatMap(s=>[s.signerRef,s.witnessRef]));
 if(held.has(bundle.reviewerRef))return deny('REVIEWER_NOT_INDEPENDENT');
 for(const e of bundle.evidence){
   if(!exact(e,PROOF_KEYS)||!ID.test(e.signerRef||'')||
      !['project_data_controller','security','backup_operator'].includes(e.role))
     return deny('UNTRUSTED_EVIDENCE_SHAPE');
   const s=byRole[e.role];
   if(!s||s.signerRef!==e.signerRef||e.witnessRef!==s.witnessRef||
      e.identityReceiptRef!==s.identityReceiptRef||
      e.possessionReceiptRef!==s.possessionReceiptRef||
      e.keyFingerprint!==s.keyFingerprint||
      !HEX.test(e.principalDigest||'')||principals.has(e.principalDigest)||
      !ID.test(e.issuerRef||'')||held.has(e.issuerRef)||
      e.issuerRef===bundle.reviewerRef||issuers.has(e.issuerRef)||
      e.sourceDigest!==fixtureDigest(s)||sources.has(e.sourceDigest)||
      e.sourceLabel!=='QA_SYNTHETIC_UNATTESTED_SOURCE'||
      e.syntheticOnly!==true||e.revoked!==false||
      !Number.isSafeInteger(e.observedAtMs)||!Number.isSafeInteger(e.expiresAtMs)||
      e.observedAtMs<s.validFromMs||e.observedAtMs>bundle.reviewedAtMs||
      e.expiresAtMs<=t||e.expiresAtMs>s.validUntilMs)
     return deny('UNTRUSTED_CONFLICTING_OR_EXPIRED_EVIDENCE');
   principals.add(e.principalDigest);issuers.add(e.issuerRef);sources.add(e.sourceDigest);
 }
 if(principals.size!==3||issuers.size!==3)return deny('INDEPENDENCE_NOT_ESTABLISHED');
 return Object.freeze({
   status:'SYNTHETIC_EVIDENCE_CONSISTENT_NOT_REAL_ATTESTATION',
   source:'OFFLINE_QA_FIXTURE',rolesReviewed:3,
   verifiedIndependentIdentity:false,verifiedSourceAuthenticity:false,
   verifiedActualSigner:false,verifiedOperator:false,
   verifiedPrivateVault:false,verifiedBackup:false,
   authorizedToExport:false,authorizedToRestore:false,
   authorizedToMigrate:false,authorizedToSend:false,hostedDataTouched:false,
   nextGate:'OUT_OF_BAND_HUMAN_IDENTITY_KEY_POSSESSION_AND_INDEPENDENT_VAULT_AUDIT'
 });
}
module.exports={CONTRACT,MODE,PROJECT,fixtureDigest,assessIndependentSignerEvidence};
