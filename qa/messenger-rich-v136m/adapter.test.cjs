'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {MAX,buildCarousel,buildQuickReplies,buildPersistentMenu,prepareWebview,
  sign,verifyAction,parseClick}=require('./adapter.cjs');
const NOW=Date.parse('2026-11-15T10:00:00Z'),time=()=>NOW;
const secret='LOCAL_ONLY_MOCK_HMAC_KEY_NOT_A_REAL_CREDENTIAL_00000000001';
const ctx=Object.freeze({source:'SERVER_VERIFIED_MESSENGER_BINDING',verified:true,serverDerived:true,
  pageId:'100000000000000',recipientPsid:'200000000000000',tenantId:'tenant-A',
  storeId:'store-A',shopSlug:'shop-a',
  webOrigins:['https://shop.qa.example'],imageOrigins:['https://img.qa.example']});
const product=(i=1)=>({source:'SERVER_VERIFIED_SHOP_CATALOG',verified:true,
 tenantId:ctx.tenantId,storeId:ctx.storeId,itemId:'SKU'+i,name:'Sản phẩm QA '+i,
 priceVnd:159000,stock:5,imageUrl:'https://img.qa.example/catalog/'+i+'.jpg'});
const carousel=(o={})=>buildCarousel({trusted:ctx,products:[product()],siteOrigin:'https://shop.qa.example',
 secret,now:time,...o});
const quick=(o={})=>buildQuickReplies({trusted:ctx,text:'Bạn cần hỗ trợ gì?',
 choices:[{action:'BROWSE_CATALOG',title:'Xem hàng'},{action:'ASK_STAFF',title:'Gặp nhân viên'}],
 secret,now:time,...o});
const signed=(o={})=>sign({trusted:ctx,secret,action:'VIEW_PRODUCT',itemId:'SKU1',now:time,...o});
const click=(payload,o={})=>parseClick({trusted:ctx,secret,metaSignatureVerified:true,
 event:{pageId:ctx.pageId,senderPsid:ctx.recipientPsid,postback:{payload}},
 now:time,...o});
