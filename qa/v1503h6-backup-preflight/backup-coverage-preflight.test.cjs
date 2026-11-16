'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {CONTRACT,PROJECT,COMPONENTS,assessCoveragePlan}=require('./backup-coverage-preflight.cjs');
function fixture(){
 return {
  contract:CONTRACT,projectRef:PROJECT,environment:'staging',
  mode:'SYNTHETIC_OFFLINE_REVIEW_ONLY',operation:'REVIEW_BACKUP_COVERAGE_NO_EXPORT',
  requestRef:'QA_BACKUP_REVIEW_03H6',operatorRef:'QA_OPERATOR_0001',
  controllerRef:'QA_CONTROLLER_0002',reviewerRef:'QA_SECURITY_0003',
  retentionDays:7,maxAdditionalCostUsd:0,usesDefaultSchemaOnlyDump:false,
  credentialsCollected:false,hostedExportExecuted:false,restoreAuthorized:false,
  hostedMigrationAuthorized:false,providerSendAuthorized:false,
  operatorPrivilegeStatus:'PRIVATE_AUTHORITY_VERIFICATION_PENDING',
  privateVaultStatus:'ENCRYPTED_CUSTODY_INDEPENDENT_REVIEW_PENDING',
  replayLedgerStatus:'TRUSTED_PERSISTENT_ONE_USE_LEDGER_NOT_PROVISIONED',
  coverage:Object.fromEntries(Object.entries(COMPONENTS).map(([k,mechanism],i)=>[
   k,{mechanism,receiptRef:'QA_COVERAGE_'+String(i+1).padStart(4,'0'),status:'PLANNED_NOT_VERIFIED'}
  ]))
 };
}
function expectDenied(name,change,reason){
 test(name,()=>{
  const f=fixture();change(f);const r=assessCoveragePlan(f);
  assert.equal(r.status,'BLOCKED');assert.equal(r.reason,reason);
  assert.equal(r.allowedToExport,false);assert.equal(r.allowedToRestore,false);
  assert.equal(r.allowedToMigrate,false);assert.equal(r.allowedToSend,false);
 });
}
test('complete synthetic plan NEVER authorizes real export or recovery',()=>{
 const r=assessCoveragePlan(fixture());
 assert.equal(r.status,'COMPLETE_SOURCE_PLAN_REQUIRES_INDEPENDENT_PRIVATE_REVIEW');
 assert.equal(r.classesReviewed,Object.keys(COMPONENTS).length);
 for(const key of ['verifiedOwner','verifiedOperator','verifiedVault','verifiedCoverage',
  'verifiedBackup','verifiedRestore','allowedToExport','allowedToRestore',
  'allowedToMigrate','allowedToSend'])assert.equal(r[key],false);
});
expectDenied('missing data rows coverage',f=>delete f.coverage.business_rows,'MISSING_RECOVERY_COVERAGE_CLASSES');
expectDenied('missing Auth identities coverage',f=>delete f.coverage.auth_identities,'MISSING_RECOVERY_COVERAGE_CLASSES');
expectDenied('missing role grants coverage',f=>delete f.coverage.roles_grants,'MISSING_RECOVERY_COVERAGE_CLASSES');
expectDenied('missing private schema coverage',f=>delete f.coverage.private_schema_and_rows,'MISSING_RECOVERY_COVERAGE_CLASSES');
expectDenied('missing RLS and privileged RPC review',f=>delete f.coverage.rls_and_rpc,'MISSING_RECOVERY_COVERAGE_CLASSES');
expectDenied('missing storage bytes inventory',f=>delete f.coverage.storage_object_bytes,'MISSING_RECOVERY_COVERAGE_CLASSES');
expectDenied('missing external services',f=>delete f.coverage.external_dependencies,'MISSING_RECOVERY_COVERAGE_CLASSES');
expectDenied('missing restore verification',f=>delete f.coverage.restore_rehearsal,'MISSING_RECOVERY_COVERAGE_CLASSES');
expectDenied('schema-only dump treated as sufficient',f=>f.usesDefaultSchemaOnlyDump=true,'UNSAFE_COST_CREDENTIALS_OR_HOSTED_ACTION');
expectDenied('production project',f=>f.environment='production','WRONG_PROJECT_SCOPE_OR_INVALID_REFERENCES');
expectDenied('other Supabase project',f=>f.projectRef='other-project','WRONG_PROJECT_SCOPE_OR_INVALID_REFERENCES');
expectDenied('operator equals controller',f=>f.operatorRef=f.controllerRef,'INDEPENDENT_OPERATOR_AND_TWO_APPROVERS_REQUIRED');
expectDenied('reviewer equals controller',f=>f.reviewerRef=f.controllerRef,'INDEPENDENT_OPERATOR_AND_TWO_APPROVERS_REQUIRED');
expectDenied('positive cost',f=>f.maxAdditionalCostUsd=1,'UNSAFE_COST_CREDENTIALS_OR_HOSTED_ACTION');
expectDenied('negative retention',f=>f.retentionDays=-1,'UNSAFE_COST_CREDENTIALS_OR_HOSTED_ACTION');
expectDenied('too long retention',f=>f.retentionDays=31,'UNSAFE_COST_CREDENTIALS_OR_HOSTED_ACTION');
expectDenied('credential collection',f=>f.credentialsCollected=true,'UNSAFE_COST_CREDENTIALS_OR_HOSTED_ACTION');
expectDenied('already exported hosted',f=>f.hostedExportExecuted=true,'UNSAFE_COST_CREDENTIALS_OR_HOSTED_ACTION');
expectDenied('unauthorized restore',f=>f.restoreAuthorized=true,'UNSAFE_COST_CREDENTIALS_OR_HOSTED_ACTION');
expectDenied('unauthorized hosted migration',f=>f.hostedMigrationAuthorized=true,'UNSAFE_COST_CREDENTIALS_OR_HOSTED_ACTION');
expectDenied('unauthorized provider send',f=>f.providerSendAuthorized=true,'UNSAFE_COST_CREDENTIALS_OR_HOSTED_ACTION');
expectDenied('forged operator approval',f=>f.operatorPrivilegeStatus='VERIFIED','FORGED_AUTHORITY_VAULT_OR_REPLAY_CONTROL');
expectDenied('forged vault approval',f=>f.privateVaultStatus='VERIFIED','FORGED_AUTHORITY_VAULT_OR_REPLAY_CONTROL');
expectDenied('forged persistent replay ledger',f=>f.replayLedgerStatus='ENABLED','FORGED_AUTHORITY_VAULT_OR_REPLAY_CONTROL');
expectDenied('claimed recovery verification',f=>f.coverage.auth_identities.status='VERIFIED','INVALID_DUPLICATED_OR_PREMATURE_RECOVERY_PROOF');
expectDenied('duplicate evidence reference',f=>f.coverage.business_rows.receiptRef=f.coverage.public_schema.receiptRef,'INVALID_DUPLICATED_OR_PREMATURE_RECOVERY_PROOF');
expectDenied('wrong recovery mechanism',f=>f.coverage.auth_identities.mechanism='CLI_DEFAULT_DUMP','INVALID_DUPLICATED_OR_PREMATURE_RECOVERY_PROOF');
expectDenied('unknown recovery class',f=>f.coverage.other={mechanism:'NOT_VERIFIED',receiptRef:'QA_NEW_000000',status:'PLANNED_NOT_VERIFIED'},'UNRECOGNIZED_COVERAGE_CLASS');
expectDenied('secret token key',f=>f.token='SENSITIVE','UNSAFE_OR_NON_PLAIN_REQUEST');
expectDenied('nested customer phone field',f=>f.coverage.public_schema.phone='SENSITIVE','UNSAFE_OR_NON_PLAIN_REQUEST');
expectDenied('raw credential field',f=>f.db_password='SENSITIVE','UNSAFE_OR_NON_PLAIN_REQUEST');
expectDenied('hidden export field',f=>f.executeBackup=true,'REQUEST_SCHEMA_MISMATCH');
expectDenied('malformed coverage entry',f=>f.coverage.public_schema='SENSITIVE','INVALID_DUPLICATED_OR_PREMATURE_RECOVERY_PROOF');
expectDenied('malformed opaque operator ref',f=>f.operatorRef='A','WRONG_PROJECT_SCOPE_OR_INVALID_REFERENCES');
