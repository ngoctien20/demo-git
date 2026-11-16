/**
 * TIEN404 V16.4 private Model A/B readiness adapter, OFFLINE CONTRACT ONLY.
 * Never call live models. No customer text, credentials, provider keys, JWT,
 * pricing promises or order/tool actions. Private prompts must remain outside
 * this public repository, in an independently authorized encrypted location.
 */
import {createHash} from 'node:crypto';
import {build132Manifest,planAbLab,aggregateAbRows,CANDIDATES} from '../v163-studios/model-ab-lab.mjs';
import {SINGLE_CASES,MULTI_PACK} from '../v163-studios/manifest-132.mjs';
export const CONTRACT='T404_V164_PRIVATE_AB_READINESS_NO_CALL_V1';
const hex64=s=>typeof s==='string'&&/^[0-9a-f]{64}$/.test(s);
const exact=(x,keys)=>!!x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const check=(yes,err)=>{if(!yes)throw Error(err)};
export function privateDatasetManifest(){
 const base=build132Manifest({single:SINGLE_CASES,multi:MULTI_PACK});
 return Object.freeze({contract:CONTRACT,cases:base.count,dialogue_pack:36,
  actual_multi_turn_cases:base.true_multi_turn_count,one_turn_in_multi_pack:base.single_turn_cases_in_multi_pack,
  dialogue_turns:MULTI_PACK.reduce((n,x)=>n+x.turn_count,0),
  privacy:'NO_PROMPT_OR_EXPECTED_OUTPUT_IN_PUBLIC_REPO',
  source_file_uploaded_to_provider:false,actual_model_calls:0});
}
export function privateRunPreflight(input){
 const keys=['contract','dataset_sha256','model_registry_sha256','approved_budget_usd','api_authorization','private_encrypted_vault_verified','tenant_scope','reviewer_role_verified'];
 check(exact(input,keys),'EXACT_PRIVATE_PREFLIGHT_FIELDS_REQUIRED');
 check(input.contract===CONTRACT&&hex64(input.dataset_sha256)&&hex64(input.model_registry_sha256),
   'SNAPSHOT_AND_MODEL_REGISTRY_HASH_REQUIRED');
 check(typeof input.approved_budget_usd==='number'&&Number.isFinite(input.approved_budget_usd)&&input.approved_budget_usd>=0,'INVALID_BUDGET');
 check(/^QA_TENANT_[A-Z0-9_]{1,24}$/.test(input.tenant_scope),'NON_QA_TENANT_BLOCKED');
 check(typeof input.api_authorization==='boolean'&&typeof input.private_encrypted_vault_verified==='boolean'&&
   typeof input.reviewer_role_verified==='boolean','INVALID_PREFLIGHT_PROOF_FLAGS');
 // Boolean claims are NEVER independently verified owner/provider/reviewer approvals.
 const missing=[];
 if(!input.api_authorization)missing.push('PAID_MODEL_CALL_NOT_AUTHORIZED');
 if(!input.private_encrypted_vault_verified)missing.push('PRIVATE_DATASET_STORAGE_UNVERIFIED');
 if(!input.reviewer_role_verified)missing.push('INDEPENDENT_REVIEWER_UNVERIFIED');
 if(input.approved_budget_usd===0)missing.push('BUDGET_NOT_ALLOCATED');
 return Object.freeze({status:'BLOCKED_NO_LIVE_API_EXECUTOR',missing_evidence:missing,
   caller_attestation_verified:false,real_cost_usd:null,provider_limit_verified:false,
   actual_api_calls:0,deploy_allowed:false,source_only:true,
   note:'All provided flags are self-asserted; separate independent proof and an approved executor are required'});
}
export function blindedSchedule({seed,candidates=CANDIDATES}){
 check(typeof seed==='string'&&/^QA_SEED_[A-Z0-9_]{6,40}$/.test(seed),'SYNTHETIC_BLINDING_SEED_REQUIRED');
 const manifest=build132Manifest({single:SINGLE_CASES,multi:MULTI_PACK});
 const p=planAbLab({manifest,candidates});
 const rows=[...p.rows].map((r)=>Object.freeze({
   case_key:r.case_key,candidate_label:r.model_label,review_label:createHash('sha256')
      .update(seed+'|'+r.case_key+'|'+r.model_label).digest('hex').slice(0,16),
   status:'NOT_RUN',actual_output_hash:null,latency_ms:null,
   tool_trace_hash:null,reviewer_evidence:null,cost_actual_usd:null}));
 rows.sort((a,b)=>a.review_label.localeCompare(b.review_label));
 return Object.freeze({contract:CONTRACT,rows:Object.freeze(rows),count:rows.length,
  unique_review_labels:new Set(rows.map(x=>x.review_label)).size,
  independent_output_reviews:0,certified_pass:0,external_api_calls:0,
  encrypted_private_data_attached:false,production_model_selection:null,
  source:'DETERMINISTIC_BLINDING_PREVIEW_ONLY_NOT_CRYPTOGRAPHIC_ANONYMITY'});
}
export function costBoundary({planned_calls,max_input_tokens,max_output_tokens,input_usd_per_million,output_usd_per_million}){
 const all=[planned_calls,max_input_tokens,max_output_tokens,input_usd_per_million,output_usd_per_million];
 check(all.every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0)&&all.slice(0,3).every(Number.isSafeInteger),'INVALID_COST_MODEL');
 const max_usd=planned_calls*(max_input_tokens*input_usd_per_million+max_output_tokens*output_usd_per_million)/1e6;
 check(Number.isFinite(max_usd),'COST_OVERFLOW');
 return Object.freeze({hypothetical_max_usd:Math.ceil(max_usd*1000000)/1000000,
   actual_provider_spend_usd:null,hard_spend_cap_enforced:false,billing_verified:false,
   no_paid_calls:true,cost_source:'USER_SUPPLIED_ASSUMPTIONS_NOT_PROVIDER_QUOTA'});
}
export function ingestSanitizedEvidence(e){
 const keys=['case_key','candidate_label','output_sha256','tool_trace_sha256','reviewer_attestation_sha256','fixture_snapshot_sha256','reviewer_separate_from_runner'];
 check(exact(e,keys),'RAW_OUTPUT_OR_UNEXPECTED_FIELD_BLOCKED');
 check(/^SINGLE:QA\d{2}$|^MULTI:QA\d{2}$/.test(e.case_key)&&CANDIDATES.includes(e.candidate_label),
  'UNKNOWN_CASE_OR_CANDIDATE');
 for(const field of ['output_sha256','tool_trace_sha256','reviewer_attestation_sha256','fixture_snapshot_sha256'])
   check(hex64(e[field]),'OPAQUE_EVIDENCE_HASH_REQUIRED');
 check(typeof e.reviewer_separate_from_runner==='boolean','INDEPENDENT_REVIEW_BOOLEAN_REQUIRED');
 return Object.freeze({status:'BLOCKED_PENDING_INDEPENDENT_VERIFICATION',
   self_reported_independence:e.reviewer_separate_from_runner,
   hash_proves_correctness:false,certified_pass:false,actual_api_calls_here:0});
}
export const performPaidModelCall=()=>{throw Error('V164_PAID_API_HARD_BLOCK')};
export const executeRealOrder=()=>{throw Error('V164_COMMERCE_HARD_BLOCK')};
export const writeCustomerDataset=()=>{throw Error('V164_PRIVATE_DATA_WRITE_HARD_BLOCK')};
export const sendProviderMessage=()=>{throw Error('V164_PROVIDER_SEND_HARD_BLOCK')};
