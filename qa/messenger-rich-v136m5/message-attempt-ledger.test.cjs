'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createMessageAttemptLedgerCandidate,SQL}=require('./message-attempt-ledger.cjs');
const {createSyntheticMessageLedgerModel}=require('./synthetic-message-ledger-model.cjs');

const KEY='LOCAL_SYNTHETIC_HMAC_FOR_LEDGER_NOT_FOR_PRODUCTION_404';
const NOW=Date.parse('2026-11-22T12:00:00.000Z'),time=()=>NOW;
const TA='11111111-1111-4111-8111-111111111111';
const TB='22222222-2222-4222-8222-222222222222';
const SA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PA='12345678901234567',PB='98765432109876543';
const PSID='55555555555555555';
const claimTicket=Object.freeze({
 mode:'CLAIM_RESERVED_DRY_RUN',sendAllowed:false,retryAllowed:false,
 orderWriteAllowed:false
});
const trusted=patch=>({
 source:'SERVER_VERIFIED_MESSENGER_BINDING',serverDerived:true,verified:true,
 tenantId:TA,storeId:SA,pageId:PA,recipientPsid:PSID,bindingVersion:3,...patch
});
const replayKey='c'.repeat(64);
const bodies=n=>['a','b','d'].slice(0,n).map(c=>c.repeat(64));
const input=(n=1,patch={})=>({
 claimTicket,trusted:trusted(),replayKey,partDigests:bodies(n),...patch
});
const make=(model=createSyntheticMessageLedgerModel())=>({
 model,ledger:createMessageAttemptLedgerCandidate({
  mode:'SYNTHETIC_SQL_QA_ONLY',driver:model.client(),secret:KEY,now:time
 })
});
const receipt=(n=1,recipient=PSID)=>({
 recipient_id:recipient,message_id:'synthetic.provider.mid.'+n
});
const reserve=async(l,t,n)=>l.reserveMockPart(t,n);
const accept=async(l,a,n)=>l.inspectSyntheticReceipt(a,{
 outcome:'SYNTHETIC_API_ACCEPTED',receipt:receipt(n)
});

