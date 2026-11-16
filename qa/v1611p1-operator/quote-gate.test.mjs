import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CONTRACT,RELEASE,RATE_USD_PER_HOUR,RATE_SOURCE,ROLES,
 QUOTE_OPTIONS,PRIVATE_EVIDENCE_REQUIREMENTS,
 compareQuoteOnlyOptions,validateQuoteOnlyRequest,
 prepareWrittenAuthorization,createQaAssignmentLedger} from './quote-gate.mjs';
const packet=JSON.parse(readFileSync(new URL('../../docs/ai-handoff/V16_11P1_OPERATOR_ASSIGNMENT_QUOTE_ONLY_PACKET.json',import.meta.url),'utf8'));
const old=JSON.parse(readFileSync(new URL('../../docs/ai-handoff/V16_11P_PRIVATE_OPERATOR_REQUEST_PACKET.json',import.meta.url),'utf8'));
const fail=(f,re)=>assert.throws(f,new RegExp(re));
const input=()=>({request_id:'QA_QUOTE_REQ_0001',project_ref:'ifxlvrhyjhbzbrkdsida',
 option_id:'SUPABASE_PREVIEW_BRANCH',estimated_hours:24,requested_by:'QA_PLATFORM_REQUESTER',
 scope:'QUOTE_ONLY_NO_PROVISION',data_class:'SYNTHETIC_ONLY',quote_reference:null,
 operator_proof:null,reviewer_proof:null,payer_approval:false,new_resource_id:null,
 maintenance_window:null,signed_authorization:false});
const written=()=>({approval_id:'QA_APPROVAL_0001',target_project_ref:'ifxlvrhyjhbzbrkdsida',
 operation:'PREPARE_QUOTE_AND_APPROVAL_ONLY',environment:'STAGING',
 requester:'QA_PLATFORM_REQUESTER',backup_operator:null,security_reviewer:null,release_owner:null,
 budget_cap_vnd:null,budget_currency:'VND',provider_quote_ref:null,
 window_start:null,window_end:null,restore_target:null,
 data_scope:'NO_REAL_CUSTOMER_DATA',rollback_ref:'QA_ROLLBACK_0001',approval_signature:null});
