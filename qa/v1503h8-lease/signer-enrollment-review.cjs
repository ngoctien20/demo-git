'use strict';
/**
 * V15.0-03H.8 — SOURCE-ONLY synthetic signer enrollment intake.
 * Not a trust registry, identity provider, or permission issuer.
 * No network, persistence, secrets, key generation, or real approval.
 */
const {PROJECT}=require('../v1503h7-attestation/attestation-registry.cjs');
const CONTRACT='TIEN404_V15_03H8_SIGNER_ENROLLMENT_REVIEW_V1';
const MODE='SYNTHETIC_ENROLLMENT_INTAKE_ONLY';
const ROLES=['project_data_controller','security','backup_operator'];
const ID=/^[A-Z][A-Z0-9_:-]{11,79}$/;
const SHA=/^[a-f0-9]{64}$/;
const SAFE=/^[A-Z0-9_:-]{12,90}$/;
const PACKET=['contract','mode','projectRef','environment','requestRef','observedAtMs','expiresAtMs','signers','review'];
const SIGNER=['signerRef','role','sourceRef','witnessRef','identityReceiptRef','possessionReceiptRef','keyFingerprint','state','validFromMs','validUntilMs'];
const REVIEW=['scope','privateVaultStatus','humanIdentityVerified','mfaVerified','hardwareKeyAttested','keyRotationAndRevocationReady',
  'trustedEnrollmentServiceDeployed','persistentReplayLedgerDeployed','operatorLeastPrivilegeVerified',
  'retentionDays','maxAdditionalCostUsd'];
const deny=(reason)=>Object.freeze({
 status:'BLOCKED',reason,syntheticOnly:true,verifiedHumanIdentity:false,
 enrolledTrustedSigner:false,attestationAuthorized:false,
 realBackupAuthorized:false,canExport:false,canRestore:false,
 canMigrate:false,canSend:false,hostedDatabaseTouched:false
});
function plain(x){return x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;}
function safeTree(x,seen=new WeakSet()){
 if(x===null||typeof x==='number'||typeof x==='boolean'||typeof x==='string')return true;
 if(!(plain(x)||Array.isArray(x))||seen.has(x))return false;
 seen.add(x);
 if(Array.isArray(x))return x.every(v=>safeTree(v,seen));
 return Object.entries(x).every(([k,v])=>
   !/(password|secret|credential|private.?key|raw.?jwt|access.?token|refresh.?token|phone|email|recipient|psid|pairing.?code|connection.?string)/i.test(k)
   &&safeTree(v,seen));
}
function exact(x,keys){return plain(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));}
function reviewSyntheticEnrollment(p,{now=()=>Date.now()}={}){
 if(!exact(p,PACKET)||!safeTree(p))return deny('UNSAFE_OR_MALFORMED_PACKET');
 const t=now();
 if(!Number.isSafeInteger(t)||p.contract!==CONTRACT||p.mode!==MODE||
    p.projectRef!==PROJECT||p.environment!=='staging'||!ID.test(p.requestRef||'')||
    !Number.isSafeInteger(p.observedAtMs)||!Number.isSafeInteger(p.expiresAtMs)||
    p.observedAtMs>t||p.expiresAtMs<=t||p.expiresAtMs-p.observedAtMs>3600000)
   return deny('INVALID_SCOPE_OR_TIME');
 if(!Array.isArray(p.signers)||p.signers.length!==3||!exact(p.review,REVIEW))
   return deny('THREE_SIGNERS_AND_REVIEW_REQUIRED');
 if(p.review.scope!=='PRIVATE_ENROLLMENT_QA_REVIEW_NO_AUTHORITY'||
    p.review.privateVaultStatus!=='PRIVATE_VAULT_PENDING'||
    p.review.humanIdentityVerified!==false||p.review.mfaVerified!==false||
    p.review.hardwareKeyAttested!==false||p.review.keyRotationAndRevocationReady!==false||
    p.review.trustedEnrollmentServiceDeployed!==false||
    p.review.persistentReplayLedgerDeployed!==false||
    p.review.operatorLeastPrivilegeVerified!==false||
    p.review.maxAdditionalCostUsd!==0||
    !Number.isInteger(p.review.retentionDays)||
    p.review.retentionDays<1||p.review.retentionDays>30)
   return deny('PREMATURE_VERIFICATION_OR_COST_SCOPE');
 const ids=new Set(),roles=new Set(),witness=new Set(),proofs=new Set(),fps=new Set();
 for(const s of p.signers){
   if(!exact(s,SIGNER)||!ID.test(s.signerRef||'')||ids.has(s.signerRef)||
      !ROLES.includes(s.role)||roles.has(s.role)||
      !SAFE.test(s.sourceRef||'')||!ID.test(s.witnessRef||'')||
      witness.has(s.witnessRef)||!ID.test(s.identityReceiptRef||'')||
      !ID.test(s.possessionReceiptRef||'')||
      proofs.has(s.identityReceiptRef)||proofs.has(s.possessionReceiptRef)||
      s.identityReceiptRef===s.possessionReceiptRef||s.state!=='QA_INTAKE_PENDING'||
      !Number.isSafeInteger(s.validFromMs)||!Number.isSafeInteger(s.validUntilMs)||
      s.validFromMs>t||s.validUntilMs<=t||s.validFromMs>=s.validUntilMs)
     return deny('UNTRUSTED_DUPLICATE_EXPIRED_SIGNER');
   if(s.role==='backup_operator'){
     if(s.keyFingerprint!==null)return deny('OPERATOR_NOT_A_SIGNING_APPROVER');
   }else if(!SHA.test(s.keyFingerprint||'')||fps.has(s.keyFingerprint))
     return deny('DUPLICATE_OR_UNVERIFIED_SIGNING_FINGERPRINT');
   ids.add(s.signerRef);roles.add(s.role);witness.add(s.witnessRef);
   proofs.add(s.identityReceiptRef);proofs.add(s.possessionReceiptRef);
   if(s.keyFingerprint)fps.add(s.keyFingerprint);
 }
 if(!ROLES.every(x=>roles.has(x)))return deny('MISSING_SEPARATED_ROLE');
 return Object.freeze({
 status:'SYNTHETIC_SIGNER_ENROLLMENT_SHAPE_REVIEWED_NOT_TRUSTED',
 rolesReviewed:3,syntheticOnly:true,verifiedHumanIdentity:false,
 enrolledTrustedSigner:false,attestationAuthorized:false,
 realBackupAuthorized:false,canExport:false,canRestore:false,
 canMigrate:false,canSend:false,hostedDatabaseTouched:false,
 nextGate:'PRIVATE_INDEPENDENT_IDENTITY_MFA_KEY_POSSESSION_AND_CUSTODY_PROOF'
 });
}
module.exports={CONTRACT,MODE,PROJECT,ROLES,reviewSyntheticEnrollment};