test('default, hosted and live send modes are rejected before any transaction',()=>{
 assert.throws(()=>createMessageAttemptLedgerCandidate(),/LEDGER_HOSTED_NOT_APPROVED/);
 const m=createSyntheticMessageLedgerModel();
 assert.throws(()=>createMessageAttemptLedgerCandidate({
  mode:'LIVE_SEND',driver:m.client(),secret:KEY
 }),/LEDGER_HOSTED_NOT_APPROVED/);
 assert.equal(m.diagnostics().plannedEvents,0);
});
test('requires synthetic no-external-writes driver, scoped proof and strong HMAC secret',async()=>{
 const m=createSyntheticMessageLedgerModel();
 assert.throws(()=>createMessageAttemptLedgerCandidate({
  mode:'SYNTHETIC_SQL_QA_ONLY',driver:{...m.client(),externalWrites:true},secret:KEY
 }),/LEDGER_DRIVER_NOT_APPROVED/);
 assert.throws(()=>createMessageAttemptLedgerCandidate({
  mode:'SYNTHETIC_SQL_QA_ONLY',driver:m.client(),secret:'weak'
 }),/LEDGER_HMAC_SECRET_REQUIRED/);
 const {ledger}=make(m);
 await assert.rejects(ledger.prepare(input(1,{trusted:trusted({verified:false})})),
  /PRIVATE_EVENT_SCOPE_UNVERIFIED/);
 assert.equal(m.diagnostics().plannedEvents,0);
});
test('refuses forged/released claim tickets, invalid body digest and part counts',async()=>{
 const {model,ledger}=make();
 for(const ticket of [{...claimTicket,sendAllowed:true},
  {...claimTicket,mode:'REAL_SEND'},undefined]){
  await assert.rejects(ledger.prepare(input(1,{claimTicket:ticket})),
   /LEDGER_CLAIM_QA_TICKET_REQUIRED/);
 }
 for(const bad of [[],bodies(3).concat('b'.repeat(64)),
  ['not sha256'],[1],null]){
  await assert.rejects(ledger.prepare(input(1,{partDigests:bad})),
   /LEDGER_BODY_DIGESTS_INVALID/);
 }
 assert.equal(model.diagnostics().plannedEvents,0);
});
test('first plan wins; same inbound with modified bodies is held instead of overwritten',async()=>{
 const {ledger,model}=make();
 const first=await ledger.prepare(input(2));
 const duplicate=await ledger.prepare(input(2,{partDigests:['a','f'].map(c=>c.repeat(64))}));
 assert.equal(first.status,'PLAN_PREPARED_DRY_RUN');
 assert.equal(duplicate.status,'DUPLICATE_PLAN_HOLD');
 assert.equal(first.sendAllowed,false);
 assert.equal(duplicate.retryAllowed,false);
 assert.equal(model.diagnostics().parts,2);
 assert.doesNotMatch(JSON.stringify(first),new RegExp(PSID));
 assert.doesNotMatch(JSON.stringify(first),/lease|token|secret|plan_id/i);
});
test('50 concurrent synthetic planners on one inbound event yield one plan and 3 parts',async()=>{
 const m=createSyntheticMessageLedgerModel();
 const ledgers=Array.from({length:50},()=>make(m).ledger);
 const out=await Promise.all(ledgers.map(l=>l.prepare(input(3))));
 assert.equal(out.filter(x=>x.status==='PLAN_PREPARED_DRY_RUN').length,1);
 assert.equal(out.filter(x=>x.status==='DUPLICATE_PLAN_HOLD').length,49);
 assert.equal(m.diagnostics().parts,3);
});
test('1, 2 and 3-part mock plans reserve once, record receipts and close once',async()=>{
 for(const n of [1,2,3]){
  const {ledger,model}=make();
  const plan=await ledger.prepare(input(n));
  const attempts=[];
  for(let part=1;part<=n;part++){
   const a=await reserve(ledger,plan,part);
   attempts.push(a);
   assert.equal(a.status,'MAY_HAVE_SENT_HOLD');
   assert.equal(a.sendAllowed,false);
   assert.equal(a.retryAllowed,false);
   assert.equal((await reserve(ledger,plan,part)).status,'ALREADY_RESERVED_HOLD');
   const r=await accept(ledger,a,part);
   assert.equal(r.status,'API_ACCEPTED_MOCK');
   assert.equal(r.providerAccepted,false);
   assert.equal(r.delivered,false);
  }
  const done=await ledger.closeMockPlan(plan);
  assert.equal(done.status,'MOCK_PARTS_ACCEPTED');
  assert.equal(done.sendAllowed,false);
  assert.equal(done.providerAccepted,false);
  assert.equal(model.diagnostics().statuses.filter(x=>x==='API_ACCEPTED_MOCK').length,n);
  await assert.rejects(ledger.closeMockPlan(plan),/LEDGER_PLAN_CLOSURE_NOT_ALLOWED/);
  assert.equal((await ledger.prepare(input(n))).status,'DUPLICATE_PLAN_HOLD');
 }
});
test('partial 1/3 accepted cannot close, missing 2 parts remain PLANNED',async()=>{
 const {ledger,model}=make();
 const p=await ledger.prepare(input(3));
 const a=await reserve(ledger,p,1);await accept(ledger,a,1);
 await assert.rejects(ledger.closeMockPlan(p),/LEDGER_PARTIAL_OR_UNCERTAIN_HOLD/);
 assert.deepEqual(model.diagnostics().statuses,
  ['API_ACCEPTED_MOCK','PLANNED','PLANNED']);
 await assert.rejects(ledger.closeMockPlan(p),/LEDGER_PLAN_CLOSURE_NOT_ALLOWED/);
});
test('partial 2/3 accepted then timeout on final part requires reconciliation',async()=>{
 const {ledger,model}=make();
 const p=await ledger.prepare(input(3));
 for(let n=1;n<=2;n++)await accept(ledger,await reserve(ledger,p,n),n);
 const last=await reserve(ledger,p,3);
 const r=await ledger.inspectSyntheticReceipt(last,{
  outcome:'TIMEOUT_UNKNOWN',receipt:receipt(3)});
 assert.equal(r.status,'UNCERTAIN_HOLD');
 assert.equal(r.needsReconciliation,true);
 assert.equal(r.retryAllowed,false);
 assert.deepEqual(model.diagnostics().statuses,
  ['API_ACCEPTED_MOCK','API_ACCEPTED_MOCK','UNCERTAIN_HOLD']);
 await assert.rejects(ledger.closeMockPlan(p),/LEDGER_PARTIAL_OR_UNCERTAIN_HOLD/);
 assert.equal((await reserve(ledger,p,3)).status,'ALREADY_RESERVED_HOLD');
});
test('timeout after hypothetical remote success stays uncertain; no auto resend',async()=>{
 const {ledger,model}=make();
 const p=await ledger.prepare(input());
 const a=await reserve(ledger,p,1);
 const result=await ledger.inspectSyntheticReceipt(a,{
  outcome:'TIMEOUT_UNKNOWN',receipt:receipt(1)});
 assert.equal(result.status,'UNCERTAIN_HOLD');
 assert.equal((await reserve(ledger,p,1)).status,'ALREADY_RESERVED_HOLD');
 assert.deepEqual(model.diagnostics().statuses,['UNCERTAIN_HOLD']);
 await assert.rejects(ledger.inspectSyntheticReceipt(a,{
  outcome:'SYNTHETIC_API_ACCEPTED',receipt:receipt(1)}),/LEDGER_ATTEMPT_NOT_RESERVED/);
});
test('missing, forged recipient, overlong and absent MID enter irreversible hold',async()=>{
 for(const patch of [
  {recipient_id:'66666666666666666',message_id:'x'},
  {recipient_id:PSID},{recipient_id:PSID,message_id:''},
  {recipient_id:PSID,message_id:'m'.repeat(251)},null
 ]){
  const {ledger,model}=make();
  const p=await ledger.prepare(input());
  const a=await reserve(ledger,p,1);
  const x=await ledger.inspectSyntheticReceipt(a,{
   outcome:'SYNTHETIC_API_ACCEPTED',receipt:patch});
  assert.equal(x.status,'UNCERTAIN_HOLD');
  assert.deepEqual(model.diagnostics().statuses,['UNCERTAIN_HOLD']);
 }
});
test('same provider MID reused across distinct parts fails unique and stays pending hold',async()=>{
 const {ledger,model}=make();
 const p=await ledger.prepare(input(2));
 await accept(ledger,await reserve(ledger,p,1),1);
 const second=await reserve(ledger,p,2);
 await assert.rejects(ledger.inspectSyntheticReceipt(second,{
  outcome:'SYNTHETIC_API_ACCEPTED',receipt:receipt(1)
 }),/LEDGER_PROVIDER_MID_UNIQUE_CONFLICT/);
 assert.deepEqual(model.diagnostics().statuses,
  ['API_ACCEPTED_MOCK','MAY_HAVE_SENT_HOLD']);
 await assert.rejects(ledger.inspectSyntheticReceipt(second,{
  outcome:'SYNTHETIC_API_ACCEPTED',receipt:receipt(2)
 }),/LEDGER_ATTEMPT_NOT_RESERVED/);
 await assert.rejects(ledger.closeMockPlan(p),/LEDGER_PARTIAL_OR_UNCERTAIN_HOLD/);
});
test('wrong order, zero index, fourth index and fake tickets cannot acquire part lease',async()=>{
 const {ledger,model}=make();
 const p=await ledger.prepare(input(2));
 for(const n of [0,-1,3,1.2,'2',null])
  await assert.rejects(ledger.reserveMockPart(p,n),/LEDGER_PART_INDEX_INVALID/);
 await assert.rejects(ledger.reserveMockPart({...p},1),/LEDGER_PLAN_TICKET_INVALID/);
 assert.deepEqual(model.diagnostics().statuses,['PLANNED','PLANNED']);
});
test('double concurrent receipt observation records at most one part acknowledgement',async()=>{
 const {ledger,model}=make();
 const p=await ledger.prepare(input());
 const a=await reserve(ledger,p,1);
 const results=await Promise.allSettled([
  accept(ledger,a,1),accept(ledger,a,1)
 ]);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(results.filter(x=>x.status==='rejected').length,1);
 assert.deepEqual(model.diagnostics().statuses,['API_ACCEPTED_MOCK']);
});
test('worker-like loss of attempt ticket after reservation never reopens part',async()=>{
 const m=createSyntheticMessageLedgerModel();
 const old=make(m).ledger;
 const p=await old.prepare(input());
 await reserve(old,p,1); // simulate crash before recording receipt
 const restarted=make(m).ledger;
 await assert.rejects(restarted.reserveMockPart(p,1),/LEDGER_PLAN_TICKET_INVALID/);
 assert.deepEqual(m.diagnostics().statuses,['MAY_HAVE_SENT_HOLD']);
 assert.equal((await restarted.prepare(input())).status,'DUPLICATE_PLAN_HOLD');
 assert.equal(m.diagnostics().durable,false);
});
test('transaction rollback while reserving creates no fake successful attempt',async()=>{
 const {ledger,model}=make();
 const p=await ledger.prepare(input());
 model.rollbackNext();
 await assert.rejects(reserve(ledger,p,1),/LEDGER_MODEL_ROLLBACK/);
 assert.deepEqual(model.diagnostics().statuses,['PLANNED']);
 assert.equal((await reserve(ledger,p,1)).status,'MAY_HAVE_SENT_HOLD');
});
test('transaction error recording Meta receipt cannot authorize retries',async()=>{
 const {ledger,model}=make();
 const p=await ledger.prepare(input());
 const a=await reserve(ledger,p,1);
 model.rollbackNext();
 await assert.rejects(accept(ledger,a,1),/LEDGER_MODEL_ROLLBACK/);
 assert.deepEqual(model.diagnostics().statuses,['MAY_HAVE_SENT_HOLD']);
 await assert.rejects(accept(ledger,a,1),/LEDGER_ATTEMPT_NOT_RESERVED/);
 assert.equal((await reserve(ledger,p,1)).status,'ALREADY_RESERVED_HOLD');
});
test('different Store, tenant, Page, sender or incoming MID have separate plans',async()=>{
 const {ledger,model}=make();
 for(const patch of [
  {},{trusted:trusted({storeId:SB})},
  {trusted:trusted({tenantId:TB})},
  {trusted:trusted({pageId:PB})},
  {trusted:trusted({recipientPsid:'66666666666666666'})},
  {replayKey:'f'.repeat(64)}
 ]){
  assert.equal((await ledger.prepare(input(1,patch))).status,'PLAN_PREPARED_DRY_RUN');
 }
 assert.equal(model.diagnostics().plannedEvents,6);
});
test('API acceptance mocks are not provider delivered/read receipts or send authority',async()=>{
 const {ledger}=make();
 assert.deepEqual(ledger.readiness,{
  mode:'SYNTHETIC_SQL_QA_ONLY',hostedReady:false,outboxDeployed:false,
  providerSendEnabled:false,autoRetryEnabled:false,
  orderWritesEnabled:false,notProviderDeliveryProof:true
 });
 const p=await ledger.prepare(input());
 const a=await reserve(ledger,p,1);
 const r=await accept(ledger,a,1);
 assert.equal(r.providerAccepted,false);
 assert.equal(r.delivered,false);
 assert.equal(r.read,false);
 assert.equal(r.sendAllowed,false);
});
test('SQL explicitly enforces UNIQUE event plan, per-part lease and full mock close',()=>{
 assert.match(SQL.plan,/ON CONFLICT \(tenant_id,store_id,page_id,sender_hash,binding_version,event_hash\) DO NOTHING/);
 assert.match(SQL.plan,/generate_series\(1,\$9::int\)/);
 assert.match(SQL.reserve,/status='PLANNED'/);
 assert.match(SQL.reserve,/status='MAY_HAVE_SENT_HOLD'/);
 assert.match(SQL.accept,/attempt_id=\$3::uuid/);
 assert.match(SQL.accept,/status='MAY_HAVE_SENT_HOLD'/);
 assert.match(SQL.uncertain,/status='UNCERTAIN_HOLD'/);
 assert.match(SQL.close,/count\(\*\).*API_ACCEPTED_MOCK/);
 assert.doesNotMatch(JSON.stringify(SQL),/service_role|api_key|access_token|recipient_psid/i);
});
test('test-only diagnostics store hashed scopes, never PSID or webhook payloads',async()=>{
 const {ledger,model}=make();
 const p=await ledger.prepare(input(2));
 await reserve(ledger,p,1);
 const snapshot=JSON.stringify(model.diagnostics());
 assert.doesNotMatch(snapshot,new RegExp(PSID));
 assert.doesNotMatch(snapshot,/page_access_token|message_text|customer_name|secret/i);
 assert.equal(model.diagnostics().externalWrites,false);
});
