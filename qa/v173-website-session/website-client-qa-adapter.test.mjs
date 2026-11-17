import test from 'node:test';
import assert from 'node:assert/strict';
import {createWebsiteChatQaClient} from './website-client-qa-adapter.mjs';
const apiBase='https://qa-api.example.invalid',origin='https://qa-shop-a.example.invalid';
const token='t404s1.qa_v1.QV90ZXN0X29ubHk.ABCDEF12345';
const session=()=>({status:'SESSION_ISSUED',source_scope:'SYNTHETIC_QA_ONLY',
 customer_identity_verified:false,token,expires_in_sec:300});
const reply=()=>({status:'QA_CATALOG_REPLY_PREPARED',outbound:'MOCK_ONLY_NOT_SENT',
 hosted_rls_verified:false,customer_identity_verified:false,model_calls:0,provider_sends:0,
 commerce_writes:0,reply:'Ví dụ QA: mã QA_SKU_001 giá 159000 VND'});
function mock({sessionValue=session(),messageValue=reply(),brokenSession=false}={}){
 const calls=[];
 async function fetchImpl(url,opt){
  calls.push({url,options:opt});
  if(brokenSession)return {ok:false,status:503,json:async()=>({})};
  if(url.endsWith('/sessions'))return {ok:true,json:async()=>sessionValue};
  if(url.endsWith('/messages'))return {ok:true,json:async()=>messageValue};
  throw Error('unexpected URL');
 }
 return {calls,fetchImpl};
}
const config=(fn,more={})=>({apiBase,origin,installationRef:'QA_WEB_WIDGET_A',fetchImpl:fn,
 randomId:()=>'QA_MSG_0001',now:()=>1700000000000,...more});
