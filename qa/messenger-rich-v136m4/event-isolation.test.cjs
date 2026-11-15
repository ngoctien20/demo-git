'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHmac}=require('node:crypto');
const {sign}=require('../messenger-rich-v136m/adapter.cjs');
const {DB_PROBE,SQL}=require('../messenger-rich-v136m2/trusted-repository.cjs');
const {createSyntheticReplayStore,previewMessengerV136M4:preview}=require('./event-isolation.cjs');
const NOW=Date.parse('2026-11-15T10:00:00Z'),now=()=>NOW;
const T='11111111-1111-4111-8111-111111111111';
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const P1='12345678901234567',P2='98765432109876543';
const U1='55555555555555555',U2='66666666666666666';
const APP='SYNTHETIC_META_APP_SECRET_TEST_NOT_REAL_404';
const ACT='SYNTHETIC_POSTBACK_SECRET_TEST_NOT_REAL_404';
const ORIGIN='https://shop.example.invalid';
const ready={stores_ready:true,store_memberships_ready:true,page_bindings_ready:true,
 products_store_id_ready:true,products_rls_ready:true,stores_rls_ready:true,memberships_rls_ready:true};
const scopeFor=(page,psid)=>({
 source:'SERVER_VERIFIED_MESSENGER_BINDING',serverDerived:true,verified:true,
 pageId:page,recipientPsid:psid,tenantId:T,storeId:page===P1?A:B,
 shopSlug:page===P1?'qa-a':'qa-b',webOrigins:[ORIGIN],imageOrigins:[]
});
const binding=page=>({page_id:page,tenant_id:T,store_id:page===P1?A:B,
 binding_state:'active',owner_verified:true,inbound_enabled:true,binding_version:1,
 store_state:'active',owner_membership_confirmed:true});
const product=store=>({id:store,tenant_id:T,store_id:store,
 sku:store===A?'QA_A001':'QA_B001',name:store===A?'Shop A QA':'Shop B QA',
 price_vnd:store===A?'159000':'219000',stock_on_hand:2,is_active:true});
const textEvent=(page,psid,mid)=>({sender:{id:psid},recipient:{id:page},
 timestamp:NOW,message:{text:'Chào shop',mid}});
const postbackEvent=(page,psid,mid)=>({sender:{id:psid},recipient:{id:page},
 timestamp:NOW,postback:{mid,payload:sign({
 trusted:scopeFor(page,psid),secret:ACT,action:'BROWSE_CATALOG',
 itemId:'NONE',now})}});
const envelope=entries=>({object:'page',entry:entries.map(([id,...messaging])=>({id,messaging}))});
const signRaw=(data)=>{const rawBody=JSON.stringify(data);
 return {rawBody,signature:'sha256='+createHmac('sha256',APP).update(rawBody).digest('hex'),
 appSecret:APP,actionSecret:ACT}};
function fixture(override={}){
 const queries=[];
 const qastore=createSyntheticReplayStore({clock:now,...override.store});
 const db={
  readOnly:true,bypassRls:false,authorizedProfile:'RESTRICTED_MESSENGER_READONLY',
  query:async(sql,args)=>{
   queries.push([sql,args]);
   if(sql===DB_PROBE)return {rows:[{...ready,...override.readiness}]};
   if(sql===SQL.binding){
     const page=args[0];
     const rows=[P1,P2].includes(page)?[binding(page)]:[];
     return {rows:override.bindingRows===undefined?rows:override.bindingRows};
   }
   if(sql===SQL.catalog){
     const rows=[product(A),product(B)].filter(p=>p.tenant_id===args[0]&&p.store_id===args[1]);
     return {rows:override.catalogRows===undefined?rows:override.catalogRows};
   }
   throw new Error('BLOCKED_UNKNOWN_SQL');
  }
 };
 const options={
  db,now,
  readPublicConfig:async({tenantId,storeId})=>({
   source:'TRUSTED_PRIVATE_PUBLIC_SHOP_CONFIG',tenantId,storeId,
   shopSlug:storeId===A?'qa-a':'qa-b',webOrigins:[ORIGIN],imageOrigins:[]
  }),
  readEntitlement:async({tenantId,storeId})=>({
   source:'TRUSTED_PRIVATE_ENTITLEMENT',tenantId,storeId,
   active:true,botPaused:false,featureEnabled:true,expiresAtMs:NOW+3600000
  }),
  replayCheck:qastore.replayCheck,
  mode:'SYNTHETIC_QA_ONLY',siteOrigin:ORIGIN
 };
 return {options,queries,qastore};
}
const exec=async(entries,opts={})=>{
 const fx=fixture(opts);
 return {result:await preview({...fx.options,...signRaw(envelope(entries))}),...fx};
};
const expectCode=(promise,pattern)=>assert.rejects(promise,new RegExp(pattern));
const card=x=>x.prepared.body.message.attachment.payload.elements[0];

