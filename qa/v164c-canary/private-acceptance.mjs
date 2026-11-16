/**
 * TIEN404 V16.4C privacy and provider-account evidence INTAKE — source-only.
 * Hashes, reviewer-role claims and Dashboard screenshots are NOT independently
 * verified attestations. NO customer content, account ID, secrets or API calls.
 */
import {SINGLE_CASES,MULTI_PACK} from '../v163-studios/manifest-132.mjs';
import {MODEL_CATALOG} from '../v164-private-ab/model-catalog-readiness.mjs';
export const CONTRACT='T404_V164C_PRIVATE_ACCEPTANCE_ATTESTATION_NO_CALL_V1';
const HEX=/^[0-9a-f]{64}$/;
const QA_ID=/^QA_[A-Z0-9_]{2,48}$/;
const goodHash=s=>typeof s==='string'&&HEX.test(s);
const requireYes=(cond,code)=>{if(!cond)throw Error(code)};
const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&
 Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const CASES=new Set([...SINGLE_CASES.map(x=>'SINGLE:'+x.case_id),
 ...MULTI_PACK.map(x=>'MULTI:'+x.case_id)]);
const CLASSIFICATIONS=['SYNTHETIC_ASSERTED','POTENTIAL_PII','PII_CONFIRMED','NEEDS_MANUAL_REVIEW'];
const privacyFields=['case_key','source_sha256','redacted_sha256','reviewer_id',
 'runner_id','classification','review_record_sha256','consent_proof_sha256'];
const accountFields=['provider','model_id','route','model_access_sha256','rpm_tpm_rpd_sha256',
 'spend_cap_sha256','terms_sha256','reviewer_id','operator_id','observed_at_utc'];
