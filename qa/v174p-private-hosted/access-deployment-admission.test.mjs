import test from 'node:test';
import assert from 'node:assert/strict';
import {assessAccessDeployment,ACCESS_ADMISSION_CONTRACT} from './access-deployment-admission.mjs';
const host='https://tien404-private-qa.example.com',aud='cfaud-qa-private-issuer-001';
function fixture(){
 const worker={name:'tien404-v174p-private-qa-issuer',id:'worker-private-qa-012345',
   secretBindingNames:['V174P_SESSION_HMAC_KEY','V174P_ACCESS_JWKS_JSON'],
   durableObjectBindings:[{name:'V174P_REPLAY_DO',class_name:'V174PReplayGuard',sqlite:true}]};
 const access={name:'tien404-v174p-dedicated-access',type:'self_hosted',
   destinations:[{type:'worker',worker_id:worker.id}],
   aud,domain:'tien404-private-qa.example.com',policy_ids:['private-qa-operator-policy']};
 const snapshot={workers:[worker],accessApps:[access],
  accessPolicies:[{id:'private-qa-operator-policy',reusable:true,decision:'allow',
    include:[{email:{email:'qa-operator@example.com'}}]}]};
 const review={approvedQaOrigin:host,approvedAccessAudience:aud,
  operatorsIndependentlyReviewed:true,workerAndPreviewEdgeProtected:true,
  unauthenticatedEdgeDenied:true,revokedOperatorDenied:true,
  hostedAtomicReplayPassed:true,hostedRate429Passed:true,hostedAlarmTtlPassed:true,
  costScopeWrittenApproval:true,rollbackEvidenceReviewed:true,externalBrowserCanaryPassed:true};
 return {snapshot,review};
}
function blocked(change){
 const {snapshot,review}=fixture();change(snapshot,review);
 return assessAccessDeployment(snapshot,review);
}
test('01 contract is an evidence-only comparator',()=>assert.match(ACCESS_ADMISSION_CONTRACT,/READ_ONLY/));
test('02 empty actual Cloudflare inventory never passes',()=>{
 const r=assessAccessDeployment();assert.equal(r.status,'BLOCKED');
 assert(r.missing.includes('dedicated_worker_isolated_and_present'));
});
test('03 even synthetic all-green flags never authorize deploy or Commerce',()=>{
 const {snapshot,review}=fixture(),r=assessAccessDeployment(snapshot,review);
 assert.equal(r.status,'EVIDENCE_COMPLETE_REQUIRES_INDEPENDENT_APPROVAL');
 assert.equal(r.deploy_authorized,false);assert.equal(r.real_commerce_authorized,false);
 assert.equal(r.cloudflare_resource_changed,false);
});
test('04 public Pages wildcard app cannot be reused as the dedicated Worker app',()=>{
 const r=blocked(s=>{s.accessApps[0].destinations=[{type:'public',hostname:'*.tien404-ai-git-staging.pages.dev'}];});
 assert(r.missing.includes('dedicated_worker_bound_access_app'));
});
test('05 Worker Access app must match actual Worker ID',()=>{
 const r=blocked(s=>{s.accessApps[0].destinations[0].worker_id='another-worker-id';});
 assert(r.missing.includes('dedicated_worker_bound_access_app'));
});
test('06 no unknown Access audience',()=>{
 const r=blocked((s,v)=>{v.approvedAccessAudience='wrong-audience';});
 assert(r.missing.includes('strict_access_audience'));
});
test('07 no Bypass or Service Auth policies',()=>{
 for(const decision of ['bypass','service_auth']){
  const r=blocked(s=>{s.accessPolicies[0].decision=decision;});
  assert(r.missing.includes('no_bypass_service_auth_or_everyone'));
 }
});
test('08 no Everyone allow policy',()=>{
 const r=blocked(s=>{s.accessPolicies[0].include=[{everyone:{}}];});
 assert(r.missing.includes('no_bypass_service_auth_or_everyone'));
});
test('09 reject legacy app policies without reusable proof',()=>{
 const r=blocked(s=>{s.accessPolicies[0].reusable=false;});
 assert(r.missing.includes('assigned_reusable_allow_policy'));
});
test('10 no approved private operator group/email',()=>{
 const r=blocked(s=>{s.accessPolicies[0].include=[{email_domain:{domain:'gmail.com'}}];});
 assert(r.missing.includes('no_bypass_service_auth_or_everyone'));
});
test('11 preview-only protection is insufficient',()=>{
 const r=blocked((s,v)=>{v.workerAndPreviewEdgeProtected=false;});
 assert(r.missing.includes('workers_dev_and_preview_paths_protected'));
});
test('12 independent unauthenticated and revoked-operator checks are mandatory',()=>{
 const r=blocked((s,v)=>{v.revokedOperatorDenied=false;v.unauthenticatedEdgeDenied=false;});
 assert(r.missing.includes('revoked_operator_negative_test'));
 assert(r.missing.includes('negative_unauthenticated_edge_test'));
});
test('13 forged hosted replay or TTL attestations never count',()=>{
 const r=blocked((s,v)=>{v.hostedAtomicReplayPassed='yes';v.hostedAlarmTtlPassed=false;});
 assert(r.missing.includes('hosted_atomic_replay_conflict_test'));
 assert(r.missing.includes('hosted_alarm_ttl_reclamation_test'));
});
test('14 no managed secrets or durable SQLite DO blocks hosted',()=>{
 const r=blocked(s=>{s.workers[0].secretBindingNames=[];s.workers[0].durableObjectBindings=[];});
 assert(r.missing.includes('managed_secret_bindings_present'));
 assert(r.missing.includes('sqlite_do_binding_present'));
});
test('15 cost and rollback operator authorizations mandatory',()=>{
 const r=blocked((s,v)=>{v.costScopeWrittenApproval=false;v.rollbackEvidenceReviewed=false;});
 assert(r.missing.includes('qa_cost_scope_approved'));
 assert(r.missing.includes('operator_signed_rollback_test'));
});
test('16 actual hosted Browser UAT cannot be substituted by local Chromium',()=>{
 const r=blocked((s,v)=>{v.externalBrowserCanaryPassed=false;});
 assert(r.missing.includes('private_external_browser_canary_passed'));
});
test('17 personal BIO and Pages domains never accepted',()=>{
 for(const origin of ['https://ngoctien20.io.vn','https://tien404-ai-git-staging.pages.dev',
   'http://tien404-private-qa.example.com','https://test.invalid']){
  const r=blocked((s,v)=>{v.approvedQaOrigin=origin;});
  assert(r.missing.includes('approved_dedicated_https_origin'),origin);
 }
});
test('18 mismatched or wildcard app domain denied',()=>{
 for(const domain of ['*.tien404-private-qa.example.com','other-qa.example.com']){
  const r=blocked(s=>{s.accessApps[0].domain=domain;});
  assert(r.missing.includes('no_legacy_pages_or_host_wildcard_claim'),domain);
 }
});
test('19 the current read-only Cloudflare evidence is unequivocally NOT admitted',()=>{
 const r=assessAccessDeployment({
  workers:[{name:'ngoctien20-bio',id:'public-bio'}],
  accessApps:[{name:'tien404-ai-git-staging - Cloudflare Pages',type:'self_hosted',
   domain:'*.tien404-ai-git-staging.pages.dev'}],accessPolicies:[]},{});
 assert.equal(r.status,'BLOCKED');
 assert.equal(r.deploy_authorized,false);
});
