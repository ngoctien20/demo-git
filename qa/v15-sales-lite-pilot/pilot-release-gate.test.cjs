'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {GATES,LITE_FEATURES,FUTURE_PREMIUM,reviewPilotManifest} = require('./pilot-release-gate.cjs');
const valid = () => ({
  features: ['catalog_read','price_quote','order_request_draft','owner_notification'],
  gates: Object.fromEntries(Object.entries(GATES).map(([k,v])=>[k,{
    status:'PASS',evidence_kind:v,scope:'REAL_HOSTED_OR_PROVIDER_INDEPENDENT',
    evidence_ref:'https://example.invalid/independent/qa-evidence-'+k
  }]))
});
test('current no-evidence checkpoint is NO-GO',()=>{
  const x=reviewPilotManifest({features:['catalog_read']});
  assert.equal(x.status,'BLOCKED');assert.equal(x.missing_gates.length,Object.keys(GATES).length);
  assert.equal(x.can_publish,false);assert.equal(x.can_send,false);assert.equal(x.can_write_orders,false);
});
test('synthetic evidence cannot satisfy real hosted proof',()=>{
  const m=valid();m.gates.canonical_store.scope='SYNTHETIC_OFFLINE';
  assert.equal(reviewPilotManifest(m).status,'BLOCKED');
  assert.deepEqual(reviewPilotManifest(m).missing_gates,['canonical_store']);
});
test('all proof strings still REQUIRE external manual security review',()=>{
  const x=reviewPilotManifest(valid());
  assert.equal(x.status,'MANUAL_SECURITY_REVIEW_REQUIRED');
  assert.equal(x.can_publish,false);assert.equal(x.can_send,false);assert.equal(x.can_write_orders,false);
});
test('premium scope cannot enter Sales Lite pilot',()=>{
  for(const feature of FUTURE_PREMIUM) {
    const m=valid();m.features.push(feature);
    const x=reviewPilotManifest(m);
    assert.equal(x.enterprise_scope_blocked,true,feature);assert.equal(x.status,'BLOCKED');
  }
});
test('unknown features and falsified scope are rejected',()=>{
  const m=valid();m.features=['unknown_future_agent'];
  assert.equal(reviewPilotManifest(m).status,'BLOCKED');
  m.features=['catalog_read','merchant_model_selection'];
  assert.equal(reviewPilotManifest(m).status,'BLOCKED');
});
test('empty or malformed proof is not ready',()=>{
  for(const x of [null,{},[],{features:LITE_FEATURES,gates:{}},{features:['catalog_read'],gates:'pass'}]) {
    const r=reviewPilotManifest(x);
    assert.equal(r.status,'BLOCKED');assert.equal(r.can_publish,false);
  }
});
test('mismatched provider evidence cannot be substituted for owner proof',()=>{
  const m=valid();m.gates.owner_signoff.evidence_kind=GATES.provider_identity;
  assert.equal(reviewPilotManifest(m).status,'BLOCKED');
});
test('manifests never authorize model charges or provider sends',()=>{
  for(const m of [{},valid(),{features:FUTURE_PREMIUM,gates:valid().gates}]) {
    const r=reviewPilotManifest(m);
    assert.equal(r.paid_model_calls,0);assert.equal(r.can_send,false);
  }
});
