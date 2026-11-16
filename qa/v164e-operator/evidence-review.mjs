/**
 * TIEN404 V16.4E — Private 8-case operator review intake schema.
 * No source chat text, redacted chat text, real identities, API keys, provider
 * project IDs or raw screenshots allowed in the PUBLIC repo / runtime.
 * Hash and self-assertions only index evidence; they cannot certify consent.
 */
import {canaryPlan} from '../v164c-canary/canary-budget.mjs';
import {authorizedCanaryDecision} from '../v164d-decision/authorized-canary-decision.mjs';
export const CONTRACT='T404_V164E_8_CASE_PRIVATE_OPERATOR_REVIEW_V1';
const CASE_PLAN=canaryPlan();
const IDS=new Set(CASE_PLAN.cases.map(x=>x.case_key));
const SHA=/^[a-f0-9]{64}$/;
const QA=/^QA_[A-Z0-9_]{2,48}$/;
const KEY_LIST=['case_key','source_sha256','redacted_sha256','gold_sha256',
 'runner_id','privacy_reviewer_1_id','privacy_reviewer_2_id',
 'reviewer_1_receipt_sha256','reviewer_2_receipt_sha256',
 'privacy_classification','consent_basis','manual_context_reviewed',
 'prompt_injection_reviewed','gold_approved_by_both','notes_hash_sha256'];
const ok=(x,e)=>{if(!x)throw Error(e)};
const exact=(x,k)=>x&&typeof x==='object'&&!Array.isArray(x)&&
 Object.keys(x).length===k.length&&k.every(y=>Object.hasOwn(x,y));
