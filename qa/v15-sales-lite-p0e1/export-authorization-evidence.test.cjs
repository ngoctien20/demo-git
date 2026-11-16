'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {PROJECT,OP,ROLES,PROHIBITS,COVERAGE,
  reviewOneTimeRequest,reviewExportEvidence}=require('./export-authorization-evidence.cjs');
const now=Date.UTC(2026,10,16,3,35);
const ticket=i=>'SEC-TICKET'+String(i).padStart(16,'0');
const actor=i=>'ACT-PRIVATE'+String(i).padStart(16,'0');
function request(){
 const roles={};let i=0;
 for(const [key,issuer_class] of Object.entries(ROLES)){
   roles[key]={actor_ref:actor(i),review_ticket:ticket(i),issuer_class,
     status:'PENDING_INDEPENDENT_PRIVATE_VERIFICATION'};i++;
 }
 return {
  contract:'TIEN404_V15_P0E1_REQUEST_V1',project:PROJECT,
  environment:'staging',operation:OP,request_id:'P0E1-REVIEW000000000001',
  valid_from_ms:now-10000,expires_at_ms:now+100000,
  max_additional_cost_usd:0,retention_days:7,roles,
  prohibits:Object.fromEntries(PROHIBITS.map(k=>[k,true]))
 };
}
function receipt(){
 const coverage={};let i=15;
 for(const key of COVERAGE){
   coverage[key]={status:'PENDING_PRIVATE_COVERAGE_REVIEW',
     review_ticket:ticket(i++)};
 }
 return {
  contract:'TIEN404_V15_P0E1_EXPORT_RECEIPT_V1',
  project:PROJECT,request_id:'P0E1-REVIEW000000000001',
  method:'SUPABASE_CLI_LOGICAL_EXPORT_NOT_YET_VERIFIED',
  source_type:'HOSTED_SUPABASE_STAGING_UNVERIFIED',
  started_at_ms:now-5000,finished_at_ms:now-100,
  encrypted_archive_size_bytes:12345,
  encrypted_archive_sha256:'a'.repeat(64),
  manifest_private_ticket:ticket(10),
  vault_private_ticket:ticket(11),
  integrity_reviewer_ticket:ticket(12),coverage
 };
}
const never=r=>{
 assert.equal(r.status,'BLOCKED');
 for(const k of ['controller_verified','security_reviewer_verified','operator_verified',
  'private_vault_verified','actual_export_verified','checksum_independently_verified',
  'coverage_verified','real_restore_verified','request_approved',
  'can_export','can_restore','can_apply_hosted_migration','can_write_orders',
  'can_send_provider']){
   assert.equal(r[k],false,k);
 }
 assert.equal(r.source_only,true);
};
test('complete self-filled request remains unapproved',()=>{
 const v=reviewOneTimeRequest(request(),now);
 never(v);assert.equal(v.reason,'PRIVATE_CONTROLLER_AND_SECURITY_APPROVAL_REQUIRED');
});
test('complete candidate export receipt remains unverified and unapproved',()=>{
 const v=reviewExportEvidence(request(),receipt(),now);
 never(v);assert.equal(v.reason,'INDEPENDENT_ARCHIVE_PROVENANCE_AND_RESTORE_REQUIRED');
});
test('invalid or missing request never opens an export path',()=>{
 for(const p of [undefined,null,{},[],false,'approve',Object.create(null)]){
   const r=reviewOneTimeRequest(p,now);never(r);
   assert.equal(r.reason,'INVALID_OR_UNAUTHORIZED_REQUEST');
 }
});
test('wrong project, environment, operation and contract denied',()=>{
 for(const [k,val] of [
  ['project','other-project'],['environment','production'],['operation','RESTORE'],
  ['contract','REAL_APPROVAL_OVERRIDE'],['request_id','not-a-request']
 ]){
  const p=request();p[k]=val;
  never(reviewOneTimeRequest(p,now));
 }
});
test('too wide, future or expired consent window denied',()=>{
 for(const [start,end] of [
  [now-3600001,now+100],[now+1,now+100],
  [now-100,now],[now-1000000,now-100],
  [now,now+3600001]
 ]){
  const p=request();p.valid_from_ms=start;p.expires_at_ms=end;
  assert.equal(reviewOneTimeRequest(p,now).reason,'INVALID_OR_UNAUTHORIZED_REQUEST');
 }
});
test('money cost remains capped at 0 USD',()=>{
 for(const cost of [1,-1,'0',0.01,Number.NaN]){
  const p=request();p.max_additional_cost_usd=cost;
  never(reviewOneTimeRequest(p,now));
 }
});
test('retention must be an integer in 1-30 days',()=>{
 for(const days of [0,-1,31,1.5,'7']){
   const p=request();p.retention_days=days;never(reviewOneTimeRequest(p,now));
 }
});
test('every sensitive operation remains explicitly forbidden',()=>{
 for(const action of PROHIBITS){
   const p=request();p.prohibits[action]=false;
   assert.equal(reviewOneTimeRequest(p,now).reason,'INVALID_OR_UNAUTHORIZED_REQUEST',action);
 }
});
test('same actor cannot sign as controller and security reviewer',()=>{
 const p=request();p.roles.security_reviewer.actor_ref=p.roles.controller.actor_ref;
 const r=reviewOneTimeRequest(p,now);never(r);
 assert.equal(r.reason,'UNVERIFIED_OR_DUPLICATED_REVIEWER');
});
test('same review ticket cannot represent two independent approvers',()=>{
 const p=request();p.roles.security_reviewer.review_ticket=p.roles.controller.review_ticket;
 const r=reviewOneTimeRequest(p,now);never(r);
 assert.equal(r.reason,'UNVERIFIED_OR_DUPLICATED_REVIEWER');
});
test('claim of an already approved real signer is NOT valid evidence',()=>{
 const p=request();p.roles.controller.status='APPROVED';
 assert.equal(reviewOneTimeRequest(p,now).reason,'UNVERIFIED_OR_DUPLICATED_REVIEWER');
});
test('role category cannot be changed to merchant shop-only authority',()=>{
 const p=request();p.roles.controller.issuer_class='SHOP_A_OWNER';
 never(reviewOneTimeRequest(p,now));
});
test('unknown reviewer role, token, email or phone rejected',()=>{
 for(const k of ['user_id','email','phone','token','private_key','approved']){
  const p=request();p.roles.controller[k]='redacted';
  never(reviewOneTimeRequest(p,now));
 }
});
test('unknown top-level approval key rejected',()=>{
 const p=request();p.real_authorization=true;
 never(reviewOneTimeRequest(p,now));
});
test('missing reviewer/operator/vault blocks',()=>{
 for(const role of Object.keys(ROLES)){
  const p=request();delete p.roles[role];
  assert.equal(reviewOneTimeRequest(p,now).reason,'INVALID_OR_UNAUTHORIZED_REQUEST');
 }
});
test('receipt must bind exact request and project',()=>{
 for(const [key,val] of [['request_id','P0E1-DIFFERENT00000001'],
   ['project','other-project'],['contract','fake']]){
  const e=receipt();e[key]=val;
  const r=reviewExportEvidence(request(),e,now);never(r);
  assert.equal(r.reason,'INVALID_OR_UNTRUSTED_EXPORT_EVIDENCE_PACKET');
 }
});
test('claim of real verified method or hosted source cannot pass',()=>{
 for(const [key,val] of [
   ['method','SUPABASE_CLI_APPROVED'],['source_type','HOSTED_CERTIFIED'],
  ]){
   const e=receipt();e[key]=val;
   never(reviewExportEvidence(request(),e,now));
 }
});
test('invalid dates and timestamps block archival receipt',()=>{
 for(const [start,finished] of [
  [now+100,now+200],[now-900000,now-100],
  [now-50,now-100],[now-5000,now+1],
  ['now',now-100],[now-5000,NaN]
 ]){
  const e=receipt();e.started_at_ms=start;e.finished_at_ms=finished;
  never(reviewExportEvidence(request(),e,now));
 }
});
test('empty archive, noninteger length and fake hash denied',()=>{
 for(const size of [0,-1,1.5,'12345']){
  const e=receipt();e.encrypted_archive_size_bytes=size;
  never(reviewExportEvidence(request(),e,now));
 }
 for(const h of ['PASS','A'.repeat(64),'x'.repeat(64),'a'.repeat(63)]){
  const e=receipt();e.encrypted_archive_sha256=h;
  never(reviewExportEvidence(request(),e,now));
 }
});
test('artifact raw secret/URL cannot leak via export packet',()=>{
 for(const k of ['access_token','database_url','raw_phone','archive_path','customer_email']){
  const e=receipt();e[k]='redacted';never(reviewExportEvidence(request(),e,now));
 }
});
test('unknown or absent managed schema coverage denied',()=>{
 for(const k of ['auth_managed_data','storage_metadata','storage_object_bytes']){
  const e=receipt();delete e.coverage[k];never(reviewExportEvidence(request(),e,now));
  assert.equal(reviewExportEvidence(request(),e,now).reason,
   'INVALID_OR_UNTRUSTED_EXPORT_EVIDENCE_PACKET');
 }
});
test('duplicate or invalid coverage ticket denied',()=>{
 const e=receipt();e.coverage.auth_managed_data.review_ticket=e.coverage.application_rows.review_ticket;
 const r=reviewExportEvidence(request(),e,now);never(r);
 assert.equal(r.reason,'COVERAGE_PROOF_INVALID');
});
test('fake per-item PASS status denied',()=>{
 const e=receipt();e.coverage.storage_object_bytes.status='PASS';
 const r=reviewExportEvidence(request(),e,now);never(r);
 assert.equal(r.reason,'COVERAGE_PROOF_INVALID');
});
test('same private ticket cannot be reused across three custody verifiers',()=>{
 const e=receipt();e.vault_private_ticket=e.manifest_private_ticket;
 never(reviewExportEvidence(request(),e,now));
});
test('preflight denial always also denies export evidence',()=>{
 const p=request();p.prohibits.provider_send=false;
 const r=reviewExportEvidence(p,receipt(),now);
 never(r);assert.equal(r.reason,'REQUEST_PREFLIGHT_FAILED');
});

test('delayed private audit accepts historical window only for structural review',()=>{
 const p=request(),e=receipt();
 const auditAt=p.expires_at_ms+3600000;
 const v=reviewExportEvidence(p,e,auditAt);
 never(v);
 assert.equal(v.reason,'INDEPENDENT_ARCHIVE_PROVENANCE_AND_RESTORE_REQUIRED');
});
test('evidence claiming export after approval expiry is rejected',()=>{
 const p=request(),e=receipt();
 e.started_at_ms=p.expires_at_ms-10;
 e.finished_at_ms=p.expires_at_ms+10;
 const v=reviewExportEvidence(p,e,p.expires_at_ms+1000);
 never(v);
 assert.equal(v.reason,'REQUEST_PREFLIGHT_FAILED');
});
