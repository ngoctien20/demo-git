'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {CONTRACT,evaluate,planPaidPilot,invokePaidVision}
 =require('./vision-model-benchmark-gate.cjs');
const scope={tenantId:'T_QA_01',storeId:'S_QA_A'};
const known=[{...scope,itemId:'P_A_001',sku:'QA-F-001'},
 {...scope,itemId:'P_A_002',sku:'QA-F-002'}];
const labels=[
 {...scope,caseId:'one',expectedItemId:'P_A_001',labelType:'positive'},
 {...scope,caseId:'two',expectedItemId:'P_A_002',labelType:'positive'},
 {...scope,caseId:'unknown',expectedItemId:null,labelType:'unknown'},
 {...scope,caseId:'lookalike',expectedItemId:null,labelType:'hard_negative'}];
const c=(itemId,score=0.9)=>({
 ...scope,itemId,sku:known.find(x=>x.itemId===itemId)?.sku||'QA-UNKNOWN',score});
const outputs=[
 {caseId:'one',candidates:[c('P_A_001')],latencyMs:200,costMicroUsd:5},
 {caseId:'two',candidates:[c('P_A_002')],latencyMs:300,costMicroUsd:5},
 {caseId:'unknown',candidates:[],latencyMs:150,costMicroUsd:5},
 {caseId:'lookalike',candidates:[c('P_A_001',0.85)],latencyMs:350,costMicroUsd:5}
];
const run=(extra={})=>evaluate({...scope,knownItems:known,cases:labels,
 predictions:outputs,topK:3,...extra});
test('01 synthetic benchmark shows explicit lookalike false-positive',()=>{
 const r=run();
 assert.equal(r.status,'METRICS_ONLY_NOT_REAL_MODEL_ATTESTATION');
 assert.equal(r.recallAt1,1);assert.equal(r.recallAtK,1);
 assert.equal(r.falsePositiveRate,0.5);
});
test('02 P50/P95 latency and summed synthetic claimed cost computed',()=>{
 const r=run();assert.equal(r.latencyP50Ms,200);
 assert.equal(r.latencyP95Ms,350);assert.equal(r.claimedCostMicroUsd,20);
});
test('03 arbitrary model outputs never prove actual model call',()=>{
 const r=run();assert.equal(r.actualPaidModelCallsMadeHere,0);
 assert.equal(r.originalModelReceiptVerifiedHere,false);
 assert.equal(r.actualMerchantPhotosVerifiedHere,false);
 assert.equal(r.modelAccuracyCertified,false);
});
test('04 cross-Store candidate cannot pass evaluator',()=>{
 const altered=outputs.map(x=>({...x,candidates:x.candidates.slice()}));
 altered[0].candidates=[{...c('P_A_001'),storeId:'S_QA_B'}];
 assert.equal(run({predictions:altered}).status,'INVALID_OR_UNSAFE_PREDICTIONS');
});
test('05 invented item ID rejected in model candidates',()=>{
 const altered=outputs.map(x=>({...x,candidates:x.candidates.slice()}));
 altered[0].candidates=[{...scope,itemId:'PRODUCT_HALLUCINATION',sku:'QA-FAKE',score:1}];
 assert(run({predictions:altered}).issues.includes('UNTRUSTED_OR_CROSS_STORE_MODEL_CANDIDATE'));
});
test('06 wrong SKU for a valid ID rejected',()=>{
 const altered=outputs.map(x=>({...x,candidates:x.candidates.slice()}));
 altered[0].candidates=[{...c('P_A_001'),sku:'QA-F-002'}];
 assert.equal(run({predictions:altered}).status,'INVALID_OR_UNSAFE_PREDICTIONS');
});
test('07 low confidence is still a hypothesis, never an order authority',()=>{
 const altered=outputs.map(x=>({...x,candidates:x.candidates.slice()}));
 altered[0].candidates=[c('P_A_001',0.01)];
 const r=run({predictions:altered});
 assert.equal(r.canUseForCommercialDecisions,false);
 assert.equal(r.providerSends,0);
});
test('08 malformed case labels or out-of-scope store are refused',()=>{
 assert.throws(()=>run({cases:[{...labels[0],storeId:'S_QA_B'}]}),
 /BENCHMARK_SCOPE_OR_CASE_COUNT_INVALID|BENCHMARK_LABEL_SCOPE_INVALID/);
});
test('09 all-negative benchmark cannot claim recall',()=>{
 const subset=[labels[2],labels[3]];
 const pred=[outputs[2],outputs[3]];
 const r=run({cases:subset,predictions:pred});
 assert.equal(r.status,'INVALID_OR_UNSAFE_PREDICTIONS');
 assert.equal(r.recallAt1,null);
});
test('10 duplicate model candidate ID causes invalid prediction',()=>{
 const alt=outputs.map(x=>({...x,candidates:x.candidates.slice()}));
 alt[0].candidates=[c('P_A_001'),c('P_A_001')];
 assert(run({predictions:alt}).issues.includes('UNTRUSTED_OR_CROSS_STORE_MODEL_CANDIDATE'));
});
test('11 unpriced or invalid latency model outcome rejected',()=>{
 const alt=outputs.map(x=>({...x}));alt[0].costMicroUsd=-1;
 assert.throws(()=>run({predictions:alt}),/BENCHMARK_MODEL_OUTPUT_FORMAT_INVALID/);
});
test('12 estimated upper spend with no balance evidence is NO-GO',()=>{
 const p=planPaidPilot({exactApprovedCaseCount:10,
 estimatedMaxMicroUsdPerCase:10,approvedBudgetMicroUsd:500});
 assert.equal(p.status,'PAID_VISION_NO_GO');
 assert.equal(p.canInvokePaidModel,false);
});
test('13 even claimed full budget package never authorizes paid model call',()=>{
 const p=planPaidPilot({exactApprovedCaseCount:10,
  estimatedMaxMicroUsdPerCase:10,approvedBudgetMicroUsd:100,
  balanceMicroUsd:100,primaryMerchantRightsEvidence:true,
  independentSecurityAttestation:true,providerBillingAccountAttestation:true,
  authorizedOneAction:true,actualModelVersion:'verified-model-version',
  privateMediaScopeVerified:true});
 assert.equal(p.status,'CLAIMED_BUDGET_PACKET_REQUIRES_PRIVATE_INDEPENDENT_APPROVAL');
 assert.equal(p.canInvokePaidModel,false);
 assert.equal(p.actualBalanceCheckedByThisModule,false);
});
test('14 underquoted budget or balance cannot pass',()=>{
 const p=planPaidPilot({exactApprovedCaseCount:20,
  estimatedMaxMicroUsdPerCase:15,approvedBudgetMicroUsd:200,
  balanceMicroUsd:180});
 assert(p.issues.includes('MAX_ESTIMATED_SPEND_EXCEEDS_REPORTED_BUDGET_OR_BALANCE'));
});
test('15 source does not implement provider send/inference',()=>{
 assert.throws(()=>invokePaidVision(),/SEPARATE_APPROVED_SERVER_ADAPTER/);
 assert.equal(CONTRACT,'T404_V171E_VISION_BENCHMARK_AND_COST_GATE_V1');
});
