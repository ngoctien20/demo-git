'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {CONTRACT,EXPECTED,BUSINESS,audit}=require('./g03-published-caller-readiness.cjs');
const baseline=require('./g03-published-caller-sanitized.json');
const now='2026-11-17T02:39:00Z',clone=()=>JSON.parse(JSON.stringify(baseline)),run=x=>audit(x,now);
function denied(name,change,blocker){
 test(name,()=>{
  const x=clone();change(x);
  const y=run(x);
  assert.equal(y.status,'PUBLISHED_COMMERCE_STORE_CUTOVER_NO_GO');
  assert.ok(y.blockers.includes(blocker),JSON.stringify(y.blockers));
  for(const flag of ['canPublish','canMerge','canMigrate','canAssignStore','canChangeRls',
    'canReadHostedCommerce','canSendProvider','canModifyCredentials','canAuthorizeBilling'])
   assert.equal(y[flag],false,flag);
 });
}
test('exact observed five active workflow versions match audited manifest',()=>{
 const x=clone();assert.equal(x.contract,CONTRACT);
 assert.equal(x.workflowObservations.length,5);
 assert.equal(x.tableObservations.length,8);
 for(const w of x.workflowObservations)assert.equal(w.activeVersion,EXPECTED[w.workflowId].version);
 for(const table of BUSINESS)assert.ok(x.tableObservations.some(t=>t.table===table));
});
test('verified observed Tenant-only metadata fails closed on all required release dimensions',()=>{
 const x=run(clone());
 for(const blocker of ['TENANT_ONLY_CODE_OR_QUERY_WITHOUT_STORE_SCOPE',
 'TRUSTED_STORE_MEMBERSHIP_RUNTIME_MISSING','STORE_WRITE_AUTHORIZATION_NOT_REVIEWED',
 'TABLE_STORE_SCOPE_MISSING','TABLE_READER_CONTRACT_NOT_REVIEWED',
 'CURRENT_RECOVERY_NOT_ACCEPTED','REAL_FOUR_ROW_STORE_OWNERSHIP_NOT_ATTESTED',
 'REAL_SAME_TENANT_JWT_ISOLATION_NOT_TESTED','LEGACY_DEMO_DATA_MIXING_RISK'])
  assert.ok(x.blockers.includes(blocker),blocker);
 assert.equal(x.realCustomerRowsAccessed,0);
});
test('null input always denied and never executes',()=>assert.ok(run(null).blockers.includes('INVALID_OR_OVERBROAD_SNAPSHOT')));
denied('extra private credential claim rejected',x=>x.secret='DO_NOT_PRINT','INVALID_OR_OVERBROAD_SNAPSHOT');
denied('missing contract key rejected',x=>delete x.tableObservations,'INVALID_OR_OVERBROAD_SNAPSHOT');
denied('contract tampering rejected',x=>x.contract='UNREVIEWED','SOURCE_NOT_TRUSTED_AS_PUBLISHED_METADATA');
denied('unsupported hosted source claim rejected',x=>x.source='CONNECTED_SUPABASE_WRITE','SOURCE_NOT_TRUSTED_AS_PUBLISHED_METADATA');
denied('wrong published count rejected',x=>x.workflowObservations.pop(),'FIVE_REQUIRED_WORKFLOWS_NOT_COMPLETE');
denied('duplicate workflow ID rejected',x=>x.workflowObservations[1].workflowId=x.workflowObservations[0].workflowId,'UNKNOWN_OR_DUPLICATE_WORKFLOW');
denied('unknown workflow ID rejected',x=>x.workflowObservations[0].workflowId='unknown345','UNKNOWN_OR_DUPLICATE_WORKFLOW');
denied('stale active published version rejected',x=>x.workflowObservations[0].activeVersion='untracked','PUBLISHED_VERSION_OR_KIND_DRIFT');
denied('unpublished workflow rejected',x=>x.workflowObservations[0].published=false,'PUBLISHED_VERSION_OR_KIND_DRIFT');
denied('mislabel legacy as Commerce rejected',x=>x.workflowObservations[4].kind='COMMERCE','PUBLISHED_VERSION_OR_KIND_DRIFT');
denied('duplicate private field on workflow rejected',x=>x.workflowObservations[0].accessToken='not-allowed','WORKFLOW_OBSERVATION_FORMAT_INVALID');
denied('Tenant read removed from caller does not count ready',x=>x.workflowObservations[2].dataReadsTenant=false,'EXPECTED_TENANT_CALLER_SCAN_INCOMPLETE');
denied('one Code Store flag without Data Table Store is insufficient',x=>x.workflowObservations[0].codeReadsStore=true,'TENANT_ONLY_CODE_OR_QUERY_WITHOUT_STORE_SCOPE');
denied('one Data Table Store flag without Code Store is insufficient',x=>x.workflowObservations[1].dataReadsStore=true,'TENANT_ONLY_CODE_OR_QUERY_WITHOUT_STORE_SCOPE');
denied('membership recheck absent despite resolver claims',x=>x.workflowObservations[0].trustedStoreResolverDeployed=true,'TRUSTED_STORE_MEMBERSHIP_RUNTIME_MISSING');
denied('no proven store-scoped writer path',x=>x.workflowObservations[3].storeScopedWriteAuthDeployed=false,'STORE_WRITE_AUTHORIZATION_NOT_REVIEWED');
denied('legacy demo mixed into commerce rejected',x=>x.workflowObservations[4].demoDataIsolated=false,'LEGACY_DEMO_DATA_MIXING_RISK');
denied('Messenger cannot claim to be Store Commerce without review',x=>x.workflowObservations[4].trustedStoreResolverDeployed=true,'LEGACY_MESSENGER_NOT_SCOPED_TO_COMMERCE');
denied('missing Commerce products table rejected',x=>x.tableObservations=x.tableObservations.filter(t=>t.table!=='TIEN404_COMMERCE_PRODUCTS'),'REQUIRED_COMMERCE_BUSINESS_TABLE_NOT_INSPECTED');
denied('duplicate table rejected',x=>x.tableObservations.push({...x.tableObservations[0]}),'INVALID_DUPLICATE_OR_UNKNOWN_TABLE');
denied('untrusted non Commerce table cannot sneak in',x=>x.tableObservations[0].table='USER_PRIVATE_DATA','INVALID_DUPLICATE_OR_UNKNOWN_TABLE');
denied('sensitive per-row field on table observation rejected',x=>x.tableObservations[0].rowId='SECRET','INVALID_DUPLICATE_OR_UNKNOWN_TABLE');
denied('missing tenant scoped table marker',x=>x.tableObservations[0].tenantColumn=false,'TABLE_TENANT_SCOPE_NOT_REVIEWED');
denied('missing Store column blocks same-Tenant commerce',x=>x.tableObservations[0].storeColumn=false,'TABLE_STORE_SCOPE_MISSING');
denied('unknown read operation blocks caller inventory',x=>x.tableObservations[0].dataReadOperation=false,'TABLE_READER_CONTRACT_NOT_REVIEWED');
denied('renamed unknown storage source rejected',x=>x.tableObservations[0].storage='SUPABASE_REMOTE','TABLE_SOURCE_TYPE_MISMATCH');
denied('extra authority flag cannot grant rights',x=>x.authority.actor='OWNER','AUTHORITY_CONTRACT_INVALID');
denied('missing independent Owner/Reviewer signatures',x=>x.authority.independentReviewerAttested=false,'REAL_FOUR_ROW_STORE_OWNERSHIP_NOT_ATTESTED');
denied('missing canonical Store registry',x=>x.authority.canonicalHostedStoreRegistryVerified=false,'CANONICAL_STORE_REGISTRY_NOT_VERIFIED');
denied('JWT read-only test not run',x=>x.authority.realSameTenantJwtTested=false,'REAL_SAME_TENANT_JWT_ISOLATION_NOT_TESTED');
denied('backup deferred cannot be considered restoration accepted',x=>x.authority.independentCurrentRecoveryAccepted=false,'CURRENT_RECOVERY_NOT_ACCEPTED');
denied('full caller inventory not signed',x=>x.authority.fullCallerInventoryApproved=false,'CALLER_INVENTORY_NOT_APPROVED');
test('invalid snapshot timing is not silently fresh',()=>{
 const x=clone();x.capturedAtUtc='2024-01-01T00:00:00Z';
 assert.ok(run(x).blockers.includes('SNAPSHOT_STALE_OR_INVALID'));
});
test('structurally all-green booleans are not real provider signature/merchant authority',()=>{
 const x=clone();
 for(const c of x.workflowObservations){
   if(c.kind==='COMMERCE'){
     c.codeReadsStore=c.dataReadsStore=c.trustedStoreResolverDeployed=
       c.activeMembershipRecheckDeployed=c.storeScopedWriteAuthDeployed=true;
   }else c.demoDataIsolated=true;
 }
 for(const t of x.tableObservations){t.storeColumn=t.dataReadOperation=true;}
 for(const k of Object.keys(x.authority))x.authority[k]=true;
 const result=run(x);
 assert.deepEqual(result.blockers,[]);
 assert.equal(result.status,'PUBLISHED_COMMERCE_STORE_CUTOVER_NO_GO');
 assert.equal(result.realSignedJwtValidatedHere,false);
 assert.equal(result.canMigrate,false);
 assert.equal(result.canMerge,false);
});
test('never echo customer identifiers, credentials or private actor data',()=>{
 const x=clone();
 x.workflowObservations[0].apiSecret='private-not-for-output';
 const str=JSON.stringify(run(x));
 assert.equal(str.includes('private-not-for-output'),false);
 assert.equal(str.includes(x.workflowObservations[0].workflowId),false);
 assert.equal(str.includes('TIEN404_COMMERCE_PRODUCTS'),false);
});
