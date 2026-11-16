import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CONTRACT,RELEASE,EVIDENCE_REQUIREMENTS,assessHostedMetadata,planRecoveryCoverage,
 validatePrivateOperatorRequest,createQaPrivateAuthorityLedger,approveProductionRelease}
 from './authority-gate.mjs';
const baseline=JSON.parse(readFileSync(
 new URL('../../docs/ai-handoff/V16_11_HOSTED_READ_ONLY_BASELINE.json',import.meta.url),'utf8'));
const approval=JSON.parse(readFileSync(
 new URL('../../docs/ai-handoff/V16_11_PRIVATE_OPERATOR_APPROVAL_PACKET.json',import.meta.url),'utf8'));
const prev=JSON.parse(readFileSync(
 new URL('../../docs/ai-handoff/V16_10_PRIVATE_OPERATOR_AUTHORITY_EVIDENCE_MANIFEST.json',import.meta.url),'utf8'));
const sql=readFileSync(new URL('../../docs/ai-handoff/V16_11_READ_ONLY_HOSTED_METADATA_QUERIES.sql',import.meta.url),'utf8');
const md=readFileSync(new URL('../../docs/ai-handoff/V16_11_PRIVATE_HOSTED_AUTHORITY_RECOVERY_ACCEPTANCE_CHECKPOINT.md',import.meta.url),'utf8');
const invalid=(fn,re)=>assert.throws(fn,new RegExp(re));
const now=1794800000000;
const req=()=>({request_id:'QA_REQUEST_001',scope:'PRIVATE_PREFLIGHT_DESIGN_NOT_EXECUTION',
 target_project_ref:'ifxlvrhyjhbzbrkdsida',target_kind:'STAGING_SOURCE_REVIEW',
 data_class:'NO_REAL_CUSTOMER_DATA',requester_role:'MERCHANT_OWNER',
 operator_role:'BACKUP_OPERATOR',reviewer_role:'SECURITY_REVIEWER',
 restore_target:'NOT_PROVISIONED',expense_approved:false,downtime_approved:false,
 customer_data_authorized:false,rollback_plan_ref:'QA_ROLLBACK_001',
 expires_at_ms:now+3600000,now_ms:now});
