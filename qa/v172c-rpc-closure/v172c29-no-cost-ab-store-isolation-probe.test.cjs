'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createIsolatedStoreReadProbe,READ_SCOPE}=require('./v172c29-no-cost-ab-store-isolation-probe.cjs');
const sessions={
 A:{subjectRef:'owner-A',storeRef:'store-A',tenantRef:'tenant-demo'},
 B:{subjectRef:'owner-B',storeRef:'store-B',tenantRef:'tenant-demo'},
 C:{subjectRef:'owner-C',storeRef:'store-C',tenantRef:'tenant-other'}
};
function fixture(overrides={}){
 const calls=[];
 const deps={
  gate:async()=>({isolated:true,noSend:true,mode:'synthetic-only',allowHosted:false}),
  verifyActor:async token=>{
   calls.push(['auth',token]);
   const owner=sessions[token];return owner?{
     verified:true,active:true,sessionIdVerified:true,consentVerified:true,
     consentWithdrawn:false,subjectRef:owner.subjectRef,expiresAtMs:Date.now()+60000}:null;
  },
  resolveStoreOwner:async subject=>{
   calls.push(['authority',subject]);
   const owner=Object.values(sessions).find(x=>x.subjectRef===subject);
   return owner?{...owner,active:true,ownerVerified:true}:null;
  },
  loadCatalog:async ctx=>{
   calls.push(['catalog',ctx]);
   return [{tenantRef:ctx.tenantRef,storeRef:ctx.storeRef,sku:'SKU-SYNTHETIC'}];
  },
  ...overrides
 };
 return {run:createIsolatedStoreReadProbe(deps),calls};
}
const query=(opaqueSession,storeRef,extras={})=>({
 opaqueSession,storeRef,action:'read_catalog',scope:READ_SCOPE,...extras
});
test('QA_A sees only Store A synthetic scoped count',async()=>{
 const f=fixture();assert.deepEqual(await f.run(query('A2345678','store-A')),{allowed:false,reason:'DENY'});
 // The fixture deliberately has only synthetic opaque session handles A/B/C.
 const out=await f.run(query('AAAAAAAA','store-A'));
 assert.equal(out.allowed,false);
});
test('A and B proper Store read grants return counts, not records',async()=>{
 const f=fixture({verifyActor:async token=>({
  verified:true,active:true,sessionIdVerified:true,consentVerified:true,consentWithdrawn:false,
  subjectRef:token==='A-session'?'owner-A':'owner-B',expiresAtMs:Date.now()+60000
 })});
 const a=await f.run(query('A-session','store-A'));const b=await f.run(query('B-session','store-B'));
 assert.equal(a.allowed,true);assert.equal(b.allowed,true);
 assert.equal(a.count,1);assert.equal(b.count,1);assert.ok(!JSON.stringify(a).includes('SKU-'));
});
test('DENY actor A cross-reading Store B',async()=>{
 const f=fixture({verifyActor:async()=>({
  verified:true,active:true,sessionIdVerified:true,consentVerified:true,
  consentWithdrawn:false,subjectRef:'owner-A',expiresAtMs:Date.now()+60000
 })});const x=await f.run(query('A-session','store-B'));
 assert.equal(x.allowed,false);assert.equal(f.calls.filter(c=>c[0]==='catalog').length,0);
});
test('DENY cross-tenant Store C for owner A',async()=>{
 const f=fixture({verifyActor:async()=>({
  verified:true,active:true,sessionIdVerified:true,consentVerified:true,
  consentWithdrawn:false,subjectRef:'owner-A',expiresAtMs:Date.now()+60000
 })});assert.equal((await f.run(query('A-session','store-C'))).allowed,false);
});
for(const [name,actor] of [
 ['expired',{expiresAtMs:1}],
 ['inactive',{active:false}],
 ['not independently verified',{verified:false}],
 ['session absent',{sessionIdVerified:false}],
 ['no consent',{consentVerified:false}],
 ['withdrawn consent',{consentWithdrawn:true}],
 ['unknown expiry',{expiresAtMs:undefined}],
 ['invalid expiry',{expiresAtMs:NaN}]
])test('DENY '+name,async()=>{
 const a={verified:true,active:true,sessionIdVerified:true,consentVerified:true,
  consentWithdrawn:false,subjectRef:'owner-A',expiresAtMs:Date.now()+60000,...actor};
 const f=fixture({verifyActor:async()=>a});
 assert.equal((await f.run(query('A-session','store-A'))).allowed,false);
});
test('DENY forged tenant / owner metadata in request',async()=>{
 const f=fixture({verifyActor:async()=>({verified:true,active:true,sessionIdVerified:true,
  consentVerified:true,consentWithdrawn:false,subjectRef:'owner-A',
  expiresAtMs:Date.now()+60000})});
 const x=await f.run(query('A-session','store-B',{subjectRef:'owner-B',tenantRef:'tenant-demo',
  ownerVerified:true,consentVerified:true}));
 assert.equal(x.allowed,false);
});
test('DENY unauthorized write action and elevated scope before auth',async()=>{
 const f=fixture();assert.equal((await f.run(query('A-session','store-A',{action:'create_order'}))).allowed,false);
 assert.equal((await f.run(query('A-session','store-A',{scope:'order-write'}))).allowed,false);
 assert.equal(f.calls.length,0);
});
for(const [name,gate] of [
 ['disabled',{isolated:false,noSend:true,mode:'synthetic-only',allowHosted:false}],
 ['sending allowed',{isolated:true,noSend:false,mode:'synthetic-only',allowHosted:false}],
 ['hosted enabled',{isolated:true,noSend:true,mode:'synthetic-only',allowHosted:true}],
 ['not synthetic',{isolated:true,noSend:true,mode:'live',allowHosted:false}]
])test('DENY gate '+name,async()=>{
 const f=fixture({gate:async()=>gate});assert.equal((await f.run(query('A-session','store-A'))).allowed,false);
});
test('DENY cross-store rows even if downstream catalog adapter misroutes',async()=>{
 const f=fixture({verifyActor:async()=>({verified:true,active:true,sessionIdVerified:true,
  consentVerified:true,consentWithdrawn:false,subjectRef:'owner-A',
  expiresAtMs:Date.now()+60000}),
  loadCatalog:async()=>[{tenantRef:'tenant-demo',storeRef:'store-B',sku:'leak'}]});
 assert.equal((await f.run(query('A-session','store-A'))).allowed,false);
});
test('DENY failed adapters and missing dependencies',async()=>{
 const f=fixture({resolveStoreOwner:async()=>{throw Error('backend unavailable')}});
 assert.equal((await f.run(query('A-session','store-A'))).allowed,false);
 assert.throws(()=>createIsolatedStoreReadProbe({}),/TRUSTED_ADAPTERS_REQUIRED/);
});
