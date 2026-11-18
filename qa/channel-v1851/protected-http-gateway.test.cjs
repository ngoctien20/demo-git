'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createProtectedOfflineGateway,BODY_LIMIT,ROUTES}=require('./protected-http-gateway.cjs');
const {CORE_WORKFLOW_ID}=require('../channel-v185/shared-core-bridge.cjs');

const NOW=1795000000000;
const SECRET='V1851_OFFLINE_KEY_EXCLUSIVELY_FOR_SYNTHETIC_TESTS_1234567';
const HOST='https://qa-widget-gateway.example.invalid';
const PLATFORM='https://platform.qa.invalid';
const SHOP_A='https://shop-a.qa.invalid';
const SHOP_B='https://shop-b.qa.invalid';
const installs=[
 {widgetId:'widget_platform',tenantId:'platform_sandbox',storeId:'demo_store',allowedOrigins:[PLATFORM],version:1,
  status:'RELEASED',serverVerified:true,subscriptionActive:true,shopActive:true,revoked:false},
 {widgetId:'widget_a',tenantId:'tenant_a',storeId:'store_a',allowedOrigins:[SHOP_A],version:1,
  status:'RELEASED',serverVerified:true,subscriptionActive:true,shopActive:true,revoked:false},
 {widgetId:'widget_b',tenantId:'tenant_a',storeId:'store_b',allowedOrigins:[SHOP_B],version:1,
  status:'RELEASED',serverVerified:true,subscriptionActive:true,shopActive:true,revoked:false}
];
const accessVerified=()=>({
 source:'MOCK_TRUSTED_CRYPTOGRAPHICALLY_VERIFIED_QA_ACCESS',
 verified:true,issuerVerified:true,audienceVerified:true,
 sessionUnexpired:true,permitted:true,scope:'V1851_PRIVATE_STAGING'
});
function setup({mode='PLATFORM_CONSULTANT',operator=accessVerified,
                 changePorts={},ledger=new Set(),timeoutMs=3500}={}){
 const copy=installs.map(i=>({...i,allowedOrigins:[...i.allowedOrigins]}));
 const calls={operator:0,registry:0,claim:0,quota:0,core:0,catalog:0,theme:0};
 const ports={
  async loadRegistry(){calls.registry++;return {
   source:'VERIFIED_PRIVATE_WIDGET_REGISTRY',verified:true,installations:copy
  }},
  async readDomainProof(scope){return {
   ...scope,source:'PRIVATE_STAFF_VERIFIED_DOMAIN_OWNERSHIP',verified:true,
   expiresAt:NOW+100000
  }},
  async consumeQuota(scope){calls.quota++;return {
   ...scope,source:'DURABLE_QUOTA_LEDGER',accepted:true
  }},
  async claimEvent(scope){calls.claim++;const claimed=!ledger.has(scope.eventDigest);
   ledger.add(scope.eventDigest);return {
    ...scope,source:'ATOMIC_PRIVATE_EVENT_LEDGER',claimed
   };
  },
  async readPublicCatalog(scope){calls.catalog++;return {
   source:'TRUSTED_CATALOG_READBACK',verified:true,
   tenantId:scope.tenantId,storeId:scope.storeId,
   revision:1,priceVersion:1,stockVersion:1,expiresAt:NOW+100000,
   products:[{
    source:'SERVER_VERIFIED_SHOP_CATALOG',verified:true,
    tenantId:scope.tenantId,storeId:scope.storeId,itemId:'qa_product_1',
    sku:'QA-001',name:'Mặt hàng QA mô phỏng',priceVnd:159000,stock:3,imageUrl:null
   }]
  }},
  async readReviewedTheme(scope){calls.theme++;return {
   ...scope,source:'STAFF_REVIEWED_WIDGET_CONFIG',state:'APPROVED',
   shopApproved:true,primary:'#223344',secondary:'#334455',
   assistantName:'TIEN404 QA',welcomeMessage:'Xin chào QA',
   position:'right',layout:'compact',suggestedActions:[],avatarUrl:null
  }},
  async invokeExistingCommerceCore(scope){calls.core++;
   assert.equal(scope.workflowId,CORE_WORKFLOW_ID);
   assert.equal(scope.readOnly,true);
   assert.equal(scope.publicOnly,true);
   assert.equal(scope.orderWritesAllowed,false);
   assert.equal(scope.providerSendsAllowed,false);
   assert.equal(scope.privateOrderAccess,false);
   return {
    source:'SYNTHETIC_CORE_READBACK',verified:true,workflowId:CORE_WORKFLOW_ID,
    mode:scope.mode,tenantId:scope.tenantId,storeId:scope.storeId,
    widgetId:scope.widgetId,type:'PRODUCT_CARD',
    text:'Đây là dữ liệu mô phỏng QA. Không có đơn hàng thật.',
    productIds:['qa_product_1'],actions:[],
    privateOrderAccess:false,providerSends:0,orderWrites:0,
    dispatch_authorized:false,otherPrivateField:'NEVER_EXPOSE_THIS'
   }
  }
 };
 Object.assign(ports,changePorts);
 const gateway=createProtectedOfflineGateway({
   qaMode:'OFFLINE_SYNTHETIC_QA',mode,
   gatewayOrigin:HOST,allowedBrowserOrigins:[PLATFORM,SHOP_A,SHOP_B],
   verifyQaOperator:async request=>{calls.operator++;return operator(request)},
   ports,serverSecret:SECRET,now:()=>NOW,timeoutMs
 });
 return {gateway,ports,copy,calls,ledger};
}
function makeRequest({type='session',origin=PLATFORM,data,method='POST',headers={},url,rawBody}={}){
 const path=type==='message'?ROUTES.message:ROUTES.session;
 const widgetId=origin===PLATFORM?'widget_platform':origin===SHOP_A?'widget_a':'widget_b';
 const fields=type==='session'?{widgetId,origin}:
  {widgetId,origin,session:'INVALID_TEST_SESSION',eventId:'event_00001',
   message:'Tư vấn sản phẩm'};
 const body=rawBody===undefined?JSON.stringify(data??fields):rawBody;
 return new Request(url??HOST+path,{
  method,headers:{'Origin':origin,'Content-Type':'application/json',...headers},
  ...(method==='POST'?{body}:{}),
 });
}
const get=async p=>{const r=await p;let body;try{body=await r.json()}catch{body=null}
 return {status:r.status,headers:r.headers,body};};