function ledgerWithActors(){
 const l=createQaPrivateAuthorityLedger();
 return {l,owner:l.issueQaActor('QA_MERCHANT_OWNER_A','QA_STORE_A'),
  ownerB:l.issueQaActor('QA_MERCHANT_OWNER_B','QA_STORE_B'),
  staff:l.issueQaActor('QA_TIEN404_OPERATOR_A','QA_STORE_A'),
  reviewer:l.issueQaActor('QA_SECURITY_REVIEWER_A','QA_STORE_A'),
  backup:l.issueQaActor('QA_BACKUP_OPERATOR_A','QA_STORE_A'),
  release:l.issueQaActor('QA_RELEASE_OWNER_A','QA_STORE_A')};
}
test('01 scope contract is strictly source-only',()=>assert.match(CONTRACT,/SOURCE_ONLY/));
test('02 release permanently NO_GO absent actual proof',()=>assert.equal(RELEASE,'NO_GO_HOSTED_SECURITY_NOT_CERTIFIED'));
test('03 15 distinct real evidence categories required',()=>{
 assert.equal(EVIDENCE_REQUIREMENTS.length,15);
 assert.equal(new Set(EVIDENCE_REQUIREMENTS).size,15);
});
test('04 hosted baseline is read-only source',()=>{
 assert.equal(baseline.fact_verification,'VERIFIED_READ_ONLY');
 assert.equal(baseline.hosted_sql_modified,false);
 assert.equal(baseline.production_security_certified,false);
});
test('05 hosted Store tables missing',()=>{
 const x=assessHostedMetadata(baseline);
 assert(x.blockers.includes('STORE_SCHEMA_MISSING:stores'));
 assert(x.blockers.includes('STORE_SCHEMA_MISSING:store_memberships'));
});
test('06 Products Orders Customers store_id missing',()=>{
 const x=assessHostedMetadata(baseline);
 for(const k of ['products_store_id','orders_store_id','customers_store_id'])
 assert(x.blockers.includes('STORE_SCHEMA_MISSING:'+k),k);
});
test('07 FORCE RLS true is NOT sufficient for Store security',()=>{
 const r=assessHostedMetadata(baseline);
 assert(baseline.verified_rls.products.forced);
 assert(r.blockers.includes('SAME_TENANT_STORE_RLS_UNCERTIFIED'));
});
test('08 Same-Tenant Owner A/B genuine JWT proof not provided',()=>{
 const r=assessHostedMetadata(baseline);
 assert(r.blockers.includes('REAL_JWT_A_B_NOT_VERIFIED'));
});
test('09 Old unique tenant SKU constraint blocks independent Store SKU',()=>{
 const r=assessHostedMetadata(baseline);
 assert(r.blockers.includes('SKU_STORE_SCOPE_NOT_MIGRATED'));
 assert.equal(baseline.constraints.products_unique,'UNIQUE (tenant_id, sku)');
});
test('10 Old order/customer foreign key only Tenant scoped',()=>{
 const r=assessHostedMetadata(baseline);
 assert(r.blockers.includes('ORDER_CUSTOMER_STORE_FK_MISSING'));
});
test('11 public privileged RPC caller review unresolved',()=>{
 const r=assessHostedMetadata(baseline);
 assert(r.blockers.includes('RPC_PRIVILEGED_CALLER_REVIEW_PENDING'));
 assert.equal(baseline.privileged_rpcs.length,3);
});
test('12 anonymous executable SECURITY DEFINER RPC warning recorded',()=>{
 assert(baseline.privileged_rpcs.some(x=>x.name==='qa_shop_b_zalo_claim'&&x.anon_execute));
});
test('13 complete-looking external self-report does not allow release',()=>{
 const b=structuredClone(baseline);
 b.verified_schema={...b.verified_schema,stores:true,store_memberships:true,
  products_store_id:true,orders_store_id:true,customers_store_id:true};
 b.policy_scope.same_tenant_different_store='VERIFIED_INDEPENDENT_REAL_JWT';
 b.policy_scope.jwt_owner_AB_real='INDEPENDENTLY_VERIFIED';
 b.constraints.store_scoped_sku_unique=true;
 b.constraints.store_scoped_order_customer_fk=true;
 b.privileged_rpcs=b.privileged_rpcs.map(x=>({...x,review:'INDEPENDENTLY_ATTESTED'}));
 const x=assessHostedMetadata(b);
 assert.equal(x.blockers.length,0);
 assert.equal(x.release,RELEASE);
 assert.equal(x.hosted_store_ready,false);
 assert.equal(x.real_jwt_certified,false);
});
test('14 hostile baseline missing contract refused',()=>invalid(()=>assessHostedMetadata({}),'UNTRUSTED'));
test('15 new privileged RPC default denied',()=>{
 const b=structuredClone(baseline);
 b.privileged_rpcs=[...b.privileged_rpcs,{name:'qa_new',review:'MISSING'}];
 assert(assessHostedMetadata(b).blockers.includes('RPC_PRIVILEGED_CALLER_REVIEW_PENDING'));
});
test('16 unexpected hosted mutation triggers incident flag',()=>{
 const b=structuredClone(baseline);b.hosted_sql_modified=true;
 assert(assessHostedMetadata(b).blockers.includes('UNEXPECTED_HOSTED_MUTATION_REQUIRES_INCIDENT_REVIEW'));
});
test('17 database restore not yet independently proven',()=>{
 const p=planRecoveryCoverage({});
 assert(p.blockers.includes('DB_BACKUP_RESTORE_NOT_PROVEN'));
});
test('18 Storage file bytes separate from DB backup',()=>{
 const p=planRecoveryCoverage({});
 assert(p.blockers.includes('STORAGE_FILE_BYTES_NOT_COVERED_BY_DB_BACKUP'));
});
test('19 Auth/session custom roles require recovery coverage',()=>{
 const p=planRecoveryCoverage({});
 assert(p.blockers.includes('AUTH_SESSIONS_ROLE_RECOVERY_NOT_PROVEN'));
});
test('20 backup operator approval is independent',()=>{
 const p=planRecoveryCoverage({});
 assert(p.blockers.includes('RECOVERY_OPERATOR_APPROVAL_MISSING'));
});
test('21 forged complete self-report remains NO_GO',()=>{
 const p=planRecoveryCoverage({
  database:'ENCRYPTED_BACKUP_AND_PRIVATE_DISPOSABLE_RESTORE_INDEPENDENTLY_VERIFIED',
  storage:'OBJECT_BYTES_AND_METADATA_RECOVERY_INDEPENDENTLY_VERIFIED',
  auth:'SESSION_AND_ROLE_RECOVERY_PRIVATELY_REVIEWED',
  operator_authorization:'SEPARATE_EXPLICIT_WRITTEN_APPROVAL'});
 assert.equal(p.blockers.length,0);
 assert.equal(p.release,RELEASE);
 assert.equal(p.genuine_backup_verified_by_this_code,false);
});
test('22 approval packet has all high-risk actions denied',()=>{
 assert(approval.exact_action_scopes.every(x=>
  x.status==='NOT_AUTHORIZED'||x.status==='DO_NOT_APPLY'||x.status==='OBSERVED_CONNECTOR_ONLY'));
});
test('23 approval packet real restore target not provisioned',()=>{
 assert(approval.exact_action_scopes.some(x=>x.action==='RESTORE_HOSTED_BACKUP_TO_DISPOSABLE_TARGET'&&x.target==='NOT_PROVISIONED'));
});
test('24 no budget or maintenance window authorized',()=>{
 assert.equal(approval.approval.cost_approved,false);
 assert.equal(approval.approval.downtime_window_approved,false);
});
test('25 no host data files or auth tokens recorded',()=>{
 assert.equal(approval.recovery_coverage.storage_object_bytes,false);
 assert.equal(approval.jwt_rls_acceptance.real_auth_jwt_owner_A,false);
 assert.equal(approval.jwt_rls_acceptance.real_auth_jwt_owner_B,false);
});
test('26 V16.10 missing private evidence not silently promoted',()=>{
 assert(prev.security_gates.every(x=>x.status==='MISSING'));
 assert.equal(prev.release_decision,'NO_GO');
});
test('27 valid design-only operator request grants zero effect',()=>{
 const x=validatePrivateOperatorRequest(req());
 assert.equal(x.allow_hosted_backup,false);
 assert.equal(x.allow_sql_migration,false);
 assert.equal(x.allow_rpc_revoke,false);
 assert.equal(x.release,RELEASE);
});
test('28 cannot request real backup scope via design-only contract',()=>{
 const x=req();x.scope='BACKUP_LIVE_STAGING';
 invalid(()=>validatePrivateOperatorRequest(x),'HOSTED_OPERATION_NOT_AUTHORIZED');
});
test('29 wrong project denied',()=>{
 const x=req();x.target_project_ref='svxkwpmxgnfvewzwsbdt';
 invalid(()=>validatePrivateOperatorRequest(x),'UNVERIFIED_PROJECT');
});
test('30 production target explicitly denied',()=>{
 const x=req();x.target_kind='PRODUCTION';
 invalid(()=>validatePrivateOperatorRequest(x),'UNAUTHORIZED_TARGET_KIND');
});
test('31 real customer data scope denied',()=>{
 const x=req();x.data_class='CUSTOMER_LIST';
 invalid(()=>validatePrivateOperatorRequest(x),'CUSTOMER_DATA_NOT_AUTHORIZED');
});
test('32 unverified claimed budget approval rejected',()=>{
 const x=req();x.expense_approved=true;
 invalid(()=>validatePrivateOperatorRequest(x),'UNVERIFIED_REAL_OPERATION_APPROVAL');
});
test('33 unverified claimed downtime approval rejected',()=>{
 const x=req();x.downtime_approved=true;
 invalid(()=>validatePrivateOperatorRequest(x),'UNVERIFIED_REAL_OPERATION_APPROVAL');
});
test('34 restoration target not provisioned by QA tool',()=>{
 const x=req();x.restore_target='EXISTING_PRODUCTION_PROJECT';
 invalid(()=>validatePrivateOperatorRequest(x),'REAL_RESTORE_TARGET_NOT_APPROVED');
});
test('35 separation of requester and reviewer enforced',()=>{
 const x=req();x.reviewer_role=x.requester_role;
 invalid(()=>validatePrivateOperatorRequest(x),'SEPARATION_OF_DUTIES_REQUIRED');
});
test('36 change request expires within 24h',()=>{
 const x=req();x.expires_at_ms=x.now_ms+90000000;
 invalid(()=>validatePrivateOperatorRequest(x),'REQUEST_EXPIRY_INVALID');
});
test('37 extra payload containing token refused',()=>{
 const x=req();x.access_token='DO_NOT_STORE';
 invalid(()=>validatePrivateOperatorRequest(x),'UNSAFE_PRIVATE_REQUEST_FIELDS');
});
test('38 arbitrary rollback URL refused',()=>{
 const x=req();x.rollback_plan_ref='https://example.invalid/backup';
 invalid(()=>validatePrivateOperatorRequest(x),'PRIVATE_ROLLBACK_REF_REQUIRED');
});
test('39 Shop B Owner cannot be assigned Shop A scope',()=>{
 const l=createQaPrivateAuthorityLedger();
 invalid(()=>l.issueQaActor('QA_MERCHANT_OWNER_B','QA_STORE_A'),'QA_ROLE_STORE_NOT_ASSIGNED');
});
test('40 forged actor scope object cannot submit',()=>{
 const l=createQaPrivateAuthorityLedger();
 invalid(()=>l.submitQaMetadata({scope:{actor:'QA_MERCHANT_OWNER_A',store:'QA_STORE_A',role:'MERCHANT_OWNER'},
  store:'QA_STORE_A',kind:EVIDENCE_REQUIREMENTS[0],ref:'QA_PRIVATE_REF_001'}),'QA_ROLE_SCOPE_DENIED');
});
test('41 supported QA merchant metadata accepted as unverified',()=>{
 const {l,owner}=ledgerWithActors();
 const d=l.submitQaMetadata({scope:owner,store:'QA_STORE_A',
  kind:EVIDENCE_REQUIREMENTS[0],ref:'QA_PRIVATE_REF_001'});
 assert.equal(d.status,'UNVERIFIED_QA_METADATA');
 assert.equal(d.actual_private_evidence_verified,false);
});
test('42 raw private link refused as evidence reference',()=>{
 const {l,owner}=ledgerWithActors();
 invalid(()=>l.submitQaMetadata({scope:owner,store:'QA_STORE_A',
  kind:EVIDENCE_REQUIREMENTS[0],ref:'https://vault.example/private/123'}),'REAL_PROOF_MUST_STAY_IN_PRIVATE_VAULT');
});
test('43 duplicate QA metadata for same kind refused',()=>{
 const {l,owner}=ledgerWithActors(),x={scope:owner,store:'QA_STORE_A',
  kind:EVIDENCE_REQUIREMENTS[0],ref:'QA_PRIVATE_REF_001'};
 l.submitQaMetadata(x);
 invalid(()=>l.submitQaMetadata(x),'QA_EVIDENCE_ALREADY_SUBMITTED');
});
test('44 Owner cannot self-review as security reviewer',()=>{
 const {l,owner}=ledgerWithActors();
 l.submitQaMetadata({scope:owner,store:'QA_STORE_A',kind:EVIDENCE_REQUIREMENTS[0],ref:'QA_PRIVATE_REF_001'});
 invalid(()=>l.reviewQaMetadata({scope:owner,store:'QA_STORE_A',
  kind:EVIDENCE_REQUIREMENTS[0]}),'QA_ROLE_SCOPE_DENIED');
});
test('45 independent QA metadata reviewer cannot certify hosted',()=>{
 const {l,owner,reviewer}=ledgerWithActors();
 l.submitQaMetadata({scope:owner,store:'QA_STORE_A',kind:EVIDENCE_REQUIREMENTS[0],ref:'QA_PRIVATE_REF_001'});
 const r=l.reviewQaMetadata({scope:reviewer,store:'QA_STORE_A',kind:EVIDENCE_REQUIREMENTS[0]});
 assert.equal(r.status,'QA_METADATA_REVIEW_ONLY');assert.equal(r.actual_hosted_proof,false);
});
test('46 reviewer replay denied',()=>{
 const {l,owner,reviewer}=ledgerWithActors();
 l.submitQaMetadata({scope:owner,store:'QA_STORE_A',kind:EVIDENCE_REQUIREMENTS[0],ref:'QA_PRIVATE_REF_001'});
 l.reviewQaMetadata({scope:reviewer,store:'QA_STORE_A',kind:EVIDENCE_REQUIREMENTS[0]});
 invalid(()=>l.reviewQaMetadata({scope:reviewer,store:'QA_STORE_A',
 kind:EVIDENCE_REQUIREMENTS[0]}),'QA_METADATA_REVIEW_REPLAY');
});
test('47 cross-store reviewer cannot attest Shop B using Shop A scope',()=>{
 const {l,owner,reviewer}=ledgerWithActors();
 l.submitQaMetadata({scope:owner,store:'QA_STORE_A',kind:EVIDENCE_REQUIREMENTS[0],ref:'QA_PRIVATE_REF_001'});
 invalid(()=>l.reviewQaMetadata({scope:reviewer,store:'QA_STORE_B',kind:EVIDENCE_REQUIREMENTS[0]}),'QA_ROLE_SCOPE_DENIED');
});
test('48 even 15/15 metadata QA reviews do not release',()=>{
 const {l,staff,reviewer,owner}=ledgerWithActors();
 for(const [i,kind] of EVIDENCE_REQUIREMENTS.entries()){
  l.submitQaMetadata({scope:staff,store:'QA_STORE_A',kind,ref:'QA_PRIVATE_REF_'+String(i+100)});
  l.reviewQaMetadata({scope:reviewer,store:'QA_STORE_A',kind});
 }
 const s=l.snapshot({scope:owner,store:'QA_STORE_A'});
 assert.equal(s.metadataReviewed,15);assert.equal(s.commercial_release,RELEASE);
 assert.equal(s.real_owner_jwt,'NOT_RUN');
});
test('49 Shop B cannot read Shop A QA metadata',()=>{
 const {l,ownerB}=ledgerWithActors();
 invalid(()=>l.snapshot({scope:ownerB,store:'QA_STORE_A'}),'QA_ROLE_SCOPE_DENIED');
});
test('50 QA audit contains no raw private evidence links',()=>{
 const {l,owner,reviewer}=ledgerWithActors();
 l.submitQaMetadata({scope:owner,store:'QA_STORE_A',kind:EVIDENCE_REQUIREMENTS[0],ref:'QA_PRIVATE_REF_001'});
 const x=l.auditScoped({scope:reviewer,store:'QA_STORE_A'});
 assert.equal(x.length,1);assert(!JSON.stringify(x).includes('QA_PRIVATE_REF_001'));
});
test('51 no real backup can be approved through QA code',()=>{
 invalid(()=>createQaPrivateAuthorityLedger().approveRealBackup(),'REAL_BACKUP_OPERATOR_AUTHORIZATION_NOT_PRESENT');
});
test('52 hosted migration cannot be approved through QA code',()=>{
 invalid(()=>createQaPrivateAuthorityLedger().approveHostedMigration(),'REAL_JWT_AND_STORE_MIGRATION_AUTHORITY_NOT_PRESENT');
});
test('53 no merchant release via QA ledger',()=>{
 invalid(()=>createQaPrivateAuthorityLedger().approveLiveMerchant(),'PRIVATE_EXTERNAL_EVIDENCE_AND_RELEASE_AUTHORITY_NOT_PRESENT');
});
test('54 static production release API throws',()=>{
 invalid(()=>approveProductionRelease(),'PRODUCTION_AUTHORIZATION_REQUIRES_EXTERNAL_PRIVATE_PROOF');
});
test('55 read-only SQL has explicit read-only transaction and no DML/DDL',()=>{
 assert(sql.includes('BEGIN TRANSACTION READ ONLY;'));
 assert(sql.includes('ROLLBACK;'));
 const statements=sql.split('\n').filter(x=>!x.trimStart().startsWith('--')).join('\n');
 assert.doesNotMatch(statements,/\b(?:INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|TRUNCATE|GRANT|REVOKE|COPY)\s+(?:INTO|TABLE|FUNCTION|ON|FROM)/i);
});
test('56 recovery checklist records missing Storage object restore',()=>{
 assert.equal(approval.recovery_coverage.storage_object_bytes,false);
 assert.match(md,/Storage Object bytes/);
});
test('57 hosted real JWT Owner A/B explicitly NOT_RUN',()=>{
 assert.equal(approval.jwt_rls_acceptance.same_tenant_different_store_schema,false);
 assert.match(md,/NOT_RUN_HOSTED/);
});
test('58 current production-safe gate prevents credentials in source',()=>{
 const src=readFileSync(new URL('./authority-gate.mjs',import.meta.url),'utf8');
 for(const text of ['fetch(', 'XMLHttpRequest','process.env','localStorage','service_role =','createClient('])
 assert(!src.includes(text),text);
});
