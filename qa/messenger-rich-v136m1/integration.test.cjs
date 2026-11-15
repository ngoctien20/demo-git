'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createHmac}=require('node:crypto');
const {sign}=require('../messenger-rich-v136m/adapter.cjs');
const {verifyMetaRaw,mapCatalogRecord,verifyCatalogResponse,processCandidate}=require('./integration.cjs');
const NOW=Date.parse('2026-11-15T10:00:00Z'),now=()=>NOW;
const appSecret='SYNTHETIC_META_APP_SECRET_NOT_REAL_0000000000000';
const actionSecret='SYNTHETIC_ACTION_SIGNING_SECRET_NOT_REAL_00000';
const binding={source:'SERVER_VERIFIED_MESSENGER_BINDING',serverDerived:true,verified:true,
 pageId:'100000000000000',recipientPsid:'200000000000000',
 tenantId:'tenant-qa-A',storeId:'store-qa-A',shopSlug:'shop-a',
 webOrigins:['https://shop.qa.example'],imageOrigins:['https://img.qa.example']};
const row=(i=1)=>({id:'qa-id-'+i,tenant_id:binding.tenantId,sku:'QA_SKU'+i,
 name:'Sản phẩm QA '+i,price_vnd:'159000',stock_on_hand:5,is_active:true});
const event=(e={message:{text:'Xin chào',mid:'mid_QA_001'}})=>({
 object:'page',entry:[{id:binding.pageId,messaging:[{sender:{id:binding.recipientPsid},
 recipient:{id:binding.pageId},timestamp:NOW,...e}]}]});
const pack=(body)=>{const rawBody=JSON.stringify(body);
 return {rawBody,signature:'sha256='+createHmac('sha256',appSecret).update(rawBody).digest('hex'),
 appSecret,actionSecret,siteOrigin:'https://shop.qa.example',now};};
const ports=(override={})=>{
 const seen=new Set();
 return {
  resolveBinding:async()=>({...binding}),
  readShopStatus:async()=>({source:'SERVER_VERIFIED_SHOP_STATUS',
   tenantId:binding.tenantId,storeId:binding.storeId,
   active:true,botPaused:false,entitlement:'MESSENGER_RICH_UI_CANDIDATE',
   expiresAt:new Date(NOW+3600000).toISOString()}),
  readCatalog:async()=>({source:'SERVER_VERIFIED_TENANT_CATALOG',
   tenantId:binding.tenantId,storeId:binding.storeId,
   serverAuthorized:true,readOnly:true,
   isolationProof:'ONE_STORE_PER_TENANT_VERIFIED',rows:[row()]}),
  checkAndReserveEvent:async({replayKey,tenantId,storeId})=>{
   const firstSeen=!seen.has(replayKey);seen.add(replayKey);
   return {source:'SERVER_VERIFIED_REPLAY_GUARD',firstSeen,tenantId,storeId,mode:'DRY_RUN'};
  },
  ...override
 };
};
const run=(evt=event(),opts={})=>processCandidate({...pack(evt),ports:ports(),...opts});
const signedEvent=(action='BROWSE_CATALOG',itemId='NONE')=>event({postback:{
 payload:sign({trusted:binding,secret:actionSecret,action,itemId,now}),mid:'pb_QA_001'}});
test('valid Meta HMAC over exact bytes accepted',()=>{
 const x=pack(event());assert.equal(verifyMetaRaw(x),true);
});
test('mismatched Meta signature refused',()=>assert.throws(()=>{
 const x=pack(event());verifyMetaRaw({...x,rawBody:x.rawBody+' '});
},/META_SIGNATURE_INVALID/));
test('missing signature refused',()=>assert.throws(()=>verifyMetaRaw({
 ...pack(event()),signature:''}),/META_SIGNATURE_REQUIRED/));
test('invalid Meta secret refused',()=>assert.throws(()=>verifyMetaRaw({
 ...pack(event()),appSecret:'x'}),/META_APP_SECRET_MISSING/));
test('oversize raw body refused',()=>assert.throws(()=>verifyMetaRaw({
 ...pack(event()),rawBody:'x'.repeat(129*1024)}),/RAW_BODY_INVALID/));