const open=async(s,origin=PLATFORM)=>get(s.gateway.handle(makeRequest({origin})));
async function message(s,session,origin=PLATFORM,eventId='event_00001',more={}){
 const widgetId=origin===PLATFORM?'widget_platform':origin===SHOP_A?'widget_a':'widget_b';
 return get(s.gateway.handle(makeRequest({
  type:'message',origin,data:{widgetId,origin,session,eventId,message:'Tư vấn sản phẩm',...more}
 })));
}
test('Gateway cannot be created as hosted or with missing security ports',()=>{
 assert.throws(()=>createProtectedOfflineGateway(),/REQUEST_REJECTED/);
 assert.throws(()=>createProtectedOfflineGateway({
  qaMode:'HOSTED',mode:'PLATFORM_CONSULTANT',
  gatewayOrigin:HOST,allowedBrowserOrigins:[PLATFORM],
  verifyQaOperator:()=>accessVerified(),ports:{},serverSecret:SECRET
 }),/REQUEST_REJECTED/);
 const s=setup();assert.equal(s.gateway.releaseState.productionReady,false);
 assert.equal(s.gateway.releaseState.cloudflareWorkerDeployed,false);
 assert.equal(s.gateway.releaseState.realCommerceCoreInvoked,false);
});
test('Private QA Access port is always called before private registry and session',async()=>{
 const s=setup(),r=await open(s);
 assert.equal(r.status,200);assert.equal(s.calls.operator,1);
 assert.equal(s.calls.registry,1);assert.equal(r.body.mode,'PLATFORM_CONSULTANT');
 assert.equal(r.body.previewOnly,true);
 assert.equal(r.body.privateOrderAccess,false);
 assert.equal(r.body.providerSends,0);assert.equal(r.body.orderWrites,0);
 assert.match(r.body.session,/^T404W1\./);
 assert.equal(r.headers.get('cache-control'),'no-store, max-age=0');
 assert.equal(r.headers.get('access-control-allow-origin'),PLATFORM);
 assert.equal(r.headers.get('access-control-allow-credentials'),null);
});
test('Protected POST with signed QA session reaches ONLY mocked existing Commerce Core',async()=>{
 const s=setup();const session=(await open(s)).body.session;
 const reply=await message(s,session);
 assert.equal(reply.status,200);assert.equal(s.calls.core,1);
 assert.deepEqual(reply.body.publicPreview.products.map(p=>p.priceVnd),[159000]);
 assert.equal(reply.body.status,'PREVIEW_ONLY');
 assert.equal(reply.body.mode,'PLATFORM_CONSULTANT');
 const output=JSON.stringify(reply.body);
 for(const privateWord of ['tenant_a','store_a','store_b','otherPrivateField',
    'NEVER_EXPOSE_THIS','session','access_token','customer_id']){
   assert.ok(!output.includes(privateWord),privateWord);
 }
 assert.equal(s.calls.claim,1);
});
test('No POST admitted without independent Access issuer/audience/expiry/permission checks',async()=>{
 for(const patch of [{verified:false},{issuerVerified:false},
   {audienceVerified:false},{sessionUnexpired:false},{permitted:false},
   {scope:'WRONG_SCOPE'},{source:'CLIENT_ASSERTED_ACCESS'}]){
  const s=setup({operator:()=>({...accessVerified(),...patch})});
  const r=await open(s);
  assert.equal(r.status,403);
  assert.equal(s.calls.registry,0);assert.equal(s.calls.core,0);
 }
});
test('Access port errors do not reveal raw token, hostname or credentials',async()=>{
 const s=setup({operator:()=>{throw Error('SECRET_TOKEN_PRIVATE_AUTH_123')}});
 const r=await open(s);
 assert.notEqual(r.status,200);
 assert.doesNotMatch(JSON.stringify(r.body),/SECRET_TOKEN_PRIVATE/);
 assert.equal(s.calls.registry,0);
});
test('Forged Authorization header is denied before Access port invocation',async()=>{
 const s=setup();
 const r=await get(s.gateway.handle(makeRequest({
  headers:{Authorization:'Bearer forged-private-token'}
 })));
 assert.equal(r.status,403);assert.equal(s.calls.operator,0);
});
test('CORS preflight only reveals allowed public origin, never signed session',async()=>{
 const s=setup();
 const r=await s.gateway.handle(new Request(HOST+ROUTES.session,{
  method:'OPTIONS',headers:{Origin:PLATFORM,'Access-Control-Request-Method':'POST'}
 }));
 assert.equal(r.status,204);assert.equal(r.headers.get('access-control-allow-origin'),PLATFORM);
 assert.equal(r.headers.get('access-control-allow-headers'),'Content-Type');
 assert.equal(s.calls.operator,0);assert.equal(s.calls.registry,0);
});
test('Cross-origin preflight does not receive allow-origin header',async()=>{
 const s=setup();const r=await s.gateway.handle(
  new Request(HOST+ROUTES.session,{method:'OPTIONS',headers:{Origin:'https://attacker.qa.invalid'}}));
 assert.equal(r.status,403);assert.equal(r.headers.get('access-control-allow-origin'),null);
});
test('Origin spoof without approved installation proof cannot open session',async()=>{
 const s=setup();
 const r=await get(s.gateway.handle(makeRequest({
  origin:SHOP_A,data:{widgetId:'widget_platform',origin:SHOP_A}
 })));
 assert.equal(r.status,403);assert.equal(s.calls.core,0);
});
test('Origin mismatch between browser header and JSON body is rejected',async()=>{
 const s=setup();
 const r=await get(s.gateway.handle(makeRequest({
  origin:PLATFORM,data:{widgetId:'widget_platform',origin:SHOP_A}
 })));
 assert.equal(r.status,403);
});
test('Cross-store same tenant session cannot cross installations',async()=>{
 const s=setup({mode:'MERCHANT_SANDBOX'});
 const a=(await open(s,SHOP_A)).body.session;
 const r=await message(s,a,SHOP_B,'event_00002');
 assert.equal(r.status,403);assert.equal(s.calls.core,0);
});
test('Revocation after session creation prevents readback from cached session',async()=>{
 const s=setup();const issued=(await open(s)).body.session;
 s.copy[0].revoked=true;
 const r=await message(s,issued);
 assert.equal(r.status,403);assert.equal(s.calls.core,0);
});
test('Duplicate event is consumed once, second is rejected with no core re-invocation',async()=>{
 const s=setup();const tok=(await open(s)).body.session;
 assert.equal((await message(s,tok)).status,200);
 const again=await message(s,tok);
 assert.equal(again.status,409);assert.equal(s.calls.core,1);
});
test('Independent sessions cannot be interchanged for one widget',async()=>{
 const s=setup();const first=(await open(s)).body.session;
 const second=(await open(s)).body.session;
 assert.notEqual(first,second);
 assert.equal((await message(s,first,PLATFORM,'event_00013')).status,200);
 assert.equal((await message(s,second,PLATFORM,'event_00013')).status,200);
});
test('Replay ledger unavailable denies private reply and Core invocation',async()=>{
 const s=setup({changePorts:{async claimEvent(){throw Error('D1_FAIL_NO_SECRET')}}});
 const tok=(await open(s)).body.session;
 const r=await message(s,tok);
 assert.notEqual(r.status,200);assert.equal(s.calls.core,0);
 assert.doesNotMatch(JSON.stringify(r.body),/D1_FAIL_NO_SECRET/);
});
test('Global quota denies before any Core call',async()=>{
 const s=setup({changePorts:{
  async consumeQuota(scope){
   return {...scope,source:'DURABLE_QUOTA_LEDGER',
    accepted:scope.operation==='SESSION_OPEN'};
  }
 }});
 const tok=(await open(s)).body.session;
 const r=await message(s,tok);
 assert.equal(r.status,429);assert.equal(s.calls.core,0);
});
test('Client-submitted tenant/store/role/action/JWT cannot be trusted',async()=>{
 const bad=[
  {tenantId:'tenant_admin'},
  {storeId:'store_b'},
  {role:'admin'},
  {customerId:'client'},
  {jwt:'attacker.jwt'},
  {authorization:'Bearer abc'},
  {tool:'CREATE_ORDER'},
 ];
 for(const extra of bad){
  const s=setup();const tok=(await open(s)).body.session;
  const r=await message(s,tok,PLATFORM,'event_00017',extra);
  assert.equal(r.status,403);assert.equal(s.calls.core,0);
 }
});
test('Request body exactly 4096 limit, larger payload and Content-Length refused',async()=>{
 const s=setup();
 for(const invalid of [
  makeRequest({rawBody:'x'.repeat(BODY_LIMIT+1)}),
  makeRequest({headers:{'Content-Length':String(BODY_LIMIT+2)}}),
 ]){
  const res=await get(s.gateway.handle(invalid));
  assert.equal(res.status,413);assert.equal(s.calls.core,0);
 }
});
test('Invalid Content-Type, gzip content encoding and broken JSON rejected',async()=>{
 for(const [headers,raw,expected] of [
  [{'Content-Type':'text/plain'},'{}',415],
  [{'Content-Encoding':'gzip'},'{}',415],
  [{},'{not-json',400],
  [{},'[]',400],
 ]){
  const s=setup();const r=await get(s.gateway.handle(makeRequest({headers,rawBody:raw})));
  assert.equal(r.status,expected);assert.equal(s.calls.registry,0);
 }
});
test('Unknown gateway URL, query, paths and unsupported method are denied',async()=>{
 const s=setup();
 for(const url of [
  'https://evil.example.invalid'+ROUTES.session,
  HOST+ROUTES.session+'?tenantId=store_a',
  HOST+'/widget/v18.5/admin',HOST+'/api/v1/private/orders'
 ]){
  const r=await get(s.gateway.handle(makeRequest({url})));
  assert.equal(r.status,404);
 }
 const getReq=new Request(HOST+ROUTES.session,{method:'GET',headers:{Origin:PLATFORM}});
 const r=await get(s.gateway.handle(getReq));assert.equal(r.status,405);
 assert.equal(s.calls.core,0);
});
test('Malformed Origin, insecure HTTP and credential-bearing origin denied',async()=>{
 const bad=['http://platform.qa.invalid','https://evil@platform.qa.invalid',
    'https://platform.qa.invalid/path','https://platform.qa.invalid?x=1',
    'https://platform.qa.invalid.evil.invalid'];
 for(const origin of bad){
  const s=setup();const r=await get(s.gateway.handle(makeRequest({origin})));
  assert.equal(r.status,403);assert.equal(s.calls.core,0);
 }
});
test('Missing Origin rejected and never implied from Referer header',async()=>{
 const s=setup();
 const req=new Request(HOST+ROUTES.session,{
  method:'POST',headers:{'Content-Type':'application/json',
    Referer:PLATFORM+'/demo.html'},
  body:JSON.stringify({widgetId:'widget_platform',origin:PLATFORM})
 });
 const res=await get(s.gateway.handle(req));
 assert.equal(res.status,403);assert.equal(s.calls.operator,0);
});
test('Timed-out mock Access verifier returns unavailable without touching Store',async()=>{
 const s=setup({timeoutMs:100,operator:()=>new Promise(()=>{})});
 const r=await open(s);
 assert.equal(r.status,503);assert.equal(s.calls.registry,0);
});
test('Wrong Store readback from synthetic Core blocked, no private result emitted',async()=>{
 const s=setup({changePorts:{async invokeExistingCommerceCore(req){
  s.calls.core++;return {...req,source:'SYNTHETIC_CORE_READBACK',
   verified:true,workflowId:CORE_WORKFLOW_ID,mode:req.mode,
   tenantId:'other_tenant',storeId:'store_b',
   widgetId:req.widgetId,type:'TEXT',text:'FAKE_LEAK',actions:[],
   dispatch_authorized:false,privateOrderAccess:false,
   providerSends:0,orderWrites:0}
 }}});
 const tok=(await open(s)).body.session;
 const res=await message(s,tok);
 assert.notEqual(res.status,200);
 assert.doesNotMatch(JSON.stringify(res.body),/FAKE_LEAK/);
});
test('Only two-stage consultant or merchant Sandbox, never create Order',async()=>{
 for(const mode of ['PLATFORM_CONSULTANT','MERCHANT_SANDBOX']){
  const s=setup({mode}),o=mode==='MERCHANT_SANDBOX'?SHOP_A:PLATFORM;
  const sess=await open(s,o);assert.equal(sess.body.mode,mode);
  const r=await message(s,sess.body.session,o,'event_00024');
  assert.equal(r.status,200);
  assert.equal(r.body.orderWrites,0);
  assert.equal(r.body.providerSends,0);
  assert.equal(r.body.privateOrderAccess,false);
  assert.equal(s.gateway.releaseState.realCommerceCoreInvoked,false);
 }
});
test('Server-side mode remains unchanged even if caller tries to switch mode',async()=>{
 const s=setup();const session=(await open(s)).body.session;
 const r=await message(s,session,PLATFORM,'event_00025',{mode:'MERCHANT_SANDBOX'});
 assert.equal(r.status,403);assert.equal(s.calls.core,0);
});
test('If the Core port crashes response never leaks thrown exception',async()=>{
 const s=setup({changePorts:{async invokeExistingCommerceCore(){
  throw Error('SECRET_DB_USERNAME_PASSWORD_OR_ORDER_INFORMATION');
 }}});
 const sess=(await open(s)).body.session;
 const r=await message(s,sess);
 assert.notEqual(r.status,200);
 assert.doesNotMatch(JSON.stringify(r.body),/SECRET_DB|PASSWORD|ORDER_INFORMATION/);
});
