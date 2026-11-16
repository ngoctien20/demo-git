'use strict';
/*
 * RPC.11 — scoped approval PACKET SHAPE verifier, not authorization.
 * Does NOT verify identities, signatures, DB receipts or primary evidence.
 * Never runs SQL, changes schema, grants privileges or approves release.
 */
const crypto=require('node:crypto');
const CONTRACT='T404_RPC11_STAGING_PHASE_PRIVATE_APPROVAL_PACKET_V1';
const PROJECT='ifxlvrhyjhbzbrkdsida';
const HEX64=/^[0-9a-f]{64}$/i;
const SHA40=/^[0-9a-f]{40}$/i;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REQUIRED=Object.freeze({
 M1_SCHEMA_ONLY:Object.freeze([
  'CURRENT_FOUR_ROW_PRIMARY_SOURCE','PRIVATE_OWNER_REVIEW',
  'APPROVED_RECOVERY_SCOPE','CURRENT_INDEPENDENT_RESTORE',
  'M1_EXACT_SCHEMA_PLAN','CURRENT_CALLER_INVENTORY','M1_ROLLBACK_ACCEPTANCE']),
 M2_M4_ATOMIC:Object.freeze([
  'HOSTED_M1_ACCEPTANCE','FOUR_ROW_OWNER_INDEPENDENT',
  'CURRENT_INDEPENDENT_RESTORE','ATOMIC_RLS_AND_BACKFILL_REHEARSAL',
  'JWT_SAME_TENANT_AND_CROSS_TENANT','READER_WRITER_BLACKOUT_APPROVAL',
  'ROLLOUT_AND_ROLLBACK_PLAN']),
 M3_COMPOSITE_FK:Object.freeze([
  'HOSTED_M2_M4_ACCEPTANCE','CURRENT_INDEPENDENT_RESTORE',
  'M3_FK_AND_SKU_REHEARSAL','SAME_STORE_CUSTOMER_ACCEPTANCE',
  'REAL_JWT_AND_PRIVILEGED_WRITER_PROOF','M3_LOCK_AND_ROLLBACK_BUDGET',
  'M3_SCHEMA_AND_CLIENT_CONTRACT'])
});
const ROLES=Object.freeze(['CONTROLLER','INDEPENDENT_SECURITY_REVIEWER','DB_OPERATOR']);
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const keys=(x,k)=>plain(x)&&Object.keys(x).length===k.length&&k.every(a=>Object.hasOwn(x,a));
const iso=x=>typeof x==='string'&&/^20\d\d-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(x)&&Number.isFinite(Date.parse(x));
const add=(a,x)=>{if(!a.includes(x))a.push(x)};
function scopeCommitment(p){
 if(!plain(p)||!Array.isArray(p.evidence))return null;
 const items=p.evidence.map(x=>({
  kind:x?.kind,receiptSha256:x?.receiptSha256
 })).sort((a,b)=>String(a.kind).localeCompare(String(b.kind)));
 return crypto.createHash('sha256').update(
  'T404_RPC11_OPERATION_SCOPE_V1\0'+JSON.stringify({
   contract:p.contract,projectRef:p.projectRef,environment:p.environment,
   phase:p.phase,sourceCommitSha:p.sourceCommitSha,
   operationNonceSha256:p.operationNonceSha256,
   issuedAtUtc:p.issuedAtUtc,expiresAtUtc:p.expiresAtUtc,
   claimsZeroDowntime:p.claimsZeroDowntime,
   evidence:items
  })
 ).digest('hex');
}
function inspectPhaseApproval({packet,now=Date.now()}={}){
 const errors=[],fail=x=>add(errors,x);
 const required=['contract','projectRef','environment','phase','sourceCommitSha',
  'operationNonceSha256','issuedAtUtc','expiresAtUtc','claimsZeroDowntime',
  'evidence','attestations'];
 if(!keys(packet,required)||packet.contract!==CONTRACT||
    packet.projectRef!==PROJECT||packet.environment!=='STAGING_ONLY'||
    !Object.hasOwn(REQUIRED,packet.phase)||
    !SHA40.test(packet.sourceCommitSha||'')||
    !HEX64.test(packet.operationNonceSha256||'')||
    packet.claimsZeroDowntime!==false)
  fail('STAGING_OPERATION_SCOPE_INVALID');
 const issued=iso(packet?.issuedAtUtc)?Date.parse(packet.issuedAtUtc):NaN;
 const expiry=iso(packet?.expiresAtUtc)?Date.parse(packet.expiresAtUtc):NaN;
 if(!Number.isSafeInteger(now)||!Number.isFinite(issued)||!Number.isFinite(expiry)||
    issued>now+60000||expiry<=now||expiry-issued>30*60000||expiry-issued<=0)
  fail('PHASE_APPROVAL_WINDOW_EXPIRED_OR_INVALID');
 const phaseEvidence=Object.hasOwn(REQUIRED,packet?.phase||'')?REQUIRED[packet.phase]:[];
 const observed=new Set(),digests=new Set();
 if(!Array.isArray(packet?.evidence)||packet.evidence.length!==phaseEvidence.length)
  fail('PHASE_RECEIPT_COUNT_INVALID');
 for(const e of Array.isArray(packet?.evidence)?packet.evidence:[]){
  if(!keys(e,['kind','receiptSha256'])||typeof e.kind!=='string'||
     !phaseEvidence.includes(e.kind)||!HEX64.test(e.receiptSha256||''))
    fail('PHASE_RECEIPT_FORMAT_INVALID');
  if(observed.has(e.kind))fail('PHASE_DUPLICATE_EVIDENCE_KIND');
  if(digests.has(e.receiptSha256))fail('PHASE_REUSED_EVIDENCE_DIGEST');
  observed.add(e.kind);digests.add(e.receiptSha256);
 }
 for(const kind of phaseEvidence)
  if(!observed.has(kind))fail('PHASE_REQUIRED_RECEIPT_MISSING');
 const expected=scopeCommitment(packet),actors=new Set(),roles=new Set();
 if(!Array.isArray(packet?.attestations)||packet.attestations.length!==ROLES.length)
  fail('INDEPENDENT_ROLE_COUNT_INVALID');
 for(const a of Array.isArray(packet?.attestations)?packet.attestations:[]){
  if(!keys(a,['role','actorId','scopeSha256','approvedAtUtc'])||
    !ROLES.includes(a.role)||!UUID.test(a.actorId||'')||
    !HEX64.test(a.scopeSha256||'')||a.scopeSha256!==expected||
    !iso(a.approvedAtUtc)||Date.parse(a.approvedAtUtc)<issued||
    Date.parse(a.approvedAtUtc)>now+60000)
   fail('INDEPENDENT_ROLE_SCOPE_CLAIM_INVALID');
  if(roles.has(a.role))fail('DUPLICATE_APPROVAL_ROLE');
  if(actors.has(a.actorId))fail('NON_INDEPENDENT_REVIEW_ACTOR');
  roles.add(a.role);actors.add(a.actorId);
 }
 for(const role of ROLES)
  if(!roles.has(role))fail('REQUIRED_INDEPENDENT_ROLE_MISSING');
 const passed=errors.length===0;
 return Object.freeze({
  contract:CONTRACT,phase:Object.hasOwn(REQUIRED,packet?.phase||'')?
   packet.phase:'UNKNOWN',
  status:passed?'STRUCTURAL_PACKET_READY_FOR_PRIVATE_ORIGINAL_EVIDENCE_REVIEW':
   'HOSTED_PHASE_APPROVAL_NO_GO',
  blockers:Object.freeze(errors.sort()),
  requiredReceipts:phaseEvidence.length,
  claimedRoleCount:roles.size,
  realSignerIdentityAuthenticated:false,
  signaturesCryptographicallyVerified:false,
  primaryEvidenceContentsIndependentlyInspected:false,
  realAuthorizedHostMigration:false,
  crossPhaseApprovalReusable:false,
  approvalGranted:false,canApplyM1:false,canApplyM2M4:false,
  canApplyM3:false,canRevokePublicRpc:false,canPublishN8n:false,
  canExportHostedBackup:false
 });
}
function executeHostedPhase(){throw Error('RPC11_NO_HOSTED_MIGRATION_EXECUTOR');}
module.exports=Object.freeze({CONTRACT,PROJECT,REQUIRED,ROLES,
 scopeCommitment,inspectPhaseApproval,executeHostedPhase});
