'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {assessment,APPROVED_CAP_USD,EXPECTED_DATASETS,REQUIRED_GATE_NAMES}=
 require('./gateway-hard-cap-certification.cjs');
const basic=()=>({
 contract:'TIEN404_V15_0_10D',financialApprovalUsd:1,targetCases:132,
 targetTurns:167,datasetSingleSha:EXPECTED_DATASETS.single,
 datasetMultiSha:EXPECTED_DATASETS.multi,environment:'QA_NO_SEND',
 publishedWorkflowMutation:false,
 gates:Object.fromEntries(REQUIRED_GATE_NAMES.map(k=>[k,false]))
});
function blocked(evidence,reason){
 const r=assessment(evidence);
 assert.equal(r.status,'BLOCKED');
 assert.equal(r.reason,reason);
 assert.equal(r.approved_budget_usd,1);
 assert.equal(r.allowed_provider_spend_usd,0);
 assert.equal(r.can_call_model,false);
 assert.equal(r.can_execute_benchmark,false);
 assert.equal(r.hosted_writes_allowed,false);
 assert.equal(r.production_allowed,false);
 assert.equal(r.real_hard_limit_certified,false);
 return r;
}
test('user approval is exactly $1 not unbounded',()=>{
 assert.equal(APPROVED_CAP_USD,1);
 assert.equal(blocked(null,'PRIVATE_GATEWAY_CAP_PROOF_MISSING').target_cases,132);
 assert.equal(blocked(null,'PRIVATE_GATEWAY_CAP_PROOF_MISSING').target_customer_turns,167);
});
test('no verified gateway receipts must fail closed',()=>{
 const r=blocked(basic(),'GATEWAY_HARD_CAP_NOT_CERTIFIED');
 assert.equal(r.missing_gates.length,REQUIRED_GATE_NAMES.length);
});
test('even user text saying all gates PASS is not cryptographic provider authority',()=>{
 const e=basic();for(const k of REQUIRED_GATE_NAMES)e.gates[k]=true;
 const r=blocked(e,'SELF_REPORTED_GATEWAY_RECEIPTS_NOT_AUTHORITY');
 assert.equal(r.gates_with_untrusted_boolean_assertions,REQUIRED_GATE_NAMES.length);
 assert.equal(r.private_gateway_credit_source_verified,false);
});
test('existing n8n gateway listed as available cannot be treated as spend cap',()=>{
 const e=basic();e.gates.PRIVATE_GATEWAY_BALANCE_VERIFIED=true;
 const r=blocked(e,'GATEWAY_HARD_CAP_NOT_CERTIFIED');
 assert.ok(r.missing_gates.includes('EXCLUSIVE_ATOMIC_ONE_USD_HARD_STOP_CERTIFIED'));
});
test('price list alone is not actual charge evidence',()=>{
 const e=basic();e.gates.GATEWAY_PRICE_PER_MODEL_VERIFIED=true;
 const r=blocked(e,'GATEWAY_HARD_CAP_NOT_CERTIFIED');
 assert.ok(r.missing_gates.includes('IN_FLIGHT_CREDIT_OVERDRAW_CAPPED'));
});
test('must isolate credit balance from other workflows',()=>{
 const e=basic();
 for(const k of REQUIRED_GATE_NAMES)e.gates[k]=true;
 e.gates.NO_OTHER_WORKFLOWS_CAN_CONSUME_RESERVED_BENCHMARK_CREDIT=false;
 const r=blocked(e,'GATEWAY_HARD_CAP_NOT_CERTIFIED');
 assert.ok(r.missing_gates.includes('NO_OTHER_WORKFLOWS_CAN_CONSUME_RESERVED_BENCHMARK_CREDIT'));
});
test('in-flight requests can overdraw credit so gate must remain closed',()=>{
 const e=basic();for(const k of REQUIRED_GATE_NAMES)e.gates[k]=true;
 e.gates.IN_FLIGHT_CREDIT_OVERDRAW_CAPPED=false;
 const r=blocked(e,'GATEWAY_HARD_CAP_NOT_CERTIFIED');
 assert.ok(r.missing_gates.includes('IN_FLIGHT_CREDIT_OVERDRAW_CAPPED'));
});
test('missing input remains blocked',()=>{blocked(undefined,'PRIVATE_GATEWAY_CAP_PROOF_MISSING')});
for(const [label,key,wrong] of [
 ['wrong contract','contract','PRODUCTION_REQUEST'],
 ['wrong USD cap','financialApprovalUsd',2],
 ['zero USD budget','financialApprovalUsd',0],
 ['unbounded USD budget','financialApprovalUsd',Infinity],
 ['wrong number of cases','targetCases',133],
 ['wrong turn count','targetTurns',132],
 ['different private single SHA','datasetSingleSha','0'.repeat(64)],
 ['different private multi SHA','datasetMultiSha','0'.repeat(64)],
 ['production environment','environment','PRODUCTION']
]){
 test(label+' rejected',()=>{
  const e=basic();e[key]=wrong;
  blocked(e,'FINANCIAL_OR_DATASET_SCOPE_MISMATCH');
 });
}
test('published workflow mutation is not approved',()=>{
 const e=basic();e.publishedWorkflowMutation=true;
 blocked(e,'FINANCIAL_OR_DATASET_SCOPE_MISMATCH');
});
test('no private gateway proof object is insufficient',()=>{
 const e=basic();delete e.gates;
 blocked(e,'PRIVATE_VERIFIER_EVIDENCE_MISSING');
});
test('fake offline QA attestation cannot authorize paid requests',()=>{
 const e=basic();e.gates=Object.fromEntries(
  REQUIRED_GATE_NAMES.map(k=>[k,true]));
 e.operatorSignature='SIMULATED_APPROVAL';e.signedPrivateReceipt='FAKE';
 blocked(e,'SELF_REPORTED_GATEWAY_RECEIPTS_NOT_AUTHORITY');
});
test('missing true evidence for any single gate is blocked',()=>{
 for(const gate of REQUIRED_GATE_NAMES){
  const e=basic();for(const k of REQUIRED_GATE_NAMES)e.gates[k]=true;
  e.gates[gate]=false;
  const r=blocked(e,'GATEWAY_HARD_CAP_NOT_CERTIFIED');
  assert.deepEqual(r.missing_gates,[gate]);
 }
});