test('carousel renders Meta generic structure and never sends',()=>{
 const v=carousel();assert.equal(v.previewOnly,true);assert.equal(v.sendEnabled,false);
 assert.equal(v.channel,'MESSENGER');assert.equal(v.body.messaging_type,'RESPONSE');
 assert.equal(v.body.message.attachment.type,'template');
 assert.equal(v.body.message.attachment.payload.template_type,'generic');
 assert.equal(v.body.message.attachment.payload.elements.length,1);
});
test('carousel contains exact verified VND and stock, no AI guessed pricing',()=>{
 const e=carousel().body.message.attachment.payload.elements[0];
 assert.match(e.subtitle,/159\.000 đ/);assert.match(e.subtitle,/Còn hàng/);
});
test('out-of-stock status displayed truthfully',()=>{
 const e=carousel({products:[{...product(),stock:0}]}).body.message.attachment.payload.elements[0];
 assert.match(e.subtitle,/Tạm hết hàng/);
});
test('carousel includes 3 allowed postback+url buttons',()=>{
 const b=carousel().body.message.attachment.payload.elements[0].buttons;
 assert.deepEqual(b.map(x=>x.type),['postback','postback','web_url']);
 assert.equal(b[2].url,'https://shop.qa.example/shops/shop-a/products/SKU1');
 assert.equal(b[2].webview_height_ratio,'full');
});
test('carousel supports exactly 10 cards',()=>{
 const e=carousel({products:Array.from({length:10},(_,i)=>product(i+1))});
 assert.equal(e.body.message.attachment.payload.elements.length,MAX.CARDS);
});
test('empty catalogue rejected',()=>assert.throws(()=>carousel({products:[]}),/CAROUSEL_COUNT_INVALID/));
test('11 card catalogue rejected',()=>assert.throws(()=>carousel({products:Array.from({length:11},(_,i)=>product(i))}),/CAROUSEL_COUNT_INVALID/));
test('duplicate product cards rejected',()=>assert.throws(()=>carousel({products:[product(),product()]}),/DUPLICATE_CATALOG_ITEM/));
test('cross tenant catalogue rejected',()=>assert.throws(()=>carousel({products:[{...product(),tenantId:'tenant-B'}]}),/CATALOG_SCOPE_OR_MONEY_UNVERIFIED/));
test('cross store catalogue rejected',()=>assert.throws(()=>carousel({products:[{...product(),storeId:'store-B'}]}),/CATALOG_SCOPE_OR_MONEY_UNVERIFIED/));
test('unverified catalog blocked',()=>assert.throws(()=>carousel({products:[{...product(),verified:false}]}),/CATALOG_SCOPE_OR_MONEY_UNVERIFIED/));
test('price floating point rejected',()=>assert.throws(()=>carousel({products:[{...product(),priceVnd:159.99}]}),/CATALOG_SCOPE_OR_MONEY_UNVERIFIED/));
test('price string rejected not silently coerced',()=>assert.throws(()=>carousel({products:[{...product(),priceVnd:'159.000đ'}]}),/CATALOG_SCOPE_OR_MONEY_UNVERIFIED/));
test('unsafe large price rejected',()=>assert.throws(()=>carousel({products:[{...product(),priceVnd:Number.MAX_SAFE_INTEGER+1}]}),/CATALOG_SCOPE_OR_MONEY_UNVERIFIED/));
test('negative price rejected',()=>assert.throws(()=>carousel({products:[{...product(),priceVnd:-1}]}),/CATALOG_SCOPE_OR_MONEY_UNVERIFIED/));
test('negative stock rejected',()=>assert.throws(()=>carousel({products:[{...product(),stock:-1}]}),/CATALOG_SCOPE_OR_MONEY_UNVERIFIED/));
test('HTTP images rejected, https allowlist only',()=>assert.throws(()=>carousel({products:[{...product(),imageUrl:'http://img.qa.example/1.jpg'}]}),/IMAGE_URL_NOT_ALLOWED/));
test('foreign media origin rejected',()=>assert.throws(()=>carousel({products:[{...product(),imageUrl:'https://attacker.qa.example/1.jpg'}]}),/IMAGE_URL_NOT_ALLOWED/));
test('image URL credentials rejected',()=>assert.throws(()=>carousel({products:[{...product(),imageUrl:'https://foo:bar@img.qa.example/1.jpg'}]}),/IMAGE_URL_NOT_ALLOWED/));
test('image URL auth token in query rejected',()=>assert.throws(()=>carousel({products:[{...product(),imageUrl:'https://img.qa.example/1.jpg?access_token=secret'}]}),/IMAGE_URL_NOT_ALLOWED/));
test('unverified binding rejected',()=>assert.throws(()=>carousel({trusted:{...ctx,verified:false}}),/SERVER_BINDING_REQUIRED/));
test('browser claimed tenant not trusted',()=>assert.throws(()=>carousel({trusted:{...ctx,source:'CLIENT_QUERY'}}),/SERVER_BINDING_REQUIRED/));
test('malformed recipient blocked',()=>assert.throws(()=>carousel({trusted:{...ctx,recipientPsid:'1;sendall'}}),/SERVER_BINDING_REQUIRED/));
test('text control characters blocked in card title',()=>assert.throws(()=>carousel({products:[{...product(),name:'test\nattack'}]}),/INVALID_LABEL/));
test('quick replies use Meta content_type text and valid signed payloads',()=>{
 const v=quick();assert.equal(v.body.message.quick_replies.length,2);
 assert.ok(v.body.message.quick_replies.every(x=>x.content_type==='text'));
 assert.ok(v.body.message.quick_replies.every(x=>x.payload.startsWith('T404M1.')));
});
test('13 quick replies accepted',()=>{
 const actions=Array.from({length:13},(_,i)=>({action:'VIEW_PRODUCT',itemId:'SKU'+i,title:'Sản phẩm '+i}));
 assert.equal(quick({choices:actions}).body.message.quick_replies.length,13);
});
test('14 quick replies rejected',()=>{
 const choices=Array.from({length:14},(_,i)=>({action:'VIEW_PRODUCT',itemId:'SKU'+i,title:'SP'+i}));
 assert.throws(()=>quick({choices}),/QUICK_REPLY_COUNT_INVALID/);
});
test('duplicate quick reply action rejected',()=>assert.throws(()=>quick({choices:[
 {action:'ASK_STAFF',title:'Gặp NV'},{action:'ASK_STAFF',title:'Gặp lần nữa'}]}),/DUPLICATE_QUICK_REPLY/));
