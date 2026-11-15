'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const v=require('./writer-compatibility.cjs');
function manifest(){
 return v.EXPECTED_IDS.map(id=>{
  const e=v.EXPECTED[id];
  return {id,name:e.name,active:e.active,versionId:e.draft,
    activeVersionId:e.published,nodeNames:[...e.steps]};
 });
}
function audit(x=manifest()){return v.reportWorkflowInventory(x);}
const legacy=()=>v.assessLegacyProductCall({source:'SERVER_VERIFIED_LEGACY_ROUTE',
 channel:'AI_SALES_DEMO',operation:'write',
 tenantId:'11111111-1111-4111-8111-111111111111',storeId:null,scopeCount:1,
 expectedVersion:'CURRENT_VERIFIED_LEGACY_VERSION'});
test('01 · exact six active workflow IDs from current n8n audit',()=>{
 assert.equal(v.EXPECTED_IDS.length,6);
 assert.ok(v.EXPECTED_IDS.includes('KrSn4DNR9ALX5ng4'));
 assert.ok(v.EXPECTED_IDS.includes('U2DJsxzSYPH5hRop'));
});
test('02 · unchanged audit manifest is classified but never write-enabled',()=>{
 const r=audit();
 assert.equal(r.status,'READ_ONLY_AUDIT_SNAPSHOT_MATCH');
 assert.equal(r.rows.length,6);
 assert.equal(r.activeWorkflowWritesPermitted,false);
});
test('03 · source classification distinguishes Sheets Demo and n8n Commerce mock',()=>{
 const r=audit();
 assert.equal(r.rows.filter(x=>x.backing==='GOOGLE_SHEETS_DEMO').length,4);
 assert.equal(r.rows.filter(x=>x.backing==='N8N_DATA_TABLES_SANDBOX').length,2);
});
test('04 · 4 demo workflows have different draft/published versions',()=>{
 assert.equal(audit().rows.filter(x=>x.publishedAndDraftDiffer).length,4);
});
test('05 · missing workflow fails closed',()=>{
 assert.ok(audit(manifest().slice(0,5)).blockers.includes('WORKFLOW_INVENTORY_INCOMPLETE'));
});
test('06 · published workflow drift requires new audit',()=>{
 const m=manifest();m[0].activeVersionId='new-version';
 assert.ok(audit(m).rows[0].deviations.includes('PUBLISHED_VERSION_DRIFT'));
});
test('07 · editor draft drift is also reported independently',()=>{
 const m=manifest();m[0].versionId='new';
 assert.ok(audit(m).rows[0].deviations.includes('DRAFT_VERSION_DRIFT'));
});
test('08 · stopped workflow not treated as same active deployment',()=>{
 const m=manifest();m[0].active=false;
 assert.ok(audit(m).rows[0].deviations.includes('WORKFLOW_ACTIVATION_CHANGED'));
});
test('09 · unexpected missing Google Sheets append node is detected',()=>{
 const m=manifest();m[0].nodeNames=['Read Products'];
 assert.ok(audit(m).rows[0].deviations.includes('REQUIRED_NODE_MISSING_OR_RENAMED'));
});
test('10 · cannot infer store security from name or node inventory',()=>{
 assert.equal(audit().noStoreAuthorityVerified,true);
 assert.equal(audit().canConnectV2,false);
});
test('11 · observed SQL legacy RPC remains tenant+SKU not Store',()=>{
 assert.equal(v.LEGACY_RPC.storeScoped,false);
 assert.equal(v.LEGACY_RPC.identity,'TENANT_SKU_ONLY');
 assert.equal(v.LEGACY_RPC.isDefiner,true);
 assert.equal(v.LEGACY_RPC.signature.length,7);
});
test('12 · even correctly classified legacy DEMO cannot be auto-called',()=>{
 const r=legacy();
 assert.equal(r.state,'DEMO_ONLY_COMPATIBILITY_CANDIDATE');
 assert.equal(r.canCallLegacyRpc,false);assert.equal(r.canWriteHosted,false);
});
test('13 · existing tenant-only writer cannot accept Store request',()=>{
 const r=v.assessLegacyProductCall({...{
 source:'SERVER_VERIFIED_LEGACY_ROUTE',channel:'AI_SALES_DEMO',
 operation:'write',tenantId:'11111111-1111-4111-8111-111111111111',
 storeId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 expectedVersion:'CURRENT_VERIFIED_LEGACY_VERSION',scopeCount:1}});
 assert.ok(r.blockers.includes('LEGACY_STORE_SCOPE_UNSUPPORTED'));
 assert.equal(r.eligibleForMultiStore,false);
});
test('14 · Commerce V2 cannot be routed to legacy DEMO',()=>{
 const r=v.assessLegacyProductCall({source:'SERVER_VERIFIED_LEGACY_ROUTE',
 channel:'COMMERCE_SAAS',operation:'write',tenantId:'t'.repeat(32),
 scopeCount:1,expectedVersion:'CURRENT_VERIFIED_LEGACY_VERSION'});
 assert.ok(r.blockers.includes('LEGACY_CHANNEL_MUST_REMAIN_DEMO'));
});
test('15 · fake client scope cannot authorize existing RPC',()=>{
 assert.ok(v.assessLegacyProductCall({}).blockers.includes('UNTRUSTED_ROUTE_SOURCE'));
});
test('16 · unknown tenant or multi-tenant legacy scope denied',()=>{
 assert.ok(v.assessLegacyProductCall({source:'SERVER_VERIFIED_LEGACY_ROUTE',
  channel:'AI_SALES_DEMO',operation:'write',tenantId:'tiny',scopeCount:2,
  expectedVersion:'CURRENT_VERIFIED_LEGACY_VERSION'}).blockers
  .includes('SINGLE_LEGACY_TENANT_SCOPE_NOT_PROVEN'));
});
test('17 · client-passed stock adjustment and store override denied',()=>{
 const r=v.assessLegacyProductCall({source:'SERVER_VERIFIED_LEGACY_ROUTE',
 channel:'AI_SALES_DEMO',operation:'write',
 tenantId:'11111111-1111-4111-8111-111111111111',
 scopeCount:1,expectedVersion:'CURRENT_VERIFIED_LEGACY_VERSION',
 requestFields:{stock_adjustment:-5,store_id:'spoof'}});
 assert.ok(r.blockers.includes('LEGACY_CLIENT_SCOPE_OR_STOCK_OVERRIDE'));
});
test('18 · writer switching needs real Auth, published parity and restore',()=>{
 const r=v.assessProductV2Bridge({legacy:v.LEGACY_RPC,
 storeV2:{scopedIdentity:'TENANT_STORE_SKU',cas:true,
 priceIntegerVnd:true,stockMetadataSeparated:true}});
 assert.ok(r.blockers.includes('REAL_STORE_AUTH_NOT_PROVEN'));
 assert.equal(r.canUpdateProducts,false);
});
test('19 · forged green flags cannot approve migration',()=>{
 const r=v.assessProductV2Bridge({legacy:v.LEGACY_RPC,
 storeV2:{scopedIdentity:'TENANT_STORE_SKU',cas:true,
 priceIntegerVnd:true,stockMetadataSeparated:true},
 authServer:{realJwtVerified:true,storeMembershipEnforced:true},
 qa:{sameTenantStoreIsolation:true,publishedCallerParity:true}});
 assert.equal(r.status,'MIGRATION_NOT_AUTHORIZED');
 assert.ok(r.blockers.includes('BACKUP_RESTORE_AND_OWNER_MAPPING_REQUIRED'));
});
test('20 · no method exposes publishing, granting or SQL execution',()=>{
 for(const x of ['writeProduct','callRpc','publishWorkflow','migrate','executeSql'])
  assert.equal(v[x],undefined);
});
