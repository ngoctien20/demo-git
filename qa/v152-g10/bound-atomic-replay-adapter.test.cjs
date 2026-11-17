'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const {createBoundClaimOnce,summarizeShadowReadiness,CONTRACT}=
 require('./bound-atomic-replay-adapter.cjs');
const QA_PEPPER=crypto.randomBytes(32);
const INSTALL='QA_ONLY_PRIVATE_META_PAGE';
const EVENT='a'.repeat(64),EVENT2='b'.repeat(64);
const RAW=Buffer.from('{"object":"page","qa":"atomic replay only"}','utf8');
const original=()=>({
 realMessengerVerified:true,realLegacyProviderSendOccurred:true,
 shadowBridgeInvoked:true,shadowCoreDeniedUnknownStore:true,
 shadowProviderSends:0,shadowOrdersWritten:0,shadowModelCalls:0,
 atomicReplayConcurrentlyTested:false,realReplayOnSignedWebhookObserved:false,
 independentStoreOwnerProven:false
});
const safeLedger=()=>{
 const rows=new Map();const calls=[];
 return {
  calls,rows,
  async claimOnce({provider,installationDigest,eventDigest,payloadDigest}){
   assert.equal(provider,'MESSENGER');
   for(const digest of [installationDigest,eventDigest,payloadDigest])
    assert.equal(Buffer.isBuffer(digest)&&digest.length===32,true);
   const key=installationDigest.toString('hex')+':'+eventDigest.toString('hex');
   const body=payloadDigest.toString('hex');
   calls.push({key,body});
   if(!rows.has(key)){rows.set(key,body);return 'claimed';}
   return rows.get(key)===body?'duplicate':'conflict';
  }
 };
};
const make=(ledger=safeLedger(),overrides={})=>
 createBoundClaimOnce({storageClient:ledger,replayPepper:QA_PEPPER,
  installationRef:INSTALL,rawBody:RAW,...overrides});
