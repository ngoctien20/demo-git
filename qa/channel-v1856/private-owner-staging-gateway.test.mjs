import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {handlePrivateStagingRequest} from './private-owner-staging-gateway.mjs';

const HOST='tien404-widget-gateway-v144-staging.tienmobi208.workers.dev';
const ROUTE='/__v1856/private-commerce/read';
const AUD='a'.repeat(64);
const OWNER='synthetic-owner@example.invalid';
const ACCESS_ENV={T404_ACCESS_AUD:AUD,T404_QA_OPERATOR_EMAIL:OWNER};
const goodContext=()=>({access:{aud:AUD,getIdentity:async()=>({email:OWNER})}});
const outsiderContext=()=>({access:{aud:AUD,getIdentity:async()=>({email:'not-owner@example.invalid'})}});
function quota(){
  return {getByName(name){
    assert.equal(name.startsWith('t404-v1855:v1855-'),true);
    return {authorizeRead:async input=>{
      assert.equal(typeof input.installationId,'string');
      assert.equal(input.requestId.length,36);
      return {allowed:true,status:200,code:'ADMITTED_READ_ONLY',remaining:19};
    }};
  }};
}
function env(id='v1855-materials-sandbox'){
  return {...ACCESS_ENV,
    T404_V1856_GATE_MODE:'PRIVATE_OWNER_QA_ONLY',
    T404_V1856_QA_INSTALLATION_ID:id,
    T404_N8N_READONLY_WEBHOOK_URL:'https://ngoctien20.app.n8n.cloud/webhook/t404-v1855-protected-readonly-commerce-staging',
    T404_N8N_READONLY_ADAPTER_TOKEN:'x'.repeat(48),
    T404_READ_ADMISSION:quota()
  };
}
function post(body,headers={},path=ROUTE){
  return new Request('https://'+HOST+path,{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body)});
}
const catalogBody={operation:'catalog.search',query:'VL-101',limit:5};
function mockCatalog(received){
  return new Response(JSON.stringify({
    success:true,operation:'catalog.search',environment:'sandbox',requestId:received.requestId,
    readOnly:true,canWrite:false,canConfirm:false,privateOrderAccess:false,
    products:[{sku:'VL-101',name:'Xi măng mẫu',priceVnd:79000,stock:120,unit:'bao',category:'Vật liệu',attributes:{demoOnly:true}}],
    shopName:'Materials Sandbox'
  }),{status:200});
}
function mockCart(received){
  return new Response(JSON.stringify({
    success:true,operation:'cart.preview',environment:'sandbox',requestId:received.requestId,
    readOnly:true,canWrite:false,canConfirm:false,privateOrderAccess:false,previewOnly:true,
    lines:[{sku:'TG-101',name:'Mì gói mẫu',unit:'gói',quantity:2,unitPriceVnd:4500,lineTotalVnd:9000,stock:100,needsQuote:false}],
    subtotalVnd:9000,errors:[],requiresHumanQuote:false,shopName:'Grocery Sandbox'
  }),{status:200});
}
const noUpstream=async()=>{throw new Error('must not contact n8n');};

