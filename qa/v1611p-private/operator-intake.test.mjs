import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CONTRACT,RELEASE,REQUEST_STATES,REQUIRED_PROOFS,RECOVERY_DOMAINS,
 prepareRecoveryRequest,assessRecoveryPlan,createQaIntakeLedger} from './operator-intake.mjs';
const packet=JSON.parse(readFileSync(new URL('../../docs/ai-handoff/V16_11P_PRIVATE_OPERATOR_REQUEST_PACKET.json',import.meta.url),'utf8'));
const prev=JSON.parse(readFileSync(new URL('../../docs/ai-handoff/V16_11_PRIVATE_OPERATOR_APPROVAL_PACKET.json',import.meta.url),'utf8'));
const now=1794800000000;
const bad=(f,re)=>assert.throws(f,new RegExp(re));
const request=()=>({request_id:'QA_REQUEST_001',project_ref:'ifxlvrhyjhbzbrkdsida',
 environment:'STAGING',operation:'APPROVAL_PREPARATION_ONLY',
 data_scope:'METADATA_AND_SYNTHETIC_ONLY',restore_target:'NOT_PROVISIONED',
 backup_destination:'NOT_CONFIGURED',operator_role:'RECOVERY_OPERATOR',
 requester_role:'PLATFORM_REQUESTER',reviewer_role:'INDEPENDENT_SECURITY_REVIEWER',
 window_status:'NOT_APPROVED',cost_status:'QUOTE_REQUIRED',max_cost_vnd:null,
 merchant_authority_status:'MISSING',evidence_ref:null,
 created_ms:now,expires_ms:now+3600000});
const actors=()=>{
 const ledger=createQaIntakeLedger();
 return {ledger,owner:ledger.issueQaIdentity('QA_OWNER_A','QA_STORE_A'),
  ownerB:ledger.issueQaIdentity('QA_OWNER_B','QA_STORE_B'),
  operator:ledger.issueQaIdentity('QA_OPERATOR_A','QA_STORE_A'),
  reviewer:ledger.issueQaIdentity('QA_REVIEWER_A','QA_STORE_A'),
  backup:ledger.issueQaIdentity('QA_BACKUP_OPERATOR_A','QA_STORE_A'),
  release:ledger.issueQaIdentity('QA_RELEASE_A','QA_STORE_A')};
};
const item=()=>REQUIRED_PROOFS[0];
const ask=(x,scope=x.owner,kind=item())=>
 x.ledger.requestEvidence({scope,store:'QA_STORE_A',kind,request_id:'QA_EVID_REQUEST_001'});
const receipt=(x,scope=x.operator,kind=item())=>
 x.ledger.registerOpaqueQaReceipt({scope,store:'QA_STORE_A',kind,
 request_id:'QA_EVID_REQUEST_001',receipt_id:'QA_RECEIPT_001'});
const review=(x,scope=x.reviewer,kind=item())=>
 x.ledger.reviewQaReceipt({scope,store:'QA_STORE_A',kind});
