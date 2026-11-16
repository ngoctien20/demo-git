import test from 'node:test';import assert from 'node:assert/strict';
import {publicModelDocsSnapshot,entitlementRequiredViews,inspectSubmittedIndex,readinessMatrix,
 invokeProvider,readSecrets,approvePaidBenchmark,CONTRACT} from './entitlement_gate.mjs';
import {frozenPlan,reviewerSeparation,evidenceSnapshot,riskChecklist,goNoGo,sendRawPrivatePrompt,
 callModel,changeCoreBot} from './independent_eval_gate.mjs';
const proof={provider:'openai',model_id:'gpt-6-luna',proof_kind:'MODEL_VISIBILITY',
 evidence_sha256:'a'.repeat(64),observer_role:'QA_OPERATOR',
 source_view:'OPENAI_DASHBOARD',reviewed_at_utc:'2026-11-16T10:10:10Z',contains_no_secrets:true};
const empty=Object.fromEntries(['snapshot_sha256','prompt_sha256','knowledge_sha256','tools_sha256',
 'policy_sha256','source_privacy_review_sha256','reviewer_roster_sha256','budget_approval_sha256',
 'project_entitlement_sha256','production_store_security_sha256'].map(x=>[x,null]));
const deny=(fn,re)=>assert.throws(fn,re);
test('01 docs models three',()=>assert.equal(publicModelDocsSnapshot().models.length,3));
test('02 Luna documented ID',()=>assert.equal(publicModelDocsSnapshot().models[0].id,'gpt-6-luna'));
test('03 Gemini documented ID',()=>assert.equal(publicModelDocsSnapshot().models[1].id,'gemini-2.5-flash-lite'));
test('04 legacy deprecated status',()=>assert.equal(publicModelDocsSnapshot().models[2].documented_status,'DEPRECATED'));
test('05 public docs is not project entitlement',()=>assert(publicModelDocsSnapshot().models.every(x=>x.user_project_entitlement==='NOT_VERIFIED')));
test('06 no model authorized',()=>assert(publicModelDocsSnapshot().models.every(x=>!x.eligible_for_live_call)));
test('07 user project RPM unknown',()=>assert(publicModelDocsSnapshot().models.every(x=>x.user_project_rpm===null)));
test('08 user project budget unknown',()=>assert(publicModelDocsSnapshot().models.every(x=>x.user_project_budget===null)));
test('09 OpenAI proof checklist exists',()=>assert.equal(entitlementRequiredViews().openai.length,5));
test('10 Google proof checklist exists',()=>assert.equal(entitlementRequiredViews().google.length,5));
test('11 no secrets requested',()=>assert(entitlementRequiredViews().disallowed_evidence.includes('API_KEY')));
test('12 n8n gateway credit not direct entitlement',()=>assert.equal(entitlementRequiredViews().n8n_gateway_credits_not_equivalent_to_direct_provider_entitlement,true));
test('13 proof hash metadata accepted but unverified',()=>assert.equal(inspectSubmittedIndex(proof).status,'EVIDENCE_INDEX_RECEIVED_BUT_UNVERIFIED'));
test('14 proof hash does not verify authenticity',()=>assert.equal(inspectSubmittedIndex(proof).hash_verifies_authenticity,false));
test('15 proof cannot confer access',()=>assert.equal(inspectSubmittedIndex(proof).model_call_allowed,false));
test('16 unknown model refused',()=>deny(()=>inspectSubmittedIndex({...proof,model_id:'gpt-private-hidden'}),/UNSUPPORTED_MODEL/));
test('17 credential field injection refused',()=>deny(()=>inspectSubmittedIndex({...proof,api_key:'redacted'}),/EXACT_REDACTED_METADATA/));
test('18 non-secret screenshot claim required',()=>deny(()=>inspectSubmittedIndex({...proof,contains_no_secrets:false}),/SECRET_SCREENSHOT/));
test('19 bad hash rejected',()=>deny(()=>inspectSubmittedIndex({...proof,evidence_sha256:'a'}),/HASH_REQUIRED/));
test('20 wrong reviewer role rejected',()=>deny(()=>inspectSubmittedIndex({...proof,observer_role:'SERVICE_ROLE'}),/OBSERVER_ROLE/));
test('21 empty readiness matrix blocked',()=>assert.equal(readinessMatrix().final_go,false));
test('22 even with metadata proof blocked',()=>assert.equal(readinessMatrix({indexes:[proof]}).final_go,false));
test('23 no provider account limit inferred',()=>assert.equal(readinessMatrix({indexes:[proof]}).available_rpm,null));
test('24 501 planned replay requests',()=>assert.equal(readinessMatrix().request_plan_minimum,501));
test('25 model calls hard-disabled',()=>deny(invokeProvider,/PAID_PROVIDER_CALL_DISABLED/));
test('26 credentials cannot be read',()=>deny(readSecrets,/CREDENTIAL_ACCESS_DISABLED/));
test('27 paid benchmark needs separate authorization',()=>deny(approvePaidBenchmark,/SEPARATE_AUTHORIZATION/));
test('28 frozen 396 planned rows',()=>assert.equal(frozenPlan().rows.length,396));
test('29 frozen source 132 cases',()=>assert.equal(frozenPlan().cases,132));
test('30 frozen request planning 501',()=>assert.equal(frozenPlan().minimum_sequential_turn_requests,501));
test('31 all rows NOT_RUN',()=>assert(frozenPlan().rows.every(x=>x.model_call_status==='NOT_RUN')));
test('32 no output sha invented',()=>assert(frozenPlan().rows.every(x=>x.real_output_sha256===null)));
test('33 no source prompts exported',()=>assert.equal(frozenPlan().source_private_prompts_included,false));
test('34 memory only 27 per model',()=>assert.equal(frozenPlan().true_memory_cases_per_candidate,27));
test('35 reviewer separation has QA-only IDs',()=>assert.equal(reviewerSeparation({runner_id:'QA_RUNNER_A',reviewer_ids:['QA_REVIEWER_A','QA_REVIEWER_B'],adjudicator_id:'QA_ADJUDICATOR_A'}).roles_structurally_distinct,true));
test('36 reviewer cannot equal runner',()=>deny(()=>reviewerSeparation({runner_id:'QA_RUNNER_A',reviewer_ids:['QA_RUNNER_A','QA_REVIEWER_B'],adjudicator_id:'QA_ADJUDICATOR_A'}),/ROLE_COLLISION/));
test('37 two reviewers required',()=>deny(()=>reviewerSeparation({runner_id:'QA_RUNNER_A',reviewer_ids:['QA_REVIEWER_A'],adjudicator_id:'QA_ADJUDICATOR_A'}),/TWO_QA_REVIEWERS/));
test('38 real human independence not inferred',()=>assert.equal(reviewerSeparation({runner_id:'QA_RUNNER_A',reviewer_ids:['QA_REVIEWER_A','QA_REVIEWER_B'],adjudicator_id:'QA_ADJUDICATOR_A'}).actual_human_independence_verified,false));
test('39 missing evidence fields enumerated',()=>assert.equal(evidenceSnapshot(empty).absent_evidence_fields.length,10));
test('40 all hash fields supplied do not prove human review',()=>assert.equal(evidenceSnapshot(Object.fromEntries(Object.keys(empty).map(k=>[k,'a'.repeat(64)]))).private_identity_verified,false));
test('41 extra evidence data rejected',()=>deny(()=>evidenceSnapshot({...empty,raw_prompt:'private'}),/EXACT_EVIDENCE/));
test('42 invalid evidence hash rejected',()=>deny(()=>evidenceSnapshot({...empty,prompt_sha256:'abc'}),/HASH_OR_NULL/));
test('43 critical P0 checklist includes cross store access',()=>assert(riskChecklist().must_be_zero_before_real_pilot.includes('CROSS_STORE_ACCESS')));
test('44 real model data not stored publicly',()=>assert.equal(riskChecklist().response_text_must_not_enter_public_ci,true));
test('45 no flags -> blocked',()=>assert.equal(goNoGo().status,'BLOCKED_WAITING_INDEPENDENT_PROOF'));
test('46 all self-attested flags still blocked',()=>assert.equal(goNoGo({privacy_manual_review:true,gold_independently_signed:true,
 project_entitlements_readonly_verified:true,provider_data_terms_approved:true,
 reviewers_privately_attested:true,hosted_store_p0_cleared:true,hard_spend_limit_verified:true,
 user_approved_paid_budget:true}).paid_api_permitted,false));
test('47 all checks true cannot promote model',()=>assert.equal(goNoGo({privacy_manual_review:true,gold_independently_signed:true,
 project_entitlements_readonly_verified:true,provider_data_terms_approved:true,
 reviewers_privately_attested:true,hosted_store_p0_cleared:true,hard_spend_limit_verified:true,
 user_approved_paid_budget:true}).model_selection_approved,false));
test('48 fabricated actual model result count remains zero',()=>assert.equal(goNoGo().real_model_requests,0));
test('49 falsified privacy boolean rejected',()=>deny(()=>goNoGo({privacy_manual_review:'yes'}),/BOOLEAN_INPUT/));
test('50 no raw prompt provider transfer',()=>deny(sendRawPrivatePrompt,/NO_PROVIDER_TRANSFER/));
test('51 no live call',()=>deny(callModel,/NO_LIVE_MODEL_CALL/));
test('52 no Core Bot promotion',()=>deny(changeCoreBot,/NO_CORE_BOT_PROMOTION/));
