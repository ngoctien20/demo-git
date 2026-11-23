'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {SQL,createAtomicClaimPlanCandidate}=require('./atomic-claim-plan.cjs');
const {deriveIdentity}=require('./private-event-store.cjs');

const SECRET='SYNTHETIC_ATOMIC_CLAIM_PLAN_HMAC_FOR_OFFLINE_404';
const NOW=Date.parse('2026-11-22T14:00:00Z');
const TENANT_A='11111111-1111-4111-8111-111111111111';
const TENANT_B='22222222-2222-4222-8222-222222222222';
const STORE_A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const STORE_B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PAGE_A='12345678901234567',PAGE_B='98765432109876543';
const PSID_A='55555555555555555',PSID_B='66666666666666666';
const EVENT='c'.repeat(64);
const trusted=(patch={})=>({
 source:'SERVER_VERIFIED_MESSENGER_BINDING',serverDerived:true,verified:true,
 tenantId:TENANT_A,storeId:STORE_A,pageId:PAGE_A,recipientPsid:PSID_A,
 bindingVersion:3,...patch
});
const digests=n=>['a','b','d'].slice(0,n).map(x=>x.repeat(64));
const req=(n=1,patch={})=>({trusted:trusted(),replayKey:EVENT,partDigests:digests(n),...patch});
function makeSharedFakeDB(){
 let claims=new Map(),plans=new Map(),parts=new Map(),tail=Promise.resolve();
 let rollbackNext=false,txCount=0,sqlCount=0;
 const key=v=>v.slice(1,7).join('|');
 const openDriver=()=>Object.freeze({
  synthetic:true,externalWrites:false,rollbackOnThrow:true,
  profile:'SYNTHETIC_ATOMIC_CLAIM_PLAN_TX',
  transaction(fn){
   const run=tail.then(async()=>{
    const c=new Map([...claims].map(([k,v])=>[k,{...v}]));
    const p=new Map([...plans].map(([k,v])=>[k,{...v}]));
    const q=new Map([...parts].map(([k,v])=>[k,{...v}]));
    const tx=Object.freeze({async query(sql,v){
     sqlCount++;
     if(sql!==SQL.claimAndPlan||!Array.isArray(v)||v.length!==13)
      throw Error('SYNTHETIC_ATOMIC_SQL_OR_PARAMS_INVALID');
     const scope=key(v),[id,t,s,page,sh,ver,ev,planHash,count,bodies,lease,clock,expires]=v;
     if(c.has(scope)||p.has(scope))return {rows:[]};
     c.set(scope,{tenant:t,store:s,page,senderHash:sh,ver,eventHash:ev,
      lease,created:clock,expires,status:'CLAIMED'});
     p.set(scope,{id,tenant:t,store:s,page,count,planHash});
     for(let i=0;i<count;i++)q.set(id+'|'+(i+1),{
      tenant:t,store:s,page,partNo:i+1,bodyDigest:bodies[i],status:'PLANNED'
     });
     return {rows:[{plan_id:id,expected_count:count}]};
    }});
    const out=await fn(tx);
    if(rollbackNext){rollbackNext=false;throw Error('SYNTHETIC_TRANSACTION_ABORT')}
    claims=c;plans=p;parts=q;txCount++;
    return out;
   });
   tail=run.catch(()=>{});
   return run;
  }
 });
 const stats=()=>Object.freeze({
  claims:claims.size,plans:plans.size,parts:parts.size,txCount,sqlCount,
  claimStatuses:[...claims.values()].map(c=>c.status).sort()
 });
 const injectStalePlan=({scopeTrusted=trusted(),replayKey=EVENT}={})=>{
  const id=deriveIdentity({trusted:scopeTrusted,replayKey,secret:SECRET});
  plans.set([id.tenantId,id.storeId,id.pageId,id.senderHash,
   id.bindingVersion,id.eventHash].join('|'),{
   id:'stale-local-qa',count:1,status:'OLD_PLAN_WITHOUT_CLAIM'
  });
 };
 const candidate=()=>createAtomicClaimPlanCandidate({
  mode:'SYNTHETIC_SQL_QA_ONLY',driver:openDriver(),secret:SECRET,now:()=>NOW
 });
 return {candidate,stats,injectStalePlan,abortOnce:()=>{rollbackNext=true}};
}
test('non-synthetic, hosted and non-rollback driver rejected',()=>{
 const f=makeSharedFakeDB();
 assert.throws(()=>createAtomicClaimPlanCandidate(),/ATOMIC_CLAIM_PLAN_HOSTED_NOT_APPROVED/);
 assert.throws(()=>createAtomicClaimPlanCandidate({
  mode:'HOSTED',driver:{},secret:SECRET
 }),/ATOMIC_CLAIM_PLAN_HOSTED_NOT_APPROVED/);
 assert.throws(()=>createAtomicClaimPlanCandidate({
  mode:'SYNTHETIC_SQL_QA_ONLY',secret:SECRET,driver:{
   synthetic:true,externalWrites:false,rollbackOnThrow:false,
   profile:'SYNTHETIC_ATOMIC_CLAIM_PLAN_TX',transaction:async()=>({})}
 }),/ATOMIC_CLAIM_PLAN_TRANSACTION_DRIVER_DENIED/);
 assert.equal(f.stats().sqlCount,0);
});
test('first event inserts claim + 1,2,3 parts atomically and returns no lease or PSID',async()=>{
 for(const n of [1,2,3]){
  const f=makeSharedFakeDB(),c=f.candidate();
  const r=await c.prepare(req(n));
  assert.equal(r.status,'ATOMIC_PLAN_PREVIEW_ONLY');
  assert.equal(r.partCount,n);
  assert.equal(r.sendAllowed,false);assert.equal(r.retryAllowed,false);
  assert.deepEqual([f.stats().claims,f.stats().plans,f.stats().parts],[1,1,n]);
  assert.doesNotMatch(JSON.stringify(r),new RegExp(PSID_A));
  assert.doesNotMatch(JSON.stringify(r),/lease|secret|token|plan_id/i);
 }
});
test('duplicate webhook after commit and after worker restart is HOLD, not retry',async()=>{
 const f=makeSharedFakeDB();
 assert.equal((await f.candidate().prepare(req(2))).status,'ATOMIC_PLAN_PREVIEW_ONLY');
 const workerRestart=f.candidate();
 const out=await workerRestart.prepare(req(3)); // different reply body cannot replan
 assert.equal(out.status,'DUPLICATE_OR_NOT_ADMITTED_HOLD');
 assert.equal(out.sendAllowed,false);assert.equal(out.retryAllowed,false);
 assert.deepEqual([f.stats().claims,f.stats().plans,f.stats().parts],[1,1,2]);
});
test('50 concurrent entrants across independent worker instances create one plan only',async()=>{
 const f=makeSharedFakeDB();
 const attempts=await Promise.all(Array.from({length:50},()=>f.candidate().prepare(req(3))));
 assert.equal(attempts.filter(x=>x.status==='ATOMIC_PLAN_PREVIEW_ONLY').length,1);
 assert.equal(attempts.filter(x=>x.status==='DUPLICATE_OR_NOT_ADMITTED_HOLD').length,49);
 assert.deepEqual([f.stats().claims,f.stats().plans,f.stats().parts],[1,1,3]);
});
test('DB transaction abort leaves zero claims/plans/parts, next request can claim',async()=>{
 const f=makeSharedFakeDB(),c=f.candidate();
 f.abortOnce();
 await assert.rejects(c.prepare(req(2)),/SYNTHETIC_TRANSACTION_ABORT/);
 assert.deepEqual([f.stats().claims,f.stats().plans,f.stats().parts],[0,0,0]);
 assert.equal((await f.candidate().prepare(req(2))).status,'ATOMIC_PLAN_PREVIEW_ONLY');
});
test('old orphan plan without claim cannot mint a new claim or send plan',async()=>{
 const f=makeSharedFakeDB();f.injectStalePlan();
 const r=await f.candidate().prepare(req());
 assert.equal(r.status,'DUPLICATE_OR_NOT_ADMITTED_HOLD');
 assert.deepEqual([f.stats().claims,f.stats().plans,f.stats().parts],[0,1,0]);
});
test('Page, tenant, store, sender, bindingVersion, event hash isolation',async()=>{
 const f=makeSharedFakeDB(),c=f.candidate();
 const variants=[
  req(),
  req(1,{trusted:trusted({tenantId:TENANT_B})}),
  req(1,{trusted:trusted({storeId:STORE_B})}),
  req(1,{trusted:trusted({pageId:PAGE_B})}),
  req(1,{trusted:trusted({recipientPsid:PSID_B})}),
  req(1,{trusted:trusted({bindingVersion:4})}),
  req(1,{replayKey:'f'.repeat(64)})
 ];
 for(const v of variants)
  assert.equal((await c.prepare(v)).status,'ATOMIC_PLAN_PREVIEW_ONLY');
 assert.deepEqual([f.stats().claims,f.stats().plans,f.stats().parts],[7,7,7]);
});
test('unverified source, invalid HMAC event key or malformed reply body denied',async()=>{
 const f=makeSharedFakeDB(),c=f.candidate();
 for(const patch of [
  {trusted:trusted({verified:false})},
  {trusted:trusted({source:'WEBHOOK_SUPPLIED'})},
  {replayKey:'not-64-hex'}
 ])await assert.rejects(c.prepare(req(1,patch)));
 for(const bodies of [[],Array(4).fill('a'.repeat(64)),['bad'],null,[1]])
  await assert.rejects(c.prepare(req(1,{partDigests:bodies})),
   /ATOMIC_CLAIM_PLAN_PART_DIGESTS_INVALID/);
 assert.equal(f.stats().sqlCount,0);
});
test('SQL enforces two nested UNIQUE claims and same-statement scoped child insert',()=>{
 const s=SQL.claimAndPlan;
 assert.match(s,/INSERT INTO app_private\.messenger_event_claims/);
 assert.match(s,/INSERT INTO app_private\.messenger_send_plans/);
 assert.match(s,/INSERT INTO app_private\.messenger_send_parts/);
 assert.match(s,/WHERE NOT EXISTS \(SELECT 1 FROM app_private\.messenger_send_plans older/);
 assert.match(s,/FROM claimed c/);
 assert.match(s,/FROM prepared p CROSS JOIN generate_series/);
 assert.match(s,/ON CONFLICT \(tenant_id,store_id,page_id,sender_hash,binding_version,event_hash\) DO NOTHING/);
 assert.match(s,/SELECT p\.id,\$2::uuid,\$3::uuid,\$4,g\.n/);
 assert.doesNotMatch(s,/SELECT [^;]*lease_id::text AS lease_id|SECURITY DEFINER|service_role/i);
});
test('readiness never claims real identity/Meta/hosted capability',()=>{
 const f=makeSharedFakeDB();
 assert.deepEqual(f.candidate().readiness,{
  mode:'SYNTHETIC_SQL_QA_ONLY',externalWrites:false,hostedReady:false,
  realMetaSendEnabled:false,automaticRetryEnabled:false,
  orderWritesEnabled:false,verifiedWebhookWired:false,
  backedByHostedPostgres:false
 });
});
