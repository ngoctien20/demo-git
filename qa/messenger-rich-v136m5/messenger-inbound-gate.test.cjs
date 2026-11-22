'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createMessengerInboundGateCandidate}=require('./messenger-inbound-gate.cjs');
const {createPrivateEventStoreCandidate}=require('./private-event-store.cjs');
const {createSyntheticPgModel}=require('./synthetic-pg-model.cjs');

const tenant='11111111-1111-4111-8111-111111111111';
const store='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const page='12345678901234567',sender='55555555555555555';
const HKEY='SYNTHETIC_QA_KEY_NO_PRODUCTION_USE_404_V21';
const trusted=extra=>({
 source:'SERVER_VERIFIED_MESSENGER_BINDING',serverDerived:true,verified:true,
 tenantId:tenant,storeId:store,pageId:page,recipientPsid:sender,bindingVersion:3,...extra
});
const event=extra=>({
 source:'SYNTHETIC_SIGNED_WEBHOOK_QA',rawSignatureVerified:true,
 timingSafeVerified:true,serverSideResolverVerified:true,
 entitlementVerified:true,inboundWindowVerified:true,
 channel:'messenger',eventKind:'customer_message',
 replayKey:'b'.repeat(64),trusted:trusted(),...extra
});
const make=(model=createSyntheticPgModel())=>{
 const storeCandidate=createPrivateEventStoreCandidate({
  mode:'SYNTHETIC_SQL_QA_ONLY',driver:model.openClient(),
  secret:HKEY,now:()=>Date.parse('2026-11-22T10:00:00Z')
 });
 return {gate:createMessengerInboundGateCandidate({
  mode:'SYNTHETIC_QA_ONLY',eventStore:storeCandidate
 }),model};
};
const receipts=(n,recipient=sender)=>Array.from({length:n},(_,i)=>({
 message_id:'synthetic.mid.'+(i+1),recipient_id:recipient
}));

test('live and missing opt-in modes fail closed without any event claim',()=>{
 assert.throws(()=>createMessengerInboundGateCandidate(),/INBOUND_GATE_HOSTED_NOT_APPROVED/);
 const {gate,model}=make();
 assert.throws(()=>createMessengerInboundGateCandidate({mode:'LIVE',eventStore:gate}),/INBOUND_GATE_HOSTED_NOT_APPROVED/);
 assert.equal(model.diagnostics().rowCount,0);
});

test('fake hosted or unsafe store readiness cannot replace V13.6M.5 synthetic contract',()=>{
 const storeCandidate=createPrivateEventStoreCandidate({
  mode:'SYNTHETIC_SQL_QA_ONLY',driver:createSyntheticPgModel().openClient(),
  secret:HKEY,now:()=>Date.parse('2026-11-22T10:00:00Z')
 });
 for(const patch of [
  {providerSendEnabled:true},{durableReplayReady:true},
  {outboxEnabled:true},{allowOrderWrites:true},{mode:'HOSTED_POSTGRES'}
 ]){
  assert.throws(()=>createMessengerInboundGateCandidate({
   mode:'SYNTHETIC_QA_ONLY',eventStore:{
    ...storeCandidate,readiness:{...storeCandidate.readiness,...patch}
   }
  }),/INBOUND_GATE_STORE_NOT_APPROVED/);
 }
});

test('Meta HMAC, timing proof, server resolver, entitlement and customer window are mandatory',async()=>{
 const {gate,model}=make();
 const mutations=[
  {rawSignatureVerified:false},{timingSafeVerified:false},
  {serverSideResolverVerified:false},{entitlementVerified:false},
  {inboundWindowVerified:false},{source:'BROWSER_INPUT'},
  {channel:'zalo_bot'},{eventKind:'message_reaction'},
  {replayKey:'fake'},{trusted:trusted({serverDerived:false})},
  {trusted:trusted({verified:false})},
  {trusted:trusted({recipientPsid:'not-psid'})}
 ];
 for(const patch of mutations){
  await assert.rejects(gate.reserve(event(patch)),/INBOUND_GATE_UNVERIFIED_PROOF/);
 }
 assert.equal(model.diagnostics().rowCount,0);
});

