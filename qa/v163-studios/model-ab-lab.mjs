import {STAGE,assert,exact,positiveInt} from './qa-contract.mjs';
/** 132-case A/B Lab: manifest and scoring gates only. No prompts, messages or API calls in repo. */
export const CANDIDATES=Object.freeze(['baseline_small','economy_candidate','premium_candidate']);
const ID=/^QA\d{2}$/;
function checkRows(rows,kind,count){
 assert(Array.isArray(rows)&&rows.length===count,'DATASET_COUNT_MISMATCH_'+kind);
 const seen=new Set();
 for(const row of rows){
  assert(exact(row,kind==='single'?['case_id']:['case_id','turn_count']),'MANIFEST_METADATA_ONLY');
  assert(ID.test(row.case_id)&&!seen.has(row.case_id),'DUPLICATE_OR_INVALID_CASE_ID');
  if(kind==='multi')assert(Number.isInteger(row.turn_count)&&row.turn_count>=1&&row.turn_count<=12,'INVALID_TURN_COUNT');
  seen.add(row.case_id);
 }
}
export function build132Manifest({single,multi}){
 checkRows(single,'single',96);checkRows(multi,'multi',36);
 const cases=[
  ...single.map(x=>({case_key:'SINGLE:'+x.case_id,turns:1})),
  ...multi.map(x=>({case_key:'MULTI:'+x.case_id,turns:x.turn_count}))
 ];
 assert(new Set(cases.map(x=>x.case_key)).size===132,'NONUNIQUE_COMPOSITE_KEYS');
 return Object.freeze({stage:STAGE,count:132,single_count:96,multi_count:36,
  total_turns:cases.reduce((n,x)=>n+x.turns,0),
  true_multi_turn_count:multi.filter(x=>x.turn_count>=2).length,
  single_turn_cases_in_multi_pack:multi.filter(x=>x.turn_count===1).length,
  cases:Object.freeze(cases.map(Object.freeze)),
  raw_prompts_included:false,actual_outputs_included:false});
}
export function planAbLab({manifest,candidates=CANDIDATES}){
 assert(manifest?.stage===STAGE&&manifest?.count===132&&manifest.cases.length===132,'MISSING_132_MANIFEST');
 assert(Array.isArray(candidates)&&candidates.length>=2&&candidates.length<=3&&
  candidates.every(c=>CANDIDATES.includes(c))&&new Set(candidates).size===candidates.length,
  'MODEL_CANDIDATES_NOT_ENROLLED');
 const rows=manifest.cases.flatMap(c=>candidates.map(model=>Object.freeze({
  case_key:c.case_key,model_label:model,status:'NOT_RUN',
  model_id_verified:false,api_called:false,output_present:false,
  independent_reviewer_approved:false,token_usage:null,
  latency_ms:null,real_cost_usd:null,tool_trace_id:null,qa_category:null
 })));
 return Object.freeze({status:'MODEL_AB_PLANNED_NO_CALL',cases:132,
  candidates:Object.freeze([...candidates]),planned_evaluations:rows.length,
  rows:Object.freeze(rows),scored_pass:0,scored_fail:0,
  actual_api_calls:0,actual_billing_usd:null});
}
export function evaluationEvidenceGate(row,observation){
 assert(row&&row.status==='NOT_RUN','INVALID_BASELINE_ROW');
 if(!observation)return {status:'NOT_RUN',reason:'NO_MODEL_OUTPUT'};
 assert(exact(observation,['output_hash','latency_ms','input_tokens','output_tokens','tool_trace_verified','reviewer_approved','fixture_snapshot_verified']),
  'NO_RAW_OUTPUT_OR_PII_IN_OBSERVATION');
 assert(typeof observation.output_hash==='string'&&/^[a-f0-9]{64}$/.test(observation.output_hash),
  'OPAQUE_OUTPUT_HASH_REQUIRED');
 for(const n of ['latency_ms','input_tokens','output_tokens'])
  assert(positiveInt(observation[n]),'INVALID_USAGE');
 // Reviewer assertion cannot be the only acceptance; identity and hosted tool proof remain external.
 return Object.freeze({status:'BLOCKED',reason:'INDEPENDENT_EVALUATION_AND_HOSTED_PROOF_REQUIRED',
   api_called_here:false,actual_spend_verified:false,pass_allowed:false});
}
export function aggregateAbRows(rows){
 assert(Array.isArray(rows)&&rows.every(r=>r&&['NOT_RUN','BLOCKED','FAIL','PASS'].includes(r.status)),'INVALID_MODEL_SCORECARD');
 // A row saying PASS is not sufficient; only a separately approved validator can certify.
 return Object.freeze({total:rows.length,NOT_RUN:rows.filter(r=>r.status==='NOT_RUN').length,
  BLOCKED:rows.filter(r=>r.status==='BLOCKED').length,
  FAIL:rows.filter(r=>r.status==='FAIL').length,
  unverified_pass_claims:rows.filter(r=>r.status==='PASS').length,
  certified_pass:0,real_model_quality_certified:false});
}
