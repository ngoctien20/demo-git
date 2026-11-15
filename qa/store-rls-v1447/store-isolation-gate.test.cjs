'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {TABLES,BLOCKERS,canReadSynthetic,assessReleasePreflight}=require('./store-isolation-gate.cjs');
// Everything in this test is synthetic. These actors are NOT real Supabase Auth users.
const actors=Object.freeze({
 A:{userId:'qa-actor-a',active:true,verifiedBy:'SYNTHETIC_AUTH_SERVER'},
 B:{userId:'qa-actor-b',active:true,verifiedBy:'SYNTHETIC_AUTH_SERVER'},
 C:{userId:'qa-actor-c',active:true,verifiedBy:'SYNTHETIC_AUTH_SERVER'},
 R:{userId:'qa-revoked',active:true,verifiedBy:'SYNTHETIC_AUTH_SERVER'}
});
const stores=Object.freeze([
 {storeId:'qa-store-a',tenantId:'qa-tenant-same',sku:'DUP-SKU',price:10000},
 {storeId:'qa-store-b',tenantId:'qa-tenant-same',sku:'DUP-SKU',price:24000},
 {storeId:'qa-store-c',tenantId:'qa-tenant-other',sku:'DUP-SKU',price:7000}
]);
const memberships=Object.freeze([
 {source:'SYNTHETIC_STORE_REGISTRY',userId:actors.A.userId,storeId:stores[0].storeId,tenantId:stores[0].tenantId,active:true,role:'owner',storeActive:true,tenantActive:true,subscriptionActive:true},
 {source:'SYNTHETIC_STORE_REGISTRY',userId:actors.B.userId,storeId:stores[1].storeId,tenantId:stores[1].tenantId,active:true,role:'manager',storeActive:true,tenantActive:true,subscriptionActive:true},
 {source:'SYNTHETIC_STORE_REGISTRY',userId:actors.C.userId,storeId:stores[2].storeId,tenantId:stores[2].tenantId,active:true,role:'owner',storeActive:true,tenantActive:true,subscriptionActive:true},
 {source:'SYNTHETIC_STORE_REGISTRY',userId:actors.R.userId,storeId:stores[0].storeId,tenantId:stores[0].tenantId,active:false,role:'owner',storeActive:true,tenantActive:true,subscriptionActive:true}
]);
const request=(actor,row,grants=memberships)=>canReadSynthetic({identity:actor,row,memberships:grants});
test('01: core table registry covers all six Commerce tables exactly once',()=>{
 assert.equal(TABLES.length,6);assert.equal(new Set(TABLES).size,6);
});
test('02: 72 synthetic actor/store/table combinations enforce same-tenant and cross-tenant isolation',()=>{
 let positive=0,negative=0;
 for(const table of TABLES){
  for(const [actorName,actor] of Object.entries(actors)){
   for(let i=0;i<3;i++){
    const row={table,tenantId:stores[i].tenantId,storeId:stores[i].storeId,sku:stores[i].sku};
    const expected=actorName!=='R'&&actorName===['A','B','C'][i];
    assert.equal(request(actor,row),expected,table+'/'+actorName+'/'+row.storeId);
    if(expected)positive++;else negative++;
   }
  }
 }
 assert.deepEqual({positive,negative,total:positive+negative},{positive:18,negative:54,total:72});
});
test('03: same SKU in two Stores in ONE tenant never grants cross-Store read',()=>{
 assert.equal(stores[0].sku,stores[1].sku);
 assert.equal(stores[0].tenantId,stores[1].tenantId);
 assert.notEqual(stores[0].price,stores[1].price);
 assert.equal(request(actors.A,stores[1]),false);
 assert.equal(request(actors.B,stores[0]),false);
});
test('04: revoked membership and anonymous identity fail closed',()=>{
 assert.equal(request(actors.R,stores[0]),false);
 assert.equal(request(null,stores[0]),false);
 assert.equal(request({userId:actors.A.userId,active:true},stores[0]),false);
 assert.equal(request({...actors.A,active:false},stores[0]),false);
});
test('05: tenant/store mismatch rejects even with matching user and active membership',()=>{
 assert.equal(request(actors.A,{tenantId:'qa-tenant-other',storeId:'qa-store-a'}),false);
 assert.equal(request(actors.A,{tenantId:'qa-tenant-same',storeId:'qa-store-b'}),false);
});
test('06: inactive subscription/store/tenant and viewer permissions reject',()=>{
 for(const k of ['storeActive','tenantActive','subscriptionActive','active']){
  const changes=memberships.map(x=>x.userId===actors.A.userId?{...x,[k]:false}:x);
  assert.equal(request(actors.A,stores[0],changes),false,k);
 }
 const viewer=memberships.map(x=>x.userId===actors.A.userId?{...x,role:'viewer'}:x);
 assert.equal(request(actors.A,stores[0],viewer),false);
});
test('07: forged unverified identity, source or alternate role cannot grant a row',()=>{
 assert.equal(request({...actors.A,verifiedBy:'CLIENT_ASSERTION'},stores[0]),false);
 assert.equal(request(actors.A,stores[0],[{...memberships[0],source:'UNTRUSTED_CLIENT'}]),false);
 assert.equal(request(actors.A,stores[0],[{...memberships[0],role:'super_admin'}]),false);
});
const baseline={
 fullArchiveRestoreAndRollbackVerified:false, // Actual operator has only schema-only restore
 fourRowsIndividuallyAttestedAndReviewed:false,
 storesExist:false,storeMembershipsExist:false,
 coreTables:TABLES.map(name=>({name,storeId:false,rls:true,forceRls:true,permissiveTenantReadPolicies:1,storeScopedReadPolicyReviewed:false})),
 storeAwareProductV2Reviewed:false,legacyWriterCallersReviewed:false,
 realDistinctSignedJwtAcceptance:false,separateMigrationApproval:false
};
test('08: actual read-only hosted preflight metadata categorically BLOCKS release',()=>{
 const res=assessReleasePreflight(baseline);
 assert.equal(res.status,'BLOCKED');
 assert.deepEqual(res.blockers,Object.values(BLOCKERS));
 assert.equal(res.canRunHostedMigration,false);
 assert.equal(res.canWriteHostedData,false);
});
test('09: schema-only restore and green synthetic QA never unlock the hosted gate',()=>{
 const s={...baseline,fullArchiveRestoreAndRollbackVerified:false,realDistinctSignedJwtAcceptance:false};
 assert.ok(assessReleasePreflight(s).blockers.includes(BLOCKERS.FULL_RESTORE));
 assert.ok(assessReleasePreflight(s).blockers.includes(BLOCKERS.JWT));
});
test('10: even a fully populated claimed snapshot can only be independently reviewed',()=>{
 const s={...baseline,fullArchiveRestoreAndRollbackVerified:true,fourRowsIndividuallyAttestedAndReviewed:true,
  storesExist:true,storeMembershipsExist:true,storeAwareProductV2Reviewed:true,
  legacyWriterCallersReviewed:true,realDistinctSignedJwtAcceptance:true,separateMigrationApproval:true,
  coreTables:TABLES.map(name=>({name,storeId:true,rls:true,forceRls:true,permissiveTenantReadPolicies:0,storeScopedReadPolicyReviewed:true}))};
 const r=assessReleasePreflight(s);
 assert.equal(r.status,'READY_FOR_INDEPENDENT_REVIEW_ONLY');
 assert.deepEqual(r.blockers,[]);
 assert.equal(r.canRunHostedMigration,false);
 assert.equal(r.canWriteHostedData,false);
});
test('11: missing metadata / extra permissive policy cannot turn green',()=>{
 assert.equal(assessReleasePreflight(null).status,'BLOCKED');
 const tampered={...baseline,coreTables:TABLES.map(name=>({name,storeId:true,rls:true,forceRls:true,permissiveTenantReadPolicies:1,storeScopedReadPolicyReviewed:true}))};
 assert.ok(assessReleasePreflight(tampered).blockers.includes(BLOCKERS.LEGACY_POLICIES));
});
