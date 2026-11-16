import test from 'node:test';
import assert from 'node:assert/strict';
import {privateDatasetManifest,privateRunPreflight,blindedSchedule,costBoundary,ingestSanitizedEvidence,
 performPaidModelCall,executeRealOrder,writeCustomerDataset,sendProviderMessage,CONTRACT} from './private-readiness.mjs';
const hex='a'.repeat(64),seed='QA_SEED_OFFLINE_REVIEW_01';
const preflight={contract:CONTRACT,dataset_sha256:hex,model_registry_sha256:'b'.repeat(64),
 approved_budget_usd:0,api_authorization:false,private_encrypted_vault_verified:false,
 tenant_scope:'QA_TENANT_DEMO',reviewer_role_verified:false};
const reject=(fn,pattern)=>assert.throws(fn,pattern);
test('01 local manifest totals 132',()=>assert.equal(privateDatasetManifest().cases,132));
test('02 dialogue pack 36',()=>assert.equal(privateDatasetManifest().dialogue_pack,36));
test('03 71 dialogue turns',()=>assert.equal(privateDatasetManifest().dialogue_turns,71));
test('04 only 27 genuine multi turns',()=>assert.equal(privateDatasetManifest().actual_multi_turn_cases,27));
test('05 source manifest contains zero raw prompts',()=>assert.equal(privateDatasetManifest().privacy,'NO_PROMPT_OR_EXPECTED_OUTPUT_IN_PUBLIC_REPO'));
test('06 preflight is BLOCKED for unapproved API',()=>assert.equal(privateRunPreflight(preflight).status,'BLOCKED_NO_LIVE_API_EXECUTOR'));
test('07 no private vault evidence is reported',()=>assert(privateRunPreflight(preflight).missing_evidence.includes('PRIVATE_DATASET_STORAGE_UNVERIFIED')));
test('08 budget not allocated',()=>assert(privateRunPreflight(preflight).missing_evidence.includes('BUDGET_NOT_ALLOCATED')));
test('09 forged all-true approvals cannot activate API executor',()=>assert.equal(privateRunPreflight({...preflight,approved_budget_usd:99,api_authorization:true,private_encrypted_vault_verified:true,reviewer_role_verified:true}).actual_api_calls,0));
test('10 output never grants production deploy',()=>assert.equal(privateRunPreflight({...preflight,approved_budget_usd:999,api_authorization:true,private_encrypted_vault_verified:true,reviewer_role_verified:true}).deploy_allowed,false));
test('11 missing dataset SHA fails',()=>reject(()=>privateRunPreflight({...preflight,dataset_sha256:null}),/HASH_REQUIRED/));
test('12 missing model registry SHA fails',()=>reject(()=>privateRunPreflight({...preflight,model_registry_sha256:'unknown'}),/HASH_REQUIRED/));
test('13 reject real tenant scope',()=>reject(()=>privateRunPreflight({...preflight,tenant_scope:'live-shop'}),/NON_QA_TENANT/));
test('14 reject privacy key injection',()=>reject(()=>privateRunPreflight({...preflight,customer_message:'private'}),/EXACT_PRIVATE/));
test('15 reject JWT injection',()=>reject(()=>privateRunPreflight({...preflight,jwt:'unsafe'}),/EXACT_PRIVATE/));
test('16 budget negative denied',()=>reject(()=>privateRunPreflight({...preflight,approved_budget_usd:-1}),/INVALID_BUDGET/));
test('17 boolean self assertions never independently certified',()=>assert.equal(privateRunPreflight({...preflight,api_authorization:true}).caller_attestation_verified,false));
test('18 396 review labels',()=>assert.equal(blindedSchedule({seed}).count,396));
test('19 no model calls in schedule',()=>assert.equal(blindedSchedule({seed}).external_api_calls,0));
test('20 all rows NOT_RUN',()=>assert(blindedSchedule({seed}).rows.every(x=>x.status==='NOT_RUN')));
test('21 no output hashes invented',()=>assert(blindedSchedule({seed}).rows.every(x=>x.actual_output_hash===null)));
test('22 independent reviews remain zero',()=>assert.equal(blindedSchedule({seed}).independent_output_reviews,0));
test('23 deterministic schedule ordering',()=>assert.deepEqual(blindedSchedule({seed}).rows.map(x=>x.review_label),blindedSchedule({seed}).rows.map(x=>x.review_label)));
test('24 seed must be QA-only',()=>reject(()=>blindedSchedule({seed:'real-key'}),/SYNTHETIC_BLINDING/));
test('25 no raw prompts in schedule row',()=>assert(blindedSchedule({seed}).rows.every(x=>!('prompt' in x))));
test('26 no customer data attached',()=>assert.equal(blindedSchedule({seed}).encrypted_private_data_attached,false));
test('27 candidate labels not real model IDs',()=>assert.equal(blindedSchedule({seed}).production_model_selection,null));
test('28 mocked 396 calls cost ceiling',()=>assert.equal(costBoundary({planned_calls:396,max_input_tokens:1000,max_output_tokens:100,input_usd_per_million:.25,output_usd_per_million:2}).hypothetical_max_usd,.1782));
test('29 pricing inputs not real invoice',()=>assert.equal(costBoundary({planned_calls:396,max_input_tokens:1000,max_output_tokens:100,input_usd_per_million:.25,output_usd_per_million:2}).actual_provider_spend_usd,null));
test('30 spending cap not enforced',()=>assert.equal(costBoundary({planned_calls:1,max_input_tokens:1,max_output_tokens:1,input_usd_per_million:1,output_usd_per_million:1}).hard_spend_cap_enforced,false));
test('31 negative price denied',()=>reject(()=>costBoundary({planned_calls:1,max_input_tokens:1,max_output_tokens:1,input_usd_per_million:-1,output_usd_per_million:1}),/INVALID_COST/));
test('32 noninteger token assumption denied',()=>reject(()=>costBoundary({planned_calls:1,max_input_tokens:1.2,max_output_tokens:1,input_usd_per_million:1,output_usd_per_million:1}),/INVALID_COST/));
const evidence={case_key:'SINGLE:QA01',candidate_label:'baseline_small',output_sha256:hex,
 tool_trace_sha256:hex,reviewer_attestation_sha256:hex,fixture_snapshot_sha256:hex,
 reviewer_separate_from_runner:true};
