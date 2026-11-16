/**
 * TIEN404 V16.4C 8-case canary dry-run. NO real model/network/executor.
 * 24 case×candidate pairs; replay = 42 MINIMUM requests for all user turns
 * (no model-to-tool recursion, retry, reasoning-token or rate-tier guarantee).
 */
import {MODEL_CATALOG} from '../v164-private-ab/model-catalog-readiness.mjs';
import {SINGLE_CASES,MULTI_PACK} from '../v163-studios/manifest-132.mjs';
export const CONTRACT='T404_V164C_CANARY_8_CASES_NO_PAID_API_V1';
const deny=(ok,err)=>{if(!ok)throw Error(err)};
export const CASE_KEYS=Object.freeze([
 'SINGLE:QA01','SINGLE:QA02','SINGLE:QA03','SINGLE:QA04',
 'MULTI:QA01','MULTI:QA07','MULTI:QA20','MULTI:QA28'
]);
export function canaryPlan(){
 const original=CASE_KEYS.map(key=>{
  const [pack,id]=key.split(':');
  const x=pack==='SINGLE'?SINGLE_CASES.find(c=>c.case_id===id):MULTI_PACK.find(c=>c.case_id===id);
  deny(!!x,'CANARY_SOURCE_CASE_MISSING');
  return Object.freeze({case_key:key,turn_count:pack==='SINGLE'?1:x.turn_count,
    transcript_in_public_source:false,reviewer_signed_gold:false,
    privacy_classification:'NOT_ACCEPTED',
    source_data_to_provider_allowed:false});
 });
 deny(original.length===8&&new Set(CASE_KEYS).size===8,'CANARY_NOT_8_UNIQUE_CASES');
 const pairs=original.flatMap(c=>MODEL_CATALOG.map(m=>Object.freeze({
  case_key:c.case_key,candidate:m.candidate,
  expected_turn_requests:c.turn_count,
  status:'NOT_RUN',measured_input_tokens:null,measured_output_tokens:null,
  response_evidence_sha256:null,actual_cost_micro_usd:null,
  human_quality_pass:null,production_eligible:false
 })));
 const perCandidate=original.reduce((sum,c)=>sum+c.turn_count,0);
 deny(perCandidate===14,'CANARY_TURN_COUNT_DRIFT');
 return Object.freeze({contract:CONTRACT,cases:Object.freeze(original),
  pairs:Object.freeze(pairs),case_count:8,model_count:MODEL_CATALOG.length,
  pairs_count:pairs.length,min_requests_per_model:perCandidate,
  min_total_model_requests:perCandidate*MODEL_CATALOG.length,
  retries_included:false,tool_callback_model_calls_included:false,
  private_source_required_before_real_canary:true,
  real_provider_calls:0,model_outputs_produced:0,paid_budget_authorized:false});
}
const integer=n=>Number.isSafeInteger(n)&&n>=0;
const mkQuote=({model_id,max_input_tokens,max_output_tokens})=>{
 deny(integer(max_input_tokens)&&max_input_tokens<=200000&&
  integer(max_output_tokens)&&max_output_tokens<=50000,'INVALID_TOKEN_BOUND');
 const m=MODEL_CATALOG.find(m=>m.model_id===model_id);
 deny(!!m,'UNKNOWN_CATALOG_MODEL');
 const microUsd=Math.ceil(max_input_tokens*m.input_usd_per_1m+
  max_output_tokens*m.output_usd_per_1m);
 deny(Number.isSafeInteger(microUsd)&&microUsd>=0,'COST_QUOTE_OVERFLOW');
 return Object.freeze({provider:m.provider,candidate:m.candidate,model_id,
  assumed_max_micro_usd:microUsd,actual_provider_cost_micro_usd:null,
  provider_price_tier_verified:false,hidden_reasoning_tokens_included:false,
  quote_is_hard_provider_cap:false});
};
export function syntheticTokenQuote(args){return mkQuote(args)}
export function newSyntheticBudget({global_cap_micro_usd,provider_caps_micro_usd}){
 deny(integer(global_cap_micro_usd)&&global_cap_micro_usd<=10000000,'SYNTHETIC_GLOBAL_CAP_REQUIRED');
 deny(provider_caps_micro_usd&&typeof provider_caps_micro_usd==='object'&&
  !Array.isArray(provider_caps_micro_usd)&&Object.keys(provider_caps_micro_usd).sort().join('|')==='google|openai'&&
  Object.values(provider_caps_micro_usd).every(integer),'EXACT_SYNTHETIC_PROVIDER_CAPS_REQUIRED');
 let globalReserved=0,globalSpent=0;
 const providerReserved={openai:0,google:0},providerSpent={openai:0,google:0};
 const ledger=new Map();
 const eventKey=x=>typeof x==='string'&&/^QA_CANARY_[A-Z0-9_]{1,60}$/.test(x);
 function reserve({event_id,model_id,max_input_tokens,max_output_tokens}){
  deny(eventKey(event_id),'SYNTHETIC_EVENT_ID_REQUIRED');
  const quote=mkQuote({model_id,max_input_tokens,max_output_tokens});
  const request_fingerprint=[model_id,max_input_tokens,max_output_tokens].join('|');
  const old=ledger.get(event_id);
  if(old){
   deny(old.request_fingerprint===request_fingerprint,'IDEMPOTENCY_KEY_CONFLICT');
   return Object.freeze({accepted:old.status!=='HARD_BLOCKED',status:'ALREADY_PROCESSED',
    charged_real_usd:0,live_call_allowed:false});
  }
  const cap=quote.assumed_max_micro_usd;
  const globalRemaining=global_cap_micro_usd-globalReserved-globalSpent;
  const providerRemaining=provider_caps_micro_usd[quote.provider]-
   providerReserved[quote.provider]-providerSpent[quote.provider];
  if(cap>globalRemaining||cap>providerRemaining){
   ledger.set(event_id,{status:'HARD_BLOCKED',model_id,provider:quote.provider,micro:cap,request_fingerprint});
   return Object.freeze({accepted:false,status:'HARD_BLOCKED_QA_CAP',
    charged_real_usd:0,live_call_allowed:false});
  }
  globalReserved+=cap;providerReserved[quote.provider]+=cap;
  ledger.set(event_id,{status:'RESERVED_SYNTHETIC',model_id,provider:quote.provider,micro:cap,request_fingerprint});
  return Object.freeze({accepted:true,status:'RESERVED_SYNTHETIC',
   max_simulated_micro_usd:cap,charged_real_usd:0,live_call_allowed:false});
 }
 function settle({event_id,simulated_used_micro_usd}){
  deny(eventKey(event_id)&&integer(simulated_used_micro_usd),'INVALID_QA_SETTLEMENT');
  const e=ledger.get(event_id);
  deny(e?.status==='RESERVED_SYNTHETIC','MISSING_ACTIVE_RESERVATION');
  deny(simulated_used_micro_usd<=e.micro,'SETTLEMENT_EXCEEDS_RESERVED_BOUND');
  globalReserved-=e.micro;providerReserved[e.provider]-=e.micro;
  globalSpent+=simulated_used_micro_usd;providerSpent[e.provider]+=simulated_used_micro_usd;
  e.status='SETTLED_SYNTHETIC';e.spent=simulated_used_micro_usd;
  return snapshot();
 }
 function release({event_id}){
  deny(eventKey(event_id),'INVALID_QA_RELEASE');
  const e=ledger.get(event_id);
  deny(e?.status==='RESERVED_SYNTHETIC','MISSING_ACTIVE_RESERVATION');
  globalReserved-=e.micro;providerReserved[e.provider]-=e.micro;
  e.status='RELEASED_SYNTHETIC';
  return snapshot();
 }
 function snapshot(){
  const usage=globalReserved+globalSpent;
  return Object.freeze({
   contract:CONTRACT,status:'SYNTHETIC_LEDGER_NOT_DURABLE',
   global_cap_micro_usd,simulated_reserved_micro_usd:globalReserved,
   simulated_spent_micro_usd:globalSpent,actual_provider_spend_micro_usd:null,
   provider_simulated_spent_micro_usd:Object.freeze({...providerSpent}),
   provider_simulated_reserved_micro_usd:Object.freeze({...providerReserved}),
   warning_levels:Object.freeze([70,90,100].filter(level=>usage*100>=global_cap_micro_usd*level)),
   events:ledger.size,external_usage_reconciled:false,
   atomic_across_workers:false,actual_budget_cap_enforced:false,
   paid_call_enabled:false});
 }
 return Object.freeze({reserve,settle,release,snapshot,mode:'QA_NO_SEND_ONLY'});
}
export function simulateEightCaseCanary({max_input_tokens=2000,max_output_tokens=500}={}){
 const plan=canaryPlan();
 const ledger=newSyntheticBudget({global_cap_micro_usd:200000,
  provider_caps_micro_usd:{openai:120000,google:80000}});
 let count=0,blocks=0;
 for(const c of plan.cases)for(const m of MODEL_CATALOG)
  for(let t=0;t<c.turn_count;t++){
   const event_id='QA_CANARY_'+String(++count).padStart(3,'0');
   const r=ledger.reserve({event_id,model_id:m.model_id,max_input_tokens,max_output_tokens});
   if(!r.accepted){blocks++;continue;}
   ledger.settle({event_id,simulated_used_micro_usd:r.max_simulated_micro_usd});
  }
 return Object.freeze({
  contract:CONTRACT,status:'OFFLINE_SYNTHETIC_DRY_RUN_ONLY',
  requested_model_turn_slots:count,simulated_budget_blocks:blocks,
  planned_case_model_pairs:plan.pairs_count,
  simulated_micro_usd_total:ledger.snapshot().simulated_spent_micro_usd,
  real_provider_cost_usd:null,real_provider_calls:0,
  model_outputs_evaluated:0,certified_qa_pass:0,ready_to_run_paid:false,
  global_budget_approval_present:false,external_spend_cap_verified:false,
  ledger_durable:false,no_real_order_or_channel_side_effects:true});
}
export const executePaidCanary=()=>{throw Error('V164C_NO_PAID_CANARY_EXECUTOR')};
export const allowProviderPromptUpload=()=>{throw Error('V164C_NO_CUSTOMER_PROMPT_UPLOAD')};
export const updatePublishedModel=()=>{throw Error('V164C_NO_PRODUCTION_MODEL_PROMOTION')};