test('text request creates ONLY Quick Replies preview',async()=>{
 const v=await run();assert.equal(v.previewOnly,true);assert.equal(v.sendEnabled,false);
 assert.equal(v.events.length,1);assert.equal(v.events[0].route,'QUICK_MENU');
 assert.equal(v.events[0].prepared.body.message.quick_replies.length,3);
 assert.equal(v.events[0].prepared.sendEnabled,false);
});
test('signed browse Postback yields real schema-matched image-less carousel proposal',async()=>{
 const v=await run(signedEvent());
 const e=v.events[0].prepared.body.message.attachment.payload.elements[0];
 assert.equal(v.events[0].route,'BROWSE_CATALOG');
 assert.equal(v.events[0].prepared.body.message.attachment.payload.template_type,'generic');
 assert.equal(e.title,'Sản phẩm QA 1');assert.match(e.subtitle,/159\.000 đ/);
 assert.equal(e.image_url,undefined);
 assert.equal(e.buttons.length,3);
});
test('server supplied verified HTTPS image can appear but no invented image',async()=>{
 const p=ports({readCatalog:async()=>({
  source:'SERVER_VERIFIED_TENANT_CATALOG',tenantId:binding.tenantId,
  storeId:binding.storeId,serverAuthorized:true,readOnly:true,
  isolationProof:'ONE_STORE_PER_TENANT_VERIFIED',
  rows:[{...row(),image_url_verified:'https://img.qa.example/QA_SKU1.jpg'}]
 })});
 const v=await run(signedEvent(),{ports:p});
 assert.match(v.events[0].prepared.body.message.attachment.payload.elements[0].image_url,/QA_SKU1\.jpg/);
});
test('signed view product filters by SKU not LLM guessed item',async()=>{
 const p=ports({readCatalog:async()=>({
  source:'SERVER_VERIFIED_TENANT_CATALOG',tenantId:binding.tenantId,
  storeId:binding.storeId,serverAuthorized:true,readOnly:true,
  isolationProof:'ONE_STORE_PER_TENANT_VERIFIED',rows:[row(1),row(2)]
 })});
 const v=await run(signedEvent('VIEW_PRODUCT','QA_SKU2'),{ports:p});
 assert.equal(v.events[0].prepared.body.message.attachment.payload.elements[0].title,'Sản phẩm QA 2');
 assert.equal(v.events[0].prepared.body.message.attachment.payload.elements.length,1);
});
test('nonexistent SKU never fabricated as product',async()=>{
 const v=await run(signedEvent('VIEW_PRODUCT','NOT_THERE'));
 assert.match(v.events[0].prepared.body.message.text,/chưa có sản phẩm được xác minh/i);
});
test('empty catalog never fabricates price or products',async()=>{
 const p=ports({readCatalog:async()=>({
  source:'SERVER_VERIFIED_TENANT_CATALOG',tenantId:binding.tenantId,
  storeId:binding.storeId,serverAuthorized:true,readOnly:true,
  isolationProof:'ONE_STORE_PER_TENANT_VERIFIED',rows:[]
 })});
 const v=await run(signedEvent(),{ports:p});
 assert.match(v.events[0].prepared.body.message.text,/chưa có sản phẩm/i);
});
test('Meta quick reply signed payload routes safely',async()=>{
 const token=sign({trusted:binding,secret:actionSecret,action:'ASK_STAFF',itemId:'NONE',now});
 const v=await run(event({message:{text:'Gặp nhân viên',mid:'mid_QA_002',quick_reply:{payload:token}}}));
 assert.equal(v.events[0].route,'ASK_STAFF');
 assert.equal(v.events[0].allowedOrderWrites,false);
});
test('shop staff handoff action only creates proposal',async()=>{
 const v=await run(signedEvent('ASK_STAFF'));
 assert.equal(v.events[0].sendEnabled,false);
 assert.match(v.events[0].prepared.body.message.text,/cần được xác nhận/i);
});
test('track order action never leaks private order without customer login',async()=>{
 const v=await run(signedEvent('TRACK_ORDER'));
 assert.match(v.events[0].prepared.body.message.text,/đăng nhập/i);
});
test('Page level menu button is allowed only for read-only action',async()=>{
 const e=event({postback:{payload:'T404M1:MENU:BROWSE_CATALOG',mid:'pb_menu_1'}});
 const v=await run(e);assert.equal(v.events[0].route,'BROWSE_CATALOG');
});
test('invalid Page level menu mutation refused',async()=>assert.rejects(
 run(event({postback:{payload:'T404M1:MENU:DELETE_ORDER'}})),/ACTION_PAYLOAD_INVALID/));
