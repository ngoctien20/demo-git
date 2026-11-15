'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createHmac}=require('node:crypto');
const {createStudio,FIXTURES,CHANNELS}=require('../v147-custom-studio/studio-core.js');
const {createUnifiedQaRouter,CONTRACT_VERSION,MODE}=require('./identity-core.cjs');
const NOW=Date.parse('2026-11-16T06:00:00+09:00');
const keyFor=Object.fromEntries(CHANNELS.map(c=>[c,Buffer.from(('QA_SYNTHETIC_'+c+'_NOT_A_REAL_PROVIDER_SECRET_').repeat(2))]));
const bindings=Object.entries(FIXTURES).flatMap(([shop,f])=>CHANNELS.map(channel=>({
 id:'binding_'+channel+'_'+shop,channel,environment:'qa_staging',
 provider_account_ref:'qa_account_'+channel+'_'+shop,
 provider_bot_ref:'qa_bot_'+channel+'_'+shop,
 tenant_id:f.tenantId,store_id:f.storeId,
 bot_profile_id:'qa_profile_'+channel+'_'+shop,shop,status:'ACTIVE',
 subscription_active:true,verified_until_ms:NOW+86400000,configuration_version:1
})));
let serial=0;
function create(custom={}){
 const studio=custom.studio||createStudio();
 let clock=NOW;
 const engine=createUnifiedQaRouter({
  mode:MODE,secretByChannel:keyFor,bindings,studio,now:()=>clock,
  ...custom
 });
 return {engine,studio,advance:n=>clock+=n};
}
function payload(channel='MESSENGER',shop='A',text='Xin chào',overrides={}){
 const rec=bindings.find(b=>b.shop===shop&&b.channel===channel);
 return {channel,environment:'qa_staging',provider_account_ref:rec.provider_account_ref,
  provider_bot_ref:rec.provider_bot_ref,provider_user_ref:'qa_user_same_for_test',
  provider_conversation_ref:'qa_conv_00000001',
  event_id:'qa_event_'+String(++serial).padStart(8,'0'),
  event_type:'message',text,timestamp_ms:NOW,...overrides};
}
function send(engine,channel='MESSENGER',shop='A',text='Xin chào',overrides={}){
 const obj=payload(channel,shop,text,overrides);
 const rawBody=Buffer.from(JSON.stringify(obj),'utf8');
 return engine.processSignedFixture({
  channel,rawBody,signature:engine.signFixture(channel,rawBody)
 });
}
function invariant(r){
 assert.equal(r.provider_sends,0);assert.equal(r.actual_order_writes,0);
 assert.equal(r.hosted_writes,0);assert.equal(r.real_llm_calls,0);
 assert.equal(r.can_send,false);assert.equal(r.can_write_orders,false);
 assert.equal('token' in r,false);assert.equal('secret' in r,false);
 assert.equal('provider_user_ref' in r,false);
 return r;
}
test('001 mode must explicitly require offline fixture protocol',()=>{
 assert.throws(()=>create({mode:'LIVE'}),/QA_RESOLVER_CONFIG_INVALID/);
});
test('002 test fixture keys required for each of four channels',()=>{
 assert.throws(()=>create({secretByChannel:{MESSENGER:keyFor.MESSENGER}}),
  /QA_CHANNEL_TEST_SIGNING_KEY_MISSING/);
});
test('003 registry cannot have duplicate active provider account binding',()=>{
 assert.throws(()=>create({bindings:[bindings[0],bindings[0]]}),/QA_ACTIVE_BINDING_AMBIGUOUS/);
});
test('004 duplicate binding ID across distinct provider must be rejected',()=>{
 assert.throws(()=>create({bindings:[bindings[0],{...bindings[1],id:bindings[0].id}]}),
  /QA_ACTIVE_BINDING_AMBIGUOUS/);
});
test('005 registry cannot assign Shop B under Shop A tenant',()=>{
 assert.throws(()=>create({bindings:[{...bindings[0],tenant_id:FIXTURES.C.tenantId}]}),
  /QA_BINDING_REGISTRY_INVALID/);
});
test('006 all expected channel types registered',()=>assert.deepEqual(CHANNELS.slice(),
 ['MESSENGER','ZALO_BOT','ZALO_OA','WEB_WIDGET']));
