import test from 'node:test';import assert from 'node:assert/strict';
import {newPrivacyClaimLedger,inspectProviderAccountClaims,independentAcceptanceDecision,
 authorizeExternalUpload,certifySelfReport} from './private-acceptance.mjs';
import {CASE_KEYS,canaryPlan,syntheticTokenQuote,newSyntheticBudget,
 simulateEightCaseCanary,executePaidCanary,allowProviderPromptUpload,updatePublishedModel} from './canary-budget.mjs';
const sha=x=>x.repeat(64),thrown=(fn,re)=>assert.throws(fn,re);
const review={
 case_key:'SINGLE:QA01',source_sha256:sha('a'),redacted_sha256:sha('b'),
 reviewer_id:'QA_REVIEWER_ALPHA',runner_id:'QA_RUNNER_1',classification:'SYNTHETIC_ASSERTED',
 review_record_sha256:sha('c'),consent_proof_sha256:null};
const proof={provider:'openai',model_id:'gpt-6-luna',route:'DIRECT_PROVIDER',
 model_access_sha256:sha('a'),rpm_tpm_rpd_sha256:sha('b'),
 spend_cap_sha256:sha('c'),terms_sha256:sha('d'),
 reviewer_id:'QA_PROVIDER_REVIEWER',operator_id:'QA_PROVIDER_OPERATOR',
 observed_at_utc:'2026-11-16T12:00:00Z'};
