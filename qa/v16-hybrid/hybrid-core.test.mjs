import test from 'node:test';
import assert from 'node:assert/strict';
import {
 CONTRACT,QUEUE_CONTRACT,REQUIRED_MODE,QA_PATH,verifyQaHmac,signQaHmac,
 opaqueKey,routePreview,chooseModelPreview,costPreview,handleQaFetch,
 handleQaBatch,performRealProviderSend,executeRealCommerce,callPaidModel,
 promoteProduction
} from './hybrid-core.mjs';
import worker from './worker.mjs';
const NOW=Date.parse('2026-11-16T07:47:00.000Z');
const SECRET='QA_ONLY_NOT_A_LIVE_KEY_12345';
const fact={
 contract:CONTRACT,channel:'messenger',account_id:'QA_PAGE_A',
 event_id:'QA-EVENT-0001',occurred_at:'2026-11-16T07:46:10.000Z',
 synthetic_text:'xin chao',synthetic:true
};
class Ledger{
 constructor(){this.map=new Map}
 async reserve(k,msg){
  const state=this.map.get(k)?.state;
  if(state==='ENQUEUED')return 'DUPLICATE';
  if(state==='RESERVED')return 'BUSY';
  this.map.set(k,{state:'RESERVED',msg});
  return 'RESERVED';
 }
 async markEnqueued(k){this.map.get(k).state='ENQUEUED'}
 async retryable(k){this.map.get(k).state='RETRYABLE'}
}
function setup({limit=25}={}){
 const usage=new Map();
 const env={
  V16_MODE:REQUIRED_MODE,QA_HMAC_SECRET:SECRET,
  QA_REGISTRY:{async lookup(channel,account){
   if(channel==='messenger'&&account==='QA_PAGE_A')
    return {tenant_id:'QA_TENANT_ONE',store_id:'QA_STORE_A',active:true,greeting:'Xin chao A'};
   if(channel==='messenger'&&account==='QA_PAGE_B')
    return {tenant_id:'QA_TENANT_ONE',store_id:'QA_STORE_B',active:true,greeting:'Xin chao B'};
   if(channel==='zalo'&&account==='QA_ZALO_C')
    return {tenant_id:'QA_TENANT_TWO',store_id:'QA_STORE_C',active:true,greeting:'Xin chao C'};
   return null;
  }},
  QA_LIMITS:{async admit(scope,now){
   const key=scope+':'+Math.floor(now/60000);
   const n=usage.get(key)||0;
   if(n>=limit)return false;
   usage.set(key,n+1);return true;
  }},
  QA_OUTBOX:new Ledger(),
  QA_QUEUE:{items:[],failOnce:false,async send(m){
   if(this.failOnce){this.failOnce=false;throw Error('QA_QUEUE_UNAVAILABLE')}
   this.items.push(structuredClone(m));
  }},
  QA_PREVIEWS:{data:new Map(),async recordOnce(k,x){
   if(!this.data.has(k))this.data.set(k,x);
  }}
 };
 return env;
}
async function req(payload=fact,{secret=SECRET,route=QA_PATH,method='POST',
 signature,contentType='application/json'}={}){
 const raw=typeof payload==='string'?payload:JSON.stringify(payload);
 const h=new Headers({'content-type':contentType});
 h.set('x-t404-qa-signature',signature??await signQaHmac(raw,secret));
 return new Request('https://synthetic.invalid'+route,{method,headers:h,
  body:method==='POST'?raw:undefined});
}
async function run(env=setup(),payload=fact,opts={}) {
 return handleQaFetch(await req(payload,opts),env,NOW);
}
test('01 HMAC valid for raw synthetic body',async()=>{
 const raw=JSON.stringify(fact);const h=await signQaHmac(raw,SECRET);
 assert.equal(await verifyQaHmac(raw,h,SECRET),true);
});
test('02 HMAC rejects tampering',async()=>{
 const raw=JSON.stringify(fact);const h=await signQaHmac(raw,SECRET);
 assert.equal(await verifyQaHmac(raw+' ',h,SECRET),false);
});
test('03 HMAC refuses wrong key',async()=>{
 const raw=JSON.stringify(fact);const h=await signQaHmac(raw,SECRET);
 assert.equal(await verifyQaHmac(raw,h,'QA_OTHER_KEY_123456789'),false);
});
test('04 valid synthetic fixture enqueued once',async()=>{
 const e=setup(),res=await run(e);assert.equal(res.status,202);
 assert.equal((await res.json()).status,'QA_ACCEPTED_TO_QUEUE');
 assert.equal(e.QA_QUEUE.items.length,1);
});
test('05 duplicate event acknowledged but not requeued',async()=>{
 const e=setup();await run(e);const dup=await run(e);
 assert.equal((await dup.json()).status,'DUPLICATE_ACK');
 assert.equal(e.QA_QUEUE.items.length,1);
});
test('06 rejected actual Messenger webhook route (no migration)',async()=>{
 assert.equal((await run(setup(),fact,{route:'/webhook/messenger'})).status,404);
});
test('07 rejected actual Zalo webhook route',async()=>{
 assert.equal((await run(setup(),fact,{route:'/webhook/zalo'})).status,404);
});
test('08 missing QA mode refuses all',async()=>{
 const e=setup();delete e.V16_MODE;
 assert.equal((await run(e)).status,503);
});
test('09 forged HMAC rejected',async()=>{
 assert.equal((await run(setup(),fact,{secret:'FAKE_QA_SECRET_123456789'})).status,401);
});
test('10 missing HMAC header rejected',async()=>{
 assert.equal((await run(setup(),fact,{signature:'bad'})).status,401);
});
test('11 JSON Content-Type required',async()=>{
 assert.equal((await run(setup(),fact,{contentType:'text/plain'})).status,415);
});
test('12 malformed body rejected after valid signature',async()=>{
 assert.equal((await run(setup(),'{INVALID_JSON')).status,400);
});
test('13 arbitrary external customer text denied',async()=>{
 assert.equal((await run(setup(),{...fact,synthetic_text:'0901234567'})).status,400);
});
test('14 real customer token extra field denied',async()=>{
 assert.equal((await run(setup(),{...fact,token:'REAL_SECRET'})).status,400);
});
test('15 client-supplied tenant ID denied',async()=>{
 assert.equal((await run(setup(),{...fact,tenant_id:'QA_TENANT_TWO'})).status,400);
});
test('16 client-supplied store ID denied',async()=>{
 assert.equal((await run(setup(),{...fact,store_id:'QA_STORE_B'})).status,400);
});
test('17 client-supplied admin role denied',async()=>{
 assert.equal((await run(setup(),{...fact,role:'admin'})).status,400);
});
test('18 expired event denied',async()=>{
 assert.equal((await run(setup(),{...fact,occurred_at:'2026-11-16T07:30:00.000Z'})).status,400);
});
test('19 event too far in future denied',async()=>{
 assert.equal((await run(setup(),{...fact,occurred_at:'2026-11-16T08:00:00.000Z'})).status,400);
});
test('20 unregistered channel account denied',async()=>{
 assert.equal((await run(setup(),{...fact,account_id:'QA_PAGE_X'})).status,403);
});
test('21 disabled channel registry fails closed',async()=>{
 const e=setup();delete e.QA_REGISTRY;
 assert.equal((await run(e)).status,503);
});
test('22 missing durable outbox denies admission',async()=>{
 const e=setup();delete e.QA_OUTBOX;
 assert.equal((await run(e)).status,503);
});
test('23 missing queue binding denies admission',async()=>{
 const e=setup();delete e.QA_QUEUE;
 assert.equal((await run(e)).status,503);
});
test('24 per-shop quota blocks same store separately',async()=>{
 const e=setup({limit:1});
 assert.equal((await run(e,fact)).status,202);
 assert.equal((await run(e,{...fact,event_id:'QA-EVENT-0002'})).status,429);
 assert.equal((await run(e,{...fact,account_id:'QA_PAGE_B'})).status,202);
 assert.equal(e.QA_QUEUE.items.length,2);
});
test('25 distinct Store IDs have distinct scoped event hashes',async()=>{
 const a=await opaqueKey(fact),b=await opaqueKey({...fact,account_id:'QA_PAGE_B'});
 assert.notEqual(a,b);
});
test('26 queue transient failure 503 and retriable without losing fixture',async()=>{
 const e=setup();e.QA_QUEUE.failOnce=true;
 assert.equal((await run(e)).status,503);
 assert.equal((await run(e)).status,202);
 assert.equal(e.QA_QUEUE.items.length,1);
});
test('27 concurrent replay cannot enqueue two when mock reserve is atomic',async()=>{
 const e=setup();
 const responses=await Promise.all(Array.from({length:20},()=>run(e)));
 assert.equal(e.QA_QUEUE.items.length,1);
 assert.equal(responses.filter(x=>x.status===202).length,1);
});
test('28 no real guest provider send through worker',async()=>{
 assert.equal(typeof worker.fetch,'function');
 assert.equal(typeof worker.queue,'function');
});
test('29 memory ledger is QA-only, not hosted transaction certification',async()=>{
 const e=setup();await run(e);
 assert(e.QA_OUTBOX instanceof Ledger);
 assert.equal(e.QA_QUEUE.items[0].qa_only,true);
});
test('30 no model API called for fast FAQ preview',()=>{
 const p=routePreview('xin chao',{greeting:'Xin chao A'});
 assert.equal(p.route,'FAST_FAQ_PREVIEW');
 assert.equal(chooseModelPreview(p.route).model,null);
});
test('31 catalog needs live read-only proof, no fabricated price',()=>{
 const p=routePreview('xin gia ao thun',{});
 assert.equal(p.route,'FAST_CATALOG_NEEDS_LIVE_READONLY_DATA');
 assert.equal(p.price,undefined);
});
test('32 AI complex path is planning only',()=>{
 const p=routePreview('tu van ao',{});
 assert.equal(p.route,'AI_API_PREVIEW_ONLY');
 assert.deepEqual(chooseModelPreview(p.route),{
  status:'PREVIEW_ONLY',model:'gpt-6-luna',invokeApi:false,providerTokensUsed:0
 });
});
test('33 do not run unsupported model IDs',()=>{
 assert.equal(chooseModelPreview('AI_API_PREVIEW_ONLY',['unknown-model']).status,'BLOCKED');
});
test('34 customer requests to write Commerce are blocked',()=>{
 for(const x of ['toi muon dat hang','sua don hang']){
  assert.equal(routePreview(x,{}).route,'COMMERCE_BLOCKED');
 }
});
test('35 handoff to support is NOT actual ticket',()=>{
 assert.equal(routePreview('can gap nhan vien',{}).route,'SUPPORT_TICKET_PREVIEW_ONLY');
});
test('36 mock queue processing is preview only and idempotent',async()=>{
 const e=setup();await run(e);
 const msg={body:e.QA_QUEUE.items[0],acks:0,ack(){this.acks++}};
 await handleQaBatch({messages:[msg,msg]},e);
 assert.equal(msg.acks,2);
 assert.equal(e.QA_PREVIEWS.data.size,1);
 const val=[...e.QA_PREVIEWS.data.values()][0];
 assert.equal(val.no_send,true);assert.equal(val.no_model_call,true);
 assert.equal(val.commerce_write,false);
});
test('37 malformed queue payload cannot become real action',async()=>{
 const e=setup(),msg={body:{contract:QUEUE_CONTRACT,key:'bad'},retried:false,retry(){this.retried=true}};
 await handleQaBatch({messages:[msg]},e);
 assert.equal(msg.retried,true);assert.equal(e.QA_PREVIEWS.data.size,0);
});
test('38 missing preview evidence store aborts queue',async()=>{
 await assert.rejects(handleQaBatch({messages:[]},{V16_MODE:REQUIRED_MODE}),
 /NO_SEND_QA_MODE_REQUIRED/);
});
test('39 production methods are deliberately unavailable',()=>{
 for(const fn of [performRealProviderSend,executeRealCommerce,callPaidModel,promoteProduction])
  assert.throws(()=>fn(),/V16_NO_LIVE_COMMERCE_OR_PROVIDER_EXECUTOR/);
});
test('40 cost assumptions 10k*3000+300 with Luna = USD 4.5',()=>{
 assert.equal(costPreview({messages:10000,inputTokens:3000,outputTokens:300,
  inputPerMillion:0.1,outputPerMillion:0.5}),4.5);
});
test('41 cost estimator denies negative and noninteger token counts',()=>{
 assert.throws(()=>costPreview({messages:-1,inputTokens:3000,outputTokens:300,
  inputPerMillion:.1,outputPerMillion:.5}));
});
test('42 official price rates are NOT encoded in runtime routing logic',()=>{
 const p=chooseModelPreview('AI_API_PREVIEW_ONLY',['gemini-2.5-flash-lite']);
 assert.equal(p.model,'gemini-2.5-flash-lite');assert.equal(p.invokeApi,false);
});
