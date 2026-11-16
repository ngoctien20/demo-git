'use strict';
/**
 * TIEN404 P0-E.2 -- source-only, human-facing GO/NO-GO decision support.
 * This module is NOT an authenticator, authorizer, exporter, signer or
 * persistent single-use lease service. All inputs may be user-supplied and
 * UNTRUSTED. The only allowed decision is NO_GO or PRIVATE_REVIEW_REQUIRED.
 * Even complete tickets never issue an executable approval.
 */
const {PROJECT,reviewOneTimeRequest}=require('../v15-sales-lite-p0e1/export-authorization-evidence.cjs');
const {reviewCoveragePlan}=require('../v15-sales-lite-p0e/backup-coverage-gate.cjs');
const REQUIRED=Object.freeze([
  'whole_project_controller_identity',
  'independent_security_reviewer_identity',
  'authorized_backup_operator_access',
  'encrypted_offsite_destination_and_key_custody',
  'independent_data_classification_and_scope',
  'auth_storage_and_external_recovery_scope',
  'approved_retention_and_no_extra_spend',
  'one_time_explicit_approval_receipt',
  'durable_exactly_once_export_lease',
  'private_audit_and_revocation_process'
]);
const REF=/^SEC-[A-Z0-9_-]{12,64}$/;
const isPlain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
function noGo(reason,codes,matched=[]){
 return Object.freeze({
  status:matched.length===REQUIRED.length&&codes.length===0?'PRIVATE_REVIEW_REQUIRED':'NO_GO',
  reason,
  blocked:Object.freeze([...codes]),
  structurally_referenced:Object.freeze([...matched]),
  required:Object.freeze([...REQUIRED]),
  target_project:PROJECT,operation:'ONE_TIME_STAGING_LOGICAL_EXPORT_REVIEW',
  execution_scope:'NONE',can_export:false,can_restore:false,
  can_apply_migration:false,can_change_credentials:false,
  can_send_provider:false,can_write_orders:false,
  actual_backup_created:false,actual_restore_certified:false,
  owner_real_verified:false,security_real_verified:false,
  lease_real_persisted:false,real_approval_issued:false,
  next_action:'VERIFY_PRIVATE_SIGNERS_VAULT_OPERATOR_AND_REQUEST_EXPLICIT_APPROVAL',
  source_only:true
 });
}
function decideOneTimeExport({request,coverage,evidenceIndex,nowMs}={}){
 const codes=[],matched=[];
 if(!isPlain(evidenceIndex)||Object.keys(evidenceIndex).some(k=>!REQUIRED.includes(k))){
   return noGo('INVALID_PRIVATE_INTAKE_INDEX',['INVALID_PRIVATE_INTAKE_INDEX']);
 }
 const seen=new Set();
 for(const key of REQUIRED){
   const item=evidenceIndex[key];
   if(!isPlain(item)||
      Object.keys(item).sort().join(',')!=='review_state,ticket'||
      item.review_state!=='PENDING_PRIVATE_INDEPENDENT_VERIFICATION'||
      typeof item.ticket!=='string'||!REF.test(item.ticket)||
      seen.has(item.ticket)){
     codes.push('MISSING_OR_UNTRUSTED_'+key.toUpperCase());
   }else{seen.add(item.ticket);matched.push(key);}
 }
 const r=reviewOneTimeRequest(request,nowMs);
 if(r.reason!=='PRIVATE_CONTROLLER_AND_SECURITY_APPROVAL_REQUIRED')
   codes.push('P0E1_AUTHORIZATION_REQUEST_INVALID');
 const c=reviewCoveragePlan(coverage);
 if(c.reason!=='INDEPENDENT_PRIVATE_COVERAGE_AND_OWNER_APPROVAL_REQUIRED')
   codes.push('BACKUP_COVERAGE_UNASSESSED');
 if(codes.length)return noGo('UNVERIFIED_PRECONDITIONS_OR_INVALID_PACKET',codes,matched);
 return noGo('ALL_REFERENCES_STILL_REQUIRE_REAL_PRIVATE_VERIFICATION',[],matched);
}
module.exports={REQUIRED,decideOneTimeExport};
