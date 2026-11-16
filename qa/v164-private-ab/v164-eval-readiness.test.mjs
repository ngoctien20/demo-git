import test from 'node:test';import assert from 'node:assert/strict';
import {MODEL_CATALOG,datasetRequestShape,projectUsageScenario,readinessDecision,createRealModelCall,publishBenchmark} from './model-catalog-readiness.mjs';
import {REVIEW_CONTRACT,caseRubric,createSyntheticReviewLedger,finalEvaluationGate} from './quality-review-protocol.mjs';
const throws=(fn,re)=>assert.throws(fn,re);
const H='a'.repeat(64);
const baseline=Object.freeze({review_id:'QA_REVIEW_01',reviewer_id:'QA_REVIEWER_A',
 runner_id:'QA_RUNNER_A',case_key:'MULTI:QA01',candidate_label:'luna',
 output_sha256:H,gold_snapshot_sha256:'b'.repeat(64),tool_trace_sha256:'c'.repeat(64),
 scores:{vietnamese_clarity:4,fact_accuracy:4,tool_trace_accuracy:4,commerce_policy:4,safety:4},
 p0_findings:[]});
const reviewer2=()=>({...baseline,review_id:'QA_REVIEW_02',reviewer_id:'QA_REVIEWER_B',scores:{...baseline.scores}});
test('01 three documented candidate model IDs',()=>assert.deepEqual(MODEL_CATALOG.map(x=>x.model_id),['gpt-6-luna','gemini-2.5-flash-lite','gpt-5-mini']));
test('02 model source docs URLs only public no provider key',()=>assert(MODEL_CATALOG.every(m=>/^https:/.test(m.docs))));
test('03 account entitlements unverified',()=>assert(MODEL_CATALOG.every(m=>m.account_entitlement_verified===false)));
test('04 no model allowed for real benchmark',()=>assert(MODEL_CATALOG.every(m=>m.eligible_for_real_benchmark===false)));
test('05 Gemini 2.5 access may be limited',()=>assert(MODEL_CATALOG[1].model_status.includes('ACCESS_RESTRICTIONS')));
test('06 GPT-5 mini deprecated',()=>assert.equal(MODEL_CATALOG[2].model_status,'DEPRECATED'));
test('07 GPT-5 mini scheduled shutdown date',()=>assert.equal(MODEL_CATALOG[2].shutdown_date,'2026-12-11'));
test('08 dataset has 132 case-model evaluation slots per candidate',()=>assert.equal(datasetRequestShape().per_candidate_case_evaluations,132));
test('09 exact dialogue turns 71',()=>assert.equal(datasetRequestShape().dialogue_turns,71));
test('10 one turn dialogue count 9',()=>assert.equal(datasetRequestShape().one_turn_dialogue_cases,9));
test('11 true multi-turn 27',()=>assert.equal(datasetRequestShape().true_multi_turn_dialogue_cases,27));
test('12 396 case-model pairs',()=>assert.equal(datasetRequestShape().total_case_model_pairs,396));
test('13 501 min requests to replay all turns',()=>assert.equal(datasetRequestShape().min_model_requests_for_full_sequential_replay,501));
test('14 scenario one call per user turn gives 501 total',()=>assert.equal(projectUsageScenario().total_requests,501));
test('15 scenario two calls per turn gives 1002',()=>assert.equal(projectUsageScenario({calls_per_user_turn:2}).total_requests,1002));
test('16 scenario retry x2 multiplies requests',()=>assert.equal(projectUsageScenario({retry_factor:2}).total_requests,1002));
test('17 Luna 167 calls at 1200 in / 180 out',()=>assert.equal(projectUsageScenario().per_model[0].estimated_usd,.03507));
test('18 Gemini same token mix has lower estimate',()=>assert(projectUsageScenario().per_model[1].estimated_usd<projectUsageScenario().per_model[0].estimated_usd));
test('19 deprecated baseline cost higher in this assumption',()=>assert(projectUsageScenario().per_model[2].estimated_usd>projectUsageScenario().per_model[0].estimated_usd));
test('20 no billed costs verified',()=>assert(projectUsageScenario().per_model.every(x=>x.actual_spend_usd===null)));
test('21 model calls are zero',()=>assert.equal(projectUsageScenario().no_api_calls,true));
test('22 rate/account plan not certified',()=>assert.equal(projectUsageScenario().account_quota_verified,false));
test('23 reject negative pricing inputs',()=>throws(()=>projectUsageScenario({catalog:[{model_id:'x',input_usd_per_1m:-1,output_usd_per_1m:1}]}),/INVALID_RATE/));
test('24 reject zero calls per turn',()=>throws(()=>projectUsageScenario({calls_per_user_turn:0}),/INVALID_CALLS/));
test('25 reject fractional token counts',()=>throws(()=>projectUsageScenario({max_input_tokens_per_call:1.3}),/INVALID_INPUT/));
test('26 reject too high retry assumption',()=>throws(()=>projectUsageScenario({retry_factor:10}),/INVALID_RETRY/));
test('27 readiness without evidence blocked',()=>assert.equal(readinessDecision().status,'NO_GO_SOURCE_ONLY'));
test('28 missing evidence names enumerated',()=>assert.equal(readinessDecision().missing.length,9));
test('29 all self claimed flags cannot authorize',()=>{
 const x=readinessDecision({dataset_privacy_reviewed:true,independent_gold_reviewed:true,
 model_entitlements_verified:true,model_lifecycle_accepted:true,project_quotas_verified:true,
 tool_replay_sandbox_verified:true,independent_reviewers_enrolled:true,
 explicit_paid_budget_approval:true,tenant_isolation_approved:true});
 assert.equal(x.missing.length,0);assert.equal(x.status,'NO_GO_SOURCE_ONLY');assert.equal(x.live_executor_present,false);
});
test('30 nonboolean readiness flag rejected',()=>throws(()=>readinessDecision({dataset_privacy_reviewed:'yes'}),/INVALID_READINESS/));
test('31 real model call impossible',()=>throws(createRealModelCall,/NO_PAID_MODEL/));
test('32 real benchmark publication impossible',()=>throws(publishBenchmark,/NO_PUBLICATION/));
test('33 review rubric includes ten P0 codes',()=>assert.equal(caseRubric('SINGLE:QA01').p0_checks.length,10));
test('34 actual multi-turn memory only when length>=2',()=>assert.equal(caseRubric('MULTI:QA01').tests_conversation_memory,true));
test('35 one-turn dialogue not counted as memory',()=>assert.equal(caseRubric('MULTI:QA03').tests_conversation_memory,false));
test('36 unknown case rejected',()=>throws(()=>caseRubric('MULTI:QA99'),/UNKNOWN_SOURCE_CASE/));
test('37 no real golden facts in rubric',()=>assert.equal(caseRubric('SINGLE:QA01').golden_facts_verified,false));
test('38 reviewer self-review rejected',()=>throws(()=>createSyntheticReviewLedger().submit({...baseline,reviewer_id:'QA_RUNNER_A'}),/SELF_REVIEW_DENIED/));
test('39 reviewer cannot submit raw customer text',()=>throws(()=>createSyntheticReviewLedger().submit({...baseline,raw_output:'hello'}),/UNEXPECTED_FIELD/));
test('40 unauthorized model label rejected',()=>throws(()=>createSyntheticReviewLedger().submit({...baseline,candidate_label:'gpt-secret'}),/UNKNOWN_CASE_CANDIDATE/));
test('41 QA reviewer one accepted but zero certified pass',()=>{
 const l=createSyntheticReviewLedger();l.submit(baseline);assert.equal(l.decision({case_key:baseline.case_key,candidate_label:baseline.candidate_label}).certified_pass,false);
});
test('42 two agreeing reviewers not certified',()=>{
 const l=createSyntheticReviewLedger();l.submit(baseline);l.submit(reviewer2());assert.equal(l.decision({case_key:baseline.case_key,candidate_label:baseline.candidate_label}).state,'SYNTHETIC_CONSENSUS_NOT_CERTIFIED');
});
test('43 two reviewers cannot differ on evidence output hash',()=>{
 const l=createSyntheticReviewLedger();l.submit(baseline);throws(()=>l.submit({...reviewer2(),output_sha256:'d'.repeat(64)}),/OUTPUT_MISMATCH/);
});
test('44 duplicate review id replay rejected',()=>{
 const l=createSyntheticReviewLedger();l.submit(baseline);throws(()=>l.submit({...reviewer2(),review_id:'QA_REVIEW_01'}),/REVIEW_ID_REPLAY/);
});
test('45 same reviewer duplicate rejected',()=>{
 const l=createSyntheticReviewLedger();l.submit(baseline);throws(()=>l.submit({...baseline,review_id:'QA_REVIEW_09'}),/DUPLICATE_REVIEWER/);
});
test('46 P0 finding escalates even with perfect dimension scores',()=>{
 const l=createSyntheticReviewLedger();l.submit(baseline);l.submit({...reviewer2(),p0_findings:['WRONG_PRICE']});
 const d=l.decision({case_key:baseline.case_key,candidate_label:baseline.candidate_label});
 assert.equal(d.state,'P0_OR_DISAGREEMENT_ARBITRATION_REQUIRED');assert.deepEqual(d.p0_codes,['WRONG_PRICE']);
});
test('47 disagreement >=2 points requires arbitration',()=>{
 const l=createSyntheticReviewLedger();l.submit(baseline);l.submit({...reviewer2(),scores:{...baseline.scores,fact_accuracy:1}});
 assert.equal(l.decision({case_key:baseline.case_key,candidate_label:baseline.candidate_label}).disagreement,true);
});
test('48 reviewer score outside 0..4 rejected',()=>throws(()=>createSyntheticReviewLedger().submit({...baseline,scores:{...baseline.scores,safety:5}}),/RUBRIC_RANGE/));
test('49 unknown P0 code rejected',()=>throws(()=>createSyntheticReviewLedger().submit({...baseline,p0_findings:['P0_HALLUCINATION_UNKNOWN']}),/INVALID_P0/));
test('50 tool trace mismatch second review rejected',()=>{
 const l=createSyntheticReviewLedger();l.submit(baseline);throws(()=>l.submit({...reviewer2(),tool_trace_sha256:'e'.repeat(64)}),/TOOL_TRACE_MISMATCH/);
});
test('51 cannot use a fake output SHA',()=>throws(()=>createSyntheticReviewLedger().submit({...baseline,output_sha256:'1234'}),/EVIDENCE_SHA/));
test('52 final evaluation gate expects exactly 396 case-model slots',()=>throws(()=>finalEvaluationGate({case_model_pairs:395,model_results:0}),/EXPECTED_396/));
test('53 full asserted results are still not certified',()=>assert.equal(finalEvaluationGate({case_model_pairs:396,model_results:396,independent_fixture_proof:true,
 source_hashes_verified:true,reviewer_identity_verified:true,hosted_store_security_verified:true}).status,'BLOCKED_NOT_CERTIFIED'));
test('54 no results = model outputs missing gate',()=>assert(finalEvaluationGate({case_model_pairs:396,model_results:0}).missing_evidence.includes('REAL_MODEL_OUTPUTS_MISSING')));
test('55 no model can be promoted from synthetic reviewers',()=>assert.equal(finalEvaluationGate({case_model_pairs:396,model_results:396}).can_change_merchant_model,false));
