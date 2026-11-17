import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {simulateOaNoSendWebhook} from './oa-04c-signed-canary-offline.mjs';
const NOW=1794900000000;
function fixture(){
 const f={executionMode:'OFFLINE_FIXTURE_ONLY',liveEnabled:false,nowMs:NOW,
   appId:'360846524940903967',oaId:'388613280879808645',
   secret:'qa-synthetic-not-a-real-provider-secret-04c',replay:new Set()};
 f.event={app_id:f.appId,event_name:'user_send_text',
   sender:{id:'synthetic-user-1'},recipient:{id:f.oaId},
   message:{msg_id:'synthetic-message-1',text:'QA_ONLY'},
   timestamp:String(NOW-1000)};
 f.installation={id:'install-fixture-1',appId:f.appId,oaId:f.oaId,
   provider:'ZALO_OA',status:'PENDING_REVIEW',noSend:true,
   catalogReadEnabled:false,secret:f.secret,
   tenantId:'tenant-1',storeId:'store-A'};
 f.resolveStagingInstallation=async()=>f.installation;
 f.reserveReplay=async(k,ttl)=>{assert.equal(ttl,24*3600*1000);
   if(f.replay.has(k))return false;f.replay.add(k);return true};
 return f;
}
function request(f){
 const rawBody=Buffer.from(JSON.stringify(f.event));
 const sig=createHash('sha256').update(f.appId,'utf8')
  .update(rawBody).update(f.event.timestamp,'utf8').update(f.secret,'utf8').digest('hex');
 return {rawBody,headers:{'x-zevent-signature':'mac='+sig,'content-type':'application/json'}};
}
async function denied(code,mutate){
 const f=fixture();mutate?.(f);
 const r=await simulateOaNoSendWebhook(request(f),f);
 assert.equal(r.accepted,false,JSON.stringify(r));assert.equal(r.reason,code);
 assert.equal(r.canSend,false);assert.equal(r.providerVerified,false);
}
test('signed synthetic fixture admitted without provider ownership',async()=>{
 const f=fixture(),r=await simulateOaNoSendWebhook(request(f),f);
 assert.equal(r.accepted,true);assert.equal(r.providerVerified,false);
 assert.equal(r.liveTrafficAccepted,false);assert.equal(r.canSend,false);
 assert.equal(r.commerceWrites,0);assert.equal(r.providerSends,0);
 assert.equal(JSON.stringify(r).includes(f.secret),false);
});
test('duplicate event denied by atomic replay fixture',async()=>{
 const f=fixture(),req=request(f);
 assert.equal((await simulateOaNoSendWebhook(req,f)).accepted,true);
 assert.equal((await simulateOaNoSendWebhook(req,f)).reason,'DUPLICATE_OR_REPLAY');
});
test('no deps denies',async()=>{
 assert.equal((await simulateOaNoSendWebhook({},{})).reason,'HOSTED_OR_UNTRUSTED_ADMISSION_FORBIDDEN');
});
test('live mode forbidden',async()=>denied('HOSTED_OR_UNTRUSTED_ADMISSION_FORBIDDEN',f=>{f.liveEnabled=true;}));
test('empty raw body denied',async()=>{
 const f=fixture();assert.equal((await simulateOaNoSendWebhook({rawBody:Buffer.alloc(0)},f)).reason,'RAW_BODY_REQUIRED');
});
test('oversized raw denied',async()=>{
 const f=fixture();assert.equal((await simulateOaNoSendWebhook({rawBody:Buffer.alloc(128*1024+1)},f)).reason,'RAW_BODY_REQUIRED');
});
test('malformed JSON denied',async()=>{
 const f=fixture();assert.equal((await simulateOaNoSendWebhook({rawBody:Buffer.from('{{')},f)).reason,'INVALID_JSON');
});
test('unsupported outgoing OA event denied',async()=>denied('NOT_A_SUPPORTED_OA_EVENT',f=>{f.event.event_name='oa_send_text';}));
test('event spoof wrong recipient rejected',async()=>denied('UNTRUSTED_OR_MISMATCHED_OA_INSTALLATION',f=>{f.event.recipient.id='388613280879808646';}));
test('stale webhook denied',async()=>denied('STALE_OR_INVALID_TIMESTAMP',f=>{f.event.timestamp=String(NOW-600000);}));
test('timestamp numeric denied',async()=>denied('NOT_A_SUPPORTED_OA_EVENT',f=>{f.event.timestamp=NOW-1000;}));
test('registry without pending review denied',async()=>denied('UNTRUSTED_OR_MISMATCHED_OA_INSTALLATION',f=>{f.installation.status='active';}));
test('registry now sends messages denied',async()=>denied('UNTRUSTED_OR_MISMATCHED_OA_INSTALLATION',f=>{f.installation.noSend=false;}));
test('registry now reads Commerce denied',async()=>denied('UNTRUSTED_OR_MISMATCHED_OA_INSTALLATION',f=>{f.installation.catalogReadEnabled=true;}));
test('registry unavailable denied',async()=>denied('PRIVATE_REGISTRY_READ_FAILURE',f=>{f.resolveStagingInstallation=async()=>{throw Error('offline');};}));
test('replay service unavailable denied',async()=>denied('DURABLE_REPLAY_UNAVAILABLE',f=>{f.reserveReplay=async()=>{throw Error('offline');};}));
test('signature cannot be forged by webhook json',async()=>{
 const f=fixture(),req=request(f);
 req.rawBody=Buffer.from(JSON.stringify({...f.event,message:{msg_id:'another',text:'QA_ONLY'}}));
 assert.equal((await simulateOaNoSendWebhook(req,f)).reason,'OA_SIGNATURE_INVALID');
});
test('wrong OAuth/Zalo Bot secret never validates OA MAC',async()=>{
 const f=fixture(),req=request(f);
 req.headers={'x-bot-api-secret-token':f.secret};
 assert.equal((await simulateOaNoSendWebhook(req,f)).reason,'OA_MAC_MISSING_OR_AMBIGUOUS');
});
test('duplicate OA signature variants rejected',async()=>{
 const f=fixture(),req=request(f);req.headers['X-ZEvent-Signature']=req.headers['x-zevent-signature'];
 assert.equal((await simulateOaNoSendWebhook(req,f)).reason,'OA_MAC_MISSING_OR_AMBIGUOUS');
});
test('provider payload wrong tenant cannot override trusted registry',async()=>{
 const f=fixture(),req=request(f);
 req.rawBody=Buffer.from(JSON.stringify({...f.event,tenantId:'tenant-B',storeId:'store-B'}));
 assert.equal((await simulateOaNoSendWebhook(req,f)).reason,'OA_SIGNATURE_INVALID');
});
