import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 CONTRACT,RELEASE,ACTION,PROJECT_REF,REQUIRED_ROLES,RECOVERY_REQUIREMENTS,
 makeQuoteRequestDraft,assessProviderCostEvidence,prepareSingleActionAuthorization,
 createQaOperatorNominationLedger
} from './approval-gate.mjs';
const packet=JSON.parse(readFileSync(
 new URL('../../docs/ai-handoff/V16_11P2_CONFIDENTIAL_QUOTE_ONE_ACTION_PACKET.json',import.meta.url),'utf8'));
const old=JSON.parse(readFileSync(
 new URL('../../docs/ai-handoff/V16_11P1_OPERATOR_ASSIGNMENT_QUOTE_ONLY_PACKET.json',import.meta.url),'utf8'));
const deny=(fn,reason)=>assert.throws(fn,new RegExp(reason));
const draft=()=>({
 request_id:'QA_COST_001',project_ref:PROJECT_REF,
 organization_confirmation:'PENDING_USER_CONFIRMATION',
 action:ACTION,environment:'STAGING',data_scope:'NO_REAL_CUSTOMER_DATA',
 requested_hours:24,quote_option:'BRANCH',quote_received:false,
 budget_approved:false,resource_created:false,approval_signature:null,operator_evidence:null
});
const approval=()=>({
 approval_id:'QA_AUTH_001',target_ref:PROJECT_REF,action:ACTION,
 requester_role:'PLATFORM_REQUESTER',operator_role:'BACKUP_RECOVERY_OPERATOR',
 reviewer_role:'INDEPENDENT_SECURITY_REVIEWER',
 merchant_owner_A_ref:null,merchant_owner_B_ref:null,
 provider_quote_ref:null,cost_cap_vnd:null,starts_at:null,expires_at:null,
 data_class:'NO_REAL_CUSTOMER_DATA',restore_target:null,
 rollback_ref:'QA_ROLLBACK_001',signature:null
});
const ledger=()=>{
 const l=createQaOperatorNominationLedger();
 return {l,ownerA:l.scope('QA_OWNER_A','QA_STORE_A'),
 ownerB:l.scope('QA_OWNER_B','QA_STORE_B'),
 requester:l.scope('QA_PLATFORM_A','QA_STORE_A'),
 reviewer:l.scope('QA_REVIEWER_A','QA_STORE_A')};
};
test('01 versioned source-only contract',()=>assert.match(CONTRACT,/DRAFT_V1$/));
test('02 immutable hosted NO-GO status',()=>assert.match(RELEASE,/^NO_GO/));
test('03 one operation is a read-only account cost request',()=>assert.equal(ACTION,'REQUEST_ACCOUNT_SPECIFIC_COST_QUOTE_READ_ONLY'));
test('04 exact staging target',()=>assert.equal(PROJECT_REF,'ifxlvrhyjhbzbrkdsida'));
test('05 six independent roles',()=>assert.equal(REQUIRED_ROLES.length,6));
test('06 ten separate recovery proof requirements',()=>assert.equal(RECOVERY_REQUIREMENTS.length,10));
test('07 packet matches contract',()=>assert.equal(packet.contract,'T404_V1611P2_CONFIDENTIAL_OPERATOR_QUOTE_ONE_ACTION_PACKET_V1'));
test('08 parent quote remains unaccepted',()=>assert.equal(old.quote_basis.current_org_specific_quote,null));
test('09 project exists but same-tenant Store schema missing',()=>{
 assert.equal(packet.verified_read_only.project_status,'ACTIVE_HEALTHY');
 assert.equal(packet.verified_read_only.stores_table_exists,false);
});
test('10 organization detected but not yet user-confirmed',()=>{
 assert.equal(packet.verified_read_only.organization_detected,true);
 assert.equal(packet.one_action.organization_confirmation,'PENDING_USER_CONFIRMATION');
});
test('11 both account-specific provider costs unqueried',()=>{
 assert.equal(packet.account_specific_quotes.length,2);
 assert(packet.account_specific_quotes.every(x=>x.get_cost_called===false&&x.provider_cost===null));
});
test('12 real role signatures remain missing',()=>{
 assert.equal(packet.confidential_operator_roles.length,6);
 assert(packet.confidential_operator_roles.every(x=>x.private_signed_attestation_locator===null));
});
test('13 formal authorization unsigned and no budget',()=>{
 assert.equal(packet.written_authorization.status,'DRAFT_UNSIGNED');
 assert.equal(packet.written_authorization.budget_cap,null);
});
test('14 no billable resource or hosted backup authorization',()=>{
 assert.equal(packet.one_action.branch_create,false);
 assert.equal(packet.one_action.hosted_backup,false);
 assert.equal(packet.one_action.hosted_restore,false);
});
test('15 source-only request remains not authorized to call provider',()=>{
 const x=makeQuoteRequestDraft(draft());
 assert.equal(x.authorized_to_call_provider,false);
 assert.equal(x.account_quote_status,'NOT_QUERIED_OR_VERIFIED');
});
test('16 quote request remains limited to one read-only query',()=>{
 assert.equal(makeQuoteRequestDraft(draft()).scope,'SINGLE_READ_ONLY_QUERY_ONLY');
});
test('17 quote BRANCH and PROJECT options prepare without cost calls',()=>{
 const x=draft();x.quote_option='PROJECT';
 assert.equal(makeQuoteRequestDraft(x).quote_type,'PROJECT');
});
test('18 wrong project denied',()=>{
 const x=draft();x.project_ref='other';
 deny(()=>makeQuoteRequestDraft(x),'PROJECT_SCOPE_MISMATCH');
});
test('19 unconfirmed organization cannot be self-approved',()=>{
 const x=draft();x.organization_confirmation='CONFIRMED';
 deny(()=>makeQuoteRequestDraft(x),'ORGANIZATION_CONFIRMATION_REQUIRED');
});
test('20 hostile hosted execution action denied',()=>{
 const x=draft();x.action='BACKUP_HOSTED';
 deny(()=>makeQuoteRequestDraft(x),'NOT_READ_ONLY_COST_QUERY');
});
test('21 production request denied',()=>{
 const x=draft();x.environment='PRODUCTION';
 deny(()=>makeQuoteRequestDraft(x),'PRODUCTION_QUERY_NOT_IN_SCOPE');
});
test('22 real customer data refused',()=>{
 const x=draft();x.data_scope='LIVE_PII';
 deny(()=>makeQuoteRequestDraft(x),'REAL_DATA_FORBIDDEN');
});
test('23 quote self-attestation refused',()=>{
 const x=draft();x.quote_received=true;
 deny(()=>makeQuoteRequestDraft(x),'PREMATURE_QUOTE_OR_SPEND_CLAIM');
});
test('24 budget self-approval refused',()=>{
 const x=draft();x.budget_approved=true;
 deny(()=>makeQuoteRequestDraft(x),'PREMATURE_QUOTE_OR_SPEND_CLAIM');
});
test('25 guessed private attestation refused',()=>{
 const x=draft();x.operator_evidence='https://private.example/';
 deny(()=>makeQuoteRequestDraft(x),'PRIVATE_EVIDENCE_FORBIDDEN');
});
test('26 arbitrary token field rejected',()=>{
 const x=draft();x.jwt='abc';
 deny(()=>makeQuoteRequestDraft(x),'UNSAFE_QUOTE_DRAFT_FIELDS');
});
test('27 time above 168h denied',()=>{
 const x=draft();x.requested_hours=169;
 deny(()=>makeQuoteRequestDraft(x),'HOURS_OUT_OF_RANGE');
});
test('28 malformed request ID denied',()=>{
 const x=draft();x.request_id='REAL-REQUEST';
 deny(()=>makeQuoteRequestDraft(x),'QA_COST_ID_REQUIRED');
});
test('29 actual quote evidence is NOT independently verified by local code',()=>{
 const r=assessProviderCostEvidence({
  quote_type:'BRANCH',provider_response_kind:'ACCOUNT_ORG_SPECIFIC',
  organization_confirmed:true,provider_response_verified:true,
  approved_budget:true,new_resource_created:false,
  file_backup_approved:true,storage_cost_reviewed:true
 });
 assert.equal(r.blockers.length,0);
 assert.equal(r.quote_can_authorize_resource,false);
 assert.equal(r.quote_can_authorize_backup,false);
});
test('30 missing actual cost quote detected',()=>{
 const r=assessProviderCostEvidence({quote_type:'PROJECT'});
 assert(r.blockers.includes('ACCOUNT_SPECIFIC_QUOTE_MISSING'));
});
test('31 unexpected paid resource signals incident',()=>{
 const r=assessProviderCostEvidence({quote_type:'BRANCH',new_resource_created:true});
 assert(r.blockers.includes('UNEXPECTED_PAID_RESOURCE_CREATED'));
});
test('32 forbidden extra provider response field',()=>deny(
 ()=>assessProviderCostEvidence({quote_type:'BRANCH',secret:'xxx'}),'UNSAFE_PROVIDER_COST_EVIDENCE'));
