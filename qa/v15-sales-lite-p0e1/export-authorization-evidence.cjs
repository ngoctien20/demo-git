'use strict';
/**
 * TIEN404 V15 Sales Lite P0-E.1 — OFFLINE PRIVATE INTAKE REVIEW, not an
 * authorization system. Private receipts are REFERENCES, never verified identities.
 *
 * Reuse PR #135's synthetic signature tests and PR #132's disposable restore
 * evidence; do not treat either as real authorizations or backup provenance.
 * No network, storage, subprocess, Supabase credential, Meta/Zalo or DDL code.
 */
const PROJECT='ifxlvrhyjhbzbrkdsida';
const OP='STAGING_DATABASE_ONE_TIME_LOGICAL_EXPORT_REVIEW';
const ROLES=Object.freeze({
  controller:'WHOLE_PROJECT_DATA_CONTROLLER',
  security_reviewer:'INDEPENDENT_SECURITY_REVIEWER',
  backup_operator:'LEAST_PRIVILEGE_BACKUP_OPERATOR',
  vault_custodian:'ENCRYPTED_PRIVATE_VAULT_CUSTODIAN'
});
const PROHIBITS=Object.freeze([
  'restore','hosted_migration','change_rls','change_grants',
  'credential_change','customer_or_order_write','provider_send',
  'additional_paid_resources','production_publish'
]);
const COVERAGE=Object.freeze([
  'database_roles','application_schema','application_rows',
  'auth_managed_data','storage_metadata','storage_object_bytes',
  'rls_rpc_extensions','migration_history','external_dependencies'
]);
const ITEM=/^SEC-[A-Z0-9_-]{12,64}$/;
const ACTOR=/^ACT-[A-Z0-9_-]{12,64}$/;
const REQUEST=/^P0E1-[A-Z0-9_-]{12,64}$/;
const HEX=/^[0-9a-f]{64}$/;
const isPlain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const exactly=(o,fields)=>isPlain(o)&&Object.keys(o).length===fields.length&&
  Object.keys(o).every(k=>fields.includes(k));
