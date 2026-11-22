'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {SQL,createMessageReconciliationInspectorCandidate}=require('./message-reconciliation-inspector.cjs');
const UUID_A='10000000-0000-4000-8000-000000000001';
const UUID_B='10000000-0000-4000-8000-000000000002';
const TENANT_A='11111111-1111-4111-8111-111111111111';
const TENANT_B='22222222-2222-4222-8222-222222222222';
const STORE_A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const STORE_B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PAGE_A='12345678901234567';
const PAGE_B='98765432109876543';
const SECRET='LOCAL_SYNTHETIC_RECONCILIATION_SECRET_NOT_HOSTED';
const NOW=Date.parse('2026-11-22T15:00:00Z');
const scope=(over={})=>({
 source:'SERVER_VERIFIED_MESSENGER_BINDING',serverDerived:true,verified:true,
 tenantId:TENANT_A,storeId:STORE_A,pageId:PAGE_A,...over
});
const plan=(states,{id=UUID_A,tenantId=TENANT_A,storeId=STORE_A,pageId=PAGE_A,
 status='PREPARED',expectedCount=states.length,attemptedAt=NOW-600000}={})=>({
 id,tenantId,storeId,pageId,status,expectedCount,
 parts:states.map((state,i)=>({partNo:i+1,status:state,
 attemptedAt:state==='MAY_HAVE_SENT_HOLD'?attemptedAt:null}))
});
function model(initial=[]){
 const records=initial.map(x=>({...x,parts:x.parts.map(p=>({...p}))}));
 let queryCount=0,writeCount=0,readOnlyStart=0,transactionCount=0;
 const driver=Object.freeze({
  synthetic:true,externalWrites:false,readOnly:true,rollbackOnThrow:true,
  profile:'SYNTHETIC_RECONCILIATION_READ_ONLY_PG',
  async transaction(fn){
   let secured=false;
   const tx=Object.freeze({async query(sql,args){
    queryCount++;
    if(sql===SQL.readOnly){
     if(secured||!Array.isArray(args)||args.length!==0)throw Error('READ_ONLY_FIRST');
     secured=true;readOnlyStart++;
     return {rows:[]};
    }
    if(!secured)throw Error('REQUIRE_READ_ONLY_TRANSACTION');
    if(sql!==SQL.snapshot||!Array.isArray(args)||args.length!==4)
     {writeCount++;throw Error('READ_ONLY_SQL_WHITELIST');}
    const [tenant,store,page,cutoff]=args;
    const rows=records.filter(p=>p.tenantId===tenant&&p.storeId===store&&p.pageId===page)
     .slice(0,51).map(p=>{
      const count=state=>p.parts.filter(x=>x.status===state).length;
      return {
       plan_id:p.id,plan_status:p.status,expected_count:p.expectedCount,
       observed_count:p.parts.length,planned_count:count('PLANNED'),
       inflight_count:count('MAY_HAVE_SENT_HOLD'),
       stale_inflight_count:p.parts.filter(x=>x.status==='MAY_HAVE_SENT_HOLD'&&
        (x.attemptedAt===null||x.attemptedAt<=Date.parse(cutoff))).length,
       uncertain_count:count('UNCERTAIN_HOLD'),
       mock_ack_count:count('API_ACCEPTED_MOCK'),
       unknown_count:p.parts.filter(x=>![
        'PLANNED','MAY_HAVE_SENT_HOLD','UNCERTAIN_HOLD','API_ACCEPTED_MOCK'
       ].includes(x.status)).length
      };
     });
    return {rows};
   }});
   const result=await fn(tx);
   if(!secured)throw Error('READ_ONLY_REQUIRED');
   transactionCount++;return result;
  }
 });
 const open=()=>createMessageReconciliationInspectorCandidate({
  mode:'SYNTHETIC_SQL_QA_ONLY',driver,secret:SECRET,now:()=>NOW
 });
 return {open,diagnostics:()=>({queryCount,readOnlyStart,writeCount,transactionCount,
  records:records.length,realPostgres:false,hostedWrites:false})};
}
const inspect=async(x,sc=scope())=>x.open().inspect({scope:sc});
test('default and non-read-only or hosted driver fail before database',()=>{
 assert.throws(()=>createMessageReconciliationInspectorCandidate(),
  /RECONCILIATION_HOSTED_NOT_APPROVED/);
 const x=model();
 assert.throws(()=>createMessageReconciliationInspectorCandidate({
  mode:'HOSTED',driver:{},secret:SECRET
 }),/RECONCILIATION_HOSTED_NOT_APPROVED/);
 for(const patch of [{readOnly:false},{externalWrites:true},
  {rollbackOnThrow:false},{synthetic:false}]){
  assert.throws(()=>createMessageReconciliationInspectorCandidate({
   mode:'SYNTHETIC_SQL_QA_ONLY',driver:{
    synthetic:true,externalWrites:false,readOnly:true,
    rollbackOnThrow:true,profile:'SYNTHETIC_RECONCILIATION_READ_ONLY_PG',
    transaction:async()=>({}),...patch
   },secret:SECRET
  }),/RECONCILIATION_READ_ONLY_DRIVER_REQUIRED/);
 }
 assert.equal(x.diagnostics().queryCount,0);
});
test('empty store returns no plans and no write/retry capabilities',async()=>{
 const x=model(),r=await inspect(x);
 assert.equal(r.status,'SYNTHETIC_READ_ONLY_SNAPSHOT');
 assert.deepEqual(r.reports,[]);assert.equal(r.truncated,false);
 assert.equal(r.sendAllowed,false);assert.equal(r.retryAllowed,false);
 assert.equal(r.actualProviderDeliveryVerified,false);
 assert.equal(x.diagnostics().readOnlyStart,1);
 assert.equal(x.diagnostics().writeCount,0);
});
test('1/3 accepted, remaining parts planned reports mock partial not send success',async()=>{
 const x=model([plan(['API_ACCEPTED_MOCK','PLANNED','PLANNED'])]);
 const {reports}=await inspect(x);
 assert.equal(reports.length,1);
 assert.equal(reports[0].reason,'PARTIAL_MOCK_ACK_REVIEW');
 assert.deepEqual([reports[0].expected,reports[0].observed,reports[0].mockAcknowledged,
  reports[0].planned],[3,3,1,2]);
 assert.equal(reports[0].realMetaAccepted,false);
 assert.equal(reports[0].retryAllowed,false);
 assert.equal(reports[0].requiresHumanReview,true);
});
test('2/3 accepted and third uncertain requires manual reconciliation',async()=>{
 const x=model([plan(['API_ACCEPTED_MOCK','API_ACCEPTED_MOCK','UNCERTAIN_HOLD'])]);
 const {reports}=await inspect(x);
 assert.equal(reports[0].reason,'UNCERTAIN_OUTCOME_REVIEW');
 assert.equal(reports[0].uncertain,1);
 assert.equal(reports[0].mockAcknowledged,2);
 assert.equal(reports[0].sendAllowed,false);
});
test('inflight stale attempt after crash is never automatically reissued',async()=>{
 const x=model([plan(['MAY_HAVE_SENT_HOLD','PLANNED'],{attemptedAt:NOW-360000})]);
 const first=await inspect(x),restarted=await inspect(x);
 assert.equal(first.reports[0].reason,'STALE_MAY_HAVE_SENT_REVIEW');
 assert.equal(first.reports[0].staleInflight,1);
 assert.equal(restarted.reports[0].reason,first.reports[0].reason);
 assert.equal(restarted.reports[0].reference,first.reports[0].reference);
 assert.equal(x.diagnostics().writeCount,0);
 assert.equal(x.diagnostics().readOnlyStart,2);
});
test('fresh inflight is held without falsely declaring stale',async()=>{
 const x=model([plan(['MAY_HAVE_SENT_HOLD'],{attemptedAt:NOW-30000})]);
 const r=await inspect(x);
 assert.equal(r.reports[0].reason,'MAY_HAVE_SENT_REVIEW');
 assert.equal(r.reports[0].staleInflight,0);
});
test('inflight without timestamp fails safe as stale needing review',async()=>{
 const x=model([plan(['MAY_HAVE_SENT_HOLD'],{attemptedAt:null})]);
 const r=await inspect(x);
 assert.equal(r.reports[0].reason,'STALE_MAY_HAVE_SENT_REVIEW');
});
test('3/3 accepted mock-only; closed and not closed are distinguished',async()=>{
 const x=model([
  plan(Array(3).fill('API_ACCEPTED_MOCK'),{id:UUID_A,status:'MOCK_PARTS_ACCEPTED'}),
  plan(Array(2).fill('API_ACCEPTED_MOCK'),{id:UUID_B,status:'PREPARED'})
 ]);
 const r=await inspect(x);
 assert.equal(r.reports[0].reason,'MOCK_ALL_PARTS_RECORDED');
 assert.equal(r.reports[0].requiresHumanReview,false);
 assert.equal(r.reports[1].reason,'MOCK_COMPLETE_PLAN_NOT_CLOSED');
 assert.equal(r.reports[1].requiresHumanReview,true);
 assert.ok(r.reports.every(x=>x.realMetaAccepted===false&&x.delivered===false));
});
test('missing parts, unexpected status, and bad closed plan require integrity review',async()=>{
 for(const p of [
  plan(['PLANNED'],{expectedCount:3}),
  plan(['INVALID_STATE']),
  plan(['API_ACCEPTED_MOCK','PLANNED'],{status:'MOCK_PARTS_ACCEPTED'})
 ]){
  const x=model([p]),r=await inspect(x);
  assert.equal(r.reports[0].reason,'DATA_INTEGRITY_REVIEW');
  assert.equal(r.reports[0].retryAllowed,false);
 }
});
test('physically impossible counts fail closed, never report false success',async()=>{
 for(const p of [
  plan(['PLANNED','PLANNED'],{expectedCount:1}),
  plan(['PLANNED'],{status:'BAD_PLAN_STATUS'})
 ]){
  const x=model([p]);
  await assert.rejects(inspect(x),/RECONCILIATION_SNAPSHOT_INCONSISTENT/);
 }
});
test('scope A/B and tenant isolation; no cross-shop results even with guessed scope',async()=>{
 const x=model([
  plan(['UNCERTAIN_HOLD'],{id:UUID_A}),
  plan(['MAY_HAVE_SENT_HOLD'],{id:UUID_B,storeId:STORE_B,pageId:PAGE_B}),
  plan(['PLANNED'],{id:'10000000-0000-4000-8000-000000000003',
   tenantId:TENANT_B})
 ]);
 assert.equal((await inspect(x,scope())).reports.length,1);
 assert.equal((await inspect(x,scope({storeId:STORE_B,pageId:PAGE_B}))).reports.length,1);
 assert.equal((await inspect(x,scope({tenantId:TENANT_B}))).reports.length,1);
 assert.equal((await inspect(x,scope({tenantId:TENANT_B,storeId:STORE_B}))).reports.length,0);
 assert.equal(x.diagnostics().writeCount,0);
});
test('unverified scope, forged Page and invalid identifiers fail closed',async()=>{
 const x=model([plan(['PLANNED'])]);
 for(const sc of [scope({verified:false}),scope({source:'CLIENT_BODY'}),
  scope({serverDerived:false}),scope({storeId:'invalid'}),
  scope({pageId:'abc'}),null]){
  await assert.rejects(inspect(x,sc),/RECONCILIATION_TRUSTED_SCOPE_REQUIRED/);
 }
 assert.equal(x.diagnostics().queryCount,0);
});
test('identifiers and sensitive fields never surface in public snapshots',async()=>{
 const x=model([plan(['API_ACCEPTED_MOCK','UNCERTAIN_HOLD'])]);
 const r=await inspect(x);
 const str=JSON.stringify(r);
 assert.doesNotMatch(str,new RegExp(UUID_A));
 assert.doesNotMatch(str,new RegExp(TENANT_A));
 assert.doesNotMatch(str,new RegExp(STORE_A));
 assert.doesNotMatch(str,new RegExp(PAGE_A));
 assert.doesNotMatch(str,/lease_id|sender_hash|provider_mid_digest|attempt_id|psid/i);
 assert.match(r.reports[0].reference,/^[a-f0-9]{32}$/);
});
test('bounded first-page result is marked incomplete; no false full audit claim',async()=>{
 const rows=Array.from({length:51},(_,i)=>plan(['PLANNED'],{
  id:'10000000-0000-4000-8000-'+String(i+1).padStart(12,'0')
 }));
 const x=model(rows),r=await inspect(x);
 assert.equal(r.reports.length,50);
 assert.equal(r.truncated,true);
 assert.equal(r.complete,false);
 assert.equal(x.diagnostics().writeCount,0);
});
test('disposable transaction SQL is SELECT-only with explicit read-only guard',()=>{
 assert.equal(SQL.readOnly,'SET TRANSACTION READ ONLY');
 assert.match(SQL.snapshot,/^SELECT /);
 assert.match(SQL.snapshot,/FROM app_private\.messenger_send_plans p/);
 assert.match(SQL.snapshot,/LEFT JOIN app_private\.messenger_send_parts sp/);
 assert.match(SQL.snapshot,/p\.tenant_id=\$1::uuid AND p\.store_id=\$2::uuid AND p\.page_id=\$3/);
 assert.match(SQL.snapshot,/attempted_at <= \$4::timestamptz/);
 assert.match(SQL.snapshot,/LIMIT 51$/);
 assert.doesNotMatch(SQL.snapshot,/\b(INSERT|UPDATE|DELETE|TRUNCATE|GRANT|CREATE|ALTER|DROP)\b/i);
});
test('bad driver response cannot be treated as verified reconciliation',async()=>{
 const bad={
  synthetic:true,externalWrites:false,readOnly:true,rollbackOnThrow:true,
  profile:'SYNTHETIC_RECONCILIATION_READ_ONLY_PG',
  async transaction(fn){
   let stage=0;
   return fn({query:async sql=>{
    if(stage++===0)return {rows:[]};
    return {rows:null};
   }});
  }
 };
 const l=createMessageReconciliationInspectorCandidate({
  mode:'SYNTHETIC_SQL_QA_ONLY',driver:bad,secret:SECRET,now:()=>NOW
 });
 await assert.rejects(l.inspect({scope:scope()}),/RECONCILIATION_RESPONSE_INVALID/);
});
