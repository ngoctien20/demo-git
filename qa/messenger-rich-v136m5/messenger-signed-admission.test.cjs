'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHmac}=require('node:crypto');
const {createMessengerSignedAdmissionCandidate}=require('./messenger-signed-admission.cjs');
const {createPrivateEventStoreCandidate}=require('./private-event-store.cjs');
const {createSyntheticPgModel}=require('./synthetic-pg-model.cjs');
const {DB_PROBE,SQL}=require('../messenger-rich-v136m2/trusted-repository.cjs');

const NOW=Date.parse('2026-11-22T11:05:00.000Z');
const TENANT_A='11111111-1111-4111-8111-111111111111';
const TENANT_B='22222222-2222-4222-8222-222222222222';
const STORE_A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const STORE_B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const STORE_C='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const PAGE_A='12345678901234567',PAGE_B='98765432109876543';
const PAGE_C='88888888888888888',SENDER_A='55555555555555555';
const SENDER_B='66666666666666666';
const APP_SECRET='OFFLINE_META_APP_SECRET_32_BYTES_MIN_NOT_REAL_404';
const ACTION_SECRET='OFFLINE_META_ACTION_SECRET_32_BYTES_MIN_NOT_REAL_404';
const KEY='OFFLINE_REPLAY_HMAC_SECRET_32_BYTES_MIN_NOT_REAL_404';
const ORIGIN='https://shop.example.invalid';
const binding=(page,tenant,store,overrides={})=>({
 page_id:page,tenant_id:tenant,store_id:store,
 binding_state:'active',owner_verified:true,inbound_enabled:true,
 binding_version:3,store_state:'active',owner_membership_confirmed:true,
 ...overrides
});
const BINDINGS={
 [PAGE_A]:[binding(PAGE_A,TENANT_A,STORE_A)],
 [PAGE_B]:[binding(PAGE_B,TENANT_A,STORE_B)],
 [PAGE_C]:[binding(PAGE_C,TENANT_B,STORE_C)]
};
const READY={
 stores_ready:true,store_memberships_ready:true,page_bindings_ready:true,
 products_store_id_ready:true,products_rls_ready:true,
 stores_rls_ready:true,memberships_rls_ready:true
};
const entry=(page=PAGE_A,sender=SENDER_A,mid='QA_MID_001',extra={})=>({
 id:page,messaging:[{
  sender:{id:sender},recipient:{id:page},timestamp:NOW,
  message:{text:'Xin chào shop',mid},...extra
 }]
});
const signed=(entries=[entry()],key=APP_SECRET)=> {
 const rawBody=JSON.stringify({object:'page',entry:entries});
 return {rawBody,signature:'sha256='+createHmac('sha256',key).update(rawBody).digest('hex')};
};
function fixture(overrides={}){
 const calls=[],model=overrides.model||createSyntheticPgModel();
 const bindings=overrides.bindings||BINDINGS;
 const db={
  readOnly:true,bypassRls:false,authorizedProfile:'RESTRICTED_MESSENGER_READONLY',
  async query(sql,values){
   calls.push({sql,values});
   if(sql===DB_PROBE)return {rows:[{...READY,...overrides.schema}]};
   if(sql===SQL.binding)return {rows:bindings[values[0]]||[]};
   if(sql===SQL.catalog)return {rows:[]};
   throw Error('UNEXPECTED_QA_QUERY');
  }
 };
 const eventStore=createPrivateEventStoreCandidate({
  mode:'SYNTHETIC_SQL_QA_ONLY',driver:model.openClient(),
  secret:KEY,now:()=>NOW
 });
 const adapter=createMessengerSignedAdmissionCandidate({
  mode:'SYNTHETIC_QA_ONLY',db,eventStore,
  appSecret:APP_SECRET,actionSecret:ACTION_SECRET,siteOrigin:ORIGIN,
  now:()=>NOW,
  readPublicConfig:async({tenantId,storeId})=>({
   source:'TRUSTED_PRIVATE_PUBLIC_SHOP_CONFIG',tenantId,storeId,
   shopSlug:'qa-'+storeId.slice(0,2),webOrigins:[ORIGIN],imageOrigins:[]
  }),
  readEntitlement:async({tenantId,storeId})=>({
   source:'TRUSTED_PRIVATE_ENTITLEMENT',tenantId,storeId,
   active:true,botPaused:!!overrides.paused,featureEnabled:!overrides.noFeature,
   expiresAtMs:overrides.expired?NOW-1:NOW+600000
  })
 });
 return {adapter,calls,model,db,eventStore};
}
test('default/hosted modes refuse before any I/O',()=>{
 assert.throws(()=>createMessengerSignedAdmissionCandidate(),/SIGNED_ADMISSION_HOSTED_NOT_APPROVED/);
 const f=fixture();
 assert.throws(()=>createMessengerSignedAdmissionCandidate({mode:'HOSTED_SEND',eventStore:f.eventStore,db:f.db}),
 /SIGNED_ADMISSION_HOSTED_NOT_APPROVED/);
 assert.equal(f.calls.length,0);
});

