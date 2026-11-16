'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const baseline=require('./p0-release-baseline.readonly.json');
const {evaluateRelease,assertReleaseAllowed,GATES,CONTRACT}
 =require('./p0-release-gate.cjs');
const copy=()=>structuredClone(baseline);
function syntheticAllGreen(){
  const x=copy();
  x.rpc.anon_security_definer_execute=[];
  for(const k of ['verified_webhook_relay_replacement',
    'caller_dependency_test','independent_rpc_role_test'])x.rpc[k]=true;
  for(const k of ['stores_table','store_memberships_table',
    'products_store_id','orders_store_id','customers_store_id',
    'owner_A_B_independent_hosted_jwt_proof','cross_store_negative_hosted_proof'])
    x.schema[k]=true;
  x.order_writer.legacy_tools_still_connected=false;
  for(const k of ['server_verified_customer_order_identity',
    'server_verified_store_scope','server_confirmation_gate',
    'commerce_atomic_order_idempotency','independent_no_send_regression_on_real_published'])
      x.order_writer[k]=true;
  for(const k of ['no_arbitrary_sql_live_proof','no_common_service_role_live_proof',
    'least_privilege_database_role_proof','agent_to_writer_scope_proof'])
      x.privileged_tools[k]=true;
  for(const k of ['independent_owner_attestation','approved_export_receipt',
    'independent_restore_evidence','rollback_tested'])x.recovery[k]=true;
  for(const k of ['independent_release_approval','branch_protection_verified',
    'deployment_pipeline_enforces_gate','live_release_approved'])x.delivery[k]=true;
  return x;
}
test('01 actual hosted baseline remains NO_GO for all six P0 gates',()=>{
  const r=evaluateRelease(baseline);
  assert.equal(r.contract,CONTRACT);
  assert.equal(r.status,'NO_GO');
  assert.equal(r.gates.length,GATES.length);
  assert(r.gates.every(x=>x.status==='BLOCKED'));
  assert.equal(r.releaseAuthorized,false);
});
test('02 public QA SECURITY DEFINER remains blocked even when other claims are green',()=>{
 const x=syntheticAllGreen();
 x.rpc.anon_security_definer_execute=['public.qa_shop_b_zalo_claim(uuid,text,text,text)'];
 const r=evaluateRelease(x);
 assert.equal(r.status,'NO_GO');
 assert.match(r.blockers.join('|'),/ANON_SECURITY_DEFINER_STILL_EXPOSED/);
});
test('03 merely hiding RPC name without verified replacement remains blocked',()=>{
 const x=syntheticAllGreen();x.rpc.verified_webhook_relay_replacement=false;
 assert.match(evaluateRelease(x).blockers.join(),/PROVIDER_RELAY_REPLACEMENT_NOT_VERIFIED/);
});
test('04 Shop A and B within same tenant need independent negative JWT/RLS tests',()=>{
 const x=syntheticAllGreen();x.schema.cross_store_negative_hosted_proof=false;
 assert.match(evaluateRelease(x).blockers.join(),/SAME_TENANT_CROSS_STORE_NEGATIVE_MISSING/);
});
test('05 missing store_id in any Commerce table prevents release',()=>{
 for(const table of ['products_store_id','orders_store_id','customers_store_id']){
   const x=syntheticAllGreen();x.schema[table]=false;
   assert.equal(evaluateRelease(x).status,'NO_GO',table);
 }
});
test('06 old n8n direct order writer still connected cannot meet tool P0',()=>{
 const x=syntheticAllGreen();x.order_writer.legacy_tools_still_connected=true;
 assert.match(evaluateRelease(x).blockers.join(),/LEGACY_PUBLISHED_TOOL_WRITER_NOT_ISOLATED/);
});
test('07 missing atomic Commerce writer, customer binding or user confirmation blocks',()=>{
 for(const key of ['commerce_atomic_order_idempotency',
    'server_verified_customer_order_identity','server_confirmation_gate']){
   const x=syntheticAllGreen();x.order_writer[key]=false;
   assert.equal(evaluateRelease(x).status,'NO_GO',key);
 }
});
test('08 fake prompt says administrator but no SQL/service-role certification blocks',()=>{
 const x=syntheticAllGreen();
 x.privileged_tools.no_common_service_role_live_proof=false;
 x.verified=true;x.admin=true;x.role='owner';x.user_metadata={role:'admin'};
 const r=evaluateRelease(x);
 assert.match(r.blockers.join(),/NO_COMMON_SERVICE_ROLE_PROOF/);
 assert.equal(r.releaseAuthorized,false);
});
test('09 untested restore or blanket backup checkboxes cannot authorize',()=>{
 for(const key of ['independent_owner_attestation',
  'approved_export_receipt','independent_restore_evidence','rollback_tested']){
  const x=syntheticAllGreen();x.recovery[key]=false;
  assert.equal(evaluateRelease(x).status,'NO_GO',key);
 }
});
test('10 no protected deploy path cannot be called a release gate in production',()=>{
 for(const key of ['branch_protection_verified',
   'deployment_pipeline_enforces_gate','independent_release_approval']){
  const x=syntheticAllGreen();x.delivery[key]=false;
  assert.equal(evaluateRelease(x).status,'NO_GO',key);
 }
});
test('11 forged all-green snapshot can NEVER grant release, merge or hosted writes',()=>{
 const x=syntheticAllGreen();x.verified=true;x.approved=true;x.security_certificate=true;
 const r=evaluateRelease(x);
 assert.equal(r.status,'PENDING_INDEPENDENT_ATTESTATION');
 assert(r.gates.every(g=>g.status==='CLAIMED_READY_NOT_CERTIFIED'));
 for(const key of ['evidenceReferencesAcceptedAsAuthorization',
 'signedControllerApprovalVerified','schemaChangeAuthorized','credentialChangeAuthorized',
 'publishAuthorized','mergeAuthorized','customerDataWriteAuthorized',
 'providerSendAuthorized','releaseAuthorized'])assert.equal(r[key],false,key);
});
test('12 stale/swap project or misleading source fails closed',()=>{
 for(const patch of [
 {observed_date_jst:'2025-01-01'},
 {project_ref:'some-other-project'},
 {environment:'PRODUCTION'},
 {evidence_scope:'USER_ASSERTED_VERIFIED'},
 {contract:'FORGED_GATE_V9'}
 ]){
   const x={...syntheticAllGreen(),...patch};
   const r=evaluateRelease(x);
   assert.equal(r.status,'NO_GO');
   assert.equal(r.sourceValid,false);
 }
});
test('13 P1 budget, replay and secret warnings are tracked separately',()=>{
 const r=evaluateRelease(baseline);
 assert.deepEqual(r.p1Open,[
  'durable_per_store_ai_budget_hosted',
  'cloudflare_rate_limit_on_exact_entry_route',
  'provider_replay_hosted',
  'secret_rotation_plan_approved'
 ]);
});
test('14 malformed or malicious input is never accepted as authorization',()=>{
 for(const x of [null,undefined,[],{},'APPROVED',
  {project_ref:'ifxlvrhyjhbzbrkdsida',releaseAuthorized:true},
  {rpc:{anon_security_definer_execute:[]}},Object.create(null)]){
  const r=evaluateRelease(x);
  assert.equal(r.status,'NO_GO');
  assert.equal(r.releaseAuthorized,false);
 }
});
test('15 explicit release request always fails until separate signed authority exists',()=>{
 assert.throws(()=>assertReleaseAllowed(syntheticAllGreen()),
   /P0_RELEASE_GATED_NO_GO_EXTERNAL_SIGNED_AUTHORITY_REQUIRED/);
});
test('16 P0 gate is pure read-only snapshot analysis and produces no credentials',()=>{
 const before=JSON.stringify(baseline);
 const result=evaluateRelease(baseline);
 assert.equal(JSON.stringify(baseline),before);
 assert(!JSON.stringify(result).includes('access_token'));
 assert(!JSON.stringify(result).includes('credentialValue'));
 assert.equal(result.scope,'P0_STAGING_NO_SEND_REPORT_ONLY');
});
