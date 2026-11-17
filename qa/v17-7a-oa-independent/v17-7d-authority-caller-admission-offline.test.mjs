import test from 'node:test';
import assert from 'node:assert/strict';
import {
 inspectPinnedPublishedCallers,inspectStoreSurfaceInventory,
 inspectRemediationDependencies,inspectChannelCanaryAdmission,
 preventSelfAuthorizingRelease
} from './v17-7d-authority-caller-admission-offline.mjs';

const VERSIONS=[
 ['5Eeh8hbpsoNhuiVo','a99c7350-7aea-446d-bdc5-4b10f52c3ad1'],
 ['oOOXicKXGkBskKqh','e0f1e345-8e6c-40cb-8e6a-d7ad2eb92696'],
 ['igPOsSbEgd4NgtRA','eff32e20-a6d0-4975-88b8-107eae752b4b'],
 ['Y0WLykMtNAldbgL0','3d8b7f89-2058-4a2a-8919-e5ff92c3c484'],
 ['yIJk8LvJoLF40Z62','2d912cb0-007f-452f-9536-b92ba12a03e6'],
 ['Z7FdV7uDvApfbURQ','1064b1b3-d3f1-4a6b-a367-2414ba691522'],
 ['wgkkmT7q4lm4HyuA','c81929d4-ab55-4c24-8659-795842739e24']
];
const wf=()=>VERSIONS.map(([id,v])=>({id,publishedVersion:v,draftVersion:v,
  active:true,hasTrustedStoreScope:false}));
const names=['products','orders','order_items','customers','conversations','messages'];
const n8n=['TIEN404_COMMERCE_CHANNELS','TIEN404_COMMERCE_PRODUCTS',
 'TIEN404_COMMERCE_ORDERS','TIEN404_COMMERCE_TENANTS',
 'TIEN404_COMMERCE_V3_STORE_RULES_SANDBOX'];
function hosted(){
 return {
 postgres:names.map(name=>({name,rls:true,forceRls:true,tenantId:true,
   storeId:false,storeScopedSelect:false,selectPolicyCount:1,
   selectPolicyPermissive:true})),
 n8nTables:n8n.map(name=>({name,hasTenantId:true,hasStoreId:false})),
 rpcs:[
  {name:'qa_owner_pairing',securityDefiner:true,anonExecute:false},
  {name:'qa_shop_b_zalo_claim',securityDefiner:true,anonExecute:true},
  {name:'save_merchant_product',securityDefiner:true,anonExecute:false}
 ]
 };
}
function locked(x){
 for(const k of ['realOwnerVerified','realProviderVerified','realSupabaseJwtRlsTested',
  'realChannelUatCompleted','canReadCommerce','canWriteOrders','canWriteStock',
  'canSendProvider','canChangeDatabase','canDeploy','canPublish'])
    assert.equal(x[k],false,k);
 assert.equal(x.status,'HOSTED_RELEASE_NO_GO');
}
function badCaller(reason,change){
 const f=wf();change(f);const x=inspectPinnedPublishedCallers(f);
 assert.equal(x.reason,reason);locked(x);
}
function badSurface(reason,change){
 const f=hosted();change(f);const x=inspectStoreSurfaceInventory(f);
 assert.equal(x.reason,reason);locked(x);
}
test('exact real published workflow versions match but do not prove Store permissions',()=>{
 const r=inspectPinnedPublishedCallers(wf());
 assert.equal(r.manifestShapeMatched,true);
 assert.equal(r.storeAuthorityProved,false);locked(r);
});
test('missing one workflow must fail closed',()=>badCaller(
 'EXPECTED_SEVEN_WORKFLOWS_REQUIRED',f=>f.pop()));
test('duplicate ID cannot replace a missing actor',()=>badCaller(
 'WORKFLOW_MISSING_DUPLICATE_OR_ALIASED',f=>{f[1].id=f[0].id}));
test('unapproved Messenger Published drift refused',()=>badCaller(
 'PUBLISHED_WORKFLOW_VERSION_DRIFT',f=>{f[5].publishedVersion='new-version'}));
