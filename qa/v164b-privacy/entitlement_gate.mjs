/**
 * V16.4B Account entitlement PRE-FLIGHT (public-doc only).
 * This source cannot authenticate to OpenAI/Gemini accounts, check credits,
 * use secret API keys, submit model calls or certify a self-reported screenshot.
 * No project ID, organization ID, API key, person or merchant info allowed.
 */
import {MODEL_CATALOG,datasetRequestShape} from '../v164-private-ab/model-catalog-readiness.mjs';
export const CONTRACT='T404_V164B_ENTITLEMENT_PREFLIGHT_NO_CALL_V1';
export const PUBLIC_DOC_DATE='2026-11-16';
const check=(x,msg)=>{if(!x)throw Error(msg)};
const HEX=/^[0-9a-f]{64}$/;
const PROOF_KINDS=new Set(['MODEL_VISIBILITY','PROJECT_RATE_LIMITS','PROJECT_BUDGET','DATA_PROCESSING_POLICY','MODEL_FUNCTION_CALLING']);
const evidenceFields=['provider','model_id','proof_kind','evidence_sha256','observer_role','source_view','reviewed_at_utc','contains_no_secrets'];
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const model=(provider,id)=>MODEL_CATALOG.find(x=>x.provider===provider&&x.model_id===id);
const ISO=(s)=>typeof s==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(s)&&!Number.isNaN(Date.parse(s));
export function publicModelDocsSnapshot(){
 return Object.freeze({as_of:PUBLIC_DOC_DATE,kind:'PUBLIC_DOCUMENTATION_ONLY',
  models:Object.freeze(MODEL_CATALOG.map(m=>Object.freeze({provider:m.provider,id:m.model_id,
   price_input_usd_per_million:m.input_usd_per_1m,
   price_output_usd_per_million:m.output_usd_per_1m,
   documented_status:m.model_status,docs_url:m.docs,
   user_project_entitlement:'NOT_VERIFIED',
   user_project_rpm:null,user_project_tpm:null,user_project_budget:null,
   eligible_for_live_call:false})))});
}
export function entitlementRequiredViews(){
 return Object.freeze({
  openai:Object.freeze([
   'SELECT_CORRECT_ORGANIZATION_AND_PROJECT',
   'CHECK_MODEL_VISIBLE_IN_PROJECT_SAME_CREDENTIAL_CONTEXT',
   'CHECK_RATE_LIMITS_AND_TIER',
   'CHECK_PROJECT_HARD_SPEND_LIMIT',
   'CHECK_DATA_RETENTION_AND_PROCESSING_POLICY']),
  google:Object.freeze([
   'CHECK_CORRECT_AI_STUDIO_PROJECT',
   'CHECK_MODEL_AVAILABILITY_FOR_EXISTING_OR_NEW_PROJECT',
   'CHECK_RATE_LIMITS_RPM_TPM_RPD',
   'CHECK_BILLING_AND_FREE_TIER_DATA_USE',
   'CHECK_FUNCTION_CALLING_API_COMPATIBILITY']),
  disallowed_evidence:Object.freeze(['API_KEY','SECRET','CREDENTIAL_ID','RAW_SCREENSHOT_WITH_PII',
   'PROJECT_ID_IN_PUBLIC_GITHUB','ACCOUNT_NUMBER','CUSTOMER_MESSAGES']),
  n8n_gateway_credits_not_equivalent_to_direct_provider_entitlement:true
 });
}
/** An evidence *index*, not an account authenticity verifier. */
export function inspectSubmittedIndex(record){
 check(exact(record,evidenceFields),'ENTITLEMENT_EXACT_REDACTED_METADATA_REQUIRED');
 check(!!model(record.provider,record.model_id),'UNSUPPORTED_MODEL_OR_PROVIDER');
 check(PROOF_KINDS.has(record.proof_kind),'UNKNOWN_PROOF_KIND');
 check(typeof record.evidence_sha256==='string'&&HEX.test(record.evidence_sha256),'PROOF_HASH_REQUIRED');
 check(['QA_OPERATOR','QA_EXTERNAL_REVIEWER'].includes(record.observer_role),'PROOF_OBSERVER_ROLE_REQUIRED');
 check(['OPENAI_DASHBOARD','GOOGLE_AI_STUDIO','PRIVATE_SECURITY_REVIEW'].includes(record.source_view),'PROOF_SOURCE_VIEW_REQUIRED');
 check(ISO(record.reviewed_at_utc),'REVIEW_TIMESTAMP_REQUIRED');
 check(record.contains_no_secrets===true,'SECRET_SCREENSHOT_NOT_ACCEPTED');
 return Object.freeze({status:'EVIDENCE_INDEX_RECEIVED_BUT_UNVERIFIED',
  model_id:record.model_id,proof_kind:record.proof_kind,
  hash_verifies_authenticity:false,viewer_identity_verified:false,
  provider_account_access_verified:false,model_available_to_project:null,
  rpm:null,tpm:null,billing_status:null,
  model_call_allowed:false});
}
export function readinessMatrix({indexes=[]}={}){
 check(Array.isArray(indexes)&&indexes.length<=30,'INDEX_COUNT_BOUND');
 const parsed=indexes.map(inspectSubmittedIndex);
 return Object.freeze({contract:CONTRACT,as_of:PUBLIC_DOC_DATE,
  submitted_evidence_metadata_count:parsed.length,
  user_project_entitlement_status:'BLOCKED_AWAITING_INDEPENDENT_PRIVATE_ATTESTATION',
  available_rpm:null,available_tpm:null,
  genuine_merchant_data_transfer_allowed:false,
  executable_model_calls:0,
  all_evidence_hashes_are_self_reported:true,
  approved_spend_usd:null,
  final_go:false,
  request_plan_minimum:datasetRequestShape().min_model_requests_for_full_sequential_replay,
  blockers:Object.freeze(['PROVIDER_PROJECT_MODEL_ACCESS_NOT_VERIFIED',
   'RPM_TPM_RPD_NOT_VERIFIED','REAL_BILLING_SPEND_STOP_NOT_VERIFIED',
   'DATA_PROCESSING_AND_RETENTION_NOT_APPROVED',
   'INDEPENDENT_HUMAN_ACCOUNT_REVIEW_NOT_COMPLETED',
   'PRIVATE_DATASET_REVIEW_NOT_APPROVED']),
  note:'A proof hash or all-true user flags cannot grant actual API access or paid inference'});
}
export const invokeProvider=()=>{throw Error('V164B_PAID_PROVIDER_CALL_DISABLED')};
export const readSecrets=()=>{throw Error('V164B_CREDENTIAL_ACCESS_DISABLED')};
export const approvePaidBenchmark=()=>{throw Error('V164B_PAID_BENCHMARK_REQUIRES_SEPARATE_AUTHORIZATION')};
