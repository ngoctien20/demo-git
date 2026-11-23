'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHmac}=require('node:crypto');
const {sign}=require('../messenger-rich-v136m/adapter.cjs');
const {DB_PROBE,SQL}=require('../messenger-rich-v136m2/trusted-repository.cjs');
const {previewMessengerV136M3:preview}=require('./canonical-pipeline.cjs');

const NOW=Date.parse('2026-11-15T10:00:00Z'),now=()=>NOW;
const TENANT='11111111-1111-4111-8111-111111111111';
const STORE_A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const STORE_B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PAGE_A='12345678901234567',PAGE_B='98765432109876543';
const PSID_A='55555555555555555',PSID_B='66666666666666666';
const APP='SYNTHETIC_META_TEST_APP_SECRET_NOT_REAL_2026';
const ACTION='SYNTHETIC_ACTION_SECRET_NOT_REAL_2026_404';
const ORIGIN='https://shop.example.invalid';
const lookup={
 [PAGE_A]:{page_id:PAGE_A,tenant_id:TENANT,store_id:STORE_A},
 [PAGE_B]:{page_id:PAGE_B,tenant_id:TENANT,store_id:STORE_B}
};
const binding=(page,store)=>({
 page_id:page,tenant_id:TENANT,store_id:store,
 binding_state:'active',owner_verified:true,inbound_enabled:true,
 binding_version:1,store_state:'active',owner_membership_confirmed:true
});
const row=(store)=>({
 id:store,tenant_id:TENANT,store_id:store,
 sku:store===STORE_A?'QA_SKU_A':'QA_SKU_B',
 name:store===STORE_A?'Sản phẩm QA A':'Sản phẩm QA B',
 price_vnd:store===STORE_A?'159000':'219000',
 stock_on_hand:4,is_active:true
});
const ready={
 stores_ready:true,store_memberships_ready:true,page_bindings_ready:true,
 products_store_id_ready:true,products_rls_ready:true,
 stores_rls_ready:true,memberships_rls_ready:true
};
function fixture(overrides={}){
 const calls=[],seen=new Set();
 const db={readOnly:true,bypassRls:false,
  authorizedProfile:'RESTRICTED_MESSENGER_READONLY',
  query:async(sql,values)=>{
   calls.push({sql,values});
   if(overrides.throwDb)throw Error('database connection failed password=CONFIDENTIAL_SECRET');
   if(sql===DB_PROBE)return {rows:[{...ready,...overrides.readiness}]};
   if(sql===SQL.binding){
    const b=lookup[values[0]];
    const rows=b?[binding(b.page_id,b.store_id)]:[];
    return {rows:overrides.bindingRows!==undefined?overrides.bindingRows:rows};
   }
   if(sql===SQL.catalog){
    const rows=[row(STORE_A),row(STORE_B)].filter(p=>p.tenant_id===values[0]&&p.store_id===values[1]);
    return {rows:overrides.catalogRows!==undefined?overrides.catalogRows:rows};
   }
   throw Error('UNEXPECTED_QUERY');
  }};
 const f={
  db,calls,
  readPublicConfig:async({tenantId,storeId})=>({
   source:'TRUSTED_PRIVATE_PUBLIC_SHOP_CONFIG',
   tenantId,storeId,shopSlug:storeId===STORE_A?'shop-a':'shop-b',
   webOrigins:[ORIGIN],imageOrigins:[]
  }),
  readEntitlement:async({tenantId,storeId})=>({
   source:'TRUSTED_PRIVATE_ENTITLEMENT',
   tenantId,storeId,active:true,botPaused:false,featureEnabled:true,
   expiresAtMs:NOW+300000
  }),
  replayCheck:async({tenantId,storeId,replayKey,mode})=>{
   const key=tenantId+'|'+storeId+'|'+replayKey,firstSeen=!seen.has(key);
   seen.add(key);
   return {mode,firstSeen,externalWriteOccurred:false};
  },
  mode:'SYNTHETIC_QA_ONLY',now,siteOrigin:ORIGIN
 };
 if(overrides.paused)f.readEntitlement=async({tenantId,storeId})=>({
  source:'TRUSTED_PRIVATE_ENTITLEMENT',tenantId,storeId,
  active:true,botPaused:true,featureEnabled:true,expiresAtMs:NOW+300000
 });
 if(overrides.expired)f.readEntitlement=async({tenantId,storeId})=>({
  source:'TRUSTED_PRIVATE_ENTITLEMENT',tenantId,storeId,
  active:true,botPaused:false,featureEnabled:true,expiresAtMs:NOW-1000
 });
 if(overrides.unsafeReplay)f.replayCheck=async()=>({
  mode:'DRY_RUN',firstSeen:true,externalWriteOccurred:true
 });
 return f;
}
function trustedFor(page,psid){
 const a=lookup[page];
 return {source:'SERVER_VERIFIED_MESSENGER_BINDING',
  serverDerived:true,verified:true,pageId:page,recipientPsid:psid,
  tenantId:a.tenant_id,storeId:a.store_id,shopSlug:page===PAGE_A?'shop-a':'shop-b',
  webOrigins:[ORIGIN],imageOrigins:[]
 };
}
function message(page=PAGE_A,psid=PSID_A,payload){
 const content=payload===undefined
 ? {message:{text:'Xin chào',mid:'MID_QA_001'}}
 : {postback:{payload,mid:'PB_QA_001'}};
 return {sender:{id:psid},recipient:{id:page},timestamp:NOW,...content};
}
function evt(page=PAGE_A,psid=PSID_A,payload){
 return {object:'page',entry:[{id:page,messaging:[message(page,psid,payload)]}]};
}
function signed(page=PAGE_A,psid=PSID_A,action='BROWSE_CATALOG',storeItem='NONE'){
 const payload=sign({trusted:trustedFor(page,psid),
 secret:ACTION,action,itemId:storeItem,now});
 return evt(page,psid,payload);
}
function pack(event,overrides={}){
 const rawBody=JSON.stringify(event);
 return {rawBody,signature:'sha256='+createHmac('sha256',APP).update(rawBody).digest('hex'),
  appSecret:APP,actionSecret:ACTION,...overrides};
}
function createArgs(event=evt(),opts={}){
 const f=fixture(opts.fixture||{}),a=pack(event);
 return {args:{...f,...a,...opts.args},fixture:f};
}
const card=x=>x.events[0].prepared.body.message.attachment.payload.elements[0];
const code=async(promise,error)=>assert.rejects(promise,new RegExp(error));

