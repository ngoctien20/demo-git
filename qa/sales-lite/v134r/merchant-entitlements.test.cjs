'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createMerchantEntitlementService,PLAN_BY_CODE,FEATURE_KEYS}=require('./merchant-entitlements.cjs');
const NOW=Date.parse('2026-11-15T05:00:00Z'),future=new Date(NOW+86400000).toISOString();
const validSession={serverVerified:true,userId:'user-0001',expiresAt:future};
const membership={userId:'user-0001',tenantId:'tenant-A',storeId:'store-A',role:'owner',active:true};
function make({plan='SALES_LITE',session=validSession,memberships=[membership],
 subState='ACTIVE',subExpires=future,contractGranted=[],contractVerified=true,
 providerVerified=true,overrides={}}={}){
 const service=createMerchantEntitlementService({
  clock:()=>NOW,
  verifySession:async()=>session,
  listMemberships:async()=>memberships,
  readSubscription:async scope=>({source:'SERVER_VERIFIED_SUBSCRIPTION',verified:true,
    tenantId:scope.tenantId,storeId:scope.storeId,state:subState,planCode:plan,
    expiresAt:subExpires}),
  readEnterpriseContract:async scope=>({source:'SERVER_VERIFIED_ENTERPRISE_CONTRACT',
    verified:contractVerified,active:true,tenantId:scope.tenantId,storeId:scope.storeId,
    expiresAt:future,grantedFeatures:contractGranted}),
  readProviderCapability:async scope=>({source:'SERVER_VERIFIED_PROVIDER_CAPABILITY',
    ...scope,provider:'ZALO_OA',granted:providerVerified,ownerAuthorized:providerVerified}),
  ...overrides
 });return (feature,request={method:'GET'})=>service.evaluate({feature,request});
}
test('three distinct research plans with no fixed enterprise price',()=>{
 assert.deepEqual([...PLAN_BY_CODE.keys()],['SALES_LITE','SALES_PLUS','SALES_ENTERPRISE']);
 assert.equal(PLAN_BY_CODE.get('SALES_ENTERPRISE').price_vnd_hypothesis,null);
 assert.equal(PLAN_BY_CODE.get('SALES_PLUS').price_vnd_hypothesis,349000);
 assert.equal(PLAN_BY_CODE.get('SALES_LITE').price_vnd_hypothesis,199000);
});
test('all entitlements have known feature names',()=>{
 for(const plan of PLAN_BY_CODE.values())for(const f of [...plan.features,...plan.conditional_features])
   assert.ok(FEATURE_KEYS.has(f),f);
});
test('Lite can read customers and orders',async()=>{
 const check=make();for(const f of ['customers.read_shop','orders.read_shop']){
  assert.equal((await check(f)).allowed,true);
 }
});
test('Lite can request customer and order management; implementation remains disabled',async()=>{
 const check=make();for(const f of ['customers.manage_shop','orders.manage_shop']){
  const r=await check(f);assert.equal(r.allowed,true);
  assert.equal(r.writesEnabled,false);assert.equal(r.providerSendingEnabled,false);
 }
});
test('Product editing is not auto-granted until package policy and write gate approved',async()=>{
 const r=await make()('products.manage_shop');assert.equal(r.reason,'FEATURE_NOT_INCLUDED');
});
test('Lite blocked from bot customization',async()=>assert.equal((await make()('bot.customize')).reason,'FEATURE_NOT_INCLUDED'));
test('Lite blocked from Menu Designer',async()=>assert.equal((await make()('menu.customize')).reason,'FEATURE_NOT_INCLUDED'));
test('Lite blocked from advanced reports',async()=>assert.equal((await make()('reports.advanced')).reason,'FEATURE_NOT_INCLUDED'));
test('Lite blocked from multi-store',async()=>assert.equal((await make()('multi_store.manage')).reason,'FEATURE_NOT_INCLUDED'));
test('Lite blocked from Zalo OA enterprise integration',async()=>assert.equal((await make()('zalo_oa.integration')).reason,'FEATURE_NOT_INCLUDED'));
test('Plus inherits Lite customer/order rights',async()=>{
 const check=make({plan:'SALES_PLUS'});
 for(const f of ['customers.read_shop','customers.manage_shop','orders.read_shop','orders.manage_shop']){
  assert.equal((await check(f)).allowed,true);
 }
});
test('Plus customization is only DRAFT, no provider publish',async()=>{
 const check=make({plan:'SALES_PLUS'});
 for(const f of ['menu.customize','bot.customize']){
  const r=await check(f);
  assert.equal(r.allowed,true);assert.equal(r.designMode,'DRAFT_ONLY');
  assert.equal(r.providerSendingEnabled,false);assert.equal(r.writesEnabled,false);
 }
});
test('Plus cannot access enterprise multi-store',async()=>assert.equal((await make({plan:'SALES_PLUS'})('multi_store.manage')).reason,'FEATURE_NOT_INCLUDED'));
test('Plus cannot access Enterprise Zalo OA',async()=>assert.equal((await make({plan:'SALES_PLUS'})('zalo_oa.integration')).reason,'FEATURE_NOT_INCLUDED'));
test('Enterprise inherits Lite/Plus baseline',async()=>{
 const check=make({plan:'SALES_ENTERPRISE'});
 for(const f of ['orders.manage_shop','customers.read_shop','menu.customize'])assert.equal((await check(f)).allowed,true);
});
test('Enterprise conditional rights require contract',async()=>{
 const r=await make({plan:'SALES_ENTERPRISE'})('team.manage');
 assert.equal(r.reason,'CONTRACT_NOT_GRANTED');
});
test('Enterprise multi-store granted only via verified contract',async()=>{
 const check=make({plan:'SALES_ENTERPRISE',contractGranted:['multi_store.manage']});
 assert.equal((await check('multi_store.manage')).allowed,true);
 assert.equal((await check('team.manage')).allowed,false);
});
test('unverified Enterprise contract cannot grant feature',async()=>{
 const r=await make({plan:'SALES_ENTERPRISE',contractGranted:['multi_store.manage'],contractVerified:false})('multi_store.manage');
 assert.equal(r.reason,'CONTRACT_NOT_GRANTED');
});
test('Zalo OA requires contract AND verified provider capability',async()=>{
 const contractGranted=['zalo_oa.integration'];
 const a=await make({plan:'SALES_ENTERPRISE',contractGranted,providerVerified:false})('zalo_oa.integration');
 assert.equal(a.reason,'PROVIDER_CAPABILITY_UNVERIFIED');
 const b=await make({plan:'SALES_ENTERPRISE',contractGranted,providerVerified:true})('zalo_oa.integration');
 assert.equal(b.allowed,true);assert.equal(b.providerSendingEnabled,false);
});
test('Zalo OA cannot grant if provider backend port missing',async()=>{
 const r=await make({plan:'SALES_ENTERPRISE',contractGranted:['zalo_oa.integration'],
 overrides:{readProviderCapability:null}})('zalo_oa.integration');
 assert.equal(r.reason,'PROVIDER_PORT_MISSING');
});
test('nonmember rejected',async()=>assert.equal((await make({memberships:[]})('orders.read_shop')).reason,'MEMBERSHIP_DENIED'));
test('revoked membership rejected',async()=>assert.equal((await make({memberships:[{...membership,active:false}]})('orders.read_shop')).reason,'MEMBERSHIP_DENIED'));
test('membership of another user rejected',async()=>assert.equal((await make({memberships:[{...membership,userId:'user-0002'}]})('orders.read_shop')).reason,'MEMBERSHIP_DENIED'));
test('session expires rejected',async()=>assert.equal((await make({session:{...validSession,expiresAt:new Date(NOW-1).toISOString()}})('orders.read_shop')).reason,'UNAUTHENTICATED'));
test('forged role and tenant from query ignored',async()=>{
 const r=await make()('orders.read_shop',{role:'admin',tenant_id:'tenant-B',store_id:'store-B',plan:'SALES_ENTERPRISE'});
 assert.equal(r.allowed,true);assert.equal(r.tenantId,'tenant-A');assert.equal(r.storeId,'store-A');assert.equal(r.planCode,'SALES_LITE');
});
test('multi-shop requires verified server selection',async()=>{
 const second={...membership,tenantId:'tenant-B',storeId:'store-B'};
 const r=await make({memberships:[membership,second]})('orders.read_shop');
 assert.equal(r.reason,'SERVER_SHOP_SELECTION_REQUIRED');
});
test('invalid stale server shop selection rejected',async()=>{
 const s={...validSession,selectedTenantId:'tenant-B',selectedStoreId:'store-B'};
 const r=await make({session:s})('orders.read_shop');
 assert.equal(r.reason,'SERVER_SHOP_SELECTION_REQUIRED');
});
test('verified server selection only grants selected shop',async()=>{
 const second={...membership,tenantId:'tenant-B',storeId:'store-B'};
 const s={...validSession,selectedTenantId:'tenant-B',selectedStoreId:'store-B'};
 const r=await make({session:s,memberships:[membership,second]})('orders.read_shop');
 assert.equal(r.allowed,true);assert.equal(r.tenantId,'tenant-B');assert.equal(r.storeId,'store-B');
});
test('expired subscription rejected even if ACTIVE',async()=>{
 const r=await make({subExpires:new Date(NOW-1).toISOString()})('orders.read_shop');assert.equal(r.reason,'SUBSCRIPTION_INACTIVE');
});
test('unknown subscription status rejected',async()=>{
 const r=await make({subState:'UNKNOWN'})('orders.read_shop');assert.equal(r.reason,'SUBSCRIPTION_INACTIVE');
});
test('unknown plan rejected',async()=>assert.equal((await make({plan:'SALES_FAKE'})('orders.read_shop')).reason,'PLAN_UNKNOWN'));
test('readback cross-tenant subscription rejected',async()=>{
 const r=await make({overrides:{readSubscription:async()=>({
  source:'SERVER_VERIFIED_SUBSCRIPTION',verified:true,tenantId:'tenant-B',storeId:'store-B',
  planCode:'SALES_ENTERPRISE',state:'ACTIVE',expiresAt:future})}})('orders.read_shop');
 assert.equal(r.reason,'SUBSCRIPTION_UNVERIFIED');
});
test('cross-shop Enterprise contract rejected',async()=>{
 const r=await make({plan:'SALES_ENTERPRISE',overrides:{readEnterpriseContract:async()=>({
  source:'SERVER_VERIFIED_ENTERPRISE_CONTRACT',verified:true,active:true,
  tenantId:'tenant-B',storeId:'store-B',expiresAt:future,grantedFeatures:['multi_store.manage']})}})('multi_store.manage');
 assert.equal(r.reason,'CONTRACT_NOT_GRANTED');
});
test('cross-shop provider capability rejected',async()=>{
 const r=await make({plan:'SALES_ENTERPRISE',contractGranted:['zalo_oa.integration'],
 overrides:{readProviderCapability:async()=>({
 source:'SERVER_VERIFIED_PROVIDER_CAPABILITY',tenantId:'tenant-B',storeId:'store-B',
 provider:'ZALO_OA',granted:true,ownerAuthorized:true})}})('zalo_oa.integration');
 assert.equal(r.reason,'PROVIDER_CAPABILITY_UNVERIFIED');
});
test('unknown feature never granted',async()=>assert.equal((await make()('admin.all')).reason,'UNKNOWN_FEATURE'));
test('backend failures fail closed without leaking details',async()=>{
 const r=await make({overrides:{verifySession:async()=>{throw Error('secret: test');}}})('orders.read_shop');
 assert.deepEqual(Object.keys(r).sort(),['allowed','billingEnabled','providerSendingEnabled','reason','stage','writesEnabled'].sort());
 assert.equal(r.reason,'BACKEND_UNAVAILABLE');
});
test('missing server ports throw before any operation',()=>{
 assert.throws(()=>createMerchantEntitlementService(),/SERVER_PORT_REQUIRED/);
});

test('legacy Plus code is normalized ONLY after backend subscription verification',async()=>{
 const r=await make({plan:'SALES_LITE_PLUS'})('menu.customize');
 assert.equal(r.allowed,true);assert.equal(r.planCode,'SALES_PLUS');
 assert.equal(r.designMode,'DRAFT_ONLY');
});