test('33 all written approvals are drafts',()=>{
 const a=prepareSingleActionAuthorization(approval());
 assert.equal(a.approval_state,'DRAFT_UNSIGNED_NO_EFFECT');
 assert.equal(a.production_release,false);
});
test('34 draft cannot authorize restore or migration',()=>{
 const a=prepareSingleActionAuthorization(approval());
 assert.equal(a.hosted_restore,false);
 assert.equal(a.rpc_change,false);
});
test('35 live backup action cannot be smuggled into approval',()=>{
 const a=approval();a.action='BACKUP_HOSTED';
 deny(()=>prepareSingleActionAuthorization(a),'EXECUTION_ACTION_NOT_ALLOWED');
});
test('36 actual operator names cannot be inserted',()=>{
 const a=approval();a.operator_name='REAL PERSON';
 deny(()=>prepareSingleActionAuthorization(a),'UNSAFE_SINGLE_ACTION_FIELDS');
});
test('37 fake merchant authority cannot be attached',()=>{
 const a=approval();a.merchant_owner_A_ref='REAL_PERSON_PROOF';
 deny(()=>prepareSingleActionAuthorization(a),'OWNER_EVIDENCE_NOT_PUBLIC');
});
test('38 self-signed approval is rejected',()=>{
 const a=approval();a.signature='signed';
 deny(()=>prepareSingleActionAuthorization(a),'SIGNED_OR_PROVIDER_PROOF_NOT_VERIFIED');
});
test('39 unverified budget rejected',()=>{
 const a=approval();a.cost_cap_vnd=200000;
 deny(()=>prepareSingleActionAuthorization(a),'SPENDING_OR_WINDOW_NOT_APPROVED');
});
test('40 role swap rejected',()=>{
 const a=approval();a.reviewer_role='PLATFORM_REQUESTER';
 deny(()=>prepareSingleActionAuthorization(a),'SEPARATION_OF_DUTIES_REQUIRED');
});
test('41 synthetic actor scopes are Store specific',()=>{
 const x=ledger();assert.equal(x.ownerA.store,'QA_STORE_A');
 deny(()=>x.l.scope('QA_OWNER_B','QA_STORE_A'),'UNKNOWN_OR_WRONG_STORE_QA_ACTOR');
});
test('42 fake actor scope fails WeakSet attestation',()=>{
 const x=ledger();
 deny(()=>x.l.nominate({scope:{...x.requester},store:'QA_STORE_A',
 role:'BACKUP_RECOVERY_OPERATOR',ref:'QA_NOM_001'}),'FORGED_OR_CROSS_STORE_SCOPE');
});
test('43 only requester may nominate a QA role',()=>{
 const x=ledger();
 deny(()=>x.l.nominate({scope:x.ownerA,store:'QA_STORE_A',
 role:'BACKUP_RECOVERY_OPERATOR',ref:'QA_NOM_001'}),'ROLE_SEPARATION_DENIED');
});
test('44 nomination cannot be called a real assignment',()=>{
 const x=ledger();const r=x.l.nominate({scope:x.requester,store:'QA_STORE_A',
 role:'BACKUP_RECOVERY_OPERATOR',ref:'QA_NOM_001'});
 assert.equal(r.real_actor_verified,false);
 assert.equal(r.status,'QA_NOMINATION_ONLY');
});
test('45 reviewer QA can only review metadata',()=>{
 const x=ledger();
 x.l.nominate({scope:x.requester,store:'QA_STORE_A',
 role:'BACKUP_RECOVERY_OPERATOR',ref:'QA_NOM_001'});
 const v=x.l.review({scope:x.reviewer,store:'QA_STORE_A',role:'BACKUP_RECOVERY_OPERATOR'});
 assert.equal(v.real_person_approved,false);
});
test('46 duplicate nomination denied',()=>{
 const x=ledger(),args={scope:x.requester,store:'QA_STORE_A',
 role:'BACKUP_RECOVERY_OPERATOR',ref:'QA_NOM_001'};
 x.l.nominate(args);
 deny(()=>x.l.nominate(args),'DUPLICATE_NOMINATION');
});
test('47 same-Tenant Shop B owner cannot access Shop A nomination',()=>{
 const x=ledger();
 deny(()=>x.l.status({scope:x.ownerB,store:'QA_STORE_A'}),'FORGED_OR_CROSS_STORE_SCOPE');
});
test('48 even reviewed 6/6 QA roles still no real operators',()=>{
 const x=ledger();
 for(const [i,role] of REQUIRED_ROLES.entries()){
  x.l.nominate({scope:x.requester,store:'QA_STORE_A',role,
   ref:'QA_NOM_'+String(100+i)});
  x.l.review({scope:x.reviewer,store:'QA_STORE_A',role});
 }
 const state=x.l.status({scope:x.requester,store:'QA_STORE_A'});
 assert.equal(state.verified_human_operators,0);
 assert.equal(state.release,RELEASE);
});
test('49 no backup, branch or JWT live action is exposed',()=>{
 const l=createQaOperatorNominationLedger();
 for(const action of ['getRealJWT','authorizeHostedBackup','createPaidProject',
  'provisionBranch','executeRestore','revokeRpc','sendProviderMessage']){
  deny(()=>l[action](),'EXTERNAL_PRIVATE_HUMAN_AUTHORIZATION_REQUIRED');
 }
});
test('50 source contains no provider network/credentials',()=>{
 const s=readFileSync(new URL('./approval-gate.mjs',import.meta.url),'utf8');
 for(const term of ['fetch(', 'XMLHttpRequest','process.env','localStorage',
  'createClient(', 'service_role =']) assert(!s.includes(term),term);
});
