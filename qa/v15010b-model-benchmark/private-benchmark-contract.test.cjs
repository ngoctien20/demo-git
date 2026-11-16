'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {preparePlan,analyzeReceipts,percentile,PRICE,PINNED}=require('./private-benchmark-contract.cjs');
function plan(){
 return {status:'PRIVATE_DATASET_VERIFIED_NO_MODEL_RUN',expected_cases:2,
  expected_model_turns:3,
  cases:[{kind:'single',case_id:'QA01',turns:1},{kind:'multi',case_id:'QA01',turns:2}]};
}
function receipt(kind,turn_index,{model='gpt-5-nano',review='PASS',tool='PASS',hallucination='NO',input=1000,output=200,latency=1000}={}){
 return {kind,case_id:'QA01',turn_index,model,started_ms:10000,ended_ms:10000+latency,
  input_tokens:input,output_tokens:output,cached_input_tokens:0,retry_count:0,
  tool_call_count:1,review:{status:review,tool_accuracy:tool,hallucination}};
}
const good=()=>[receipt('single',0),receipt('multi',0),receipt('multi',1)];
test('pinned metadata from private user file, not synthetic public CSV',()=>{
 assert.equal(PINNED.single.count,96);assert.equal(PINNED.multi.count,36);
 assert.equal(PINNED.multi.turns,71);
 assert.match(PINNED.single.sha,/^[a-f0-9]{64}$/);
 assert.equal(PRICE['gpt-5-nano'].deprecated,true);
 assert.equal(PRICE['gpt-6-luna'].deprecated,false);
});
test('no input path means no model and no hidden scan',()=>{
 const r=preparePlan();
 assert.equal(r.status,'BLOCKED');assert.equal(r.model_calls_executed,0);
 assert.equal(r.actual_billed_cost_usd,null);
});
test('sha pin blocks replacement fake CSV before content display',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'t404-bench-'));
 try{
  fs.writeFileSync(path.join(dir,PINNED.single.name),'x\n');
  fs.writeFileSync(path.join(dir,PINNED.multi.name),'x\n');
  const r=preparePlan({singlePath:path.join(dir,PINNED.single.name),
    multiPath:path.join(dir,PINNED.multi.name)});
  assert.equal(r.status,'BLOCKED');assert.equal(r.reason,'PRIVATE_DATASET_SHA_MISMATCH');
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
test('offline receipt analyzer never certifies actual cost or quality',()=>{
 const r=analyzeReceipts(plan(),good(),{budgetUsd:1});
 assert.equal(r.status,'SUBMITTED_OFFLINE_RECEIPTS_UNVERIFIED');
 assert.equal(r.received_turns,3);assert.equal(r.expected_turns,3);
 assert.equal(r.fully_human_reviewed_cases,2);assert.equal(r.case_accuracy,1);
 assert.equal(r.actual_billed_cost_usd,null);assert.equal(r.real_model_quality_certified,false);
 assert.equal(r.can_call_paid_model,false);assert.equal(r.provider_sends,0);
 assert.equal(r.api_list_price_estimate_usd,0.00039);
 assert.equal(r.p50_ms,1000);assert.equal(r.p95_ms,1000);
});
test('missing second multi turn never gives 100 percent full suite accuracy',()=>{
 const r=analyzeReceipts(plan(),good().slice(0,2));
 assert.equal(r.case_accuracy,null);assert.equal(r.complete_case_turns,1);
 assert.equal(r.missing_turns,1);assert.equal(r.fully_human_reviewed_cases,1);
 assert.equal(r.budget_review,'ABOVE_REVIEW_CEILING');
});
test('unreviewed case does not imply PASS',()=>{
 const records=good();records[1].review.status='UNREVIEWED';
 const r=analyzeReceipts(plan(),records,{budgetUsd:1});
 assert.equal(r.case_accuracy,null);
 assert.equal(r.fully_human_reviewed_cases,1);
});
test('one failed turn causes multi case to fail only with full case review',()=>{
 const records=good();records[2].review.status='FAIL';
 const r=analyzeReceipts(plan(),records,{budgetUsd:1});
 assert.equal(r.case_accuracy,0.5);assert.equal(r.reviewed_case_pass_fraction,0.5);
});
test('independent rubric labels compute tools and hallucination only when present',()=>{
 const records=good();records[0].review.tool_accuracy='NOT_ASSESSED';
 records[1].review.hallucination='YES';records[2].review.tool_accuracy='FAIL';
 const r=analyzeReceipts(plan(),records,{budgetUsd:1});
 assert.equal(r.tool_accuracy_reviewed,0.5);
 assert.equal(r.hallucination_reviewed_fraction,1/3);
});
test('cached input USD rate applies on exact cached fraction',()=>{
 const records=good().slice(0,1);
 records[0].cached_input_tokens=500;
 const r=analyzeReceipts(plan(),records,{budgetUsd:1});
 assert.equal(r.api_list_price_estimate_usd,0.0001075);
});
test('GPT6 Luna list-price estimate uses different rate, no actual billing',()=>{
 const records=good().map(x=>({...x,model:'gpt-6-luna'}));
 const r=analyzeReceipts(plan(),records,{budgetUsd:1});
 assert.equal(r.api_list_price_estimate_usd,0.0006);
 assert.equal(r.actual_billed_cost_usd,null);
});
test('measured percentile interpolates small samples',()=>{
 assert.equal(percentile([4,10,20],0.5),10);
 assert.equal(percentile([4,10,20],0.95),19);
 assert.equal(percentile([],0.95),null);
});
function blocked(name,edit,reason){
 test(name,()=>{const rs=good();edit(rs);const r=analyzeReceipts(plan(),rs);
  assert.equal(r.status,'BLOCKED');assert.equal(r.reason,reason);
  assert.equal(r.actual_billed_cost_usd,null);
 });}
blocked('duplicate turn',r=>r.push({...r[0]}),'UNKNOWN_DUPLICATE_OR_OUT_OF_RANGE_TURN');
blocked('out of range turn',r=>r[1].turn_index=2,'UNKNOWN_DUPLICATE_OR_OUT_OF_RANGE_TURN');
blocked('unknown case',r=>r[1].case_id='QA99','UNKNOWN_DUPLICATE_OR_OUT_OF_RANGE_TURN');
blocked('raw chat message excluded from measurement',r=>r[0].chatInput='hello','RAW_TEXT_OR_UNSUPPORTED_MEASUREMENT_FIELD');
blocked('raw model output excluded from measurement',r=>r[0].output='Hello','RAW_TEXT_OR_UNSUPPORTED_MEASUREMENT_FIELD');
blocked('raw tool arguments excluded',r=>r[0].tool_arguments={password:'secret'},'RAW_TEXT_OR_UNSUPPORTED_MEASUREMENT_FIELD');
blocked('unknown model cost rate',r=>r[0].model='gpt-6-astra','UNKNOWN_MODEL_OR_PRICE');
blocked('negative tokens',r=>r[0].input_tokens=-1,'INVALID_MEASURED_USAGE');
blocked('fractional tool count',r=>r[0].tool_call_count=1.25,'INVALID_MEASURED_USAGE');
blocked('cached tokens more than input',r=>r[0].cached_input_tokens=2000,'INVALID_MEASURED_LATENCY');
blocked('negative latency',r=>r[0].ended_ms=0,'INVALID_MEASURED_LATENCY');
blocked('bad human review',r=>r[0].review.status='PRODUCTION_APPROVED','INVALID_OR_MISSING_HUMAN_REVIEW');
blocked('missing tool review',r=>delete r[0].review.tool_accuracy,'INVALID_OR_MISSING_HUMAN_REVIEW');
blocked('invalid hallucination judgement',r=>r[0].review.hallucination='MAYBE','INVALID_OR_MISSING_HUMAN_REVIEW');
test('bad parent plan cannot be promoted to actual model QA',()=>{
 const r=analyzeReceipts({...plan(),status:'BENCHMARK_LIVE_APPROVED'},good());
 assert.equal(r.status,'BLOCKED');
});
