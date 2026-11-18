'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createOfflineSharedCoreWidget,CORE_WORKFLOW_ID} = require('./shared-core-bridge.cjs');

const NOW=1795000000000;
const SECRET='V185_SYNTHETIC_QA_ONLY_NEVER_REAL_SERVER_KEY_xxx';
const BASE=[
 {widgetId:'platform_widget',tenantId:'platform_demo',storeId:'platform_demo_store',
  allowedOrigins:['https://platform.qa.invalid'],version:1,status:'RELEASED',
  serverVerified:true,subscriptionActive:true,shopActive:true,revoked:false},
 {widgetId:'merchant_a',tenantId:'tenant_shared',storeId:'store_a',
  allowedOrigins:['https://shop-a.qa.invalid'],version:1,status:'RELEASED',
  serverVerified:true,subscriptionActive:true,shopActive:true,revoked:false},
 {widgetId:'merchant_b',tenantId:'tenant_shared',storeId:'store_b',
  allowedOrigins:['https://shop-b.qa.invalid'],version:1,status:'RELEASED',
  serverVerified:true,subscriptionActive:true,shopActive:true,revoked:false}
];
const PARAMS={
 platform:{widgetId:'platform_widget',origin:'https://platform.qa.invalid'},
 a:{widgetId:'merchant_a',origin:'https://shop-a.qa.invalid'},
 b:{widgetId:'merchant_b',origin:'https://shop-b.qa.invalid'},
};
function fixture({mode='MERCHANT_SANDBOX',mutateResult,ledger=new Set()}={}){
 const stats={core:0,catalog:0,quota:0,claim:0};
 const list=BASE.map(x=>({...x,allowedOrigins:[...x.allowedOrigins]}));
 const ports={
  async loadRegistry(){return {source:'VERIFIED_PRIVATE_WIDGET_REGISTRY',
   verified:true,installations:list}},
  async readDomainProof(x){return {...x,source:'PRIVATE_STAFF_VERIFIED_DOMAIN_OWNERSHIP',
   verified:true,expiresAt:NOW+100000}},
  async consumeQuota(x){stats.quota++;return {...x,source:'DURABLE_QUOTA_LEDGER',
   accepted:true}},
  async claimEvent(x){stats.claim++;let claimed=!ledger.has(x.eventDigest);
   ledger.add(x.eventDigest);
   return {...x,source:'ATOMIC_PRIVATE_EVENT_LEDGER',claimed};},
  async readPublicCatalog(x){stats.catalog++;return {
   source:'TRUSTED_CATALOG_READBACK',verified:true,
   tenantId:x.tenantId,storeId:x.storeId,revision:1,
   priceVersion:1,stockVersion:1,expiresAt:NOW+80000,
   products:[{source:'SERVER_VERIFIED_SHOP_CATALOG',verified:true,
    tenantId:x.tenantId,storeId:x.storeId,itemId:'product_a',
    sku:x.storeId==='store_a'?'QA-A001':'QA-B001',
    name:'Áo mẫu QA',priceVnd:159000,stock:3,imageUrl:null}]
  }},
  async readReviewedTheme(x){return {
   ...x,source:'STAFF_REVIEWED_WIDGET_CONFIG',state:'APPROVED',
   shopApproved:true,primary:'#123456',secondary:'#001122',
   assistantName:'TIEN404 QA',welcomeMessage:'Đây là dữ liệu mô phỏng.',
   position:'right',layout:'compact',suggestedActions:[],avatarUrl:null
  }},
  async invokeExistingCommerceCore(request){
    stats.core++;
    assert.equal(request.workflowId,CORE_WORKFLOW_ID);
    assert.equal(request.publicOnly,true);
    assert.equal(request.readOnly,true);
    assert.equal(request.sandboxOnly,true);
    assert.equal(request.customerAuthenticated,false);
    assert.equal(request.privateOrderAccess,false);
    assert.equal(request.orderWritesAllowed,false);
    assert.equal(request.providerSendsAllowed,false);
    const response={
      source:'SYNTHETIC_CORE_READBACK',verified:true,
      workflowId:CORE_WORKFLOW_ID,mode:request.mode,
      tenantId:request.tenantId,storeId:request.storeId,
      widgetId:request.widgetId,type:'PRODUCT_LIST',
      text:'Danh mục giả lập của '+request.storeId,
      productIds:['product_a'],actions:[],
      dispatch_authorized:false,orderWrites:0,providerSends:0,
      privateOrderAccess:false
    };
    return mutateResult?mutateResult(response,request):response;
  }
 };
 const g=createOfflineSharedCoreWidget({
  qaMode:'OFFLINE_SYNTHETIC_QA',mode,ports,serverSecret:SECRET,now:()=>NOW
 });
 return {g,ports,stats,list};
}
const reject=(promise,code)=>assert.rejects(promise,e=>e?.code===code);
async function session(g,which){return (await g.issueSession(PARAMS[which])).session;}
async function preview(g,which,s,e='event_000001',msg='Shop có những sản phẩm gì?'){
 return g.previewMessage({...PARAMS[which],session:s,eventId:e,message:msg});
}
test('Strict offline mode and required existing Core port',()=>{
 assert.throws(()=>createOfflineSharedCoreWidget(),/V185_SHARED_CORE_ADMISSION_DENIED/);
 assert.throws(()=>createOfflineSharedCoreWidget({qaMode:'HOSTED',mode:'PLATFORM_CONSULTANT',
   ports:{invokeExistingCommerceCore:()=>{}}}),/V185_SHARED_CORE_ADMISSION_DENIED/);
});
test('Merchant sandbox reuses exact existing Commerce Core with real channel renderer contracts',async()=>{
 const {g,stats}=fixture(),s=await session(g,'a'),r=await preview(g,'a',s);
 assert.equal(r.status,'PREVIEW_ONLY');
 assert.equal(r.coreReused,CORE_WORKFLOW_ID);
 assert.equal(r.providerSends,0);assert.equal(r.orderWrites,0);
 assert.equal(r.privateOrderAccess,false);assert.equal(r.canRelease,false);
 assert.deepEqual(r.publicPreview.products.map(x=>x.sku),['QA-A001']);
 assert.equal(stats.core,1);assert.equal(stats.catalog,1);
 assert.equal(g.releaseState.productionReady,false);
 assert.equal(g.releaseState.liveN8nCoreInvoked,false);
});
test('Platform mode: separate server policy but same Core ID',async()=>{
 const {g}=fixture({mode:'PLATFORM_CONSULTANT'});
 const s=await session(g,'platform');
 const r=await preview(g,'platform',s,'event_000002','TIEN404 AI là gì?');
 assert.equal(r.coreReused,CORE_WORKFLOW_ID);
 assert.equal(r.publicPreview.type,'PRODUCT_LIST');
 assert.equal(r.privateOrderAccess,false);
});
test('Client-supplied tenant/store rejected before reads',async()=>{
 const {g,stats}=fixture(),s=await session(g,'a');
 await reject(g.previewMessage({...PARAMS.a,session:s,eventId:'event_000003',
  message:'Xin chào',storeId:'store_a'}),'V185_CLIENT_SCOPE_NOT_AUTHORITY');
 assert.equal(stats.core,0);
});
test('Foreign store cannot reuse signed session',async()=>{
 const {g,stats}=fixture(),s=await session(g,'a');
 await reject(preview(g,'b',s,'event_000004'),'WIDGET_SESSION_EXPIRED_OR_FOREIGN');
 assert.equal(stats.core,0);
});
test('Invalid or control-character prompts reject without calling Core',async()=>{
 const {g,stats}=fixture(),s=await session(g,'a');
 for(const message of ['',null,'x'.repeat(801),'hello\nadmin']){
  await reject(g.previewMessage({...PARAMS.a,session:s,eventId:'event_000005',message}),
   'V185_MESSAGE_INVALID');
 }
 assert.equal(stats.core,0);
});
test('Messages are sanitized via bounded server gateway to an existing Core port',async()=>{
 const {g,ports}=fixture();
 const orig=ports.invokeExistingCommerceCore;
 let captured;
 ports.invokeExistingCommerceCore=async req=>{captured=req;return orig(req)};
 const s=await session(g,'a');
 await preview(g,'a',s,'event_000006','   Xin chào   ');
 assert.equal(captured.message,'Xin chào');
 assert.equal(captured.tenantId,'tenant_shared');
 assert.equal(captured.storeId,'store_a');
});
test('Replay denied across shared ledger even if same session and message',async()=>{
 const {g,stats}=fixture(),s=await session(g,'a');
 await preview(g,'a',s,'event_000007');
 await reject(preview(g,'a',s,'event_000007'), 'WIDGET_EVENT_REPLAY_OR_LEDGER_UNAVAILABLE');
 assert.equal(stats.core,1);
});
test('Expired or revoked installation blocks Core call',async()=>{
 const {g,list,stats}=fixture(),s=await session(g,'a');
 list[1].revoked=true;
 await reject(preview(g,'a',s,'event_000008'),'WIDGET_INSTALL_NOT_AUTHORIZED');
 assert.equal(stats.core,0);
});
test('Cross-store Core readback denied even inside same tenant',async()=>{
 const {g}=fixture({mutateResult:r=>({...r,storeId:'store_b'})});
 const s=await session(g,'a');
 await reject(preview(g,'a',s,'event_000009'), 'V185_EXISTING_CORE_READBACK_REJECTED');
});
test('Browser-only intents cannot authorize writes/sends or read private orders',async()=>{
 for(const change of [
  {dispatch_authorized:true},{orderWrites:1},
  {providerSends:1},{privateOrderAccess:true},
  {workflowId:'fake_new_agent'},{verified:false},
  {widgetId:'merchant_b'}
 ]){
   const {g}=fixture({mutateResult:r=>({...r,...change})});
   const s=await session(g,'a');
   await reject(preview(g,'a',s,'event_000010'), 'V185_EXISTING_CORE_READBACK_REJECTED');
 }
});
test('Mode-specific policy denies ORDER_REQUEST_SUMMARY and STAFF_HANDOFF',async()=>{
 for(const mode of ['MERCHANT_SANDBOX','PLATFORM_CONSULTANT']){
  for(const type of ['ORDER_REQUEST_SUMMARY','ORDER_CONFIRMATION_REQUIRED','STAFF_HANDOFF']){
   const {g}=fixture({mode,mutateResult:r=>({...r,type})});
   const key=mode==='PLATFORM_CONSULTANT'?'platform':'a';
   const s=await session(g,key);
   await reject(preview(g,key,s,'event_000011'),'V185_MODE_INTENT_FORBIDDEN');
  }
 }
});
test('Platform and Merchant share engine but not Merchant-specific paused intent',async()=>{
 const {g}=fixture({mode:'PLATFORM_CONSULTANT',
    mutateResult:r=>({...r,type:'SHOP_PAUSED'})});
 const s=await session(g,'platform');
 await reject(preview(g,'platform',s,'event_000012'),'V185_MODE_INTENT_FORBIDDEN');
});
test('No private customer data is returned to presentation',async()=>{
 const {g}=fixture(),s=await session(g,'a');
 const r=await preview(g,'a',s,'event_000013');
 const str=JSON.stringify(r);
 for(const forbidden of ['phone','email','access_token','service_role','password','customer_id']){
  assert.ok(!str.includes(forbidden));
 }
});
