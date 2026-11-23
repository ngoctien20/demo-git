'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHmac}=require('node:crypto');
const {deriveIdentity,createPrivateEventStoreCandidate,SQL,TABLE}=require('./private-event-store.cjs');
const {createSyntheticPgModel}=require('./synthetic-pg-model.cjs');
const {previewMessengerV136M4}=require('../messenger-rich-v136m4/event-isolation.cjs');
const {DB_PROBE,SQL:REPOSITORY_SQL}=require('../messenger-rich-v136m2/trusted-repository.cjs');
const T='11111111-1111-4111-8111-111111111111';
const U='22222222-2222-4222-8222-222222222222';
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const P1='12345678901234567',P2='98765432109876543';
const S1='55555555555555555',S2='66666666666666666';
const HKEY='offline-only-secret-DO-NOT-USE-IN-PRODUCTION-404';
const APP='SYNTHETIC_APP_SECRET_1234567890_404';
const ACTION='SYNTHETIC_ACTION_SECRET_1234567890_404';
const NOW=Date.parse('2026-11-15T10:00:00Z'), now=()=>NOW;
const trusted=(more={})=>({
 source:'SERVER_VERIFIED_MESSENGER_BINDING',
 serverDerived:true,verified:true,
 tenantId:T,storeId:A,pageId:P1,recipientPsid:S1,bindingVersion:3,
 ...more
});
const key=(ch='a')=>ch.repeat(64);
const make=(model=createSyntheticPgModel(),opts={})=>
 createPrivateEventStoreCandidate({
  mode:'SYNTHETIC_SQL_QA_ONLY',driver:model.openClient(),
  secret:HKEY,now,...opts
 });
