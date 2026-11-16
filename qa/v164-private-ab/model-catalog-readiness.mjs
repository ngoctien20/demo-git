/**
 * TIEN404 V16.4 — PUBLIC DOCUMENTATION SNAPSHOT, not project-specific entitlement.
 * Read-only model selection research. NO API client, credentials, network or execution.
 * Updated 2026-11-16 JST. Prices for ordinary text input/output STANDARD only.
 */
import {MULTI_PACK,SINGLE_CASES} from '../v163-studios/manifest-132.mjs';
export const CATALOG_VERSION='T404_V164_DOC_CATALOG_20261116';
export const MODEL_CATALOG=Object.freeze([
 Object.freeze({candidate:'luna',provider:'openai',model_id:'gpt-6-luna',model_status:'DOCUMENTED',
   input_usd_per_1m:.10,output_usd_per_1m:.50,
   docs:'https://developers.openai.com/api/docs/models/gpt-6-luna',
   account_entitlement_verified:false,account_rpm:null,account_tpm:null,
   eligible_for_real_benchmark:false,access_note:'Project access, API key, spend cap, consent NOT VERIFIED'}),
 Object.freeze({candidate:'gemini_lite',provider:'google',model_id:'gemini-2.5-flash-lite',model_status:'DOCUMENTED_WITH_ACCESS_RESTRICTIONS',
   input_usd_per_1m:.10,output_usd_per_1m:.40,
   docs:'https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash-lite',
   account_entitlement_verified:false,account_rpm:null,account_tpm:null,
   eligible_for_real_benchmark:false,access_note:'2.5 limited for NEW projects; verify Gemini project access'}),
 Object.freeze({candidate:'legacy_baseline',provider:'openai',model_id:'gpt-5-mini',model_status:'DEPRECATED',
   input_usd_per_1m:.25,output_usd_per_1m:2.00,
   docs:'https://developers.openai.com/api/docs/deprecations',
   account_entitlement_verified:false,account_rpm:null,account_tpm:null,
   eligible_for_real_benchmark:false,shutdown_date:'2026-12-11',
   access_note:'Historical baseline only; deprecated and scheduled shutdown'})
]);
const integer=(n)=>Number.isSafeInteger(n)&&n>=0;
const finite=(n)=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
const reject=(yes,code)=>{if(!yes)throw Error(code)};
export function datasetRequestShape(){
 const singles=SINGLE_CASES.length,dialogues=MULTI_PACK.length;
 const dialogueTurns=MULTI_PACK.reduce((acc,x)=>acc+x.turn_count,0);
 reject(singles===96&&dialogues===36&&dialogueTurns===71,'SOURCE_MANIFEST_DRIFT');
 return Object.freeze({single_cases:singles,dialogue_cases:dialogues,total_cases:singles+dialogues,
  dialogue_turns:dialogueTurns,one_turn_dialogue_cases:MULTI_PACK.filter(x=>x.turn_count===1).length,
  true_multi_turn_dialogue_cases:MULTI_PACK.filter(x=>x.turn_count>1).length,
  per_candidate_case_evaluations:singles+dialogues,
  per_candidate_min_user_turn_requests:singles+dialogueTurns,
  model_count:MODEL_CATALOG.length,total_case_model_pairs:(singles+dialogues)*MODEL_CATALOG.length,
  min_model_requests_for_full_sequential_replay:(singles+dialogueTurns)*MODEL_CATALOG.length,
  tool_or_retry_calls_included:false,source:'STRUCTURE_ONLY_NO_MODEL_CALL'});
}
export function projectUsageScenario({
 calls_per_user_turn=1,max_input_tokens_per_call=1200,max_output_tokens_per_call=180,
 retry_factor=1,catalog=MODEL_CATALOG
}={}){
 reject(integer(calls_per_user_turn)&&calls_per_user_turn>=1&&calls_per_user_turn<=10,'INVALID_CALLS_PER_TURN');
 reject(integer(max_input_tokens_per_call)&&max_input_tokens_per_call<=200000,'INVALID_INPUT_BOUND');
 reject(integer(max_output_tokens_per_call)&&max_output_tokens_per_call<=50000,'INVALID_OUTPUT_BOUND');
 reject(finite(retry_factor)&&retry_factor>=1&&retry_factor<=5,'INVALID_RETRY_ASSUMPTION');
 reject(Array.isArray(catalog)&&catalog.length>0&&catalog.length<=3,'INVALID_CATALOG');
 const shape=datasetRequestShape();
 const requestedCalls=shape.per_candidate_min_user_turn_requests*calls_per_user_turn;
 const chargedCalls=Math.ceil(requestedCalls*retry_factor);
 const perModel=catalog.map(model=>{
  reject(typeof model.model_id==='string'&&finite(model.input_usd_per_1m)&&finite(model.output_usd_per_1m),'INVALID_RATE');
  const estimate=chargedCalls*(max_input_tokens_per_call*model.input_usd_per_1m+
      max_output_tokens_per_call*model.output_usd_per_1m)/1e6;
  return Object.freeze({candidate:model.candidate,model_id:model.model_id,
   min_requests:requestedCalls,assumed_billed_requests:chargedCalls,
   estimated_usd:Math.ceil(estimate*1e6)/1e6,actual_spend_usd:null,
   provider_usage_verified:false});
 });
 return Object.freeze({kind:'SCENARIO_NOT_ACCOUNT_QUOTE',
  assumption:{calls_per_user_turn,max_input_tokens_per_call,max_output_tokens_per_call,retry_factor},
  total_estimated_usd:Math.ceil(perModel.reduce((s,x)=>s+x.estimated_usd,0)*1e6)/1e6,
  total_requests:perModel.reduce((s,x)=>s+x.assumed_billed_requests,0),
  per_model:Object.freeze(perModel),possible_hidden_thinking_tokens:true,
  cache_batch_tools_not_priced:true,account_quota_verified:false,
  hard_cap_enforced:false,no_api_calls:true});
}
export function readinessDecision({dataset_privacy_reviewed=false,independent_gold_reviewed=false,
 model_entitlements_verified=false,model_lifecycle_accepted=false,project_quotas_verified=false,
 tool_replay_sandbox_verified=false,independent_reviewers_enrolled=false,
 explicit_paid_budget_approval=false,tenant_isolation_approved=false}={}){
 const requested={dataset_privacy_reviewed,independent_gold_reviewed,model_entitlements_verified,
  model_lifecycle_accepted,project_quotas_verified,tool_replay_sandbox_verified,
  independent_reviewers_enrolled,explicit_paid_budget_approval,tenant_isolation_approved};
 reject(Object.values(requested).every(x=>typeof x==='boolean'),'INVALID_READINESS_INPUT');
 const missing=Object.entries(requested).filter(([,v])=>v===false).map(([k])=>k);
 return Object.freeze({status:'NO_GO_SOURCE_ONLY',missing,
  flags_are_self_attested:true,independently_certified:false,
  live_executor_present:false,real_spend_authorized_by_this_source:false,
  api_requests:0,commerce_writes:0,provider_sends:0,
  note:'Even all-true flags cannot authorize paid execution or customer data transfer'});
}
export const createRealModelCall=()=>{throw Error('V164_NO_PAID_MODEL_EXECUTOR')};
export const publishBenchmark=()=>{throw Error('V164_NO_PUBLICATION')};
