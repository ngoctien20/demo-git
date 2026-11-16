'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const manifest=require('./caller-inventory.readonly.json');
const {evaluateRpc2Cutover,compareSyntheticShadow,requireProductionCutover,
 SAFE_STAGES,CONTRACT}=require('./zero-downtime-cutover-review.cjs');
const snapshot=()=>structuredClone(manifest);
const green=()=>({
 provider_signature_real:true,gateway_store_identity_real:true,
 jwt_owner_a_b_negative_hosted:true,
 backup_export_approved_and_restore_verified:true,
 disposable_pg17_atomic_claim_and_confirmation:true,
 private_runtime_role_non_bypass_hosted:true,
 no_double_writer_shadow_evidence:true,rollback_drill:true,
 observation_window_with_external_logs:true,
 independent_controller_security_and_operator_decisions:true,
 canary_metrics_zero_cross_store_failures:true
});
test('01 actual verified caller manifest results in NO_GO before switching',()=>{
 const v=evaluateRpc2Cutover({callerInventory:manifest});
 assert.equal(v.contract,CONTRACT);assert.equal(v.status,'NO_GO');
 assert(v.blockers.includes('ANON_RPC_STILL_EXECUTABLE'));
 assert(v.blockers.includes('EXTERNAL_DYNAMIC_AND_HISTORICAL_CALLERS_NOT_ATTESTED'));
 assert(v.blockers.includes('RPC_TRAFFIC_OBSERVABILITY_UNRELIABLE'));
 assert.equal(v.n8nPublishedChanged,false);
 assert.equal(v.rpcPrivilegesRevoked,false);
});
test('02 known active webhook V1 and shadow RPC V2 are both required',()=>{
 const v=evaluateRpc2Cutover({callerInventory:manifest,proof:green()});
 assert(!v.blockers.includes('ACTUAL_ZALO_RPC_CALL_CHAIN_NOT_INVENTORIED'));
 const x=snapshot();x.n8n.active_upstream_callers=[];
 assert(v.blockers.includes('ANON_RPC_STILL_EXECUTABLE'));
 assert(evaluateRpc2Cutover({callerInventory:x}).blockers.includes(
  'ACTUAL_ZALO_RPC_CALL_CHAIN_NOT_INVENTORIED'));
});
test('03 scope covers 114 accessible workflows and 23 Worker representations',()=>{
 assert.equal(manifest.n8n.examined_draft_and_published,114);
 assert.equal(manifest.cloudflare.content_representations_scanned,23);
 assert.equal(manifest.n8n.active_workflows,19);
 assert.equal(manifest.n8n.exact_rpc_direct_callers.length,1);
 assert.equal(manifest.n8n.active_upstream_callers.length,1);
});
test('04 one manual execution is not proof of no production callers',()=>{
 assert.equal(manifest.supabase_rpc.track_functions,'none');
 assert.equal(manifest.supabase_rpc.tracked_calls_unreliable,true);
 assert.deepEqual(manifest.n8n.exact_rpc_direct_callers[0]
   .execution_metadata.observed_modes,['manual']);
 assert(manifest.unverified_domains.length>=5);
});
test('05 fake approvals cannot authorize production cutover',()=>{
 const x=snapshot();
 x.supabase_rpc.anon_execute=false;
 x.supabase_rpc.tracked_calls_unreliable=false;
 x.unverified_domains=[];
 const v=evaluateRpc2Cutover({callerInventory:x,proof:green()});
 assert.equal(v.status,'PENDING_INDEPENDENT_EXTERNAL_APPROVAL_ONLY');
 for(const k of ['canSend','canMerge','canPublish','canRevoke','canPromote',
   'productionReleaseAuthorized','realZeroDowntimeCertified']){
  assert.equal(v[k],false,k);
 }
});
test('06 password, role metadata or client signature flags do not become release authority',()=>{
 const p={...green(),isAdmin:true,service_role:'qa-role',releaseApproved:true};
 const v=evaluateRpc2Cutover({callerInventory:manifest,proof:p});
 assert.equal(v.status,'NO_GO');assert.equal(v.canRevoke,false);
});
test('07 missing real provider signature, Store proof or private role blocks',()=>{
 for(const key of ['provider_signature_real','gateway_store_identity_real',
   'jwt_owner_a_b_negative_hosted','private_runtime_role_non_bypass_hosted']){
  const p=green();p[key]=false;
  const x=snapshot();x.supabase_rpc.anon_execute=false;
  x.supabase_rpc.tracked_calls_unreliable=false;x.unverified_domains=[];
  assert.equal(evaluateRpc2Cutover({callerInventory:x,proof:p}).status,'NO_GO');
 }
});
test('08 untested rollback or shadow double writer denies cutover',()=>{
 for(const key of ['rollback_drill','no_double_writer_shadow_evidence',
  'canary_metrics_zero_cross_store_failures']){
  const p=green();p[key]=false;
  const x=snapshot();x.supabase_rpc.anon_execute=false;
  x.supabase_rpc.tracked_calls_unreliable=false;x.unverified_domains=[];
  assert.equal(evaluateRpc2Cutover({callerInventory:x,proof:p}).status,'NO_GO');
 }
});
test('09 shadow parity never calls either writer',()=>{
 const h=x=>crypto.createHash('sha256').update(x).digest('hex');
 const a=compareSyntheticShadow({mode:'OFFLINE_NO_SEND',items:[
   {event_hash:h('a'),legacy:'CLAIM_PENDING',candidate:'CLAIM_PENDING'},
   {event_hash:h('b'),legacy:'CLAIM_DENIED',candidate:'CLAIM_DENIED'},
   {event_hash:h('c'),legacy:'NOT_PAIRING_COMMAND',candidate:'NOT_PAIRING_COMMAND'}
 ]});
 assert.equal(a.status,'SYNTHETIC_SHADOW_MATCH_ONLY');
 assert.equal(a.matches,3);assert.equal(a.divergence,0);
 assert.equal(a.legacyWriterCalled,false);assert.equal(a.candidateWriterCalled,false);
 assert.equal(a.eligibleForLiveCanary,false);
});
test('10 candidate divergence blocks; no automatic switch',()=>{
 const a=compareSyntheticShadow({mode:'OFFLINE_NO_SEND',items:[
  {event_hash:'a'.repeat(64),legacy:'CLAIM_PENDING',candidate:'CLAIM_DENIED'}
 ]});
 assert.equal(a.status,'SHADOW_DIVERGENCE_BLOCKED');
 assert.equal(a.hasRealCutoverProof,false);
});
test('11 PII or unbounded shadow fixtures rejected',()=>{
 assert.throws(()=>compareSyntheticShadow({mode:'REAL_PRODUCTION',items:[]}),/SHADOW_SYNTHETIC_ONLY/);
 assert.throws(()=>compareSyntheticShadow({mode:'OFFLINE_NO_SEND',items:[
  {event_hash:'b'.repeat(64),legacy:'CLAIM_PENDING',
   candidate:'CLAIM_PENDING',phone:'raw-pii'}
 ]}),/SHADOW_FIXTURE_PII_OR_SCHEMA_DENIED/);
});
test('12 manual live switch always denied by this source-only policy',()=>{
 assert(SAFE_STAGES.includes('SHADOW_COMPARE_NO_WRITE'));
 assert.throws(()=>requireProductionCutover(),/RPC2_REAL_CUTOVER_REQUIRES_SEPARATE_SIGNED_APPROVAL/);
});
