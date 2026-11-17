import test from 'node:test';import assert from 'node:assert/strict';
import {evaluateReleaseGate,GATE_CONTRACT} from './release-gates.mjs';
const all=['separate_worker_created','host_control_verified','access_app_bound_to_issuer',
'access_jwt_audience_confirmed','session_secret_in_secret_manager','jwk_rotation_runbook_approved',
'durable_object_bound_and_atomic_tested','private_uat_operator_approved','cost_scope_approved',
'browser_uat_on_hosted_origin_passed','actual_merchant_domain_dns_challenge_verified',
'store_owner_membership_verified_independently','hosted_store_rls_a_b_passed',
'customer_identity_proof_approved','production_recovery_gate_approved',
'real_provider_authority_approved','live_rollout_scope_approved'];
test('01 contract',()=>assert.match(GATE_CONTRACT,/V174P/));
test('02 all missing defaults BLOCKED',()=>{
 const r=evaluateReleaseGate();assert.equal(r.status,'BLOCKED');assert.equal(r.private_qa_missing.length,10);
});
test('03 current Cloudflare Pages control is not enough',()=>{
 const r=evaluateReleaseGate({host_control_verified:true});assert.equal(r.status,'BLOCKED');assert.equal(r.private_qa_missing.length,9);
});
test('04 existing Pages Access app is not issuer Access',()=>{
 const r=evaluateReleaseGate({host_control_verified:true,access_app_bound_to_issuer:false});assert.equal(r.status,'BLOCKED');
});
test('05 without secret manager the private issuer is not admissible',()=>{
 const x=Object.fromEntries(all.map(k=>[k,true]));x.session_secret_in_secret_manager=false;
 assert.equal(evaluateReleaseGate(x).status,'BLOCKED');
});
test('06 even with all operator flags, code never independently certifies hosted UAT',()=>{
 const x=Object.fromEntries(all.map(k=>[k,true]));
 const r=evaluateReleaseGate(x);assert.equal(r.private_hosted_browser_uat_independently_verified,false);
 assert.equal(r.real_commerce_authorized,false);
});
test('07 each private QA release requirement is separately mandatory',()=>{
 for(const k of all.slice(0,10)){
  const x=Object.fromEntries(all.map(v=>[v,true]));x[k]=false;
  assert.equal(evaluateReleaseGate(x).status,'BLOCKED',k);
 }
});
test('08 all private flags but Store missing never grants live release',()=>{
 const x=Object.fromEntries(all.slice(0,10).map(k=>[k,true]));
 const r=evaluateReleaseGate(x);assert.equal(r.real_commerce_authorized,false);
 assert.equal(r.real_commerce_missing.length,7);
});
test('09 owner domain proof alone cannot authorize hosted shop reads',()=>{
 const r=evaluateReleaseGate({actual_merchant_domain_dns_challenge_verified:true});
 assert.equal(r.hosted_store_rls_verified_by_this_module,false);assert.equal(r.status,'BLOCKED');
});
test('10 all flags never changes production through operator matrix',()=>{
 const x=Object.fromEntries(all.map(k=>[k,true]));
 const r=evaluateReleaseGate(x);assert.equal(r.cloudflare_or_render_resource_changed,false);
});
test('11 truthy strings not accepted as true proof',()=>{
 const x=Object.fromEntries(all.map(k=>[k:'yes']));
 assert.equal(evaluateReleaseGate(x).status,'BLOCKED');
});
test('12 invalid or null evidence fails closed',()=>{
 assert.equal(evaluateReleaseGate(null).status,'BLOCKED');
 assert.equal(evaluateReleaseGate([]).status,'BLOCKED');
});
test('13 existing local Browser UAT not counted as hosted origin proof',()=>{
 const r=evaluateReleaseGate({browser_uat_on_hosted_origin_passed:false});
 assert(r.private_qa_missing.includes('browser_uat_on_hosted_origin_passed'));
});
test('14 production customer login cannot be assumed from signed Website session',()=>{
 const r=evaluateReleaseGate({customer_identity_proof_approved:false});
 assert(r.real_commerce_missing.includes('customer_identity_proof_approved'));
});
test('15 owner domain proof is separate from platform hosting',()=>{
 const r=evaluateReleaseGate({host_control_verified:true});
 assert(r.real_commerce_missing.includes('actual_merchant_domain_dns_challenge_verified'));
});
test('16 failed Store-RLS preflight always excludes real Commerce',()=>{
 const r=evaluateReleaseGate({hosted_store_rls_a_b_passed:false});
 assert(r.real_commerce_missing.includes('hosted_store_rls_a_b_passed'));
});