test('tampered postback refused before catalog read',async()=>assert.rejects(
 run(event({postback:{payload:'T404M1.bad.bad'}})),/ACTION_PAYLOAD_INVALID/));
test('cross shop resolver binding refused',async()=>assert.rejects(
 run(event(),{ports:ports({resolveBinding:async()=>({...binding,tenantId:'tenant-qa-B'})})}),
 /TRUSTED_PAGE_SHOP_SCOPE_DENIED|SHOP_STATUS_UNVERIFIED/));
test('server scope must match incoming Page and sender PSID',async()=>assert.rejects(
 run(event(),{ports:ports({resolveBinding:async()=>({...binding,pageId:'99999999999999'})})}),
 /TRUSTED_PAGE_SHOP_SCOPE_DENIED/));
test('resolver claim from untrusted client refused',async()=>assert.rejects(
 run(event(),{ports:ports({resolveBinding:async()=>({...binding,source:'CLIENT_PAYLOAD'})})}),
 /TRUSTED_PAGE_SHOP_SCOPE_DENIED/));
test('Page recipient spoofing rejected',async()=>{
 const e=event();e.entry[0].messaging[0].recipient.id='300000000000000';
 await assert.rejects(run(e),/META_SENDER_RECIPIENT_UNVERIFIED/);
});
test('echo events skipped',async()=>{
 const e=event({message:{is_echo:true,text:'Echo',mid:'mid_echo'}});
 const v=await run(e);assert.deepEqual(v.events,[]);
});
test('malformed Meta envelope rejected',async()=>assert.rejects(
 run({object:'user',entry:[]}),/META_ENVELOPE_INVALID/));
test('future timestamp outside tolerance denied',async()=>{
 const e=event();e.entry[0].messaging[0].timestamp=NOW+10*60*1000;
 await assert.rejects(run(e),/MESSENGER_TIME_WINDOW_DENIED/);
});
test('old timestamp cannot reopen policy window',async()=>{
 const e=event();e.entry[0].messaging[0].timestamp=NOW-25*60*60*1000;
 await assert.rejects(run(e),/MESSENGER_TIME_WINDOW_DENIED/);
});
test('paused shop denies all Rich UI',async()=>assert.rejects(run(event(),{ports:ports({
 readShopStatus:async()=>({source:'SERVER_VERIFIED_SHOP_STATUS',tenantId:binding.tenantId,
 storeId:binding.storeId,active:true,botPaused:true,
 entitlement:'MESSENGER_RICH_UI_CANDIDATE',expiresAt:new Date(NOW+3600000).toISOString()})
})}),/SHOP_DISABLED_OR_SUBSCRIPTION_UNVERIFIED/));
test('expired entitlement denies Rich UI',async()=>assert.rejects(run(event(),{ports:ports({
 readShopStatus:async()=>({source:'SERVER_VERIFIED_SHOP_STATUS',tenantId:binding.tenantId,
 storeId:binding.storeId,active:true,botPaused:false,
 entitlement:'MESSENGER_RICH_UI_CANDIDATE',expiresAt:new Date(NOW-1).toISOString()})
})}),/SHOP_DISABLED_OR_SUBSCRIPTION_UNVERIFIED/));
test('missing shop status port denied',async()=>assert.rejects(
 run(event(),{ports:{...ports(),readShopStatus:undefined}}),/SERVER_PORT_MISSING/));
test('catalog tenant B row in Shop A refused',async()=>assert.rejects(
 run(signedEvent(),{ports:ports({readCatalog:async()=>({
 source:'SERVER_VERIFIED_TENANT_CATALOG',tenantId:binding.tenantId,storeId:binding.storeId,
 serverAuthorized:true,readOnly:true,isolationProof:'ONE_STORE_PER_TENANT_VERIFIED',
 rows:[{...row(),tenant_id:'tenant-qa-B'}]})})}),/CATALOG_TENANT_OR_SKU_DENIED/));
