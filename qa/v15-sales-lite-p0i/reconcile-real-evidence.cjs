'use strict';
/**
 * V15 Sales Lite P0-I — real observed aggregate evidence RECONCILIATION.
 * Not another approval, signature or backup system. Never invokes network,
 * SQL, RPC or provider. Real owner/backup proof must be verified PRIVATELY.
 *
 * The source-only result ALWAYS prohibits data export / hosted migration /
 * real catalog / provider send / Orders. Use existing PR #135/#143/#189
 * for the independent owner/backup, JWT and migration plans.
 */
const REQUIRED_HOSTED=Object.freeze([
 'tenants','active_tenant_memberships','legacy_products','legacy_orders','legacy_customers',
 'private_channel_bindings','qa_paired','qa_confirmed_claims','qa_synthetic_bots',
 'store_tables','store_member_tables','product_store_columns','order_store_columns',
 'legacy_tenant_permissive_policies','store_scoped_policies',
 'product_tenant_sku_unique','channel_tenant_platform_pk',
 'preview_lab_agent_configs','duplicate_provider_bindings'
]);
const REQUIRED_EVIDENCE=Object.freeze({
 meta_native_page_admin_and_consent:'NOT_INDEPENDENTLY_VERIFIED',
 zalo_oa_native_admin_and_consent:'NOT_INDEPENDENTLY_VERIFIED',
 independent_merchant_tenant_store_attestation:'NOT_INDEPENDENTLY_VERIFIED',
 real_encrypted_staging_backup:'NOT_CERTIFIED',
 independent_restore_drill:'NOT_CERTIFIED',
 authorized_legacy_row_store_attribution:'NOT_CERTIFIED',
 approved_exact_migration:'NOT_APPROVED',
 signed_hosted_jwt_rls_ab_c:'NOT_TESTED'
});
const OBJECT_FIELDS=Object.freeze([
 'contract','source','observed_date_jst','project_ref','schema_readonly_source',
 'hosted','n8n','evidence','decision','branches_reused'
]);
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const keysExact=(v,keys)=>plain(v)&&Object.keys(v).length===keys.length&&Object.keys(v).every(k=>keys.includes(k));
const BLOCK=Object.freeze({
 can_export:false,can_restore:false,can_apply_migration:false,
 can_backfill:false,can_change_rls:false,can_revoke_rpc:false,
 can_read_real_commerce:false,can_send_provider:false,
 can_write_orders:false,can_merge:false,
 native_merchant_provider_proof_certified:false,
 actual_hosted_restore_certified:false,real_signed_jwt_rls_certified:false
});
function evaluateP0i(record){
 const missing=[],risks=[];
 const result=(status)=>Object.freeze({
  contract:'V15_P0I_MIGRATION_DECISION_V1',status,
  legacy_rows_needing_private_attribution:null,
  reasons:Object.freeze([...risks]),
  missing_independent_proofs:Object.freeze([...missing]),
  source_only:true,
  ...BLOCK
 });
 if(!keysExact(record,OBJECT_FIELDS)||
   record.contract!=='V15_P0I_REAL_HOSTED_EVIDENCE_RECONCILIATION_V1'||
   record.project_ref!=='ifxlvrhyjhbzbrkdsida'||
   record.source!=='SUPABASE_STAGING_SQL_AGGREGATE_AND_N8N_METADATA_READ_ONLY'||
   !keysExact(record.hosted,['contract',...REQUIRED_HOSTED])||
   record.hosted.contract!=='V15_P0I_HOSTED_DECISION_PREFLIGHT_V1'||
   !keysExact(record.evidence,Object.keys(REQUIRED_EVIDENCE))||
   !plain(record.n8n)||!plain(record.decision)||!plain(record.branches_reused)){
   risks.push('UNTRUSTED_OR_MALFORMED_AGGREGATE_EVIDENCE');
   return result('NO_GO');
 }
 for(const field of REQUIRED_HOSTED){
   if(!Number.isSafeInteger(record.hosted[field])||record.hosted[field]<0){
     risks.push('INVALID_HOSTED_COUNT');
     return result('NO_GO');
   }
 }
 // Self-asserted "VERIFIED"/"APPROVED" can never be accepted as proof.
 for(const [key,expected] of Object.entries(REQUIRED_EVIDENCE)){
   if(record.evidence[key]!==expected){
     risks.push('UNTRUSTED_PRIVATE_CERTIFICATION_CLAIM');
     return result('NO_GO');
   }
   missing.push(key);
 }
 if(record.decision.schema_expand!=='NO_GO'||
    record.decision.hosted_read_only_commerce_pilot!=='NO_GO'||
    record.decision.provider_send!=='NO_GO'||
    record.decision.order_write!=='NO_GO'||
    record.decision.independent_human_approval!=='NOT_GRANTED'||
    record.decision.source_only!==true){
   risks.push('UNAUTHORIZED_RELEASE_CLAIM');
   return result('NO_GO');
 }
 const h=record.hosted;
 if(!h.private_channel_bindings)risks.push('NO_INDEPENDENT_PROVIDER_TO_TENANT_BINDING');
 if(!h.store_tables||!h.store_member_tables)risks.push('CANONICAL_STORE_MEMBERSHIP_SCHEMA_MISSING');
 if(!h.product_store_columns||!h.order_store_columns)risks.push('LEGACY_PRODUCTS_AND_ORDERS_NOT_STORE_SCOPED');
 if(h.legacy_tenant_permissive_policies>0&&!h.store_scoped_policies)
   risks.push('TENANT_PERMISSIVE_SELECT_POLICY_CANNOT_CERTIFY_SAME_TENANT_STORE_ISOLATION');
 if(h.product_tenant_sku_unique>0)risks.push('LEGACY_TENANT_SKU_UNIQUE_REQUIRES_CUTOVER_PLAN');
 if(h.channel_tenant_platform_pk>0)risks.push('LEGACY_TENANT_PLATFORM_PK_LIMITS_MULTI_STORE_CHANNELS');
 if(h.qa_paired||h.qa_confirmed_claims||h.qa_synthetic_bots)
   risks.push('QA_PAIRINGS_NOT_REAL_MERCHANT_OR_PROVIDER_PROOF');
 if(h.duplicate_provider_bindings>0)risks.push('DUPLICATE_PROVIDER_ACCOUNTS');
 if(record.n8n.messenger?.last_checked_webhook_successes>0)
   risks.push('WEBHOOK_EXECUTION_SUCCESS_NOT_NATIVE_PAGE_OWNERSHIP_CERTIFICATION');
 if(record.n8n.zalo_v1?.recent_checked_executions_manual_only ||
    record.n8n.zalo_v2?.recent_checked_executions_manual_only)
   risks.push('MANUAL_ZALO_EXECUTIONS_NOT_NATIVE_PROVIDER_PROOF');
 if(!risks.length)risks.push('METADATA_GREEN_STILL_REQUIRES_PRIVATE_PROOFS_AND_APPROVAL');
 const rows=h.legacy_products+h.legacy_orders;
 return Object.freeze({
  contract:'V15_P0I_MIGRATION_DECISION_V1',status:'NO_GO',
  legacy_rows_needing_private_attribution:rows,
  reasons:Object.freeze([...risks]),
  missing_independent_proofs:Object.freeze([...missing]),
  recommended_existing_migration_pr:189,
  recommended_existing_jwt_matrix_pr:143,
  recommended_existing_owner_backup_pr:135,
  source_only:true,...BLOCK
 });
}
module.exports={REQUIRED_HOSTED,REQUIRED_EVIDENCE,evaluateP0i};
if(require.main===module){
 const {readFileSync}=require('node:fs');
 const {join}=require('node:path');
 const record=JSON.parse(readFileSync(join(__dirname,'real-hosted-reconciliation-20261116.json'),'utf8'));
 const r=evaluateP0i(record);
 process.stdout.write(JSON.stringify(r,null,2)+'\n');
 if(r.status!=='NO_GO'||r.can_apply_migration||r.can_send_provider)process.exitCode=3;
}