test('01 privacy ledger accepts metadata only',()=>assert.equal(newPrivacyClaimLedger().submit(review).accepted_metadata_claim,true));
test('02 review is not verified by internal ledger',()=>assert.equal(newPrivacyClaimLedger().submit(review).independent_human_verified,false));
test('03 review cannot authorize upload',()=>assert.equal(newPrivacyClaimLedger().submit(review).provider_transfer_allowed,false));
test('04 one review not sufficient',()=>{
 const l=newPrivacyClaimLedger();l.submit(review);
 assert.equal(l.status(review.case_key).status,'NEEDS_TWO_PRIVATE_REVIEWERS');
});
test('05 two claimed synthetic reviewer approvals remain noncertified',()=>{
 const l=newPrivacyClaimLedger();l.submit(review);
 l.submit({...review,reviewer_id:'QA_REVIEWER_BETA',review_record_sha256:sha('d')});
 assert.equal(l.status(review.case_key).status,'TWO_REVIEWER_CLAIMS_AWAITING_EXTERNAL_ATTESTATION');
 assert.equal(l.status(review.case_key).independently_accepted,false);
});
test('06 opposite privacy classification requires further scrutiny',()=>{
 const l=newPrivacyClaimLedger();l.submit(review);
 l.submit({...review,reviewer_id:'QA_REVIEWER_BETA',review_record_sha256:sha('d'),classification:'POTENTIAL_PII'});
 assert.equal(l.status(review.case_key).status,'PII_RISK_OR_REVIEW_DISAGREEMENT');
});
test('07 confirmed PII is never accepted',()=>{
 const l=newPrivacyClaimLedger();l.submit({...review,classification:'PII_CONFIRMED'});
 l.submit({...review,reviewer_id:'QA_REVIEWER_BETA',review_record_sha256:sha('d'),classification:'PII_CONFIRMED'});
 assert.equal(l.status(review.case_key).provider_transfer_allowed,false);
});
test('08 reviewer and runner must differ',()=>thrown(()=>newPrivacyClaimLedger().submit({...review,reviewer_id:'QA_RUNNER_1'}),/SEPARATE_QA/));
test('09 raw prompt injection rejected',()=>thrown(()=>newPrivacyClaimLedger().submit({...review,raw_prompt:'private'}),/EXACT_FIELDS/));
test('10 phone field rejected',()=>thrown(()=>newPrivacyClaimLedger().submit({...review,customer_phone:'not permitted'}),/EXACT_FIELDS/));
test('11 unknown case rejected',()=>thrown(()=>newPrivacyClaimLedger().submit({...review,case_key:'SINGLE:QA999'}),/UNKNOWN_PRIVATE_CASE/));
test('12 invalid source hash rejected',()=>thrown(()=>newPrivacyClaimLedger().submit({...review,source_sha256:'bad'}),/HASH_REQUIRED/));
test('13 invalid consent proof rejected',()=>thrown(()=>newPrivacyClaimLedger().submit({...review,consent_proof_sha256:'bad'}),/CONSENT_HASH_OR_NULL/));
test('14 replay same evidence denied',()=>{
 const l=newPrivacyClaimLedger();l.submit(review);
 thrown(()=>l.submit({...review,reviewer_id:'QA_REVIEWER_BETA'}),/REVIEW_EVIDENCE_REPLAY/);
});
test('15 duplicate reviewer denied',()=>{
 const l=newPrivacyClaimLedger();l.submit(review);
 thrown(()=>l.submit({...review,review_record_sha256:sha('d')}),/DUPLICATE_PRIVACY_REVIEWER/);
});
test('16 mismatched redacted snapshot denied',()=>{
 const l=newPrivacyClaimLedger();l.submit(review);
 thrown(()=>l.submit({...review,reviewer_id:'QA_REVIEWER_BETA',redacted_sha256:sha('e'),review_record_sha256:sha('d')}),/PRIVATE_SOURCE_VERSION_MISMATCH/);
});
test('17 no third privacy reviewer on same case',()=>{
 const l=newPrivacyClaimLedger();l.submit(review);
 l.submit({...review,reviewer_id:'QA_REVIEWER_BETA',review_record_sha256:sha('d')});
 thrown(()=>l.submit({...review,reviewer_id:'QA_REVIEWER_GAMMA',review_record_sha256:sha('e')}),/MAX_TWO_PRIVACY_REVIEWS/);
});
test('18 public source does not validate human identity',()=>{
 const l=newPrivacyClaimLedger();l.submit(review);
 l.submit({...review,reviewer_id:'QA_REVIEWER_BETA',review_record_sha256:sha('d')});
 assert.equal(l.status(review.case_key).reviewer_ids_verified,false);
});
test('19 direct provider proof still unverified',()=>assert.equal(inspectProviderAccountClaims(proof).status,'ACCOUNT_EVIDENCE_UNVERIFIED'));
test('20 model access is unverified even if all hashes present',()=>assert.equal(inspectProviderAccountClaims(proof).direct_provider_entitlement_verified,false));
test('21 provider RPM TPM and bill cap unverified',()=>assert.equal(inspectProviderAccountClaims(proof).project_quotas_verified,false));
test('22 n8n credit not project model proof',()=>assert.equal(inspectProviderAccountClaims({...proof,route:'N8N_GATEWAY'}).n8n_gateway_balance_is_not_model_entitlement,true));
test('23 unknown API model rejected',()=>thrown(()=>inspectProviderAccountClaims({...proof,model_id:'unknown'}),/UNKNOWN_PROVIDER_MODEL/));
test('24 secret field refused',()=>thrown(()=>inspectProviderAccountClaims({...proof,api_key:'xxx'}),/ACCOUNT_EVIDENCE_EXACT/));
test('25 role collision refused',()=>thrown(()=>inspectProviderAccountClaims({...proof,reviewer_id:'QA_PROVIDER_OPERATOR'}),/ACCOUNT_REVIEWER_SEPARATION/));
test('26 source SHA must be valid or null',()=>thrown(()=>inspectProviderAccountClaims({...proof,terms_sha256:'x'}),/ACCOUNT_SHA_OR_NULL/));
test('27 fake fresh screenshots not verified',()=>assert.equal(inspectProviderAccountClaims(proof).external_reviewer_authenticity_verified,false));
test('28 empty acceptance blocked',()=>assert.equal(independentAcceptanceDecision().status,'NO_GO_CANNOT_SELF_CERTIFY'));
test('29 132 self claimed reviews do not enable upload',()=>assert.equal(independentAcceptanceDecision({privacy_case_reviews:132,approved_private_cases:132}).provider_upload_permitted,false));
test('30 all true flags cannot enable paid canary',()=>assert.equal(independentAcceptanceDecision({
 privacy_case_reviews:132,approved_private_cases:132,account_evidence_verified:true,
 provider_terms_approved:true,hard_budget_approved:true,independent_human_attestation_verified:true
}).paid_canary_permitted,false));
test('31 invalid privacy count rejected',()=>thrown(()=>independentAcceptanceDecision({privacy_case_reviews:133}),/INVALID_CASE_REVIEW_COUNT/));
test('32 privacy accepted cannot exceed reviewed',()=>thrown(()=>independentAcceptanceDecision({privacy_case_reviews:2,approved_private_cases:3}),/INVALID_PRIVACY_APPROVAL_COUNT/));
test('33 raw external upload is disabled',()=>thrown(authorizeExternalUpload,/PRIVATE_TRANSFER_DISABLED/));
test('34 self certified PASS denied',()=>thrown(certifySelfReport,/NO_SELF_CERTIFICATION/));
test('35 canary 8 source cases',()=>assert.equal(canaryPlan().case_count,8));
test('36 8 canary case keys unique',()=>assert.equal(new Set(CASE_KEYS).size,8));
test('37 3 candidate labels',()=>assert.equal(canaryPlan().model_count,3));
test('38 canary 24 candidate case pairs',()=>assert.equal(canaryPlan().pairs_count,24));
test('39 canary 42 minimum turn requests',()=>assert.equal(canaryPlan().min_total_model_requests,42));
test('40 canary 14 requests per model',()=>assert.equal(canaryPlan().min_requests_per_model,14));
test('41 source prompts not public',()=>assert(canaryPlan().cases.every(x=>x.transcript_in_public_source===false)));
test('42 case privacy not accepted',()=>assert(canaryPlan().cases.every(x=>x.source_data_to_provider_allowed===false)));
test('43 all result statuses NOT_RUN',()=>assert(canaryPlan().pairs.every(x=>x.status==='NOT_RUN')));
test('44 no fake model output hashes',()=>assert(canaryPlan().pairs.every(x=>x.response_evidence_sha256===null)));
test('45 no fake quality scores',()=>assert(canaryPlan().pairs.every(x=>x.human_quality_pass===null)));
test('46 synthetic 42 request dry run executes without network',()=>assert.equal(simulateEightCaseCanary().requested_model_turn_slots,42));
test('47 synthetic zero paid requests',()=>assert.equal(simulateEightCaseCanary().real_provider_calls,0));
test('48 synthetic zero real quality PASS',()=>assert.equal(simulateEightCaseCanary().certified_qa_pass,0));
test('49 synthetic 32900 microUSD under assumed token bounds',()=>assert.equal(simulateEightCaseCanary().simulated_micro_usd_total,32900));
test('50 quote Luna under assumed 2k/500 tokens 450 microUSD',()=>assert.equal(syntheticTokenQuote({model_id:'gpt-6-luna',max_input_tokens:2000,max_output_tokens:500}).assumed_max_micro_usd,450));
test('51 quote not provider cap',()=>assert.equal(syntheticTokenQuote({model_id:'gpt-6-luna',max_input_tokens:2000,max_output_tokens:500}).quote_is_hard_provider_cap,false));
test('52 zero cap blocks synthetic quote',()=>{
 const b=newSyntheticBudget({global_cap_micro_usd:0,provider_caps_micro_usd:{openai:0,google:0}});
 assert.equal(b.reserve({event_id:'QA_CANARY_001',model_id:'gpt-6-luna',max_input_tokens:2000,max_output_tokens:500}).status,'HARD_BLOCKED_QA_CAP');
});
test('53 small provider cap blocks reservation',()=>{
 const b=newSyntheticBudget({global_cap_micro_usd:5000,provider_caps_micro_usd:{openai:400,google:5000}});
 assert.equal(b.reserve({event_id:'QA_CANARY_001',model_id:'gpt-6-luna',max_input_tokens:2000,max_output_tokens:500}).accepted,false);
});
test('54 duplicates cannot double-spend',()=>{
 const b=newSyntheticBudget({global_cap_micro_usd:1000,provider_caps_micro_usd:{openai:1000,google:1000}});
 const args={event_id:'QA_CANARY_001',model_id:'gpt-6-luna',max_input_tokens:2000,max_output_tokens:500};
 b.reserve(args);b.reserve(args);assert.equal(b.snapshot().simulated_reserved_micro_usd,450);
});
test('55 altered model reused event denied',()=>{
 const b=newSyntheticBudget({global_cap_micro_usd:2000,provider_caps_micro_usd:{openai:2000,google:2000}});
 b.reserve({event_id:'QA_CANARY_001',model_id:'gpt-6-luna',max_input_tokens:2000,max_output_tokens:500});
 thrown(()=>b.reserve({event_id:'QA_CANARY_001',model_id:'gpt-5-mini',max_input_tokens:2000,max_output_tokens:500}),/IDEMPOTENCY_KEY_CONFLICT/);
});
test('56 cannot settle over reserved hypothetical bound',()=>{
 const b=newSyntheticBudget({global_cap_micro_usd:2000,provider_caps_micro_usd:{openai:2000,google:2000}});
 b.reserve({event_id:'QA_CANARY_001',model_id:'gpt-6-luna',max_input_tokens:2000,max_output_tokens:500});
 thrown(()=>b.settle({event_id:'QA_CANARY_001',simulated_used_micro_usd:451}),/SETTLEMENT_EXCEEDS_RESERVED/);
});
test('57 settlement marks simulated not actual spend',()=>{
 const b=newSyntheticBudget({global_cap_micro_usd:2000,provider_caps_micro_usd:{openai:2000,google:2000}});
 b.reserve({event_id:'QA_CANARY_001',model_id:'gpt-6-luna',max_input_tokens:2000,max_output_tokens:500});
 const s=b.settle({event_id:'QA_CANARY_001',simulated_used_micro_usd:450});
 assert.equal(s.simulated_spent_micro_usd,450);assert.equal(s.actual_provider_spend_micro_usd,null);
});
test('58 release refunds reservation',()=>{
 const b=newSyntheticBudget({global_cap_micro_usd:1000,provider_caps_micro_usd:{openai:1000,google:1000}});
 b.reserve({event_id:'QA_CANARY_001',model_id:'gpt-6-luna',max_input_tokens:2000,max_output_tokens:500});
 assert.equal(b.release({event_id:'QA_CANARY_001'}).simulated_reserved_micro_usd,0);
});
test('59 released reservation cannot be settled',()=>{
 const b=newSyntheticBudget({global_cap_micro_usd:1000,provider_caps_micro_usd:{openai:1000,google:1000}});
 b.reserve({event_id:'QA_CANARY_001',model_id:'gpt-6-luna',max_input_tokens:2000,max_output_tokens:500});
 b.release({event_id:'QA_CANARY_001'});
 thrown(()=>b.settle({event_id:'QA_CANARY_001',simulated_used_micro_usd:1}),/MISSING_ACTIVE_RESERVATION/);
});
test('60 ledger explicitly not durable',()=>assert.equal(newSyntheticBudget({global_cap_micro_usd:1000,provider_caps_micro_usd:{openai:1000,google:1000}}).snapshot().atomic_across_workers,false));
test('61 paid executor hard disabled',()=>thrown(executePaidCanary,/NO_PAID_CANARY_EXECUTOR/));
test('62 provider private prompt upload hard disabled',()=>thrown(allowProviderPromptUpload,/NO_CUSTOMER_PROMPT_UPLOAD/));
test('63 production promotion hard disabled',()=>thrown(updatePublishedModel,/NO_PRODUCTION_MODEL_PROMOTION/));

test('64 same idempotency key with changed tokens and colliding quote is denied',()=>{
 const b=newSyntheticBudget({global_cap_micro_usd:10000,provider_caps_micro_usd:{openai:10000,google:10000}});
 b.reserve({event_id:'QA_CANARY_001',model_id:'gpt-6-luna',max_input_tokens:2000,max_output_tokens:500});
 // 2000*.1+500*.5 = 450; 2500*.1+400*.5 = 450, but request differs.
 thrown(()=>b.reserve({event_id:'QA_CANARY_001',model_id:'gpt-6-luna',max_input_tokens:2500,max_output_tokens:400}),/IDEMPOTENCY_KEY_CONFLICT/);
});
