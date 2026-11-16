'use strict';
/**
 * TIEN404 V15 Sales Lite P0-B — evidence PACKET STRUCTURE CHECKER ONLY.
 * Never verifies an Auth user, Store, token, backup, consent or provenance.
 * Human reviewers must inspect evidence in a PRIVATE system.
 * No hosted API, LLM, client authority, database mutation or provider send.
 */
const EVIDENCE = Object.freeze({
  auth_user: 'AUTH_SERVICE_READ_ONLY',
  tenant_membership: 'HOSTED_DB_READ_ONLY',
  proposed_store_owner_intake: 'INDEPENDENT_MERCHANT_OWNER_WITNESS',
  canonical_store: 'HOSTED_DB_READ_ONLY',
  store_membership: 'HOSTED_DB_READ_ONLY',
  independent_provider_owner_consent: 'NATIVE_PROVIDER_OWNER_VERIFIER',
  legacy_products_attribution: 'INDEPENDENT_MERCHANT_AND_DATA_STEWARD',
  legacy_orders_attribution: 'INDEPENDENT_MERCHANT_AND_DATA_STEWARD',
  private_backup_snapshot: 'AUTHORIZED_BACKUP_OPERATOR',
  isolated_restore_drill: 'INDEPENDENT_RESTORE_TESTER',
  rollback_plan: 'SECURITY_RELEASE_REVIEWER',
  privileged_rpc_review: 'SECURITY_RELEASE_REVIEWER',
  hosted_jwt_store_rls_tests: 'INDEPENDENT_HOSTED_QA',
  merchant_pilot_approval: 'EXPLICIT_MERCHANT_OWNER'
});
const PRE_EXPAND_REQUIRED = Object.freeze([
  'auth_user','tenant_membership','proposed_store_owner_intake',
  'legacy_products_attribution','legacy_orders_attribution','private_backup_snapshot',
  'isolated_restore_drill','rollback_plan','privileged_rpc_review'
]);
const FORBIDDEN_PHASES = Object.freeze([
  'APPLY_HOSTED_MIGRATION','ALTER_HOSTED_RLS','GRANT_HOSTED_ACCESS',
  'BACKFILL_REAL_CUSTOMERS','BACKFILL_REAL_PRODUCTS','BACKFILL_REAL_ORDERS',
  'PROVIDER_LIVE_SEND','ENABLE_PAID_MODEL','MERGE_PRODUCTION'
]);
const FIELDS = new Set(['evidence_id','source_class','status','review_ticket']);
const PATTERN_ID = /^EV-[A-Z0-9_-]{12,64}$/;
const PATTERN_TICKET = /^SEC-[A-Z0-9_-]{8,64}$/;
function result(status,missing,invalid){
 return Object.freeze({
   status,classification:'SOURCE_ONLY_PRIVATE_EVIDENCE_INDEX',
   missing_evidence:Object.freeze([...missing]),
   malformed_evidence:Object.freeze([...invalid]),
   independent_private_review_required:true,
   real_owner_verified:false,hosted_store_rls_verified:false,
   restore_verified:false,merchant_consent_verified:false,
   approved_migration:false,can_apply_migration:false,
   can_change_rls:false,can_reassign_legacy_rows:false,
   can_send_provider:false,can_write_real_order:false,
   no_production_release:true
 });
}
function inspectOwnershipPacket(packet,phase='FULL_CERTIFICATION'){
 if(!['FULL_CERTIFICATION','PRE_EXPAND_REVIEW'].includes(phase))
   return result('BLOCKED_INVALID_REVIEW_PHASE',Object.keys(EVIDENCE),['phase']);
 const required=phase==='PRE_EXPAND_REVIEW'?PRE_EXPAND_REQUIRED:Object.keys(EVIDENCE);
 if(!packet||typeof packet!=='object'||Array.isArray(packet)||
    Object.getPrototypeOf(packet)!==Object.prototype||
    !Object.keys(packet).every(k=>['version','scope','evidence','requested_operations'].includes(k))||
    packet.version!=='V15_P0B_EVIDENCE_V1'||
    packet.scope!=='STAGING_PRIVATE_REVIEW_ONLY'||
    !packet.evidence||typeof packet.evidence!=='object'||Array.isArray(packet.evidence)||
    Object.getPrototypeOf(packet.evidence)!==Object.prototype||
    !Array.isArray(packet.requested_operations)||
    packet.requested_operations.some(op=>typeof op!=='string'||
      FORBIDDEN_PHASES.includes(op)||op!=='REVIEW_PRIVATE_EVIDENCE')){
   return result('BLOCKED_INVALID_OR_UNAUTHORIZED_PACKET',Object.keys(EVIDENCE),['packet']);
 }
 const missing=[],invalid=[],known=new Set(),uniqueIds=new Set();
 for(const key of Object.keys(packet.evidence)){
   if(!Object.hasOwn(EVIDENCE,key)) invalid.push(key);
 }
 for(const key of required){
   const source=EVIDENCE[key],p=packet.evidence[key];
   if(!p){missing.push(key);continue;}
   if(!p||typeof p!=='object'||Array.isArray(p)||
      Object.getPrototypeOf(p)!==Object.prototype||
      Object.keys(p).length!==4||Object.keys(p).some(k=>!FIELDS.has(k))||
      !PATTERN_ID.test(p.evidence_id)||!PATTERN_TICKET.test(p.review_ticket)||
      p.source_class!==source||p.status!=='SUBMITTED_NOT_VERIFIED'||
      uniqueIds.has(p.evidence_id)){
       invalid.push(key);continue;
   }
   uniqueIds.add(p.evidence_id);known.add(key);
 }
 const clean=missing.length===0&&invalid.length===0&&known.size===required.length;
 return result(clean?(phase==='PRE_EXPAND_REVIEW'?'INDEPENDENT_PRE_EXPAND_REVIEW_REQUIRED':'INDEPENDENT_REVIEW_REQUIRED'):
  'BLOCKED_INCOMPLETE_OR_INVALID_EVIDENCE',missing,invalid);
}
module.exports={EVIDENCE,PRE_EXPAND_REQUIRED,FORBIDDEN_PHASES,inspectOwnershipPacket};
