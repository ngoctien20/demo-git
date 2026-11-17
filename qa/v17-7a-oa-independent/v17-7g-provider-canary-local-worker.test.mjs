import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import worker, {handleOfflineSignedProviderRequest} from './v17-7g-provider-canary-local-worker.mjs';

const NOW=1794912000000;
const META='QA_ONLY_meta_app_secret_123456789';
const ZALO='QA_ONLY_zalo_bot_secret_123456789';
const PAGE='page-qa-00001';
const INSTALL='install-qa-00001';
const BOT='bot-qa-000001';
const txt='TIEN404 QA ONLY';
const encoder=new TextEncoder();
const proof = (bytes) => 'sha256='+createHmac('sha256',META).update(bytes).digest('hex');

function fixture(channel='MESSENGER') {
 const meta=channel==='MESSENGER';
 const payload=meta?{
    object:'page',entry:[{id:PAGE,time:NOW,messaging:[{
      sender:{id:'actor-qa-00001'},recipient:{id:PAGE},
      timestamp:NOW,message:{mid:'mid-qa-000001',text:txt}
    }]}]
  }:{
    ok:true,result:{event_name:'message.text.received',message:{
      from:{id:'sender-qa-0001',is_bot:false},
      chat:{id:'chat-qa-00001',chat_type:'PRIVATE'},
      text:txt,message_id:'message-qa-00001',date:NOW
    }}
  };
 const bytes=encoder.encode(JSON.stringify(payload));
 const headers=[['content-type','application/json'],
   ['x-tien404-offline-fixture','1'],
   [meta?'x-hub-signature-256':'x-bot-api-secret-token',meta?proof(bytes):ZALO]];
 const seen=new Set();
 const env={
   V17_7G_MODE:'OFFLINE_FIXTURE_ONLY',
   META_APP_SECRET_QA:META,ZALO_BOT_WEBHOOK_SECRET_QA:ZALO
 };
 const deps={mode:'LOCAL_TEST_ONLY',liveEnabled:false,nowMs:NOW,
   registry:{source:'OFFLINE_SERVER_REGISTRY',channel,
     installationRef:INSTALL,tenantRef:'tenant-qa-0001',
     storeRef:'store-A-qa-0001',providerRef:meta?PAGE:BOT,
     ownerBindingReal:false,allowCommerce:false,allowSend:false,noWrite:true},
   ratePermit:async()=>true,
   reserveOnce:async key=>{if(seen.has(key))return false;seen.add(key);return true}
 };
 return {channel,payload,bytes,headers,env,deps,method:'POST',
  url:'https://canary.invalid/_qa/v17-7g/'+(meta?'meta':'zalo-bot')};
}
function setHeader(f,key,value){
 f.headers=f.headers.filter(([k])=>k.toLowerCase()!==key.toLowerCase());
 if(value!==null)f.headers.push([key,value]);
}
function resign(f){
 f.bytes=encoder.encode(JSON.stringify(f.payload));
 if(f.channel==='MESSENGER')setHeader(f,'x-hub-signature-256',proof(f.bytes));
}
async function invoke(f,asDefault=false){
 const r=new Request(f.url,{
   method:f.method,headers:f.headers,
   body:f.method==='GET'?undefined:f.bytes
 });
 return asDefault?worker.fetch(r,f.env):
   handleOfflineSignedProviderRequest(r,f.env,f.deps);
}
const rejected=async(mutate,channel='MESSENGER')=>{
 const f=fixture(channel);mutate(f);const r=await invoke(f);
 assert.equal(r.status,404,'expected deny for '+channel);
 assert.equal(await r.text(),'');
 assert.equal(r.headers.get('cache-control'),'no-store');
};
for(const channel of ['MESSENGER','ZALO_BOT']){
 test(channel+' real Request/webcrypto local accepted only as fixture 204',async()=>{
   const f=fixture(channel);const r=await invoke(f);
   assert.equal(r.status,204);assert.equal(await r.text(),'');
   assert.equal(r.headers.get('cache-control'),'no-store');
 });
 test(channel+' exported default Worker fetch is permanently denied',async()=>{
   const r=await invoke(fixture(channel),true);assert.equal(r.status,404);
 });
 test(channel+' missing mode denies',async()=>rejected(f=>{delete f.env.V17_7G_MODE},channel));
 test(channel+' production mode denies',async()=>rejected(f=>{f.env.V17_7G_MODE='PRODUCTION'},channel));
 test(channel+' non QA secret denied',async()=>rejected(f=>{
   if(channel==='MESSENGER')f.env.META_APP_SECRET_QA='real';
   else f.env.ZALO_BOT_WEBHOOK_SECRET_QA='real';
 },channel));
 test(channel+' wrong host denies',async()=>rejected(f=>{f.url=f.url.replace('canary.invalid','example.com')},channel));
 test(channel+' query string denied',async()=>rejected(f=>{f.url+='?test=1'},channel));
 test(channel+' wrong path denied',async()=>rejected(f=>{f.url+='-other'},channel));
 test(channel+' wrong method denied',async()=>rejected(f=>{f.method='GET'},channel));
 test(channel+' missing fixture header denied',async()=>rejected(f=>setHeader(f,'x-tien404-offline-fixture',null),channel));
 test(channel+' invalid media type denied',async()=>rejected(f=>setHeader(f,'content-type','text/plain'),channel));
 test(channel+' compressed content denied',async()=>rejected(f=>setHeader(f,'content-encoding','gzip'),channel));
 test(channel+' oversized body denied',async()=>rejected(f=>{f.bytes=encoder.encode('a'.repeat(17000))},channel));
 test(channel+' declared Content-Length too long denied',async()=>rejected(f=>setHeader(f,'content-length','99999'),channel));
 test(channel+' unavailable rate limiter denies',async()=>rejected(f=>{delete f.deps.ratePermit},channel));
 test(channel+' exhausted rate limiter denies',async()=>rejected(f=>{f.deps.ratePermit=async()=>false},channel));
 test(channel+' unavailable durable replay denies',async()=>rejected(f=>{delete f.deps.reserveOnce},channel));
 test(channel+' unavailable replay service denies',async()=>rejected(f=>{f.deps.reserveOnce=async()=>{throw Error('offline')}},channel));
 test(channel+' untrusted registry source denies',async()=>rejected(f=>{f.deps.registry.source='CUSTOMER_JSON'},channel));
 test(channel+' registry owner=real self-claim denied',async()=>rejected(f=>{f.deps.registry.ownerBindingReal=true},channel));
 test(channel+' registry lacks Store denied',async()=>rejected(f=>{f.deps.registry.storeRef=''},channel));
 test(channel+' registry allows Commerce denied',async()=>rejected(f=>{f.deps.registry.allowCommerce=true},channel));
 test(channel+' registry allows sending denied',async()=>rejected(f=>{f.deps.registry.allowSend=true},channel));
 test(channel+' registry allows DB writes denied',async()=>rejected(f=>{f.deps.registry.noWrite=false},channel));
 test(channel+' stale provider message denied',async()=>rejected(f=>{
   if(channel==='MESSENGER')f.payload.entry[0].time=NOW-700000,
     f.payload.entry[0].messaging[0].timestamp=NOW-700000;
   else f.payload.result.message.date=NOW-700000;
   resign(f);
 },channel));
 test(channel+' future provider message denied',async()=>rejected(f=>{
   if(channel==='MESSENGER')f.payload.entry[0].messaging[0].timestamp=NOW+700000;
   else f.payload.result.message.date=NOW+700000;
   resign(f);
 },channel));
 test(channel+' event tries to choose Tenant denied',async()=>rejected(f=>{
   f.payload.tenantId='other-tenant';resign(f);
 },channel));
 test(channel+' invalid JSON signed correctly denied',async()=>rejected(f=>{
   f.bytes=encoder.encode('not valid JSON!');
   if(channel==='MESSENGER')setHeader(f,'x-hub-signature-256',proof(f.bytes));
 },channel));
 test(channel+' replay denied second time on same injected local registry',async()=>{
   const f=fixture(channel);
   const a=await invoke(f),b=await invoke(f);
   assert.equal(a.status,204);assert.equal(b.status,404);
 });
}
test('official nested Zalo Bot envelope passes and legacy root-only payload is rejected',async()=>{
 const f=fixture('ZALO_BOT');
 assert.equal((await invoke(f)).status,204);
 const old=fixture('ZALO_BOT');
 old.payload={event_name:'message.text.received',message:old.payload.result.message};
 resign(old);
 assert.equal((await invoke(old)).status,404);
});
test('Zalo Bot must include ok:true envelope',async()=>rejected(f=>{f.payload.ok=false;resign(f)},'ZALO_BOT'));
test('Zalo Bot unsupported special-user content is denied',async()=>rejected(f=>{f.payload.result.event_name='message.unsupported.received';resign(f)},'ZALO_BOT'));
test('Zalo Bot group chat cannot be treated as private',async()=>rejected(f=>{f.payload.result.message.chat.chat_type='GROUP';resign(f)},'ZALO_BOT'));
test('Zalo Bot wrong secret header denied',async()=>rejected(f=>setHeader(f,'x-bot-api-secret-token','QA_ONLY_wrong_header_secret_1234'),'ZALO_BOT'));
test('Zalo Bot duplicated secret-token header denied',async()=>rejected(f=>f.headers.push(['X-Bot-Api-Secret-Token',ZALO]),'ZALO_BOT'));
test('Zalo Bot cannot use OA X-ZEvent-Signature',async()=>rejected(f=>{
 setHeader(f,'x-bot-api-secret-token',null);
 setHeader(f,'x-zevent-signature','mac='+'a'.repeat(64));
},'ZALO_BOT'));
test('Zalo Bot refuses missing message_id',async()=>rejected(f=>{delete f.payload.result.message.message_id;resign(f)},'ZALO_BOT'));
test('Zalo Bot refuses customer-supplied Store authority inside result',async()=>rejected(f=>{f.payload.result.storeId='other-store';resign(f)},'ZALO_BOT'));
test('Meta tampering with signed raw bytes is rejected',async()=>rejected(f=>{
 f.bytes=encoder.encode(JSON.stringify(f.payload,null,2));
}));
test('Meta wrong signature rejected',async()=>rejected(f=>setHeader(f,'x-hub-signature-256','sha256='+'0'.repeat(64))));
test('Meta rejects duplicate signatures',async()=>rejected(f=>f.headers.push(['X-Hub-Signature-256',proof(f.bytes)])));
test('Meta rejects recipient Page mismatch',async()=>rejected(f=>{f.payload.entry[0].messaging[0].recipient.id='other-page-01';resign(f)}));
test('Meta rejects Page entry mismatch',async()=>rejected(f=>{f.payload.entry[0].id='other-page-01';resign(f)}));
test('Meta rejects message echo',async()=>rejected(f=>{f.payload.entry[0].messaging[0].message.is_echo=true;resign(f)}));
test('Meta rejects injected price in signed message',async()=>rejected(f=>{f.payload.entry[0].messaging[0].message.price=0;resign(f)}));
test('Meta refuses missing mid',async()=>rejected(f=>{delete f.payload.entry[0].messaging[0].message.mid;resign(f)}));
test('Meta rejects multiple message entries',async()=>rejected(f=>{f.payload.entry[0].messaging.push(f.payload.entry[0].messaging[0]);resign(f)}));
test('Meta refuses improper prefix',async()=>rejected(f=>setHeader(f,'x-hub-signature-256','mac='+'0'.repeat(64))));
test('Meta cannot use Bot header as signature',async()=>rejected(f=>{
 setHeader(f,'x-hub-signature-256',null);
 setHeader(f,'x-bot-api-secret-token',ZALO);
}));
