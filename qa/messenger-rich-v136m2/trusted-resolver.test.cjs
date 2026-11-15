'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHmac}=require('node:crypto');
const {sign}=require('../messenger-rich-v136m/adapter.cjs');
const {processCandidate}=require('../messenger-rich-v136m1/integration.cjs');
const {createTrustedPorts,processV136M2}=require('./trusted-resolver.cjs');
const NOW=Date.parse('2026-11-15T10:00:00Z'),now=()=>NOW;
const appSecret='SYNTHETIC_META_APP_SECRET_ONLY_NNNNNNNNNNN';
const actionSecret='SYNTHETIC_ACTION_SECRET_ONLY_NNNNNNNNNNN';
const T='tenant-shared-qa',A='store-a',B='store-b';
const PAGE_A='100000000000001',PAGE_B='100000000000002';
const PSID_A='200000000000001',PSID_B='200000000000002';
const bindings={
 [PAGE_A]:{provider:'MESSENGER',page_id:PAGE_A,tenant_id:T,store_id:A,
   shop_slug:'shop-a',verified:true,enabled:true,status:'ACTIVE',
   web_origins:['https://shop.qa.example/'],image_origins:[]},
 [PAGE_B]:{provider:'MESSENGER',page_id:PAGE_B,tenant_id:T,store_id:B,
   shop_slug:'shop-b',verified:true,enabled:true,status:'ACTIVE',
   web_origins:['https://shop.qa.example/'],image_origins:[]}
};
const product=(store)=>({id:'fixture-'+store,tenant_id:T,store_id:store,
 sku:store===A?'SKU_A':'SKU_B',name:'Sản phẩm '+store,
 price_vnd:store===A?'159000':'219000',stock_on_hand:4,is_active:true});
function repo(overrides={}){
 return {
  findPageBindingRows:async({pageId})=>bindings[pageId]?[{...bindings[pageId]}]:[],
  findStoreRuntime:async({tenantId,storeId})=>({tenant_id:tenantId,store_id:storeId,
    active:true,bot_paused:false,entitlement:'MESSENGER_RICH_UI_CANDIDATE',
    expires_at:new Date(NOW+3600000).toISOString()}),
  findCatalogPolicy:async({tenantId,storeId})=>({tenant_id:tenantId,store_id:storeId,
    mode:'SYNTHETIC_QA_ONLY',store_column_verified:true,
    store_authorization_verified:true,read_only:true}),
  readStoreCatalog:async({storeId})=>[product(storeId)],
  ...overrides
 };
}
function event(page=PAGE_A,psid=PSID_A,body={message:{text:'Chào shop',mid:'mid-qa-001'}}){
 return {object:'page',entry:[{id:page,messaging:[{
  sender:{id:psid},recipient:{id:page},timestamp:NOW,...body
 }]}]};
}
function signed(page=PAGE_A,psid=PSID_A,store=A){
 const b={source:'SERVER_VERIFIED_MESSENGER_BINDING',verified:true,serverDerived:true,
   pageId:page,recipientPsid:psid,tenantId:T,storeId:store,
   shopSlug:'shop-a',webOrigins:['https://shop.qa.example'],imageOrigins:[]};
 return event(page,psid,{postback:{mid:'pb-qa-001',
  payload:sign({trusted:b,secret:actionSecret,action:'BROWSE_CATALOG',itemId:'NONE',now})}});
}
function pack(body,options={}){
 const rawBody=JSON.stringify(body);
 return {rawBody,signature:'sha256='+createHmac('sha256',appSecret).update(rawBody).digest('hex'),
   appSecret,actionSecret,siteOrigin:'https://shop.qa.example/',now,
   repository:repo(),mode:'SYNTHETIC_QA_ONLY',...options};
}
async function invoke(e=event(),overrides={}){return processV136M2(pack(e,overrides))}
const mustFail=async(fn,code)=>assert.rejects(fn,new RegExp(code));

