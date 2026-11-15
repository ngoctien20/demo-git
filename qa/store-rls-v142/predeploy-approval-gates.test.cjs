'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const g=require('./predeploy-approval-gates.cjs');
const project_ref='ifxlvrhyjhbzbrkdsida';
test('Actual V14.2 staging has no verified backup, owner approval or hosted JWT QA',()=>{
 const r=g.reviewReadiness({project_ref});
 assert.equal(r.status,'BLOCKED');
 assert.equal(r.can_execute_migration,false);
 assert.equal(r.can_change_rls,false);
 assert.equal(r.can_backfill,false);
 assert.equal(r.backfill_rows_authorized,0);
 assert.equal(r.missing.length,g.REQUIRED.length);
});
for(const [key,v] of Object.entries({
 restorable_backup_verified:true,isolated_restore_drill_passed:true,
 rollback_plan_accepted_by_owner:true,four_row_ownership_verified:true,
 schema_and_rpcs_security_reviewed:true,same_tenant_two_store_qa_approved:true,
 two_distinct_user_jwt_sessions:true,all_old_tenant_only_policies_replaced:true,
 hosted_read_qa_passed:true,hosted_negative_qa_passed:true
})){
 test('Single '+key+' cannot authorize write',()=>{
  const r=g.reviewReadiness({project_ref,[key]:v});
  assert.equal(r.can_change_rls,false);
  assert.equal(r.can_execute_migration,false);
  assert.equal(r.status,'BLOCKED');
 });
}
test('Even all boolean flags are NOT direct authorization to migrate',()=>{
 const flags=Object.fromEntries(g.REQUIRED.map(k=>[k,true]));
 const r=g.reviewReadiness({project_ref,...flags});
 assert.equal(r.status,'EVIDENCE_READY_FOR_INDEPENDENT_REVIEW');
 assert.equal(r.can_execute_migration,false);assert.equal(r.can_backfill,false);
 assert.equal(r.can_change_rls,false);
});
test('Reject production target or credentials even with all synthetic evidence flags',()=>{
 const flags=Object.fromEntries(g.REQUIRED.map(k=>[k,true]));
 const r=g.reviewReadiness({project_ref,production_target:true,
   credential_changes_requested:true,...flags});
 assert.equal(r.status,'BLOCKED');
 assert.ok(r.missing.includes('PROHIBITED_SCOPE'));
});
test('Project ref cannot be changed via request',()=>{
 const flags=Object.fromEntries(g.REQUIRED.map(k=>[k,true]));
 const r=g.reviewReadiness({project_ref:'production-ref',...flags});
 assert.equal(r.status,'BLOCKED');assert.ok(r.missing.includes('STAGING_PROJECT_NOT_VERIFIED'));
});
test('Three theoretical Shop A/B QA candidates are not owner evidence',()=>{
 const a=g.summarizeTenantCandidates([
  {kind:'products',tenant_alias:'qa-A',tenant_id:'tenant-a',row_count:1},
  {kind:'orders',tenant_alias:'qa-A',tenant_id:'tenant-a',row_count:1},
  {kind:'products',tenant_alias:'qa-B',tenant_id:'tenant-b',row_count:1},
  {kind:'orders',tenant_alias:'qa-B',tenant_id:'tenant-b',row_count:1}
 ],[{tenant_id:'tenant-a',store_key:'qa-store-a',qa_only:true},
   {tenant_id:'tenant-b',store_key:'qa-store-b',qa_only:true}]);
 assert.equal(a.length,4);
 assert.ok(a.every(x=>x.candidate_count===1&&x.backfill_authorized===false&&x.verified_owner_store===false));
 assert.equal(a.filter(x=>x.candidate_store==='qa-store-a').length,2);
 assert.equal(a.filter(x=>x.candidate_store==='qa-store-b').length,2);
});
test('Ambiguous candidates must not suggest any store for backfill',()=>{
 const r=g.summarizeTenantCandidates([{tenant_id:'tenant-a',kind:'orders',row_count:1}],
  [{tenant_id:'tenant-a',store_key:'A',qa_only:true},{tenant_id:'tenant-a',store_key:'B',qa_only:true}]);
 assert.equal(r[0].candidate_store,null);
 assert.equal(r[0].candidate_count,2);
 assert.equal(r[0].backfill_authorized,false);
});
test('Unverified mapping cannot be used even with single candidate',()=>{
 const r=g.summarizeTenantCandidates([{tenant_id:'tenant-a',kind:'orders',row_count:1}],
  [{tenant_id:'tenant-a',store_key:'A',qa_only:false}]);
 assert.equal(r[0].candidate_store,null);assert.equal(r[0].backfill_authorized,false);
});
test('No exact backup metadata → MISSING_EVIDENCE',()=>{
 const r=g.parseBackupEvidence({backup_id:'just-id'});
 assert.equal(r.status,'MISSING_EVIDENCE');assert.equal(r.verified_restorable_backup,false);
 assert.ok(r.missing.includes('rollback_owner_approval'));
});
test('Complete backup metadata still requires external restore verification',()=>{
 const r=g.parseBackupEvidence({
 backup_id:'private-backup-reference',backup_timestamp:'2026-11-15T10:00:00Z',
 restore_drill_id:'isolated-staging-qa',restore_checked_by:'authorized-reviewer',
 rollback_owner_approval:'separate-approval'
 });
 assert.equal(r.status,'DOCUMENTED_NEEDS_EXTERNAL_VERIFICATION');
 assert.equal(r.verified_restorable_backup,false);
});
test('Do not leak tokens in diagnostics',()=>{
 assert.equal(g.redact('Bearer tokenExample123'), 'Bearer [REDACTED]');
 assert.equal(g.redact('token=xyz123'), 'token=[REDACTED]');
});
test('Static policy covers all six Commerce tables',()=>{
 assert.deepEqual([...g.TABLES].sort(),['products','orders','customers','order_items','conversations','messages'].sort());
});