test('default block: no repository query or send',async()=>{
 const {args,fixture:f}=createArgs();delete args.mode;
 await code(preview(args),'HOSTED_MESSENGER_INTEGRATION_NOT_APPROVED');
 assert.equal(f.calls.length,0);
});
test('hosted modes explicitly blocked independent of fake database proof',async()=>{
 for(const mode of ['HOSTED_READ_ONLY','PRODUCTION','STAGING_SEND']){
  const {args,fixture:f}=createArgs(evt(),{args:{mode}});
  await code(preview(args),'HOSTED_MESSENGER_INTEGRATION_NOT_APPROVED');
  assert.equal(f.calls.length,0);
 }
});
test('invalid Meta HMAC must be rejected before ALL database lookups',async()=>{
 const {args,fixture:f}=createArgs(evt(),{args:{signature:'sha256='+'0'.repeat(64)}});
 await code(preview(args),'META_SIGNATURE_INVALID');
 assert.equal(f.calls.length,0);
});
test('missing signature must be rejected before database lookup',async()=>{
 const {args,fixture:f}=createArgs(evt(),{args:{signature:undefined}});
 await code(preview(args),'META_SIGNATURE_REQUIRED');
 assert.equal(f.calls.length,0);
});
test('valid text response yields ONLY Quick Replies preview',async()=>{
 const {args}=createArgs();const x=await preview(args);
 assert.equal(x.stage,'MESSENGER_RICH_UI_V136M3');
 assert.equal(x.canonicalResolver,'trusted-repository.cjs');
 assert.equal(x.sendEnabled,false);assert.equal(x.allowOrderWrites,false);
 assert.equal(x.providerTransportEnabled,false);assert.equal(x.hostedReady,false);
 assert.equal(x.events[0].route,'QUICK_MENU');
 assert.equal(x.events[0].prepared.body.message.quick_replies.length,3);
});
test('same-tenant Page A returns only Store A product and verified price',async()=>{
 const {args}=createArgs(signed());
 const x=await preview(args);
 assert.equal(card(x).title,'Sản phẩm QA A');
 assert.match(card(x).subtitle,/159\.000 đ/);
 assert.equal(card(x).image_url,undefined);
});
test('same-tenant Page B returns only Store B product and verified price',async()=>{
 const {args}=createArgs(signed(PAGE_B,PSID_B));
 const x=await preview(args);
 assert.equal(card(x).title,'Sản phẩm QA B');
 assert.match(card(x).subtitle,/219\.000 đ/);
});
test('two different Pages in one webhook resolve two separate stores',async()=>{
 const a=signed(PAGE_A,PSID_A).entry[0],b=signed(PAGE_B,PSID_B).entry[0];
 const {args}=createArgs({object:'page',entry:[a,b]});
 const x=await preview(args);
 assert.equal(x.events.length,2);
 assert.equal(card({events:[x.events[0]]}).title,'Sản phẩm QA A');
 assert.equal(card({events:[x.events[1]]}).title,'Sản phẩm QA B');
});
test('webhook may contain forged tenant/store but cannot override DB binding',async()=>{
 const bad=signed();bad.entry[0].tenant_id='ATTACK';
 bad.entry[0].store_id=STORE_B;
 bad.entry[0].messaging[0].tenant_id='ATTACK';
 bad.entry[0].messaging[0].store_id=STORE_B;
 const {args}=createArgs(bad);
 const x=await preview(args);
 assert.equal(card(x).title,'Sản phẩm QA A');
});
test('same-tenant cross-store catalog row is rejected',async()=>{
 const {args}=createArgs(signed(),{fixture:{catalogRows:[row(STORE_B)]}});
 await code(preview(args),'CATALOG_ROW_SCOPE_INVALID');
});
test('row without store_id is rejected and never shown',async()=>{
 const p=row(STORE_A);delete p.store_id;
 const {args}=createArgs(signed(),{fixture:{catalogRows:[p]}});
 await code(preview(args),'CATALOG_ROW_SCOPE_INVALID');
});
test('unverified Page binding rejected, no catalog read',async()=>{
 const b={...binding(PAGE_A,STORE_A),owner_verified:false};
 const {args,fixture:f}=createArgs(signed(),{fixture:{bindingRows:[b]}});
 await code(preview(args),'CHANNEL_BINDING_NOT_AUTHORIZED');
 assert.ok(f.calls.every(x=>x.sql!==SQL.catalog));
});
test('nonexistent Page rejected',async()=>{
 const other='77777777777777777';
 const {args}=createArgs(evt(other));
 await code(preview(args),'PAGE_NOT_BOUND');
});
test('ambiguous Page binding rejected',async()=>{
 const b=binding(PAGE_A,STORE_A);
 const {args}=createArgs(signed(),{fixture:{bindingRows:[b,b]}});
 await code(preview(args),'PAGE_AMBIGUOUS');
});
test('missing canonical schema rejects after Meta verification and before catalog',async()=>{
 const {args,fixture:f}=createArgs(signed(),{fixture:{readiness:{products_store_id_ready:false}}});
 await code(preview(args),'CANONICAL_STORE_RLS_MISSING');
 assert.deepEqual(f.calls.map(x=>x.sql),[DB_PROBE]);
});
test('revoked shop / bot pause blocks access',async()=>{
 const {args}=createArgs(signed(),{fixture:{paused:true}});
 await code(preview(args),'SHOP_OR_SUBSCRIPTION_UNAUTHORIZED');
});
test('expired entitlement blocks access',async()=>{
 const {args}=createArgs(signed(),{fixture:{expired:true}});
 await code(preview(args),'SHOP_OR_SUBSCRIPTION_UNAUTHORIZED');
});
test('replay does not persist, duplicate event suppressed inside QA port',async()=>{
 const f=fixture();const p=pack(evt());
 const a=await preview({...f,...p}),b=await preview({...f,...p});
 assert.equal(a.events[0].status,'PREVIEW_CREATED');
 assert.equal(b.events[0].status,'DUPLICATE_SUPPRESSED');
 assert.equal(b.durableReplayReady,false);
});
test('external-write replay guard denied even in OFFLINE mode',async()=>{
 const {args}=createArgs(evt(),{fixture:{unsafeReplay:true}});
 await code(preview(args),'REPLAY_CHECK_NOT_SAFE');
});
test('invalid decimal VND money rejected without price guessing',async()=>{
 const p={...row(STORE_A),price_vnd:'159.000đ'};
 const {args}=createArgs(signed(),{fixture:{catalogRows:[p]}});
 await code(preview(args),'CATALOG_PRICE_INVALID');
});
test('untrusted site origin cannot be placed in Rich UI webview',async()=>{
 const {args}=createArgs(signed(),{args:{siteOrigin:'https://attacker.example'}});
 await code(preview(args),'WEBVIEW_URL_NOT_ALLOWED');
});
test('postback with invalid signature cannot be treated as an order action',async()=>{
 const {args}=createArgs(evt(PAGE_A,PSID_A,'T404M1.broken.bad'));
 await code(preview(args),'ACTION_PAYLOAD_INVALID');
});
test('same store, multiple sender events in one request fail closed until per-event port isolation',async()=>{
 const e={object:'page',entry:[{id:PAGE_A,messaging:[
  message(PAGE_A,PSID_A),message(PAGE_A,PSID_B)
 ]}]};
 const {args}=createArgs(e);
 await code(preview(args),'SCOPE_REUSE_ACROSS_PAGE_OR_SENDER');
});
test('DB internal exceptions are sanitized, never leak raw errors',async()=>{
 const {args}=createArgs(evt(),{fixture:{throwDb:true}});
 await code(preview(args),'CANONICAL_PIPELINE_BLOCKED');
 try{await preview(args)}catch(e){assert.doesNotMatch(e.message,/CONFIDENTIAL_SECRET/)}
});
test('no live Meta Send API or mutation functions exported',()=>{
 const exported=require('./canonical-pipeline.cjs');
 assert.deepEqual(Object.keys(exported),['previewMessengerV136M3']);
});
