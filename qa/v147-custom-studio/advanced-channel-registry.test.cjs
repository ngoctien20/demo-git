'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const registry=require('./advanced-channel-registry.js');
const policy=require('./advanced-presentation-policy.js');
const studioApi=require('./studio-core.js');
const make=(shop='A',channel='MESSENGER',intent='DISCOVER',studio=studioApi.createStudio())=>
 registry.compose({studio,studioApi,policy,shop,channel,proposal:{intent}});
test('01 all four channels',()=>assert.deepEqual(registry.CHANNELS,['MESSENGER','ZALO_BOT','ZALO_OA','WEB_WIDGET']));
test('02 component IDs unique',()=>assert.equal(new Set(registry.COMPONENTS).size,registry.COMPONENTS.length));
test('03 each channel has 13 components',()=>{for(const c of registry.CHANNELS)assert.equal(registry.list(c).length,13)});
test('04 no native send allowed anywhere',()=>{
 for(const c of registry.CHANNELS)for(const x of registry.list(c)){
  assert.equal(x.canSend,false);assert.equal(x.entitlementVerified,false);assert.equal(x.previewOnly,true);
  assert.equal(registry.decision(c,x.component).nativeSendAuthorized,false);
 }
});
test('05 all entries have explicit fallback',()=>{for(const c of registry.CHANNELS)for(const x of registry.list(c))assert.equal(x.fallback,'TEXT')});
test('06 all components have review requirements',()=>{for(const c of registry.CHANNELS)for(const x of registry.list(c))assert.equal(typeof x.review,'string')});
test('07 each channel matrix has explicit defined state',()=>{
 for(const c of registry.CHANNELS)for(const x of registry.list(c))assert(registry.STATES.includes(x.state));
});
test('08 no native Messenger arbitrary Rich Text',()=>{
 assert.equal(registry.decision('MESSENGER','RICH_TEXT').fallbackRequired,true);
 assert.equal(registry.decision('MESSENGER','RICH_TEXT').reason,'UNSUPPORTED_BY_CHANNEL');
});
test('09 Messenger product card is documented, but account-gated',()=>{
 const d=registry.decision('MESSENGER','PRODUCT_CARD');
 assert.equal(d.state,'ACCOUNT_GATED');assert.equal(d.nativeSendAuthorized,false);
 assert.equal(d.preview,'STRUCTURED_NO_SEND_PREVIEW');
});
test('10 Zalo Bot Rich Text documented, not live authorization',()=>{
 const d=registry.decision('ZALO_BOT','RICH_TEXT');assert.equal(d.state,'DOCUMENTED');
 assert.equal(d.entitlementVerified,false);
});
test('11 Zalo Bot native carousel explicitly unverified',()=>{
 const d=registry.decision('ZALO_BOT','CAROUSEL');assert.equal(d.state,'UNVERIFIED');
 assert.equal(d.preview,'TEXT_FALLBACK_PREVIEW');
});
test('12 Zalo Bot native buttons and quick replies unverified',()=>{
 for(const x of ['ACTION_BUTTON','QUICK_REPLY'])assert.equal(registry.decision('ZALO_BOT',x).state,'UNVERIFIED');
});
test('13 Zalo Bot photo docs reference correct endpoint',()=>{
 const e=registry.entry('ZALO_BOT','IMAGE');assert.match(e.providerDoc,/sendPhoto$/);
});
test('14 OA rich text unverified',()=>assert.equal(registry.decision('ZALO_OA','RICH_TEXT').fallbackRequired,true));
test('15 OA CTA account gated',()=>assert.equal(registry.entry('ZALO_OA','OA_CTA').state,'ACCOUNT_GATED'));
test('16 OA ZBS needs approval and cost',()=>{
 const d=registry.decision('ZALO_OA','ZBS_TEMPLATE');
 assert.equal(d.state,'APPROVAL_SPEND');assert.equal(d.costsOrApproval,true);
 assert.equal(d.fallbackRequired,true);assert.equal(d.reason,'PAID_TEMPLATE_APPROVAL_REQUIRED');
});
test('17 website controls local preview only',()=>{
 for(const x of ['RICH_TEXT','PRODUCT_CARD','CAROUSEL','ACTION_BUTTON']){
  const d=registry.decision('WEB_WIDGET',x);assert.equal(d.state,'LOCAL_PREVIEW');
  assert.equal(d.nativeSendAuthorized,false);
 }
});
test('18 malformed channel fail closed',()=>assert.throws(()=>registry.entry('TELEGRAM','TEXT'),/UNKNOWN_CHANNEL/));
test('19 unknown component fail closed',()=>assert.throws(()=>registry.entry('ZALO_BOT','HACKED_FORM'),/UNKNOWN_COMPONENT/));
test('20 registry entry is immutable',()=>assert.equal(Object.isFrozen(registry.entry('MESSENGER','TEXT')),true));
test('21 policy compiler remains store scoped A/B/C',()=>{
 for(const s of ['A','B','C'])for(const c of registry.CHANNELS){
  const x=make(s,c);assert.equal(x.storeId,studioApi.FIXTURES[s].storeId);
  assert.equal(x.tenantId,studioApi.FIXTURES[s].tenantId);
 }
});
test('22 A/B same tenant, different store & price',()=>{
 const a=make('A','MESSENGER'),b=make('B','MESSENGER');
 assert.equal(a.tenantId,b.tenantId);assert.notEqual(a.storeId,b.storeId);
 assert.match(a.fallbackText,/Gạo thơm/);assert.match(b.fallbackText,/Áo kiểu/);
});
test('23 C separate tenant and source fixture',()=>{
 const a=make('A','WEB_WIDGET','QUOTE'),c=make('C','WEB_WIDGET','QUOTE');
 assert.notEqual(a.tenantId,c.tenantId);assert.match(c.fallbackText,/259.000đ/);
});
test('24 Messenger generic preview cannot be sent',()=>{
 const x=make('A','MESSENGER','DISCOVER');
 assert.equal(x.preferredComponent,'PRODUCT_CARD');assert.equal(x.renderedComponent,'PRODUCT_CARD');
 assert.equal(x.canSend,false);assert.equal(x.accountPermissionsVerified,false);
});
test('25 Messenger greeting maps quick reply, still inactive',()=>{
 const x=make('A','MESSENGER','GREETING');
 assert.equal(x.preferredComponent,'QUICK_REPLY');
 assert(x.render.buttons.every(b=>!b.interactive));
});
test('26 Zalo Bot discover falls back without approved image',()=>{
 const x=make('B','ZALO_BOT','DISCOVER');
 assert.equal(x.preferredComponent,'IMAGE');assert.equal(x.renderedComponent,'TEXT');
 assert.equal(x.reason,'VERIFIED_MEDIA_MISSING');assert.match(x.notes.join(' '),/Chưa có ảnh được duyệt/);
});
test('27 Zalo Bot low-stock remains rich text',()=>{
 const x=make('A','ZALO_BOT','LOW_STOCK');
 assert.equal(x.renderedComponent,'RICH_TEXT');assert(x.render.text_styles.some(x=>x.st.includes('c_db342e')));
});
test('28 Zalo OA uses TEXT fallback and blocks sensitive actions',()=>{
 const x=make('A','ZALO_OA','ORDER_LOOKUP');assert.equal(x.renderedComponent,'TEXT');
 assert.equal(x.signedActionsIssued,0);assert.match(x.fallbackText,/xác minh/i);
});
test('29 Website product card only local preview',()=>{
 const x=make('C','WEB_WIDGET','DISCOVER');assert.equal(x.renderedComponent,'PRODUCT_CARD');
 assert.equal(x.capabilityDecision.state,'LOCAL_PREVIEW');assert.equal(x.providerSends,0);
});
test('30 safe fallback is never a sensitive order lookup',()=>{
 for(const c of registry.CHANNELS){
  const x=make('A',c,'ORDER_LOOKUP');
  assert.equal(x.orderWrites,0);assert.equal(x.customerDataReads,0);
  assert.equal(x.canPublish,false);assert.match(x.fallbackText,/xác minh/i);
 }
});
test('31 all 96 shop/channel/intent routes no send/write/actions',()=>{
 for(const s of ['A','B','C'])for(const c of registry.CHANNELS)for(const i of policy.INTENTS){
  const x=make(s,c,i);
  assert.equal(x.canSend,false);assert.equal(x.canPublish,false);
  assert.equal(x.providerSends,0);assert.equal(x.orderWrites,0);
  assert.equal(x.signedActionsIssued,0);assert.equal(x.ownerConsentVerified,false);
 }
});
test('32 rejects AI injecting arbitrary links, actions, style, price',()=>{
 const studio=studioApi.createStudio();
 assert.throws(()=>registry.compose({studio,studioApi,policy,shop:'A',channel:'MESSENGER',
 proposal:{intent:'QUOTE',price:1,link:'https://evil.example',actions:['DELETE_ORDER']}}),/UNTRUSTED_MODEL_FIELDS/);
});
test('33 rejects shop scope mismatch',()=>{
 const s=studioApi.createStudio(),studio={get:()=>({...s.get('A','ZALO_BOT'),store_id:'qa_shop_b'})};
 assert.throws(()=>registry.compose({studio,studioApi,policy,shop:'A',channel:'ZALO_BOT',proposal:{intent:'QUOTE'}}),/STORE_POLICY_MISMATCH/);
});
test('34 rejects unknown base render type',()=>assert.throws(()=>registry.selectComponent({type:'INJECT_BUTTON'},'MESSENGER'),/UNRECOGNIZED_RENDER_TYPE/));
test('35 refuses access to undocumented channel entry',()=>assert.throws(()=>registry.list('WHATSAPP'),/UNKNOWN_CHANNEL/));
test('36 all registry links are public docs, never account token URLs',()=>{
 for(const c of registry.CHANNELS)for(const x of registry.list(c)){
  if(x.providerDoc){assert.match(x.providerDoc,/^https:\/\//);assert(!/[?&](?:token|key)=/i.test(x.providerDoc));}
 }
});
test('37 copy mutation must not affect source registry',()=>{
 const x=registry.list('MESSENGER');
 assert.throws(()=>{x[0].canSend=true},TypeError);
 assert.equal(registry.entry('MESSENGER','TEXT').canSend,false);
});
test('38 no paid OA template send on rich experiment',()=>{
 const x=make('C','ZALO_OA','DISCOVER');
 assert.equal(x.canSend,false);assert.equal(x.capabilityDecision.costsOrApproval,false);
 assert.equal(registry.decision('ZALO_OA','ZBS_TEMPLATE').nativeSendAuthorized,false);
});
test('39 mutable user grants cannot bypass native send lock',()=>{
 const d=registry.decision('ZALO_OA','OA_CTA',{ownerApproved:true,providerApproved:true});
 assert.equal(d.nativeSendAuthorized,false);
});
test('40 component status cannot be treated as deployed feature',()=>{
 for(const c of registry.CHANNELS)for(const x of registry.list(c)){
  assert.equal(x.previewOnly,true);assert.equal(x.entitlementVerified,false);
 }
});