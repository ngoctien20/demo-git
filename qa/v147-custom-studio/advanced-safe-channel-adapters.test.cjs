'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const adapters=require('./advanced-safe-channel-adapters.js');
const corpus=require('./advanced-ai-presentation-corpus.cjs');
const evaluator=require('./advanced-ai-presentation-evaluator.js');
const studio=require('./studio-core.js');

function proposal(intent,p={}){
 return JSON.stringify({contract:evaluator.INPUT_CONTRACT,intent,presentation:{
   emphasis:'NONE',component:'TEXT',media:'NONE',action:'NONE',...p
 }});
}
const preview=(shop,channel,intent,p)=>adapters.build({shop,channel,raw:proposal(intent,p)});
test('all 96 synthetic Shop x channel x intent cases are read-only, non-executable previews',()=>{
 assert.equal(corpus.POSITIVE.length,96);
 for(const c of corpus.POSITIVE){
  const r=adapters.build({raw:JSON.stringify(c.oracleProposal),shop:c.shop,channel:c.channel});
  assert.equal(r.contract,adapters.CONTRACT,c.id);
  assert.equal(r.tenantId,studio.FIXTURES[c.shop].tenantId,c.id);
  assert.equal(r.storeId,studio.FIXTURES[c.shop].storeId,c.id);
  assert.equal(r.channel,c.channel,c.id);
  assert.equal(r.delivery.authorized,false,c.id);
  assert.equal(r.delivery.canSend,false,c.id);
  assert.equal(r.delivery.providerPayload,null,c.id);
  assert.equal(r.delivery.recipient,null,c.id);
  assert.equal(r.delivery.credential,null,c.id);
  assert.equal(r.security.actionExecutable,false,c.id);
  assert.equal(r.security.ownerJwtVerified,false,c.id);
  assert.equal(r.providerSends,0,c.id);
  assert.equal(r.hostedWrites,0,c.id);
  assert.equal(r.realModelCalls,0,c.id);
  assert.doesNotMatch(JSON.stringify(r),/https:\/\/evil\.invalid/i,c.id);
  if(r.actionProposal){
   assert.equal(r.actionProposal.signedToken,null,c.id);
   assert.equal(r.actionProposal.interactive,false,c.id);
  }
 }
});
test('Messenger cards preserve verified shop price and omit unsigned postback',()=>{
 const r=preview('A','MESSENGER','DISCOVER',{component:'PRODUCT_CARD',action:'QUOTE',media:'PRODUCT_IMAGE'});
 assert.equal(r.adapterKind,'MESSENGER_GENERIC_TEMPLATE_PREVIEW');
 assert.equal(r.message.presentation.template_type,'generic');
 assert.equal(r.message.presentation.elements.length,1);
 assert.match(r.message.presentation.elements[0].subtitle,/159\.000đ/);
 assert.deepEqual(r.message.presentation.elements[0].buttons,[]);
 assert.equal(r.message.presentation.elements[0].image_url,null);
 assert.equal(r.message.signedPostbackPayload,null);
});
test('Messenger quick replies remain disabled hints without provider payload',()=>{
 const r=preview('B','MESSENGER','QUOTE',{component:'QUICK_REPLIES',emphasis:'PRICE',action:'ORDER_REQUEST'});
 assert.equal(r.adapterKind,'MESSENGER_QUICK_REPLY_HINTS');
 assert.equal(r.message.quickReplyHints.length,1);
 assert.equal(r.message.quickReplyHints[0].disabled,true);
 assert.equal(r.message.quickReplyHints[0].payload,null);
 assert.equal(r.actionProposal.actionKey,'ORDER_REQUEST');
});
test('Zalo Bot stock warning uses trusted fixture UTF-16 offsets only',()=>{
 const r=preview('C','ZALO_BOT','LOW_STOCK',{component:'RICH_TEXT',emphasis:'WARNING'});
 assert.equal(r.adapterKind,'ZALO_BOT_RICH_TEXT_PREVIEW');
 assert(r.message.text_styles.length);
 assert(r.message.text_styles.some(s=>s.st.includes('c_db342e')));
 for(const s of r.message.text_styles){
  assert(s.start+s.len<=r.message.text.length);
 }
 assert.equal(r.message.photo,null);
 assert.equal(r.message.nativeButtons,null);
 const noFalse=preview('B','ZALO_BOT','LOW_STOCK',{component:'RICH_TEXT',emphasis:'WARNING'});
 assert.equal(noFalse.message.text_styles.length,0);
 assert.doesNotMatch(noFalse.message.text,/Sắp hết hàng/);
});
test('Zalo Bot native carousel request downgrades to plain text',()=>{
 const r=preview('C','ZALO_BOT','DISCOVER',{component:'PRODUCT_CAROUSEL'});
 assert.equal(r.selectedComponent,'TEXT');
 assert.equal(r.message.previewKind,'ZALO_BOT_TEXT_PREVIEW');
});
test('OA ZBS costs and permission are NEVER activated',()=>{
 const r=preview('C','ZALO_OA','QUOTE',{component:'ZBS_TEMPLATE',action:'ORDER_REQUEST'});
 assert.equal(r.selectedComponent,'TEXT');
 assert.equal(r.message.zbsTemplate,null);
 assert.equal(r.message.oaCTA,null);
 assert.equal(r.message.billable,false);
 assert.equal(r.message.spendApproved,false);
});
test('Website widget uses text segments, verified catalog only and no external URL',()=>{
 const r=preview('A','WEB_WIDGET','QUOTE',{component:'RICH_TEXT',emphasis:'PRICE'});
 assert.equal(r.adapterKind,'WEB_WIDGET_SAFE_VIEW');
 assert(r.message.semanticSpans.some(s=>s.role==='PRICE'));
 assert.equal(r.message.requiresTextContent,true);
 assert.equal(r.message.htmlAllowed,false);
 assert.equal(r.message.externalUrl,null);
});
test('model cannot add arbitrary keys for recipient, price, CSS, image, or SQL',()=>{
 const base=JSON.parse(proposal('QUOTE'));
 for(const injected of [
  {recipient:{id:'psid_fake'}},{priceVnd:1},{imageUrl:'https://evil.invalid/x.png'},
  {style:'red'},{sql:'DROP TABLE orders'},{postback:'CREATE_ORDER'},
  {tenant_id:'qa_tenant_2'},{store_id:'qa_shop_b'}
 ]){
  assert.throws(()=>adapters.build({shop:'A',channel:'MESSENGER',
   raw:JSON.stringify({...base,...injected})}),/PROPOSAL_SCHEMA_DENIED/);
 }
});
test('different Shop/tenant catalog never cross-leaks in channel adapters',()=>{
 const a=preview('A','WEB_WIDGET','QUOTE',{component:'RICH_TEXT',emphasis:'PRICE'});
 const b=preview('B','WEB_WIDGET','QUOTE',{component:'RICH_TEXT',emphasis:'PRICE'});
 const c=preview('C','WEB_WIDGET','QUOTE',{component:'RICH_TEXT',emphasis:'PRICE'});
 assert.match(a.message.text,/159\.000đ/);assert.doesNotMatch(a.message.text,/209\.000đ|259\.000đ/);
 assert.match(b.message.text,/209\.000đ/);assert.doesNotMatch(b.message.text,/159\.000đ|259\.000đ/);
 assert.match(c.message.text,/259\.000đ/);assert.doesNotMatch(c.message.text,/159\.000đ|209\.000đ/);
 assert.notEqual(a.storeId,b.storeId);assert.notEqual(a.tenantId,c.tenantId);
});
test('private order lookups cannot become signed actions or leak data',()=>{
 const r=preview('A','WEB_WIDGET','ORDER_LOOKUP',{action:'TRACK_ORDER'});
 assert.equal(r.actionProposal,null);
 assert.equal(r.message.controls.length,0);
 assert.match(r.message.text,/Cần xác minh/);
 assert.equal(r.delivery.canSend,false);
});
test('send and execute functions intentionally cannot exist here',()=>{
 assert.throws(()=>adapters.send(),/PROVIDER_SEND_DISABLED/);
 assert.throws(()=>adapters.executeAction(),/SIGNED_BACKEND_ACTION_REQUIRED/);
});
test('unsupported channel fails closed before provider output',()=>{
 assert.throws(()=>adapters.build({shop:'A',channel:'TELEGRAM',raw:proposal('QUOTE')}),/INVALID_CHANNEL_OR_PROPOSAL/);
});
