'use strict';
/**
 * TIEN404 V15.0-03H.10 — OFFLINE PRIVATE AUTHORITY REVIEW ONLY.
 * This does not enroll people/keys, read evidence, sign approvals or unlock
 * an executor. A screenshot of Owner role is NOT independent certification.
 */
const CONTRACT='TIEN404_V15_03H10_INDEPENDENT_SIGNER_GATE_V1';
const PROJECT='ifxlvrhyjhbzbrkdsida';
const MODE='SYNTHETIC_REVIEW_ONLY';
const HEX=/^[0-9a-f]{64}$/;
const ID=/^[A-Z][A-Z0-9_:-]{11,95}$/;
const FIELDS=['contract','mode','projectRef','environment','operation','requestRef',
 'requestDigest','nonceDigest','issuedAtMs','expiresAtMs','retentionDays',
 'maxAdditionalCostUsd','ownerUiEvidence','signers','independentWitnessRef',
 'sourceAuthorityStatus','privateVaultStatus','approvalLedgerStatus',
 'realExportApproved','hostedDataAccessed'];
const ACTOR=['ref','role','principalDigest','keyFingerprint','identityStatus',
 'keyStatus','approvalReceiptStatus','validUntilMs','revoked'];
const ROLES=['project_data_controller','security','backup_operator'];
const FAIL=reason=>Object.freeze({
 status:'BLOCKED',reason,authority:'NO_REAL_AUTHORITY',
 ownerRoleObservedOnly:true,independentOwnerCertified:false,
 independentSignersVerified:false,operatorAuthorized:false,
 vaultVerified:false,hostedBackupVerified:false,
 allowedToExport:false,allowedToRestore:false,
 allowedToMigrate:false,allowedToSend:false,hostedDataTouched:false
});
function plain(x){return !!x&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;}
function exact(x,keys){return plain(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));}
function safeTree(x,seen=new WeakSet()){
 if(x===null||typeof x==='string'||typeof x==='number'||typeof x==='boolean')return true;
 if((!plain(x)&&!Array.isArray(x))||seen.has(x))return false;
 seen.add(x);
 if(Array.isArray(x))return x.every(v=>safeTree(v,seen));
 return Object.entries(x).every(([k,v])=>
   !/(password|secret|private.?key|credential|raw.?jwt|token|email|phone|recipient|psid|pairing.?code|connection.?string|address)/i.test(k)&&safeTree(v,seen));
}
function reviewAuthority(input,{now=()=>Date.now()}={}){
 if(!exact(input,FIELDS)||!safeTree(input))return FAIL('MALFORMED_OR_SENSITIVE_REQUEST');
 const t=now();
 if(!Number.isSafeInteger(t)||input.contract!==CONTRACT||input.mode!==MODE||
    input.projectRef!==PROJECT||input.environment!=='staging'||
    input.operation!=='REVIEW_ONE_TIME_LOGICAL_EXPORT_NO_EXECUTION'||
    !ID.test(input.requestRef||'')||!HEX.test(input.requestDigest||'')||
    !HEX.test(input.nonceDigest||'')||input.requestDigest===input.nonceDigest||
    !Number.isSafeInteger(input.issuedAtMs)||!Number.isSafeInteger(input.expiresAtMs)||
    input.issuedAtMs>t||input.expiresAtMs<=t||input.expiresAtMs-input.issuedAtMs>3600000)
   return FAIL('WRONG_PROJECT_OPERATION_OR_EXPIRY');
 if(!Number.isInteger(input.retentionDays)||input.retentionDays<1||
    input.retentionDays>30||input.maxAdditionalCostUsd!==0||
    input.ownerUiEvidence!=='OWNER_ROLE_VISIBLE_USER_SCREENSHOT_NOT_INDEPENDENT_PROOF'||
    input.sourceAuthorityStatus!=='PRIVATE_AUTHORITY_VERIFICATION_PENDING'||
    input.privateVaultStatus!=='ENCRYPTED_OFFSITE_CUSTODY_PENDING_INDEPENDENT_REVIEW'||
    input.approvalLedgerStatus!=='TRUSTED_PERSISTENT_LEDGER_NOT_DEPLOYED'||
    input.realExportApproved!==false||input.hostedDataAccessed!==false)
   return FAIL('PREMATURE_APPROVAL_OR_COST');
 if(!Array.isArray(input.signers)||input.signers.length!==3||
    !ID.test(input.independentWitnessRef||''))
   return FAIL('REQUIRED_INDEPENDENT_ACTORS_MISSING');
 const refs=new Set(),roles=new Set(),principals=new Set(),keys=new Set();
 for(const actor of input.signers){
   if(!exact(actor,ACTOR)||!ID.test(actor.ref||'')||
      !ROLES.includes(actor.role)||refs.has(actor.ref)||roles.has(actor.role)||
      !HEX.test(actor.principalDigest||'')||principals.has(actor.principalDigest)||
      actor.identityStatus!=='IDENTITY_UNVERIFIED_PRIVATE_INTAKE'||
      actor.approvalReceiptStatus!=='NOT_SUBMITTED'||
      actor.revoked!==false||!Number.isSafeInteger(actor.validUntilMs)||
      actor.validUntilMs<=t||actor.validUntilMs>input.expiresAtMs)
     return FAIL('DUPLICATE_REVOKED_OR_FALSE_INDEPENDENT_SIGNER');
   if(actor.role==='backup_operator'){
     if(actor.keyFingerprint!==null||actor.keyStatus!=='NOT_A_SIGNING_APPROVER')
       return FAIL('OPERATOR_MUST_NOT_SIGN_FOR_TWO_APPROVERS');
   }else if(!HEX.test(actor.keyFingerprint||'')||
     actor.keyStatus!=='KEY_POSSESSION_NOT_VERIFIED'||
     keys.has(actor.keyFingerprint))
     return FAIL('MISSING_OR_REUSED_UNVERIFIED_SIGNING_KEY');
   refs.add(actor.ref);roles.add(actor.role);principals.add(actor.principalDigest);
   if(actor.keyFingerprint)keys.add(actor.keyFingerprint);
 }
 if(refs.has(input.independentWitnessRef)||!ROLES.every(x=>roles.has(x)))
   return FAIL('REVIEWER_NOT_INDEPENDENT_OR_ROLE_MISSING');
 return Object.freeze({
   status:'SYNTHETIC_AUTHORITY_PACKET_CONSISTENT_NOT_AUTHORIZED',
   reviewLanes:3,authority:'NO_REAL_AUTHORITY',
   ownerRoleObservedOnly:true,independentOwnerCertified:false,
   independentSignersVerified:false,operatorAuthorized:false,
   vaultVerified:false,hostedBackupVerified:false,
   allowedToExport:false,allowedToRestore:false,
   allowedToMigrate:false,allowedToSend:false,hostedDataTouched:false,
   nextGate:'PRIVATE_HUMAN_IDENTITY_AND_VERIFIED_ROLE_APPROVAL_REQUIRED'
 });
}
module.exports={CONTRACT,MODE,PROJECT,reviewAuthority};
