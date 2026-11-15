'use strict';
/**
 * V14.2 HUMAN review gates (not a migration executor).
 * This module NEVER returns permission to write. Documented evidence is only
 * reviewed by human+hosted Auth QA; string flags cannot authorize mutations.
 */
const TABLES=Object.freeze(['products','orders','customers','order_items','conversations','messages']);
const REQUIRED=Object.freeze([
 'restorable_backup_verified',
 'isolated_restore_drill_passed',
 'rollback_plan_accepted_by_owner',
 'four_row_ownership_verified',
 'schema_and_rpcs_security_reviewed',
 'same_tenant_two_store_qa_approved',
 'two_distinct_user_jwt_sessions',
 'all_old_tenant_only_policies_replaced',
 'hosted_read_qa_passed',
 'hosted_negative_qa_passed'
]);
const redact=(value)=>typeof value==='string'?value.replace(/(Bearer\s+|apikey[:=]\s*|token[:=]\s*)\S+/ig,'$1[REDACTED]'):'';
function reviewReadiness(input={}){
 const missing=REQUIRED.filter(k=>input[k]!==true);
 const forbidden=input.production_target===true||input.customer_data_changes_requested===true||
   input.credential_changes_requested===true||input.live_provider_send_requested===true;
 if(forbidden)missing.unshift('PROHIBITED_SCOPE');
 if(input.project_ref!=='ifxlvrhyjhbzbrkdsida')missing.unshift('STAGING_PROJECT_NOT_VERIFIED');
 // Even when every flag is set, only a separate authorized migration
 // process may apply a versioned migration; this module is always read-only.
 return Object.freeze({
  mode:'PREDEPLOYMENT_HUMAN_REVIEW_ONLY',
  status:missing.length?'BLOCKED':'EVIDENCE_READY_FOR_INDEPENDENT_REVIEW',
  missing:Object.freeze(missing),can_execute_migration:false,
  can_backfill:false,can_change_rls:false,can_change_credential:false,
  can_send_provider_message:false,backfill_rows_authorized:0
 });
}
function summarizeTenantCandidates(records,mappings){
 if(!Array.isArray(records)||!Array.isArray(mappings))throw Error('INPUT_INVALID');
 return records.map(r=>{
  const matches=mappings.filter(m=>m.tenant_id===r.tenant_id && m.qa_only===true);
  const stores=new Set(matches.map(x=>x.store_key));
  return Object.freeze({
   kind:r.kind,tenant_alias:r.tenant_alias,
   candidate_store:stores.size===1?[...stores][0]:null,
   candidate_count:stores.size,
   row_count:r.row_count,verified_owner_store:false,
   backfill_authorized:false,evidence_level:'SYNTHETIC_CANDIDATE_ONLY'
  });
 });
}
function parseBackupEvidence(x={}){
 const expected=['backup_id','backup_timestamp','restore_drill_id','restore_checked_by','rollback_owner_approval'];
 // A metadata summary is not a backup. Never print credentials or accept an ID alone as proof.
 const present=expected.filter(k=>typeof x[k]==='string'&&x[k].length>4);
 return Object.freeze({
  status:present.length===expected.length?'DOCUMENTED_NEEDS_EXTERNAL_VERIFICATION':'MISSING_EVIDENCE',
  missing:expected.filter(k=>!present.includes(k)),
  contains_backup_bytes:false,verified_restorable_backup:false,
  redact_hint:'Keep private backup ID, credentials and restore artifacts outside public GitHub.'
 });
}
module.exports={TABLES,REQUIRED,reviewReadiness,summarizeTenantCandidates,parseBackupEvidence,redact};
