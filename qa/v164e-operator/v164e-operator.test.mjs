import test from 'node:test';import assert from 'node:assert/strict';
import {OBSERVATION,providerRouteReview,verifyOperatorFacts,invokeGatewayModel,openProviderCredential} from './gateway-route-evidence.mjs';
import {createPrivateReviewerTemplate,inspectCaseReview,assessEightCaseBundle,nextActionFromReviews,
 shipRedactedCorpus,certifyPrivateApprovals,CONTRACT} from './evidence-review.mjs';
const denied=(fn,re)=>assert.throws(fn,re);
const h='a'.repeat(64);
const base=createPrivateReviewerTemplate();
const filled=(row)=>({...row,source_sha256:h,redacted_sha256:'b'.repeat(64),
 gold_sha256:'c'.repeat(64),runner_id:'QA_RUNNER_ONE',privacy_reviewer_1_id:'QA_REVIEWER_ONE',
 privacy_reviewer_2_id:'QA_REVIEWER_TWO',reviewer_1_receipt_sha256:'d'.repeat(64),
 reviewer_2_receipt_sha256:'e'.repeat(64),privacy_classification:'SYNTHETIC_CLAIM',
 consent_basis:'SYNTHETIC_NOT_PERSONAL',manual_context_reviewed:true,
 prompt_injection_reviewed:true,gold_approved_by_both:true,notes_hash_sha256:'f'.repeat(64)});
const facts={route:'N8N_GATEWAY',provider:'openai',model_id:'gpt-6-luna',
 visibility_evidence_sha256:h,quota_evidence_sha256:h,billing_evidence_sha256:h,
 terms_evidence_sha256:h,operator_role_evidence_sha256:h,
 independent_reviewer_evidence_sha256:h};