test('two PSIDs in same Page now create independent preview outputs',async()=>{
 const a=await exec([[P1,textEvent(P1,U1,'MID1'),textEvent(P1,U2,'MID2')]]);
 assert.equal(a.result.perEventIsolation,true);
 assert.equal(a.result.events.length,2);
 const ids=a.result.events.map(x=>x.prepared.body.recipient.id);
 assert.deepEqual(ids,[U1,U2]);assert.ok(a.result.events.every(x=>x.route==='QUICK_MENU'));
 assert.equal(a.result.sendEnabled,false);
});
test('same Page two PSIDs signed carousel remain customer-scoped',async()=>{
 const a=await exec([[P1,postbackEvent(P1,U1,'POST1'),postbackEvent(P1,U2,'POST2')]]);
 assert.deepEqual(a.result.events.map(x=>x.prepared.body.recipient.id),[U1,U2]);
 assert.equal(card(a.result.events[0]).title,'Shop A QA');
 assert.equal(card(a.result.events[1]).title,'Shop A QA');
});
test('two Pages same tenant different Stores never share catalog',async()=>{
 const x=await exec([[P1,postbackEvent(P1,U1,'P1')],[P2,postbackEvent(P2,U2,'P2')]]);
 assert.equal(card(x.result.events[0]).title,'Shop A QA');
 assert.equal(card(x.result.events[1]).title,'Shop B QA');
});
test('mixed Page and sender batches isolate all three contexts',async()=>{
 const x=await exec([[P1,textEvent(P1,U1,'X1'),textEvent(P1,U2,'X2')],
  [P2,textEvent(P2,U1,'X3')]]);
 assert.equal(x.result.events.length,3);
 assert.deepEqual(x.result.events.map(e=>e.prepared.body.recipient.id),[U1,U2,U1]);
});
test('same PSID/Page MID duplicate suppressed by one shared QA replay port',async()=>{
 const x=await exec([[P1,textEvent(P1,U1,'MID_DUP'),textEvent(P1,U1,'MID_DUP')]]);
 assert.equal(x.result.events[0].status,'PREVIEW_CREATED');
 assert.equal(x.result.events[1].status,'DUPLICATE_SUPPRESSED');
});
test('same MID on different PSIDs is NOT a duplicate',async()=>{
 const x=await exec([[P1,textEvent(P1,U1,'MID_SHARED'),textEvent(P1,U2,'MID_SHARED')]]);
 assert.equal(x.result.events.filter(e=>e.status==='PREVIEW_CREATED').length,2);
});
test('same MID across Pages is NOT a duplicate',async()=>{
 const x=await exec([[P1,textEvent(P1,U1,'MID_SHARED')],[P2,textEvent(P2,U1,'MID_SHARED')]]);
 assert.equal(x.result.events.filter(e=>e.status==='PREVIEW_CREATED').length,2);
});
test('invalid HMAC performs ZERO database queries in multi-event webhook',async()=>{
 const fx=fixture();
 const args=signRaw(envelope([[P1,textEvent(P1,U1,'X1'),textEvent(P1,U2,'X2')]]));
 args.signature='sha256='+'0'.repeat(64);
 await expectCode(preview({...fx.options,...args}),'META_SIGNATURE_INVALID');
 assert.equal(fx.queries.length,0);
});
test('missing schema blocks before any Page lookup',async()=>{
 const fx=fixture({readiness:{products_store_id_ready:false}});
 await expectCode(preview({...fx.options,...signRaw(envelope([[P1,textEvent(P1,U1,'X1')]]))}),
  'CANONICAL_STORE_RLS_MISSING');
 assert.equal(fx.queries.filter(([sql])=>sql===SQL.binding).length,0);
});
test('unknown Page in multi-event causes fail-closed entire response',async()=>{
 const bad='77777777777777777',fx=fixture();
 await expectCode(preview({...fx.options,...signRaw(envelope([
  [P1,textEvent(P1,U1,'VALID')],[bad,textEvent(bad,U2,'NO_PAGE')]
 ]))}),'PAGE_NOT_BOUND');
});
test('same-tenant Store B product row in Store A blocks whole batch',async()=>{
 const fx=fixture({catalogRows:[product(B)]});
 await expectCode(preview({...fx.options,...signRaw(envelope([
  [P1,postbackEvent(P1,U1,'C1')]
 ]))}),'CATALOG_ROW_SCOPE_INVALID');
});
test('missing real hosted RLS always blocked',async()=>{
 const fx=fixture();
 await expectCode(preview({...fx.options,mode:'HOSTED_READ_ONLY',
  ...signRaw(envelope([[P1,textEvent(P1,U1,'X1')]]))}),'M4_OFFLINE_ONLY');
 assert.equal(fx.queries.length,0);
});
test('empty/missing replay store fails safe',async()=>{
 const fx=fixture();
 await expectCode(preview({...fx.options,replayCheck:undefined,
  ...signRaw(envelope([[P1,textEvent(P1,U1,'X1')]]))}),'M4_REPLAY_PORT_REQUIRED');
});
test('no orders, sends, persistent replay or outbox enabled',async()=>{
 const x=await exec([[P1,textEvent(P1,U1,'QA')]]);const r=x.result;
 for(const field of ['sendEnabled','allowOrderWrites','hostedReady',
  'durableReplayReady','outboxWriteEnabled','providerTransportEnabled']){
  assert.equal(r[field],false,field);
 }
 assert.equal(r.replayMode,'DRY_RUN');
});
test('100 simultaneous duplicate claims get exactly one firstSeen in synthetic QA',async()=>{
 const store=createSyntheticReplayStore({clock:now});
 const req={tenantId:T,storeId:A,pageId:P1,senderPsid:U1,
  bindingVersion:1,replayKey:'a'.repeat(64),mode:'DRY_RUN'};
 const results=await Promise.all(Array.from({length:100},()=>store.replayCheck(req)));
 assert.equal(results.filter(x=>x.firstSeen).length,1);
 assert.equal(store.diagnostics().durable,false);
});
test('replay key respects sender, Page, Store and binding version',async()=>{
 const st=createSyntheticReplayStore({clock:now}),base={
  tenantId:T,storeId:A,pageId:P1,senderPsid:U1,
  bindingVersion:1,replayKey:'b'.repeat(64),mode:'DRY_RUN'};
 for(const item of [base,{...base,senderPsid:U2},{...base,pageId:P2},
  {...base,storeId:B},{...base,bindingVersion:2}]){
  assert.equal((await st.replayCheck(item)).firstSeen,true);
  assert.equal((await st.replayCheck(item)).firstSeen,false);
 }
 assert.equal(st.diagnostics().size,5);
});
test('invalid replay scope cannot be claimed',async()=>{
 const st=createSyntheticReplayStore({clock:now});
 await expectCode(st.replayCheck({tenantId:T,storeId:A,pageId:P1,senderPsid:'../../bad',
  bindingVersion:1,replayKey:'b'.repeat(64),mode:'DRY_RUN'}),'QA_REPLAY_TRUSTED_SCOPE_REQUIRED');
});
test('LIVE replay mode blocked even inside synthetic store',async()=>{
 const st=createSyntheticReplayStore({clock:now});
 await expectCode(st.replayCheck({tenantId:T,storeId:A,pageId:P1,senderPsid:U1,
  bindingVersion:1,replayKey:'b'.repeat(64),mode:'LIVE'}),'QA_REPLAY_TRUSTED_SCOPE_REQUIRED');
});
test('replay expires only after synthetic TTL for controlled testing',async()=>{
 let time=1000000000000;const store=createSyntheticReplayStore({
  clock:()=>time,ttlMs:86400000});
 const req={tenantId:T,storeId:A,pageId:P1,senderPsid:U1,bindingVersion:1,
  replayKey:'c'.repeat(64),mode:'DRY_RUN'};
 assert.equal((await store.replayCheck(req)).firstSeen,true);
 time+=86399999;assert.equal((await store.replayCheck(req)).firstSeen,false);
 time+=2;assert.equal((await store.replayCheck(req)).firstSeen,true);
});
test('capacity overflow cannot silently forget an active replay',async()=>{
 const store=createSyntheticReplayStore({clock:now,maxKeys:1});
 const req={tenantId:T,storeId:A,pageId:P1,senderPsid:U1,bindingVersion:1,
  replayKey:'d'.repeat(64),mode:'DRY_RUN'};
 await store.replayCheck(req);
 await expectCode(store.replayCheck({...req,replayKey:'e'.repeat(64)}),
 'QA_REPLAY_CAPACITY_EXCEEDED');
 assert.equal((await store.replayCheck(req)).firstSeen,false);
});
test('replay simulation never pretends to persist across fresh store instances',async()=>{
 const req={tenantId:T,storeId:A,pageId:P1,senderPsid:U1,bindingVersion:1,
  replayKey:'f'.repeat(64),mode:'DRY_RUN'};
 const s1=createSyntheticReplayStore({clock:now}),s2=createSyntheticReplayStore({clock:now});
 assert.equal((await s1.replayCheck(req)).firstSeen,true);
 assert.equal((await s2.replayCheck(req)).firstSeen,true);
 assert.equal(s1.diagnostics().supportsAtomicDb,false);
});
test('invalid config is refused before any QA replay claims',()=>{
 assert.throws(()=>createSyntheticReplayStore({ttlMs:1000}),
 /QA_REPLAY_STORE_CONFIG_INVALID/);
});
