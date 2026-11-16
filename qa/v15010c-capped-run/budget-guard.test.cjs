'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {budgetGate,CappedOfflineBudgetLedger,PRICE_USD_PER_M}=require('./budget-guard.cjs');
const defaults=()=>({
  model:'gpt-6-luna',budgetUsd:1,maxModelRequests:334,
  maxInputTokens:5000,maxOutputTokens:1200,
  gatewayMultiplier:2,readOnlyEnvironment:'DISPOSABLE_QA_ONLY',
  simulationOnly:true
});
const created=()=>new CappedOfflineBudgetLedger(defaults());

test('No numerical cap => blocked; verbal blanket approval alone never spent',()=>{
 const b=budgetGate({});
 assert.equal(b.status,'BLOCKED');assert.equal(b.reason,'EXPLICIT_NUMERIC_CAP_AND_TRUSTED_OPERATOR_REQUIRED');
 assert.equal(b.authorized_spend_usd,0);assert.equal(b.can_call_provider,false);
});
test('Synthetic config allowed to rehearse estimates, not call model',()=>{
 const r=budgetGate(defaults());
 assert.equal(r.status,'SIMULATED_CAP_REHEARSAL_READY_NOT_APPROVED');
 assert.equal(r.real_budget_operator_approval_verified,false);
 assert.equal(r.can_call_provider,false);assert.equal(r.can_write_hosted,false);
});
test('Model price metadata has no execution side effects',()=>{
 assert.equal(PRICE_USD_PER_M['gpt-6-luna'].input,0.10);
 assert.equal(PRICE_USD_PER_M['gpt-6-luna'].output,0.50);
 assert.equal(PRICE_USD_PER_M['gpt-5-nano'].deprecated,true);
});
for(const [name,edit] of [
 ['missing USD budget',c=>delete c.budgetUsd],
 ['zero budget',c=>c.budgetUsd=0],
 ['negative budget',c=>c.budgetUsd=-1],
 ['unbounded budget',c=>c.budgetUsd=Infinity],
 ['budget as client text',c=>c.budgetUsd='100'],
 ['invalid model',c=>c.model='whatever'],
 ['wrong environment',c=>c.readOnlyEnvironment='HOSTED_SUPABASE'],
 ['simulation disabled',c=>c.simulationOnly=false],
 ['missing requests limit',c=>delete c.maxModelRequests],
 ['negative requests',c=>c.maxModelRequests=-1],
 ['unbounded requests',c=>c.maxModelRequests=9999999],
 ['unbounded input',c=>c.maxInputTokens=200001],
 ['unbounded output',c=>c.maxOutputTokens=10001],
 ['gateway uplift not verified',c=>delete c.gatewayMultiplier],
 ['gateway multiplier under 1',c=>c.gatewayMultiplier=0],
 ['gateway multiplier too high',c=>c.gatewayMultiplier=11],
 ])test(name+' rejected',()=>{
 const c=defaults();edit(c);
 assert.equal(budgetGate(c).status,'BLOCKED',name);
});
test('Reserve one request and settle returned tokens without billing',()=>{
 const l=created(),r=l.reserve('single:QA01:turn0:attempt0',{declaredInputTokens:2000});
 assert.equal(r.status,'OFFLINE_RESERVATION_ONLY');
 assert.equal(r.can_call_provider,false);
 assert.ok(r.upperBoundUsd>0);
 const after=l.settle('single:QA01:turn0:attempt0',
  {inputTokens:2000,outputTokens:300,cachedTokens:200});
 assert.equal(after.status,'SIMULATED_SETTLED_NOT_BILLED');
 assert.equal(after.actualInvoiceUsd,null);assert.ok(after.estimatedCostUsd>0);
 const state=l.inspect();
 assert.equal(state.actualBilledUsd,null);
 assert.equal(state.requestsReserved,1);
 assert.equal(state.hardRealBillingCapCertified,false);
 assert.equal(state.estimatedOutstandingReservedUsd,0);
});
test('Duplicate request cannot reserve twice even before settlement',()=>{
 const l=created();l.reserve('single:QA01:turn0:attempt0',{declaredInputTokens:2000});
 const r=l.reserve('single:QA01:turn0:attempt0',{declaredInputTokens:2000});
 assert.equal(r.status,'BLOCKED');assert.equal(r.reason,'DUPLICATE_REQUEST_REF');
});
test('Second settlement refused to prevent double-spend accounting',()=>{
 const l=created();const id='single:QA01:turn0:attempt0';
 l.reserve(id,{declaredInputTokens:2000});
 l.settle(id,{inputTokens:2000,outputTokens:300});
 assert.equal(l.settle(id,{inputTokens:2000,outputTokens:300}).reason,'ALREADY_SETTLED');
});
test('Undeclared or oversized input must be blocked BEFORE simulated reserve',()=>{
 const l=created();
 assert.equal(l.reserve('single:QA01:turn0:attempt0').reason,'UNVERIFIED_OR_OVERSIZED_INPUT');
 assert.equal(l.reserve('single:QA01:turn0:attempt1',{declaredInputTokens:999999}).reason,
  'UNVERIFIED_OR_OVERSIZED_INPUT');
 assert.equal(l.inspect().requestsReserved,0);
});
test('Budget cap always prevents over-reserving',()=>{
 const c=defaults();c.budgetUsd=0.001;const l=new CappedOfflineBudgetLedger(c);
 let accepted=0;
 for(let i=0;i<15;i++){
  const r=l.reserve('qa:'+String(i).padStart(4,'0'),{declaredInputTokens:4000});
  if(r.status==='OFFLINE_RESERVATION_ONLY')accepted++;
  else assert.equal(r.reason,'INSUFFICIENT_REMAINING_BUDGET');
 }
 assert.ok(accepted<15);
 const s=l.inspect();
 assert.ok(s.estimatedSpentUsd+s.estimatedOutstandingReservedUsd<=c.budgetUsd+1e-8);
});
test('Max request cap blocks extra tool retries',()=>{
 const c=defaults();c.maxModelRequests=1;
 const l=new CappedOfflineBudgetLedger(c);
 assert.equal(l.reserve('QA-REQ-0001',{declaredInputTokens:100}).status,'OFFLINE_RESERVATION_ONLY');
 assert.equal(l.reserve('QA-REQ-0002',{declaredInputTokens:100}).reason,'REQUEST_LIMIT_REACHED');
});
test('Invalid observed usage halts further reservations',()=>{
 const l=created(),id='single:QA01:turn0:attempt0';
 l.reserve(id,{declaredInputTokens:1000});
 assert.equal(l.settle(id,{inputTokens:1000,outputTokens:1201}).reason,'INVALID_USAGE_EVIDENCE');
 assert.equal(l.reserve('single:QA01:turn0:attempt1',{declaredInputTokens:1000}).reason,
  'HALTED_INVALID_USAGE_EVIDENCE');
});
test('Explicit operator abort permanently blocks new ledger requests',()=>{
 const l=created();l.abort('PROVIDER_TOOL_SEND_DETECTED');
 assert.equal(l.reserve('QA-REQ-0001',{declaredInputTokens:100}).reason,
  'HALTED_PROVIDER_TOOL_SEND_DETECTED');
 assert.equal(l.inspect().status,'HALTED');
});
test('Unknown model request ref and malformed ref rejected',()=>{
 const l=created();
 assert.equal(l.reserve('?',{declaredInputTokens:100}).reason,'BAD_REQUEST_REFERENCE');
 assert.equal(l.settle('missing-qa-ref',{inputTokens:1,outputTokens:1}).reason,'UNKNOWN_REQUEST');
});
test('Over-billing caused by cached token count does not bypass safeguards',()=>{
 const l=created(),id='single:QA01:turn0:attempt0';
 l.reserve(id,{declaredInputTokens:1000});
 const r=l.settle(id,{inputTokens:1000,outputTokens:100,cachedTokens:1001});
 assert.equal(r.status,'BLOCKED');assert.equal(l.inspect().status,'HALTED');
});
