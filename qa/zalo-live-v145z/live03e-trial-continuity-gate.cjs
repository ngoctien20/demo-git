/**
 * TIEN404 V14.5Z-LIVE03E — n8n Cloud Trial Continuity review-only gate
 * Source-only evaluation: NEVER makes payments, alters n8n, exports credentials,
 * suspends workflows or claims a backup exists without external verification.
 */
'use strict';
const INVENTORY={workflows:98,active:19};
const TRIAL_SNAPSHOT={
  observed_banner:'7 days left in your n8n trial',
  observed_date:'2026-11-16',
  estimated_end_window:'around 2026-11-23 (banner approximation, NOT confirmed expiry)',
  gateway_ui_balance_usd:0.59,
  gateway_ui_usage_usd_per_day:0.18,
  balance_is_live_verified:false,
};
function judge(input={}){
 const blocked=[];
 if(input.source_instance!=='ngoctien20.app.n8n.cloud')blocked.push('SOURCE_INSTANCE_IDENTITY_UNVERIFIED');
 if(input.manifest_count!==INVENTORY.workflows||input.manifest_active_count!==INVENTORY.active)
   blocked.push('INVENTORY_COUNTS_NOT_RECONCILED');
 if(input.cloud_export_downloaded!==true||input.cloud_export_origin!=='OWNER_CLOUD_CONSOLE_EXPORT')
   blocked.push('OWNER_EXPORT_NOT_VERIFIED');
 if(!Number.isSafeInteger(input.exported_workflow_count)||input.exported_workflow_count<INVENTORY.workflows)
   blocked.push('EXPORTED_WORKFLOW_COUNT_INCOMPLETE');
 if(input.export_parsed_and_readable!==true||input.export_held_in_private_storage!==true||
    input.exposed_secrets_in_public_repo!==false)
   blocked.push('PRIVATE_EXPORT_INTEGRITY_OR_SECURITY_UNVERIFIED');
 if(input.latest_published_versions_reconciled!==true)
   blocked.push('PUBLISHED_VERSIONS_NOT_RECONCILED');
 if(input.credentials_migration_plan_ready!==true||input.data_tables_export_plan_ready!==true)
   blocked.push('CREDENTIALS_AND_TABLES_MIGRATION_GAP');
 if(input.independent_restore_dry_run_passed!==true)
   blocked.push('RESTORE_QA_MISSING');
 if(input.trial_continuity_choice!=='PAID_PLAN_SUBJECT_TO_APPROVAL'&&input.trial_continuity_choice!=='EXPORT_AND_SHUTDOWN_ACCEPTED')
   blocked.push('TRIAL_EXPIRY_STRATEGY_UNAPPROVED');
 if(input.owner_approved_paid_subscription===true&&input.billing_operation_requested===true)
   blocked.push('PAYMENT_ACTION_NEEDS_SEPARATE_EXPLICIT_APPROVAL');
 return {
   version:'V14.5Z-LIVE03E',
   status:blocked.length?'BLOCKED':'REVIEW_ONLY_NOT_PRODUCTION_APPROVAL',
   blocked_reasons:blocked,
   source_inventory:INVENTORY,
   snapshot:TRIAL_SNAPSHOT,
   backup_verified:blocked.every(x=>![
     'OWNER_EXPORT_NOT_VERIFIED','EXPORTED_WORKFLOW_COUNT_INCOMPLETE',
     'PRIVATE_EXPORT_INTEGRITY_OR_SECURITY_UNVERIFIED','PUBLISHED_VERSIONS_NOT_RECONCILED'
   ].includes(x)),
   paid_upgrade_performed:false,
   credential_changes:0,
   production_changes:0,
   provider_sends:0,
   can_send:false,
 };
}
module.exports={judge,INVENTORY,TRIAL_SNAPSHOT};