test('catalog response cross store refused',async()=>assert.rejects(
 run(signedEvent(),{ports:ports({readCatalog:async()=>({
 source:'SERVER_VERIFIED_TENANT_CATALOG',tenantId:binding.tenantId,storeId:'store-qa-B',
 serverAuthorized:true,readOnly:true,isolationProof:'ONE_STORE_PER_TENANT_VERIFIED',
 rows:[row()]})})}),/CATALOG_SCOPE_UNVERIFIED/));
test('multi-store without schema isolation proof blocked',async()=>assert.rejects(
 run(signedEvent(),{ports:ports({readCatalog:async()=>({
 source:'SERVER_VERIFIED_TENANT_CATALOG',tenantId:binding.tenantId,storeId:binding.storeId,
 serverAuthorized:true,readOnly:true,isolationProof:'UNKNOWN',rows:[row()]})})}),
 /CATALOG_SCOPE_UNVERIFIED/));
test('catalog write source response refused',async()=>assert.rejects(
 run(signedEvent(),{ports:ports({readCatalog:async()=>({
 source:'SERVER_VERIFIED_TENANT_CATALOG',tenantId:binding.tenantId,storeId:binding.storeId,
 serverAuthorized:true,readOnly:false,isolationProof:'ONE_STORE_PER_TENANT_VERIFIED',rows:[row()]})})}),
 /CATALOG_SCOPE_UNVERIFIED/));
test('catalog VND bigint decimal string canonicalized exactly',()=>{
 assert.equal(mapCatalogRecord(row(),binding).priceVnd,159000);
});
test('invalid catalog monetary formatting refused',()=>assert.throws(
 ()=>mapCatalogRecord({...row(),price_vnd:'159.000đ'},binding),/CATALOG_VND_INVALID/));
test('unsafe VND bigint refused',()=>assert.throws(
 ()=>mapCatalogRecord({...row(),price_vnd:'99999999999999999'},binding),/CATALOG_VND_INVALID/));
test('invalid stock rejected',()=>assert.throws(
 ()=>mapCatalogRecord({...row(),stock_on_hand:-2},binding),/CATALOG_STOCK_INVALID/));
test('duplicate SKU from catalog blocked',()=>assert.throws(
 ()=>verifyCatalogResponse({source:'SERVER_VERIFIED_TENANT_CATALOG',
 tenantId:binding.tenantId,storeId:binding.storeId,
 serverAuthorized:true,readOnly:true,isolationProof:'ONE_STORE_PER_TENANT_VERIFIED',
 rows:[row(),row()]},binding),/CATALOG_DUPLICATE_SKU/));
test('replay guard suppresses duplicate exact event',async()=>{
 const p=ports();const a=pack(event());
 const first=await processCandidate({...a,ports:p});
 const second=await processCandidate({...a,ports:p});
 assert.equal(first.events[0].status,'PREVIEW_CREATED');
 assert.equal(second.events[0].status,'DUPLICATE_SUPPRESSED');
});
test('replay guard missing server proof denied',async()=>assert.rejects(run(event(),{ports:ports({
 checkAndReserveEvent:async()=>({source:'CLIENT_MEMORY',firstSeen:true,tenantId:binding.tenantId,storeId:binding.storeId,mode:'DRY_RUN'})
})}),/REPLAY_GUARD_UNVERIFIED/));
test('replay guard must not be permitted live write mode',async()=>assert.rejects(run(event(),{ports:ports({
 checkAndReserveEvent:async()=>({source:'SERVER_VERIFIED_REPLAY_GUARD',firstSeen:true,
 tenantId:binding.tenantId,storeId:binding.storeId,mode:'LIVE'})
})}),/REPLAY_GUARD_UNVERIFIED/));
test('all candidate envelopes are preview-only and never authorize order writes',async()=>{
 for(const e of [event(),signedEvent(),signedEvent('ASK_STAFF'),signedEvent('TRACK_ORDER')]){
  const v=await run(e);
  for(const x of v.events){assert.equal(x.sendEnabled,false);assert.equal(x.allowedOrderWrites,false);
    assert.equal(x.requiresMetaPolicyReview,true);}
 }
});