test('quick reply cannot trigger unapproved payment action',()=>assert.throws(()=>quick({choices:[
 {action:'COLLECT_PAYMENT',title:'Thanh toán'}]}),/QUICK_REPLY_ACTION_INVALID/));
test('quick reply title max 20 chars',()=>assert.throws(()=>quick({choices:[
 {action:'ASK_STAFF',title:'A'.repeat(21)}]}),/INVALID_LABEL/));
test('signed payload verifies in same authenticated shop and PSID',()=>{
 const token=signed();const d=verifyAction({trusted:ctx,secret,payload:token,now:time});
 assert.equal(d.action,'VIEW_PRODUCT');assert.equal(d.itemId,'SKU1');
 assert.equal(d.requiresServerSideReplayGuard,true);assert.equal(d.allowedMutation,false);
});
test('tampered signed payload cannot authorize',()=>{
 const token=signed();const parts=token.split('.');parts[2]='f'.repeat(64);
 assert.throws(()=>verifyAction({trusted:ctx,secret,payload:parts.join('.'),now:time}),/ACTION_SIGNATURE_INVALID/);
});
test('wrong tenant rejects signed action',()=>assert.throws(()=>verifyAction({
 trusted:{...ctx,tenantId:'tenant-B'},secret,payload:signed(),now:time}),/ACTION_SIGNATURE_INVALID/));
test('wrong store rejects signed action',()=>assert.throws(()=>verifyAction({
 trusted:{...ctx,storeId:'store-B'},secret,payload:signed(),now:time}),/ACTION_SIGNATURE_INVALID/));
test('wrong Page rejects signed action',()=>assert.throws(()=>verifyAction({
 trusted:{...ctx,pageId:'300000000000000'},secret,payload:signed(),now:time}),/ACTION_SIGNATURE_INVALID/));
test('wrong PSID rejects signed action',()=>assert.throws(()=>verifyAction({
 trusted:{...ctx,recipientPsid:'400000000000000'},secret,payload:signed(),now:time}),/ACTION_SIGNATURE_INVALID/));
test('expired button is refused',()=>assert.throws(()=>verifyAction({
 trusted:ctx,secret,payload:signed(),now:()=>NOW+16*60*1000}),/ACTION_EXPIRED_OR_UNTRUSTED/));