test('Shop A and B in SAME tenant: each Page gets ONLY own catalog',async()=>{
 const a=await invoke(signed(PAGE_A,PSID_A,A));
 const b=await invoke(signed(PAGE_B,PSID_B,B));
 const card=x=>x.events[0].prepared.body.message.attachment.payload.elements[0];
 assert.match(card(a).title,/store-a/);
 assert.match(card(b).title,/store-b/);
 assert.doesNotMatch(card(a).title,/store-b/);
 assert.doesNotMatch(card(b).title,/store-a/);
 for(const x of [a,b]){assert.equal(x.sendEnabled,false);assert.equal(x.previewOnly,true);
  assert.equal(x.allowedOrderWrites,false);assert.equal(x.hostedReady,false)}
});
test('client-supplied tenant/store cannot override verified Page binding',async()=>{
 const e=signed();e.entry[0].tenant_id='other-tenant';
 e.entry[0].store_id=B;e.entry[0].messaging[0].store_id=B;
 const x=await invoke(e);
 assert.match(x.events[0].prepared.body.message.attachment.payload.elements[0].title,/store-a/);
});
test('unregistered page denied',async()=>{
 await mustFail(()=>invoke(event('100000000000009',PSID_A)),'PAGE_BINDING_NOT_UNIQUE');
});
test('duplicate page ownership denied',async()=>{
 await mustFail(()=>invoke(event(),{repository:repo({findPageBindingRows:async()=>[bindings[PAGE_A],bindings[PAGE_A]]})}),'PAGE_BINDING_NOT_UNIQUE');
});
test('unverified Page binding denied',async()=>{
 await mustFail(()=>invoke(event(),{repository:repo({findPageBindingRows:async()=>[{...bindings[PAGE_A],verified:false}]})}),'PAGE_BINDING_UNVERIFIED');
});
test('inactive channel denied',async()=>{
 await mustFail(()=>invoke(event(),{repository:repo({findPageBindingRows:async()=>[{...bindings[PAGE_A],status:'DISABLED'}]})}),'PAGE_BINDING_UNVERIFIED');
});
test('Page spoofing in server binding denied',async()=>{
 await mustFail(()=>invoke(event(),{repository:repo({findPageBindingRows:async()=>[bindings[PAGE_B]]})}),'PAGE_BINDING_UNVERIFIED');
});
test('PSID recipient swap denied by Meta envelope',async()=>{
 const e=event();e.entry[0].messaging[0].recipient.id=PAGE_B;
 await mustFail(()=>invoke(e),'META_SENDER_RECIPIENT_UNVERIFIED');
});
test('wrong HMAC fails before repository resolution',async()=>{
 const x=pack(event());x.signature='sha256='+'0'.repeat(64);
 await mustFail(()=>processV136M2(x),'META_SIGNATURE_INVALID');
});
test('cross-store catalog row rejected even within SAME tenant',async()=>{
 await mustFail(()=>invoke(signed(),{repository:repo({readStoreCatalog:async()=>[product(B)]})}),'CROSS_STORE_CATALOG_ROW_DENIED');
});
test('row with no store_id rejected (current staging schema)',async()=>{
 const bad=product(A);delete bad.store_id;
 await mustFail(()=>invoke(signed(),{repository:repo({readStoreCatalog:async()=>[bad]})}),'CROSS_STORE_CATALOG_ROW_DENIED');
});
test('RLS authorization proof missing must fail closed',async()=>{
 await mustFail(()=>invoke(signed(),{repository:repo({findCatalogPolicy:async()=>null})}),'CATALOG_STORE_RLS_PROOF_REQUIRED');
});
test('tenant-only catalog proof rejected in multi-store',async()=>{
 await mustFail(()=>invoke(signed(),{repository:repo({
  findCatalogPolicy:async()=>({tenant_id:T,store_id:A,mode:'SYNTHETIC_QA_ONLY',
   store_column_verified:false,store_authorization_verified:true,read_only:true})
 })}),'CATALOG_STORE_RLS_PROOF_REQUIRED');
});
test('hosted mode requires real-user JWT & same-tenant RLS QA proof',async()=>{
 await mustFail(()=>invoke(signed(),{mode:'HOSTED_STORE_RLS_VERIFIED',
  repository:repo({findCatalogPolicy:async()=>({tenant_id:T,store_id:A,
  mode:'HOSTED_STORE_RLS_VERIFIED',store_column_verified:true,
  store_authorization_verified:true,read_only:true})})}),'CATALOG_STORE_RLS_PROOF_REQUIRED');
});
test('disabled by default without explicit mode',()=>{
 assert.throws(()=>createTrustedPorts({repository:repo()}),/HOSTED_STORE_RLS_NOT_APPROVED/);
});
test('missing server repository rejected',()=>{
 assert.throws(()=>createTrustedPorts({mode:'SYNTHETIC_QA_ONLY'}),/TRUSTED_SERVER_REPOSITORY_REQUIRED/);
});
test('paused shop denies preview',async()=>{
 await mustFail(()=>invoke(event(),{repository:repo({
  findStoreRuntime:async()=>({tenant_id:T,store_id:A,active:true,bot_paused:true,
    entitlement:'MESSENGER_RICH_UI_CANDIDATE',expires_at:new Date(NOW+3600000).toISOString()})
 })}),'SHOP_DISABLED_OR_SUBSCRIPTION_UNVERIFIED');
});
test('expired shop subscription denies preview',async()=>{
 await mustFail(()=>invoke(event(),{repository:repo({
  findStoreRuntime:async()=>({tenant_id:T,store_id:A,active:true,bot_paused:false,
    entitlement:'MESSENGER_RICH_UI_CANDIDATE',expires_at:new Date(NOW-1000).toISOString()})
 })}),'SHOP_DISABLED_OR_SUBSCRIPTION_UNVERIFIED');
});
test('replay is DRY_RUN only, idempotent in memory, no external write',async()=>{
 const ports=createTrustedPorts({repository:repo(),mode:'SYNTHETIC_QA_ONLY'});
 const p=pack(event());delete p.repository;delete p.mode;
 const a=await processCandidate({...p,ports}),b=await processCandidate({...p,ports});
 assert.equal(a.events[0].status,'PREVIEW_CREATED');
 assert.equal(b.events[0].status,'DUPLICATE_SUPPRESSED');
 const proof=await ports.checkAndReserveEvent({tenantId:T,storeId:A,
  channel:'MESSENGER',replayKey:'a'.repeat(64),mode:'DRY_RUN'});
 assert.equal(proof.persistent,false);
 await mustFail(()=>ports.checkAndReserveEvent({tenantId:T,storeId:A,
  channel:'MESSENGER',replayKey:'b'.repeat(64),mode:'LIVE'}),'REPLAY_DRY_RUN_ONLY');
});
test('invalid VND rejects, does not coerce or guess',async()=>{
 await mustFail(()=>invoke(signed(),{repository:repo({
  readStoreCatalog:async()=>[{...product(A),price_vnd:'159.000đ'}]
 })}),'CATALOG_VND_INVALID');
});
test('wrong tenant catalog row denied',async()=>{
 await mustFail(()=>invoke(signed(),{repository:repo({
  readStoreCatalog:async()=>[{...product(A),tenant_id:'tenant-other'}]
 })}),'CROSS_STORE_CATALOG_ROW_DENIED');
});
test('no Meta sends or Webhook/Profile actions exist in proposed port',()=>{
 const p=createTrustedPorts({repository:repo(),mode:'SYNTHETIC_QA_ONLY'});
 assert.deepEqual(Object.keys(p).sort(),[
 'checkAndReserveEvent','readCatalog','readShopStatus','resolveBinding']);
});