test('original V18.5.4 private Access Canary response remains unchanged',async()=>{
  const response=await handlePrivateStagingRequest(new Request('https://'+HOST+'/__v1854/access-canary'),env(),goodContext(),noUpstream);
  const data=await response.json();
  assert.equal(response.status,200);
  assert.equal(data.canary,'CLOUDFLARE_ACCESS_CONTEXT_VERIFIED');
  assert.equal(data.commerce,'LOCKED_PENDING_READONLY_ADAPTER');
  assert.equal(data.privateOrderAccess,false);
  assert.equal(data.productionReady,false);
});
test('original health and Widget routes remain closed even with valid private context',async()=>{
  const e=env();
  for (const path of ['/v1/widget/session','/v1/widget/message','/v1/widget/install','/v1/widget/commerce/read']) {
    const response=await handlePrivateStagingRequest(post(catalogBody,{},path),e,goodContext(),noUpstream);
    assert.equal(response.status,423,path);
    assert.equal((await response.json()).error,'COMMERCE_READONLY_ADAPTER_NOT_ADMITTED');
  }
  const health=await handlePrivateStagingRequest(new Request('https://'+HOST+'/__v144/health'),e,goodContext(),noUpstream);
  assert.equal(health.status,200);
  assert.equal((await health.json()).state,'LOCKED');
});
test('all routes deny unauthenticated requests before parsing any submitted body',async()=>{
  for (const route of [ROUTE,'/__v1854/access-canary','/v1/widget/message']) {
    const r=await handlePrivateStagingRequest(post(catalogBody,{},route),env(),{},noUpstream);
    assert.equal(r.status,403,route);
  }
});
test('synthetic second non-allowlisted identity is denied, not counted as real Edge proof',async()=>{
  const r=await handlePrivateStagingRequest(post(catalogBody),env(),outsiderContext(),noUpstream);
  assert.equal(r.status,403);
  assert.equal((await r.json()).error,'ACCESS_OPERATOR_NOT_ALLOWLISTED');
});
test('missing staging mode or missing server installation rejects before reaching n8n',async()=>{
  for(const invalid of [
    {...env(),T404_V1856_GATE_MODE:undefined},
    {...env(),T404_V1856_GATE_MODE:'PRODUCTION'},
    {...env(),T404_V1856_QA_INSTALLATION_ID:undefined},
    {...env(),T404_V1856_QA_INSTALLATION_ID:'other-store'}
  ]){
    const r=await handlePrivateStagingRequest(post(catalogBody),invalid,goodContext(),noUpstream);
    assert.equal(r.status,423);
    assert.equal((await r.json()).productionReady,false);
  }
});
test('valid owner read maps installation exclusively from trusted server binding',async()=>{
  const captured=[];
  const response=await handlePrivateStagingRequest(
    post(catalogBody,{'CF-Access-Jwt-Assertion':'FAKE_BROWSER_TOKEN','x-t404-adapter-token':'FAKE'}),
    env('v1855-materials-sandbox'),goodContext(),async (url,init)=>{
      const data=JSON.parse(init.body);
      captured.push({url,data,headers:init.headers});
      return mockCatalog(data);
    }
  );
  const data=await response.json();
  assert.equal(response.status,200);
  assert.equal(captured.length,1);
  assert.equal(captured[0].data.installationId,'v1855-materials-sandbox');
  assert.deepEqual(Object.keys(captured[0].data).sort(),
    ['installationId','issuedAt','limit','operation','query','requestId']);
  assert.equal(captured[0].data.query,'VL-101');
  assert.equal(captured[0].headers['x-t404-adapter-token'],'x'.repeat(48));
  assert.equal(JSON.stringify(captured).includes('FAKE_BROWSER_TOKEN'),false);
  assert.equal(JSON.stringify(captured).includes('FAKE'),false);
  assert.equal(data.products[0].sku,'VL-101');
  assert.equal(data.canWrite,false);
  assert.equal(data.privateOrderAccess,false);
});
test('valid grocery cart preview uses a different server-owned Sandbox installation',async()=>{
  const captured=[];
  const r=await handlePrivateStagingRequest(
    post({operation:'cart.preview',cart:[{sku:'TG-101',quantity:2}]}),
    env('v1855-grocery-sandbox'),goodContext(),async (_,init)=>{
      const data=JSON.parse(init.body);captured.push(data);return mockCart(data);
    }
  );
  const data=await r.json();
  assert.equal(r.status,200);
  assert.equal(captured.length,1);
  assert.equal(captured[0].installationId,'v1855-grocery-sandbox');
  assert.deepEqual(JSON.parse(captured[0].cartJson),[{sku:'TG-101',quantity:2}]);
  assert.equal(data.subtotalVnd,9000);
  assert.equal(data.previewOnly,true);
  assert.equal(data.canConfirm,false);
  assert.equal(data.canWrite,false);
});
test('browser installation, tenant, store and identity claims are rejected, not overwritten',async()=>{
  const forbidden=['installationId','tenantId','storeId','accountId','role','userId','customerId','orderId',
    'channelType','ownerId','authorization','credential','token','requestId','issuedAt','__proto__'];
  for (const key of forbidden){
    const obj={...catalogBody};
    Object.defineProperty(obj,key,{value:'FORGED',enumerable:true,configurable:true});
    const r=await handlePrivateStagingRequest(post(obj),env(),goodContext(),noUpstream);
    assert.equal(r.status,400,key);
    assert.equal((await r.json()).error,'CLIENT_AUTHORITY_OR_UNEXPECTED_FIELD',key);
  }
});
test('malformed JSON, empty body, unexpected operation and oversized body fail closed',async()=>{
  const e=env();
  for(const body of ['{bad-json','{}','[]',JSON.stringify({operation:'order.create',sku:'VL-101'}),' '.repeat(9000)]){
    const req=new Request('https://'+HOST+ROUTE,{method:'POST',headers:{'content-type':'application/json'},body});
    const r=await handlePrivateStagingRequest(req,e,goodContext(),noUpstream);
    assert.equal([400,413].includes(r.status),true,body.slice(0,12));
  }
});
test('non-JSON, URL parameters, OPTIONS and wrong host fail without n8n fetch',async()=>{
  const base=env();
  for(const r of [
    new Request('https://'+HOST+ROUTE,{method:'OPTIONS'}),
    post(catalogBody,{},ROUTE+'?installationId=v1855-grocery-sandbox'),
    new Request('https://evil.example'+ROUTE,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(catalogBody)}),
    new Request('https://'+HOST+ROUTE,{method:'POST',headers:{'content-type':'text/plain'},body:JSON.stringify(catalogBody)})
  ]){
    const response=await handlePrivateStagingRequest(r,base,goodContext(),noUpstream);
    assert.equal([400,405,415,421].includes(response.status),true);
    assert.equal(response.headers.get('access-control-allow-origin'),null);
  }
});
test('DO fail-closed protects n8n when admission is missing or rate exceeded',async()=>{
  for(const value of [
    {...env(),T404_READ_ADMISSION:undefined},
    {...env(),T404_READ_ADMISSION:{getByName:()=>({authorizeRead:async()=>({allowed:false,code:'ADMISSION_RATE_LIMIT',status:429})})}}
  ]){
    const r=await handlePrivateStagingRequest(post(catalogBody),value,goodContext(),noUpstream);
    assert.equal([423,429].includes(r.status),true);
  }
});
test('missing n8n URL/secret prevents adapter egress',async()=>{
  for(const value of [
    {...env(),T404_N8N_READONLY_WEBHOOK_URL:undefined},
    {...env(),T404_N8N_READONLY_ADAPTER_TOKEN:undefined}
  ]){
    const r=await handlePrivateStagingRequest(post(catalogBody),value,goodContext(),noUpstream);
    assert.equal(r.status,423);
  }
});
test('wrong private hostname and incoming Host header cannot change trusted Worker endpoint',async()=>{
  const e=env();
  const wrong=new Request('https://untrusted.example'+ROUTE,{method:'POST',
    headers:{'content-type':'application/json','host':HOST},body:JSON.stringify(catalogBody)});
  const r=await handlePrivateStagingRequest(wrong,e,goodContext(),noUpstream);
  assert.equal(r.status,421);
});
test('source is strictly source-only and does not create public Widget authentication or writes',()=>{
  const s=fs.readFileSync(new URL('./private-owner-staging-gateway.mjs',import.meta.url),'utf8');
  assert(s.includes("mode !== 'PRIVATE_OWNER_QA_ONLY'"));
  assert(s.includes("TRUSTED_INSTALLATION_NOT_CONFIGURED"));
  assert(s.includes("payload.installationId = installationId"));
  assert(s.includes("new Request('https://' + HOST + ENGINE_PATH"));
  assert(s.includes("return originalCanary.fetch(request, env, ctx)"));
  assert(!s.includes('n8n-nodes-base'));
  assert(!s.includes('ORDER_WRITE_ENABLED=true'));
  assert(!s.includes('providerSend('));
});
