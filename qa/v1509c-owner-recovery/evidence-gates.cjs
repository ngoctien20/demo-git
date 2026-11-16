'use strict';
/**
 * V15.0-09C — SYNTHETIC intake only. The caller is untrusted.
 * This module CANNOT certify genuine Merchant Ownership, G2.3, a hosted
 * backup, or permission to migrate. No DB/network/providers/secrets.
 */
const {createHash}=require('node:crypto');
const ROLES=Object.freeze({
 auth:'QA_AUTH_SESSION_SOURCE',
 provider:'QA_PROVIDER_ACCOUNT_SOURCE',
 ingress:'QA_VERIFIED_INGRESS_SOURCE',
 store:'QA_CANONICAL_STORE_SOURCE',
 consent:'QA_INDEPENDENT_OWNER_CONSENT_SOURCE'
});
const BLOCK=reason=>Object.freeze({status:'BLOCKED',reason,
  independent_owner_certified:false,hosted_backup_verified:false,
  can_migrate:false,can_send:false,can_modify_data:false});
const SYNTHETIC='EPHEMERAL_SYNTHETIC_ONLY';
function plain(v){return v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;}
function id(v){return typeof v==='string'&&/^[A-Za-z0-9_:-]{4,100}$/.test(v);}
function sha(v){return typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);}
function rejectSensitive(v) {
  const forbidden=/(raw.?jwt|access.?token|refresh.?token|service.?role|password|credential|secret|phone|psid|recipient.?id|email|private.?key|pairing.?code)/i;
  if(!plain(v))return false;
  return Object.keys(v).some(k=>forbidden.test(k))||Object.values(v).some(x=>plain(x)&&rejectSensitive(x));
}
function inspectG23Intake(entry,{now=()=>Date.now()}={}) {
  if(!plain(entry)||rejectSensitive(entry))return BLOCK('INVALID_OR_SENSITIVE_INPUT');
  if(entry.mode!==SYNTHETIC||!plain(entry.scope)||!plain(entry.proofs))
    return BLOCK('PRIVATE_HOSTED_VERIFICATION_REQUIRED');
  const s=entry.scope, p=entry.proofs;
  if(![s.tenantRef,s.storeRef,s.ownerRef,s.providerAccountRef,s.botRef,s.eventRef,s.challengeRef]
    .every(id)||!['messenger','zalo_bot','zalo_oa','web_widget'].includes(s.channel))
    return BLOCK('INVALID_SCOPE');
  if(!Object.keys(ROLES).every(key=>plain(p[key])))
    return BLOCK('MISSING_INDEPENDENT_PROOF');
  const issued=new Set();
  for(const [key,source] of Object.entries(ROLES)){
    const v=p[key];
    if(v.source!==source||!id(v.receiptRef)||!id(v.issuerRef)||
       issued.has(v.issuerRef)||!Number.isSafeInteger(v.observedAtMs)||
       !Number.isSafeInteger(v.expiresAtMs)||v.observedAtMs>now()||
       v.expiresAtMs<=now()||v.observedAtMs>=v.expiresAtMs)
      return BLOCK('PROOF_EXPIRED_FORGED_OR_NOT_INDEPENDENT');
    if(v.tenantRef!==s.tenantRef||v.storeRef!==s.storeRef||
       v.ownerRef!==s.ownerRef)return BLOCK('CROSS_STORE_PROOF');
    if(['provider','ingress','consent'].includes(key)&&
       (v.botRef!==s.botRef||v.providerAccountRef!==s.providerAccountRef))
      return BLOCK('PROVIDER_BINDING_MISMATCH');
    if(key==='ingress'&&(v.eventRef!==s.eventRef||v.challengeRef!==s.challengeRef))
      return BLOCK('UNTRUSTED_EVENT_BINDING');
    if(key==='consent'&&v.decision!=='EXPLICIT_QA_CONSENT_FIXTURE')
      return BLOCK('CONSENT_NOT_ESTABLISHED');
    issued.add(v.issuerRef);
  }
  const fingerprint=createHash('sha256').update(JSON.stringify({scope:s,
    receiptRefs:Object.keys(ROLES).map(k=>p[k].receiptRef)})).digest('hex');
  return Object.freeze({status:'SYNTHETIC_INDEPENDENCE_SHAPE_READY_NOT_CERTIFIED',
    scope_fingerprint:fingerprint,expected_proofs:5,proofs_checked:5,
    independent_owner_certified:false,provider_g23_certified:false,
    hosted_backup_verified:false,can_migrate:false,can_send:false,can_modify_data:false,
    next_gate:'PRIVATE_PROVIDER_AUTH_OWNER_INDEPENDENT_VERIFICATION'});
}
function inspectRecoveryIntake(entry,{now=()=>Date.now()}={}){
  if(!plain(entry)||rejectSensitive(entry))return BLOCK('INVALID_OR_SENSITIVE_INPUT');
  if(entry.mode!==SYNTHETIC||entry.source!=='DISPOSABLE_POSTGRESQL_17'||
     entry.backupMethod!=='pg_dump_custom'||entry.restoreMethod!=='pg_restore'||
     entry.hostedDatabaseTouched!==false||
     entry.targetIsDisposable!==true)return BLOCK('NOT_EPHEMERAL_RECOVERY_EVIDENCE');
  if(!sha(entry.dumpSha256)||!sha(entry.verifiedDumpSha256)||
     entry.dumpSha256!==entry.verifiedDumpSha256)
    return BLOCK('BACKUP_INTEGRITY_MISMATCH');
  if(!Number.isSafeInteger(entry.backupAtMs)||!Number.isSafeInteger(entry.restoredAtMs)||
     entry.backupAtMs>entry.restoredAtMs||entry.restoredAtMs>now()||
     now()-entry.restoredAtMs>86_400_000)
    return BLOCK('RESTORE_TIMELINE_INVALID');
  if(entry.restoreExitCode!==0||!plain(entry.originalCounts)||!plain(entry.restoredCounts)||
     !['tenants','stores','store_memberships','products','orders','order_items']
       .every(k=>Number.isInteger(entry.originalCounts[k])&&
         entry.originalCounts[k]===entry.restoredCounts[k]&&entry.originalCounts[k]>=0))
    return BLOCK('RESTORE_ROW_COUNT_MISMATCH');
  if(entry.restoredRlsEnabled!==true||entry.restoredForceRlsEnabled!==true||
     entry.restoredStorePolicyPresent!==true||entry.restoredCompositeFkPresent!==true||
     entry.restoredCrossStoreDenied!==true)
    return BLOCK('RESTORED_SECURITY_CONTRACT_MISMATCH');
  return Object.freeze({status:'SYNTHETIC_RESTORE_RECEIPT_READY_NOT_HOSTED',
    counts_verified:6,checksum_verified:true,
    restored_rls_verified_synthetic:true,
    hosted_backup_verified:false,hosted_restore_rehearsed:false,
    independent_owner_certified:false,can_migrate:false,can_send:false,
    can_modify_data:false,next_gate:'PRIVATE_HOSTED_BACKUP_EXPORT_AND_ISOLATED_RESTORE_APPROVAL'});
}
module.exports={ROLES,inspectG23Intake,inspectRecoveryIntake,SYNTHETIC};
