/**
 * CBOT-MSG-CANARY-03C: independent evidence certification boundary.
 * A local JSON, GitHub CI green, signed LIVE01 or PR approval CANNOT
 * self-authorize real Meta SEND, Supabase DDL or n8n Published edits.
 * This deliberately never returns GO.
 */
const EXPECTED = Object.freeze([
 'contract','observed_date_jst','supabase_project','supabase_state',
 'supabase_pg_major','hosted_one_shot_table_count','hosted_claim_rpc_count',
 'hosted_store_table_count','hosted_store_membership_table_count',
 'published_workflow_id','published_version','published_nodes',
 'version_history_entries_observed','historic_version_nodes',
 'historic_version_connections','credential_assigned_node_count',
 'history_node_names_match_published','history_connections_match_published',
 'full_encrypted_private_backup_certified','independent_disposable_restore_certified',
 'full_credential_recovery_certified','previous_signed_live01_page_sender_send_match',
 'live02_private_expiring_grant_issued','native_page_app_permission_verified',
 'real_reusable_psid_allowlist_set','one_shot_postgres_hosted_deployed',
 'postgres_disposable_ci_verified','independent_security_reviewer_signed',
 'owner_final_exact_patch_authorized','actual_live02_sent',
 'published_workflow_modified','provider_token_accessed',
 'personal_meta_identifiers_exported'
]);
const mutable=new Set(['__proto__','constructor','prototype','psid','page_id','access_token',
 'secret','customer_name','recipient_id','grant_value','signature']);
const zeroOrFalse=(r,keys)=>keys.every(k=>r[k]===false);
export function reviewCanary03CReleaseLedger(record){
 const noGo=(reasons,sourceComplete=false)=>Object.freeze({
  contract:'T404_CBOT_MSG_CANARY03C_DECISION_V1',
  verdict:'NO_GO_LIVE02',
  reasons:Object.freeze(reasons),
  verified_hosted_atomic_backend:false,
  private_backup_restore_certified:false,
  certified_recipient_approval:false,
  source_preflight_structurally_valid:sourceComplete,
  can_change_published:false,can_send_live02:false,
  can_write_orders:false,can_expose_meta_token:false,
  can_apply_supabase_migration:false,
  actual_provider_sends:0
 });
 if(!record||typeof record!=='object'||Array.isArray(record)||
  Object.getPrototypeOf(record)!==Object.prototype||
  Object.keys(record).length!==EXPECTED.length||
  Object.keys(record).some(k=>!EXPECTED.includes(k)||mutable.has(k)))
  return noGo(['INVALID_OR_PRIVATE_DATA_IN_PUBLIC_LEDGER']);
 const accepted=
 record.contract==='T404_CBOT_MSG_CANARY03C_HOSTED_PREFLIGHT_LEDGER_V1' &&
 record.supabase_project==='tien404-staging'&&record.supabase_state==='ACTIVE_HEALTHY' &&
 record.supabase_pg_major===17&&record.hosted_one_shot_table_count===0&&
 record.hosted_claim_rpc_count===0&&record.hosted_store_table_count===0&&
 record.hosted_store_membership_table_count===0&&
 record.published_workflow_id==='Z7FdV7uDvApfbURQ'&&
 record.published_version==='d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92'&&
 record.published_nodes===27&&record.historic_version_nodes===27&&
 record.version_history_entries_observed===1&&
 record.historic_version_connections===23&&
 record.credential_assigned_node_count===3&&
 record.history_node_names_match_published===true&&
 record.history_connections_match_published===true&&
 record.previous_signed_live01_page_sender_send_match===true &&
 zeroOrFalse(record,[
  'full_encrypted_private_backup_certified',
  'independent_disposable_restore_certified',
  'full_credential_recovery_certified',
  'live02_private_expiring_grant_issued',
  'native_page_app_permission_verified',
  'real_reusable_psid_allowlist_set',
  'one_shot_postgres_hosted_deployed',
  'postgres_disposable_ci_verified',
  'independent_security_reviewer_signed',
  'owner_final_exact_patch_authorized','actual_live02_sent',
  'published_workflow_modified','provider_token_accessed',
  'personal_meta_identifiers_exported']);
 if(!accepted)return noGo(['REAL_OR_INDEPENDENT_PROOF_REQUIRED_NOT_SELF_ASSERTED']);
 return noGo([
  'HOSTED_ONE_SHOT_RPC_NOT_DEPLOYED',
  'PRIVATE_QA_PSID_AND_PAGE_PERMISSION_NOT_CERTIFIED',
  'NO_PRIVATE_FULL_ENCRYPTED_WORKFLOW_BACKUP',
  'NO_DISPOSABLE_FULL_RESTORE_OR_CREDENTIAL_REATTACH_PROOF',
  'NO_OPERATOR_AND_INDEPENDENT_REVIEWER_EXACT_PATCH_APPROVAL',
  'NO_REAL_PG_WORKER_RACE_ACCEPTANCE_ON_TARGET',
  'NO_ONE_SEND_LIVE02_AUTHORIZATION'
 ],true);
}