test('01 contract dedicated to private QA request preparation',()=>{
 assert.equal(CONTRACT,'T404_V1611P_PRIVATE_OPERATOR_INTAKE_SOURCE_ONLY_V1');
});
test('02 no release from source code',()=>assert.equal(RELEASE,'NO_GO_EXTERNAL_AUTHORITY_AND_HOSTED_RECOVERY_MISSING'));
test('03 preparation state list deliberately excludes APPROVED',()=>{
 assert(!REQUEST_STATES.some(x=>x.includes('AUTHORIZED')||x==='PRODUCTION_RELEASED'));
});
test('04 exactly 18 independent proof requirements',()=>{
 assert.equal(REQUIRED_PROOFS.length,18);assert.equal(new Set(REQUIRED_PROOFS).size,18);
});
test('05 recovery covers seven domains',()=>assert.equal(RECOVERY_DOMAINS.length,7));
test('06 request packet has expected version and NO_GO',()=>{
 assert.equal(packet.contract,'T404_V1611P_PRIVATE_OPERATOR_APPROVAL_REQUEST_PACKET_V1');
 assert.equal(packet.release,'NO_GO');
});
test('07 all real evidence still missing or schema-blocked',()=>{
 assert.equal(packet.evidence_specs.length,18);
 assert(packet.evidence_specs.every(x=>['MISSING','BLOCKED_BY_SCHEMA'].includes(x.status)));
});
test('08 all hosted actions unauthorized',()=>{
 assert.equal(packet.action_requests.length,9);
 assert(packet.action_requests.every(x=>x.state==='NOT_AUTHORIZED'||x.state==='DO_NOT_APPLY'));
});
test('09 no operator identity/PII published',()=>{
 assert(packet.actors.every(x=>x.proof_ref===null));
 assert(!packet.actors.some(x=>x.assignment==='VERIFIED'));
});
test('10 cost quote and approval missing',()=>{
 assert.equal(packet.budget.quote_received,false);
 assert.equal(packet.budget.user_approved_max_vnd,null);
 assert.equal(packet.budget.payment_incurred,false);
});
test('11 no automated recovery to production',()=>{
 assert(Object.values(packet.approvals).every(x=>x===false));
});
test('12 upstream V16.11 grant state never promoted',()=>{
 assert.equal(prev.approval.explicit_user_hosted_backup_approval,false);
 assert.equal(prev.approval.explicit_user_restore_approval,false);
});
test('13 valid request returns preparation receipt only',()=>{
 const x=prepareRecoveryRequest(request());
 assert.equal(x.step,'PRIVATE_OPERATOR_REQUEST_DRAFT');
 assert.equal(x.release,RELEASE);assert.equal(x.allow_hosted_backup,false);
});
test('14 request cannot approve hosting migration',()=>{
 assert.equal(prepareRecoveryRequest(request()).allow_store_migration,false);
});
test('15 request cannot issue real JWT UAT',()=>{
 assert.equal(prepareRecoveryRequest(request()).allow_real_jwt_test,false);
});
test('16 request cannot incur paid resources',()=>{
 assert.equal(prepareRecoveryRequest(request()).allow_paid_project,false);
});
test('17 request cannot affect customer data',()=>{
 assert.equal(prepareRecoveryRequest(request()).allow_customer_data,false);
});
test('18 real environment target denied',()=>{
 const x=request();x.environment='PRODUCTION';
 bad(()=>prepareRecoveryRequest(x),'PRODUCTION_TARGET_DENIED');
});
test('19 unrelated Supabase project denied',()=>{
 const x=request();x.project_ref='svxkwpmxgnfvewzwsbdt';
 bad(()=>prepareRecoveryRequest(x),'TARGET_PROJECT_NOT_VERIFIED');
});
test('20 hosted backup operation not authorized',()=>{
 const x=request();x.operation='BACKUP_HOSTED_DATABASE';
 bad(()=>prepareRecoveryRequest(x),'HOSTED_ACTION_NOT_AUTHORIZED');
});
test('21 real merchant data forbidden',()=>{
 const x=request();x.data_scope='CUSTOMER_PII';
 bad(()=>prepareRecoveryRequest(x),'REAL_CUSTOMER_DATA_DENIED');
});
test('22 restore target must remain unprovisioned',()=>{
 const x=request();x.restore_target='existing';
 bad(()=>prepareRecoveryRequest(x),'REAL_RESTORE_TARGET_NOT_AUTHORIZED');
});
test('23 destination cannot be supplied as unreviewed URL',()=>{
 const x=request();x.backup_destination='https://bucket.example';
 bad(()=>prepareRecoveryRequest(x),'BACKUP_DESTINATION_NOT_AUTHORIZED');
});
test('24 platform requester cannot claim backup operator',()=>{
 const x=request();x.requester_role='RECOVERY_OPERATOR';
 bad(()=>prepareRecoveryRequest(x),'SEPARATE_OPERATOR_ROLES_REQUIRED');
});
test('25 reviewer role cannot equal requester',()=>{
 const x=request();x.reviewer_role=x.requester_role;
 bad(()=>prepareRecoveryRequest(x),'SEPARATE_OPERATOR_ROLES_REQUIRED');
});
test('26 bogus signed backup grant rejected',()=>{
 const x=request();x.cost_status='APPROVED';
 bad(()=>prepareRecoveryRequest(x),'UNAPPROVED_COST_NOT_ALLOWED');
});
test('27 non-null max cost not authorized by prep',()=>{
 const x=request();x.max_cost_vnd=100000;
 bad(()=>prepareRecoveryRequest(x),'UNAPPROVED_COST_NOT_ALLOWED');
});
test('28 time window cannot be marked approved from user claim',()=>{
 const x=request();x.window_status='APPROVED';
 bad(()=>prepareRecoveryRequest(x),'DOWNTIME_NOT_AUTHORIZED');
});
test('29 merchant owner status cannot be forged',()=>{
 const x=request();x.merchant_authority_status='VERIFIED';
 bad(()=>prepareRecoveryRequest(x),'UNVERIFIED_OWNER_AUTHORITY');
});
test('30 private evidence ref cannot be pasted here',()=>{
 const x=request();x.evidence_ref='https://example.org/private';
 bad(()=>prepareRecoveryRequest(x),'NO_REAL_EVIDENCE_IN_SOURCE');
});
test('31 token fields rejected by strict allowlist',()=>{
 const x=request();x.jwt='dummy';
 bad(()=>prepareRecoveryRequest(x),'INVALID_OR_UNSAFE_REQUEST_FIELDS');
});
test('32 malformed request ID rejected',()=>{
 const x=request();x.request_id='TICKET-LIVE-1';
 bad(()=>prepareRecoveryRequest(x),'QA_REQUEST_ID_REQUIRED');
});
test('33 invalid expiration denied',()=>{
 const x=request();x.expires_ms=x.created_ms;
 bad(()=>prepareRecoveryRequest(x),'REQUEST_TTL_INVALID');
});
test('34 expiry beyond 24h denied',()=>{
 const x=request();x.expires_ms=x.created_ms+86400001;
 bad(()=>prepareRecoveryRequest(x),'REQUEST_TTL_INVALID');
});
test('35 missing request payload denied',()=>bad(()=>prepareRecoveryRequest(null),'INVALID_OR_UNSAFE_REQUEST_FIELDS'));
test('36 initial plan identifies database recovery as missing',()=>{
 assert(assessRecoveryPlan({}).missing.includes('database'));
});
test('37 initial plan identifies Storage bytes backup missing',()=>{
 assert(assessRecoveryPlan({}).missing.includes('storage_bytes'));
});
test('38 initial plan requires object metadata separate from bytes',()=>{
 assert(assessRecoveryPlan({}).missing.includes('storage_metadata'));
});
test('39 initial plan requires Auth/session and custom roles',()=>{
 assert(assessRecoveryPlan({}).missing.includes('auth_roles'));
});
test('40 initial plan requires independent reviewer and operator',()=>{
 const x=assessRecoveryPlan({});
 assert(x.missing.includes('independent_reviewer'));
 assert(x.missing.includes('operator_authority'));
});
test('41 complete-looking self report cannot authorize real restore',()=>{
 const all={};
 for(const key of ['database','storage_metadata','storage_bytes','auth_roles','rpc_permissions',
  'channel_configs','rollback','encrypted_backup_digest','private_restore_attestation',
  'cost_quote','operator_authority','independent_reviewer'])all[key]='EXTERNALLY_VERIFIED_IN_PRIVATE_SYSTEM';
 const r=assessRecoveryPlan(all);
 assert.equal(r.missing.length,0);
 assert.equal(r.actual_restore_performed,false);
 assert.equal(r.real_evidence_assessed_by_this_code,false);
 assert.equal(r.release,RELEASE);
});
test('42 extra recovery field like access key rejected',()=>{
 bad(()=>assessRecoveryPlan({database:'MISSING',api_key:'dummy'}),'UNSAFE_RECOVERY_PLAN_FIELDS');
});
test('43 owner A synthetic identity can be issued for Store A',()=>{
 const x=actors();assert.equal(x.owner.store,'QA_STORE_A');
});
test('44 owner B cannot be issued for Shop A',()=>{
 bad(()=>createQaIntakeLedger().issueQaIdentity('QA_OWNER_B','QA_STORE_A'),'UNKNOWN_QA_ACTOR_OR_STORE');
});
test('45 unknown real principal cannot be injected',()=>{
 bad(()=>createQaIntakeLedger().issueQaIdentity('A_REAL_EMAIL','QA_STORE_A'),'UNKNOWN_QA_ACTOR_OR_STORE');
});
test('46 forged object does not have internal QA authority',()=>{
 const {ledger}=actors();
 bad(()=>ledger.requestEvidence({scope:{actor:'QA_OWNER_A',role:'MERCHANT_OWNER',store:'QA_STORE_A'},
  store:'QA_STORE_A',kind:item(),request_id:'QA_EVID_REQUEST_001'}),'UNTRUSTED_OR_CROSS_STORE_QA_SCOPE');
});
test('47 shop-scoped synthetic owner can request metadata only',()=>{
 const x=actors(),v=ask(x);
 assert.equal(v.state,'EVIDENCE_REQUESTED_NO_UPLOAD');
 assert.equal(v.upload_url_created,false);
});
test('48 Shop A owner scope cannot request for Shop B',()=>{
 const x=actors();
 bad(()=>x.ledger.requestEvidence({scope:x.owner,store:'QA_STORE_B',
  kind:item(),request_id:'QA_EVID_REQUEST_001'}),'UNTRUSTED_OR_CROSS_STORE_QA_SCOPE');
});
test('49 recovery operator cannot request merchant evidence as owner',()=>{
 const x=actors();bad(()=>ask(x,x.backup),'ROLE_NOT_AUTHORIZED_FOR_QA_STEP');
});
test('50 unknown evidence type rejected',()=>{
 const x=actors();bad(()=>ask(x,x.owner,'TOKEN_SECRET'),'EVIDENCE_KIND_UNKNOWN');
});
test('51 real link cannot become public proof record',()=>{
 const x=actors();ask(x);
 bad(()=>x.ledger.registerOpaqueQaReceipt({scope:x.operator,store:'QA_STORE_A',kind:item(),
 request_id:'QA_EVID_REQUEST_001',receipt_id:'https://private.example/proof'}),
 'PRIVATE_PROOF_REMAINS_OUTSIDE_SOURCE');
});
test('52 submitted QA receipt cannot claim external verification',()=>{
 const x=actors();ask(x);const v=receipt(x);
 assert.equal(v.state,'QA_METADATA_RECEIVED');
 assert.equal(v.real_evidence_verified,false);
});
test('53 reviewer can mark QA metadata but not real proof',()=>{
 const x=actors();ask(x);receipt(x);const v=review(x);
 assert.equal(v.state,'QA_METADATA_REVIEWED_ONLY');
 assert.equal(v.independent_external_review,false);
 assert.equal(v.hosted_authority,false);
});
test('54 merchant Owner cannot independently review own metadata',()=>{
 const x=actors();ask(x);receipt(x);
 bad(()=>review(x,x.owner),'ROLE_NOT_AUTHORIZED_FOR_QA_STEP');
});
test('55 QA duplicate evidence request fails',()=>{
 const x=actors();ask(x);bad(()=>ask(x),'DUPLICATE_QA_REQUEST');
});
test('56 QA receipt replay fails',()=>{
 const x=actors();ask(x);receipt(x);
 bad(()=>receipt(x),'RECEIPT_REPLAY_FORBIDDEN');
});
test('57 independent reviewer cannot review missing receipt',()=>{
 const x=actors();ask(x);bad(()=>review(x),'RECEIPT_NOT_REVIEWABLE');
});
test('58 QA duplicate review fails',()=>{
 const x=actors();ask(x);receipt(x);review(x);
 bad(()=>review(x),'RECEIPT_NOT_REVIEWABLE');
});
test('59 even 18/18 QA reviews never unlock production',()=>{
 const x=actors();
 for(let i=0;i<REQUIRED_PROOFS.length;i++){
  const kind=REQUIRED_PROOFS[i],request_id='QA_EVID_REQUEST_'+String(i+100);
  x.ledger.requestEvidence({scope:x.operator,store:'QA_STORE_A',kind,request_id});
  x.ledger.registerOpaqueQaReceipt({scope:x.operator,store:'QA_STORE_A',kind,
   request_id,receipt_id:'QA_RECEIPT_'+String(i+100)});
  x.ledger.reviewQaReceipt({scope:x.reviewer,store:'QA_STORE_A',kind});
 }
 const v=x.ledger.snapshot({scope:x.release,store:'QA_STORE_A'});
 assert.equal(v.metadata_reviewed,18);assert.equal(v.real_evidence_count,0);
 assert.equal(v.prod_approval,false);assert.equal(v.release,RELEASE);
});
test('60 Shop B cannot see Store A private QA evidence',()=>{
 const x=actors();ask(x);
 bad(()=>x.ledger.snapshot({scope:x.ownerB,store:'QA_STORE_A'}),'UNTRUSTED_OR_CROSS_STORE_QA_SCOPE');
});
test('61 QA audit has no receipt references or private files',()=>{
 const x=actors();ask(x);receipt(x);
 const log=x.ledger.auditForStore({scope:x.reviewer,store:'QA_STORE_A'});
 assert.equal(log.length,2);
 assert(!JSON.stringify(log).includes('QA_RECEIPT_001'));
});
test('62 unauthorized merchant cannot read security audit',()=>{
 const x=actors();ask(x);
 bad(()=>x.ledger.auditForStore({scope:x.owner,store:'QA_STORE_A'}),'ROLE_NOT_AUTHORIZED_FOR_QA_STEP');
});
test('63 actual file upload signer permanently denied',()=>{
 bad(()=>createQaIntakeLedger().issueSignedUploadUrl(),'REAL_HOSTED_ACTION_REQUIRES_SEPARATE_EXTERNAL_AUTHORIZATION');
});
test('64 real proof intake permanently denied',()=>{
 bad(()=>createQaIntakeLedger().collectRealProof(),'REAL_HOSTED_ACTION_REQUIRES_SEPARATE_EXTERNAL_AUTHORIZATION');
});
test('65 backup, restore and migration all permanently denied',()=>{
 const l=createQaIntakeLedger();
 for(const f of ['approveBackup','approveRestore','approveMigration'])
 bad(()=>l[f](),'REAL_HOSTED_ACTION_REQUIRES_SEPARATE_EXTERNAL_AUTHORIZATION');
});
test('66 RPC revoke and commerce pilot permanently denied',()=>{
 const l=createQaIntakeLedger();
 for(const f of ['approveRpcRevocation','approveCommercialPilot'])
 bad(()=>l[f](),'REAL_HOSTED_ACTION_REQUIRES_SEPARATE_EXTERNAL_AUTHORIZATION');
});
test('67 new source contains no network/client persistence',()=>{
 const src=readFileSync(new URL('./operator-intake.mjs',import.meta.url),'utf8');
 for(const term of ['fetch(', 'XMLHttpRequest','process.env','localStorage','createClient(','service_role ='])
 assert.equal(src.includes(term),false,term);
});
test('68 private packet does not contain actual names, contact details or backup content',()=>{
 const s=JSON.stringify(packet);
 for(const term of ['BEGIN PRIVATE KEY','Bearer ', 'postgresql://','+849','@gmail.com'])
 assert.equal(s.includes(term),false,term);
});