const req=(proof=trusted(),replayKey=key())=>({trusted:proof,replayKey});
const code=(promise,code)=>assert.rejects(promise,new RegExp(code));
test('default mode blocks before a transaction is available',()=>{
 assert.throws(()=>createPrivateEventStoreCandidate(),/PRIVATE_EVENT_HOSTED_NOT_APPROVED/);
});
test('HOSTED_READ_ONLY and LIVE_SEND modes always block',()=>{
 const m=createSyntheticPgModel();
 for(const mode of ['HOSTED_READ_ONLY','HOSTED_WRITE','PRODUCTION_SEND'])
  assert.throws(()=>createPrivateEventStoreCandidate({
   mode,driver:m.openClient(),secret:HKEY
  }),/PRIVATE_EVENT_HOSTED_NOT_APPROVED/);
});
test('driver must explicitly assert synthetic and no external writes',()=>{
 const m=createSyntheticPgModel(),d=m.openClient();
 for(const change of [{externalWrites:true},{synthetic:false},{profile:'SERVICE_ROLE'},
    {transaction:null}]){
  assert.throws(()=>createPrivateEventStoreCandidate({
   mode:'SYNTHETIC_SQL_QA_ONLY',driver:{...d,...change},secret:HKEY
  }),/PRIVATE_EVENT_DRIVER_NOT_APPROVED/);
 }
});
test('strong server-only digest key required',()=>{
 const m=createSyntheticPgModel();
 assert.throws(()=>createPrivateEventStoreCandidate({
  mode:'SYNTHETIC_SQL_QA_ONLY',driver:m.openClient(),secret:'weak'
 }),/PRIVATE_EVENT_HMAC_KEY_REQUIRED/);
});
test('trusted source/tenant/store/Page/PSID/bindingVersion all mandatory',()=>{
 const good=trusted();
 for(const wrong of [
  {source:'BROWSER_CLAIM'}, {serverDerived:false},{verified:false},
  {tenantId:'spoof'}, {storeId:''},{pageId:'../../../'},
  {recipientPsid:'untrusted'}, {bindingVersion:0},{bindingVersion:1.2}
 ]){
  assert.throws(()=>deriveIdentity({trusted:{...good,...wrong},
    replayKey:key(),secret:HKEY}),/PRIVATE_EVENT_SCOPE_UNVERIFIED/);
 }
});
test('untrusted/reformatted MID fingerprint invalid',()=>{
 assert.throws(()=>deriveIdentity({trusted:trusted(),replayKey:'MID-001',secret:HKEY}),
 /PRIVATE_EVENT_REPLAY_KEY_INVALID/);
});
test('fingerprint is HMAC-scoped and never contains raw PSID or token',()=>{
 const x=deriveIdentity({trusted:trusted(),replayKey:key(),secret:HKEY});
 assert.match(x.senderHash,/^[a-f0-9]{64}$/);
 assert.match(x.eventHash,/^[a-f0-9]{64}$/);
 const repr=JSON.stringify(x);
 assert.doesNotMatch(repr,new RegExp(S1));
 assert.doesNotMatch(repr,/offline-only-secret/);
 assert.equal(x.hashVersion,1);
});
test('sender hash differs between shops/pages/tenants and secrets',()=>{
 const x=deriveIdentity({trusted:trusted(),replayKey:key(),secret:HKEY});
 for(const override of [{recipientPsid:S2},{storeId:B},{pageId:P2},{tenantId:U}]){
  const next=deriveIdentity({trusted:trusted(override),replayKey:key(),secret:HKEY});
  assert.notEqual(x.senderHash,next.senderHash);
 }
 const next=deriveIdentity({trusted:trusted(),replayKey:key(),secret:HKEY+'-rotate'});
 assert.notEqual(next.senderHash,x.senderHash);
});
test('same sender different replay key has same sender hash, different event hash',()=>{
 const a=deriveIdentity({trusted:trusted(),replayKey:key('a'),secret:HKEY});
 const b=deriveIdentity({trusted:trusted(),replayKey:key('b'),secret:HKEY});
 assert.equal(a.senderHash,b.senderHash);assert.notEqual(a.eventHash,b.eventHash);
});
test('static SQL is private, bound, conflict-safe and never dynamic',()=>{
 assert.match(TABLE,/^app_private\./);
 assert.match(SQL.claim,/^INSERT INTO app_private\.messenger_event_claims/);
 assert.match(SQL.claim,/ON CONFLICT \(tenant_id,store_id,page_id,sender_hash,binding_version,event_hash\)/);
 assert.match(SQL.claim,/DO NOTHING RETURNING lease_id::text AS lease_id,status/);
 assert.match(SQL.finalize,/WHERE tenant_id=\$1::uuid AND store_id=\$2::uuid/);
 assert.match(SQL.finalize,/AND lease_id=\$7::uuid AND status='CLAIMED'/);
 assert.doesNotMatch(SQL.claim,/service_role|SECURITY DEFINER|raw_psid|access_token/i);
});
test('first atomic claim wins, duplicate gets no lease',async()=>{
 const m=createSyntheticPgModel(),s=make(m);
 const a=await s.claim(req()),b=await s.claim(req());
 assert.equal(a.status,'CLAIMED');assert.equal(a.firstSeen,true);
 assert.equal(b.status,'DUPLICATE_SUPPRESSED');assert.equal(b.firstSeen,false);
 assert.equal(m.diagnostics().rowCount,1);
 assert.equal(JSON.stringify(a).includes('lease'),false);
});
test('100 concurrent calls from separate clients yield exactly one winner',async()=>{
 const m=createSyntheticPgModel();
 const stores=Array.from({length:100},()=>make(m));
 const result=await Promise.all(stores.map(s=>s.claim(req())));
 assert.equal(result.filter(x=>x.firstSeen===true).length,1);
 assert.equal(result.filter(x=>x.firstSeen===false).length,99);
 assert.equal(m.diagnostics().rowCount,1);
});
test('new adapter instance sees same synthetic shared model unique row',async()=>{
 const model=createSyntheticPgModel();
 const first=await make(model).claim(req());
 const second=await make(model).claim(req());
 assert.equal(first.firstSeen,true);assert.equal(second.firstSeen,false);
 assert.equal(model.diagnostics().durableAcrossProcessRestart,false);
});
test('NEW model after actual restart has NO durability claim',async()=>{
 const one=await make(createSyntheticPgModel()).claim(req());
 const two=await make(createSyntheticPgModel()).claim(req());
 assert.equal(one.firstSeen,true);assert.equal(two.firstSeen,true);
});
test('same replay identity from different PSIDs never conflicts',async()=>{
 const m=createSyntheticPgModel(),s=make(m);
 assert.equal((await s.claim(req())).firstSeen,true);
 assert.equal((await s.claim(req(trusted({recipientPsid:S2})))).firstSeen,true);
 assert.equal(m.diagnostics().rowCount,2);
});
test('same replay identity different Store/Page/Tenant is isolated',async()=>{
 const m=createSyntheticPgModel(),s=make(m);
 for(const proof of [trusted(),trusted({storeId:B}),trusted({pageId:P2}),trusted({tenantId:U})])
  assert.equal((await s.claim(req(proof))).firstSeen,true);
 assert.equal(m.diagnostics().rowCount,4);
});
test('binding version change uses distinct private event key',async()=>{
 const s=make(),a=await s.claim(req()),b=await s.claim(req(trusted({bindingVersion:4})));
 assert.equal(a.firstSeen,true);assert.equal(b.firstSeen,true);
});
test('different MID hashes are treated as different events',async()=>{
 const s=make();
 assert.equal((await s.claim(req(trusted(),key('a')))).firstSeen,true);
 assert.equal((await s.claim(req(trusted(),key('b')))).firstSeen,true);
});
test('a claim can only finalize PREVIEW_READY with its issued receipt',async()=>{
 const m=createSyntheticPgModel(),s=make(m),claimed=await s.claim(req());
 const done=await s.finalize(claimed);
 assert.equal(done.status,'PREVIEW_READY');
 assert.equal(done.sendEnabled,false);assert.equal(done.durable,false);
 assert.deepEqual(m.simulatedStatuses(),['PREVIEW_READY']);
});
test('a claim may mark REJECTED but can never send',async()=>{
 const m=createSyntheticPgModel(),s=make(m),claimed=await s.claim(req());
 const done=await s.finalize(claimed,{status:'REJECTED'});
 assert.equal(done.status,'REJECTED');assert.equal(done.sendEnabled,false);
});
test('no status can transition to SENT or ORDER_CREATED',async()=>{
 const s=make(),c=await s.claim(req());
 for(const status of ['SENT','ORDER_CREATED','DELIVERED','CLAIMED','PENDING'])
  await code(s.finalize(c,{status}),'PRIVATE_EVENT_FINAL_STATUS_DENIED');
});
test('duplicate receipt cannot finalize any transaction',async()=>{
 const s=make();
 const first=await s.claim(req()),duplicate=await s.claim(req());
 await code(s.finalize(duplicate),'PRIVATE_EVENT_LEASE_NOT_ISSUED');
 await s.finalize(first);
 await code(s.finalize(first),'PRIVATE_EVENT_LEASE_NOT_ISSUED');
});
test('receipts from a different adapter cannot finish original claim',async()=>{
 const m=createSyntheticPgModel(),a=make(m),b=make(m);
 const x=await a.claim(req());
 await code(b.finalize(x),'PRIVATE_EVENT_LEASE_NOT_ISSUED');
 await a.finalize(x);
});
test('stalled CLAIMED stays duplicate-suppressed without unsafe reclaim',async()=>{
 const m=createSyntheticPgModel(),s=make(m);
 await s.claim(req());
 assert.equal((await make(m).claim(req())).firstSeen,false);
 assert.deepEqual(m.simulatedStatuses(),['CLAIMED']);
});
test('TTL never automatically allows duplicate processing before audited pruning',async()=>{
 let t=NOW;const m=createSyntheticPgModel();
 const a=make(m,{now:()=>t,retentionMs:86400000});
 await a.claim(req());t+=10*86400000;
 assert.equal((await make(m,{now:()=>t}).claim(req())).firstSeen,false);
});
test('transaction rollback drops claim entirely',async()=>{
 const m=createSyntheticPgModel(),s=make(m);
 m.injectRollbackOnce();
 await code(s.claim(req()),'TEST_TRANSACTION_ROLLED_BACK');
 assert.equal(m.diagnostics().rowCount,0);
 assert.equal((await s.claim(req())).firstSeen,true);
});
test('transaction rollback during finalize keeps CLAIMED and receipt valid',async()=>{
 const m=createSyntheticPgModel(),s=make(m);
 const c=await s.claim(req());m.injectRollbackOnce();
 await code(s.finalize(c),'TEST_TRANSACTION_ROLLED_BACK');
 assert.deepEqual(m.simulatedStatuses(),['CLAIMED']);
 assert.equal((await s.finalize(c)).status,'PREVIEW_READY');
});
test('bad transaction response fails closed, never treats as duplicate or winner',async()=>{
 const bad={
  synthetic:true,externalWrites:false,profile:'SYNTHETIC_PRIVATE_PG_TRANSACTION_MODEL',
  transaction:async fn=>fn({query:async()=>({rows:[{lease_id:'bad',status:'CLAIMED'},
    {lease_id:'bad2',status:'CLAIMED'}]})})
 };
 const s=createPrivateEventStoreCandidate({mode:'SYNTHETIC_SQL_QA_ONLY',
  driver:bad,secret:HKEY,now});
 await code(s.claim(req()),'PRIVATE_EVENT_DB_RESPONSE_UNVERIFIED');
});
test('invalid driver tx is denied, no guessed success',async()=>{
 const bad={
  synthetic:true,externalWrites:false,profile:'SYNTHETIC_PRIVATE_PG_TRANSACTION_MODEL',
  transaction:async fn=>fn({})
 };
 const s=createPrivateEventStoreCandidate({mode:'SYNTHETIC_SQL_QA_ONLY',
  driver:bad,secret:HKEY,now});
 await code(s.claim(req()),'PRIVATE_EVENT_TRANSACTION_REQUIRED');
});
test('DRY_RUN bridge is compatible with prior repository contract',async()=>{
 const s=make(),input={
  tenantId:T,storeId:A,pageId:P1,senderPsid:S1,bindingVersion:3,
  replayKey:key(),mode:'DRY_RUN'
 };
 const a=await s.replayCheck(input),b=await s.replayCheck(input);
 assert.deepEqual(a,{mode:'DRY_RUN',firstSeen:true,externalWriteOccurred:false,
  providerSendEnabled:false,durableReplayReady:false});
 assert.equal(b.firstSeen,false);
 await code(s.replayCheck({...input,mode:'LIVE'}),'PRIVATE_EVENT_DRY_RUN_REQUIRED');
});
test('all readiness flags are explicitly not live',()=>{
 const s=make(),v=s.readiness;
 assert.equal(v.backedByPostgres,false);
 assert.equal(v.hostedRlsVerified,false);
 assert.equal(v.durableReplayReady,false);
 assert.equal(v.providerSendEnabled,false);
 assert.equal(v.outboxEnabled,false);
 assert.equal(v.allowOrderWrites,false);
});
test('no raw sender, tokens, text or secrets shown in diagnostic snapshots',async()=>{
 const m=createSyntheticPgModel(),s=make(m);await s.claim(req());
 const snapshot=JSON.stringify(m.diagnostics());
 assert.doesNotMatch(snapshot,new RegExp(S1));
 assert.doesNotMatch(snapshot,/offline-only-secret|access_token|message_text/);
});
test('replay bridge routes existing V13.6M.4 signed text events without a send',async()=>{
 const model=createSyntheticPgModel(),ev=make(model);
 const f={
  readOnly:true,bypassRls:false,authorizedProfile:'RESTRICTED_MESSENGER_READONLY',
  query:async(sql,params)=>{
   if(sql===DB_PROBE)return {rows:[{
    stores_ready:true,store_memberships_ready:true,page_bindings_ready:true,
    products_store_id_ready:true,products_rls_ready:true,
    stores_rls_ready:true,memberships_rls_ready:true
   }]};
   if(sql===REPOSITORY_SQL.binding)return {rows:[{
    page_id:P1,tenant_id:T,store_id:A,binding_state:'active',
    owner_verified:true,inbound_enabled:true,binding_version:3,
    store_state:'active',owner_membership_confirmed:true
   }]};
   if(sql===REPOSITORY_SQL.catalog)return {rows:[]};
   throw Error('INVALID_SIMULATED_QUERY');
  }
 };
 const rawBody=JSON.stringify({object:'page',entry:[{id:P1,messaging:[{
  sender:{id:S1},recipient:{id:P1},timestamp:NOW,
  message:{text:'Xin chào shop',mid:'QA-MID-01'}
 }]}]});
 const signature='sha256='+createHmac('sha256',APP).update(rawBody).digest('hex');
 const props={mode:'SYNTHETIC_QA_ONLY',db:f,
  readPublicConfig:async({tenantId,storeId})=>({
   source:'TRUSTED_PRIVATE_PUBLIC_SHOP_CONFIG',tenantId,storeId,
   shopSlug:'qa-a',webOrigins:['https://shop.example.invalid'],imageOrigins:[]
  }),
  readEntitlement:async({tenantId,storeId})=>({
   source:'TRUSTED_PRIVATE_ENTITLEMENT',tenantId,storeId,active:true,
   botPaused:false,featureEnabled:true,expiresAtMs:NOW+3600000
  }),
  replayCheck:ev.replayCheck,
  rawBody,signature,appSecret:APP,actionSecret:ACTION,
  siteOrigin:'https://shop.example.invalid',now
 };
 const x=await previewMessengerV136M4(props),y=await previewMessengerV136M4(props);
 assert.equal(x.events[0].status,'PREVIEW_CREATED');
 assert.equal(y.events[0].status,'DUPLICATE_SUPPRESSED');
 assert.equal(x.sendEnabled,false);assert.equal(x.durableReplayReady,false);
});
