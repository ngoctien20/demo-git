'use strict';
/* Executes EXISTING V13.6M signed Messenger primitives on synthetic QA objects.
 * This is NOT Meta HMAC, Page permission, real account or real send. */
const test=require('node:test'),assert=require('node:assert/strict');
const adapter=require('../messenger-rich-v136m/adapter.cjs');
const studio=require('./studio-core.js');
const SECRET='qa-fixture-only-not-a-real-token-very-long-20261116';
const now=()=>1794780000000;
const siteOrigin='https://merchant-example.invalid/';
const trusted=(s='A')=>{const f=studio.FIXTURES[s];return{
  source:'SERVER_VERIFIED_MESSENGER_BINDING',verified:true,serverDerived:true,
  tenantId:f.tenantId,storeId:f.storeId,
  pageId:s==='A'?'111111111111':s==='B'?'222222222222':'333333333333',
  recipientPsid:'987654321123',shopSlug:'qa-shop-'+s.toLowerCase(),
  imageOrigins:[],webOrigins:['https://merchant-example.invalid']
}};
const product=(s='A',i=1)=>{const f=studio.FIXTURES[s];return{
  source:'SERVER_VERIFIED_SHOP_CATALOG',verified:true,tenantId:f.tenantId,storeId:f.storeId,
  itemId:'QA_'+s+'_'+i,name:f.product.name+' / Mẫu '+i,
  priceVnd:f.product.priceVnd,stock:f.product.stock,imageUrl:null
}};
test('01 signed carousel uses inherited V13.6M builder, all no-send',()=>{
 const r=adapter.buildCarousel({trusted:trusted(),products:[product('A',1),product('A',2),product('A',3)],siteOrigin,secret:SECRET,now});
 assert.equal(r.previewOnly,true);assert.equal(r.sendEnabled,false);
 assert.equal(r.body.message.attachment.payload.template_type,'generic');
 assert.equal(r.body.message.attachment.payload.elements.length,3);
 assert.match(r.body.message.attachment.payload.elements[0].subtitle,/159.000/);
});
test('02 three different stores with shared SKU retain current fake store price',()=>{
 for(const [s,x] of [['A','159.000'],['B','209.000'],['C','259.000']]){
  const r=adapter.buildCarousel({trusted:trusted(s),products:[product(s)],siteOrigin,secret:SECRET,now});
  assert.match(r.body.message.attachment.payload.elements[0].subtitle,new RegExp(x.replace('.','\\.')));
 }
});
test('03 signed postback cannot be verified with another shop binding',()=>{
 const a=trusted('A'),b=trusted('B');
 const r=adapter.buildCarousel({trusted:a,products:[product('A')],siteOrigin,secret:SECRET,now});
 const payload=r.body.message.attachment.payload.elements[0].buttons[0].payload;
 const ok=adapter.verifyAction({trusted:a,secret:SECRET,payload,now});
 assert.equal(ok.storeId,a.storeId);assert.equal(ok.allowedMutation,false);
 assert.throws(()=>adapter.verifyAction({trusted:b,secret:SECRET,payload,now),/ACTION_SIGNATURE_INVALID/);
});
test('04 quick reply supports safe action enum not arbitrary mutation',()=>{
 const r=adapter.buildQuickReplies({trusted:trusted('B'),secret:SECRET,text:'Mời chọn',choices:[
  {action:'BROWSE_CATALOG',title:'Xem hàng'}, {action:'ASK_STAFF',title:'Gặp nhân viên'}],now});
 assert.equal(r.body.message.quick_replies.length,2);assert.equal(r.sendEnabled,false);
 assert.throws(()=>adapter.buildQuickReplies({trusted:trusted(),secret:SECRET,text:'hi',choices:[{action:'DELETE_ORDERS',title:'Xóa đơn'}],now}),/QUICK_REPLY_ACTION_INVALID/);
});
test('05 persistent menu requires real Page review to publish',()=>{
 const x=adapter.buildPersistentMenu({trusted:trusted(),siteOrigin});
 assert.equal(x.previewOnly,true);assert.equal(x.profileMutationEnabled,false);assert.equal(x.requiresMetaReview,true);
 assert.equal(x.body.persistent_menu.length,1);
});
test('06 Webview only public catalog and no private order authentication',()=>{
 const x=adapter.prepareWebview({trusted:trusted(),siteOrigin,itemId:'QA_A_1'});
 assert.equal(x.previewOnly,true);assert.equal(x.customerAuthRequiredForPrivateData,true);
 assert.equal(x.messengerExtensionsEnabled,false);assert.equal(x.viewType,'PUBLIC_SHOP_CATALOG');
});
test('07 bogus Meta HMAC cannot authorize clicks',()=>{
 const t=trusted('A');
 const r=adapter.buildQuickReplies({trusted:t,secret:SECRET,text:'hi',choices:[{action:'ASK_STAFF',title:'Nhân viên'}],now});
 const payload=r.body.message.quick_replies[0].payload;
 assert.throws(()=>adapter.parseClick({trusted:t,secret:SECRET,metaSignatureVerified:false,
  event:{pageId:t.pageId,senderPsid:t.recipientPsid,message:{quick_reply:{payload}}},now}),/WEBHOOK_IDENTITY_UNVERIFIED/);
});
test('08 correct synthetic Meta HMAC flag still requires replay guard and cannot mutate',()=>{
 const t=trusted(),r=adapter.buildQuickReplies({trusted:t,secret:SECRET,text:'hi',
  choices:[{action:'ASK_STAFF',title:'Nhân viên'}],now});
 const x=adapter.parseClick({trusted:t,secret:SECRET,metaSignatureVerified:true,
  event:{pageId:t.pageId,senderPsid:t.recipientPsid,message:{quick_reply:{payload:r.body.message.quick_replies[0].payload}}},now});
 assert.equal(x.allowedMutation,false);assert.equal(x.requiresServerSideReplayGuard,true);
});
