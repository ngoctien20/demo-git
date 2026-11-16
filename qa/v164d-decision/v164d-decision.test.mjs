import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,createHash,sign} from 'node:crypto';
import {CONTRACT,KINDS,normalizeEvidence,canonicalPayload,verifySignedIndex,indexEvidenceBundle,
 readProviderCredentials,impersonateReviewer} from './operator-evidence.mjs';
import {emptyCanaryEvidence,decisionProofMatrix,requestedBudget,authorizedCanaryDecision,
 runPaidCanary,sendCustomerCorpus,modifyPublishedBot} from './authorized-canary-decision.mjs';
const deny=(fn,regex)=>assert.throws(fn,regex);
const hex=s=>s.repeat(64);
const keys=generateKeyPairSync('ed25519');
const trustSha=createHash('sha256').update(keys.publicKey.export({type:'spki',format:'der'})).digest('hex');
const base={contract:CONTRACT,kind:'PROVIDER_MODEL_VISIBILITY',
 evidence_id:'QA_EVIDENCE_TEST01',provider:'openai',model_id:'gpt-6-luna',
 route:'DIRECT_PROVIDER',subject_case:null,source_sha256:hex('a'),
 issued_at_utc:'2026-11-16T12:00:00Z',
 expires_at_utc:'2026-11-17T12:00:00Z',
 operator_id:'QA_OPERATOR_A',reviewer_id:'QA_REVIEWER_B',
 trust_key_fingerprint_sha256:trustSha};