const actors=()=>{
 const l=createQaAssignmentLedger();return {l,
  requester:l.issueQaScope('QA_PLATFORM_A','QA_STORE_A'),
  security:l.issueQaScope('QA_SECURITY_A','QA_STORE_A'),
  ownerA:l.issueQaScope('QA_OWNER_A','QA_STORE_A'),
  ownerB:l.issueQaScope('QA_OWNER_B','QA_STORE_B')};
};
test('01 strict source-only contract',()=>assert.match(CONTRACT,/DRAFT_V1$/));
test('02 release status remains NO_GO',()=>assert.match(RELEASE,/^NO_GO/));
test('03 public hourly price source included',()=>assert.match(RATE_SOURCE,/supabase.com/));
test('04 price reference 0.01344 USD per hour',()=>assert.equal(RATE_USD_PER_HOUR,0.01344));
test('05 quote scenarios three',()=>assert.equal(QUOTE_OPTIONS.length,3));
test('06 18 missing private evidence requirements',()=>assert.equal(PRIVATE_EVIDENCE_REQUIREMENTS.length,18));
test('07 six actual human role slots',()=>assert.equal(ROLES.length,6));
test('08 estimated 8h micro compute only',()=>assert.equal(compareQuoteOnlyOptions(8)[1].public_reference_compute_usd,0.10752));
test('09 estimated 24h micro compute only',()=>assert.equal(compareQuoteOnlyOptions(24)[1].public_reference_compute_usd,0.32256));
test('10 estimated 72h micro compute only',()=>assert.equal(compareQuoteOnlyOptions(72)[1].public_reference_compute_usd,0.96768));
test('11 new project only compute reference not actual quote',()=>{
 const q=compareQuoteOnlyOptions(24)[2];assert.equal(q.account_specific_cost,'NOT_QUOTED');
});
test('12 local runner cost UNKNOWN not falsely zero',()=>{
 const q=compareQuoteOnlyOptions(24)[0];assert.equal(q.public_reference_compute_usd,null);
});
test('13 Preview Branch additional cost unknown',()=>{
 const q=compareQuoteOnlyOptions(24)[1];assert.equal(q.disk_storage_egress_unknown,true);
});
test('14 quote options never create paid resources',()=>{
 assert(compareQuoteOnlyOptions(24).every(x=>x.resource_created===false));
});
test('15 quote options never authorize real data',()=>{
 assert(compareQuoteOnlyOptions(24).every(x=>x.real_data_permitted===false));
});
test('16 duration zero rejected',()=>fail(()=>compareQuoteOnlyOptions(0),'INVALID_ESTIMATION_DURATION'));
test('17 duration negative rejected',()=>fail(()=>compareQuoteOnlyOptions(-2),'INVALID_ESTIMATION_DURATION'));
test('18 duration over 720 rejected',()=>fail(()=>compareQuoteOnlyOptions(721),'INVALID_ESTIMATION_DURATION'));
test('19 fractional hours rejected',()=>fail(()=>compareQuoteOnlyOptions(1.5),'INVALID_ESTIMATION_DURATION'));
test('20 quote only request accepted as UNSENT',()=>{
 const q=validateQuoteOnlyRequest(input());assert.equal(q.status,'QUOTE_REQUEST_DRAFT_UNSENT');
});
test('21 quote request cannot provision resource',()=>assert.equal(validateQuoteOnlyRequest(input()).allow_provision,false));
test('22 quote request cannot back up hosted',()=>assert.equal(validateQuoteOnlyRequest(input()).allow_back_up,false));
test('23 quote request cannot restore hosted',()=>assert.equal(validateQuoteOnlyRequest(input()).allow_restore,false));
test('24 quote request cannot invoke real jwt test',()=>assert.equal(validateQuoteOnlyRequest(input()).allow_auth_test,false));
test('25 quote request cannot migrate Store',()=>assert.equal(validateQuoteOnlyRequest(input()).allow_store_migration,false));
test('26 quote request cannot send provider message',()=>assert.equal(validateQuoteOnlyRequest(input()).allow_provider_send,false));
test('27 wrong project rejected',()=>{
 const q=input();q.project_ref='svxkwpmxgnfvewzwsbdt';fail(()=>validateQuoteOnlyRequest(q),'TARGET_PROJECT');
});
test('28 provider option not allowlisted rejected',()=>{
 const q=input();q.option_id='UNLIMITED_RESTORE';fail(()=>validateQuoteOnlyRequest(q),'UNKNOWN_RECOVERY_OPTION');
});
test('29 PII data scope rejected',()=>{
 const q=input();q.data_class='CUSTOMER_DATA';fail(()=>validateQuoteOnlyRequest(q),'REAL_PII');
});
test('30 request for actual backup rejected',()=>{
 const q=input();q.scope='BACKUP_NOW';fail(()=>validateQuoteOnlyRequest(q),'HOSTED_EXECUTION');
});
test('31 fake paid quote ID forbidden in public source',()=>{
 const q=input();q.quote_reference='QUOTED_123';fail(()=>validateQuoteOnlyRequest(q),'PROVIDER_QUOTE');
});
test('32 fake operator signed proof denied',()=>{
 const q=input();q.operator_proof='abc';fail(()=>validateQuoteOnlyRequest(q),'REAL_PERSON_PROOF');
});
test('33 self-approval of cost denied',()=>{
 const q=input();q.payer_approval=true;fail(()=>validateQuoteOnlyRequest(q),'COST_APPROVAL');
});
test('34 real resource ID denied',()=>{
 const q=input();q.new_resource_id='project-123';fail(()=>validateQuoteOnlyRequest(q),'HOSTED_RESOURCE');
});
test('35 maintenance window not accepted via QA request',()=>{
 const q=input();q.maintenance_window='tomorrow';fail(()=>validateQuoteOnlyRequest(q),'MAINTENANCE');
});
test('36 user claim of signature denied',()=>{
 const q=input();q.signed_authorization=true;fail(()=>validateQuoteOnlyRequest(q),'SIGNED_ACTION');
});
test('37 token field injection refused',()=>{
 const q=input();q.secret='xx';fail(()=>validateQuoteOnlyRequest(q),'UNSAFE_QUOTE');
});
test('38 written authorization draft always unsigned',()=>{
 const q=prepareWrittenAuthorization(written());assert.equal(q.status,'WRITTEN_APPROVAL_DRAFT_UNSIGNED');
});
test('39 draft contains zero authorized actions',()=>assert.equal(prepareWrittenAuthorization(written()).authorized_actions.length,0));
test('40 draft signer is never independently verified',()=>assert.equal(prepareWrittenAuthorization(written()).independent_signature_verified,false));
test('41 draft cannot create or restore hosted',()=>{
 const a=prepareWrittenAuthorization(written());assert.equal(a.safe_to_provision,false);assert.equal(a.safe_to_restore,false);
});
test('42 request to execute backup denied',()=>{
 const q=written();q.operation='PERFORM_HOSTED_BACKUP';fail(()=>prepareWrittenAuthorization(q),'LIVE_OPERATION');
});
test('43 public appointment of actual backup operator denied',()=>{
 const q=written();q.backup_operator='name';fail(()=>prepareWrittenAuthorization(q),'REAL_OPERATOR_ASSIGNMENT');
});
test('44 public self-signed authorization denied',()=>{
 const q=written();q.approval_signature='SIGNED';fail(()=>prepareWrittenAuthorization(q),'EXTERNAL_SIGNATURE');
});
test('45 budget cap cannot be accepted from fabricated source',()=>{
 const q=written();q.budget_cap_vnd=300000;fail(()=>prepareWrittenAuthorization(q),'QUOTE_AND_BUDGET');
});
test('46 wrong Store project in written approval denied',()=>{
 const q=written();q.target_project_ref='not-main';fail(()=>prepareWrittenAuthorization(q),'TARGET_PROJECT');
});
test('47 synthetic platform requester gets scoped token',()=>{
 const x=actors();assert.equal(x.requester.store,'QA_STORE_A');
});
test('48 cross-Store scope creation denied',()=>fail(()=>createQaAssignmentLedger().issueQaScope('QA_OWNER_B','QA_STORE_A'),'QA_ACTOR_SCOPE_INVALID'));
test('49 forged scope denied',()=>{
 const x=actors();fail(()=>x.l.proposeRole({scope:{...x.requester},store:'QA_STORE_A',role:'BACKUP_RECOVERY_OPERATOR',assignment_ref:'QA_NOM_0001'}),'FORGED_OR_CROSS');
});
test('50 role proposal accepted as metadata only',()=>{
 const x=actors();const n=x.l.proposeRole({scope:x.requester,store:'QA_STORE_A',role:'BACKUP_RECOVERY_OPERATOR',assignment_ref:'QA_NOM_0001'});
 assert.equal(n.status,'QA_PROPOSED_NOT_REAL_ASSIGNMENT');assert.equal(n.can_operate_backup,false);
});
test('51 cannot submit same role twice',()=>{
 const x=actors();const data={scope:x.requester,store:'QA_STORE_A',role:'BACKUP_RECOVERY_OPERATOR',assignment_ref:'QA_NOM_0001'};
 x.l.proposeRole(data);fail(()=>x.l.proposeRole(data),'DUPLICATE_NOMINATION');
});
test('52 only reviewer QA may review nomination',()=>{
 const x=actors();x.l.proposeRole({scope:x.requester,store:'QA_STORE_A',role:'BACKUP_RECOVERY_OPERATOR',assignment_ref:'QA_NOM_0001'});
 fail(()=>x.l.reviewNomination({scope:x.requester,store:'QA_STORE_A',role:'BACKUP_RECOVERY_OPERATOR'}),'ROLE_NOT_ALLOWED');
});
test('53 reviewer metadata is not real human proof',()=>{
 const x=actors();x.l.proposeRole({scope:x.requester,store:'QA_STORE_A',role:'BACKUP_RECOVERY_OPERATOR',assignment_ref:'QA_NOM_0001'});
 const r=x.l.reviewNomination({scope:x.security,store:'QA_STORE_A',role:'BACKUP_RECOVERY_OPERATOR'});
 assert.equal(r.actual_human_assigned,false);assert.equal(r.backup_approval,false);
});
test('54 even reviewed nominations do not enable release',()=>{
 const x=actors();for(const [i,role] of ROLES.entries()){
 x.l.proposeRole({scope:x.requester,store:'QA_STORE_A',role,assignment_ref:'QA_NOM_'+String(100+i)});
 x.l.reviewNomination({scope:x.security,store:'QA_STORE_A',role});
 }
 const s=x.l.status({scope:x.requester,store:'QA_STORE_A'});
 assert.equal(s.release,RELEASE);assert.equal(s.no_real_operator_proven,true);
});
test('55 Shop B owner cannot read Shop A nominations',()=>{
 const x=actors();fail(()=>x.l.status({scope:x.ownerB,store:'QA_STORE_A'}),'FORGED_OR_CROSS');
});
test('56 operator QA never gets paid resource approval',()=>{
 const x=createQaAssignmentLedger();
 for(const f of ['approveQuote','allocateBudget','createBranch','backupHosted',
 'restoreHosted','applyMigration','revokeRpc','approvePilot']){
  fail(()=>x[f](),'EXTERNAL_SIGNED_APPROVAL');
 }
});
test('57 private packet roles not yet assigned',()=>{
 assert(packet.actor_assignments.every(x=>x.real_actor_id===null&&x.private_attestation_ref===null));
});
test('58 actual quotes and signed documents not received',()=>{
 assert.equal(packet.quote_basis.current_org_specific_quote,null);
 assert.equal(packet.approval_scope.signed_written_permission,false);
});
test('59 public reference excludes Store RLS acceptance',()=>{
 assert.equal(packet.baseline.store_schema_hosted,false);
 assert.equal(packet.baseline.real_jwt_rls,'BLOCKED');
});
test('60 no real merchant data or paid API authorized',()=>{
 assert.equal(packet.approval_scope.use_real_merchant_data,false);
 assert.equal(packet.approval_scope.create_paid_resource,false);
});
test('61 prior V16.11P remains with no bill approval',()=>{
 assert.equal(old.budget.quote_received,false);
 assert(Object.values(old.approvals).every(v=>v===false));
});
test('62 quote source code never calls network APIs or stores tokens',()=>{
 const src=readFileSync(new URL('./quote-gate.mjs',import.meta.url),'utf8');
 for(const term of ['fetch(', 'XMLHttpRequest','createClient(', 'process.env','localStorage','service_role ='])
 assert(!src.includes(term),term);
});