const failed=(code,gaps=[])=>Object.freeze({
  status:'BLOCKED',reason:code,missing:Object.freeze([...gaps]),
  controller_verified:false,security_reviewer_verified:false,
  operator_verified:false,private_vault_verified:false,
  actual_export_verified:false,checksum_independently_verified:false,
  coverage_verified:false,real_restore_verified:false,
  request_approved:false,can_export:false,can_restore:false,
  can_apply_hosted_migration:false,can_write_orders:false,
  can_send_provider:false,source_only:true
});
function reviewOneTimeRequest(q,nowMs){
 if(!exactly(q,['contract','project','environment','operation','request_id',
      'valid_from_ms','expires_at_ms','max_additional_cost_usd',
      'retention_days','roles','prohibits'])||
    q.contract!=='TIEN404_V15_P0E1_REQUEST_V1'||
    q.project!==PROJECT||q.environment!=='staging'||
    q.operation!==OP||!REQUEST.test(q.request_id)||
    !Number.isSafeInteger(nowMs)||
    !Number.isSafeInteger(q.valid_from_ms)||
    !Number.isSafeInteger(q.expires_at_ms)||
    q.valid_from_ms>nowMs||q.expires_at_ms<=nowMs||
    q.expires_at_ms-q.valid_from_ms>3600000||
    q.max_additional_cost_usd!==0||
    !Number.isSafeInteger(q.retention_days)||
    q.retention_days<1||q.retention_days>30||
    !exactly(q.roles,Object.keys(ROLES))||
    !exactly(q.prohibits,PROHIBITS)||
    !PROHIBITS.every(k=>q.prohibits[k]===true)){
   return failed('INVALID_OR_UNAUTHORIZED_REQUEST');
 }
 const actorRefs=new Set(),ticketRefs=new Set();
 for(const [role,issuerClass] of Object.entries(ROLES)){
   const p=q.roles[role];
   if(!exactly(p,['actor_ref','review_ticket','issuer_class','status'])||
      p.issuer_class!==issuerClass||
      p.status!=='PENDING_INDEPENDENT_PRIVATE_VERIFICATION'||
      !ACTOR.test(p.actor_ref)||!ITEM.test(p.review_ticket)||
      actorRefs.has(p.actor_ref)||ticketRefs.has(p.review_ticket)){
     return failed('UNVERIFIED_OR_DUPLICATED_REVIEWER', [role]);
   }
   actorRefs.add(p.actor_ref);ticketRefs.add(p.review_ticket);
 }
 // A synthetic, self-filled packet is ALWAYS non-authorizing.
 return failed('PRIVATE_CONTROLLER_AND_SECURITY_APPROVAL_REQUIRED');
}
function reviewExportEvidence(q,evidence,nowMs){
 const preliminary=reviewOneTimeRequest(q,nowMs);
 if(preliminary.reason!=='PRIVATE_CONTROLLER_AND_SECURITY_APPROVAL_REQUIRED')
   return failed('REQUEST_PREFLIGHT_FAILED',[preliminary.reason]);
 if(!exactly(evidence,['contract','project','request_id','method','source_type',
    'started_at_ms','finished_at_ms','encrypted_archive_size_bytes',
    'encrypted_archive_sha256','manifest_private_ticket','vault_private_ticket',
    'integrity_reviewer_ticket','coverage'])||
    evidence.contract!=='TIEN404_V15_P0E1_EXPORT_RECEIPT_V1'||
    evidence.project!==PROJECT||evidence.request_id!==q.request_id||
    evidence.method!=='SUPABASE_CLI_LOGICAL_EXPORT_NOT_YET_VERIFIED'||
    evidence.source_type!=='HOSTED_SUPABASE_STAGING_UNVERIFIED'||
    !Number.isSafeInteger(evidence.started_at_ms)||
    !Number.isSafeInteger(evidence.finished_at_ms)||
    evidence.finished_at_ms<evidence.started_at_ms||
    evidence.finished_at_ms>nowMs||
    evidence.started_at_ms<q.valid_from_ms||
    evidence.finished_at_ms>q.expires_at_ms||
    !Number.isSafeInteger(evidence.encrypted_archive_size_bytes)||
    evidence.encrypted_archive_size_bytes<=0||
    !HEX.test(evidence.encrypted_archive_sha256)||
    !ITEM.test(evidence.manifest_private_ticket)||
    !ITEM.test(evidence.vault_private_ticket)||
    !ITEM.test(evidence.integrity_reviewer_ticket)||
    new Set([evidence.manifest_private_ticket,evidence.vault_private_ticket,
     evidence.integrity_reviewer_ticket]).size!==3||
    !exactly(evidence.coverage,COVERAGE)){
   return failed('INVALID_OR_UNTRUSTED_EXPORT_EVIDENCE_PACKET');
 }
 const unreviewed=[];
 for(const [k,v] of Object.entries(evidence.coverage)){
   if(!exactly(v,['status','review_ticket'])||
      v.status!=='PENDING_PRIVATE_COVERAGE_REVIEW'||
      !ITEM.test(v.review_ticket))unreviewed.push(k);
 }
 const vals=Object.values(evidence.coverage).map(v=>v.review_ticket);
 if(new Set(vals).size!==vals.length)unreviewed.push('DUPLICATED_COVERAGE_TICKET');
 if(unreviewed.length)return failed('COVERAGE_PROOF_INVALID',unreviewed);
 // A SHA256 string plus self-asserted proof references is NOT evidence of
 // genuine source, encrypted custody, integrity reviewer or restore.
 return failed('INDEPENDENT_ARCHIVE_PROVENANCE_AND_RESTORE_REQUIRED');
}
module.exports={PROJECT,OP,ROLES,PROHIBITS,COVERAGE,
  reviewOneTimeRequest,reviewExportEvidence};
