'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {PROJECT,ROLES,PROHIBITS,OP}=require('../v15-sales-lite-p0e1/export-authorization-evidence.cjs');
const {FIELDS}=require('../v15-sales-lite-p0e/backup-coverage-gate.cjs');
const {REQUIRED,decideOneTimeExport}=require('./one-time-export-decision.cjs');
const now=Date.UTC(2026,10,16,4,1,0);
const sec=i=>'SEC-PRIVATE'+String(i).padStart(15,'0');
const act=i=>'ACT-REVIEW'+String(i).padStart(15,'0');
function valid(){
 const roles={};let i=0;
 for(const [key,issuer_class] of Object.entries(ROLES)){
  roles[key]={actor_ref:act(i),review_ticket:sec(i),
    issuer_class,status:'PENDING_INDEPENDENT_PRIVATE_VERIFICATION'};
  i++;
 }
 const request={contract:'TIEN404_V15_P0E1_REQUEST_V1',project:PROJECT,
  environment:'staging',operation:OP,request_id:'P0E1-REVIEW000000000023',
  valid_from_ms:now-10000,expires_at_ms:now+20000,
  max_additional_cost_usd:0,retention_days:7,roles,
  prohibits:Object.fromEntries(PROHIBITS.map(k=>[k,true]))};
 const fields={};i=25;
 for(const [key,source_class] of Object.entries(FIELDS)){
  fields[key]={source_class,method_status:'PENDING_PRIVATE_REVIEW',review_ticket:sec(i++)};
 }
 const coverage={contract:'TIEN404_V15_P0E_COVERAGE_V1',
  project:PROJECT,scope:'REVIEW_ONLY_NO_EXPORT',coverage:fields};
 const evidenceIndex={};i=50;
 for(const key of REQUIRED){
  evidenceIndex[key]={ticket:sec(i++),
   review_state:'PENDING_PRIVATE_INDEPENDENT_VERIFICATION'};
 }
 return {request,coverage,evidenceIndex,nowMs:now};
}
const locked=r=>{
 assert.ok(['NO_GO','PRIVATE_REVIEW_REQUIRED'].includes(r.status));
 assert.equal(r.execution_scope,'NONE');
 for(const k of ['can_export','can_restore','can_apply_migration',
 'can_change_credentials','can_send_provider','can_write_orders',
 'actual_backup_created','actual_restore_certified','owner_real_verified',
 'security_real_verified','lease_real_persisted','real_approval_issued']){
  assert.equal(r[k],false,k);
 }
};
test('no inputs produce NO_GO and explicit deficits',()=>{
 const r=decideOneTimeExport();locked(r);
 assert.equal(r.status,'NO_GO');
 assert.ok(r.blocked.length>0);
});
test('complete self-asserted tickets cannot produce executable approval',()=>{
 const r=decideOneTimeExport(valid());locked(r);
 assert.equal(r.status,'PRIVATE_REVIEW_REQUIRED');
 assert.equal(r.structurally_referenced.length,REQUIRED.length);
 assert.equal(r.real_approval_issued,false);
});
test('missing whole-project controller identity blocks',()=>{
 const x=valid();delete x.evidenceIndex.whole_project_controller_identity;
 const r=decideOneTimeExport(x);locked(r);
 assert.equal(r.status,'NO_GO');
 assert.ok(r.blocked.includes('MISSING_OR_UNTRUSTED_WHOLE_PROJECT_CONTROLLER_IDENTITY'));
});
test('independent security reviewer missing blocks',()=>{
 const x=valid();delete x.evidenceIndex.independent_security_reviewer_identity;
 const r=decideOneTimeExport(x);locked(r);
 assert.equal(r.status,'NO_GO');
});
test('unverified operator permissions block',()=>{
 const x=valid();delete x.evidenceIndex.authorized_backup_operator_access;
 assert.equal(decideOneTimeExport(x).status,'NO_GO');
});
test('no encrypted vault custodianship blocks',()=>{
 const x=valid();delete x.evidenceIndex.encrypted_offsite_destination_and_key_custody;
 assert.equal(decideOneTimeExport(x).status,'NO_GO');
});
test('missing auth, storage, outside services backup scope blocks',()=>{
 const x=valid();delete x.coverage.coverage.auth_users_sessions;
 const r=decideOneTimeExport(x);locked(r);
 assert.ok(r.blocked.includes('BACKUP_COVERAGE_UNASSESSED'));
});
test('missing exact-once durable lease blocks; cannot reuse a paper token',()=>{
 const x=valid();delete x.evidenceIndex.durable_exactly_once_export_lease;
 const r=decideOneTimeExport(x);locked(r);
 assert.ok(r.blocked.includes('MISSING_OR_UNTRUSTED_DURABLE_EXACTLY_ONCE_EXPORT_LEASE'));
});
test('same ticket cannot count as two independent evidence classes',()=>{
 const x=valid();
 x.evidenceIndex.independent_security_reviewer_identity.ticket=
  x.evidenceIndex.whole_project_controller_identity.ticket;
 const r=decideOneTimeExport(x);locked(r);
 assert.ok(r.blocked.some(s=>s.startsWith('MISSING_OR_UNTRUSTED_INDEPENDENT_SECURITY')));
});
test('claim of PASS rather than pending private independent verification denied',()=>{
 const x=valid();x.evidenceIndex.private_audit_and_revocation_process.review_state='PASS';
 assert.equal(decideOneTimeExport(x).status,'NO_GO');
});
test('PII/credential fields in evidence index cannot enter public artifact',()=>{
 for(const key of ['email','phone','user_id','jwt','db_password','api_key','backup_url']){
  const x=valid();x.evidenceIndex[key]='secret';
  const r=decideOneTimeExport(x);locked(r);
  assert.ok(r.blocked.includes('INVALID_PRIVATE_INTAKE_INDEX'));
 }
});
test('wrong staging ref and production target fail',()=>{
 for(const project of ['production','another_project','']){
  const x=valid();x.request.project=project;
  const r=decideOneTimeExport(x);locked(r);
  assert.ok(r.blocked.includes('P0E1_AUTHORIZATION_REQUEST_INVALID'));
 }
});
test('out of window or expired request is invalid',()=>{
 const x=valid();x.nowMs=now+1000000;
 const r=decideOneTimeExport(x);locked(r);
 assert.ok(r.blocked.includes('P0E1_AUTHORIZATION_REQUEST_INVALID'));
});
test('any extra dollar disables export readiness',()=>{
 const x=valid();x.request.max_additional_cost_usd=1;
 const r=decideOneTimeExport(x);locked(r);
 assert.ok(r.blocked.includes('P0E1_AUTHORIZATION_REQUEST_INVALID'));
});
test('request cannot cover restore or production publication',()=>{
 for(const flag of ['restore','production_publish','provider_send','hosted_migration']){
  const x=valid();x.request.prohibits[flag]=false;
  assert.equal(decideOneTimeExport(x).status,'NO_GO');
 }
});
test('merchant-only consent is not whole-project controller',()=>{
 const x=valid();x.request.roles.controller.issuer_class='SHOP_A_OWNER';
 assert.equal(decideOneTimeExport(x).status,'NO_GO');
});
test('duplicate request IDs cannot be asserted as consumed in a local packet',()=>{
 const x=valid();x.evidenceIndex.durable_exactly_once_export_lease.review_state='CONSUMED';
 const r=decideOneTimeExport(x);locked(r);
 assert.equal(r.status,'NO_GO');
});
test('backup coverage tickets all present is still only PRIVATE_REVIEW_REQUIRED',()=>{
 const r=decideOneTimeExport(valid());locked(r);
 assert.equal(r.status,'PRIVATE_REVIEW_REQUIRED');
 assert.equal(r.can_export,false);
});
