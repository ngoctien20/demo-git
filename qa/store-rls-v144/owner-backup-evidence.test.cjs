'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {
 summarizeSanitizedCandidates,reviewLocalArchiveReport,privateReviewChecklist,STOP
}=require('./owner-backup-evidence-gate.cjs');
const {reviewReadiness,parseBackupEvidence}=require('../store-rls-v142/predeploy-approval-gates.cjs');
const T_A='qa-staging-shop-a-20261110',T_B='qa-staging-shop-b-20261110';
const records=()=>[
 {qa_tenant_alias:T_A,kind:'orders',row_count:1,synthetic_candidate_count:1,candidate_alias:'qa-store-a'},
 {qa_tenant_alias:T_A,kind:'products',row_count:1,synthetic_candidate_count:1,candidate_alias:'qa-store-a'},
 {qa_tenant_alias:T_B,kind:'orders',row_count:1,synthetic_candidate_count:1,candidate_alias:'qa-store-b'},
 {qa_tenant_alias:T_B,kind:'products',row_count:1,synthetic_candidate_count:1,candidate_alias:'qa-store-b'}
];
const mk=(overrides={})=>({checkpoint:'TIEN404_V144_LOCAL_BACKUP_EVIDENCE',
 timestamp_utc:'2026-11-15T09:00:00Z',byte_size:123456,
 sha256:'a'.repeat(64),manifest_parse_success:true,
 expected_tables_present:Object.fromEntries(
  ['products','orders','customers','order_items','conversations','messages'].map(k=>[k,true])),
 prod_or_staging_modified:false,restore_executed:false,
 restore_status:'NOT_VERIFIED',...overrides});
const nowMs=Date.parse('2026-11-15T11:00:00Z');
const evaluate=(r=mk())=>reviewLocalArchiveReport({
 mode:'OFFLINE_ARCHIVE_METADATA_REVIEW',report:r,nowMs});
