'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {VERIFIED_SCOPE,assessSmokeReceipt}=require('./one-case-receipt-gate.cjs');
const ok=()=>({
 workflowId:VERIFIED_SCOPE.workflowId,executionId:'4025',
 status:'success',model:'gpt-5-nano',
 tool:'QA_Catalog_Read_Only',shop:'QA_SHOP_A',sku:'A002',
 quantity:2,unitPriceVnd:159000,totalVnd:318000,stock:25,
 providerSends:0,hostedWrites:0,
 caseTag:'SMOKE_QA_A002_2_NOT_DATASET_CASE',
 source:'MANUAL_N8N_QA_WORKFLOW',gatewayCostUsd:null
});
function assertBlocked(r,reason){
 assert.equal(r.status,'BLOCKED');assert.equal(r.reason,reason);
 assert.equal(r.canRun132,false);assert.equal(r.canSend,false);
 assert.equal(r.benchmarkCasesCompleted,0);
}
test('one corrected successful n8n single-case smoke receipt shape (not model quality score)',()=>{
 const r=assessSmokeReceipt(ok());
 assert.equal(r.status,'SANITIZED_SMOKE_RECEIPT_SHAPE_READY_NOT_BENCHMARK');
 assert.equal(r.workflowId,'PPJpr1bd9LxhOI6U');
 assert.equal(r.successfulExecutionId,'4025');
 assert.equal(r.syntheticQuoteVnd,318000);
 assert.equal(r.toolObserved,'QA_Catalog_Read_Only');
 assert.equal(r.actualGatewayCostUsd,null);
 assert.equal(r.canRun132,false);
 assert.equal(r.benchmarkCasesCompleted,0);
 assert.equal(r.realCostVerified,false);
 assert.equal(r.canSend,false);
});
test('first run #4024 toolCallId schema failure MUST NOT be converted to success',()=>{
 const r=ok();r.executionId='4024';r.status='error';
 assertBlocked(assessSmokeReceipt(r),'EXECUTION_OR_NO_SEND_SCOPE_MISMATCH');
});
for(const [label,field,value] of [
 ['wrong execution','executionId','4100'],
 ['wrong workflow','workflowId','production_messenger'],
 ['wrong model','model','gpt-6-luna'],
 ['wrong tool','tool','Create Order Tool'],
 ['wrong Shop','shop','QA_SHOP_B'],
 ['wrong SKU','sku','A004'],
 ['wrong qty','quantity',3],
 ['wrong price','unitPriceVnd',209000],
 ['wrong total','totalVnd',0],
 ['wrong stock','stock',0],
 ['false provider send','providerSends',1],
 ['false hosted write','hostedWrites',1],
 ['falsified dataset case','caseTag','QA01'],
 ['claimed invoice amount','gatewayCostUsd',0],
 ['fake source','source','USER_BROWSER']
]){
 test(label+' forbidden',()=>{
  const r=ok();r[field]=value;
  assertBlocked(assessSmokeReceipt(r),'EXECUTION_OR_NO_SEND_SCOPE_MISMATCH');
 });
}
test('no private raw response/prompt/tool args in CI artifacts',()=>{
 const r=ok();r.modelAnswer='PHONE=0901234567';
 assertBlocked(assessSmokeReceipt(r),'RAW_OR_EXTRA_FIELDS_REJECTED');
});
test('raw tool call ID must be excluded',()=>{
 const r=ok();r.toolCallId='call_hidden';
 assertBlocked(assessSmokeReceipt(r),'RAW_OR_EXTRA_FIELDS_REJECTED');
});
test('missing billing evidence never yields a verified cost',()=>{
 const r=assessSmokeReceipt(ok());
 assert.equal(r.realCostVerified,false);
 assert.equal(r.actualGatewayCostUsd,null);
});
test('no receipt cannot authorize benchmark',()=>{
 assertBlocked(assessSmokeReceipt(null),'INVALID_RECEIPT');
});
