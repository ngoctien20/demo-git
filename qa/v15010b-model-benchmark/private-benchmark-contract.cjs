'use strict';
/**
 * V15.0-10B — Private OFFLINE benchmark plan/receipt analyzer.
 *
 * NO model/network execution. Never accepts raw conversation/customer text in
 * a measurement receipt. Human labels are externally supplied and UNVERIFIED.
 * No metric is "accuracy for all cases" unless each case is fully reviewed.
 */
const fs=require('node:fs');
const crypto=require('node:crypto');
const {parseCsv}=require('../v15-model-lab/private-dataset-gate.cjs');
const PINNED=Object.freeze({
 single:Object.freeze({name:'AI_SALES_QA_96_SINGLE_TURN.csv',
  sha:'f266447e4be2a9a22733cfa81fb80ace8862d286752b15d2d6d1ffc77c9ba257',count:96}),
 multi:Object.freeze({name:'AI_SALES_36_MULTI_TURN_FOR_LATER.csv',
  sha:'8cfccde67964207e199dc20e911a9e6d4ebcbb8b1e2410526f3b40f5b8a2a1c4',count:36,turns:71})
});
const PRICE=Object.freeze({
 'gpt-5-nano':Object.freeze({usdPerMInput:0.05,usdPerMOutput:0.40,usdPerMCached:0.005,
  deprecated:true,source:'https://developers.openai.com/api/docs/models/gpt-5-nano'}),
 'gpt-6-luna':Object.freeze({usdPerMInput:0.10,usdPerMOutput:0.50,usdPerMCached:0.01,
  deprecated:false,source:'https://developers.openai.com/api/docs/pricing'})
});
function failure(reason){return Object.freeze({status:'BLOCKED',reason,
  model_calls_executed:0,provider_sends:0,hosted_writes:0,
  real_model_quality_certified:false,actual_billed_cost_usd:null});}
function preparePlan({singlePath,multiPath}={}){
 if(!singlePath||!multiPath)return failure('PRIVATE_INPUT_PATHS_REQUIRED');
 const plan={};
 for(const [k,p] of Object.entries({single:singlePath,multi:multiPath})){
  if(typeof p!=='string'||!p.endsWith('/'+PINNED[k].name)&&!p.endsWith('\\'+PINNED[k].name)&&p!==PINNED[k].name)
   return failure('PRIVATE_FILENAME_MISMATCH');
  let buf;try{buf=fs.readFileSync(p)}catch{return failure('PRIVATE_DATASET_NOT_READABLE')}
  if(crypto.createHash('sha256').update(buf).digest('hex')!==PINNED[k].sha)
   return failure('PRIVATE_DATASET_SHA_MISMATCH');
  let csv;try{csv=parseCsv(buf.toString('utf8'))}catch{return failure('INVALID_PRIVATE_CSV')}
  const head=k==='single'?['case_id','chatInput','expected_behavior','actual_output']:
    ['case_id','group','mode','turns_json','expected_behavior','status'];
  if(JSON.stringify(csv.header)!==JSON.stringify(head)||csv.rows.length!==PINNED[k].count)
   return failure('DATASET_SCHEMA_OR_COUNT_MISMATCH');
  const cases=[],ids=new Set();
  for(const x of csv.rows){
   if(!/^QA\d{2,3}$/.test(x.case_id)||ids.has(x.case_id)||
      typeof x.expected_behavior!=='string'||!x.expected_behavior.trim())
     return failure('DUPLICATE_OR_BAD_CASE');
   ids.add(x.case_id);
   let n=1;
   if(k==='single'){
    if(!x.chatInput.trim()||x.actual_output.trim())return failure('SINGLE_IS_NOT_UNRUN');
   }else{
    if(x.status!=='NOT_RUN')return failure('MULTI_IS_NOT_UNRUN');
    let t;try{t=JSON.parse(x.turns_json)}catch{return failure('INVALID_TURNS_JSON')}
    if(!Array.isArray(t)||!t.length||t.some(s=>typeof s!=='string'||!s.trim()))
      return failure('INVALID_TURNS');
    n=t.length;
   }
   cases.push(Object.freeze({kind:k,case_id:x.case_id,turns:n}));
  }
  plan[k]=cases;
 }
 const expected=plan.single.reduce((a,c)=>a+c.turns,0)+plan.multi.reduce((a,c)=>a+c.turns,0);
 if(expected!==167||plan.multi.reduce((a,c)=>a+c.turns,0)!==71)return failure('TURN_COUNT_MISMATCH');
 return Object.freeze({status:'PRIVATE_DATASET_VERIFIED_NO_MODEL_RUN',
  version:'V15.0-10B',expected_cases:132,expected_model_turns:expected,
  single_cases:96,multi_cases:36,multi_turns:71,
  cases:Object.freeze([...plan.single,...plan.multi]),
  private_text_exported:false,model_calls_executed:0,
  budget_approved:false,actual_billed_cost_usd:null,
  real_model_quality_certified:false,provider_sends:0,hosted_writes:0});
}
const allowedKeys=new Set(['kind','case_id','turn_index','model','started_ms','ended_ms',
 'input_tokens','output_tokens','cached_input_tokens','retry_count','tool_call_count',
 'review']);