test('n8n draft not equal published pin refused',()=>badCaller(
 'PUBLISHED_WORKFLOW_VERSION_DRIFT',f=>{f[5].draftVersion='new-draft'}));
test('an active workflow must remain active',()=>badCaller(
 'PUBLISHED_WORKFLOW_VERSION_DRIFT',f=>{f[0].active=false}));
test('report that Store is newly scoped requires re-review',()=>badCaller(
 'UNVERIFIED_STORE_SCOPE_IN_PUBLISHED_WORKFLOW',f=>{f[0].hasTrustedStoreScope=true}));
test('all six real tenant-only RLS surfaces and n8n tables have NO-GO result',()=>{
 const r=inspectStoreSurfaceInventory(hosted());
 assert.equal(r.reason,'TENANT_ONLY_BASELINE_CONFIRMED_NOT_STORE_AUTHORITY');
 assert.equal(r.databaseSurfaceCount,6);assert.equal(r.n8nTableCount,5);
 assert.equal(r.privilegedRpcCount,3);
 assert.equal(r.storeQualifiedPostgresSurfaces,0);
 assert.equal(r.anonCallableDefinerReviewRequired,true);locked(r);
});
test('missing RLS surface fails closed',()=>badSurface(
 'EXACT_HOSTED_METADATA_INVENTORY_REQUIRED',f=>f.postgres.pop()));
test('duplicated table labels cannot substitute for Orders',()=>badSurface(
 'INVENTORY_OBJECT_IDENTITY_MISMATCH',f=>{f.postgres[1].name='products'}));
test('FORCE RLS disabled is a critical baseline drift',()=>badSurface(
 'TENANT_RLS_BASELINE_MISSING',f=>{f.postgres[2].forceRls=false}));
test('new Store column must trigger independent review',()=>badSurface(
 'HOSTED_DB_BASELINE_CHANGED_REVIEW_REQUIRED',f=>{f.postgres[0].storeId=true}));
test('new Store policy predicate alone does not imply ready',()=>badSurface(
 'HOSTED_DB_BASELINE_CHANGED_REVIEW_REQUIRED',f=>{f.postgres[0].storeScopedSelect=true}));
test('old Tenant permissive policy changed demands migration owner review',()=>badSurface(
 'HOSTED_DB_BASELINE_CHANGED_REVIEW_REQUIRED',f=>{f.postgres[0].selectPolicyPermissive=false}));
test('new separate permissive policy triggers review',()=>badSurface(
 'HOSTED_DB_BASELINE_CHANGED_REVIEW_REQUIRED',f=>{f.postgres[0].selectPolicyCount=2}));
test('n8n Data Tables Store column added needs compatibility review',()=>badSurface(
 'N8N_DATA_TABLE_BASELINE_CHANGED_REVIEW_REQUIRED',f=>{f.n8nTables[1].hasStoreId=true}));
test('n8n Data Table without tenantId triggers review',()=>badSurface(
 'N8N_DATA_TABLE_BASELINE_CHANGED_REVIEW_REQUIRED',f=>{f.n8nTables[0].hasTenantId=false}));
test('public SECURITY DEFINER changes require scope and grants review',()=>badSurface(
 'PRIVILEGED_RPC_BASELINE_CHANGED_REVIEW_REQUIRED',f=>{f.rpcs[0].securityDefiner=false}));
test('anon privilege changes require explicit independent audit',()=>badSurface(
 'ANON_RPC_GRANTS_DRIFT_REVIEW_REQUIRED',f=>{f.rpcs[1].anonExecute=false}));
test('new anon grant to product writer triggers stop',()=>badSurface(
 'ANON_RPC_GRANTS_DRIFT_REVIEW_REQUIRED',f=>{f.rpcs[2].anonExecute=true}));
test('missing privileged RPC cannot be silently ignored',()=>badSurface(
 'EXACT_HOSTED_METADATA_INVENTORY_REQUIRED',f=>f.rpcs.pop()));