const hashOrNull=x=>x===null||typeof x==='string'&&SHA.test(x);
export function createPrivateReviewerTemplate(){
 return Object.freeze({contract:CONTRACT,review_status:'NOT_STARTED',
  human_reviewer_attestations_verified:false,
  instructions:'Complete in restricted PRIVATE location only; no raw data or keys in public repository.',
  cases:Object.freeze(CASE_PLAN.cases.map(c=>Object.freeze({
   case_key:c.case_key,turn_count:c.turn_count,
   source_sha256:null,redacted_sha256:null,gold_sha256:null,
   runner_id:null,privacy_reviewer_1_id:null,privacy_reviewer_2_id:null,
   reviewer_1_receipt_sha256:null,reviewer_2_receipt_sha256:null,
   privacy_classification:'NEEDS_REVIEW',consent_basis:'UNDETERMINED',
   manual_context_reviewed:false,prompt_injection_reviewed:false,
   gold_approved_by_both:false,notes_hash_sha256:null}))),
  provider_transfer_authorized:false,model_calls:0});
}
export function inspectCaseReview(x){
 ok(exact(x,KEY_LIST),'EXACT_PRIVATE_REVIEW_FIELDS_REQUIRED');
 ok(IDS.has(x.case_key),'CANARY_CASE_OUTSIDE_8_ALLOWED');
 for(const k of ['source_sha256','redacted_sha256','gold_sha256',
  'reviewer_1_receipt_sha256','reviewer_2_receipt_sha256','notes_hash_sha256'])
  ok(hashOrNull(x[k]),'REVIEW_HASH_OR_NULL_REQUIRED');
 for(const k of ['runner_id','privacy_reviewer_1_id','privacy_reviewer_2_id'])
  ok(x[k]===null||QA.test(x[k]),'QA_ROLE_ID_REQUIRED');
 if([x.runner_id,x.privacy_reviewer_1_id,x.privacy_reviewer_2_id].every(y=>y!==null))
  ok(new Set([x.runner_id,x.privacy_reviewer_1_id,x.privacy_reviewer_2_id]).size===3,
    'INDEPENDENT_ROLE_COLLISION');
 ok(['NEEDS_REVIEW','SYNTHETIC_CLAIM','POTENTIAL_PII','CONFIRMED_PII'].includes(x.privacy_classification),
  'PRIVATE_CLASSIFICATION_DENIED');
 ok(['UNDETERMINED','SYNTHETIC_NOT_PERSONAL','CONSENT_DOC_CLAIM'].includes(x.consent_basis),
  'CONSENT_BASIS_DENIED');
 for(const k of ['manual_context_reviewed','prompt_injection_reviewed','gold_approved_by_both'])
  ok(typeof x[k]==='boolean','BOOLEAN_PRIVATE_REVIEW_REQUIRED');
 const missing=KEY_LIST.filter(k=>x[k]===null);
 const reasons=[];
 if(missing.length)reasons.push('REVIEW_METADATA_MISSING');
 if(x.privacy_classification!=='SYNTHETIC_CLAIM')reasons.push('PRIVATE_CONTEXT_CLASSIFICATION_UNRESOLVED');
 if(x.consent_basis==='UNDETERMINED')reasons.push('CONSENT_BASIS_UNRESOLVED');
 if(!x.manual_context_reviewed||!x.prompt_injection_reviewed||!x.gold_approved_by_both)
  reasons.push('TWO_HUMAN_REVIEW_AND_GOLD_NOT_ACCEPTED');
 reasons.push('EXTERNAL_REVIEWER_IDENTITY_AND_SIGNATURE_UNVERIFIED');
 return Object.freeze({case_key:x.case_key,status:'NEEDS_EXTERNAL_PRIVATE_ATTESTATION',
  claimed_complete:reasons.length===1&&missing.length===0,
  missing_fields:Object.freeze(missing),risk_reasons:Object.freeze(reasons),
  actual_independent_review_certified:false,allow_external_provider_transfer:false});
}
export function assessEightCaseBundle({contract=CONTRACT,cases}={}){
 ok(contract===CONTRACT,'REVIEW_BUNDLE_CONTRACT_DRIFT');
 ok(Array.isArray(cases)&&cases.length===8,'EXACTLY_EIGHT_REVIEW_RECORDS');
 const seen=new Set();const rows=[];
 for(const row of cases){
  ok(!seen.has(row?.case_key),'DUPLICATE_CANARY_REVIEW');
  const result=inspectCaseReview(row);seen.add(row.case_key);rows.push(result);
 }
 ok([...IDS].every(id=>seen.has(id)),'CANARY_CASE_SET_MISMATCH');
 const declaredComplete=rows.filter(x=>x.claimed_complete).length;
 return Object.freeze({status:'NO_GO_PROVIDER_TRANSFER',
  case_count:8,claimed_completed_private_review_cases:declaredComplete,
  independently_attested_cases:0,
  incomplete_case_keys:Object.freeze(rows.filter(x=>!x.claimed_complete).map(x=>x.case_key)),
  actual_account_model_entitlement_verified:false,
  new_authorized_model_budget_usd:0,
  all_claims_require_external_operator_acceptance:true,
  canary_model_results_run:0,canary_live_calls:0});
}
export function nextActionFromReviews(reviewBundle){
 const x=assessEightCaseBundle(reviewBundle);
 const modelDecision=authorizedCanaryDecision();
 return Object.freeze({status:'NO_GO_REAL_CANARY',case_review_progress_claims:x.claimed_completed_private_review_cases,
  missing_go_gates:modelDecision.missing_authorization,
  next_action:x.incomplete_case_keys.length?
    'TWO_INDEPENDENT_PRIVACY_REVIEWERS_REVIEW_EIGHT_CASES_LOCALLY':
    'TRUSTED_OPERATOR_VERIFY_SIGNATURES_ACCOUNT_SCOPE_AND_USD_CAP',
  paid_executor_exists:false,canary_request_count_completed:0});
}
export const shipRedactedCorpus=()=>{throw Error('V164E_PRIVATE_CORPUS_SEND_DISABLED')};
export const certifyPrivateApprovals=()=>{throw Error('V164E_NO_SELF_CERTIFIED_REVIEW')};