test('33 evidence hash is not QA PASS',()=>assert.equal(ingestSanitizedEvidence(evidence).certified_pass,false));
test('34 reviewer boolean only self-reported',()=>assert.equal(ingestSanitizedEvidence(evidence).self_reported_independence,true));
test('35 missing hash rejected',()=>reject(()=>ingestSanitizedEvidence({...evidence,output_sha256:null}),/OPAQUE_EVIDENCE/));
test('36 raw output text rejected',()=>reject(()=>ingestSanitizedEvidence({...evidence,actual_output:'customer PII'}),/RAW_OUTPUT/));
test('37 unknown candidate rejected',()=>reject(()=>ingestSanitizedEvidence({...evidence,candidate_label:'gpt-unknown'}),/UNKNOWN_CASE/));
test('38 real phone rejected',()=>reject(()=>ingestSanitizedEvidence({...evidence,phone:'090xxxx'}),/RAW_OUTPUT/));
test('39 model API cannot run',()=>reject(performPaidModelCall,/PAID_API_HARD_BLOCK/));
test('40 real order cannot run',()=>reject(executeRealOrder,/COMMERCE_HARD_BLOCK/));
test('41 customer write cannot run',()=>reject(writeCustomerDataset,/PRIVATE_DATA_WRITE_HARD_BLOCK/));
test('42 provider send cannot run',()=>reject(sendProviderMessage,/PROVIDER_SEND_HARD_BLOCK/));
