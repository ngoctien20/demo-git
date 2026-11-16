'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const bridge=require('./studio-action-crosswalk.cjs');
const server=require('./signed-action-registry.cjs');
const evaluator=require('../v147-custom-studio/advanced-ai-presentation-evaluator.js');
const studioApi=require('../v147-custom-studio/studio-core.js');
const proposal=(intent='QUOTE',params={})=>JSON.stringify({
 contract:evaluator.INPUT_CONTRACT,intent,
 presentation:{emphasis:'NONE',component:'TEXT',media:'NONE',action:'NONE',...params}
});
const sample=(shop='A',channel='MESSENGER',uiAction='REQUEST_QUOTE',raw=proposal())=>
 bridge.preview({shop,channel,uiAction,raw});
test('01 original server action vocabulary unchanged',()=>
 assert.deepEqual(server.ACTIONS,['CATALOG','QUOTE','ORDER_REQUEST','ASK_STAFF','POLICY']));
test('02 view catalog maps to catalog without permission to sign',()=>{
 const x=bridge.mapAction('VIEW_CATALOG');assert.equal(x.serverAction,'CATALOG');
 assert.equal(x.canIssueReceipt,false);assert.equal(x.executable,false);
});
test('03 quote maps to quote',()=>assert.equal(bridge.mapAction('REQUEST_QUOTE').serverAction,'QUOTE'));
test('04 staff maps same',()=>assert.equal(bridge.mapAction('ASK_STAFF').serverAction,'ASK_STAFF'));
test('05 policy view maps to policy',()=>assert.equal(bridge.mapAction('VIEW_POLICY').serverAction,'POLICY'));
test('06 old catalog action remains supported as a UI hint',()=>{
 const x=bridge.mapAction('CATALOG');assert.equal(x.serverAction,'CATALOG');assert.equal(x.canIssueReceipt,false);
});
test('07 old quote hint remains preview-only',()=>assert.equal(bridge.mapAction('QUOTE').serverAction,'QUOTE'));
test('08 old policy hint remains preview-only',()=>assert.equal(bridge.mapAction('POLICY').serverAction,'POLICY'));
test('09 order request remains conversational only',()=>{
 const x=bridge.mapAction('ORDER_REQUEST');
 assert.equal(x.serverAction,'ORDER_REQUEST');assert.equal(x.requiresExplicitCustomerConfirmation,true);
 assert.equal(x.canIssueReceipt,false);
});
test('10 draft creation MUST NOT silently map to conversational order request',()=>{
 const x=bridge.mapAction('ORDER_REQUEST_DRAFT');
 assert.equal(x.serverAction,null);assert.equal(x.blocked,true);
 assert.equal(x.reason,'DRAFT_CREATION_NOT_EQUIVALENT');
});
test('11 real private order lookup blocked',()=>{
 const x=bridge.mapAction('TRACK_ORDER');assert.equal(x.serverAction,null);
 assert.equal(x.blocked,true);
});
test('12 real verified link open blocked',()=>{
 const x=bridge.mapAction('OPEN_VERIFIED_LINK');
 assert.equal(x.serverAction,null);assert.equal(x.blocked,true);
});
test('13 reject all unknown arbitrary action commands',()=>{
 for(const x of ['CREATE_ORDER','DELETE_ORDER','UPDATE_STOCK','BILLING','ADMIN','SYSTEM',''])
  assert.throws(()=>bridge.mapAction(x),/ADV5_ACTION_VOCABULARY_DENIED/);
});
test('14 reject arbitrary object or array input',()=>{
 for(const x of [null,undefined,{},[],123])assert.throws(()=>bridge.mapAction(x),/ADV5_ACTION_VOCABULARY_DENIED/);
});
test('15 never let action vocabulary change server allowlist',()=>{
 for(const x of Object.keys(bridge.ALIASES)){
  const out=bridge.mapAction(x);
  if(out.serverAction)assert(server.ACTIONS.includes(out.serverAction));
  assert.equal(out.canIssueReceipt,false);
 }
});
test('16 QA composer authenticates no business identity',()=>{
 const x=sample();assert.equal(x.interaction.identityVerified,false);
 assert.equal(x.configuredAction.needsStoreRlsProof,true);
 assert.equal(x.interaction.durableNonceCertified,false);
});
test('17 3 shops x 4 channels x 11 aliases all remain no-send',()=>{
 for(const s of ['A','B','C'])for(const c of server.CHANNELS)
 for(const a of Object.keys(bridge.ALIASES)){
  const x=sample(s,c,a);
  assert.equal(x.storeId,studioApi.FIXTURES[s].storeId);
  assert.equal(x.tenantId,studioApi.FIXTURES[s].tenantId);
  assert.equal(x.channel,c);
  assert.equal(x.canSign,false);
  assert.equal(x.canSend,false);assert.equal(x.canExecute,false);assert.equal(x.canPublish,false);
  assert.equal(x.providerSends,0);assert.equal(x.hostedWrites,0);
  assert.equal(x.interaction.providerPayload,null);
  assert.equal(x.interaction.signedToken,null);
  assert.equal(x.interaction.disabled,true);
  assert.equal(x.interaction.approvedMediaUrl,null);
  assert.equal(x.interaction.approvedLinkUrl,null);
 }
});
test('18 Shop A/B same tenant but different exact store/price',()=>{
 const a=sample('A'),b=sample('B');
 assert.equal(a.tenantId,b.tenantId);assert.notEqual(a.storeId,b.storeId);
 assert.match(a.plainText,/159.000đ/);assert.match(b.plainText,/209.000đ/);
});
test('19 Shop C distinct tenant',()=>{
 const x=sample('C');assert.equal(x.tenantId,'qa_tenant_2');
 assert.match(x.plainText,/259.000đ/);
});
test('20 cannot authorize Store X',()=>assert.throws(()=>sample('X'),/ADV5_STORE_SCOPE_UNKNOWN/));
test('21 cannot authorize unsupported Telegram channel',()=>assert.throws(()=>
 sample('A','TELEGRAM'),/ADV5_CHANNEL_SCOPE_UNKNOWN/));
