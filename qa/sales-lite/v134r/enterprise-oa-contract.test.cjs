'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createEnterpriseOAReadiness}=require('./enterprise-oa-contract.cjs');
const grant={allowed:true,reason:'ENTITLEMENT_VERIFIED',planCode:'SALES_ENTERPRISE',
 tenantId:'tenant-A',storeId:'store-A',providerSendingEnabled:false,writesEnabled:false};
const binding={source:'SERVER_VERIFIED_OA_BINDING',verified:true,tenantId:'tenant-A',
 storeId:'store-A',provider:'ZALO_OA',ownerAuthorizationVerified:true,oaId:'oa-00001'};
function build(extra={}){
 const svc=createEnterpriseOAReadiness({
  checkEntitlement:async()=>grant,readOABinding:async()=>binding,...extra
 });return svc.inspect({});
}
test('verified enterprise OA readiness reveals NO token or send',async()=>{
 const r=await build();assert.equal(r.status,'READ_ONLY_CONNECTION_READINESS');
 assert.equal(r.connected,false);assert.equal(r.externalSends,0);assert.equal(r.tokenRead,false);
 assert.equal(JSON.stringify(r).includes('tokenSecret'),false);
});
test('Lite and Plus cannot authorize Enterprise OA',async()=>{
 for(const code of ['SALES_LITE','SALES_PLUS']){
  const r=await build({checkEntitlement:async()=>({...grant,planCode:code})});
  assert.equal(r.status,'BLOCKED');assert.equal(r.reason,'ENTITLEMENT_NOT_VERIFIED');
 }
});
test('No verified OAuth owner consent -> block',async()=>{
 const r=await build({readOABinding:async()=>({...binding,ownerAuthorizationVerified:false})});
 assert.equal(r.reason,'OA_OWNERSHIP_UNVERIFIED');
});
test('Cross shop OA binding -> block',async()=>{
 const r=await build({readOABinding:async()=>({...binding,storeId:'store-B'})});
 assert.equal(r.reason,'OA_OWNERSHIP_UNVERIFIED');
});
test('Zalo Bot cannot impersonate Zalo OA',async()=>{
 const r=await build({readOABinding:async()=>({...binding,provider:'ZALO_BOT'})});
 assert.equal(r.reason,'OA_OWNERSHIP_UNVERIFIED');
});
test('Enterprise OA API status UNKNOWN must not enable outbound',async()=>{
 const r=await build();assert.equal(r.supportedCapabilities,'PROVIDER_SCOPE_AUDIT_REQUIRED');
 assert.equal(r.productionReady,false);
});
test('backend failure cannot leak sensitive details',async()=>{
 const r=await build({readOABinding:async()=>{throw Error('token-forbidden-secret')}});
 assert.equal(r.reason,'BACKEND_UNAVAILABLE');
 assert.equal(JSON.stringify(r).includes('token-forbidden-secret'),false);
});
test('missing trusted backend ports fails closed',()=>assert.throws(()=>createEnterpriseOAReadiness(),/BACKEND_PORT_REQUIRED/));
