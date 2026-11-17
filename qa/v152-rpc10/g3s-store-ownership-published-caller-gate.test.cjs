'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {inspect,CONTRACT,CURRENT,COMMERCE_TABLES}=
 require('./g3s-store-ownership-published-caller-gate.cjs');
const baseline=require('./g3s-connected-published-owner-mapping-evidence.json');
const clone=()=>JSON.parse(JSON.stringify(baseline));
function hard(result){
 assert.equal(result.status,'STAGING_MIGRATION_NO_GO');
 assert.equal(result.sourceOnly,true);
 for(const key of [
  'realOriginalOwnerProofAuthenticated','canAssignOriginalStore',
  'canAttributeCustomer','verifiedActiveJwtStoreAB',
  'canApplyHostedM1','canApplyHostedM2M4','canReplaceRls',
  'canChangePrivilegedRpc','canReadHostedCommerce',
  'canEnableRealCrossChannel','canPublishN8n','canUseServiceRole',
  'canSendProvider','canApproveSpending'
 ])assert.equal(result[key],false,key);
 assert.equal(result.actualCustomerRowReads,0);
 assert.equal(result.hostedWritesOrWorkflowEdits,0);
 const text=JSON.stringify(result);
 for(const fragment of ['token-','api_key','bearer ','customerPhone',
 'private_phone','merchant_email'])assert.ok(!text.includes(fragment));
}
function red(reason,fn){
 const fixture=clone();fn(fixture);
 const r=inspect(fixture);hard(r);
 assert.equal(r.reason,reason);
 return r;
}
test('real hosted and connected graph 4-row mapping is unverified',()=>{
 const r=inspect(clone());hard(r);
 assert.equal(r.reason,'G3S_CALLER_AND_ORIGINAL_OWNER_RECONCILED_NO_GO');
 assert.equal(r.originalRowOwnerReceiptCount,0);
 assert.ok(r.blockers.includes('FOUR_ORIGINAL_ROWS_SOURCE_AND_INDEPENDENT_OWNER_ATTESTATION_MISSING'));
 assert.ok(r.blockers.includes('CANONICAL_SIX_SURFACE_STORE_SCHEMA_NOT_HOSTED'));
 assert.ok(r.blockers.includes('PERMISSIVE_TENANT_SELECT_OR_LEAK_IF_NEW_POLICY_ADDED'));
 assert.ok(r.blockers.includes('TWO_AUTH_OWNER_IDS_NOT_TWO_STORE_OWNER_BINDINGS'));
 assert.ok(r.blockers.includes('PRIVILEGED_RPC_CALLER_STORE_SCOPE_UNRECONCILED'));
 assert.ok(r.blockers.includes('FOUR_PUBLISHED_COMMERCE_CALLERS_TENANT_ONLY'));
 assert.ok(r.blockers.includes('N8N_COMMERCE_DATA_TABLES_NOT_STORE_SCOPED'));
 assert.ok(r.blockers.includes('LEGACY_MESSENGER_CAN_SEND_AND_WRITE_DEMO_NOT_COMMERCE'));
 assert.ok(r.blockers.includes('ZALO_STAGING_HAS_REAL_QA_MARKER_WRITES'));
});
test('pin live Published Messenger version, not stale RPC10 G03 snapshot version',()=>{
 assert.equal(CURRENT.Z7FdV7uDvApfbURQ[1],'1064b1b3-d3f1-4a6b-a367-2414ba691522');
 assert.notEqual(CURRENT.Z7FdV7uDvApfbURQ[1],'d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92');
 hard(inspect(clone()));
});
test('exactly 16 connected Commerce tables, no Store ID, 14 tenant IDs',()=>{
 assert.equal(COMMERCE_TABLES.length,16);
 assert.equal(baseline.n8n.commerceDataTables.length,16);
 assert.equal(baseline.n8n.commerceTablesWithStoreId,0);
 assert.equal(baseline.n8n.commerceTablesWithTenantId,14);
 hard(inspect(clone()));
});
test('live Messenger has 1 HTTP sender and 5 DEMO tools',()=>{
 const m=baseline.n8n.publishedWorkflowObservations.find(x=>x.classification==='LEGACY_MESSENGER_DEMO');
 assert.equal(m.httpRequestNodes,1);
 assert.equal(m.toolWorkflowNodes,5);
 assert.equal(m.canBeTreatedAsSafeNoSendCanary,false);
});
test('live Zalo Bot 2 real QA marker UPSERTs cannot claim no-write',()=>{
 const m=baseline.n8n.publishedWorkflowObservations.find(x=>x.classification==='ZALO_BOT_STAGING_QA');
 assert.equal(m.dataTableWriteNodes,2);
 assert.equal(m.httpRequestNodes,0);
 assert.equal(m.canBeTreatedAsSafeNoSendCanary,false);
});
test('strict source integrity rejects fake provider auth and original owner keys',()=>{
 for(const key of ['ownerJwt','botToken','merchantPhone','originalStoreId','storeMembershipId','signedProof','rawReceipt']){
  red('INVALID_SOURCE_OR_WRONG_CANONICAL_MIGRATION',x=>x[key]='FORGED');
 }
});
test('snapshot parent and canonical owner cannot be changed',()=>{
 red('INVALID_SOURCE_OR_WRONG_CANONICAL_MIGRATION',x=>x.parentPr=383);
 red('INVALID_SOURCE_OR_WRONG_CANONICAL_MIGRATION',x=>x.canonicalMigrationPr=385);
 red('INVALID_SOURCE_OR_WRONG_CANONICAL_MIGRATION',x=>x.source='CUSTOMER_REQUEST');
 red('INVALID_SOURCE_OR_WRONG_CANONICAL_MIGRATION',x=>x.auditDateJst='2027-01-01');
});
test('extra private UUID in Supabase evidence denied',()=>{
 red('SNAPSHOT_STRUCTURE_NOT_ADMISSIBLE',x=>x.supabase.originalRowId='real-id');
});
test('unexpected credential in n8n evidence denied',()=>{
 red('SNAPSHOT_STRUCTURE_NOT_ADMISSIBLE',x=>x.n8n.credential='secret');
});
test('unexpected Store id or account in workflow evidence denied',()=>{
 red('PUBLISHED_CALLER_SHAPE_OR_ID_INVALID',
 x=>x.n8n.publishedWorkflowObservations[0].store_id='user_input');
});
test('unexpected phone inserted into DataTable metadata denied',()=>{
 red('COMMERCE_DATA_TABLE_SHAPE_INVALID',
 x=>x.n8n.commerceDataTables[0].phone='user_input');
});
test('missing one Published caller denied',()=>{
 red('INCOMPLETE_N8N_CALLER_OR_DATA_TABLE_INVENTORY',
 x=>x.n8n.publishedWorkflowObservations.pop());
});
test('duplicate Published caller denied',()=>{
 red('PUBLISHED_CALLER_SHAPE_OR_ID_INVALID',x=>{
  x.n8n.publishedWorkflowObservations[6].workflowId=x.n8n.publishedWorkflowObservations[0].workflowId;
 });
});
test('replace real Published Messenger with stale version -> STOP',()=>{
 const x=clone();
 x.n8n.publishedWorkflowObservations.find(t=>t.workflowId==='Z7FdV7uDvApfbURQ')
  .publishedVersion='d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92';
 const r=inspect(x);hard(r);
 assert.ok(r.blockers.includes('PUBLISHED_VERSION_DRIFT_STOP_REAUDIT'));
});
test('source cannot claim 4-row owner evidence through self report',()=>{
 const x=clone();
 x.supabase.fourOriginalRowsOwnerAuthentic=true;
 x.supabase.storeOwnerReviewerAuthentic=true;
 x.supabase.actualFourRowSourceRead=true;
 const r=inspect(x);hard(r);
 assert.equal(r.originalRowOwnerReceiptCount,0);
});
test('fake all-green schema and owner claims still NO-GO',()=>{
 const x=clone();
 x.supabase.storeIdTables=6;
 x.supabase.canonicalStoresPresent=true;
 x.supabase.canonicalStoreMembershipsPresent=true;
 x.supabase.tenantPermissiveSelectPolicies=6;
 x.supabase.storeQualifiedSelectPolicies=6;
 x.supabase.fourOriginalRowsOwnerAuthentic=true;
 x.supabase.storeOwnerReviewerAuthentic=true;
 x.supabase.actualFourRowSourceRead=true;
 x.supabase.sameTenantTwoStoreQaCount=2;
 x.supabase.saveMerchantProduct.storeIdMentioned=true;
 x.supabase.saveMerchantProduct.storeScopedWriterVerified=true;
 for(const t of x.n8n.commerceDataTables){t.hasStoreId=true;t.storeColumnCount=1;}
 x.n8n.commerceTablesWithStoreId=16;
 for(const w of x.n8n.publishedWorkflowObservations){
  w.trustedCanonicalStoreAuthorityVerified=true;
  w.storeScopedPublishedReaderVerified=true;
  w.storeScopedPublishedWriterVerified=true;
 }
 const r=inspect(x);hard(r);
 assert.equal(r.reason,'G3S_CALLER_AND_ORIGINAL_OWNER_RECONCILED_NO_GO');
 assert.equal(r.canApplyHostedM1,false);
});
test('adding Store RLS permissive while six old Tenant policies present remains block',()=>{
 const x=clone();
 x.supabase.storeQualifiedSelectPolicies=6;
 x.supabase.tenantPermissiveSelectPolicies=12;
 const r=inspect(x);hard(r);
 assert.ok(r.blockers.includes('PERMISSIVE_TENANT_SELECT_OR_LEAK_IF_NEW_POLICY_ADDED'));
});
test('n8n DataTable without tenantId cannot become trusted Store by label',()=>{
 const x=clone();
 x.n8n.commerceDataTables[0].hasStoreId=true;
 x.n8n.commerceDataTables[0].storeColumnCount=1;
 x.n8n.commerceTablesWithStoreId=1;
 const r=inspect(x);hard(r);
 assert.ok(r.blockers.includes('N8N_COMMERCE_DATA_TABLES_NOT_STORE_SCOPED'));
});
test('inconsistent n8n DataTable aggregate rejected',()=>{
 red('COMMERCE_DATA_TABLE_COUNTS_MISMATCH',x=>x.n8n.commerceTablesWithStoreId=5);
});
test('missing n8n Commerce table rejected',()=>{
 red('INCOMPLETE_N8N_CALLER_OR_DATA_TABLE_INVENTORY',x=>x.n8n.commerceDataTables.pop());
});
test('duplicate n8n table rejected',()=>{
 red('COMMERCE_DATA_TABLE_SHAPE_INVALID',
 x=>x.n8n.commerceDataTables[15].name=x.n8n.commerceDataTables[0].name);
});
test('new nonnegative n8n workflow / DB operations fail release gate',()=>{
 for(const [target,key] of [
  ['n8n','liveWorkflowsExecutedThisPhase'],['n8n','liveWorkflowsUpdatedThisPhase'],
  ['n8n','qaTableCustomerRowsRead'],['decision','actualProviderEventsThisPhase'],
  ['decision','dbHostedWritesThisPhase'],['decision','botSendsThisPhase'],
  ['decision','secretReadsThisPhase']
 ]){
  const x=clone();x[target][key]=1;
  const r=inspect(x);hard(r);
  assert.ok(r.blockers.includes('READ_ONLY_OPERATION_BOUNDARY_VIOLATED'));
 }
});
test('caller self-approval always requires human external authorization',()=>{
 const x=clone();
 x.decision.approvedToRunMigration=true;
 x.decision.approvedToEnableRealOrderRead=true;
 x.decision.approvedToPublish=true;
 x.decision.stagingMigration='GO_SELF_REPORTED';
 const r=inspect(x);hard(r);
 assert.ok(r.blockers.includes('SELF_REPORTED_MIGRATION_AUTHORIZATION_INVALID'));
});
test('invalid customer row counts rejected',()=>{
 red('UNTRUSTED_SUPABASE_COUNT',x=>x.supabase.legacyCustomerRows=-1);
});
test('invalid provider operation counts rejected',()=>{
 red('UNTRUSTED_OPERATION_COUNT',x=>x.decision.botSendsThisPhase='1');
});
test('tampered SECURITY DEFINER function target rejected',()=>{
 red('PRIVILEGED_RPC_INVENTORY_MALFORMED',
 x=>x.supabase.saveMerchantProduct.routine='customer_supplied');
});
test('Store change that claims no authenticated Owner after original proof still never grants authority',()=>{
 const x=clone();x.supabase.tenantsWithTwoOwnerAuthIds=0;
 const r=inspect(x);hard(r);
 assert.equal(r.canReadHostedCommerce,false);
});
test('original migration source and release contract pinned',()=>{
 assert.equal(CONTRACT,'T404_RPC10_G3S_HOSTED_ORIGINAL_STORE_CALLER_COMPAT_V1');
 assert.equal(baseline.parentPr,387);
 assert.equal(baseline.canonicalMigrationPr,247);
 assert.equal(baseline.decision.stagingMigration,'NO_GO_NOT_APPROVED');
});
