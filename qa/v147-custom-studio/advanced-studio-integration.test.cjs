'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const studioApi=require('./studio-core.js');
const registry=require('./advanced-channel-registry.js');
const policy=require('./advanced-presentation-policy.js');
const intel=require('./advanced-ai-intelligence.js');
const api=require('./advanced-studio-integration.js');
const proposal=intent=>({schema_version:intel.SCHEMA_VERSION,intent});
function env(){
 const base=studioApi.createStudio();
 const integration=api.createStudioIntegration({studioApi,registry,policy,intelligence:intel,
  baseReader:(s,c)=>base.get(s,c)});
 return {integration,base};
}
test('01 retains four existing channels',()=>assert.deepEqual(registry.CHANNELS,['MESSENGER','ZALO_BOT','ZALO_OA','WEB_WIDGET']));
test('02 keeps independent 3 synthetic Stores',()=>assert.equal(Object.keys(studioApi.FIXTURES).length,3));
test('03 no global Sales Lite option added',()=>assert.equal(api.PRESETS.includes('SALES_LITE'),false));
test('04 default configuration remains unpublished',()=>{
 const x=env().integration.get('A','MESSENGER');
 assert.equal(x.approval_status,'EXPERIMENTAL');assert.equal(x.releaseAuthorized,false);
 assert.equal(x.merchantEntitlementVerified,false);assert.equal(x.accountCapabilityVerified,false);
});
test('05 configuration binds tenant, store, channel',()=>{
 const i=env().integration;const a=i.get('A','MESSENGER'),b=i.get('B','MESSENGER');
 assert.equal(a.tenant_id,b.tenant_id);assert.notEqual(a.store_id,b.store_id);
 assert.equal(a.channel,'MESSENGER');
});
test('06 all 12 configuration slices independent',()=>{
 const i=env().integration;for(const s of ['A','B','C'])for(const c of registry.CHANNELS)i.get(s,c);
 assert.equal(i.inspect().drafts,12);
});
test('07 versioned save increments 1 -> 2',()=>{
 const i=env().integration,x=i.get('A','ZALO_BOT');
 const y=i.save('A','ZALO_BOT',{presentationPreset:'PRODUCT_FIRST'},
 {expectedRevision:x.revision,expectedBaseVersion:x.baseBotVersion});
 assert.equal(y.revision,2);assert.equal(y.revisionOf,1);
});
test('08 shop A update cannot change B',()=>{
 const i=env().integration,x=i.get('A','WEB_WIDGET');
 i.save('A','WEB_WIDGET',{presentationPreset:'TEXT_FIRST'},
 {expectedRevision:x.revision,expectedBaseVersion:x.baseBotVersion});
 assert.equal(i.get('B','WEB_WIDGET').presentationPreset,'BALANCED');
});
test('09 channel A Messenger update cannot affect A Zalo',()=>{
 const i=env().integration,x=i.get('A','MESSENGER');
 i.save('A','MESSENGER',{presentationPreset:'TEXT_FIRST'},
 {expectedRevision:x.revision,expectedBaseVersion:x.baseBotVersion});
 assert.equal(i.get('A','ZALO_OA').presentationPreset,'BALANCED');
});
test('10 wrong expected revision rejects concurrent write',()=>{
 const i=env().integration;assert.throws(()=>i.save('A','MESSENGER',{presentationPreset:'TEXT_FIRST'},
 {expectedRevision:2,expectedBaseVersion:1}),/ADV4_STALE_REVISION/);
});
test('11 missing expected revision denied',()=>{
 const i=env().integration;assert.throws(()=>i.save('A','MESSENGER',{ctaAction:'VIEW_POLICY'}),/ADV4_STALE_REVISION/);
});
test('12 wrong base version refused',()=>{
 const i=env().integration;assert.throws(()=>i.save('A','MESSENGER',{ctaAction:'ASK_STAFF'},
 {expectedRevision:1,expectedBaseVersion:123}),/ADV4_STALE_BASE_CONFIG/);
});
test('13 base Studio edits invalidate stale Advanced draft',()=>{
 const {integration:i,base}=env(),x=i.get('A','MESSENGER');
 base.update('A','MESSENGER',{greeting:'Xin chào khách QA'},'INTERNAL_STAFF_QA');
 assert.throws(()=>i.save('A','MESSENGER',{presentationPreset:'TEXT_FIRST'},
 {expectedRevision:x.revision,expectedBaseVersion:x.baseBotVersion}),/ADV4_STALE_BASE_CONFIG/);
});
test('14 internal rebase aligns parent bot version',()=>{
 const {integration:i,base}=env();i.get('A','MESSENGER');
 base.update('A','MESSENGER',{greeting:'Xin chào khách QA'},'INTERNAL_STAFF_QA');
 const x=i.rebase('A','MESSENGER',{expectedRevision:1});
 assert.equal(x.baseBotVersion,2);assert.equal(x.revision,2);
});
test('15 merchant cannot silently rebase',()=>{
 const {integration:i,base}=env();i.get('A','MESSENGER');
 base.update('A','MESSENGER',{tone:'kỹ thuật'});
 assert.throws(()=>i.rebase('A','MESSENGER',{actor:'MERCHANT_QA',expectedRevision:1}),/ADV4_REBASE_REQUIRES_INTERNAL_QA/);
});
test('16 rebase without parent change disallowed',()=>{
 const i=env().integration;assert.throws(()=>i.rebase('B','ZALO_BOT',{expectedRevision:1}),/ADV4_NO_REBASE_REQUIRED/);
});
test('17 rollback preserves history and creates NEW version',()=>{
 const i=env().integration,a=i.get('A','MESSENGER');
 const b=i.save('A','MESSENGER',{presentationPreset:'PRODUCT_FIRST'},
 {expectedRevision:a.revision,expectedBaseVersion:a.baseBotVersion});
 const c=i.rollback('A','MESSENGER',1,{expectedRevision:b.revision});
 assert.equal(c.revision,3);assert.equal(c.revisionOf,1);
 assert.equal(c.presentationPreset,'BALANCED');
 assert.deepEqual(i.history('A','MESSENGER').map(x=>x.revision),[1,2,3]);
});
test('18 rollback stale revision denied',()=>{
 const i=env().integration,x=i.get('A','MESSENGER');
 i.save('A','MESSENGER',{ctaAction:'VIEW_POLICY'},
 {expectedRevision:1,expectedBaseVersion:x.baseBotVersion});
 assert.throws(()=>i.rollback('A','MESSENGER',1,{expectedRevision:1}),/ADV4_STALE_REVISION/);
});
test('19 merchant rollback forbidden',()=>{
 const i=env().integration,x=i.get('A','MESSENGER');
 i.save('A','MESSENGER',{ctaAction:'ASK_STAFF'},
 {expectedRevision:1,expectedBaseVersion:x.baseBotVersion});
 assert.throws(()=>i.rollback('A','MESSENGER',1,{actor:'MERCHANT_QA',expectedRevision:2}),/ADV4_ROLLBACK_REQUIRES_INTERNAL_QA/);
});
test('20 merchant cannot inject sensitive CTA',()=>{
 const i=env().integration;assert.throws(()=>i.save('A','MESSENGER',{ctaAction:'TRACK_ORDER'},
 {actor:'MERCHANT_QA',expectedRevision:1,expectedBaseVersion:1}),/ADV4_MERCHANT_SENSITIVE_ACTION_DENIED/);
});
test('21 merchant can change safe CTA in QA memory',()=>{
 const i=env().integration,x=i.save('A','MESSENGER',{ctaAction:'ASK_STAFF'},
 {actor:'MERCHANT_QA',expectedRevision:1,expectedBaseVersion:1});
 assert.equal(x.ctaAction,'ASK_STAFF');assert.equal(x.releaseAuthorized,false);
});
test('22 unknown actor blocked',()=>assert.throws(()=>env().integration.save('A','MESSENGER',{ctaAction:'ASK_STAFF'},
 {actor:'SUPER_ADMIN',expectedRevision:1,expectedBaseVersion:1}),/ADV4_ACTOR_DENIED/));
