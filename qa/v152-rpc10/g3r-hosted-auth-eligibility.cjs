'use strict';
// TIEN404 RPC10-G3R — REAL hosted *aggregate* eligibility, NEVER a JWT
// authorization or a migration executor. No network, PostgreSQL client,
// process.env, customer/merchant identifiers, provider or credential access.
// Source-only metadata and QA CI may NEVER enable Store/order operations.
const CONTRACT='TIEN404_RPC10_G3R_REAL_AUTH_ELIGIBILITY_READONLY_V1';
const NUMERIC=Object.freeze([
 'migrations_applied_this_phase','live_auth_requests_executed',
 'customer_order_rows_read','raw_auth_identifiers_collected',
 'six_commerce_tables','six_force_rls_count',
 'six_tenant_id_count','six_store_id_count','read_policy_table_count',
 'permissive_read_policy_count','store_predicate_policy_count',
 'tenant_with_membership_count','max_distinct_owner_auth_ids_one_tenant',
 'tenants_with_two_distinct_owner_auth_ids','same_tenant_two_store_qa_count',
 'public_privileged_rpc_count','anon_executable_privileged_rpc_count',
 'authenticated_privileged_rpc_count','synthetic_bot_dry_run_count',
 'synthetic_owner_paired_rows'
]);
const BOOL=Object.freeze([
 'canonical_stores_exist','canonical_store_memberships_exist',
 'original_four_rows_store_owner_provenance_verified',
 'owner_consent_for_staging_migration_approved',
 'current_offhost_recovery_restored_and_verified',
 'same_tenant_two_store_real_jwt_sessions_verified',
 'six_surface_store_writer_contract_verified',
 'external_channel_native_owner_verified',
 'real_cross_channel_customer_link_verified',
 'original_caller_backcompat_verified',
 'm0_deferred_for_disposable_only',
 'approved_for_disposable_rehearsal',
 'approved_for_hosted_ddl','approved_for_live_jwt_uat',
 'approved_for_store_order_read','approved_for_provider_send'
]);
const KEYS=new Set([
 'contract','audit_date_jst','collected_from','project_ref',
 'canonical_migration_parent_pr','release',...NUMERIC,...BOOL
]);
const ZERO_PERMISSIONS=Object.freeze({
 sourceOnly:true,
 liveAuthJwtVerified:false,
 independentMerchantOwnersVerified:false,
 authenticatedStoreMembershipsVerified:false,
 customerLinkVerified:false,
 canReadHostedOrders:false,
 canMigrateM1:false,canExecuteAtomicM2M4:false,
 canReplaceLivePolicies:false,canRevokePublicRpc:false,
 canUseServiceRole:false,canSendProvider:false,
 canChangeN8nPublished:false,canExecuteRealJwtUat:false,
 canEnableCrossChannel:false,canRelease:false
});
function noGo(code,more={}){
 return Object.freeze({status:'HOSTED_STORE_AUTH_AND_JWT_NO_GO',
  code,...ZERO_PERMISSIONS,...more});
}
function integer(v){
 if(typeof v==='number')return Number.isSafeInteger(v)&&v>=0?v:null;
 if(typeof v==='string'&&/^(?:0|[1-9][0-9]{0,14})$/.test(v)){
  const n=Number(v);return Number.isSafeInteger(n)?n:null;
 }
 return null;
}
function immutableList(value){return Object.freeze([...value]);}
function inspect(snapshot){
 if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot)||
    Object.keys(snapshot).some(k=>!KEYS.has(k))||
    snapshot.contract!==CONTRACT||
    snapshot.audit_date_jst!=='2026-11-18'||
    snapshot.collected_from!=='CONNECTED_SUPABASE_STAGING_METADATA_READ_ONLY'||
    snapshot.project_ref!=='ifxlvrhyjhbzbrkdsida'||
    snapshot.canonical_migration_parent_pr!==247 ||
    snapshot.release!=='HOSTED_STORE_AUTH_AND_JWT_NO_GO')
  return noGo('UNTRUSTED_OR_WRONG_STAGING_METADATA_PACKET');
 for(const k of NUMERIC)if(integer(snapshot[k])===null)
  return noGo('UNTRUSTED_SQL_NUMERIC_FIELD');
 for(const k of BOOL)if(typeof snapshot[k]!=='boolean')
  return noGo('UNTRUSTED_SQL_BOOLEAN_FIELD');

 const n=k=>integer(snapshot[k]), gaps=[];
 if(n('six_commerce_tables')!==6 || n('six_force_rls_count')!==6||
    n('six_tenant_id_count')!==6)
    gaps.push('SIX_COMMERCE_RLS_METADATA_DRIFT_STOP');
 if(n('six_store_id_count')!==6 ||
    !snapshot.canonical_stores_exist ||
    !snapshot.canonical_store_memberships_exist)
    gaps.push('CANONICAL_STORE_COLUMNS_AND_MEMBERSHIP_NOT_HOSTED');
 // PostgreSQL PERMISSIVE policies OR together. A new Store RLS policy
 // cannot restrict access if the old Tenant-only permissive SELECT stays.
 if(n('permissive_read_policy_count')>0 &&
    n('store_predicate_policy_count')<n('permissive_read_policy_count'))
    gaps.push('LEGACY_TENANT_PERMISSIVE_POLICY_OR_BYPASS_RISK');
 if(n('tenants_with_two_distinct_owner_auth_ids')===0 ||
    n('max_distinct_owner_auth_ids_one_tenant')<2)
    gaps.push('TWO_OWNER_AUTH_SUBJECT_SLOTS_NOT_PRESENT');
 if(n('same_tenant_two_store_qa_count')===0)
    gaps.push('TWO_STORES_IN_ONE_TENANT_NOT_PROVISIONED');
 if(n('public_privileged_rpc_count')>0 &&
    (n('anon_executable_privileged_rpc_count')>0 ||
     n('authenticated_privileged_rpc_count')>0))
    gaps.push('PRIVILEGED_RPC_TENANT_ONLY_CALLERS_NEED_RECONCILIATION');
 if(n('synthetic_bot_dry_run_count')>0||
    n('synthetic_owner_paired_rows')>0)
    gaps.push('QA_BOT_PAIRING_IS_NOT_REAL_MERCHANT_AUTHORITY');
 if(!snapshot.original_four_rows_store_owner_provenance_verified)
    gaps.push('FOUR_ORIGINAL_ROW_STORE_OWNERSHIP_NOT_ATTESTED');
 if(!snapshot.same_tenant_two_store_real_jwt_sessions_verified)
    gaps.push('REAL_DISTINCT_AUTH_JWT_AND_CURRENT_SESSIONS_NOT_VERIFIED');
 if(!snapshot.six_surface_store_writer_contract_verified ||
    !snapshot.original_caller_backcompat_verified)
    gaps.push('PUBLISHED_CALLER_AND_WRITE_STORE_CONTRACT_NOT_READY');
 if(!snapshot.current_offhost_recovery_restored_and_verified)
    gaps.push('HOSTED_RECOVERY_SCOPE_AND_RESTORE_NOT_ACCEPTED');
 if(!snapshot.external_channel_native_owner_verified ||
    !snapshot.real_cross_channel_customer_link_verified)
    gaps.push('REAL_CHANNEL_OWNER_AND_CUSTOMER_LINK_UNVERIFIED');
 if(n('migrations_applied_this_phase')>0 ||
    n('live_auth_requests_executed')>0 ||
    n('customer_order_rows_read')>0 ||
    n('raw_auth_identifiers_collected')>0)
    gaps.push('READ_ONLY_SCOPE_VIOLATION_STOP');
 if(snapshot.approved_for_hosted_ddl ||
    snapshot.approved_for_live_jwt_uat ||
    snapshot.approved_for_store_order_read ||
    snapshot.approved_for_provider_send)
    gaps.push('SELF_DECLARED_LIVE_APPROVAL_NOT_AUTHORITY');

 const twoOwnerIdsEligibility=
   n('tenants_with_two_distinct_owner_auth_ids')>=1 &&
   n('max_distinct_owner_auth_ids_one_tenant')>=2;
 return noGo('G3R_METADATA_AUDITED_NO_REAL_JWT', {
   scopedQaActorSlotsAvailable:twoOwnerIdsEligibility,
   realAuthSessionEvidenceObserved:false,
   realStoreOwnerMappingEstablished:false,
   disposablePg17CanProceedWithoutNewUsers:true,
   hostedReleaseRequiresRecovery:true,
   rollbackContract:'CLOSE_DRAFT_PR_SOURCE_ONLY',
   blockers:immutableList(gaps),
   missingActualHostedStoreColumnCount:Math.max(0,6-n('six_store_id_count'))
 });
}
module.exports=Object.freeze({CONTRACT,NUMERIC,BOOL,inspect});
