'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const registry=require('./advanced-channel-registry.js');
const crosswalk=require('./advanced-studio-capability-crosswalk.js');
const evalr=require('./advanced-ai-presentation-evaluator.js');
const studioApi=require('./studio-core.js');
const policy=require('./advanced-presentation-policy.js');
const mk=(intent,component='TEXT',action='NONE',emphasis='NONE')=>JSON.stringify({
 contract:evalr.INPUT_CONTRACT,intent,presentation:{emphasis,component,media:'NONE',action}});
const d=(shop,channel,raw,studio=studioApi.createStudio())=>evalr.decide({shop,channel,raw,studio});
test('01 canonical ADV.2 identity retained, no duplicated live registry',()=>{
 assert.equal(crosswalk.CANONICAL_VERSION,registry.VERSION);
 assert.equal(crosswalk.CHANNELS.length,4);
 assert.equal(crosswalk.FEATURES.length,13);
});
test('02 four channels have exactly 13 presentational controls',()=>{
 for(const channel of crosswalk.CHANNELS){
  const rows=crosswalk.list({channel,tenant_id:'qa_tenant_1',store_id:'qa_shop_a'});
  assert.equal(rows.length,13);
  assert.equal(new Set(rows.map(x=>x.component)).size,13);
 }
});
test('03 52 crosswalk cells never authorize provider/send/write/spend',()=>{
 for(const channel of crosswalk.CHANNELS){
  for(const r of crosswalk.list({channel,tenant_id:'qa_tenant_1',store_id:'qa_shop_a'})){
   assert.equal(r.canSend,false);
   assert.equal(r.actionExecutable,false);
   assert.equal(r.entitlementVerified,false);
   assert.equal(r.paidTemplateAuthorized,false);
   assert.equal(r.signedBusinessActionAuthorized,false);
   assert.equal(r.hasVerifiedMedia,false);
   assert.equal(r.fallback,'TEXT');
  }
 }
});
test('04 ambiguous verified links never acquire allowlist from webview analogy',()=>{
 for(const channel of crosswalk.CHANNELS){
  const r=crosswalk.row({channel,component:'VERIFIED_LINK',tenant_id:'qa_tenant_1',store_id:'qa_shop_a'});
  assert.equal(r.canonicalComponent,null);
  assert.equal(r.previewEligible,false);
  assert.equal(r.reason,'MISSING_EXACT_CANONICAL_COMPONENT');
 }
});
test('05 Zalo OA ZBS expense gate never becomes preview permission',()=>{
 const r=crosswalk.row({channel:'ZALO_OA',component:'ZBS_TEMPLATE',tenant_id:'qa_tenant_1',store_id:'qa_shop_a'});
 assert.equal(r.sourceState,'APPROVAL_SPEND');assert.equal(r.previewEligible,false);
 assert.equal(r.reason,'PAID_TEMPLATE_APPROVAL_LOCKED');
});
test('06 Zalo Bot rich text is preview only, never a native send grant',()=>{
 const r=crosswalk.row({channel:'ZALO_BOT',component:'RICH_TEXT',tenant_id:'qa_tenant_1',store_id:'qa_shop_a'});
 assert.equal(r.canonicalComponent,'RICH_TEXT');
 assert.equal(r.previewEligible,true);
 assert.equal(r.canSend,false);
});
test('07 Messenger rich text native fallback is conservative',()=>{
 const r=crosswalk.row({channel:'MESSENGER',component:'RICH_TEXT',tenant_id:'qa_tenant_1',store_id:'qa_shop_a'});
 assert.equal(r.sourceState,'UNSUPPORTED');assert.equal(r.previewEligible,false);
});
test('08 Widget product card source-only preview allowed without hosting',()=>{
 const r=crosswalk.row({channel:'WEB_WIDGET',component:'PRODUCT_CARD',tenant_id:'qa_tenant_1',store_id:'qa_shop_a'});
 assert.equal(r.sourceState,'LOCAL_PREVIEW');assert.equal(r.previewEligible,true);
});
test('09 missing Store scope disallows previews even with source capability',()=>{
 const r=crosswalk.row({channel:'WEB_WIDGET',component:'TEXT',tenant_id:'',store_id:''});
 assert.equal(r.previewEligible,false);
 assert.equal(r.reason,'STORE_SCOPE_MISSING');
});
test('10 unknown channel and component must fail closed',()=>{
 assert.throws(()=>crosswalk.row({channel:'WHATSAPP',component:'TEXT'}),/ADV4_UNKNOWN_CHANNEL/);
 assert.throws(()=>crosswalk.row({channel:'MESSENGER',component:'CREATE_ORDER'}),/ADV4_UNKNOWN_FEATURE/);
});
test('11 canonical carousel mappings stay channel-scoped',()=>{
 const a=crosswalk.row({channel:'MESSENGER',component:'CAROUSEL',tenant_id:'qa_tenant_1',store_id:'qa_shop_a'});
 const w=crosswalk.row({channel:'WEB_WIDGET',component:'CAROUSEL',tenant_id:'qa_tenant_1',store_id:'qa_shop_a'});
 assert.equal(a.canonicalComponent,'PRODUCT_CAROUSEL');assert.equal(w.canonicalComponent,'WIDGET_CAROUSEL');
});
test('12 unsupported native Zalo Bot quick reply remains text fallback',()=>{
 const r=crosswalk.row({channel:'ZALO_BOT',component:'QUICK_REPLY',tenant_id:'qa_tenant_1',store_id:'qa_shop_a'});
 assert.equal(r.previewEligible,false);assert.equal(r.canonicalComponent,null);
});
test('13 real AI output still constrained to ADV3 exact JSON contract',()=>{
 assert.throws(()=>evalr.parseProposal(JSON.stringify({
  contract:evalr.INPUT_CONTRACT,intent:'QUOTE',presentation:{emphasis:'PRICE',component:'RICH_TEXT',media:'NONE',action:'ORDER_REQUEST'},
  grant_owner:true
 })),/PROPOSAL_SCHEMA_DENIED/);
});
test('14 quote is always sourced from correct synthetic Store, despite same SKU',()=>{
 const a=d('A','WEB_WIDGET',mk('QUOTE','RICH_TEXT','ORDER_REQUEST','PRICE'));
 const b=d('B','WEB_WIDGET',mk('QUOTE','RICH_TEXT','ORDER_REQUEST','PRICE'));
 const c=d('C','WEB_WIDGET',mk('QUOTE','RICH_TEXT','ORDER_REQUEST','PRICE'));
 assert.match(a.preview.text,/159\.000đ/);assert.match(b.preview.text,/209\.000đ/);
 assert.match(c.preview.text,/259\.000đ/);assert.notEqual(a.storeId,b.storeId);
});
test('15 browser-friendly UMD wrappers preserve same Node module symbols',()=>{
 assert.equal(registry.resolve instanceof Function,true);
 assert.equal(evalr.decide instanceof Function,true);
 assert.equal(evalr.parseProposal instanceof Function,true);
 assert.equal(policy.compile instanceof Function,true);
});
test('16 per Shop and Channel profile updates stay isolated',()=>{
 const studio=studioApi.createStudio();
 studio.update('A','MESSENGER',{assistantName:'Bot riêng QA'},'INTERNAL_STAFF_QA');
 assert.equal(studio.get('A','MESSENGER').assistantName,'Bot riêng QA');
 assert.notEqual(studio.get('B','MESSENGER').assistantName,'Bot riêng QA');
 assert.notEqual(studio.get('A','ZALO_BOT').assistantName,'Bot riêng QA');
});
test('17 updater cannot change global policy or untrusted tenant scope',()=>{
 const studio=studioApi.createStudio();
 for(const patch of [{tenant_id:'qa_tenant_2'},{store_id:'qa_shop_b'},
  {policy_version:'UNSAFE'},{canPublish:true},{token:'secret'}]){
  assert.throws(()=>studio.update('A','MESSENGER',patch),/GLOBAL_POLICY_OR_SCOPE_LOCKED/);
 }
});
test('18 order and cross-channel lookup never executable from evaluator',()=>{
 for(const ch of evalr.COMPONENT){
  const r=d('A','MESSENGER',mk('ORDER_LOOKUP',ch,'TRACK_ORDER'));
  assert.equal(r.orderLookupAuthorized,false);
  assert.equal(r.orderCreated,false);
  assert.equal(r.decision.actionExecutable,false);
  assert.equal(r.providerSends,0);
 }
});
test('19 synthetic low-stock depends on Store, not prompt injected color',()=>{
 const a=d('A','ZALO_BOT',mk('LOW_STOCK','RICH_TEXT','NONE','WARNING'));
 const b=d('B','ZALO_BOT',mk('LOW_STOCK','RICH_TEXT','NONE','WARNING'));
 assert.match(a.preview.text,/Sắp hết hàng/);
 assert.doesNotMatch(b.preview.text,/Sắp hết hàng/);
 assert.equal(b.decision.selectedEmphasis,'NONE');
});
test('20 browser HTML must remain network disconnected, no credentials',()=>{
 const html=fs.readFileSync(__dirname+'/advanced-custom-studio.html','utf8');
 for(const marker of ["connect-src 'none'","img-src 'none'","frame-src 'none'","form-action 'none'",
  "advanced-ai-presentation-evaluator.js","advanced-studio-capability-crosswalk.js",
  "advanced-custom-studio.js"])assert(html.includes(marker),marker);
 assert(!html.includes('service_role'));
 assert(!html.includes('SECRET_KEY'));
});
test('21 offline Studio controller never executes action or provider callback',()=>{
 const source=fs.readFileSync(__dirname+'/advanced-custom-studio.js','utf8');
 for(const bad of [/\bfetch\s*\(/,/\bXMLHttpRequest\b/,/\bWebSocket\b/,/\bEventSource\b/,
  /\blocalStorage\b/,/\bsessionStorage\b/,/\binnerHTML\b/,/\bindexedDB\b/,
  /\beval\s*\(/,/\bnew Function\s*\(/,/\bsendMessage\s*\(/,/https?:\/\/(?:api\.|graph\.)/]){
  assert(!bad.test(source),String(bad));
 }
 assert.match(source,/T404PresentationEvaluator/);
 assert.match(source,/T404Adv4Capabilities/);
 assert.match(source,/disabled=true/);
});
test('22 source of truth only one ADV.3 decision engine, no copied pricing engine',()=>{
 const source=fs.readFileSync(__dirname+'/advanced-custom-studio.js','utf8');
 assert(!source.includes('priceVnd:159000'));
 assert(!source.includes('priceVnd:209000'));
 assert(!source.includes('priceVnd:259000'));
 assert.match(source,/evaluator\.decide/);
});
test('23 never clone a real signing key into browser payload',()=>{
 const source=fs.readFileSync(__dirname+'/advanced-custom-studio.js','utf8');
 assert(!source.includes('privateKey'));
 assert(!source.includes('createPrivateKey'));
 assert(!source.includes('crypto.sign'));
 assert.match(source,/NOT_ISSUED_BROWSER/);
});
test('24 full 3x4x8 synthetic scenarios remain fail-closed after the UMD migration',()=>{
 for(const shop of ['A','B','C'])for(const channel of evalr.ACTION.slice(0,4).map((_,i)=>crosswalk.CHANNELS[i]))
 for(const intent of policy.INTENTS){
  const r=d(shop,channel,mk(intent));
  assert.equal(r.releaseAuthorized,false);
  assert.equal(r.providerSends,0);
  assert.equal(r.hostedWrites,0);
  assert.equal(r.realModelCalls,0);
 }
});
