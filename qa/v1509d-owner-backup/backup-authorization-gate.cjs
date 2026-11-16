'use strict';
/**
 * V15.0-09D — Backup approval gate: CRYPTOGRAPHIC OFFLINE REHEARSAL ONLY.
 *
 * This intentionally NEVER exports/restores any database or grants approval
 * to execute. Real authorization must use trusted, privately provisioned
 * verifier keys, human review, private audit, and a separately approved
 * execution service (none is connected or implemented here).
 */
const {verify,createHash}=require('node:crypto');
const CONTRACT='TIEN404_V15_0_09D_BACKUP_APPROVAL_V1';
const PROJECT='ifxlvrhyjhbzbrkdsida';
const OP='STAGING_DATABASE_LOGICAL_EXPORT_REVIEW';
const KEYS=['contract','requestRef','environment','projectRef','operation','scope',
  'backupMethod','destinationClass','encryptionRequired','retentionDays',
  'maxAdditionalCostUsd','sourceReadOnly','prohibitsRestore','prohibitsSchemaChange',
  'prohibitsCustomerMessaging','issuedAtMs','expiresAtMs','syntheticOnly'];
const FAIL=reason=>Object.freeze({
 status:'BLOCKED',reason,approvedForBackup:false,approvedForRestore:false,
 allowedToExport:false,allowedToMigrate:false,allowedToSend:false,
 hostedDataAccessed:false,realSignatureCertified:false
});
function isPlain(v){return !!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;}
const ID=/^[A-Za-z0-9_:-]{6,96}$/;
const FORBIDDEN=/(^|_)(token|secret|password|credential|private.?key|raw.?jwt|phone|email|psid|recipient.?id|connection.?string|db.?password|pairing.?code)($|_)/i;
function hasSensitiveKeys(v,seen=new WeakSet()){
 if(!v||typeof v!=='object')return false;
 if(seen.has(v))return true;
 seen.add(v);
 if(!Array.isArray(v)&&!isPlain(v))return true;
 if(Array.isArray(v))return v.some(x=>hasSensitiveKeys(x,seen));
 return Object.entries(v).some(([k,x])=>FORBIDDEN.test(k)||hasSensitiveKeys(x,seen));
}
function canonical(r){
 return JSON.stringify(Object.fromEntries(KEYS.map(k=>[k,r[k]])));
}
function approvalPayload(request,signerRef,role,observedAtMs){
 return Buffer.from(JSON.stringify({
  requestDigest:createHash('sha256').update(canonical(request)).digest('hex'),
  signerRef,role,observedAtMs
 }), 'utf8');
}
function assessBackupAuthorizationEnvelope(request,attestations,hostTrust,{now=()=>Date.now()}={}){
 if(!isPlain(request)||!Array.isArray(attestations)||!isPlain(hostTrust)||
    hasSensitiveKeys(request)||hasSensitiveKeys(attestations)||hasSensitiveKeys(hostTrust))
   return FAIL('UNTRUSTED_OR_SENSITIVE_INPUT');
 if(Object.keys(request).length!==KEYS.length||
    Object.keys(request).some(k=>!KEYS.includes(k))||KEYS.some(k=>!Object.hasOwn(request,k)))
   return FAIL('REQUEST_SCHEMA_MISMATCH');
 if(request.contract!==CONTRACT||request.operation!==OP||request.environment!=='staging'||
    request.projectRef!==PROJECT||request.syntheticOnly!==true||!ID.test(request.requestRef||'')||
    request.scope!=='DATABASE_LOGICAL_EXPORT_FOR_PRIVATE_RECOVERY_REVIEW'||
    request.backupMethod!=='SUPABASE_CLI_LOGICAL_DUMP_PROPOSED'||
    request.destinationClass!=='APPROVED_PRIVATE_ENCRYPTED_OFFSITE_PENDING'||
    request.encryptionRequired!==true||
    request.retentionDays<1||request.retentionDays>30||!Number.isInteger(request.retentionDays)||
    request.maxAdditionalCostUsd!==0||request.sourceReadOnly!==true||
    request.prohibitsRestore!==true||request.prohibitsSchemaChange!==true||
    request.prohibitsCustomerMessaging!==true)
   return FAIL('UNAUTHORIZED_SCOPE_OR_COST');
 const t=now();
 if(!Number.isSafeInteger(t)||!Number.isSafeInteger(request.issuedAtMs)||
    !Number.isSafeInteger(request.expiresAtMs)||request.issuedAtMs>t||
    request.expiresAtMs<=t||request.expiresAtMs-request.issuedAtMs>3600000)
   return FAIL('EXPIRED_OR_UNBOUNDED_REQUEST');
 if(attestations.length!==2)return FAIL('TWO_INDEPENDENT_APPROVERS_REQUIRED');
 const roleSeen=new Set(),signerSeen=new Set();
 for(const a of attestations){
  if(!isPlain(a)||Object.keys(a).length!==5||
   !['signerRef','role','observedAtMs','signatureBase64','purpose'].every(k=>Object.hasOwn(a,k)))
    return FAIL('INVALID_ATTESTATION');
  if(!ID.test(a.signerRef||'')||!['owner','security'].includes(a.role)||
     a.purpose!==OP||roleSeen.has(a.role)||signerSeen.has(a.signerRef)||
     !Number.isSafeInteger(a.observedAtMs)||a.observedAtMs<request.issuedAtMs||
     a.observedAtMs>t||a.observedAtMs>request.expiresAtMs)
    return FAIL('SIGNER_ROLE_SCOPE_OR_TIME_INVALID');
  const trusted=hostTrust[a.signerRef];
  if(!isPlain(trusted)||trusted.role!==a.role||trusted.active!==true||
     trusted.environment!=='EPHEMERAL_QA_ONLY'||trusted.projectRef!==PROJECT||
     trusted.syntheticOnly!==true||typeof trusted.publicKeyPem!=='string')
    return FAIL('UNTRUSTED_OR_REVOKED_SIGNER');
  if(typeof a.signatureBase64!=='string'||!/^([A-Za-z0-9+/]{4}){21,22}={0,2}$/.test(a.signatureBase64))
    return FAIL('INVALID_SIGNATURE_ENCODING');
  try{
   if(!verify(null,approvalPayload(request,a.signerRef,a.role,a.observedAtMs),
      trusted.publicKeyPem,Buffer.from(a.signatureBase64,'base64')))
    return FAIL('INVALID_APPROVAL_SIGNATURE');
  }catch{return FAIL('INVALID_APPROVAL_SIGNATURE')}
  roleSeen.add(a.role);signerSeen.add(a.signerRef);
 }
 if(!roleSeen.has('owner')||!roleSeen.has('security'))
  return FAIL('TWO_INDEPENDENT_APPROVERS_REQUIRED');
 return Object.freeze({status:'SYNTHETIC_DUAL_SIGNATURE_VERIFIED_NOT_AUTHORIZED',
  requestFingerprint:createHash('sha256').update(canonical(request)).digest('hex'),
  syntheticApprovalsChecked:2,signatureType:'Ed25519',
  approvedForBackup:false,approvedForRestore:false,allowedToExport:false,
  allowedToMigrate:false,allowedToSend:false,hostedDataAccessed:false,
  realSignatureCertified:false,
  nextGate:'PRIVATE_SIGNER_ENROLLMENT_AND_REAL_HUMAN_APPROVAL_ON_TRUSTED_SERVICE'});
}
module.exports={CONTRACT,PROJECT,OP,KEYS,approvalPayload,canonical,
  hasSensitiveKeys,assessBackupAuthorizationEnvelope};
