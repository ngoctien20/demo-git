'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const evaluator=require('./advanced-ai-presentation-evaluator.js');
const corpus=require('./advanced-ai-presentation-corpus.cjs');
const api=require('./studio-core.js');
const make=(intent,presentation={})=>JSON.stringify({contract:evaluator.INPUT_CONTRACT,intent,
 presentation:{emphasis:'NONE',component:'TEXT',media:'NONE',action:'NONE',...presentation}});
const run=(shop,channel,raw)=>evaluator.decide({shop,channel,raw});
test('96 synthetic oracle cases cover three shops x four channels x eight intents',()=>{
 assert.equal(corpus.POSITIVE.length,96);
 assert.equal(new Set(corpus.POSITIVE.map(x=>x.id)).size,96);
 for(const c of corpus.POSITIVE){
   const out=run(c.shop,c.channel,JSON.stringify(c.oracleProposal));
   assert.equal(out.shop,c.shop,c.id);
   assert.equal(out.channel,c.channel,c.id);
   assert.equal(out.modelProposal.intent,c.expectedIntent,c.id);
   assert.equal(out.tenantId,api.FIXTURES[c.shop].tenantId,c.id);
   assert.equal(out.storeId,api.FIXTURES[c.shop].storeId,c.id);
   assert.equal(out.providerSends,0,c.id);assert.equal(out.hostedWrites,0,c.id);
   assert.equal(out.realModelCalls,0,c.id);assert.equal(out.releaseAuthorized,false,c.id);
   assert.equal(out.decision.actionExecutable,false,c.id);
   assert.equal(out.decision.mediaUrl,null,c.id);
   assert.equal(out.decision.externalLink,null,c.id);
   assert.equal(out.preview.link,null,c.id);
   assert.equal(out.orderCreated,false,c.id);
   assert.equal(out.orderLookupAuthorized,false,c.id);
 }
});
test('all 12 adversarial injected top-level fields rejected',()=>{
 for(const c of corpus.ADVERSARIAL){
  const raw=JSON.stringify({...JSON.parse(make('QUOTE')),...c.patch});
  assert.throws(()=>evaluator.parseProposal(raw),new RegExp(c.reason),c.id);
 }
});
test('malformed JSON, fenced output, arrays, unknown intent and version fail closed',()=>{
 for(const raw of ['{invalid}','fenced-json:'+make('QUOTE'),'[]','null','true',
   make('HACK'),make('QUOTE').repeat(2000),
   JSON.stringify({contract:'OTHER',intent:'QUOTE',presentation:{emphasis:'PRICE',component:'TEXT',media:'NONE',action:'NONE'}}),
   JSON.stringify({contract:evaluator.INPUT_CONTRACT,intent:'QUOTE',presentation:{emphasis:'red',component:'TEXT',media:'NONE',action:'NONE'}})
 ])assert.throws(()=>evaluator.parseProposal(raw));
});
test('nested arbitrary payloads and model-controlled style rejected',()=>{
 const p=JSON.parse(make('QUOTE'));
 p.presentation.color='#ff0000';assert.throws(()=>evaluator.parseProposal(JSON.stringify(p)),/PRESENTATION_SCHEMA_DENIED/);
 p.presentation={emphasis:'PRICE',component:'TEXT',media:'NONE',action:{tool:'CREATE_ORDER'}};
 assert.throws(()=>evaluator.parseProposal(JSON.stringify(p)),/PRESENTATION_ENUM_DENIED/);
 assert.throws(()=>evaluator.parseProposal('{"contract":"T404_PRESENTATION_PROPOSAL_V1","intent":"QUOTE","presentation":{"emphasis":"PRICE","component":"TEXT","media":"NONE","action":"NONE","__proto__":{"x":1}}}'),/PRESENTATION_SCHEMA_DENIED/);
});
test('same SKU across shops never leaks another shop price or tenant',()=>{
 const a=run('A','WEB_WIDGET',make('QUOTE',{emphasis:'PRICE',component:'RICH_TEXT'}));
 const b=run('B','WEB_WIDGET',make('QUOTE',{emphasis:'PRICE',component:'RICH_TEXT'}));
 const c=run('C','WEB_WIDGET',make('QUOTE',{emphasis:'PRICE',component:'RICH_TEXT'}));
 assert.match(a.preview.text,/159\.000đ/);assert.doesNotMatch(a.preview.text,/209\.000đ|259\.000đ/);
 assert.match(b.preview.text,/209\.000đ/);assert.doesNotMatch(b.preview.text,/159\.000đ|259\.000đ/);
 assert.match(c.preview.text,/259\.000đ/);assert.doesNotMatch(c.preview.text,/159\.000đ|209\.000đ/);
 assert.notEqual(a.storeId,b.storeId);assert.notEqual(a.tenantId,c.tenantId);
});
test('trusted stock decides red warning rather than model request',()=>{
 const a=run('A','ZALO_BOT',make('LOW_STOCK',{component:'RICH_TEXT',emphasis:'WARNING'}));
 const b=run('B','ZALO_BOT',make('LOW_STOCK',{component:'RICH_TEXT',emphasis:'WARNING'}));
 assert.match(a.preview.text,/Sắp hết hàng/);
 assert(a.preview.text_styles.some(s=>s.st.includes('c_db342e')));
 assert.doesNotMatch(b.preview.text,/Sắp hết hàng/);
 assert.equal(b.decision.selectedEmphasis,'NONE');
 assert(!b.preview.text_styles.some(s=>s.st.includes('c_db342e')));
});
test('Messenger never receives arbitrary native color or italic markup',()=>{
 const r=run('A','MESSENGER',make('LOW_STOCK',{emphasis:'WARNING',component:'RICH_TEXT'}));
 assert.equal(r.decision.selectedComponent,'TEXT');assert.equal(r.preview.parse_mode,null);
 assert.deepEqual(r.preview.text_styles,[]);assert.deepEqual(r.preview.segments,[]);
});
test('Zalo Bot unsupported native carousel and buttons safely fallback',()=>{
 for(const component of ['PRODUCT_CARD','PRODUCT_CAROUSEL','QUICK_REPLIES']){
  const r=run('A','ZALO_BOT',make('DISCOVER',{component}));
  assert.equal(r.decision.selectedComponent,'TEXT');
  assert.equal(r.providerSends,0);
 }
});
test('Zalo OA paid ZBS template locked despite suggestion',()=>{
 const r=run('A','ZALO_OA',make('QUOTE',{component:'ZBS_TEMPLATE'}));
 assert.equal(r.decision.selectedComponent,'TEXT');
 assert.equal(r.decision.registryStatus,'FALLBACK');
 assert.equal(r.paidSpendVnd,0);assert.equal(r.providerSends,0);
});
test('product image cannot generate external asset URL',()=>{
 const r=run('A','WEB_WIDGET',make('DISCOVER',{component:'PRODUCT_CARD',media:'PRODUCT_IMAGE'}));
 assert.equal(r.decision.mediaUrl,null);
 assert(r.decision.fallbackReasons.includes('APPROVED_STORE_MEDIA_UNAVAILABLE'));
 assert.equal(r.preview.cards[0].imageUrl,null);
});
test('single-product fixture cannot fabricate product carousel',()=>{
 for(const channel of ['MESSENGER','WEB_WIDGET']){
  const c=channel==='MESSENGER'?'PRODUCT_CAROUSEL':'WIDGET_CAROUSEL';
  const r=run('C',channel,make('DISCOVER',{component:c}));
  assert.equal(r.decision.selectedComponent,'TEXT');
  assert(r.decision.fallbackReasons.includes('CAROUSEL_REQUIRES_MULTIPLE_VERIFIED_PRODUCTS'));
 }
});
test('order lookup requires verification and cannot expose PII',()=>{
 const r=run('A','WEB_WIDGET',make('ORDER_LOOKUP',{action:'TRACK_ORDER',emphasis:'WARNING'}));
 assert.equal(r.orderLookupAuthorized,false);
 assert.equal(r.decision.actionSuggestion,'NONE');
 assert(r.decision.fallbackReasons.includes('VERIFIED_CUSTOMER_IDENTITY_REQUIRED'));
 assert.match(r.preview.text,/Cần xác minh/);
 assert.doesNotMatch(r.preview.text,/\b(090[0-9]{7}|qa_shop_b)\b/);
});
test('actions are not executable from presentation model',()=>{
 const r=run('B','MESSENGER',make('QUOTE',{component:'QUICK_REPLIES',action:'ORDER_REQUEST'}));
 assert.equal(r.decision.actionSuggestion,'ORDER_REQUEST');
 assert.equal(r.decision.actionExecutable,false);
 assert(r.preview.buttons.every(b=>b.interactive===false&&b.requiresSignedServerAction===true));
});
test('unverified external links are blocked',()=>{
 const r=run('A','WEB_WIDGET',make('POLICY',{action:'OPEN_VERIFIED_LINK'}));
 assert.equal(r.decision.actionSuggestion,'NONE');
 assert.equal(r.preview.link,null);
 assert(r.decision.fallbackReasons.includes('ACTION_NOT_AUTHORIZED_BY_POLICY'));
});
test('customer prompt-injection strings are not forwarded to renderer',()=>{
 for(const c of corpus.STRESS_TEXT){
  const r=run('A','WEB_WIDGET',make(c.expectedIntent));
  assert(!JSON.stringify(r).includes(c.customerText),c.id);
  assert.equal(r.providerSends,0);
  assert.equal(r.hostedWrites,0);
 }
});
test('unknown Shop denied',()=>{
 assert.throws(()=>run('D','MESSENGER',make('QUOTE')),/UNKNOWN_SHOP_CHANNEL|UNKNOWN_STORE_OR_CHANNEL/);
});
test('synthetic oracle corpus never presented as real model benchmark',()=>{
 assert.equal(corpus.kind,'PUBLIC_SYNTHETIC_LABELED_NOT_REAL_MODEL_OUTPUT');
 assert(corpus.POSITIVE.every(c=>c.isActualModelOutput===false));
});

test('only the model-requested trusted preview action is shown',()=>{
 const r=run('A','MESSENGER',make('GREETING',{component:'QUICK_REPLIES',action:'CATALOG'}));
 assert.deepEqual(r.preview.buttons.map(x=>x.id),['CATALOG']);
 const n=run('A','MESSENGER',make('GREETING',{component:'QUICK_REPLIES',action:'NONE'}));
 assert.deepEqual(n.preview.buttons,[]);
 const z=run('A','ZALO_BOT',make('GREETING',{component:'TEXT',action:'NONE'}));
 assert.doesNotMatch(z.preview.text,/\n1\. /);
});