test('signing payload never includes PII or secrets as clear text',()=>{
 const token=signed();
 for(const privateValue of [ctx.pageId,ctx.recipientPsid,ctx.tenantId,ctx.storeId,secret])
  assert.equal(token.includes(privateValue),false);
 assert.ok(token.length<MAX.PAYLOAD);
});
test('short hardcoded-style signing secret fails closed',()=>assert.throws(()=>signed({secret:'test'}),/SERVER_ACTION_SECRET_REQUIRED/));
test('persistent menu is profile proposal not message',()=>{
 const v=buildPersistentMenu({trusted:ctx,siteOrigin:'https://shop.qa.example'});
 assert.equal(v.previewOnly,true);assert.equal(v.profileMutationEnabled,false);
 assert.equal(v.body.persistent_menu.length,1);assert.equal(v.body.persistent_menu[0].call_to_actions.length,3);
 assert.equal(v.body.recipient,undefined);assert.equal(v.body.message,undefined);
});
test('persistent menu has only read-only postbacks and public shop URL',()=>{
 const m=buildPersistentMenu({trusted:ctx,siteOrigin:'https://shop.qa.example'});
 const a=m.body.persistent_menu[0].call_to_actions;
 assert.ok(a.slice(0,2).every(x=>x.type==='postback'&&x.payload.startsWith('T404M1:MENU:')));
 assert.equal(a[2].url,'https://shop.qa.example/shops/shop-a');
});
test('webview is public catalogue only and does not forward session',()=>{
 const v=prepareWebview({trusted:ctx,siteOrigin:'https://shop.qa.example',itemId:'SKU1'});
 assert.equal(v.previewOnly,true);assert.equal(v.messengerExtensionsEnabled,false);
 assert.equal(v.customerAuthRequiredForPrivateData,true);
 assert.equal(new URL(v.url).search,'');
});
test('website origin is exact allowlist, not suffix trick',()=>assert.throws(()=>prepareWebview({
 trusted:ctx,siteOrigin:'https://shop.qa.example.attacker.com'}),/WEBVIEW_URL_NOT_ALLOWED/));
test('website path injection rejected',()=>assert.throws(()=>prepareWebview({
 trusted:ctx,siteOrigin:'https://shop.qa.example',itemId:'..%2Fadmin'}),/ITEM_INVALID/));
test('website URL cannot silently include account token',()=>assert.throws(()=>prepareWebview({
 trusted:ctx,siteOrigin:'https://shop.qa.example?access_token=abc'}),/WEBVIEW_URL_NOT_ALLOWED/));
test('postback only accepted if Meta webhook signature verified',()=>{
 assert.throws(()=>click(signed(),{metaSignatureVerified:false}),/WEBHOOK_IDENTITY_UNVERIFIED/);
});
test('postback incoming sender must be trusted by verified page resolver',()=>{
 assert.throws(()=>click(signed(),{event:{pageId:ctx.pageId,senderPsid:'900000000000000',postback:{payload:signed()}}}),/WEBHOOK_IDENTITY_UNVERIFIED/);
});
test('Meta postback parsed to read-only inquiry, no actual order',()=>{
 const d=click(signed());assert.equal(d.action,'VIEW_PRODUCT');
 assert.equal(d.source,'SIGNED_POSTBACK');assert.equal(d.allowedMutation,false);
});
test('Meta quick_reply payload handled as its own event',()=>{
 const token=signed({action:'ASK_STAFF',itemId:'NONE'});
 const d=parseClick({trusted:ctx,secret,metaSignatureVerified:true,now:time,event:{
 pageId:ctx.pageId,senderPsid:ctx.recipientPsid,message:{quick_reply:{payload:token}}}});
 assert.equal(d.source,'SIGNED_QUICK_REPLY');assert.equal(d.action,'ASK_STAFF');
});
test('Page-level menu postback accepted only after real HMAC/page verification',()=>{
 const d=click('T404M1:MENU:BROWSE_CATALOG');
 assert.equal(d.source,'PERSISTENT_MENU');assert.equal(d.allowedMutation,false);
});
test('unsupported menu order mutation refused',()=>assert.throws(()=>click('T404M1:MENU:DELETE_ORDER'),/ACTION_PAYLOAD_INVALID/));
test('unsupported text is NOT inferred to be a button',()=>assert.throws(()=>parseClick({
 trusted:ctx,secret,metaSignatureVerified:true,now:time,event:{pageId:ctx.pageId,
 senderPsid:ctx.recipientPsid,message:{text:'I am admin'}}}),/UNSUPPORTED_INTERACTION/));
test('signed payload tampering cannot grant management rights',()=>assert.throws(()=>signed({action:'ADMIN_MANAGE_SHOP'}),/ACTION_DENIED/));