test('only server-injected restricted read-only repository and synthetic event store are supported',()=>{
 const f=fixture();
 assert.throws(()=>createMessengerSignedAdmissionCandidate({
  mode:'SYNTHETIC_QA_ONLY',eventStore:f.eventStore,
  db:{...f.db,bypassRls:true},appSecret:APP_SECRET,actionSecret:ACTION_SECRET,
  readEntitlement:async()=>({}),readPublicConfig:async()=>({})
 }),/SIGNED_ADMISSION_REPOSITORY_NOT_APPROVED/);
 assert.throws(()=>createMessengerSignedAdmissionCandidate({
  mode:'SYNTHETIC_QA_ONLY',eventStore:{
   ...f.eventStore,readiness:{...f.eventStore.readiness,providerSendEnabled:true}
  },db:f.db
 }),/SIGNED_ADMISSION_EVENT_STORE_NOT_APPROVED/);
});

test('valid exact raw-body Meta HMAC proceeds to resolved Store and reserves once',async()=>{
 const {adapter,calls,model}=fixture();
 const e=signed();
 const first=await adapter.inspectSigned(e);
 assert.equal(first.mode,'SIGNED_CANONICAL_PREVIEW_NO_SEND');
 assert.equal(first.sendAllowed,false);
 assert.equal(first.eventCount,1);
 assert.equal(first.eventDecisions[0].status,'PREVIEW_CREATED');
 assert.equal(first.eventDecisions[0].route,'QUICK_MENU');
 assert.equal(model.diagnostics().rowCount,1);
 assert.ok(calls.some(x=>x.sql===SQL.binding&&x.values[0]===PAGE_A));
 const second=await adapter.inspectSigned(e);
 assert.equal(second.eventDecisions[0].status,'DUPLICATE_SUPPRESSED');
 assert.equal(model.diagnostics().rowCount,1);
 assert.doesNotMatch(JSON.stringify(first),new RegExp(SENDER_A));
 assert.doesNotMatch(JSON.stringify(first),/access_token|rawBody|lease_id|secret/i);
});

test('tampered message/body/signature denied BEFORE any repository call or claim',async()=>{
 const {adapter,calls,model}=fixture();
 const e=signed();
 const bad=[
  {...e,rawBody:e.rawBody.replace('Xin chào shop','Hack order')},
  {...e,signature:e.signature.slice(0,-1)+(e.signature.at(-1)==='0'?'1':'0')},
  {...e,signature:'sha1='+e.signature.slice(7)},
  {...e,signature:''}
 ];
 for(const x of bad)await assert.rejects(adapter.inspectSigned(x));
 assert.equal(calls.length,0);
 assert.equal(model.diagnostics().rowCount,0);
});

test('valid HMAC signed but unknown Page or ambiguous Page binding cannot claim',async()=>{
 const f=fixture({bindings:{
  ...BINDINGS,[PAGE_B]:[BINDINGS[PAGE_B][0],BINDINGS[PAGE_B][0]]
 }});
 const missing=entry('99999999999999999',SENDER_A,'MID_UNKNOWN');
 const ambiguous=entry(PAGE_B,SENDER_A,'MID_AMBIGUOUS');
 await assert.rejects(f.adapter.inspectSigned(signed([missing])));
 await assert.rejects(f.adapter.inspectSigned(signed([ambiguous])));
 assert.equal(f.model.diagnostics().rowCount,0);
});

