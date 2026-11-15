'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {judge,INVENTORY,TRIAL_SNAPSHOT}=require('./live03e-trial-continuity-gate.cjs');
const base={
source_instance:'ngoctien20.app.n8n.cloud',manifest_count:98,manifest_active_count:19,
cloud_export_downloaded:true,cloud_export_origin:'OWNER_CLOUD_CONSOLE_EXPORT',
exported_workflow_count:98,export_parsed_and_readable:true,export_held_in_private_storage:true,
exposed_secrets_in_public_repo:false,latest_published_versions_reconciled:true,
credentials_migration_plan_ready:true,data_tables_export_plan_ready:true,
independent_restore_dry_run_passed:true,trial_continuity_choice:'PAID_PLAN_SUBJECT_TO_APPROVAL',
owner_approved_paid_subscription:false,billing_operation_requested:false};
const has=(obj,tag)=>assert.ok(judge(obj).blocked_reasons.includes(tag),tag);
test('new gate always NO SEND',()=>{assert.equal(judge().can_send,false);assert.equal(judge(base).can_send,false)});
test('current source inventory records 98 workflows and 19 active',()=>assert.deepEqual(INVENTORY,{workflows:98,active:19}));
test('Gateway snapshot is not a signed current balance',()=>{assert.equal(TRIAL_SNAPSHOT.gateway_ui_balance_usd,0.59);assert.equal(TRIAL_SNAPSHOT.balance_is_live_verified,false)});
test('observed 7 days does not assert exact expiry',()=>assert.match(TRIAL_SNAPSHOT.estimated_end_window,/NOT confirmed expiry/));
test('empty evidence is BLOCKED',()=>assert.equal(judge().status,'BLOCKED'));
test('even all green inputs are REVIEW ONLY and no payment',()=>{const x=judge(base);assert.equal(x.status,'REVIEW_ONLY_NOT_PRODUCTION_APPROVAL');assert.equal(x.paid_upgrade_performed,false);assert.equal(x.credential_changes,0);assert.equal(x.provider_sends,0);});
test('wrong instance blocked',()=>has({...base,source_instance:'other.app.n8n.cloud'},'SOURCE_INSTANCE_IDENTITY_UNVERIFIED'));
test('workflow total mismatch blocked',()=>has({...base,manifest_count:97},'INVENTORY_COUNTS_NOT_RECONCILED'));
test('active workflow mismatch blocked',()=>has({...base,manifest_active_count:18},'INVENTORY_COUNTS_NOT_RECONCILED'));
test('no actual downloaded export blocked',()=>has({...base,cloud_export_downloaded:false},'OWNER_EXPORT_NOT_VERIFIED'));
test('GitHub metadata is NOT an owner console workflow export',()=>has({...base,cloud_export_origin:'GITHUB_MANIFEST_ONLY'},'OWNER_EXPORT_NOT_VERIFIED'));
test('exported workflows smaller than inventory blocked',()=>has({...base,exported_workflow_count:80},'EXPORTED_WORKFLOW_COUNT_INCOMPLETE'));
test('missing count blocked',()=>has({...base,exported_workflow_count:null},'EXPORTED_WORKFLOW_COUNT_INCOMPLETE'));
test('export unreadable JSON blocked',()=>has({...base,export_parsed_and_readable:false},'PRIVATE_EXPORT_INTEGRITY_OR_SECURITY_UNVERIFIED'));
test('export in public repository blocked',()=>has({...base,export_held_in_private_storage:false},'PRIVATE_EXPORT_INTEGRITY_OR_SECURITY_UNVERIFIED'));
test('secret leakage to public git blocked',()=>has({...base,exposed_secrets_in_public_repo:true},'PRIVATE_EXPORT_INTEGRITY_OR_SECURITY_UNVERIFIED'));
test('published versions unreconciled blocked',()=>has({...base,latest_published_versions_reconciled:false},'PUBLISHED_VERSIONS_NOT_RECONCILED'));
test('credential migration plan missing blocked',()=>has({...base,credentials_migration_plan_ready:false},'CREDENTIALS_AND_TABLES_MIGRATION_GAP'));
test('data table migration plan missing blocked',()=>has({...base,data_tables_export_plan_ready:false},'CREDENTIALS_AND_TABLES_MIGRATION_GAP'));
test('restore never tested blocks',()=>has({...base,independent_restore_dry_run_passed:false},'RESTORE_QA_MISSING'));
test('no continuity decision blocks',()=>has({...base,trial_continuity_choice:'UNDECIDED'},'TRIAL_EXPIRY_STRATEGY_UNAPPROVED'));
test('payment requires distinct approval',()=>has({...base,owner_approved_paid_subscription:true,billing_operation_requested:true},'PAYMENT_ACTION_NEEDS_SEPARATE_EXPLICIT_APPROVAL'));
test('self-hosting is not implicitly approved',()=>has({...base,trial_continuity_choice:'DEPLOY_SELF_HOSTED_PROD_NOW'},'TRIAL_EXPIRY_STRATEGY_UNAPPROVED'));
test('backup_verified false for absent export',()=>assert.equal(judge({...base,cloud_export_downloaded:false}).backup_verified,false));
test('backup_verified true still does not grant production or send',()=>{const x=judge(base);assert.equal(x.backup_verified,true);assert.equal(x.can_send,false);assert.equal(x.production_changes,0)});


test('actual inventory metadata matches 98 workflows and 19 active',()=>{
 const inventory=require('./live03e-n8n-workflow-inventory.json');
 assert.equal(inventory.kind,'TIEN404_N8N_METADATA_MANIFEST_NOT_A_BACKUP');
 assert.equal(inventory.workflows.length,98);
 assert.equal(inventory.workflows.filter(x=>x.active).length,19);
 assert.equal(inventory.workflow_count,98);
 assert.equal(inventory.active_count,19);
});
test('Draft/Published 4-way gap is preserved for restore verification',()=>{
 const inventory=require('./live03e-n8n-workflow-inventory.json');
 const diff=require('./live03e-active-version-differences.json');
 assert.equal(diff.different.length,4);
 assert.equal(diff.different_draft_and_published,4);
 assert.equal(diff.same_draft_and_published+diff.different.length,19);
 for(const d of diff.different){
  assert.ok(inventory.workflows.some(w=>w.id===d.id&&w.active));
  assert.notEqual(d.draft_version_id,d.published_version_id);
 }
});
test('metadata inventory must never be mistaken for restorable workflow export',()=>{
 const inventory=require('./live03e-n8n-workflow-inventory.json');
 assert.match(inventory.warning,/NOT RESTORE-CAPABLE/);
 assert.ok(inventory.workflows.every(w=>Object.keys(w).every(k=>['id','name','active','updatedAt'].includes(k))));
});