const err=e=>e?.message==='G10_PRIVATE_REPLAY_CLAIM_DENIED';
test('receipt claim stores only fixed 32-byte digests without Page or raw MID',async()=>{
 const ledger=safeLedger(),claim=make(ledger);
 assert.equal(await claim(EVENT),'claimed');
 assert.equal(ledger.rows.size,1);
 const safe=JSON.stringify(ledger.calls);
 for(const secret of [INSTALL,EVENT,RAW.toString('utf8'),QA_PEPPER.toString('hex')])
  assert.equal(safe.includes(secret),false);
});
test('single duplicate by same Page MID and raw payload returns duplicate',async()=>{
 const c=make();
 assert.equal(await c(EVENT),'claimed');
 assert.equal(await c(EVENT),'duplicate');
});
test('in-memory simulation of 50 parallel same-message claims across independently configured clients',async()=>{
 const ledger=safeLedger();
 const clients=Array.from({length:50},()=>make(ledger));
 const result=await Promise.all(clients.map(c=>c(EVENT)));
 assert.equal(result.filter(x=>x==='claimed').length,1);
 assert.equal(result.filter(x=>x==='duplicate').length,49);
 assert.equal(ledger.rows.size,1);
});
test('same MID with changed payload is a conflict and is never considered duplicate',async()=>{
 const ledger=safeLedger();
 assert.equal(await make(ledger)(EVENT),'claimed');
 const changed=make(ledger,{rawBody:Buffer.from('{"qa":"attacker modified payload"}')});
 await assert.rejects(changed(EVENT),err);
});
test('same Page different MID makes distinct safe claims',async()=>{
 const ledger=safeLedger();
 assert.equal(await make(ledger)(EVENT),'claimed');
 assert.equal(await make(ledger)(EVENT2),'claimed');
 assert.equal(ledger.rows.size,2);
});
test('same MID different isolated installation does not share Page scope',async()=>{
 const ledger=safeLedger();
 assert.equal(await make(ledger)(EVENT),'claimed');
 assert.equal(await make(ledger,{installationRef:'QA_OTHER_META_PAGE'})(EVENT),'claimed');
 assert.equal(ledger.rows.size,2);
});
test('changing private stable HMAC pepper changes digests (operator must lock epoch)',async()=>{
 const ledger=safeLedger();
 assert.equal(await make(ledger)(EVENT),'claimed');
 const newer=make(ledger,{replayPepper:crypto.randomBytes(32)});
 assert.equal(await newer(EVENT),'claimed');
 assert.equal(ledger.rows.size,2);
});
test('invalid digest receipt is never logged or accepted',async()=>{
 await assert.rejects(make()('QA_MID_UNHASHED'),err);
 await assert.rejects(make()('0'.repeat(63)),err);
});
test('private replay pepper must be a >=32 byte Buffer',()=>{
 assert.throws(()=>make(safeLedger(),{replayPepper:'fake-string'}),err);
 assert.throws(()=>make(safeLedger(),{replayPepper:Buffer.alloc(16)}),err);
 assert.throws(()=>make(safeLedger(),{replayPepper:Buffer.alloc(129)}),err);
});
test('source refuses unsupported Zalo OA or non Messenger provider',()=>{
 assert.throws(()=>make(safeLedger(),{provider:'ZALO_OA'}),err);
 assert.throws(()=>make(safeLedger(),{provider:'ZALO_BOT'}),err);
});
test('source refuses an empty or oversized raw body',()=>{
 assert.throws(()=>make(safeLedger(),{rawBody:Buffer.alloc(0)}),err);
 assert.throws(()=>make(safeLedger(),{rawBody:Buffer.alloc(32769)}),err);
});
test('source refuses arbitrary external installation references',()=>{
 assert.throws(()=>make(safeLedger(),{installationRef:'../../production'}),err);
 assert.throws(()=>make(safeLedger(),{installationRef:''}),err);
});
test('source refuses missing durable repository',()=>{
 assert.throws(()=>createBoundClaimOnce({storageClient:null,replayPepper:QA_PEPPER,
  installationRef:INSTALL,rawBody:RAW}),err);
});
test('SQL connection error must deny claim (no in-memory fallback)',async()=>{
 const client={claimOnce:async()=>{throw Error('PRIVATE_DB_EXCEPTION')}};
 const adapter=make(client);
 await assert.rejects(adapter(EVENT),err);
});
test('SQL returns conflict => throw and allow pinned V17 to issue HTTP 503',async()=>{
 const client={claimOnce:async()=> 'conflict'};
 await assert.rejects(make(client)(EVENT),err);
});
test('SQL returns unknown => throw and fail closed',async()=>{
 const client={claimOnce:async()=> 'ok'};
 await assert.rejects(make(client)(EVENT),err);
});
test('invalid claim input cannot be rescued by an all-green claim return',async()=>{
 const client={claimOnce:async()=> 'claimed'};
 await assert.rejects(make(client)('NOT_HASHED'),err);
});
test('diagnostic distinguishes real signed legacy send from shadow no-send',()=>{
 const r=summarizeShadowReadiness(original());
 assert.equal(r.shadowSingleRealSignedEventVerified,true);
 assert.equal(r.realProviderReplayTested,false);
 assert.equal(r.atomicReplayConcurrentlyTestedInDisposableDb,false);
 assert.equal(r.status,'REAL_SHADOW_RECEIPT_ONLY__DURABLE_REPLAY_NOT_DEPLOYED__HOSTED_NO_GO');
 assert.equal(r.canPublish,false);
 assert.equal(r.canSend,false);
 assert.equal(r.canAccessRealStore,false);
});
test('even self-reported all-green evidence never deploys or sends',()=>{
 const fake=original();
 fake.atomicReplayConcurrentlyTested=true;
 fake.realReplayOnSignedWebhookObserved=true;
 fake.independentStoreOwnerProven=true;
 const r=summarizeShadowReadiness(fake);
 assert.equal(r.canPublish,false);assert.equal(r.canSend,false);
 assert.equal(r.canAccessRealStore,false);
 assert.equal(r.canMigrateHostedRls,false);
});
test('negative shadow counter or changed evidence means not verified',()=>{
 const x=original();x.shadowModelCalls=1;
 assert.equal(summarizeShadowReadiness(x).shadowSingleRealSignedEventVerified,false);
});
test('extra status flags from client cannot alter release gate',()=>{
 const x=original();x.realSignedProviderGoLive=true;
 assert.throws(()=>summarizeShadowReadiness(x),err);
});
test('no raw Meta Page, PSID, secrets or customer text in diagnostic',()=>{
 const s=JSON.stringify(summarizeShadowReadiness(original()));
 for(const x of [INSTALL,EVENT,QA_PEPPER.toString('hex'),'customer_text'])
  assert.equal(s.includes(x),false);
});
test('G10 adapter genuinely integrates with exact pinned V17.1E handler without editing its code',async()=>{
 const module=await import(pathToFileURL(path.resolve(__dirname,
  '../../.g10_v171/qa/v171e-meta-real-event/isolated-meta-no-send.mjs')).href);
 assert.equal(module.CONTRACT,'T404_V171E_ISOLATED_SIGNED_NOSEND_V1');
 const now=Date.parse('2026-11-17T04:30:00Z');
 const secret='QA_PRIVATE_G10_META_SECRET_NOT_REAL';
 const page='9900000001';
 const body=Buffer.from(JSON.stringify({
  object:'page',entry:[{id:page,messaging:[{
   sender:{id:'9900000011'},recipient:{id:page},timestamp:now,
   message:{mid:'QA_G10_1',text:'QA test only'}
  }]}]
 }));
 const sign=()=> 'sha256='+crypto.createHmac('sha256',secret).update(body).digest('hex');
 const ledger=safeLedger();
 const config={
  appSecret:secret,verifyToken:'QA_PRIVATE_G10_VERIFY_ONLY',
  qaPageId:page,qaTesterPsid:'9900000011',qaAppId:'8800000002',
  productionAppId:'8800000001',productionPageId:'9900000009',
  ownerApproval:{
   qaAppPageIsolated:true,callbackPermissionGranted:true,
   merchantPageControlVerified:true,evidenceReference:'PRIVATE_FAKE_G10_TEST',
   productionAppCallbackUnchanged:true
  },
  claimOnce:make(ledger,{rawBody:body,installationRef:'QA_G10_PAGE_TEST'})
 };
 const request={method:'POST',url:'https://qa.invalid/G10',headers:{'x-hub-signature-256':sign()},rawBody:body};
 const first=await module.handleIsolatedMeta(request,config,()=>now);
 const second=await module.handleIsolatedMeta(request,config,()=>now);
 assert.equal(first.status,'SIGNED_QA_EVENT_NO_SEND');
 assert.equal(second.status,'DUPLICATE_IGNORED');
 assert.equal(first.meta_outbound,0);
 assert.equal(second.meta_outbound,0);
 assert.equal(ledger.rows.size,1);
 assert.equal(first.accepted_as_real_provider_delivery,false);
 const altered=Buffer.from(body.toString().replace('QA test only','QA altered text'));
 const denied=await module.handleIsolatedMeta({...request,rawBody:altered},config,()=>now);
 assert.equal(denied.status,'BLOCKED');
 assert.equal(denied.reason,'META_HMAC_MISMATCH');
});