const audit=(rows=records())=>summarizeSanitizedCandidates({mode:'READ_ONLY_AGGREGATE_REVIEW',rows});
function blocked(x){
 for(const [k,v] of Object.entries(STOP))assert.equal(x[k],false,k);
}
test('Default tenant candidate gate is DENY',()=>{
 assert.throws(()=>summarizeSanitizedCandidates({rows:records()}),/OWNER_REVIEW_READ_ONLY_REQUIRED/);
});
test('Exactly four source row groups are identified without owner approval',()=>{
 const x=audit();
 assert.equal(x.countedProductRows,2);
 assert.equal(x.countedOrderRows,2);
 assert.equal(x.independentRowReviewRequired,4);
 assert.equal(x.verifiedOwnerRows,0);
 assert.equal(x.includesPrivateRowIds,false);
 assert.equal(x.status,'FOUR_QA_ROWS_AGGREGATED_BUT_OWNER_UNVERIFIED');
 blocked(x);
});
test('No made-up auto backfill from single synthetic store candidate',()=>{
 const x=audit();assert.deepEqual(x.candidateStoreAliasesOnly,['qa-store-a','qa-store-b']);
 assert.equal(x.owner_mapping_approved,false);
});
test('Row count drift blocks (extra records)',()=>{
 assert.throws(()=>audit([...records(),records()[0]]),/OWNER_AGGREGATE_DRIFT_OR_MISSING/);
});
test('Row count drift blocks (record missing)',()=>{
 assert.throws(()=>audit(records().slice(0,3)),/OWNER_AGGREGATE_DRIFT_OR_MISSING/);
});
test('Duplicate tenant/table aggregate never counts as owner-verified',()=>{
 const rows=records();rows[1]={...rows[0]};
 assert.throws(()=>audit(rows),/OWNER_AGGREGATE_DUPLICATE/);
});
test('Wrong tenant candidate alias is not interpreted as valid mapping',()=>{
 const rows=records();rows[1].candidate_alias='qa-store-b';
 assert.throws(()=>audit(rows),/OWNER_CANDIDATE_NOT_VERIFIED/);
});
test('Two candidate stores in a tenant must be independently investigated',()=>{
 const rows=records();rows[2].synthetic_candidate_count=2;
 assert.throws(()=>audit(rows),/OWNER_CANDIDATE_NOT_VERIFIED/);
});
test('Unexpected tenant slug blocks (not a real identity verifier)',()=>{
 const rows=records();rows[1].qa_tenant_alias='../../../fake';
 assert.throws(()=>audit(rows),/OWNER_CANDIDATE_NOT_VERIFIED/);
});
test('Unexpected table kind is blocked',()=>{
 const rows=records();rows[3].kind='auth.users';
 assert.throws(()=>audit(rows),/OWNER_CANDIDATE_NOT_VERIFIED/);
});
test('Null aggregation refuses to assume a successful mapping',()=>{
 assert.throws(()=>audit(null),/OWNER_AGGREGATE_DRIFT_OR_MISSING/);
});
test('Default backup review is blocked even with local metadata',()=>{
 assert.throws(()=>reviewLocalArchiveReport({report:mk()}),/BACKUP_REVIEW_OFFLINE_ONLY/);
});
test('Archive catalog metadata alone is not proof of recoverability',()=>{
 const x=evaluate();assert.equal(x.archiveCatalogChecked,true);
 assert.equal(x.localRestoreReported,false);assert.equal(x.backup_restorable_verified,false);
 blocked(x);
});
test('The check does not reveal backup file hash, filename or bytes',()=>{
 const x=evaluate(mk({file_name:'private-secret-file.backup'}));
 const serialized=JSON.stringify(x);
 assert.doesNotMatch(serialized,/private-secret-file|aaaaaaaaaaaaaaaaaaaaaaaa/);
 assert.equal(x.includesFileHash,false);
 assert.equal(x.includesBackupFilename,false);
});
test('A self-reported local restore does not imply independently tested RLS/rows',()=>{
 const x=evaluate(mk({restore_executed:true,restore_status:'LOCAL_RESTORE_COMPLETED_SCHEMA_COUNTS_ONLY'}));
 assert.equal(x.localRestoreReported,true);
 assert.equal(x.localRestoreIndependentVerified,false);
 assert.equal(x.datasetIntegrityCompared,false);
 blocked(x);
});
test('Missing any of six core archive tables blocks archive catalog readiness',()=>{
 for(const name of ['products','orders','customers','order_items','conversations','messages']){
  const r=mk();r.expected_tables_present[name]=false;
  const x=evaluate(r);assert.equal(x.archiveCatalogChecked,false,name);
  assert.equal(x.status,'INSUFFICIENT_ARCHIVE_CATALOG');
 }
});
test('Invalid or missing SHA256 blocked',()=>{
 for(const sha256 of ['','abc','z'.repeat(64),null]){
  assert.throws(()=>evaluate(mk({sha256})),/BACKUP_METADATA_INVALID/);
 }
});
test('Future timestamp blocked',()=>{
 assert.throws(()=>evaluate(mk({timestamp_utc:'2030-11-15T00:00:00Z'})),/BACKUP_METADATA_INVALID/);
});
test('Any report suggesting a production/staging modification is rejected',()=>{
 assert.throws(()=>evaluate(mk({prod_or_staging_modified:true})),/BACKUP_METADATA_INVALID/);
});
test('Wrong checkpoint signature is not trusted',()=>{
 assert.throws(()=>evaluate(mk({checkpoint:'SELF_ASSERTED_BACKUP'})),/BACKUP_METADATA_INVALID/);
});
test('Owner-specific row review explicitly requires an independent reviewer',()=>{
 const x=privateReviewChecklist();
 assert.equal(x.rowsToConfirm,4);
 assert.ok(x.items.some(v=>v.includes('Independent reviewer')));
 blocked(x);
});
test('V14.2 predeploy gate cannot unlock migration even with all true flags',()=>{
 const yes={
  project_ref:'ifxlvrhyjhbzbrkdsida',
  restorable_backup_verified:true,isolated_restore_drill_passed:true,
  rollback_plan_accepted_by_owner:true,four_row_ownership_verified:true,
  schema_and_rpcs_security_reviewed:true,same_tenant_two_store_qa_approved:true,
  two_distinct_user_jwt_sessions:true,all_old_tenant_only_policies_replaced:true,
  hosted_read_qa_passed:true,hosted_negative_qa_passed:true
 };
 const x=reviewReadiness(yes);
 assert.equal(x.status,'EVIDENCE_READY_FOR_INDEPENDENT_REVIEW');
 assert.equal(x.can_execute_migration,false);
 assert.equal(x.can_change_rls,false);
});
test('V14.2 backup document parser does not claim verified restore',()=>{
 const x=parseBackupEvidence({
  backup_id:'synthetic_archive_qa',backup_timestamp:'2026-11-15',
  restore_drill_id:'synthetic_restore_qa',restore_checked_by:'synthetic_QA',
  rollback_owner_approval:'synthetic_approval'
 });
 assert.equal(x.verified_restorable_backup,false);
});
test('PowerShell backup script is inspect-only by default',()=>{
 const script=fs.readFileSync(path.join(__dirname,'TIEN404_V144_Backup_Evidence.ps1'),'utf8');
 assert.match(script,/if\(\$RestoreLocal\)/);
 assert.match(script,/pg_restore --list|--list \$backup/);
 assert.match(script,/Get-FileHash/);
 assert.match(script,/127\.0\.0\.1/);
 assert.match(script,/--exit-on-error --no-owner --no-privileges/);
 assert.match(script,/tien404_restore_v144_/);
 assert.doesNotMatch(script,/Invoke-WebRequest|Invoke-RestMethod|DROP DATABASE|--clean\s|--create\s/i);
});
test('No executable migration/backfill/release code is exported',()=>{
 const x=require('./owner-backup-evidence-gate.cjs');
 assert.deepEqual(Object.keys(x).sort(),['summarizeSanitizedCandidates',
 'reviewLocalArchiveReport','privateReviewChecklist','STOP'].sort());
});
