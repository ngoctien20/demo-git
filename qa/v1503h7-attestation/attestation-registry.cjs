'use strict';
/**
 * V15.0-03H.7 — synthetic PRIVATE ATTESTATION REGISTRY REHEARSAL ONLY.
 * Trust enrollment is deliberately NOT implemented; caller supplies mock
 * registry, NEVER a production trust anchor. No network, DB, data export.
 */
const {createHash,createPublicKey}=require('node:crypto');
const {assessBackupAuthorizationEnvelope, PROJECT}=require('../v1509d-owner-backup/backup-authorization-gate.cjs');

const MODE='EPHEMERAL_ATTESTATION_REGISTRY_QA_ONLY';
const SIGNER_FIELDS=['signerRef','role','projectRef','environment','active',
  'proofMode','issuedAtMs','expiresAtMs','revokedAtMs','publicKeyPem','keyFingerprint'];
const ROLES=['project_data_controller','security','backup_operator'];
const ID=/^[A-Z][A-Z0-9_:-]{11,79}$/;
const HEX=/^[a-f0-9]{64}$/;
const DENY=(reason)=>Object.freeze({
 status:'BLOCKED',reason,scope:'SYNTHETIC_QA_ONLY',
 independentOwnerCertified:false,realSignerEnrolled:false,
 privateVaultVerified:false,persistentReplayLedgerDeployed:false,
 realAuthorizationVerified:false,allowedToExport:false,allowedToRestore:false,
 allowedToMigrate:false,allowedToSend:false,hostedDataTouched:false
});
function plain(x){return !!x&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;}
function safeTree(x,seen=new WeakSet()){
 if(x===null||typeof x==='string'||typeof x==='number'||typeof x==='boolean')return true;
 if(!plain(x)&&!Array.isArray(x))return false;
 if(seen.has(x))return false;seen.add(x);
 if(Array.isArray(x))return x.every(z=>safeTree(z,seen));
 return Object.entries(x).every(([key,value])=>
   !/(password|private.?key|access.?token|refresh.?token|credential|service.?role|raw.?jwt|phone|email|psid|pairing.?code|connection.?string|recipient.?id)/i.test(key) &&
   safeTree(value,seen));
}
function assessSyntheticAttestationRegistry({request,attestations,registry},{now=()=>Date.now()}={}){
 if(!plain(request)||!Array.isArray(attestations)||!plain(registry)||
    !safeTree(request)||!safeTree(attestations)||!safeTree(registry))
   return DENY('UNSAFE_INPUT_OR_SECRETS');
 if(Object.keys(registry).length!==6||
    !['mode','projectRef','environment','operatorRef','signers','nonceDigest']
      .every(k=>Object.hasOwn(registry,k))||
    registry.mode!==MODE||registry.projectRef!==PROJECT||registry.environment!=='staging'||
    !ID.test(registry.operatorRef||'')||!HEX.test(registry.nonceDigest||'')||
    !Array.isArray(registry.signers)||registry.signers.length!==3)
   return DENY('NO_TRUSTED_SOURCE_PROVIDED_OR_SCOPE_MISMATCH');
 if(!Number.isSafeInteger(now()))return DENY('INVALID_CLOCK');
 const trusted=Object.create(null),ids=new Set(),fps=new Set(),roles=new Set();
 for(const s of registry.signers){
   if(!plain(s)||Object.keys(s).length!==SIGNER_FIELDS.length||
      !SIGNER_FIELDS.every(k=>Object.hasOwn(s,k))||
      !ID.test(s.signerRef||'')||ids.has(s.signerRef)||
      !ROLES.includes(s.role)||roles.has(s.role)||
      s.projectRef!==PROJECT||s.environment!=='staging'||
      s.proofMode!=='QA_WITNESS_UNVERIFIED_FOR_HOSTED'||
      s.active!==true||s.revokedAtMs!==null||
      !Number.isSafeInteger(s.issuedAtMs)||!Number.isSafeInteger(s.expiresAtMs)||
      s.issuedAtMs>now()||s.expiresAtMs<=now()||s.issuedAtMs>=s.expiresAtMs)
     return DENY('UNTRUSTED_EXPIRED_OR_DUPLICATED_SIGNER');
   ids.add(s.signerRef);roles.add(s.role);
   if(s.role==='backup_operator'){
     if(s.signerRef!==registry.operatorRef||s.publicKeyPem!==null||s.keyFingerprint!==null)
       return DENY('UNVERIFIED_OPERATOR_OR_ILLEGAL_SIGNING_KEY');
   }else{
     if(typeof s.publicKeyPem!=='string'||!HEX.test(s.keyFingerprint||'')||
        fps.has(s.keyFingerprint))return DENY('DUPLICATE_OR_UNVERIFIED_KEY');
     let key;
     try{
       key=createPublicKey(s.publicKeyPem);
       if(key.asymmetricKeyType!=='ed25519'||key.type!=='public')return DENY('NOT_ED25519_PUBLIC_KEY');
       const fp=createHash('sha256').update(key.export({format:'der',type:'spki'})).digest('hex');
       if(fp!==s.keyFingerprint)return DENY('TRUST_FINGERPRINT_MISMATCH');
     }catch{return DENY('INVALID_SIGNER_PUBLIC_KEY')}
     fps.add(s.keyFingerprint);
     trusted[s.signerRef]={
       role:s.role,active:true,environment:'EPHEMERAL_QA_ONLY',
       projectRef:PROJECT,syntheticOnly:true,publicKeyPem:s.publicKeyPem
     };
   }
 }
 if(roles.size!==3||!ROLES.every(role=>roles.has(role)))
   return DENY('INDEPENDENT_THREE_ROLE_QUORUM_MISSING');
 if(!attestations.every(a=>plain(a)&&roles.has(a.role)&&a.role!=='backup_operator'))
   return DENY('INVALID_QUORUM_ATTESTATIONS');
 const verify=assessBackupAuthorizationEnvelope(request,attestations,
   Object.assign({},trusted),{now});
 if(verify.status!=='SYNTHETIC_DUAL_SIGNATURE_VERIFIED_NOT_AUTHORIZED')
   return DENY('INHERITED_SIGNED_ENVELOPE_REJECTED_'+(verify.reason||verify.status));
 const tiedNonce=createHash('sha256').update('V15-H7-REPLAY:'+PROJECT+':'+verify.requestFingerprint).digest('hex');
 if(registry.nonceDigest!==tiedNonce)return DENY('NONCE_NOT_BOUND_TO_SIGNED_REQUEST');
 return Object.freeze({
   status:'SYNTHETIC_REGISTRY_VERIFIED_NOT_HOSTED_AUTHORIZATION',
   scope:'SYNTHETIC_QA_ONLY',signatureAlgorithm:'Ed25519',
   requestDigest:verify.requestFingerprint,nonceDigest:registry.nonceDigest,
   syntheticRolesChecked:3,syntheticSignaturesChecked:2,
   independentOwnerCertified:false,realSignerEnrolled:false,
   privateVaultVerified:false,persistentReplayLedgerDeployed:false,
   realAuthorizationVerified:false,allowedToExport:false,allowedToRestore:false,
   allowedToMigrate:false,allowedToSend:false,hostedDataTouched:false,
   nextGate:'REAL_PRIVATE_SIGNER_ENROLLMENT_AND_ATOMIC_APPROVAL_LEDGER_REVIEW'
 });
}
module.exports={MODE,PROJECT,ROLES,assessSyntheticAttestationRegistry};
