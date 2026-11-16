/**
 * TIEN404 V16.4D: one-shot authorization DECISION, not authorization executor.
 * This is never a paid model API client. All "provided" fields are assertions;
 * human/operator identity and account authenticity require separate verification.
 */
import {canaryPlan,simulateEightCaseCanary} from '../v164c-canary/canary-budget.mjs';
import {MODEL_CATALOG} from '../v164-private-ab/model-catalog-readiness.mjs';
export const CONTRACT='T404_V164D_AUTHORIZED_CANARY_DECISION_NO_EXECUTOR_V1';
const REQUIRED=Object.freeze([
 'independent_case_privacy_acceptance',
 'dataset_and_redacted_source_provenance',
 'approved_golden_behavior',
 'verified_project_model_entitlement',
 'verified_project_rpm_tpm_rpd',
 'provider_data_terms_approved',
 'independent_operator_authority',
 'signed_specific_budget_approval',
 'durable_atomic_budget_and_kill_switch',
 'reconciled_provider_spend_reporting',
 'frozen_tool_mocks_no_order_writes',
 'hosted_store_security_authorized_for_real_commerce'
]);
const assert=(ok,msg)=>{if(!ok)throw Error(msg)};
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&
 Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k));
const positiveCents=n=>Number.isSafeInteger(n)&&n>=0&&n<=100000;
export function emptyCanaryEvidence(){
 return Object.freeze(Object.fromEntries(REQUIRED.map(x=>[x,null])));
}
export function decisionProofMatrix(input=emptyCanaryEvidence()){
 assert(exact(input,REQUIRED),'EXACT_PRIVATE_DECISION_PROOFS_REQUIRED');
 for(const key of REQUIRED)assert(input[key]===null||input[key]===true||input[key]===false,
  'EVIDENCE_VALUES_BOOLEAN_OR_NULL_REQUIRED');
 const absent=REQUIRED.filter(k=>input[k]!==true);
 return Object.freeze({required:REQUIRED.length,self_attested_true:REQUIRED.length-absent.length,
  missing_or_unverified:Object.freeze(absent),no_independent_external_signing_in_source:true,
  gates_trusted:false,
  status:'NO_GO_PAID_SOURCE_ONLY'});
}
export function requestedBudget({provider_cents={openai:0,google:0},
 total_cents=0,expiry_utc=null,approval_evidence_sha256=null}={}){
 assert(exact(provider_cents,['openai','google']),'EXACT_PROVIDER_BUDGET_SCOPE');
 assert(positiveCents(provider_cents.openai)&&positiveCents(provider_cents.google)
  &&positiveCents(total_cents),'BUDGET_CENTS_INTEGER_REQUIRED');
 assert(total_cents>=provider_cents.openai+provider_cents.google,'BUDGET_ALLOCATION_EXCEEDS_TOTAL');
 assert(expiry_utc===null||(
  typeof expiry_utc==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(expiry_utc)
  &&!Number.isNaN(Date.parse(expiry_utc))),'INVALID_BUDGET_EXPIRY');
 assert(approval_evidence_sha256===null||(
  typeof approval_evidence_sha256==='string'&&/^[a-f0-9]{64}$/.test(approval_evidence_sha256)),
  'INVALID_APPROVAL_EVIDENCE_HASH');
 return Object.freeze({total_requested_usd:total_cents/100,
  requested_openai_usd:provider_cents.openai/100,
  requested_google_usd:provider_cents.google/100,
  approval_evidence_present:approval_evidence_sha256!==null,
  budget_independently_approved:false,
  vendor_billing_hard_stop_verified:false,
  expiry_utc,
  actual_authorized_paid_usd:0,
  paid_executor_present:false});
}
export function authorizedCanaryDecision({proofs=emptyCanaryEvidence(),budget,model_ids}={}){
 const p=decisionProofMatrix(proofs);
 const b=requestedBudget(budget);
 const candidateIds=Array.isArray(model_ids)?model_ids:MODEL_CATALOG.map(x=>x.model_id);
 assert(candidateIds.length>=1&&candidateIds.length<=3
  &&new Set(candidateIds).size===candidateIds.length&&candidateIds.every(id=>
   MODEL_CATALOG.some(x=>x.model_id===id)),'INVALID_CANDIDATE_MODEL_SET');
 const sourcePlan=canaryPlan();
 const simulated=simulateEightCaseCanary();
 const missing=[...p.missing_or_unverified];
 if(b.total_requested_usd<=0)missing.push('NO_EXPLICIT_ONE_SHOT_USD_APPROVAL');
 if(!b.approval_evidence_present)missing.push('NO_APPROVAL_EVIDENCE_FINGERPRINT');
 // Even a fake "all true" matrix or provided hash can't authorize real APIs.
 missing.push('EXTERNAL_TRUSTED_OPERATOR_DECISION_NOT_ACCEPTED');
 missing.push('REAL_PROVIDER_CALL_EXECUTOR_INTENTIONALLY_ABSENT');
 return Object.freeze({contract:CONTRACT,requested_release:'V16.4C_TO_V16.4D_PRIVATE_CANARY',
  status:'NO_GO_PAID_CANARY',canary_case_count:sourcePlan.case_count,
  planned_pairs_per_3_candidates:sourcePlan.pairs_count,
  chosen_model_count:candidateIds.length,
  minimum_requests_for_chosen_models:sourcePlan.min_requests_per_model*candidateIds.length,
  real_provider_requests:0,real_provider_spend_usd:0,
  case_model_pairs_completed:0,model_qa_certified_pass:0,
  missing_authorization:Object.freeze(missing),
  approval_source:'NO_INDEPENDENT_OPERATOR_EVIDENCE',
  synthetic_simulated_amount_usd:simulated.simulated_micro_usd_total/1e6,
  simulated_ledger_not_durable:true,
  paid_budget_authorized_usd:0,
  data_transfer_authorized:false,live_webhook_write_authorized:false,
  production_promotion_authorized:false,rollback:'CLOSE_CHILD_DRAFT_PR',
  next_safe_action:'PRIVATE_OPERATOR_REVIEW_WITH_NONSECRET_EVIDENCE'});
}
export const runPaidCanary=()=>{throw Error('V164D_PAID_CANARY_DISABLED')};
export const sendCustomerCorpus=()=>{throw Error('V164D_NO_PRIVATE_DATA_PROVIDER_TRANSFER')};
export const modifyPublishedBot=()=>{throw Error('V164D_NO_PUBLISHED_CORE_MODEL_CHANGE')};
