'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createStudio,FIXTURES,CHANNELS}=require('../v147-custom-studio/studio-core.js');
const {createUnifiedQaRouter,MODE}=require('./identity-core.cjs');
const {createSyntheticAdapterLab}=require('./provider-adapters.cjs');
const NOW=Date.parse('2026-11-16T06:00:00+09:00');
const key=c=>Buffer.from(('QA_ONLY_NATIVE_SIGNING_'+c+'_').repeat(4));
const secrets=Object.fromEntries(CHANNELS.map(c=>[c,key(c)]));
const inner=Object.fromEntries(CHANNELS.map(c=>[c,Buffer.from(('QA_ONLY_NORMALIZED_HMAC_'+c+'_').repeat(3))]));
const registry=Object.entries(FIXTURES).flatMap(([shop,s])=>CHANNELS.map(channel=>({
 id:'bind_'+shop+'_'+channel,shop,channel,environment:'qa_staging',
 provider_account_ref:'qa_account_'+channel+'_'+shop,
 provider_bot_ref:'qa_bot_'+channel+'_'+shop,
 tenant_id:s.tenantId,store_id:s.storeId,
 bot_profile_id:'qa_profile_'+shop+'_'+channel,
 status:'ACTIVE',subscription_active:true,verified_until_ms:NOW+120000,configuration_version:1
})));
let seq=0;
function create(){
 const router=createUnifiedQaRouter({mode:MODE,secretByChannel:inner,bindings:registry,
 studio:createStudio(),now:()=>NOW});
 const adapters=createSyntheticAdapterLab({mode:'SYNTHETIC_PROVIDER_ENVELOPE_QA_ONLY',
 router,providerFixtureSecrets:secrets});
 return {router,adapters};
}
function raw(channel,shop='A',text='Báo giá A001',overrides={}){
 const b=registry.find(x=>x.channel===channel&&x.shop===shop);
 const user='qa_same_user_string_01',conversation='qa_conversation_001';
 const eventId='qa_evt_'+String(++seq).padStart(10,'0');
 let obj;
 if(channel==='MESSENGER')obj={object:'page',entry:[{id:b.provider_account_ref,
 messaging:[{sender:{id:user},recipient:{id:b.provider_bot_ref},
 message:{mid:eventId,text,is_echo:false},timestamp_ms:NOW}]}]};
 else if(channel==='ZALO_BOT')obj={object:'bot_update',bot_id:b.provider_bot_ref,
 account_id:b.provider_account_ref,update_id:eventId,
 message:{from:{id:user},chat:{id:conversation},text},timestamp_ms:NOW};
 else if(channel==='ZALO_OA')obj={object:'oa_event',
 oa_id:b.provider_account_ref,bot_ref:b.provider_bot_ref,event_id:eventId,
 user:{id:user},conversation_ref:conversation,text,timestamp_ms:NOW};
 else obj={object:'widget_session_event',site_id:b.provider_account_ref,
 widget_id:b.provider_bot_ref,event_id:eventId,
 session:{user_ref:user,conversation_ref:conversation},text,timestamp_ms:NOW};
 return {...obj,...overrides};
}
function call(lab,channel,shop='A',text='Báo giá A001',overrides={}){
 const obj=raw(channel,shop,text,overrides),
 rawBody=Buffer.from(JSON.stringify(obj),'utf8');
 return lab.adapters.handle({channel,rawBody,
 signature:lab.adapters.signSyntheticProviderFixture(channel,rawBody)});
}
function assertNoSend(r){
 assert.equal(r.provider_sends,0);assert.equal(r.actual_order_writes,0);
 assert.equal(r.hosted_writes,0);assert.equal(r.can_send,false);
 assert.equal(r.real_provider_auth_verified,false);
}
test('001 only explicitly synthetic provider envelope mode allowed',()=>{
 const {router}=create();
 assert.throws(()=>createSyntheticAdapterLab({mode:'LIVE',router,providerFixtureSecrets:secrets}),
  /QA_PROVIDER_ADAPTER_CONFIG_INVALID/);
});
test('002 all four provider QA signing keys required',()=>{
 const {router}=create();
 assert.throws(()=>createSyntheticAdapterLab({mode:'SYNTHETIC_PROVIDER_ENVELOPE_QA_ONLY',
 router,providerFixtureSecrets:{MESSENGER:secrets.MESSENGER}}),
 /QA_PROVIDER_SECRET_NOT_CONFIGURED/);
});
for(const channel of CHANNELS){
 for(const shop of ['A','B','C']){
  test('003 '+channel+'/'+shop+' native fixture reaches correct Store pricing',()=>{
   const lab=create(),r=call(lab,channel,shop);
   assertNoSend(r);assert.equal(r.status,'RESOLVED');
   assert.equal(r.tenant_id,FIXTURES[shop].tenantId);
   assert.equal(r.store_id,FIXTURES[shop].storeId);
   assert.equal(r.unit_price_vnd,FIXTURES[shop].product.priceVnd);
   assert.equal(r.route_path,'FAST');
  });
 }
 test('004 '+channel+' rejects missing native fixture HMAC',()=>{
  const lab=create(),rawBody=Buffer.from(JSON.stringify(raw(channel)));
  const r=lab.adapters.handle({channel,rawBody,signature:''});
  assert.equal(r.status,'DENIED');assertNoSend(r);
 });
 test('005 '+channel+' rejects native payload tampering',()=>{
  const lab=create(),rawBody=Buffer.from(JSON.stringify(raw(channel)));
  const signature=lab.adapters.signSyntheticProviderFixture(channel,rawBody);
  const tampered=Buffer.from(rawBody.toString('utf8').replace('Báo giá A001','Đặt 2 A001'));
  const r=lab.adapters.handle({channel,rawBody:tampered,signature});
  assert.equal(r.status,'DENIED');assertNoSend(r);
 });
 test('006 '+channel+' fails closed for forged Shop metadata',()=>{
  const lab=create(),r=call(lab,channel,'A','Báo giá A001',{store_id:FIXTURES.B.storeId});
  assert.equal(r.status,'DENIED');assertNoSend(r);
 });
}
test('007 Web Widget extra session admin claim is not trusted',()=>{
 const lab=create(),obj=raw('WEB_WIDGET','A');
 obj.session.admin=true;
 const bytes=Buffer.from(JSON.stringify(obj));
 const r=lab.adapters.handle({channel:'WEB_WIDGET',rawBody:bytes,
  signature:lab.adapters.signSyntheticProviderFixture('WEB_WIDGET',bytes)});
 assert.equal(r.status,'DENIED');assertNoSend(r);
});
test('008 Messenger batch with two messages rejected for ambiguity',()=>{
 const lab=create(),obj=raw('MESSENGER','A');
 obj.entry[0].messaging.push({...obj.entry[0].messaging[0]});
 const bytes=Buffer.from(JSON.stringify(obj));
 assert.equal(lab.adapters.handle({channel:'MESSENGER',rawBody:bytes,
  signature:lab.adapters.signSyntheticProviderFixture('MESSENGER',bytes)}).status,'DENIED');
});
test('009 Messenger Page echo rejected for any routing or response',()=>{
 const lab=create(),obj=raw('MESSENGER','A');obj.entry[0].messaging[0].message.is_echo=true;
 const bytes=Buffer.from(JSON.stringify(obj));
 const r=lab.adapters.handle({channel:'MESSENGER',rawBody:bytes,
  signature:lab.adapters.signSyntheticProviderFixture('MESSENGER',bytes)});
 assert.equal(r.status,'DENIED');assertNoSend(r);
});
test('010 Zalo OA account binding mismatch denies',()=>{
 const lab=create(),r=call(lab,'ZALO_OA','A','Báo giá A001',{oa_id:'qa_unknown_oa_account'});
 assert.equal(r.status,'DENIED');assert.equal(r.reason,'CHANNEL_BINDING_NOT_ACTIVE_OR_EXPIRED');
});
test('011 Zalo Bot signature from OA key cannot authorize Bot',()=>{
 const lab=create(),body=Buffer.from(JSON.stringify(raw('ZALO_BOT','A')));
 const wrong=lab.adapters.signSyntheticProviderFixture('ZALO_OA',body);
 assert.equal(lab.adapters.handle({channel:'ZALO_BOT',rawBody:body,signature:wrong}).status,'DENIED');
});
test('012 identical user aliases on Messenger and Zalo are not one customer',()=>{
 const lab=create(),a=call(lab,'MESSENGER','A'),b=call(lab,'ZALO_BOT','A');
 assert.notEqual(a.customer_id,b.customer_id);
});
test('013 provider-native replay accepted once only',()=>{
 const lab=create(),bytes=Buffer.from(JSON.stringify(raw('ZALO_BOT','A')));
 const signature=lab.adapters.signSyntheticProviderFixture('ZALO_BOT',bytes);
 const arg={channel:'ZALO_BOT',rawBody:bytes,signature};
 assert.equal(lab.adapters.handle(arg).status,'RESOLVED');
 assert.equal(lab.adapters.handle(arg).status,'DUPLICATE');
});
test('014 Zalo Bot order intent is blocked, not submitted',()=>{
 const lab=create(),r=call(lab,'ZALO_BOT','A','Mua 2 gói A001');
 assert.equal(r.resolution_status,'TRANSACTION_BLOCKED_NO_WRITE');
 assertNoSend(r);
});
test('015 Website Widget user-provided store header rejected',()=>{
 const lab=create(),r=call(lab,'WEB_WIDGET','A','Báo giá A001',{tenant_id:'qa_tenant_2'});
 assert.equal(r.status,'DENIED');assertNoSend(r);
});
test('016 revoked Shop A denies all native fixtures, even after warm cache',()=>{
 const lab=create();call(lab,'MESSENGER','A');
 lab.router.qaSetStorePolicy('A',{status:'SUSPENDED',subscriptionActive:true});
 for(const c of CHANNELS){const r=call(lab,c,'A');assert.equal(r.status,'DENIED');}
});
test('017 provider-specific shape is NOT claimed to be live verified',()=>{
 const lab=create();assert.equal(lab.adapters.inspect().provider_documented_signatures_implemented,false);
 assert.equal(lab.adapters.inspect().can_publish,false);
});
test('018 no native adapter returns raw PSID, phone or event text',()=>{
 const lab=create(),r=call(lab,'MESSENGER','A','Báo giá A001');
 assert.ok(!JSON.stringify(r).includes('qa_same_user_string_01'));
 assert.ok(!JSON.stringify(r).includes('signature'));
});
test('019 no provider send or real LLM function is available',()=>{
 const lab=create(),r=call(lab,'ZALO_OA','B','Tư vấn chi tiết');
 assert.equal(r.real_llm_calls,0);assert.equal(r.provider_sends,0);
});
test('020 invalid JSON signed bytes rejected',()=>{
 const lab=create(),rawBody=Buffer.from('broken-json');
 const signature=lab.adapters.signSyntheticProviderFixture('MESSENGER',rawBody);
 assert.equal(lab.adapters.handle({channel:'MESSENGER',rawBody,signature}).status,'DENIED');
});
test('021 unknown provider channel is blocked, not remapped to default',()=>{
 const lab=create(),rawBody=Buffer.from('{}');
 const r=lab.adapters.handle({channel:'TELEGRAM',rawBody,signature:'sha256='+'0'.repeat(64)});
 assert.equal(r.status,'DENIED');
});
test('022 expired Shop B subscription blocks Zalo OA and Messenger',()=>{
 const lab=create();lab.router.qaSetStorePolicy('B',{status:'ACTIVE',subscriptionActive:false});
 for(const c of ['MESSENGER','ZALO_OA'])assert.equal(call(lab,c,'B').status,'DENIED');
});
test('023 strict non-PII logs, real external I/O absent in adapter source',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const src=fs.readFileSync(path.join(__dirname,'provider-adapters.cjs'),'utf8');
 for(const t of ['fetch(', 'axios(', 'process.env.', 'graph.facebook.com',
 'executeWorkflow(', 'createClient(', 'googleSheets.append(']){
  assert.equal(src.includes(t),false,t);
 }
});