test('01 n8n Gateway read-only coverage observed',()=>assert.equal(OBSERVATION.gateway_credentials_available,true));
test('02 Gateway OpenAI credential type found',()=>assert(OBSERVATION.supported_credential_types.includes('openAiApi')));
test('03 Gateway Gemini credential type found',()=>assert(OBSERVATION.supported_credential_types.includes('googlePalmApi')));
test('04 Gateway OpenAI chat node covered',()=>assert.equal(providerRouteReview({route:'N8N_GATEWAY',provider:'openai'}).gateway_chat_node_covered,true));
test('05 Gateway Gemini chat node covered',()=>assert.equal(providerRouteReview({route:'N8N_GATEWAY',provider:'google'}).gateway_chat_node_covered,true));
test('06 direct provider is NOT certified by n8n Gateway',()=>assert.equal(providerRouteReview({route:'DIRECT_PROVIDER',provider:'google'}).gateway_chat_node_covered,false));
test('07 exact model entitlement remains null',()=>assert.equal(providerRouteReview({model_id:'gpt-6-luna'}).exact_model_available_to_tien404,null));
test('08 provider project rpm remains unknown',()=>assert.equal(providerRouteReview().project_rpm,null));
test('09 provider data terms not approved',()=>assert.equal(providerRouteReview().provider_data_terms_approved,false));
test('10 no model call occurred for read only gateway coverage',()=>assert.equal(OBSERVATION.provider_api_calls_for_this_check,0));
test('11 route allowlist rejects unsupported',()=>denied(()=>providerRouteReview({route:'UNKNOWN'}),/ROUTE_NOT_ALLOWLISTED/));
test('12 provider allowlist rejects unsupported',()=>denied(()=>providerRouteReview({provider:'unsupported'}),/PROVIDER_NOT_ALLOWLISTED/));
test('13 model ID cannot be raw secret',()=>denied(()=>providerRouteReview({model_id:'a'.repeat(500)}),/MODEL_ID_FORMAT_REQUIRED/));
test('14 operator facts may be indexed but never certified',()=>assert.equal(verifyOperatorFacts(facts).real_model_entitlement_certified,false));
test('15 all evidence hashes do not open live API',()=>assert.equal(verifyOperatorFacts(facts).live_execution_authorized,false));
test('16 blank evidence is listed as missing',()=>assert.equal(verifyOperatorFacts({...facts,billing_evidence_sha256:null}).missing_evidence[0],'billing_evidence_sha256'));
test('17 credential injection rejected',()=>denied(()=>verifyOperatorFacts({...facts,api_key:'xxx'}),/EXACT_EVIDENCE_FACTS_REQUIRED/));
test('18 malformed quota hash rejected',()=>denied(()=>verifyOperatorFacts({...facts,quota_evidence_sha256:'invalid'}),/EVIDENCE_SHA_OR_NULL_REQUIRED/));
test('19 no Gateway paid API method',()=>denied(invokeGatewayModel,/GATEWAY_PAID_CALL_DISABLED/));
test('20 no credential read method',()=>denied(openProviderCredential,/NO_CREDENTIAL_READ/));
test('21 private reviewer template has 8 cases',()=>assert.equal(base.cases.length,8));
test('22 template contains only 8 unique IDs',()=>assert.equal(new Set(base.cases.map(x=>x.case_key)).size,8));
test('23 all templates NOT REVIEWED',()=>assert(base.cases.every(x=>x.privacy_classification==='NEEDS_REVIEW')));
test('24 template contains no transcripts',()=>assert(base.cases.every(x=>!Object.hasOwn(x,'prompt'))));
test('25 template cannot authorize provider transfer',()=>assert.equal(base.provider_transfer_authorized,false));
test('26 default bundle NO GO',()=>assert.equal(assessEightCaseBundle(base).status,'NO_GO_PROVIDER_TRANSFER'));
test('27 default 8 cases have 0 approvals',()=>assert.equal(assessEightCaseBundle(base).claimed_completed_private_review_cases,0));
test('28 default 8 cases have missing metadata',()=>assert(inspectCaseReview(base.cases[0]).missing_fields.length>0));
test('29 one review filled is claimed complete but not certified',()=>assert.equal(inspectCaseReview(filled(base.cases[0])).claimed_complete,true));
test('30 eight forged all complete reviews still never certified',()=>{
 const x=assessEightCaseBundle({...base,cases:base.cases.map(filled)});
 assert.equal(x.claimed_completed_private_review_cases,8);
 assert.equal(x.independently_attested_cases,0);
 assert.equal(x.status,'NO_GO_PROVIDER_TRANSFER');
});
test('31 account rights remain unverified after fake reviews',()=>assert.equal(assessEightCaseBundle({...base,cases:base.cases.map(filled)}).actual_account_model_entitlement_verified,false));
test('32 no real canary result produced',()=>assert.equal(assessEightCaseBundle(base).canary_model_results_run,0));
test('33 duplicate case rejected',()=>denied(()=>assessEightCaseBundle({...base,cases:[base.cases[0],...base.cases.slice(0,7)]}),/DUPLICATE_CANARY_REVIEW/));
test('34 wrong count rejected',()=>denied(()=>assessEightCaseBundle({...base,cases:base.cases.slice(0,7)}),/EXACTLY_EIGHT/));
test('35 unknown case rejected',()=>denied(()=>inspectCaseReview({...base.cases[0],case_key:'SINGLE:QA99'}),/OUTSIDE_8_ALLOWED/));
test('36 private customer text field rejected',()=>denied(()=>inspectCaseReview({...base.cases[0],phone:'0987654321'}),/EXACT_PRIVATE_REVIEW_FIELDS/));
test('37 runner cannot self review',()=>denied(()=>inspectCaseReview({...filled(base.cases[0]),privacy_reviewer_1_id:'QA_RUNNER_ONE'}),/INDEPENDENT_ROLE_COLLISION/));
test('38 same reviewer twice rejected',()=>denied(()=>inspectCaseReview({...filled(base.cases[0]),privacy_reviewer_2_id:'QA_REVIEWER_ONE'}),/INDEPENDENT_ROLE_COLLISION/));
test('39 PII confirmed fails closed',()=>assert.equal(inspectCaseReview({...filled(base.cases[0]),privacy_classification:'CONFIRMED_PII'}).claimed_complete,false));
test('40 manual review false fails closed',()=>assert.equal(inspectCaseReview({...filled(base.cases[0]),manual_context_reviewed:false}).claimed_complete,false));
test('41 nonboolean reviewer flag rejected',()=>denied(()=>inspectCaseReview({...base.cases[0],manual_context_reviewed:'yes'}),/BOOLEAN_PRIVATE_REVIEW_REQUIRED/));
test('42 invalid receipt hash rejected',()=>denied(()=>inspectCaseReview({...base.cases[0],reviewer_1_receipt_sha256:'bad'}),/REVIEW_HASH_OR_NULL_REQUIRED/));
test('43 fake 8 approvals cannot enable paid model call',()=>assert.equal(nextActionFromReviews({...base,cases:base.cases.map(filled)}).paid_executor_exists,false));
test('44 zero readiness means two private reviewers needed',()=>assert.equal(nextActionFromReviews(base).next_action,'TWO_INDEPENDENT_PRIVACY_REVIEWERS_REVIEW_EIGHT_CASES_LOCALLY'));
test('45 true-looking all-reviewed claims require external operator',()=>assert.equal(nextActionFromReviews({...base,cases:base.cases.map(filled)}).next_action,'TRUSTED_OPERATOR_VERIFY_SIGNATURES_ACCOUNT_SCOPE_AND_USD_CAP'));
test('46 no private customer corpus send',()=>denied(shipRedactedCorpus,/PRIVATE_CORPUS_SEND_DISABLED/));
test('47 no self-certified privacy acceptance',()=>denied(certifyPrivateApprovals,/NO_SELF_CERTIFIED_REVIEW/));
test('48 QA contract unchanged',()=>assert.equal(base.contract,CONTRACT));