test('forged binding, revoked owner, disabled inbound and inactive Store denied',async()=>{
 const changes=[
  {owner_verified:false},{owner_membership_confirmed:false},
  {inbound_enabled:false},{binding_state:'revoked'},
  {store_state:'paused'},{binding_version:0},
  {page_id:'99999999999999999'}
 ];
 for(const patch of changes){
  const f=fixture({bindings:{...BINDINGS,[PAGE_A]:[binding(PAGE_A,TENANT_A,STORE_A,patch)]}});
  await assert.rejects(f.adapter.inspectSigned(signed()));
  assert.equal(f.model.diagnostics().rowCount,0);
 }
});

test('missing FORCE RLS schema proof, paused, expired or disabled entitlement block before claim',async()=>{
 for(const patch of [
  {schema:{stores_rls_ready:false}},{schema:{memberships_rls_ready:false}},
  {paused:true},{expired:true},{noFeature:true}
 ]){
  const f=fixture(patch);
  await assert.rejects(f.adapter.inspectSigned(signed()));
  assert.equal(f.model.diagnostics().rowCount,0);
 }
});

test('multiple different Pages and PSIDs in the same signed webhook remain isolated',async()=>{
 const f=fixture();
 const e=signed([
  entry(PAGE_A,SENDER_A,'MID_SHARED'),
  entry(PAGE_A,SENDER_B,'MID_SHARED'),
  entry(PAGE_B,SENDER_A,'MID_SHARED'),
  entry(PAGE_C,SENDER_A,'MID_SHARED')
 ]);
 const r=await f.adapter.inspectSigned(e);
 assert.equal(r.eventCount,4);
 assert.deepEqual(r.eventDecisions.map(x=>x.status),Array(4).fill('PREVIEW_CREATED'));
 assert.equal(f.model.diagnostics().rowCount,4);
 const again=await f.adapter.inspectSigned(e);
 assert.deepEqual(again.eventDecisions.map(x=>x.status),Array(4).fill('DUPLICATE_SUPPRESSED'));
});

test('same Page and PSID: distinct event MIDs do not collide',async()=>{
 const f=fixture();
 const r=await f.adapter.inspectSigned(signed([
  entry(PAGE_A,SENDER_A,'MID_ONE'),
  entry(PAGE_A,SENDER_A,'MID_TWO')
 ]));
 assert.equal(r.eventCount,2);
 assert.equal(f.model.diagnostics().rowCount,2);
});

test('webhook client-forged booleans and tenant/store fields never override DB authority',async()=>{
 const f=fixture();
 const forged=entry(PAGE_A,SENDER_A,'MID_FORGED',{trusted:{
  source:'SERVER_VERIFIED_MESSENGER_BINDING',verified:true,
  tenantId:TENANT_B,storeId:STORE_C,signatureVerified:true
 }});
 const r=await f.adapter.inspectSigned(signed([forged]));
 assert.equal(r.eventCount,1);
 assert.equal(f.model.diagnostics().rowCount,1);
 assert.equal(f.calls.find(x=>x.sql===SQL.binding).values[0],PAGE_A);
});

test('untrusted postback payload and old event reject without claim',async()=>{
 const fakeAction=entry(PAGE_A,SENDER_A,'MID_ACTION',{message:undefined,
  postback:{payload:'TIEN404:IMPERSONATE_ADMIN',mid:'MID_ACTION'}});
 const f=fixture();
 await assert.rejects(f.adapter.inspectSigned(signed([fakeAction])));
 assert.equal(f.model.diagnostics().rowCount,0);
 const old=entry(PAGE_A,SENDER_A,'MID_STALE');
 old.messaging[0].timestamp=NOW-2*86400000;
 await assert.rejects(f.adapter.inspectSigned(signed([old])));
 assert.equal(f.model.diagnostics().rowCount,0);
});

test('synthetic receipt/status can never imply Meta delivery or order mutations',async()=>{
 const {adapter}=fixture();
 assert.deepEqual(adapter.readiness,{
  mode:'SYNTHETIC_QA_ONLY',hostedReady:false,realRlsProven:false,
  messengerPublishedWired:false,providerSendEnabled:false,
  orderWritesEnabled:false,automaticRetryEnabled:false
 });
 const result=await adapter.inspectSigned(signed());
 assert.equal(result.sendAllowed,false);
 assert.equal(result.orderWriteAllowed,false);
 assert.equal(result.hostedReady,false);
 assert.equal('providerMessageId' in result,false);
});
