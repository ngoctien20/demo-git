import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assessAdmissionEvidence,requiredGates} from './hosted-evidence-preflight.mjs';

const h=(hex)=>'sha256:'+hex.repeat(64);
const record=()=>({
 status:'INDEPENDENTLY_VERIFIED',
 scope:'hosted_staging_readonly_qa_evidence',
 evidence_source:'TRUSTED_OPERATOR_SYSTEM',
 evidence_digest:h('a'),
 recorded_at:'2026-11-21T00:00:00Z',
 reference:'QA_REF_OFFLINE_FIXTURE'
});
function syntheticComplete() {
 return {
  target_environment:'isolated_staging',
  intent:'read_only_owner_admission_preflight',
  caller_supplied_secrets:false,
  gates:Object.fromEntries(requiredGates.map(g=>[g,record()])),
  owner_binding:{
   tenant_digest:h('1'),store_a_digest:h('2'),store_b_digest:h('3'),
   owner_a_digest:h('4'),owner_b_digest:h('5')
  }
 };
}
const deny=(v)=>{const r=assessAdmissionEvidence(v);assert.equal(r.decision,'NO_GO');assert.equal(r.canApplyHostedMigration,false);assert.equal(r.canReadRealCatalog,false);assert.equal(r.canSendProviderMessage,false);assert.equal(r.canWriteRealOrders,false);};
test('complete synthetic FORMAT still requires independent human review and grants nothing',()=>{
 const r=assessAdmissionEvidence(syntheticComplete());
 assert.equal(r.decision,'EVIDENCE_FORMAT_COMPLETE_HUMAN_REVIEW_REQUIRED');
 assert.deepEqual(r.missing,[]);
 assert.equal(r.canApplyHostedMigration,false);
 assert.equal(r.canReadRealCatalog,false);
 assert.equal(r.canSendProviderMessage,false);
 assert.equal(r.canWriteRealOrders,false);
});
test('actual V19.8.19 read-only snapshot remains NO_GO',()=>{
 const observed=JSON.parse(readFileSync(new URL('./READONLY_EVIDENCE_STATUS_20261121.json',import.meta.url),'utf8'));
 deny(observed);assert.equal(observed.decision,'NO_GO');
});
for(const g of requiredGates) test('missing gate '+g,()=>{
 const m=syntheticComplete();delete m.gates[g];deny(m);
});
for(const [label,field,value] of [
 ['untrusted source','evidence_source','CLIENT'],
 ['not verified','status','PENDING'],
 ['bad sha','evidence_digest','sha256:123'],
 ['not exact scope','scope','order_write'],
 ['malformed timestamp','recorded_at','unknown'],
 ['bad source ref','reference','NOT_VERIFIED']
])test(label,()=>{
 const m=syntheticComplete();m.gates.backupArtifactDigest[field]=value;deny(m);
});
for(const [label,patch] of [
 ['production target',{target_environment:'production'}],
 ['non-readonly intent',{intent:'send_zalo_message'}],
 ['secrets provided',{caller_supplied_secrets:true}],
 ['secrets omitted',{caller_supplied_secrets:undefined}]
])test(label,()=>deny({...syntheticComplete(),...patch}));
test('owner fingerprints must be distinct',()=>{
 const m=syntheticComplete();m.owner_binding.owner_b_digest=m.owner_binding.owner_a_digest;deny(m);
});
test('Store fingerprints must be distinct',()=>{
 const m=syntheticComplete();m.owner_binding.store_b_digest=m.owner_binding.store_a_digest;deny(m);
});
test('no owner binding is not admission',()=>{
 const m=syntheticComplete();delete m.owner_binding;deny(m);
});
test('missing evidence manifest is denied',()=>deny(null));
test('array manifest is denied',()=>deny([]));
test('empty object is denied',()=>deny({}));
