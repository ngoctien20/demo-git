'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const studioApi=require('./studio-core.js');
const registry=require('./advanced-channel-registry.js');
const policy=require('./advanced-presentation-policy.js');
const intelligence=require('./advanced-ai-intelligence.js');
const advanced=require('./advanced-studio-integration.js');
const adapter=require('./advanced-adapter-contracts.js');
const model=i=>({schema_version:intelligence.SCHEMA_VERSION,intent:i});
const env=()=>{
 const base=studioApi.createStudio();
 const studio=advanced.createStudioIntegration({studioApi,registry,policy,intelligence,
   baseReader:(s,c)=>base.get(s,c)});
 return {base,studio};
};
test('01 all four adapter concept modes available',()=>{
 const {studio}=env();const modes=new Set();
 for(const ch of registry.CHANNELS)modes.add(adapter.build({studio,shop:'A',channel:ch,modelOutput:model('QUOTE')}).mode);
 assert.equal(modes.size,4);
});
test('02 no adapter can send',()=>assert.throws(()=>adapter.send(),/ADV4_ADAPTER_SEND_DISABLED/));
test('03 no adapter may execute an action',()=>assert.throws(()=>adapter.invoke(),/ADV4_ADAPTER_ACTION_DISABLED/));
test('04 3×4×8 outputs always No-Send No-Write',()=>{
 const {studio}=env();
 for(const s of ['A','B','C'])for(const ch of registry.CHANNELS)for(const intent of policy.INTENTS){
  const x=adapter.build({studio,shop:s,channel:ch,modelOutput:model(intent)});
  assert.equal(x.nativeProviderPayload,null);
  assert.equal(x.canSend,false);assert.equal(x.canExecute,false);assert.equal(x.canPublish,false);
  assert.equal(x.readCustomerOrders,false);assert.equal(x.writeOrders,false);
  assert.equal(x.noSendEvidence.providerSends,0);
  assert.equal(x.noSendEvidence.hostedWrites,0);
  assert.equal(x.noSendEvidence.realAiCalls,0);
  assert.equal(x.action.active,false);assert.equal(x.action.nonceReceiptIssued,false);
  assert.equal(x.action.requiresSignedBackend,true);
 }
});
test('05 Shop A/B same Tenant distinct Store and price',()=>{
 const {studio}=env();
 const a=adapter.build({studio,shop:'A',channel:'MESSENGER',modelOutput:model('QUOTE')});
 const b=adapter.build({studio,shop:'B',channel:'MESSENGER',modelOutput:model('QUOTE')});
 assert.equal(a.tenantId,b.tenantId);assert.notEqual(a.storeId,b.storeId);
 assert.match(a.content.text,/159.000đ/);assert.match(b.content.text,/209.000đ/);
});
test('06 Shop C separate Tenant and price',()=>{
 const {studio}=env();
 const c=adapter.build({studio,shop:'C',channel:'WEB_WIDGET',modelOutput:model('QUOTE')});
 assert.equal(c.tenantId,'qa_tenant_2');assert.match(c.content.text,/259.000đ/);
});
test('07 Messenger generic card is just an account gated concept',()=>{
 const {studio}=env();
 const r=adapter.build({studio,shop:'A',channel:'MESSENGER',modelOutput:model('DISCOVER')});
 assert(r.components.includes('GENERIC_TEMPLATE_ACCOUNT_GATED'));
 assert.equal(r.providerPermissionsVerified,false);
});
test('08 Zalo Bot native rich style documented concept',()=>{
 const {studio}=env();
 const r=adapter.build({studio,shop:'A',channel:'ZALO_BOT',modelOutput:model('QUOTE')});
 assert(r.components.includes('BOT_TEXT_STYLES_DOCUMENTED_NOT_ACCOUNT_VERIFIED'));
});
test('09 Zalo OA paid CTA never auto-approved',()=>{
 const {studio}=env();
 const r=adapter.build({studio,shop:'A',channel:'ZALO_OA',modelOutput:model('QUOTE')});
 assert(r.components.includes('CTA_TEMPLATE_ACCOUNT_AND_SPEND_GATED'));
 assert.equal(r.costApprovalVerified,false);assert.equal(r.canSend,false);
});
test('10 Widget card remains local preview',()=>{
 const {studio}=env();
 const r=adapter.build({studio,shop:'B',channel:'WEB_WIDGET',modelOutput:model('DISCOVER')});
 assert(r.components.includes('LOCAL_PRODUCT_CARD_PREVIEW'));
 assert.equal(r.nativeProviderPayload,null);
});
test('11 selecting QA media never emits verified media URL',()=>{
 const {studio}=env();
 studio.save('C','WEB_WIDGET',{mediaRef:'QA_C_PRODUCT_PHOTO'},
 {expectedRevision:1,expectedBaseVersion:1});
 const r=adapter.build({studio,shop:'C',channel:'WEB_WIDGET',modelOutput:model('DISCOVER')});
 assert.equal(r.content.mediaId,'QA_C_PRODUCT_PHOTO');
 assert.equal(r.content.approvedMediaUrl,null);
});
test('12 selecting QA link never emits real URL',()=>{
 const {studio}=env();
 studio.save('A','ZALO_BOT',{linkRef:'QA_A_CATALOG_LINK'},
 {expectedRevision:1,expectedBaseVersion:1});
 const r=adapter.build({studio,shop:'A',channel:'ZALO_BOT',modelOutput:model('DISCOVER')});
 assert.equal(r.content.linkId,'QA_A_CATALOG_LINK');
 assert.equal(r.content.approvedLinkUrl,null);
});
test('13 user-provided external URL cannot be attached',()=>{
 const {studio}=env();
 assert.throws(()=>studio.save('A','WEB_WIDGET',{linkRef:'https://evil.test'},
 {expectedRevision:1,expectedBaseVersion:1}),/ADV4_ASSET_STORE_SCOPE_DENIED/);
});
test('14 active button never published',()=>{
 const {studio}=env();
 studio.save('B','ZALO_OA',{ctaAction:'ORDER_REQUEST_DRAFT'},
 {expectedRevision:1,expectedBaseVersion:1});
 const r=adapter.build({studio,shop:'B',channel:'ZALO_OA',modelOutput:model('ORDER_REQUEST')});
 assert.equal(r.action.id,'ORDER_REQUEST_DRAFT');assert.equal(r.action.active,false);
 assert.equal(r.action.verifiedChannelBinding,false);
});
test('15 TRΑCK_ORDER preview no private Orders access',()=>{
 const {studio}=env();
 studio.save('A','MESSENGER',{ctaAction:'TRACK_ORDER'},
 {expectedRevision:1,expectedBaseVersion:1});
 const r=adapter.build({studio,shop:'A',channel:'MESSENGER',modelOutput:model('ORDER_LOOKUP')});
 assert.match(r.content.text,/xác minh/i);assert.equal(r.readCustomerOrders,false);
});
test('16 cannot select undefined channel',()=>{
 const {studio}=env();assert.throws(()=>adapter.build({studio,shop:'A',channel:'UNKNOWN',modelOutput:model('QUOTE')}),
 /ADV4_TRUSTED_CONTRACT_INPUT_REQUIRED/);
});
test('17 cannot publish draft to actual provider',()=>{
 const {studio}=env(),r=adapter.build({studio,shop:'A',channel:'MESSENGER',modelOutput:model('GREETING')});
 assert.equal(r.registryReleaseApproved,false);
 assert.equal(r.merchantConsentVerified,false);
});
test('18 ABSTAIN routes to safe generic text',()=>{
 const {studio}=env(),r=adapter.build({studio,shop:'A',channel:'ZALO_OA',modelOutput:model('ABSTAIN')});
 assert.equal(r.preferredComponent,'TEXT');assert.match(r.content.text,/chưa chắc/i);
});
test('19 link and media IDs cannot be mistaken for verified endpoints',()=>{
 const {studio}=env();
 for(const c of registry.CHANNELS){
  const r=adapter.build({studio,shop:'A',channel:c,modelOutput:model('DISCOVER')});
  assert.equal(r.content.approvedMediaUrl,null);assert.equal(r.content.approvedLinkUrl,null);
 }
});
test('20 no model may supply custom body, action or URL',()=>{
 const {studio}=env();
 assert.throws(()=>adapter.build({studio,shop:'A',channel:'MESSENGER',
 modelOutput:{...model('QUOTE'),action:'CREATE_ORDER',url:'https://attacker'}}),
 /MODEL_EXTRA_OR_MISSING_FIELDS/);
});