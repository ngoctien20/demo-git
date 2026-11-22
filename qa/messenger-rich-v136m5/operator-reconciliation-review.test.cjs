'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {SQL,DECISIONS,createOperatorReconciliationReviewCandidate}=require('./operator-reconciliation-review.cjs');
const TIME=Date.parse('2026-11-22T16:00:00Z');
const KEY='SYNTHETIC_OPERATOR_REVIEW_HMAC_32_CHARS_NOT_REAL';
const TA='11111111-1111-4111-8111-111111111111';
const TB='22222222-2222-4222-8222-222222222222';
const SA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SC='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const PA='12345678901234567',PB='98765432109876543',PC='88888888888888888';
const IA='10000000-0000-4000-8000-000000000001';
const IB='10000000-0000-4000-8000-000000000002';
const IC='10000000-0000-4000-8000-000000000003';
const scope=(over={})=>({
 source:'SERVER_VERIFIED_MESSENGER_BINDING',serverDerived:true,verified:true,
 tenantId:TA,storeId:SA,pageId:PA,...over
});
const fixtures=[
 {id:IA,tenantId:TA,storeId:SA,pageId:PA,status:'PREPARED',
  expected:3,parts:['API_ACCEPTED_MOCK','API_ACCEPTED_MOCK','UNCERTAIN_HOLD']},
 {id:IB,tenantId:TA,storeId:SB,pageId:PB,status:'PREPARED',
  expected:1,parts:['MAY_HAVE_SENT_HOLD']},
 {id:IC,tenantId:TB,storeId:SC,pageId:PC,status:'PREPARED',
  expected:1,parts:['PLANNED']}
];
function make(){
 const plans=fixtures.map(x=>({...x,parts:[...x.parts]}));
 const grants=[
  {dbRole:'ownerA',tenant:TA,store:SA,page:PA,role:'OWNER',active:true,exp:TIME+60000},
  {dbRole:'managerA',tenant:TA,store:SA,page:PA,role:'MANAGER',active:true,exp:TIME+60000},
  {dbRole:'staffA',tenant:TA,store:SA,page:PA,role:'STAFF',active:true,exp:TIME+60000},
  {dbRole:'ownerB',tenant:TA,store:SB,page:PB,role:'OWNER',active:true,exp:TIME+60000},
  {dbRole:'ownerC',tenant:TB,store:SC,page:PC,role:'OWNER',active:true,exp:TIME+60000},
  {dbRole:'expiredA',tenant:TA,store:SA,page:PA,role:'OWNER',active:true,exp:TIME-1}
 ];
 const journal=[],sqlCalls=[],ledgerMutations=[];
 const grant=(dbRole,tenant,store,page)=>grants.find(g=>
  g.dbRole===dbRole&&g.tenant===tenant&&g.store===store&&g.page===page&&
  g.active&&g.exp>TIME);
 const client=(role)=>Object.freeze({
  synthetic:true,externalWrites:false,rollbackOnThrow:true,journalOnly:true,
  profile:'SYNTHETIC_OPERATOR_REVIEW_PG_TX',
  async transaction(fn){
   let readOnly=false;
   const tx={async query(sql,params){
    sqlCalls.push({sql,role});
    if(sql===SQL.readOnly){
     if(readOnly)throw Error('READ_ONLY_ALREADY_SET');
     readOnly=true;return {rows:[]};
    }
    if(sql===SQL.view){
     if(!readOnly||params.length!==4)throw Error('MISSING_READ_ONLY');
     const [tenant,store,page,cutoff]=params;
     const active=grant(role,tenant,store,page);
     if(!active)return {rows:[]};
     const records=plans.filter(p=>p.tenantId===tenant&&p.storeId===store&&p.pageId===page)
      .slice(0,51).map(p=>{
       const count=s=>p.parts.filter(x=>x===s).length;
       return {plan_id:p.id,plan_status:p.status,expected_count:p.expected,
        observed_count:p.parts.length,planned_count:count('PLANNED'),
        inflight_count:count('MAY_HAVE_SENT_HOLD'),
        stale_inflight_count:p.parts.some(s=>s==='MAY_HAVE_SENT_HOLD')&&Date.parse(cutoff)>=TIME-300000?
          count('MAY_HAVE_SENT_HOLD'):0,
        uncertain_count:count('UNCERTAIN_HOLD'),
        mock_ack_count:count('API_ACCEPTED_MOCK'),unknown_count:0};
      });
     return {rows:records};
    }
    if(sql===SQL.append){
     if(readOnly)throw Error('APPEND_IN_READ_ONLY_DENIED');
     if(params.length!==7)throw Error('INVALID_APPEND_PARAMS');
     const [planId,tenant,store,page,id,decision,digest]=params;
     const binding=grant(role,tenant,store,page);
     const plan=plans.find(p=>p.id===planId&&p.tenantId===tenant&&
      p.storeId===store&&p.pageId===page);
     if(!plan||!binding||!['OWNER','MANAGER'].includes(binding.role)||
        (decision==='ACKNOWLEDGE_NO_SEND'&&binding.role!=='OWNER')||
        journal.some(x=>x.planId===planId&&x.digest===digest))
      return {rows:[]};
     journal.push({planId,tenant,store,page,role,accessRole:binding.role,
      id,decision,digest});
     return {rows:[{review_id:id,decision_code:decision}]};
    }
    ledgerMutations.push(sql);
    throw Error('UNAUTHORIZED_SQL');
   }};
   return fn(tx);
  }
 });
 const open=role=>createOperatorReconciliationReviewCandidate({
  mode:'SYNTHETIC_SQL_QA_ONLY',driver:client(role),secret:KEY,now:()=>TIME
 });
 return {open,grants,plans,journal,sqlCalls,ledgerMutations};
}
const record=(agent,planId=IA,decision='REQUEST_PROVIDER_REVIEW',
 sc=scope(),requestId=randomUUID())=>agent.record({
 scope:sc,serverPrivatePlanId:planId,decision,requestId
});
test('hosted mode, missing rollback, external writer or unsupported driver are refused',()=>{
 assert.throws(()=>createOperatorReconciliationReviewCandidate(),/OPERATOR_REVIEW_HOSTED_NOT_APPROVED/);
 const f=make();
 assert.throws(()=>createOperatorReconciliationReviewCandidate({
  mode:'HOSTED',driver:{},secret:KEY
 }),/OPERATOR_REVIEW_HOSTED_NOT_APPROVED/);
 for(const part of [{journalOnly:false},{externalWrites:true},{rollbackOnThrow:false},
  {profile:'PRODUCTION'}]){
  assert.throws(()=>createOperatorReconciliationReviewCandidate({
   mode:'SYNTHETIC_SQL_QA_ONLY',driver:{...{
    synthetic:true,externalWrites:false,journalOnly:true,rollbackOnThrow:true,
    profile:'SYNTHETIC_OPERATOR_REVIEW_PG_TX',transaction:async()=>({})},...part},
   secret:KEY
  }),/OPERATOR_REVIEW_TEST_DRIVER_REQUIRED/);
 }
 assert.equal(f.journal.length,0);
});
test('Owner, manager and staff can only view their current scoped Page/store',async()=>{
 const f=make();
 for(const role of ['ownerA','managerA','staffA']){
  const report=await f.open(role).view({scope:scope()});
  assert.equal(report.reports.length,1);
  assert.equal(report.reports[0].reason,'UNCERTAIN_OUTCOME_REVIEW');
  assert.equal(report.reports[0].mockAcknowledged,2);
  assert.equal(report.reports[0].uncertain,1);
  assert.equal(report.sendAllowed,false);
  assert.equal(report.actorAuthorizedInHosted,false);
 }
 assert.equal((await f.open('ownerB').view({scope:scope({storeId:SB,pageId:PB})})).reports.length,1);
 assert.equal((await f.open('ownerC').view({scope:scope({tenantId:TB,storeId:SC,pageId:PC})})).reports.length,1);
});
test('fake client-supplied Page/store/tenant scope does not expand DB role grant',async()=>{
 const f=make();
 for(const sc of [
  scope({storeId:SB,pageId:PB}),
  scope({tenantId:TB,storeId:SC,pageId:PC}),
  scope({storeId:SA,pageId:PB})
 ]){
  assert.deepEqual((await f.open('ownerA').view({scope:sc})).reports,[]);
 }
 assert.equal(f.journal.length,0);
});
test('staff can view but cannot record, even with OWNER written in caller object',async()=>{
 const f=make();
 const agent=f.open('staffA');
 const out=await agent.record({
  scope:{...scope(),operatorRole:'OWNER',isSuperAdmin:true},
  serverPrivatePlanId:IA,decision:'REQUEST_PROVIDER_REVIEW',requestId:randomUUID()
 });
 assert.equal(out.status,'NOT_AUTHORIZED_NOT_FOUND_OR_DUPLICATE_HOLD');
 assert.equal(f.journal.length,0);
});
test('manager may escalate or request provider review but not acknowledge',async()=>{
 const f=make(),manager=f.open('managerA');
 assert.equal((await record(manager)).status,'SYNTHETIC_REVIEW_JOURNALED');
 assert.equal((await record(manager,IA,'ESCALATE_TO_OWNER')).status,'SYNTHETIC_REVIEW_JOURNALED');
 assert.equal((await record(manager,IA,'ACKNOWLEDGE_NO_SEND')).status,
  'NOT_AUTHORIZED_NOT_FOUND_OR_DUPLICATE_HOLD');
 assert.deepEqual(f.journal.map(x=>x.decision),[
  'REQUEST_PROVIDER_REVIEW','ESCALATE_TO_OWNER'
 ]);
});
test('owner ACKNOWLEDGE_NO_SEND is just journal metadata, not send/retry authorization',async()=>{
 const f=make(),owner=f.open('ownerA');
 const outcome=await record(owner,IA,'ACKNOWLEDGE_NO_SEND');
 assert.equal(outcome.status,'SYNTHETIC_REVIEW_JOURNALED');
 assert.equal(outcome.sendAllowed,false);
 assert.equal(outcome.retryAllowed,false);
 assert.equal(outcome.ledgerMutated,false);
 assert.equal(outcome.providerAccepted,false);
 assert.deepEqual(f.plans[0].parts,['API_ACCEPTED_MOCK','API_ACCEPTED_MOCK','UNCERTAIN_HOLD']);
 assert.equal(f.ledgerMutations.length,0);
});
test('cross-store and cross-tenant review insertion stays denied, UUID knowledge gives no access',async()=>{
 const f=make(),owner=f.open('ownerA');
 for(const [planId,sc] of [
  [IB,scope({storeId:SB,pageId:PB})],
  [IC,scope({tenantId:TB,storeId:SC,pageId:PC})],
  [IA,scope({storeId:SB,pageId:PB})]
 ]){
  const out=await record(owner,planId,'REQUEST_PROVIDER_REVIEW',sc);
  assert.equal(out.status,'NOT_AUTHORIZED_NOT_FOUND_OR_DUPLICATE_HOLD');
 }
 assert.equal(f.journal.length,0);
});
test('reused idempotency request cannot append twice or change decision silently',async()=>{
 const f=make(),agent=f.open('ownerA'),requestId=randomUUID();
 const one=await record(agent,IA,'REQUEST_PROVIDER_REVIEW',scope(),requestId);
 const second=await record(agent,IA,'REQUEST_PROVIDER_REVIEW',scope(),requestId);
 const changed=await record(agent,IA,'ACKNOWLEDGE_NO_SEND',scope(),requestId);
 assert.equal(one.status,'SYNTHETIC_REVIEW_JOURNALED');
 assert.equal(second.status,'NOT_AUTHORIZED_NOT_FOUND_OR_DUPLICATE_HOLD');
 assert.equal(changed.status,'NOT_AUTHORIZED_NOT_FOUND_OR_DUPLICATE_HOLD');
 assert.equal(f.journal.length,1);
});
test('grant revoked AFTER first read blocks all future read and audit append',async()=>{
 const f=make(),owner=f.open('ownerA');
 assert.equal((await owner.view({scope:scope()})).reports.length,1);
 f.grants[0].active=false;
 assert.equal((await owner.view({scope:scope()})).reports.length,0);
 assert.equal((await record(owner)).status,'NOT_AUTHORIZED_NOT_FOUND_OR_DUPLICATE_HOLD');
 assert.equal(f.journal.length,0);
});
test('expired grant is not authority to view or journal',async()=>{
 const f=make(),expired=f.open('expiredA');
 assert.equal((await expired.view({scope:scope()})).reports.length,0);
 assert.equal((await record(expired)).status,'NOT_AUTHORIZED_NOT_FOUND_OR_DUPLICATE_HOLD');
});
test('unsupported actions SEND/RETRY/CHANGE_PART are refused BEFORE any SQL',async()=>{
 const f=make(),owner=f.open('ownerA');
 for(const decision of ['RESEND','MARK_DELIVERED','CHANGE_PART_STATE',
  'APPROVE_PROVIDER_SEND','DELETE_EVENT','',null]){
  await assert.rejects(record(owner,IA,decision),/OPERATOR_REVIEW_DECISION_NOT_ALLOWLISTED/);
 }
 assert.equal(f.sqlCalls.length,0);
});
test('invalid private plan reference, malformed request id, or fake verified scope fail',async()=>{
 const f=make(),owner=f.open('ownerA');
 for(const id of ['guess',null,42]){
  await assert.rejects(record(owner,id),/OPERATOR_PRIVATE_PLAN_REFERENCE_REQUIRED/);
 }
 await assert.rejects(record(owner,IA,'REQUEST_PROVIDER_REVIEW',scope(),'fake'),
  /OPERATOR_REVIEW_IDEMPOTENCY_UUID_REQUIRED/);
 for(const sc of [
  scope({verified:false}),scope({source:'JWT_CLIENT'}),scope({serverDerived:false}),
  scope({tenantId:'bad'}),scope({pageId:'xyz'})
 ]){
  await assert.rejects(record(owner,IA,'REQUEST_PROVIDER_REVIEW',sc),
   /OPERATOR_TRUSTED_STORE_SCOPE_REQUIRED/);
 }
 assert.equal(f.sqlCalls.length,0);
});
test('result leaks no raw operator role, plan ID, requestId or tenant/Store/Page',async()=>{
 const f=make(),agent=f.open('ownerA'),req=randomUUID();
 const out=await record(agent,IA,'ESCALATE_TO_OWNER',scope(),req);
 const str=JSON.stringify(out);
 for(const secret of [IA,req,TA,SA,PA,'ownerA'])assert.ok(!str.includes(secret));
 assert.match(out.reference,/^[0-9a-f]{32}$/);
 assert.doesNotMatch(str,/lease|psid|provider_mid|request_digest|db_role/i);
});
test('SQL checks CURRENT_USER with current grant, immutable ledger and DB-time expiry',()=>{
 const view=SQL.view,write=SQL.append;
 assert.equal(SQL.readOnly,'SET TRANSACTION READ ONLY');
 assert.match(view,/g\.db_role=CURRENT_USER::name/);
 assert.match(view,/g\.valid_until > transaction_timestamp\(\)/);
 assert.match(view,/g\.active/);
 assert.match(write,/g\.db_role=CURRENT_USER::name/);
 assert.match(write,/g\.valid_until > transaction_timestamp\(\)/);
 assert.match(write,/g\.access_role='OWNER'/);
 assert.match(write,/g\.access_role='MANAGER'/);
 assert.match(write,/ON CONFLICT \(plan_id,request_digest\) DO NOTHING/);
 assert.match(write,/INSERT INTO app_private\.messenger_review_events/);
 assert.doesNotMatch(write,/\b(UPDATE|DELETE|MERGE|TRUNCATE|ALTER|DROP)\b/i);
 assert.doesNotMatch(view,/\b(INSERT|UPDATE|DELETE|MERGE|TRUNCATE|ALTER|DROP)\b/i);
 assert.deepEqual([...DECISIONS],[
  'REQUEST_PROVIDER_REVIEW','ESCALATE_TO_OWNER','ACKNOWLEDGE_NO_SEND'
 ]);
});
test('offline readiness never claims actual hosted authorization or Meta delivery',()=>{
 const f=make(),r=f.open('ownerA').readiness;
 assert.equal(r.mode,'SYNTHETIC_SQL_QA_ONLY');
 assert.equal(r.hostedIdentityVerified,false);
 assert.equal(r.integrationWithRealOwnerApp,false);
 assert.equal(r.metaSendEnabled,false);
 assert.equal(r.providerReconciliationEnabled,false);
 assert.equal(r.autoRetryEnabled,false);
 assert.equal(r.journalWritesOnlyInDisposableTests,true);
});