test('23 no patch injection tenant or system policy',()=>{
 const i=env().integration;
 for(const k of ['tenant_id','store_id','channel','approval_status','releaseAuthorized','policy_version','credential']){
  assert.throws(()=>i.save('A','MESSENGER',{[k]:'x'},
  {expectedRevision:1,expectedBaseVersion:1}),/ADV4_POLICY_SCOPE_LOCKED/);
 }
});
test('24 invalid action cannot be saved',()=>assert.throws(()=>env().integration.save('A','MESSENGER',{ctaAction:'DELETE_ORDER'},
 {expectedRevision:1,expectedBaseVersion:1}),/ADV4_ACTION_DENIED/));
test('25 invalid presentation preset blocked',()=>assert.throws(()=>env().integration.save('A','MESSENGER',{presentationPreset:'HTML_ANY'},
 {expectedRevision:1,expectedBaseVersion:1}),/ADV4_PRESET_DENIED/));
test('26 unauthorized cross-store media reference denied',()=>{
 const i=env().integration;
 assert.throws(()=>i.save('A','MESSENGER',{mediaRef:'QA_B_PRODUCT_PHOTO'},
 {expectedRevision:1,expectedBaseVersion:1}),/ADV4_ASSET_STORE_SCOPE_DENIED/);
});
test('27 unauthorized cross-store link reference denied',()=>{
 const i=env().integration;
 assert.throws(()=>i.save('B','WEB_WIDGET',{linkRef:'QA_A_CATALOG_LINK'},
 {expectedRevision:1,expectedBaseVersion:1}),/ADV4_ASSET_STORE_SCOPE_DENIED/);
});
test('28 arbitrary external URL forbidden even on website',()=>{
 const i=env().integration;
 assert.throws(()=>i.save('C','WEB_WIDGET',{linkRef:'https://evil.example'},
 {expectedRevision:1,expectedBaseVersion:1}),/ADV4_ASSET_STORE_SCOPE_DENIED/);
});
test('29 untrusted SVG/HTML payload forbidden',()=>{
 const i=env().integration;
 assert.throws(()=>i.save('A','WEB_WIDGET',{mediaRef:'<script>alert(1)</script>'},
 {expectedRevision:1,expectedBaseVersion:1}),/ADV4_ASSET_STORE_SCOPE_DENIED/);
});
test('30 QA media refs never become real URLs',()=>{
 const i=env().integration;
 for(const s of ['A','B','C'])for(const a of i.assets(s)){
   assert.equal(a.approvedUrl,null);assert.equal(a.providerVerified,false);
   assert.equal(a.merchantConsentVerified,false);
 }
});
test('31 media can be selected for same Shop safely',()=>{
 const i=env().integration,x=i.save('A','MESSENGER',{mediaRef:'QA_A_PRODUCT_PHOTO'},
 {expectedRevision:1,expectedBaseVersion:1});
 assert.equal(x.mediaRef,'QA_A_PRODUCT_PHOTO');
 assert.equal(i.preview('A','MESSENGER',proposal('DISCOVER')).mediaProviderUrl,null);
});
test('32 link can be selected as QA ref but stays unapproved',()=>{
 const i=env().integration,x=i.save('B','WEB_WIDGET',{linkRef:'QA_B_CATALOG_LINK'},
 {expectedRevision:1,expectedBaseVersion:1});
 assert.equal(x.linkRef,'QA_B_CATALOG_LINK');
 assert.equal(i.preview('B','WEB_WIDGET',proposal('DISCOVER')).linkProviderUrl,null);
});
test('33 all 3×4×8 previews cannot publish/send/execute',()=>{
 const i=env().integration;
 for(const s of ['A','B','C'])for(const c of registry.CHANNELS)for(const intent of policy.INTENTS){
  const x=i.preview(s,c,proposal(intent));
  assert.equal(x.canPublish,false);assert.equal(x.canExecute,false);
  assert.equal(x.providerSends,0);assert.equal(x.hostedWrites,0);
  assert.equal(x.providerPayload,null);assert.equal(x.senderEnabled,false);
  assert.equal(x.actionPreview.active,false);
  assert.equal(x.actionPreview.requiresSignedServerAction,true);
  assert.equal(x.salesLiteUnchanged,true);
 }
});
test('34 unknown AI intent denied',()=>{
 const i=env().integration;
 assert.throws(()=>i.preview('A','MESSENGER',proposal('FORCE_ORDER')),/MODEL_INTENT_NOT_ALLOWED/);
});
test('35 AI cannot inject price/store/action via extra fields',()=>{
 const i=env().integration;
 assert.throws(()=>i.preview('A','MESSENGER',{...proposal('QUOTE'),price:1,store_id:'qa_shop_b',action:'SEND'}),
 /MODEL_EXTRA_OR_MISSING_FIELDS/);
});
test('36 ACTION preview requires separate signed server gate',()=>{
 const i=env().integration,x=i.preview('C','ZALO_OA',proposal('ORDER_REQUEST'));
 assert.equal(x.signedActionIssued,false);assert.equal(x.actionPreview.nativeButtonAllowed,false);
});
test('37 text-first always degrades visual complexity',()=>{
 const i=env().integration;
 i.save('A','WEB_WIDGET',{presentationPreset:'TEXT_FIRST'},
 {expectedRevision:1,expectedBaseVersion:1});
 assert.equal(i.preview('A','WEB_WIDGET',proposal('DISCOVER')).renderedComponent,'TEXT');
});
test('38 advanced proposal never upgrades prohibited native component',()=>{
 const i=env().integration;
 i.save('B','ZALO_BOT',{presentationPreset:'PRODUCT_FIRST'},
 {expectedRevision:1,expectedBaseVersion:1});
 assert.equal(i.preview('B','ZALO_BOT',proposal('DISCOVER')).renderedComponent,'TEXT');
});
test('39 manual palette cannot change native Messenger rich text',()=>{
 const i=env().integration,x=i.preview('A','MESSENGER',proposal('QUOTE'));
 assert.equal(x.accountCapabilityVerified,false);assert.equal(x.requiresProviderApproval,true);
});
test('40 missing base trusted scope is denied',()=>{
 const base=studioApi.createStudio();
 const fake=(s,c)=>({...base.get(s,c),store_id:'qa_shop_b'});
 const i=api.createStudioIntegration({studioApi,registry,policy,intelligence:intel,baseReader:fake});
 assert.throws(()=>i.get('A','MESSENGER'),/ADV4_UNTRUSTED_BASE_SCOPE/);
});
test('41 stale base blocks preview before action presentation',()=>{
 const {integration:i,base}=env();i.preview('A','MESSENGER',proposal('QUOTE'));
 base.update('A','MESSENGER',{assistantName:'New QA A'});
 assert.throws(()=>i.preview('A','MESSENGER',proposal('QUOTE')),/ADV4_STALE_BASE_CONFIG/);
});
test('42 no implementation can publish, send, execute or write hosted',()=>{
 const i=env().integration;
 for(const m of ['publish','sendProvider','executeAction','writeHosted'])
 assert.throws(()=>i[m](),/ADV4_PUBLISH_SEND_ACTION_HOSTED_DISABLED/);
});
test('43 exported draft has no credentials and cannot release',()=>{
 const i=env().integration,x=i.exportDraft('A','ZALO_OA');
 assert.equal(x.canPublish,false);assert.equal(x.credentialsIncluded,false);
 assert.equal(x.verifiedOwnerEvidence,false);
});
test('44 getter returns deep copies',()=>{
 const i=env().integration,x=i.get('A','MESSENGER');x.tenant_id='evil';
 assert.equal(i.get('A','MESSENGER').tenant_id,'qa_tenant_1');
});
test('45 rollback prior snapshots immutable via API',()=>{
 const i=env().integration,his=i.history('A','MESSENGER');
 his[0].ctaAction='UNSAFE';
 assert.equal(i.history('A','MESSENGER')[0].ctaAction,'VIEW_CATALOG');
});
test('46 base Draft change followed by rebase preserves advanced override',()=>{
 const {integration:i,base}=env();
 i.save('A','MESSENGER',{presentationPreset:'TEXT_FIRST'},{
  expectedRevision:1,expectedBaseVersion:1});
 base.update('A','MESSENGER',{greeting:'Xin chào QA storefront'});
 const x=i.rebase('A','MESSENGER',{expectedRevision:2});
 assert.equal(x.presentationPreset,'TEXT_FIRST');assert.equal(x.baseBotVersion,2);
});
test('47 abstein requires clarification, never executes',()=>{
 const i=env().integration,x=i.preview('A','ZALO_BOT',proposal('ABSTAIN'));
 assert.equal(x.intent,'ABSTAIN');assert.equal(x.renderedComponent,'TEXT');
 assert.equal(x.canExecute,false);assert.equal(x.providerPayload,null);
});
test('48 link open CTA still pending signed server decision',()=>{
 const i=env().integration;
 i.save('A','WEB_WIDGET',{ctaAction:'OPEN_VERIFIED_LINK',linkRef:'QA_A_CATALOG_LINK'},
 {expectedRevision:1,expectedBaseVersion:1});
 const x=i.preview('A','WEB_WIDGET',proposal('DISCOVER'));
 assert.equal(x.actionPreview.requiresSignedServerAction,true);assert.equal(x.linkDomainApproved,false);
});
test('49 action registry IDs are compatible with backend action allowlist',()=>{
 const backend=require('./advanced-secure-actions.cjs').ACTIONS;
 for(const a of api.CTA)assert(Object.hasOwn(backend,a),a);
});
test('50 no external paid inference/network required',()=>{
 const i=env().integration;const x=i.inspect();
 assert.equal(x.realAiCalls,0);assert.equal(x.providerSends,0);
 assert.equal(x.paidTemplateCalls,0);assert.equal(x.canPublish,false);
});