function signed(x=base){
 return {...x,signature_base64:sign(null,Buffer.from(canonicalPayload(x)),keys.privateKey).toString('base64')};
}
const FIX={now_ms:Date.parse('2026-11-16T13:00:00Z')};
test('01 public evidence kind list is complete',()=>assert.equal(KINDS.length,10));
test('02 evidence schema accepts exact fixture',()=>assert.equal(normalizeEvidence(signed(),FIX).contract,CONTRACT));
test('03 untrusted record never certifies project account',()=>assert.equal(verifySignedIndex(signed(),FIX).account_entitlement_verified,false));
test('04 signed evidence is cryptographically valid',()=>assert.equal(verifySignedIndex(signed(),{...FIX,trusted_public_key_pem:keys.publicKey.export({type:'spki',format:'pem'})}).cryptographically_verified,true));
test('05 even cryptographic signature never grants live API',()=>assert.equal(verifySignedIndex(signed(),{...FIX,trusted_public_key_pem:keys.publicKey.export({type:'spki',format:'pem'})}).provider_call_allowed,false));
test('06 human authority remains unverified',()=>assert.equal(verifySignedIndex(signed(),{...FIX,trusted_public_key_pem:keys.publicKey.export({type:'spki',format:'pem'})}).human_authority_verified,false));
test('07 absent trust root blocks proof verification',()=>assert.equal(verifySignedIndex(signed(),FIX).status,'BLOCKED_NO_PINNED_PRIVATE_TRUST_ROOT'));
test('08 signature tampering fails verification',()=>{
 const x={...signed(),source_sha256:hex('b')};
 assert.equal(verifySignedIndex(x,{...FIX,trusted_public_key_pem:keys.publicKey.export({type:'spki',format:'pem'})}).status,'INVALID_EVIDENCE_SIGNATURE');
});
test('09 fingerprint mismatch fails closed',()=>deny(()=>verifySignedIndex({...signed(),trust_key_fingerprint_sha256:hex('b')},{...FIX,trusted_public_key_pem:keys.publicKey.export({type:'spki',format:'pem'})}),/FINGERPRINT_MISMATCH/));
test('10 unknown provider model refused',()=>deny(()=>normalizeEvidence(signed({...base,model_id:'unknown'}),FIX),/PROVIDER_MODEL_MISMATCH/));
test('11 route mismatched internal provider refused',()=>deny(()=>normalizeEvidence(signed({...base,route:'INTERNAL_PRIVATE'}),FIX),/ROUTE_MODEL_SCOPE_MISMATCH/));
test('12 internal only has null model',()=>assert.equal(normalizeEvidence(signed({...base,provider:'none',model_id:null,route:'INTERNAL_PRIVATE'}),FIX).provider,'none'));
test('13 invalid QA case rejected',()=>deny(()=>normalizeEvidence(signed({...base,subject_case:'CLIENT:123'}),FIX),/QA_CASE_ONLY/));
test('14 raw proof payload injection rejected',()=>deny(()=>normalizeEvidence({...signed(),raw_customer_phone:'0123456789'},FIX),/STRICT_EVIDENCE_SCHEMA/));
test('15 credential field injection rejected',()=>deny(()=>normalizeEvidence({...signed(),api_key:'secret'},FIX),/STRICT_EVIDENCE_SCHEMA/));
test('16 stale evidence rejected',()=>deny(()=>normalizeEvidence(signed({...base,expires_at_utc:'2026-11-16T12:30:00Z'}),FIX),/STALE_FUTURE/));
test('17 future evidence rejected',()=>deny(()=>normalizeEvidence(signed({...base,issued_at_utc:'2026-11-16T13:00:01Z'}),FIX),/STALE_FUTURE/));
test('18 evidence over 7d rejected',()=>deny(()=>normalizeEvidence(signed({...base,expires_at_utc:'2026-12-01T12:00:00Z'}),FIX),/STALE_FUTURE/));
test('19 invalid ISO timestamp rejected',()=>deny(()=>normalizeEvidence(signed({...base,issued_at_utc:'2026-99-99T00:00:00Z'}),FIX),/TIMESTAMP_REQUIRED/));
test('20 same operator/reviewer rejected',()=>deny(()=>normalizeEvidence(signed({...base,reviewer_id:'QA_OPERATOR_A'}),FIX),/INDEPENDENT_ROLE_MARKERS/));
test('21 bad SHA rejected',()=>deny(()=>normalizeEvidence(signed({...base,source_sha256:'bad'}),FIX),/SOURCE_SHA256/));
test('22 random signature rejected',()=>deny(()=>normalizeEvidence({...signed(),signature_base64:'bad'},FIX),/ED25519_SIGNATURE_FORMAT/));
test('23 evidence bundle does not expose private content',()=>assert.equal(indexEvidenceBundle([signed()],FIX).source_text_or_private_keys_included,false));
test('24 evidence bundle is not certified',()=>assert.equal(indexEvidenceBundle([signed()],FIX).account_or_consent_certified,false));
test('25 duplicate evidence ID rejected',()=>deny(()=>indexEvidenceBundle([signed(),signed()],FIX),/DUPLICATE_EVIDENCE_ID/));
test('26 bundle upper bound rejected',()=>deny(()=>indexEvidenceBundle(Array(51).fill(signed()),FIX),/EVIDENCE_BUNDLE_BOUND/));
test('27 credentials not retrievable by source gate',()=>deny(readProviderCredentials,/NO_CREDENTIAL_READ/));
test('28 self-assigned reviewer cannot be trusted',()=>deny(impersonateReviewer,/NO_SELF_CERTIFIED_ATTESTATION/));
test('29 12 required proof categories',()=>assert.equal(Object.keys(emptyCanaryEvidence()).length,12));
test('30 empty proof matrix is NO GO',()=>assert.equal(decisionProofMatrix().status,'NO_GO_PAID_SOURCE_ONLY'));
test('31 every proof is missing by default',()=>assert.equal(decisionProofMatrix().missing_or_unverified.length,12));
test('32 fake all true remains NO GO',()=>assert.equal(decisionProofMatrix(Object.fromEntries(Object.keys(emptyCanaryEvidence()).map(k=>[k,true]))).status,'NO_GO_PAID_SOURCE_ONLY'));
test('33 extra proof field rejected',()=>deny(()=>decisionProofMatrix({...emptyCanaryEvidence(),account_id:'private'}),/EXACT_PRIVATE_DECISION/));
test('34 nonboolean proof rejected',()=>deny(()=>decisionProofMatrix({...emptyCanaryEvidence(),approved_golden_behavior:'yes'}),/EVIDENCE_VALUES_BOOLEAN/));
test('35 zero budget is zero authorized spend',()=>assert.equal(requestedBudget().actual_authorized_paid_usd,0));
test('36 explicit budget still unverified',()=>assert.equal(requestedBudget({provider_cents:{openai:5,google:5},total_cents:10,expiry_utc:'2026-11-17T00:00:00Z',approval_evidence_sha256:hex('a')}).budget_independently_approved,false));
test('37 total budget below provider sums rejected',()=>deny(()=>requestedBudget({provider_cents:{openai:5,google:6},total_cents:10}),/ALLOCATION_EXCEEDS_TOTAL/));
test('38 fractional budget cents rejected',()=>deny(()=>requestedBudget({provider_cents:{openai:0.5,google:0},total_cents:1}),/BUDGET_CENTS_INTEGER/));
test('39 negative budget rejected',()=>deny(()=>requestedBudget({total_cents:-1}),/BUDGET_CENTS_INTEGER/));
test('40 unsupported provider budget key rejected',()=>deny(()=>requestedBudget({provider_cents:{openai:5,google:5,anthropic:0},total_cents:10}),/EXACT_PROVIDER_BUDGET/));
test('41 invalid budget approval hash rejected',()=>deny(()=>requestedBudget({approval_evidence_sha256:'a'}),/INVALID_APPROVAL_EVIDENCE_HASH/));
test('42 default status NO GO paid canary',()=>assert.equal(authorizedCanaryDecision().status,'NO_GO_PAID_CANARY'));
test('43 zero model calls',()=>assert.equal(authorizedCanaryDecision().real_provider_requests,0));
test('44 zero model responses',()=>assert.equal(authorizedCanaryDecision().case_model_pairs_completed,0));
test('45 eight planned case IDs',()=>assert.equal(authorizedCanaryDecision().canary_case_count,8));
test('46 24 planned pairs',()=>assert.equal(authorizedCanaryDecision().planned_pairs_per_3_candidates,24));
test('47 42 minimum requests for three candidates',()=>assert.equal(authorizedCanaryDecision().minimum_requests_for_chosen_models,42));
test('48 choose one model plan 14 requests without paying',()=>assert.equal(authorizedCanaryDecision({model_ids:['gpt-6-luna']}).minimum_requests_for_chosen_models,14));
test('49 unknown candidate rejected',()=>deny(()=>authorizedCanaryDecision({model_ids:['hidden-model']}),/INVALID_CANDIDATE/));
test('50 duplicate candidate rejected',()=>deny(()=>authorizedCanaryDecision({model_ids:['gpt-6-luna','gpt-6-luna']}),/INVALID_CANDIDATE/));
test('51 all true claims cannot authorize paid',()=>assert.equal(authorizedCanaryDecision({proofs:Object.fromEntries(Object.keys(emptyCanaryEvidence()).map(k=>[k,true])),
 budget:{provider_cents:{openai:30,google:20},total_cents:50,
 expiry_utc:'2026-11-17T00:00:00Z',approval_evidence_sha256:hex('a')}}).paid_budget_authorized_usd,0));
test('52 no provider data upload allowed',()=>assert.equal(authorizedCanaryDecision().data_transfer_authorized,false));
test('53 no production model promotion allowed',()=>assert.equal(authorizedCanaryDecision().production_promotion_authorized,false));
test('54 synthetic scenario is not durable cost ledger',()=>assert.equal(authorizedCanaryDecision().simulated_ledger_not_durable,true));
test('55 simulated amount cannot be mistaken for real spend',()=>{const d=authorizedCanaryDecision();assert.equal(d.synthetic_simulated_amount_usd,.0329);assert.equal(d.real_provider_spend_usd,0);});
test('56 no paid executor',()=>deny(runPaidCanary,/PAID_CANARY_DISABLED/));
test('57 cannot send private customer dataset',()=>deny(sendCustomerCorpus,/NO_PRIVATE_DATA_PROVIDER_TRANSFER/));
test('58 cannot modify Published Core Bot',()=>deny(modifyPublishedBot,/NO_PUBLISHED_CORE_MODEL_CHANGE/));
