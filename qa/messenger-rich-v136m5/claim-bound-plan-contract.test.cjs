'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {deriveIdentity}=require('./private-event-store.cjs');
const {SQL,createClaimBoundPlanCandidate}=require('./claim-bound-plan-contract.cjs');

const SECRET='SYNTHETIC_CLAIM_BOUND_SECRET_32_CHARS_MIN_NOT_REAL';
const TIME=Date.parse('2026-11-22T13:30:00Z');
const TENANT_A='11111111-1111-4111-8111-111111111111';
const TENANT_B='22222222-2222-4222-8222-222222222222';
const STORE_A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const STORE_B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PAGE_A='12345678901234567',PAGE_B='98765432109876543';
const SENDER_A='55555555555555555',SENDER_B='66666666666666666';
const KEY='a'.repeat(64),DIGEST='d'.repeat(64);
const proof=(over={})=>({
 source:'SERVER_VERIFIED_MESSENGER_BINDING',serverDerived:true,verified:true,
 tenantId:TENANT_A,storeId:STORE_A,pageId:PAGE_A,
 recipientPsid:SENDER_A,bindingVersion:3,...over
});
const input=(lease,over={})=>({
 trusted:proof(),replayKey:KEY,serverClaimLease:lease,
 partDigests:[DIGEST],...over
});
function model(){
 const claims=[],plans=new Map(),parts=[];
 let tail=Promise.resolve(),qs=0;
 const driver={
  synthetic:true,externalWrites:false,
  profile:'SYNTHETIC_CLAIM_BOUND_TRANSACTION_MODEL',
  transaction(fn){
   const result=tail.then(async()=>{
    const tx={query:async(sql,vals)=>{
     qs++;
     if(sql!==SQL.claimBoundPlan)throw Error('MOCK_WRONG_SQL');
     const [id,t,s,page,sh,ver,ev,planHash,count,bodies,lease,clock]=vals;
     const good=claims.some(x=>
      x.tenantId===t&&x.storeId===s&&x.pageId===page&&
      x.senderHash===sh&&x.bindingVersion===ver&&x.eventHash===ev&&
      x.lease===lease&&x.status==='CLAIMED'&&
      x.claimedAt<=Date.parse(clock)&&x.expiresAt>Date.parse(clock));
     if(!good||plans.has([t,s,page,sh,ver,ev].join('|')))return {rows:[]};
     plans.set([t,s,page,sh,ver,ev].join('|'),{id,t,s,page,count,planHash});
     for(let i=0;i<count;i++)parts.push({id,partNo:i+1,digest:bodies[i]});
     return {rows:[{plan_id:id,expected_count:count}]};
    }};
    return fn(tx);
   });
   tail=result.catch(()=>{});
   return result;
  }
 };
 const addClaim=({trusted=proof(),replayKey=KEY,lease=randomUUID(),
  status='CLAIMED',claimedAt=TIME-60000,expiresAt=TIME+60000}={})=>{
  const i=deriveIdentity({trusted,replayKey,secret:SECRET});
  claims.push({...i,lease,status,claimedAt,expiresAt});
  return lease;
 };
 const ledger=()=>createClaimBoundPlanCandidate({
  mode:'SYNTHETIC_SQL_QA_ONLY',driver,secret:SECRET,now:()=>TIME
 });
 return {claims,plans,parts,driver,ledger,addClaim,queries:()=>qs};
}
test('default/hosted or external-writing driver fail closed',()=>{
 assert.throws(()=>createClaimBoundPlanCandidate(),/CLAIM_BOUND_HOSTED_NOT_APPROVED/);
 const m=model();
 assert.throws(()=>createClaimBoundPlanCandidate({
  mode:'HOSTED',driver:m.driver,secret:SECRET
 }),/CLAIM_BOUND_HOSTED_NOT_APPROVED/);
 assert.throws(()=>createClaimBoundPlanCandidate({
  mode:'SYNTHETIC_SQL_QA_ONLY',driver:{...m.driver,externalWrites:true},
  secret:SECRET
 }),/CLAIM_BOUND_DRIVER_NOT_APPROVED/);
 assert.equal(m.queries(),0);
});
test('no server lease or syntactically forged claim ticket cannot create a plan',async()=>{
 const m=model(),ledger=m.ledger();
 for(const forged of [undefined,'fake','00000000-0000-0000-0000-000000000000']){
  await assert.rejects(ledger.planFromServerLease(input(forged)),
   /CLAIM_BOUND_SERVER_LEASE_REQUIRED/);
 }
 assert.equal(m.queries(),0);
 const guess=randomUUID();
 assert.equal((await ledger.planFromServerLease(input(guess))).status,
  'CLAIM_NOT_ADMITTED_OR_DUPLICATE_HOLD');
 assert.equal(m.plans.size,0);
});
test('real issued scoped claim admits a plan and 1/2/3 parts, never sends',async()=>{
 for(const n of [1,2,3]){
  const m=model(),lease=m.addClaim();
  const l=m.ledger();
  const plan=await l.planFromServerLease(input(lease,{
   partDigests:Array(n).fill(DIGEST)
  }));
  assert.equal(plan.status,'BOUND_PLAN_PREVIEW_ONLY');
  assert.equal(plan.partCount,n);
  assert.equal(plan.sendAllowed,false);
  assert.equal(plan.providerAccepted,false);
  assert.equal(m.plans.size,1);
  assert.equal(m.parts.length,n);
  assert.doesNotMatch(JSON.stringify(plan),new RegExp(SENDER_A));
  assert.doesNotMatch(JSON.stringify(plan),new RegExp(lease));
  assert.equal((await l.planFromServerLease(input(lease,{
   partDigests:Array(n).fill(DIGEST)
  }))).status,'CLAIM_NOT_ADMITTED_OR_DUPLICATE_HOLD');
 }
});
test('wrong lease, expired, already finalized, future claim never admitted',async()=>{
 for(const config of [
  {lease:randomUUID()},
  {status:'PREVIEW_READY'},
  {status:'REJECTED'},
  {expiresAt:TIME},
  {expiresAt:TIME-1},
  {claimedAt:TIME+1}
 ]){
  const m=model(),valid=m.addClaim(config);
  const use=config.status||config.expiresAt||config.claimedAt?valid:randomUUID();
  const result=await m.ledger().planFromServerLease(input(use));
  assert.equal(result.status,'CLAIM_NOT_ADMITTED_OR_DUPLICATE_HOLD');
  assert.equal(m.parts.length,0);
 }
});
test('claim lease belongs to same tenant, Store, Page, sender and binding version',async()=>{
 const variants=[
  {trusted:proof({tenantId:TENANT_B})},
  {trusted:proof({storeId:STORE_B})},
  {trusted:proof({pageId:PAGE_B})},
  {trusted:proof({recipientPsid:SENDER_B})},
  {trusted:proof({bindingVersion:4})},
  {replayKey:'b'.repeat(64)}
 ];
 for(const patch of variants){
  const m=model(),lease=m.addClaim();
  const out=await m.ledger().planFromServerLease(input(lease,patch));
  assert.equal(out.status,'CLAIM_NOT_ADMITTED_OR_DUPLICATE_HOLD');
  assert.equal(m.plans.size,0);
 }
});
test('50 independent planners cannot create >1 plan even with a valid lease',async()=>{
 const m=model(),lease=m.addClaim();
 const results=await Promise.all(Array.from({length:50},()=>m.ledger()
  .planFromServerLease(input(lease))));
 assert.equal(results.filter(x=>x.status==='BOUND_PLAN_PREVIEW_ONLY').length,1);
 assert.equal(results.filter(x=>x.status==='CLAIM_NOT_ADMITTED_OR_DUPLICATE_HOLD').length,49);
 assert.equal(m.plans.size,1);assert.equal(m.parts.length,1);
});
test('invalid digest counts, signer scope and weak HMAC secrets are refused',async()=>{
 const m=model(),lease=m.addClaim();
 for(const parts of [[],Array(4).fill(DIGEST),['notsha'],[42],null]){
  await assert.rejects(m.ledger().planFromServerLease(input(lease,{partDigests:parts})),
   /CLAIM_BOUND_PART_DIGESTS_INVALID/);
 }
 await assert.rejects(m.ledger().planFromServerLease(input(lease,{
  trusted:proof({verified:false})
 })),/PRIVATE_EVENT_SCOPE_UNVERIFIED/);
 assert.throws(()=>createClaimBoundPlanCandidate({
  mode:'SYNTHETIC_SQL_QA_ONLY',driver:m.driver,secret:'weak'
 }),/CLAIM_BOUND_SECRET_REQUIRED/);
 assert.equal(m.plans.size,0);
});
test('no lease or identity may be returned through the public decision',async()=>{
 const m=model(),lease=m.addClaim();
 const out=await m.ledger().planFromServerLease(input(lease));
 const data=JSON.stringify(out);
 assert.doesNotMatch(data,/lease|sender_hash|event_hash|psid|token|password/i);
 assert.doesNotMatch(data,new RegExp(lease));
 assert.deepEqual(m.ledger().readiness,{
  mode:'SYNTHETIC_SQL_QA_ONLY',hostedReady:false,
  claimStoreWired:false,canIssueServerLease:false,
  providerSendEnabled:false,automaticRetryEnabled:false,
  orderWritesEnabled:false
 });
});
test('guarded SQL checks exact active lease, all seven event fields, time, and atomic child plans',()=>{
 const s=SQL.claimBoundPlan;
 assert.match(s,/EXISTS \(SELECT 1 FROM app_private\.messenger_event_claims ec/);
 for(const x of ['tenant_id','store_id','page_id','sender_hash',
  'binding_version','event_hash','lease_id']){
  assert.match(s,new RegExp('ec\\.'+x));
 }
 assert.match(s,/ec\.lease_id=\$11::uuid/);
 assert.match(s,/ec\.status='CLAIMED'/);
 assert.match(s,/ec\.expires_at > \$12::timestamptz/);
 assert.match(s,/ec\.claimed_at <= \$12::timestamptz/);
 assert.match(s,/ON CONFLICT \(tenant_id,store_id,page_id,sender_hash,binding_version,event_hash\) DO NOTHING/);
 assert.match(s,/INSERT INTO app_private\.messenger_send_parts/);
 assert.match(s,/tenant_id,store_id,page_id,part_no/);
 assert.doesNotMatch(s,/SECURITY DEFINER|service_role|graph\.facebook\.com/i);
});