test('first claim reserves a NO-SEND ticket; duplicate holds without a second lease',async()=>{
 const {gate,model}=make();
 const first=await gate.reserve(event());
 const same=await gate.reserve(event());
 assert.equal(first.mode,'CLAIM_RESERVED_DRY_RUN');
 assert.equal(first.sendAllowed,false);
 assert.equal(first.orderWriteAllowed,false);
 assert.equal(first.retryAllowed,false);
 assert.equal(same.mode,'DUPLICATE_HOLD');
 assert.equal(same.sendAllowed,false);
 assert.equal(model.diagnostics().rowCount,1);
 assert.doesNotMatch(JSON.stringify(first),new RegExp(sender));
 assert.doesNotMatch(JSON.stringify(first),/lease|secret|rawBody/i);
});

test('50 concurrent synthetic webhook retries reserve exactly one claim',async()=>{
 const model=createSyntheticPgModel();
 const gates=Array.from({length:50},()=>make(model).gate);
 const results=await Promise.all(gates.map(g=>g.reserve(event())));
 assert.equal(results.filter(r=>r.mode==='CLAIM_RESERVED_DRY_RUN').length,1);
 assert.equal(results.filter(r=>r.mode==='DUPLICATE_HOLD').length,49);
 assert.equal(model.diagnostics().rowCount,1);
});

test('one, two or three synthetic receipts can finalize PREVIEW_READY, never provider accepted',async()=>{
 for(const n of [1,2,3]){
  const {gate,model}=make();
  const ticket=await gate.reserve(event());
  const decision=gate.reviewSyntheticOutcome(ticket,{
   expectedCount:n,receipts:receipts(n),transport:'SYNTHETIC_ACCEPTED'
  });
  assert.equal(decision.mode,'READY_FOR_PREVIEW_FINALIZE');
  assert.equal(decision.acceptedByMeta,false);
  assert.equal(decision.delivered,false);
  assert.equal(decision.syntheticReceiptCount,n);
  const finished=await gate.finalizePreview(ticket);
  assert.equal(finished.mode,'PREVIEW_READY');
  assert.equal(finished.providerSendEnabled,false);
  assert.equal(finished.acceptedByMeta,false);
  assert.deepEqual(model.simulatedStatuses(),['PREVIEW_READY']);
  assert.equal((await gate.reserve(event())).mode,'DUPLICATE_HOLD');
 }
});

test('partial 1/3 synthetic receipts become UNCERTAIN_HOLD without retries or finalize',async()=>{
 const {gate,model}=make();
 const ticket=await gate.reserve(event());
 const partial=gate.reviewSyntheticOutcome(ticket,{
  expectedCount:3,receipts:receipts(1)
 });
 assert.equal(partial.mode,'UNCERTAIN_HOLD');
 assert.equal(partial.needsReconciliation,true);
 assert.equal(partial.retryAllowed,false);
 assert.equal(partial.finalizeAllowed,false);
 assert.deepEqual(model.simulatedStatuses(),['CLAIMED']);
 assert.equal((await gate.reserve(event())).mode,'DUPLICATE_HOLD');
 await assert.rejects(gate.finalizePreview(ticket),/INBOUND_GATE_FINALIZE_NOT_ALLOWED/);
 assert.throws(()=>gate.reviewSyntheticOutcome(ticket,{expectedCount:3,receipts:receipts(3)}),
  /INBOUND_GATE_REVIEW_ALREADY_CONSUMED/);
});

test('Meta timeout with possibly accepted message is NEVER auto retried',async()=>{
 const {gate,model}=make();
 const ticket=await gate.reserve(event());
 const d=gate.reviewSyntheticOutcome(ticket,{
  expectedCount:1,receipts:receipts(1),transport:'TIMEOUT_UNKNOWN'
 });
 assert.equal(d.mode,'UNCERTAIN_HOLD');
 assert.equal(d.retryAllowed,false);
 assert.equal((await gate.reserve(event())).mode,'DUPLICATE_HOLD');
 assert.deepEqual(model.simulatedStatuses(),['CLAIMED']);
});

