/**
 * V16.4B independent evaluation readiness, private preflight only.
 * All IDs QA-only, no raw prompts, no model inference, no scoring fake outputs.
 */
import {SINGLE_CASES,MULTI_PACK} from '../v163-studios/manifest-132.mjs';
import {P0_CODES,DIMENSIONS} from '../v164-private-ab/quality-review-protocol.mjs';
import {MODEL_CATALOG,datasetRequestShape} from '../v164-private-ab/model-catalog-readiness.mjs';
export const CONTRACT='T404_V164B_INDEPENDENT_EVAL_PREFLIGHT_V1';
const QA_ID=/^QA_[A-Z0-9_]{2,48}$/;
const HASH=/^[a-f0-9]{64}$/;
const assert=(x,e)=>{if(!x)throw Error(e)};
const isHash=x=>typeof x==='string'&&HASH.test(x);
const matches=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
export function frozenPlan(){
 const shape=datasetRequestShape();
 const rows=[
 ...SINGLE_CASES.map(x=>({case_key:'SINGLE:'+x.case_id,turn_count:1,memory_case:false})),
 ...MULTI_PACK.map(x=>({case_key:'MULTI:'+x.case_id,turn_count:x.turn_count,memory_case:x.turn_count>1}))];
 assert(rows.length===132,'MANIFEST_COUNT_DRIFT');
 const scenarios=rows.flatMap(row=>MODEL_CATALOG.map(m=>Object.freeze({
  ...row,candidate:m.candidate,review_round:'ROUND_1_BLIND',source_kind:'SOURCE_ONLY',
  model_call_status:'NOT_RUN',real_output_sha256:null,
  frozen_prompt_sha256:null,frozen_knowledge_sha256:null,frozen_tools_sha256:null,
  verified_runner:null,verified_reviewers:[],p0_adjudicated:false,
  independent_result:'NOT_RUN',can_promote:false
 })));
 return Object.freeze({contract:CONTRACT,cases:132,model_labels:MODEL_CATALOG.map(m=>m.candidate),
  model_case_pairs:scenarios.length,minimum_sequential_turn_requests:shape.min_model_requests_for_full_sequential_replay,
  true_memory_cases_per_candidate:27,one_turn_in_dialogue_pack:9,
  rows:Object.freeze(scenarios),model_outputs_evaluated:0,certified_pass:0,
  source_private_prompts_included:false});
}
export function reviewerSeparation({runner_id,reviewer_ids,adjudicator_id}){
 assert(QA_ID.test(runner_id),'SYNTHETIC_RUNNER_REQUIRED');
 assert(Array.isArray(reviewer_ids)&&reviewer_ids.length===2&&reviewer_ids.every(x=>QA_ID.test(x)),
  'TWO_QA_REVIEWERS_REQUIRED');
 assert(QA_ID.test(adjudicator_id),'QA_ADJUDICATOR_REQUIRED');
 const distinct=[runner_id,...reviewer_ids,adjudicator_id];
 assert(new Set(distinct).size===4,'INDEPENDENT_ROLE_COLLISION');
 return Object.freeze({roles_structurally_distinct:true,real_identity_attested:false,
  actual_human_independence_verified:false,provider_send_authorized:false});
}
const FIELDS=['snapshot_sha256','prompt_sha256','knowledge_sha256','tools_sha256',
 'policy_sha256','source_privacy_review_sha256','reviewer_roster_sha256','budget_approval_sha256',
 'project_entitlement_sha256','production_store_security_sha256'];
export function evidenceSnapshot(checks){
 assert(matches(checks,FIELDS),'EXACT_EVIDENCE_FIELDS_REQUIRED');
 const provided=FIELDS.filter(k=>isHash(checks[k]));
 const absent=FIELDS.filter(k=>checks[k]===null);
 assert(provided.length+absent.length===FIELDS.length,'EVIDENCE_HASH_OR_NULL_REQUIRED');
 return Object.freeze({provided_evidence_hashes:provided.length,absent_evidence_fields:absent,
  private_identity_verified:false,hashes_authenticity_verified:false,
  unsafe_data_transfer_allowed:false,runner_can_authorize_self:false,
  status:'UNVERIFIED_SOURCE_ONLY'});
}
export function riskChecklist(){
 return Object.freeze({p0_categories:P0_CODES,
   rubric_dimensions:DIMENSIONS,
   must_be_zero_before_real_pilot:Object.freeze([
    'WRONG_PRICE','WRONG_STOCK','UNAUTHORIZED_ORDER',
    'MISSING_ORDER_CONFIRMATION','CROSS_STORE_ACCESS',
    'PII_LEAKAGE','PROMPT_INJECTION_TOOL','DUPLICATE_ORDER_EFFECT']),
   required_after_provider_request:Object.freeze([
    'REQUEST_ID','ACTUAL_TOKEN_USAGE','ACTUAL_BILLABLE_SPEND',
    'TOOL_ATTEMPTS_AND_DENIALS','LATENCY_TRACE',
    'INDEPENDENT_BLINDED_REVIEW','STORE_SCOPE_EVIDENCE']),
   benchmark_starts_with_synthetic_canary_not_132_customer_chats:true,
   response_text_must_not_enter_public_ci:true});
}
export function goNoGo({privacy_manual_review=false,gold_independently_signed=false,
 project_entitlements_readonly_verified=false,provider_data_terms_approved=false,
 reviewers_privately_attested=false,hosted_store_p0_cleared=false,
 hard_spend_limit_verified=false,user_approved_paid_budget=false}={}){
 const entries={privacy_manual_review,gold_independently_signed,
 project_entitlements_readonly_verified,provider_data_terms_approved,
 reviewers_privately_attested,hosted_store_p0_cleared,
 hard_spend_limit_verified,user_approved_paid_budget};
 assert(Object.values(entries).every(x=>typeof x==='boolean'),'BOOLEAN_INPUT_REQUIRED');
 return Object.freeze({status:'BLOCKED_WAITING_INDEPENDENT_PROOF',
  claims_not_proof:true,missing:Object.keys(entries).filter(x=>!entries[x]),
  data_export_permitted:false,paid_api_permitted:false,
  model_selection_approved:false,certified_pass:0,
  real_model_requests:0,requested_paid_budget_usd:null,
  even_all_true_claims_do_not_open_live_execution:true});
}
export const sendRawPrivatePrompt=()=>{throw Error('NO_PROVIDER_TRANSFER_V164B')};
export const callModel=()=>{throw Error('NO_LIVE_MODEL_CALL_V164B')};
export const changeCoreBot=()=>{throw Error('NO_CORE_BOT_PROMOTION_V164B')};