test('22 cannot include model price, URL, recipient or store override',()=>{
 const v=JSON.parse(proposal());
 v.price=1;v.url='https://attacker.invalid';v.recipient='qa_a';
 assert.throws(()=>sample('A','MESSENGER','QUOTE',JSON.stringify(v)));
});
test('23 cannot supply arbitrary native provider payload',()=>{
 const v=JSON.parse(proposal('DISCOVER'));
 v.nativePayload={message:{text:'phishing'}};
 assert.throws(()=>sample('A','MESSENGER','CATALOG',JSON.stringify(v)));
});
test('24 model suggestion must not silently overwrite merchant config',()=>{
 const x=sample('A','MESSENGER','VIEW_CATALOG',
   proposal('QUOTE',{action:'QUOTE'}));
 assert.equal(x.configuredAction.uiAction,'VIEW_CATALOG');
 assert.equal(x.suggestedModelAction,'QUOTE');
 assert.equal(x.suggestionMismatch,true);
 assert.equal(x.status,'SUGGESTION_DIFFERENT_FROM_CONFIG');
 assert.equal(x.canExecute,false);
});
test('25 consistent QA suggestion never authorizes sign',()=>{
 const x=sample('A','MESSENGER','REQUEST_QUOTE',
 proposal('QUOTE',{emphasis:'PRICE',action:'QUOTE'}));
 assert.equal(x.suggestionMismatch,false);assert.equal(x.canSign,false);
});
test('26 order request draft produces blocked status',()=>{
 const x=sample('A','WEB_WIDGET','ORDER_REQUEST_DRAFT',proposal('ORDER_REQUEST'));
 assert.equal(x.status,'ACTION_SEMANTICS_UNSUPPORTED');assert.equal(x.configuredAction.blocked,true);
 assert.equal(x.orderCreated,false);
});
test('27 track order cannot read private customer order',()=>{
 const x=sample('A','ZALO_BOT','TRACK_ORDER',proposal('ORDER_LOOKUP'));
 assert.equal(x.orderLookedUp,false);assert.equal(x.readCustomerData,false);
 assert.equal(x.canExecute,false);
});
test('28 external URL open remains disabled',()=>{
 const x=sample('A','ZALO_OA','OPEN_VERIFIED_LINK');
 assert.equal(x.interaction.approvedLinkUrl,null);
 assert.equal(x.interaction.approvedRecipient,null);
});
test('29 Messenger native postback never issued by crosswalk',()=>{
 const x=sample('B','MESSENGER','VIEW_CATALOG',proposal('DISCOVER',{component:'PRODUCT_CARD'}));
 assert.equal(x.canSign,false);assert.equal(x.interaction.signedToken,null);
 assert.equal(x.interaction.providerPayload,null);
});
test('30 Zalo OA ZBS remains locked and preview-only',()=>{
 const x=sample('C','ZALO_OA','REQUEST_QUOTE',proposal('QUOTE',{component:'ZBS_TEMPLATE'}));
 assert.equal(x.canSend,false);assert.equal(x.canPublish,false);
 assert.equal(x.interaction.providerPermissionVerified,false);
});
test('31 browser cannot invoke signing',()=>{
 assert.throws(()=>bridge.sign(),/ADV5_STUDIO_CROSSWALK_SIGN_DISABLED/);
});
test('32 browser cannot execute business action',()=>{
 assert.throws(()=>bridge.execute(),/ADV5_STUDIO_CROSSWALK_EXECUTE_DISABLED/);
});
test('33 browser cannot send native provider message',()=>{
 assert.throws(()=>bridge.send(),/ADV5_STUDIO_CROSSWALK_SEND_DISABLED/);
});
test('34 report retains two separate unmerged PR references',()=>{
 const r=bridge.inspectCompatibility();
 assert.equal(r.notMergedSiblingBranches,true);
 assert.equal(r.sourceStudioPr,162);assert.equal(r.sourceAdapterPr,152);
 assert.equal(r.canRelease,false);assert.equal(r.canIssueReceipt,false);
 assert.equal(r.actions.length,11);
});
test('35 no actual model call needed',()=>{
 const r=sample('A','WEB_WIDGET','ASK_STAFF');
 assert.equal(r.realModelCalls,0);assert.equal(r.qaOnly,true);
});