test('01 constructs QA client without any request',()=>{
 const f=mock();createWebsiteChatQaClient(config(f.fetchImpl));assert.equal(f.calls.length,0);
});
test('02 rejects HTTP api',()=>assert.throws(()=>createWebsiteChatQaClient(config(mock().fetchImpl,{apiBase:'http://qa-api.example.invalid'}))));
test('03 rejects HTTP widget origin',()=>assert.throws(()=>createWebsiteChatQaClient(config(mock().fetchImpl,{origin:'http://qa-shop-a.example.invalid'}))));
test('04 rejects API URL with path',()=>assert.throws(()=>createWebsiteChatQaClient(config(mock().fetchImpl,{apiBase:apiBase+'/webhook'}))));
test('05 rejects URL user info',()=>assert.throws(()=>createWebsiteChatQaClient(config(mock().fetchImpl,{apiBase:'https://u:p@qa-api.example.invalid'}))));
test('06 rejects missing fetch dependency',()=>assert.throws(()=>createWebsiteChatQaClient(config(null))));
test('07 rejects empty widget installation',()=>assert.throws(()=>createWebsiteChatQaClient(config(mock().fetchImpl,{installationRef:''}))));
test('08 rejects Meta install as website',()=>assert.throws(()=>createWebsiteChatQaClient(config(mock().fetchImpl,{installationRef:'QA_META_PAGE_A'}))));
test('09 rejects arbitrary ID generation',()=>assert.throws(()=>createWebsiteChatQaClient(config(mock().fetchImpl,{randomId:null}))));
test('10 start requests only QA session endpoint',async()=>{
 const f=mock(),c=createWebsiteChatQaClient(config(f.fetchImpl));await c.start();assert.equal(f.calls.length,1);assert.equal(f.calls[0].url,apiBase+'/v1/website/sessions');
});
test('11 origin is not client-trusted store assertion',async()=>{
 const f=mock(),c=createWebsiteChatQaClient(config(f.fetchImpl));await c.start();
 assert.deepEqual(JSON.parse(f.calls[0].options.body),{installation_ref:'QA_WEB_WIDGET_A'});
});
test('12 uses POST JSON',async()=>{
 const f=mock(),c=createWebsiteChatQaClient(config(f.fetchImpl));await c.start();
 assert.equal(f.calls[0].options.method,'POST');
 assert.equal(f.calls[0].options.headers['Content-Type'],'application/json');
});
test('13 never sends cookies or persisted credentials',async()=>{
 const f=mock(),c=createWebsiteChatQaClient(config(f.fetchImpl));await c.start();
 assert.equal(f.calls[0].options.credentials,'omit');
 assert.equal(f.calls[0].options.cache,'no-store');
 assert.equal(f.calls[0].options.referrerPolicy,'no-referrer');
});
test('14 no authorization header on session mint',async()=>{
 const f=mock(),c=createWebsiteChatQaClient(config(f.fetchImpl));await c.start();
 assert.equal(f.calls[0].options.headers.Authorization,undefined);
});
test('15 QA session start accepted',async()=>{
 const c=createWebsiteChatQaClient(config(mock().fetchImpl));assert.equal((await c.start()).status,'SESSION_READY');
});
test('16 rejected when backend not available, no fallback to marketing bot',async()=>{
 const c=createWebsiteChatQaClient(config(mock({brokenSession:true}).fetchImpl));
 await assert.rejects(()=>c.start(),/BACKEND_UNAVAILABLE/);
});
test('17 rejects backend claiming owner customer identity',async()=>{
 const c=createWebsiteChatQaClient(config(mock({sessionValue:{...session(),customer_identity_verified:true}}).fetchImpl));
 await assert.rejects(()=>c.start(),/ISSUER_INVALID/);
});
test('18 rejects non QA session',async()=>{
 const c=createWebsiteChatQaClient(config(mock({sessionValue:{...session(),source_scope:'PRODUCTION'}}).fetchImpl));
 await assert.rejects(()=>c.start(),/ISSUER_INVALID/);
});
test('19 rejects overlong session age',async()=>{
 const c=createWebsiteChatQaClient(config(mock({sessionValue:{...session(),expires_in_sec:3600}}).fetchImpl));
 await assert.rejects(()=>c.start(),/ISSUER_INVALID/);
});
test('20 chat auto-starts once and sends second request',async()=>{
 const f=mock(),c=createWebsiteChatQaClient(config(f.fetchImpl));
 const r=await c.chat('QA_SKU_001');assert.equal(r.test_only,true);assert.equal(f.calls.length,2);
});
test('21 two messages reuse same session, not re-mint',async()=>{
 const f=mock(),c=createWebsiteChatQaClient(config(f.fetchImpl));
 await c.chat('first');await c.chat('second');assert.equal(f.calls.filter(x=>x.url.endsWith('/sessions')).length,1);
});
test('22 message Authorization bearer token in memory only',async()=>{
 const f=mock(),c=createWebsiteChatQaClient(config(f.fetchImpl));await c.chat('hi');
 assert.equal(f.calls[1].options.headers.Authorization,'Bearer '+token);
});
test('23 message carries only expected safe keys',async()=>{
 const f=mock(),c=createWebsiteChatQaClient(config(f.fetchImpl));await c.chat('QA_SKU_001');
 assert.deepEqual(Object.keys(JSON.parse(f.calls[1].options.body)).sort(),['event_id','installation_ref','requested_tool','text'].sort());
});
test('24 only catalog_read tool requested',async()=>{
 const f=mock(),c=createWebsiteChatQaClient(config(f.fetchImpl));await c.chat('QA_SKU_001');
 assert.equal(JSON.parse(f.calls[1].options.body).requested_tool,'catalog_read');
});
test('25 empty message rejected before any fetch',async()=>{
 const f=mock(),c=createWebsiteChatQaClient(config(f.fetchImpl));
 await assert.rejects(()=>c.chat(''),/TEXT_BOUNDS/);assert.equal(f.calls.length,0);
});
test('26 long message rejected before any fetch',async()=>{
 const f=mock(),c=createWebsiteChatQaClient(config(f.fetchImpl));
 await assert.rejects(()=>c.chat('X'.repeat(501)),/TEXT_BOUNDS/);assert.equal(f.calls.length,0);
});
test('27 bad generated event ID rejected',async()=>{
 const f=mock(),c=createWebsiteChatQaClient(config(f.fetchImpl,{randomId:()=>''}));
 await assert.rejects(()=>c.chat('QA'),/EVENT_ID_INVALID/);
});
test('28 wrong fake price source cannot be authorized by widget',async()=>{
 const f=mock(),c=createWebsiteChatQaClient(config(f.fetchImpl));await c.chat('QA');
 assert.equal('store_id' in JSON.parse(f.calls[1].options.body),false);
});
test('29 QA reply returned as plain string, not HTML operation',async()=>{
 const c=createWebsiteChatQaClient(config(mock().fetchImpl));const r=await c.chat('QA');
 assert.equal(typeof r.reply,'string');assert.match(r.reply,/Ví dụ QA/);
});
test('30 rejects backend Commerce writes claims',async()=>{
 const c=createWebsiteChatQaClient(config(mock({messageValue:{...reply(),commerce_writes:1}}).fetchImpl));
 await assert.rejects(()=>c.chat('QA'),/REPLY_SCOPE_DENIED/);
});
test('31 rejects backend claiming real hosted RLS',async()=>{
 const c=createWebsiteChatQaClient(config(mock({messageValue:{...reply(),hosted_rls_verified:true}}).fetchImpl));
 await assert.rejects(()=>c.chat('QA'),/REPLY_SCOPE_DENIED/);
});
test('32 rejects backend showing real channel send',async()=>{
 const c=createWebsiteChatQaClient(config(mock({messageValue:{...reply(),provider_sends:1}}).fetchImpl));
 await assert.rejects(()=>c.chat('QA'),/REPLY_SCOPE_DENIED/);
});
test('33 rejects backend returning real model calls',async()=>{
 const c=createWebsiteChatQaClient(config(mock({messageValue:{...reply(),model_calls:1}}).fetchImpl));
 await assert.rejects(()=>c.chat('QA'),/REPLY_SCOPE_DENIED/);
});
test('34 rejects backend stating customer identity linked',async()=>{
 const c=createWebsiteChatQaClient(config(mock({messageValue:{...reply(),customer_identity_verified:true}}).fetchImpl));
 await assert.rejects(()=>c.chat('QA'),/REPLY_SCOPE_DENIED/);
});
test('35 clear removes token from closure and forces new session',async()=>{
 const f=mock(),c=createWebsiteChatQaClient(config(f.fetchImpl));
 await c.chat('A');c.clear();await c.chat('B');
 assert.equal(f.calls.filter(x=>x.url.endsWith('/sessions')).length,2);
});
test('36 expiry forces fresh session mint',async()=>{
 let t=1700000000000;const f=mock(),c=createWebsiteChatQaClient(config(f.fetchImpl,{now:()=>t}));
 await c.chat('A');t+=300000;await c.chat('B');
 assert.equal(f.calls.filter(x=>x.url.endsWith('/sessions')).length,2);
});
