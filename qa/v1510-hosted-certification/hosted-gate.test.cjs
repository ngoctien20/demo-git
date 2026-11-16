'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {auditHostedShape,verifyPrivateMatrixInputs}=require('./hosted-gate.cjs');
const {runJwtReadOnlyMatrix}=require('./jwt-readonly-matrix.cjs');
const uid=n=>String(n).padStart(8,'0')+'-0000-4000-8000-000000000000';
const fixtures=()=>({
 actors:{A:{token:'synthetic-not-a-real-jwt-actor-a',expectedUserId:uid(11)},
 B:{token:'synthetic-not-a-real-jwt-actor-b',expectedUserId:uid(12)},
 C:{token:'synthetic-not-a-real-jwt-actor-c',expectedUserId:uid(13)}},
 orders:{A:{order_id:uid(31),store_id:uid(21),tenant_id:uid(1)},
 B:{order_id:uid(32),store_id:uid(22),tenant_id:uid(1)},
 C:{order_id:uid(33),store_id:uid(23),tenant_id:uid(2)}}
});
const ready=()=>auditHostedShape({tables:['stores','store_memberships'],
 columns:['orders','order_items','products','conversations','messages'].map(table_name=>({table_name,column_name:'store_id'})),
 policies:[{tablename:'orders',policyname:'orders_store_restrict',cmd:'SELECT',permissive:'RESTRICTIVE'},
 {tablename:'products',policyname:'products_store_restrict',cmd:'SELECT',permissive:'RESTRICTIVE'}],
 constraints:[{table_name:'order_items',constraint_def:'FOREIGN KEY (tenant_id, store_id, order_id) REFERENCES orders(tenant_id, store_id, id)'},
 {table_name:'order_items',constraint_def:'FOREIGN KEY (tenant_id, store_id, product_id) REFERENCES products(tenant_id, store_id, id)'}]});