function percentile(xs,p){
 if(!xs.length)return null;
 const values=xs.slice().sort((a,b)=>a-b),at=(values.length-1)*p,
   a=Math.floor(at),b=Math.ceil(at);
 return values[a]+(values[b]-values[a])*(at-a);
}
function analyzeReceipts(plan,records,{budgetUsd=0}={}){
 if(!plan||plan.status!=='PRIVATE_DATASET_VERIFIED_NO_MODEL_RUN'||
   !Array.isArray(records)||!Number.isFinite(budgetUsd)||budgetUsd<0)
   return failure('PLAN_OR_RECORDS_INVALID');
 const cases=new Map(plan.cases.map(c=>[c.kind+':'+c.case_id,c]));
 const seen=new Set(),grouped=new Map();
 let usd=0,tokensIn=0,tokensOut=0,cached=0,retries=0,tools=0;
 const latency=[],reviewedTools=[],hallucinations=[];
 for(const r of records){
  if(!r||typeof r!=='object'||Array.isArray(r)||
    Object.keys(r).some(k=>!allowedKeys.has(k)))
   return failure('RAW_TEXT_OR_UNSUPPORTED_MEASUREMENT_FIELD');
  const key=r.kind+':'+r.case_id,c=cases.get(key);
  if(!c||!Number.isInteger(r.turn_index)||r.turn_index<0||
    r.turn_index>=c.turns||seen.has(key+':'+r.turn_index))
    return failure('UNKNOWN_DUPLICATE_OR_OUT_OF_RANGE_TURN');
  seen.add(key+':'+r.turn_index);
  const price=PRICE[r.model];
  if(!price)return failure('UNKNOWN_MODEL_OR_PRICE');
  for(const k of ['input_tokens','output_tokens','cached_input_tokens','retry_count','tool_call_count']){
    if(!Number.isSafeInteger(r[k])||r[k]<0)return failure('INVALID_MEASURED_USAGE');
  }
  if(r.cached_input_tokens>r.input_tokens||
    !Number.isSafeInteger(r.started_ms)||!Number.isSafeInteger(r.ended_ms)||
    r.ended_ms<r.started_ms||r.ended_ms-r.started_ms>600000)
    return failure('INVALID_MEASURED_LATENCY');
  if(!r.review||typeof r.review!=='object'||Array.isArray(r.review)||
     Object.keys(r.review).sort().join(',')!=='hallucination,status,tool_accuracy'||
     !['PASS','FAIL','UNREVIEWED'].includes(r.review.status)||
     !['PASS','FAIL','NOT_ASSESSED'].includes(r.review.tool_accuracy)||
     !['YES','NO','NOT_ASSESSED'].includes(r.review.hallucination))
    return failure('INVALID_OR_MISSING_HUMAN_REVIEW');
  const turnUsd=((r.input_tokens-r.cached_input_tokens)*price.usdPerMInput+
     r.cached_input_tokens*price.usdPerMCached+
     r.output_tokens*price.usdPerMOutput)/1_000_000;
  usd+=turnUsd;tokensIn+=r.input_tokens;tokensOut+=r.output_tokens;
  cached+=r.cached_input_tokens;retries+=r.retry_count;tools+=r.tool_call_count;
  latency.push(r.ended_ms-r.started_ms);
  if(r.review.tool_accuracy!=='NOT_ASSESSED')reviewedTools.push(r.review.tool_accuracy);
  if(r.review.hallucination!=='NOT_ASSESSED')hallucinations.push(r.review.hallucination);
  if(!grouped.has(key))grouped.set(key,[]);
  grouped.get(key).push(r.review.status);
 }
 let completed=0,fullyReviewed=0,passing=0,failed=0,missingTurns=0;
 for(const [key,c] of cases){
  const arr=grouped.get(key)||[];
  if(arr.length!==c.turns){missingTurns+=c.turns-arr.length;continue}
  completed++;
  if(arr.every(s=>s!=='UNREVIEWED')){
    fullyReviewed++;
    if(arr.every(s=>s==='PASS'))passing++;else failed++;
  }
 }
 const allCasesReviewed=fullyReviewed===plan.expected_cases;
 return Object.freeze({status:'SUBMITTED_OFFLINE_RECEIPTS_UNVERIFIED',
  evidence_integrity_independently_verified:false,paid_model_calls_executed_by_analyzer:0,
  expected_cases:plan.expected_cases,expected_turns:plan.expected_model_turns,
  received_turns:seen.size,missing_turns:missingTurns,
  complete_case_turns:completed,fully_human_reviewed_cases:fullyReviewed,
  case_accuracy:allCasesReviewed?passing/plan.expected_cases:null,
  reviewed_case_pass_fraction:fullyReviewed?passing/fullyReviewed:null,
  tool_accuracy_reviewed:reviewedTools.length?
    reviewedTools.filter(x=>x==='PASS').length/reviewedTools.length:null,
  hallucination_reviewed_fraction:hallucinations.length?
    hallucinations.filter(x=>x==='YES').length/hallucinations.length:null,
  p50_ms:percentile(latency,0.50),p95_ms:percentile(latency,0.95),
  tokens_input:tokensIn,tokens_output:tokensOut,tokens_cached:cached,
  retries,tool_calls:tools,
  api_list_price_estimate_usd:Math.round(usd*1e8)/1e8,
  estimate_source:'OPENAI_API_LIST_PRICE_2026_11_16_NOT_GATEWAY_BILL',
  budget_usd:budgetUsd,budget_review:usd<=budgetUsd?'WITHIN_REVIEW_CEILING':'ABOVE_REVIEW_CEILING',
  actual_billed_cost_usd:null,real_model_quality_certified:false,
  can_call_paid_model:false,provider_sends:0,hosted_writes:0});
}
module.exports={PINNED,PRICE,preparePlan,analyzeReceipts,percentile};
