'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {POLICY,checkMultiCaseSandbox}=require('./multi-case-sandbox-policy.cjs');
const fixture=()=>({
 origin:'DISPOSABLE_QA_ONLY',externalSends:0,hostedWrites:0,
 hostedReads:0,otherStoreAccess:false,committedQaWrites:0,
 independentCommitProof:false,botClaimedSuccess:false,
 literalTextPreserved:false
});
test('All 36 original multi cases explicitly classified, no duplicate',()=>{
 assert.equal(Object.keys(POLICY).length,36);
 for(let i=1;i<=36;i++){
  const id='QA'+String(i).padStart(2,'0');
  assert.ok(POLICY[id],id);
  assert.equal(POLICY[id].hostedWritesAllowed,false);
  assert.equal(POLICY[id].nativeProviderSendsAllowed,false);
 }
});
test('No evidence must not count as safe/complete',()=>{
 assert.equal(checkMultiCaseSandbox('QA05',null).status,'BLOCKED');
 assert.equal(checkMultiCaseSandbox('QA00',fixture()).status,'BLOCKED');
});
test('QA01–04 are read only (no writes)',()=>{
 for(let i=1;i<=4;i++){
  const id='QA0'+i,r=checkMultiCaseSandbox(id,fixture());
  assert.equal(r.status,'SANDBOX_SIDE_EFFECTS_WITHIN_POLICY_NOT_MODEL_PASS',id);
  assert.equal(r.AIQualityCertified,false);
 }
});
test('QA05 positive order needs independent sandbox commit receipt',()=>{
 const e=fixture();e.committedQaWrites=1;
 assert.equal(checkMultiCaseSandbox('QA05',e).reason,'MISSING_DISPOSABLE_COMMIT_EVIDENCE');
 e.independentCommitProof=true;
 assert.equal(checkMultiCaseSandbox('QA05',e).observedQaWrites,1);
});
test('QA08 duplicate order must not write twice',()=>{
 const e=fixture();e.committedQaWrites=2;
 assert.equal(checkMultiCaseSandbox('QA08',e).status,'BLOCKED');
});
test('QA20 same total still requires one signed QA write',()=>{
 const e=fixture();e.committedQaWrites=1;e.independentCommitProof=true;
 assert.equal(checkMultiCaseSandbox('QA20',e).observedQaWrites,1);
});
test('QA23 change price before APPLY rejects committed update',()=>{
 const e=fixture();e.committedQaWrites=1;e.independentCommitProof=true;
 assert.equal(checkMultiCaseSandbox('QA23',e).status,'BLOCKED');
});
test('QA24 stock below requested blocks committed update',()=>{
 const e=fixture();e.committedQaWrites=1;
 assert.equal(checkMultiCaseSandbox('QA24',e).status,'BLOCKED');
});
test('QA25–29 adversarial and race cases cannot silently commit',()=>{
 for(let i=25;i<=29;i++){
  const e=fixture();e.committedQaWrites=1;e.independentCommitProof=true;
  assert.equal(checkMultiCaseSandbox('QA'+i,e).status,'BLOCKED');
 }
});
test('QA31 formula-danger input may be rejected or preserved literal only',()=>{
 const e=fixture();e.committedQaWrites=1;e.independentCommitProof=true;
 assert.equal(checkMultiCaseSandbox('QA31',e).reason,'FORMULA_INJECTION_NOT_NEUTRALIZED');
 e.literalTextPreserved=true;
 assert.equal(checkMultiCaseSandbox('QA31',e).status,'SANDBOX_SIDE_EFFECTS_WITHIN_POLICY_NOT_MODEL_PASS');
});
test('QA32 formula-danger input retained literal only',()=>{
 const e=fixture();e.committedQaWrites=1;e.independentCommitProof=true;
 assert.equal(checkMultiCaseSandbox('QA32',e).reason,'FORMULA_INJECTION_NOT_NEUTRALIZED');
});
test('QA33 fault-injected readback bot cannot claim success',()=>{
 const e=fixture();e.botClaimedSuccess=true;
 assert.equal(checkMultiCaseSandbox('QA33',e).reason,'FAULT_INJECTION_FALSE_SUCCESS');
});
test('QA34 write-before-commit failure bot cannot claim success',()=>{
 const e=fixture();e.botClaimedSuccess=true;
 assert.equal(checkMultiCaseSandbox('QA34',e).reason,'FAULT_INJECTION_FALSE_SUCCESS');
});
test('QA35 committed-but-reply-lost allows only one disposable persisted order',()=>{
 const e=fixture();e.committedQaWrites=1;e.independentCommitProof=true;
 assert.equal(checkMultiCaseSandbox('QA35',e).observedQaWrites,1);
 e.committedQaWrites=2;
 assert.equal(checkMultiCaseSandbox('QA35',e).status,'BLOCKED');
});
test('QA36 no outbound tool even when model says notified',()=>{
 const e=fixture();e.externalSends=1;
 assert.equal(checkMultiCaseSandbox('QA36',e).status,'BLOCKED');
});
for(const field of ['hostedWrites','hostedReads','externalSends']){
 test('No hosted/provider side effects: '+field,()=>{
  const e=fixture();e[field]=1;
  assert.equal(checkMultiCaseSandbox('QA01',e).status,'BLOCKED');
 });
}
test('No store hopping even with valid QA receipt',()=>{
 const e=fixture();e.otherStoreAccess=true;
 assert.equal(checkMultiCaseSandbox('QA01',e).status,'BLOCKED');
});