for(const channel of CHANNELS){
 test('007 '+channel+' signed greeting resolves correct Shop A IDs',()=>{
  const {engine}=create(),r=invariant(send(engine,channel,'A'));
  assert.equal(r.status,'RESOLVED');assert.equal(r.trusted,true);
  assert.equal(r.tenant_id,FIXTURES.A.tenantId);
  assert.equal(r.store_id,FIXTURES.A.storeId);
  assert.equal(r.channel_binding_id,'binding_'+channel+'_A');
  assert.equal(r.bot_profile_id,'qa_profile_'+channel+'_A');
  assert.equal(r.resolution_status,'FAST_REPLY_READY');
  assert.equal(r.route_path,'FAST');
 });
 test('008 '+channel+' Shop B route uses B price despite same SKU',()=>{
  const {engine}=create(),r=invariant(send(engine,channel,'B','Báo giá A001'));
  assert.equal(r.unit_price_vnd,209000);
  assert.equal(r.stock_snapshot,8);
  assert.equal(r.store_id,FIXTURES.B.storeId);
 });
 test('009 '+channel+' Shop C route uses independent tenant & price',()=>{
  const {engine}=create(),r=invariant(send(engine,channel,'C','Báo giá A001'));
  assert.equal(r.tenant_id,FIXTURES.C.tenantId);
  assert.equal(r.unit_price_vnd,259000);
  assert.equal(r.stock_snapshot,2);
 });
 test('010 '+channel+' does not expose provider user ID or untrusted event text',()=>{
  const {engine}=create(),r=invariant(send(engine,channel,'A','Báo giá A001'));
  assert.ok(!JSON.stringify(r).includes('qa_user_same_for_test'));
  assert.ok(r.customer_id.startsWith('customer_'));
  assert.ok(r.conversation_id.startsWith('conversation_'));
 });
}
test('011 customer ID is stable within same binding and provider user',()=>{
 const {engine}=create();
 const a=send(engine),b=send(engine);
 assert.equal(a.customer_id,b.customer_id);
 assert.equal(a.conversation_id,b.conversation_id);
});
test('012 same string providerUser does NOT merge Messenger and Zalo customers',()=>{
 const {engine}=create();
 const a=send(engine,'MESSENGER'),b=send(engine,'ZALO_BOT');
 assert.notEqual(a.customer_id,b.customer_id);
 assert.notEqual(a.conversation_id,b.conversation_id);
});
test('013 same providerUser across Store A/B remains separate',()=>{
 const {engine}=create();
 assert.notEqual(send(engine,'MESSENGER','A').customer_id,
  send(engine,'MESSENGER','B').customer_id);
});
test('014 same providerUser across Zalo Bot/OA never auto-joins',()=>{
 const {engine}=create();
 assert.notEqual(send(engine,'ZALO_BOT').customer_id,send(engine,'ZALO_OA').customer_id);
});
test('015 client-supplied tenant_id is denied even with HMAC test signature',()=>{
 const {engine}=create(),r=send(engine,'MESSENGER','A','Báo giá A001',
  {tenant_id:FIXTURES.B.tenantId});
 assert.equal(r.status,'DENIED');assert.equal(r.reason,'NORMALIZED_EVENT_INVALID_OR_SCOPE_OVERRIDE');
});
test('016 client-supplied store_id is denied',()=>{
 const {engine}=create();
 assert.equal(send(engine,'MESSENGER','A','Xin chào',{store_id:FIXTURES.B.storeId}).status,'DENIED');
});
test('017 client-supplied admin role cannot change Store',()=>{
 const {engine}=create();
 assert.equal(send(engine,'MESSENGER','A','Xin chào',{admin:true}).status,'DENIED');
});
test('018 client-supplied binding ID override rejected',()=>{
 const {engine}=create();
 assert.equal(send(engine,'MESSENGER','A','Xin chào',
  {channel_binding_id:'binding_MESSENGER_B'}).status,'DENIED');
});
test('019 invalid HMAC rejected before event processing',()=>{
 const {engine}=create(),data=payload(),rawBody=Buffer.from(JSON.stringify(data));
 const r=engine.processSignedFixture({channel:'MESSENGER',rawBody,
  signature:'sha256='+'0'.repeat(64)});
 assert.equal(r.status,'DENIED');assert.equal(r.reason,'SIGNED_FIXTURE_INVALID');
});
test('020 missing HMAC rejected',()=>{
 const {engine}=create(),r=engine.processSignedFixture({
  channel:'MESSENGER',rawBody:Buffer.from(JSON.stringify(payload())),signature:''});
 assert.equal(r.status,'DENIED');
});
test('021 changing signed payload invalidates HMAC',()=>{
 const {engine}=create(),data=payload(),rawBody=Buffer.from(JSON.stringify(data));
 const signature=engine.signFixture('MESSENGER',rawBody);
 const tampered=Buffer.from(rawBody.toString('utf8').replace('Xin chào','Đặt hàng'));
 assert.equal(engine.processSignedFixture({channel:'MESSENGER',rawBody:tampered,signature}).status,'DENIED');
});
test('022 signature from wrong channel key cannot be accepted',()=>{
 const {engine}=create(),rawBody=Buffer.from(JSON.stringify(payload('MESSENGER')));
 const signature=engine.signFixture('ZALO_BOT',rawBody);
 assert.equal(engine.processSignedFixture({channel:'MESSENGER',rawBody,signature}).status,'DENIED');
});
test('023 signed channel mismatch cannot be trusted',()=>{
 const {engine}=create(),rawBody=Buffer.from(JSON.stringify(payload('ZALO_BOT')));
 const signature=engine.signFixture('MESSENGER',rawBody);
 const r=engine.processSignedFixture({channel:'MESSENGER',rawBody,signature});
 assert.equal(r.status,'DENIED');
});
test('024 wrong provider account namespace denied',()=>{
 const {engine}=create(),r=send(engine,'MESSENGER','A','Báo giá A001',
  {provider_account_ref:'qa_account_MESSENGER_unknown'});
 assert.equal(r.reason,'CHANNEL_BINDING_NOT_ACTIVE_OR_EXPIRED');
});
test('025 provider bot mismatch denied',()=>{
 const {engine}=create(),r=send(engine,'MESSENGER','A','Báo giá A001',
  {provider_bot_ref:'qa_bot_MESSENGER_B'});
 assert.equal(r.status,'DENIED');
});
test('026 expired verified binding denied',()=>{
 const {engine}=create({bindings:[{...bindings[0],verified_until_ms:NOW-1}]});
 const r=send(engine,'MESSENGER','A');
 assert.equal(r.status,'DENIED');
});
test('027 paused binding denies even if prior profile was cached',()=>{
 const {engine}=create();const r=send(engine);
 assert.equal(r.status,'RESOLVED');
 engine.qaSetBindingStatus('binding_MESSENGER_A','PAUSED');
 assert.equal(send(engine).status,'DENIED');
});
test('028 revoked binding denies even with signed fresh event',()=>{
 const {engine}=create();
 engine.qaSetBindingStatus('binding_MESSENGER_A','REVOKED');
 assert.equal(send(engine).status,'DENIED');
});
test('029 subscription disabled binding rejected',()=>{
 const bad=bindings.map(x=>x.id==='binding_MESSENGER_A'?{...x,subscription_active:false}:x);
 const {engine}=create({bindings:bad});
 assert.equal(send(engine).status,'DENIED');
});
test('030 store profile is read from V14.7 studio, not reimplemented',()=>{
 const {engine,studio}=create();
 studio.update('A','MESSENGER',{assistantName:'An AI QA v2',greeting:'Xin chào cửa hàng An bản QA.'});
 const r=send(engine);
 assert.equal(r.assistant_name,'An AI QA v2');
 assert.equal(r.bot_profile_version,2);
 assert.match(r.message_preview,/bản QA/);
});
test('031 merchant customization cannot rewrite ownership',()=>{
 const {engine,studio}=create();
 assert.throws(()=>studio.update('A','MESSENGER',{store_id:FIXTURES.B.storeId}));
 assert.equal(send(engine).store_id,FIXTURES.A.storeId);
});
test('032 standalone greeting is fast path',()=>{
 const {engine}=create(),r=send(engine,'WEB_WIDGET');
 assert.equal(r.route_path,'FAST');assert.equal(r.resolution_status,'FAST_REPLY_READY');
});
test('033 SKU catalog lookup fast and correct',()=>{
 const {engine}=create(),r=send(engine,'MESSENGER','A','Shop có mã A001 không?');
 assert.equal(r.route_type,'CATALOG');assert.equal(r.resolution_status,'FAST_REPLY_READY');
});
test('034 wrong SKU fail closed to trusted store catalog',()=>{
 const {engine}=create(),r=send(engine,'MESSENGER','A','Báo giá A999');
 assert.equal(r.resolution_status,'SKU_NOT_IN_TRUSTED_STORE');
 assert.equal(r.unit_price_vnd,undefined);
});
test('035 complicated consultation routes to no-call AI path',()=>{
 const {engine}=create(),r=send(engine,'MESSENGER','A','Tư vấn chi tiết sản phẩm');
 assert.equal(r.route_path,'AI');assert.equal(r.resolution_status,'AI_REQUIRED_BUT_DISABLED');
 assert.equal(r.real_llm_calls,0);
});
test('036 purchase intent blocked rather than writing order',()=>{
 const {engine}=create(),r=send(engine,'MESSENGER','A','Đặt 2 túi A001');
 assert.equal(r.route_path,'TRANSACTION');
 assert.equal(r.resolution_status,'TRANSACTION_BLOCKED_NO_WRITE');invariant(r);
});
test('037 cancellation intent blocked from write path',()=>{
 const {engine}=create(),r=send(engine,'MESSENGER','A','Hủy đơn A001');
 assert.equal(r.route_path,'TRANSACTION');invariant(r);
});
test('038 same signed event twice yields replay ignored, no send',()=>{
 const {engine}=create(),data=payload(),rawBody=Buffer.from(JSON.stringify(data));
 const signature=engine.signFixture('MESSENGER',rawBody);
 const a=engine.processSignedFixture({channel:'MESSENGER',rawBody,signature});
 const b=engine.processSignedFixture({channel:'MESSENGER',rawBody,signature});
 assert.equal(a.status,'RESOLVED');assert.equal(b.status,'DUPLICATE');
 invariant(b);
});
test('039 same provider event ID with different signed text is conflict',()=>{
 const {engine}=create(),data=payload();
 const raw1=Buffer.from(JSON.stringify(data)),sig1=engine.signFixture('MESSENGER',raw1);
 engine.processSignedFixture({channel:'MESSENGER',rawBody:raw1,signature:sig1});
 const raw2=Buffer.from(JSON.stringify({...data,text:'Tư vấn chi tiết'}));
 const sig2=engine.signFixture('MESSENGER',raw2);
 const b=engine.processSignedFixture({channel:'MESSENGER',rawBody:raw2,signature:sig2});
 assert.equal(b.reason,'DUPLICATE_EVENT_PAYLOAD_CONFLICT');
});
test('040 same event ID across channels stays independent',()=>{
 const {engine}=create(),id='qa_fixed_event_12345678';
 const a=send(engine,'MESSENGER','A','Xin chào',{event_id:id});
 const b=send(engine,'ZALO_BOT','A','Xin chào',{event_id:id});
 assert.equal(a.status,'RESOLVED');assert.equal(b.status,'RESOLVED');
});
test('041 same event ID across provider accounts stays independent',()=>{
 const {engine}=create(),id='qa_fixed_event_12345679';
 const a=send(engine,'MESSENGER','A','Xin chào',{event_id:id});
 const b=send(engine,'MESSENGER','B','Xin chào',{event_id:id});
 assert.equal(a.status,'RESOLVED');assert.equal(b.status,'RESOLVED');
});
test('042 no replay data written to hosted database',()=>{
 const {engine}=create();send(engine);const x=engine.inspect();
 assert.equal(x.durable_replay_across_workers,false);assert.equal(x.hosted_writes,0);
});
test('043 bounded replay capacity fails closed',()=>{
 const {engine}=create({maxReplay:10});
 for(let i=0;i<10;i++)assert.equal(send(engine).status,'RESOLVED');
 assert.equal(send(engine).reason,'REPLAY_CACHE_CAPACITY_EXHAUSTED');
});
test('044 source must not claim real provider attestation or release',()=>{
 const {engine}=create(),x=engine.inspect();
 assert.equal(x.authenticated_provider_webhooks,false);
 assert.equal(x.real_provider_rights_verified,false);
 assert.equal(x.can_publish,false);
});
test('045 signed future event beyond 2 minutes denied',()=>{
 const {engine}=create();
 assert.equal(send(engine,'MESSENGER','A','Chào',{timestamp_ms:NOW+121000}).status,'DENIED');
});
test('046 signed old event beyond 1 hour denied',()=>{
 const {engine}=create();
 assert.equal(send(engine,'MESSENGER','A','Chào',{timestamp_ms:NOW-3600001}).status,'DENIED');
});
test('047 payload with too-long text denied',()=>{
 const {engine}=create();
 assert.equal(send(engine,'MESSENGER','A','x'.repeat(2001)).status,'DENIED');
});
test('048 V14.7 Shop A and B same tenant but store isolated',()=>{
 const {engine}=create();
 const a=send(engine,'ZALO_OA','A','Báo giá A001');
 const b=send(engine,'ZALO_OA','B','Báo giá A001');
 assert.equal(a.tenant_id,b.tenant_id);
 assert.notEqual(a.store_id,b.store_id);
 assert.notEqual(a.unit_price_vnd,b.unit_price_vnd);
});
test('049 no automatic cross channel identity based on matching phone/name',()=>{
 const {engine}=create();
 const a=send(engine,'MESSENGER','A','Xin chào',{provider_user_ref:'qa_phone_matching'});
 const b=send(engine,'WEB_WIDGET','A','Xin chào',{provider_user_ref:'qa_phone_matching'});
 assert.notEqual(a.customer_id,b.customer_id);
});
test('050 cache reuse while fresh and invalidates when studio profile version changes',()=>{
 const {engine,studio}=create();
 send(engine);send(engine);
 const b=engine.inspect();assert.ok(b.cache_hit>=1);
 studio.update('A','MESSENGER',{greeting:'Xin chào An bản QA mới.'});
 const c=send(engine);assert.match(c.message_preview,/bản QA mới/);
 assert.ok(engine.inspect().cache_miss>=2);
});
test('051 no default-store fallback on unknown binding',()=>{
 const {engine}=create();
 const r=send(engine,'ZALO_BOT','A','Xin chào',{provider_account_ref:'not_registered'});
 assert.equal(r.status,'DENIED');assert.equal(r.store_id,undefined);
});
test('052 unknown or unsupported event type rejected',()=>{
 const {engine}=create();
 assert.equal(send(engine,'WEB_WIDGET','A','Xin chào',{event_type:'order_created'}).status,'DENIED');
});
