'use strict';
/* This red-team test deliberately PROVES the existing in-memory QA replay ledger
   cannot prevent cross-instance replay. Passing test ≠ safe for production. */
const test=require('node:test'),assert=require('node:assert/strict'),{randomBytes}=require('node:crypto');
const {makeQaRegistry}=require('./advanced-secure-actions.cjs');
function ctx(change={}){
 return {tenantId:'qa_tenant_1',storeId:'qa_shop_a',channel:'MESSENGER',actorId:'qa_customer_1',
  sessionId:'qa_session_1',role:'CUSTOMER',identityVerified:true,membershipActive:true,
  channelBindingVerified:true,consentActive:true,entitlementActive:true,
  customerStoreLinkVerified:true,orderOwnershipVerified:true,authorizedOrderId:'qa_order_1',
  authorizedOrderStoreId:'qa_shop_a',explicitCustomerConfirmation:true,
  confirmedDraftId:'qa_draft_1',approvedLinkRegistryMatch:true,
  approvedLinkRef:'qa_link_1',...change};
}
function pair(){
 const key=randomBytes(32),now=()=>1800000000000;
 return {a:makeQaRegistry({key,now}),b:makeQaRegistry({key,now})};
}
test('01 SAME instance replay denied',()=>{
 const {a}=pair(),context=ctx(),t=a.issueQa({context,action:'TRACK_ORDER',resourceId:'qa_order_1'}).token;
 a.inspectAndConsumeQa({token:t,context});
 assert.throws(()=>a.inspectAndConsumeQa({token:t,context}),/QA_REPLAY_DENIED/);
});
test('02 CROSS instance replay vulnerability is explicitly demonstrated and quarantined',()=>{
 const {a,b}=pair(),context=ctx(),t=a.issueQa({context,action:'TRACK_ORDER',resourceId:'qa_order_1'}).token;
 const first=a.inspectAndConsumeQa({token:t,context});
 const replay=b.inspectAndConsumeQa({token:t,context});
 assert.equal(first.replayConsumed,true);
 assert.equal(replay.replayConsumed,true,'different memory ledgers accepted same signed receipt');
 assert.equal(first.durableReplayCertified,false);
 assert.equal(replay.durableReplayCertified,false);
 assert.equal(first.canExecute,false);
 assert.equal(replay.canExecute,false);
 console.log('EXPECTED P0 PRE-PRODUCTION GAP: one token accepted by two isolated QA instances; NO EXECUTION');
});
test('03 shared ephemeral key does not make ledger shared',()=>{
 const {a,b}=pair(),context=ctx(),t=a.issueQa({context,action:'VIEW_CATALOG',resourceId:'qa_product_1'}).token;
 a.inspectAndConsumeQa({token:t,context});
 assert.equal(a.inspect().ledgerSize,1);
 assert.equal(b.inspect().ledgerSize,0);
});
test('04 cross instance Store spoof still denied cryptographically',()=>{
 const {a,b}=pair(),context=ctx(),t=a.issueQa({context,action:'VIEW_CATALOG',resourceId:'qa_product_1'}).token;
 assert.throws(()=>b.inspectAndConsumeQa({token:t,context:ctx({storeId:'qa_shop_b'})}),/QA_ACTOR_SCOPE_MISMATCH/);
});
test('05 different signing keys block cross instance validation',()=>{
 const a=makeQaRegistry({key:randomBytes(32),now:()=>1800000000000});
 const b=makeQaRegistry({key:randomBytes(32),now:()=>1800000000000});
 const context=ctx(),t=a.issueQa({context,action:'VIEW_CATALOG',resourceId:'qa_product_1'}).token;
 assert.throws(()=>b.inspectAndConsumeQa({token:t,context}),/QA_SIGNATURE_INVALID/);
});
test('06 receipt is QA only, never authorizes any side effect',()=>{
 const {a,b}=pair(),context=ctx(),t=a.issueQa({context,action:'ORDER_REQUEST_DRAFT',resourceId:'qa_draft_1'}).token;
 const first=a.inspectAndConsumeQa({token:t,context});
 const again=b.inspectAndConsumeQa({token:t,context});
 assert.equal(first.canExecute,false);assert.equal(again.canExecute,false);
 assert.throws(()=>a.execute(),/NO_SIDE_EFFECTS_IN_QA_REGISTRY/);
 assert.throws(()=>b.execute(),/NO_SIDE_EFFECTS_IN_QA_REGISTRY/);
});
test('07 no hosted store JWT, permissions, atomic DB or provider send claimed',()=>{
 const {a,b}=pair();
 for(const i of [a.inspect(),b.inspect()]){
  assert.equal(i.scope,'DISPOSABLE_QA_ONLY');
  assert.equal(i.usesPersistentReplay,false);
  assert.equal(i.providerSends,0);assert.equal(i.orderWrites,0);
  assert.equal(i.productionAuthorized,false);
 }
});