function mockTransport(f,spy=[]){return {
 getUser:async q=>{spy.push({action:'GET_USER',method:q.method,path:q.path,token:q.token});
  const key=Object.keys(f.actors).find(k=>f.actors[k].token===q.token);
  return key?{id:f.actors[key].expectedUserId,aud:'authenticated'}:null},
 readOrder:async q=>{spy.push({action:'GET_ORDER',method:q.method,resource:q.resource,select:q.select,token:q.token});
  const actor=Object.keys(f.actors).find(k=>f.actors[k].token===q.token);
  const target=Object.keys(f.orders).find(k=>f.orders[k].order_id===q.filter?.id);
  return actor&&target&&actor===target?[{...f.orders[target],id:f.orders[target].order_id,status:'pending'}]:[]}
}};
test('hosted current schema blocks: missing stores and Store RLS',()=>{
 const r=auditHostedShape({tables:['orders','products'],columns:[{table_name:'orders',column_name:'tenant_id'}],
 policies:[{tablename:'orders',policyname:'orders_manager_read',permissive:'PERMISSIVE',cmd:'SELECT'}]});
 assert.equal(r.status,'BLOCKED');assert.ok(r.findings.includes('MISSING_PUBLIC_STORES'));
 assert.ok(r.findings.includes('MISSING_STORE_SCOPE_ORDERS'));
 assert.ok(r.findings.includes('MISSING_RESTRICTIVE_STORE_POLICY_ORDERS'));
 assert.equal(r.hosted_jwt_certified,false);
});
test('fully reviewable schema cannot self-certify',()=>{
 const r=ready();assert.equal(r.status,'SCHEMA_REVIEW_ONLY_NOT_CERTIFIED');assert.equal(r.owner_g23_certified,false);
});
test('distinct actor, store and order ids are required',()=>{
 const f=fixtures();assert.equal(verifyPrivateMatrixInputs(f),null);
 f.actors.B.token=f.actors.A.token;assert.equal(verifyPrivateMatrixInputs(f),'THREE_DISTINCT_PRIVATE_JWT_REQUIRED');
});
test('same-tenant A/B and cross-tenant C fixture invariant',()=>{
 const f=fixtures();f.orders.B.tenant_id=uid(2);
 assert.equal(verifyPrivateMatrixInputs(f),'SAME_TENANT_AB_AND_CROSS_TENANT_C_REQUIRED');
});
test('preflight blocker means zero network/callback',async()=>{
 const f=fixtures();let n=0;const t={getUser:()=>{n++},readOrder:()=>{n++}};
 const r=await runJwtReadOnlyMatrix({...f,preflight:auditHostedShape(),transport:t});
 assert.equal(r.status,'BLOCKED');assert.equal(n,0);
});
test('mock 3 Auth GET + 9 order GET controls = 12/12 synthetic',async()=>{
 const f=fixtures(),spy=[];const r=await runJwtReadOnlyMatrix({...f,preflight:ready(),transport:mockTransport(f,spy)});
 assert.equal(r.status,'EVIDENCE_CANDIDATE_NOT_CERTIFIED');assert.equal(r.tests_run,12);
 assert.equal(r.passed,12);assert.equal(r.certified,false);assert.ok(spy.every(x=>x.method==='GET'));
 assert.equal(spy.filter(x=>x.action==='GET_ORDER').length,9);
});
test('all-negative empty replies fail positive read controls',async()=>{
 const f=fixtures(),t=mockTransport(f);t.readOrder=async()=>[];
 const r=await runJwtReadOnlyMatrix({...f,preflight:ready(),transport:t});
 assert.equal(r.status,'BLOCKED');assert.ok(r.checks.some(x=>x.case_id==='A_OWN_A'&&!x.pass));
});
test('Shop A read of Shop B order is a failing leak',async()=>{
 const f=fixtures(),t=mockTransport(f),orig=t.readOrder;
 t.readOrder=async q=>q.filter.id===f.orders.B.order_id&&q.token===f.actors.A.token?
 [{id:f.orders.B.order_id,store_id:f.orders.B.store_id,tenant_id:f.orders.B.tenant_id}]:orig(q);
 const r=await runJwtReadOnlyMatrix({...f,preflight:ready(),transport:t});
 assert.equal(r.status,'BLOCKED');assert.ok(r.checks.some(x=>x.case_id==='A_DENIED_B'&&!x.pass));
});
test('forged Auth user cannot pass',async()=>{
 const f=fixtures(),t=mockTransport(f);t.getUser=async()=>({id:uid(99),aud:'authenticated'});
 const r=await runJwtReadOnlyMatrix({...f,preflight:ready(),transport:t});
 assert.equal(r.reason,'AUTH_USER_VERIFICATION_FAILED');
});
test('GET transport errors block and cannot be upgraded to PASS',async()=>{
 const f=fixtures(),t=mockTransport(f);t.readOrder=async()=>{throw Error('BACKEND_DOWN')};
 const r=await runJwtReadOnlyMatrix({...f,preflight:ready(),transport:t});assert.equal(r.status,'BLOCKED');
});
test('wrong Store returned in A positive control fails',async()=>{
 const f=fixtures(),t=mockTransport(f);
 t.readOrder=async q=>q.filter.id===f.orders.A.order_id&&q.token===f.actors.A.token?
 [{id:f.orders.A.order_id,store_id:f.orders.B.store_id,tenant_id:f.orders.A.tenant_id}]:[];
 const r=await runJwtReadOnlyMatrix({...f,preflight:ready(),transport:t});assert.equal(r.status,'BLOCKED');
});
test('unsupported mode, no transport both fail closed',async()=>{
 const f=fixtures();
 assert.equal((await runJwtReadOnlyMatrix({...f,preflight:ready()})).reason,'READ_ONLY_AUTH_AND_GET_TRANSPORT_REQUIRED');
 assert.equal((await runJwtReadOnlyMatrix({...f,preflight:ready(),transport:mockTransport(f),proofMode:'LIVE_CERTIFIED'})).reason,'INVALID_PROOF_MODE');
});