test('workstream owners anchored to existing PRs, no duplicate migration',()=>{
 const r=inspectRemediationDependencies({mode:'SOURCE_ONLY_READONLY',
  canonicalMigrationOwner:247,securityReviewer:246,recoveryOwner:251,channelOwner:326});
 assert.equal(r.dependencyShapeMatched,true);assert.equal(r.required.length,10);locked(r);
});
test('unapproved replacement migration owner refused',()=>{
 const r=inspectRemediationDependencies({mode:'SOURCE_ONLY_READONLY',
  canonicalMigrationOwner:999,securityReviewer:246,recoveryOwner:251,channelOwner:326});
 assert.equal(r.reason,'STORE_MIGRATION_WORKSTREAM_COLLISION');locked(r);
});
test('one workstream missing stops',()=>{
 const r=inspectRemediationDependencies({mode:'SOURCE_ONLY_READONLY',
  canonicalMigrationOwner:247,securityReviewer:246,recoveryOwner:251});
 assert.equal(r.reason,'INDEPENDENT_WORKSTREAM_OWNERS_REQUIRED');locked(r);
});
const plan=(channel,version)=>({
 mode:'OFFLINE_QA_NO_SEND',workflowId:channel==='MESSENGER'?'Z7FdV7uDvApfbURQ':
 channel==='WEBSITE'?'wgkkmT7q4lm4HyuA':'yIJk8LvJoLF40Z62',
 publishedVersion:version,directPublishedWorkflow:true,
 isolatedShadowWorkerVerified:false,realOwnerConsentVerified:false,
 nativeProviderSignatureVerified:false,storeOwnershipVerified:false,
 independentOperatorVerified:false,signedNoSendLockVerified:false,
 realSameTenantStoreABVerified:false
});
const channels=[
 ['ZALO_BOT','2d912cb0-007f-452f-9536-b92ba12a03e6',
  'ACTIVE_ZALO_BOT_UPSERTS_QA_MARKERS'],
 ['MESSENGER','1064b1b3-d3f1-4a6b-a367-2414ba691522',
  'ACTIVE_MESSENGER_CONTAINS_HTTP_SEND'],
 ['WEBSITE','c81929d4-ab55-4c24-8659-795842739e24',
  'WEBSITE_ACTIVE_WORKFLOW_IS_DEMO_ONLY']
];
for(const [channel,version,blocker] of channels){
 test(channel+' cannot run direct Published NO-SEND real UAT',()=>{
  const r=inspectChannelCanaryAdmission(channel,plan(channel,version));
  assert.equal(r.channel,channel);
  assert.ok(r.blockers.includes(blocker));locked(r);
 });
 test(channel+' cannot be green solely because someone flags all booleans',()=>{
  const p=plan(channel,version);
  for(const k of Object.keys(p))if(k.endsWith('Verified'))p[k]=true;
  p.directPublishedWorkflow=false;
  const r=inspectChannelCanaryAdmission(channel,p);
  assert.deepEqual(r.blockers,[]);
  assert.equal(r.syntheticCheckOnly,true);locked(r);
 });
 test(channel+' incorrect workflow version denied',()=>{
  const r=inspectChannelCanaryAdmission(channel,plan(channel,'wrong-version'));
  assert.equal(r.reason,'CHANNEL_VERSION_OR_NO_SEND_PLAN_NOT_PINNED');locked(r);
 });
}
test('Zalo OA cannot use Zalo Bot OAuth workaround',()=>{
 const r=inspectChannelCanaryAdmission('ZALO_OA',plan('ZALO_BOT','whatever'));
 assert.equal(r.reason,'OA_REQUIRES_OWNER_OAUTH_FIRST');locked(r);
});
test('Telegram not a customer channel canary',()=>{
 const r=inspectChannelCanaryAdmission('TELEGRAM',plan('ZALO_BOT','whatever'));
 assert.equal(r.reason,'UNSUPPORTED_CHANNEL');locked(r);
});
test('self-declared approved/owner/JWT cannot override independent release gate',()=>{
 const r=preventSelfAuthorizingRelease({
  canPublish:true,realOwnerVerified:true,realProviderVerified:true,
  realSupabaseJwtRlsTested:true,canSendProvider:true,approval:'all-green'
 });
 assert.equal(r.required.length,6);locked(r);
});