test('wrong sender, duplicate Meta MID, missing MID and extra receipts fail closed',async()=>{
 const bad=[
  {expectedCount:1,receipts:receipts(1,'77777777777777777')},
  {expectedCount:2,receipts:[receipts(1)[0],receipts(1)[0]]},
  {expectedCount:1,receipts:[{recipient_id:sender}]},
  {expectedCount:1,receipts:receipts(2)},
  {expectedCount:0,receipts:[]},{expectedCount:4,receipts:receipts(4)},
  {expectedCount:1,receipts:null}
 ];
 for(const sample of bad){
  const {gate,model}=make();
  const ticket=await gate.reserve(event());
  const result=gate.reviewSyntheticOutcome(ticket,sample);
  assert.equal(result.mode,'UNCERTAIN_HOLD');
  assert.deepEqual(model.simulatedStatuses(),['CLAIMED']);
 }
});

test('unissued tickets, duplicate tickets and cross-gate tickets cannot finalize',async()=>{
 const model=createSyntheticPgModel();
 const {gate:a}=make(model),{gate:b}=make(model);
 const ticket=await a.reserve(event());
 await assert.rejects(b.finalizePreview(ticket),/INBOUND_GATE_FINALIZE_NOT_ALLOWED/);
 assert.throws(()=>b.reviewSyntheticOutcome(ticket,{expectedCount:1,receipts:receipts(1)}),
  /INBOUND_GATE_TICKET_UNTRUSTED/);
 assert.equal(a.reviewSyntheticOutcome(ticket,{expectedCount:1,receipts:receipts(1)}).mode,
  'READY_FOR_PREVIEW_FINALIZE');
 await a.finalizePreview(ticket);
 await assert.rejects(a.finalizePreview(ticket),/INBOUND_GATE_FINALIZE_NOT_ALLOWED/);
});

test('two simultaneous finalize calls cannot both win even with mocked successful receipts',async()=>{
 const {gate,model}=make();
 const ticket=await gate.reserve(event());
 gate.reviewSyntheticOutcome(ticket,{expectedCount:1,receipts:receipts(1)});
 const responses=await Promise.allSettled([gate.finalizePreview(ticket),gate.finalizePreview(ticket)]);
 assert.equal(responses.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(responses.filter(x=>x.status==='rejected').length,1);
 assert.deepEqual(model.simulatedStatuses(),['PREVIEW_READY']);
});

test('failed finalization rolls back and requires reconciliation before any next attempt',async()=>{
 const {gate,model}=make();
 const ticket=await gate.reserve(event());
 gate.reviewSyntheticOutcome(ticket,{expectedCount:1,receipts:receipts(1)});
 model.injectRollbackOnce();
 await assert.rejects(gate.finalizePreview(ticket),/TEST_TRANSACTION_ROLLED_BACK/);
 assert.deepEqual(model.simulatedStatuses(),['CLAIMED']);
 await assert.rejects(gate.finalizePreview(ticket),/INBOUND_GATE_FINALIZE_NOT_ALLOWED/);
 assert.equal((await gate.reserve(event())).mode,'DUPLICATE_HOLD');
});

test('same event hash never leaks across trusted Page, sender, store or tenant',async()=>{
 const {gate,model}=make();
 for(const proof of [
  trusted(),trusted({pageId:'98765432109876543'}),
  trusted({recipientPsid:'66666666666666666'}),
  trusted({storeId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'}),
  trusted({tenantId:'22222222-2222-4222-8222-222222222222'})
 ]){
  assert.equal((await gate.reserve(event({trusted:proof}))).mode,'CLAIM_RESERVED_DRY_RUN');
 }
 assert.equal(model.diagnostics().rowCount,5);
});

test('the gate exposes no transport, Meta or order authorization for production',()=>{
 const {gate}=make();
 assert.deepEqual(gate.readiness,{
  mode:'SYNTHETIC_QA_ONLY',
  connectedToLiveMessenger:false,
  backedByHostedPostgres:false,
  hostedRlsVerified:false,
  realMetaSendEnabled:false,
  orderWritesEnabled:false,
  automaticRetryEnabled:false
 });
});
