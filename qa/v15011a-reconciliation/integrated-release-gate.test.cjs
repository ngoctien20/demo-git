'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {assessIntegratedCandidate}=require('./integrated-release-gate.cjs');
const {LITE_FEATURES,FUTURE_PREMIUM}=require('../v15-sales-lite-pilot/pilot-release-gate.cjs');
const blockedKeys=['can_merge_production','can_publish','can_send',
 'can_write_orders','can_apply_migration','can_restore_hosted',
 'can_spend_money','can_call_model','can_promote_lite_to_enterprise'];
const ensureNeverAllows=r=>{
 assert.equal(r.status,'BLOCKED_SOURCE_INTEGRATION_ONLY');
 for(const k of blockedKeys)assert.equal(r[k],false,k);
 assert.equal(r.real_hosted_proofs_verified,false);
 assert.equal(r.source_only,true);
 assert.equal(r.blocking.length,9);
};
test('default integrated candidate NEVER promotes offline suite to live',()=>{
 const r=assessIntegratedCandidate();ensureNeverAllows(r);
 assert.equal(r.offline_knowledge_active,true);
 assert.equal(r.synthetic_backup_status,'BLOCKED');
 assert.equal(r.synthetic_g23_status,'BLOCKED');
 assert.equal(r.synthetic_store_owner_status,'BLOCKED');
});
test('even all real-looking PASS flags cannot authorize production',()=>{
 const gates=Object.fromEntries([
 'canonical_store','provider_identity','durable_replay','catalog_quote',
 'order_request','owner_notification','handoff','privacy','cost','recovery','owner_signoff'
 ].map(k=>[k,{status:'PASS',evidence_kind:'USER_SUPPLIED',
 scope:'REAL_HOSTED_OR_PROVIDER_INDEPENDENT',evidence_ref:'https://example.org/forged'}]));
 const r=assessIntegratedCandidate({features:LITE_FEATURES,gates});
 ensureNeverAllows(r);
});
test('Enterprise functionality never promoted to Sales Lite',()=>{
 for(const feature of FUTURE_PREMIUM){
  const r=assessIntegratedCandidate({features:[...LITE_FEATURES,feature]});
  ensureNeverAllows(r);
 }
});
test('mutating client manifest cannot grant send/Order/credential scopes',()=>{
 const r=assessIntegratedCandidate({features:LITE_FEATURES,
  can_send:true,can_publish:true,store_id:'qa_shop_b',tenant_id:'qa_tenant_1',
  owner_verified:true,hosted_backup_verified:true,
  security_approved:true,model_budget_approved:true,
  gates:{canonical_store:{status:'PASS'}}});
 ensureNeverAllows(r);
});
test('Shop knowledge remains separate and inherited source-only',()=>{
 const r=assessIntegratedCandidate({features:['basic_store_profile']});
 assert.equal(r.offline_knowledge_status,'OFFLINE_REUSE_V147_AND_V15');
 ensureNeverAllows(r);
});
test('All P0 gates enumerated and linked to blockers',()=>{
 const r=assessIntegratedCandidate();
 for(const token of ['G0_REAL_MERCHANT','G0_REAL_HOSTED_BACKUP',
    'G1_CANONICAL','G2_HOSTED_SIGNED_JWT','G3_REAL_PROVIDER',
    'G3_AUTHORIZED_SHARED','G3_MESSENGER_ZALO','V15_10B_REAL','OWNER_UAT']){
  assert.ok(r.blocking.some(x=>x.startsWith(token)),token);
 }
});