function checkPrivacy(x){
 requireYes(exact(x,privacyFields),'PRIVATE_REVIEW_EXACT_FIELDS');
 requireYes(CASES.has(x.case_key),'UNKNOWN_PRIVATE_CASE');
 requireYes([x.source_sha256,x.redacted_sha256,x.review_record_sha256].every(goodHash),
  'SOURCE_AND_REVIEW_HASH_REQUIRED');
 requireYes(x.consent_proof_sha256===null||goodHash(x.consent_proof_sha256),'CONSENT_HASH_OR_NULL');
 requireYes(QA_ID.test(x.reviewer_id)&&QA_ID.test(x.runner_id)&&x.reviewer_id!==x.runner_id,
  'SEPARATE_QA_REVIEWER_REQUIRED');
 requireYes(CLASSIFICATIONS.includes(x.classification),'PRIVATE_CLASSIFICATION_REQUIRED');
}
export function newPrivacyClaimLedger(){
 const claims=new Map(),usedReviewHashes=new Set();
 function submit(x){
  checkPrivacy(x);
  requireYes(!usedReviewHashes.has(x.review_record_sha256),'REVIEW_EVIDENCE_REPLAY_DENIED');
  const existing=claims.get(x.case_key)||[];
  requireYes(existing.length<2,'MAX_TWO_PRIVACY_REVIEWS');
  requireYes(existing.every(y=>y.reviewer_id!==x.reviewer_id),'DUPLICATE_PRIVACY_REVIEWER');
  requireYes(existing.every(y=>y.source_sha256===x.source_sha256&&y.redacted_sha256===x.redacted_sha256),
   'PRIVATE_SOURCE_VERSION_MISMATCH');
  usedReviewHashes.add(x.review_record_sha256);
  claims.set(x.case_key,[...existing,Object.freeze({...x})]);
  return Object.freeze({accepted_metadata_claim:true,independent_human_verified:false,
   provider_transfer_allowed:false});
 }
 function status(case_key){
  requireYes(CASES.has(case_key),'UNKNOWN_PRIVATE_CASE');
  const rows=claims.get(case_key)||[];
  if(rows.length!==2)return Object.freeze({status:'NEEDS_TWO_PRIVATE_REVIEWERS',
   reviews:rows.length,independently_accepted:false,provider_transfer_allowed:false});
  const classifications=[...new Set(rows.map(x=>x.classification))];
  return Object.freeze({status:classifications.length!==1||classifications[0]!=='SYNTHETIC_ASSERTED'?
   'PII_RISK_OR_REVIEW_DISAGREEMENT':'TWO_REVIEWER_CLAIMS_AWAITING_EXTERNAL_ATTESTATION',
   reviews:2,reviewer_ids_verified:false,source_authenticity_verified:false,
   consent_proven:false,independently_accepted:false,provider_transfer_allowed:false});
 }
 return Object.freeze({submit,status,no_network:true});
}
function checkAccount(x){
 requireYes(exact(x,accountFields),'ACCOUNT_EVIDENCE_EXACT_FIELDS');
 requireYes(MODEL_CATALOG.some(m=>m.provider===x.provider&&m.model_id===x.model_id),'UNKNOWN_PROVIDER_MODEL');
 requireYes(['DIRECT_PROVIDER','N8N_GATEWAY'].includes(x.route),'ACCOUNT_ROUTE_REQUIRED');
 requireYes([x.model_access_sha256,x.rpm_tpm_rpd_sha256,x.spend_cap_sha256,x.terms_sha256].every(
  z=>z===null||goodHash(z)),'ACCOUNT_SHA_OR_NULL_REQUIRED');
 requireYes(QA_ID.test(x.reviewer_id)&&QA_ID.test(x.operator_id)&&x.reviewer_id!==x.operator_id,
  'ACCOUNT_REVIEWER_SEPARATION_REQUIRED');
 requireYes(typeof x.observed_at_utc==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(x.observed_at_utc)&&
  !Number.isNaN(Date.parse(x.observed_at_utc)),'ACCOUNT_TIMESTAMP_REQUIRED');
}
export function inspectProviderAccountClaims(x){
 checkAccount(x);
 const incomplete=['model_access_sha256','rpm_tpm_rpd_sha256','spend_cap_sha256','terms_sha256']
  .filter(k=>x[k]===null);
 return Object.freeze({route:x.route,
  status:'ACCOUNT_EVIDENCE_UNVERIFIED',
  missing_proof_kinds:Object.freeze(incomplete),
  direct_provider_entitlement_verified:false,
  n8n_gateway_balance_is_not_model_entitlement:true,
  credential_scope_verified:false,project_quotas_verified:false,
  vendor_spend_cap_enforced_verified:false,
  external_reviewer_authenticity_verified:false,
  real_paid_call_allowed:false});
}
export function independentAcceptanceDecision({privacy_case_reviews=0,
 approved_private_cases=0,account_evidence_verified=false,
 provider_terms_approved=false,hard_budget_approved=false,
 independent_human_attestation_verified=false}={}){
 requireYes(Number.isSafeInteger(privacy_case_reviews)&&privacy_case_reviews>=0&&privacy_case_reviews<=132,
  'INVALID_CASE_REVIEW_COUNT');
 requireYes(Number.isSafeInteger(approved_private_cases)&&approved_private_cases>=0&&
  approved_private_cases<=privacy_case_reviews,'INVALID_PRIVACY_APPROVAL_COUNT');
 requireYes([account_evidence_verified,provider_terms_approved,hard_budget_approved,
   independent_human_attestation_verified].every(x=>typeof x==='boolean'),'BOOLEAN_GATES_REQUIRED');
 return Object.freeze({status:'NO_GO_CANNOT_SELF_CERTIFY',
  claimed_privacy_reviews:privacy_case_reviews,claimed_private_cases:approved_private_cases,
  self_report_is_not_independent_evidence:true,
  verified_external_human_acceptance:false,verified_account_entitlement:false,
  funded_capped_executor_present:false,provider_upload_permitted:false,
  paid_canary_permitted:false,model_quality_certified:false});
}
export const authorizeExternalUpload=()=>{throw Error('V164C_PRIVATE_TRANSFER_DISABLED')};
export const certifySelfReport=()=>{throw Error('V164C_NO_SELF_CERTIFICATION')};
