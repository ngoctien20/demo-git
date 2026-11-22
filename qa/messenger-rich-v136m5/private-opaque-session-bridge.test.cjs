'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHmac,randomUUID}=require('node:crypto');
const {SQL,createPrivateOpaqueSessionBridgeCandidate}=require('./private-opaque-session-bridge.cjs');
const SKEY='SYNTHETIC_OPERATOR_SESSION_HMAC_SECRET_FOR_QA_404';
const RKEY='SYNTHETIC_OPERATOR_REQUEST_HMAC_SECRET_FOR_QA_404';
const REFKEY='SYNTHETIC_OPERATOR_REFERENCE_SECRET_FOR_QA_404';
const TIME=Date.parse('2026-11-23T00:35:00+09:00');
const TA='11111111-1111-4111-8111-111111111111',TB='22222222-2222-4222-8222-222222222222';
const SA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',SB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PA='12345678901234567',PB='98765432109876543';
const SU='30000000-0000-4000-8000-000000000001',SV='30000000-0000-4000-8000-000000000002';
const SW='30000000-0000-4000-8000-000000000003',SX='30000000-0000-4000-8000-000000000004';
const IDA='10000000-0000-4000-8000-000000000001',IDB='10000000-0000-4000-8000-000000000002';
const actorA='40000000-0000-4000-8000-000000000001';
const actorB='40000000-0000-4000-8000-000000000002';
const actorM='40000000-0000-4000-8000-000000000003';
const actorS='40000000-0000-4000-8000-000000000004';
const opaque=(scope,id)=>createHmac('sha256',REFKEY)
 .update('tien404/messenger/reconcile/ref/v1\0'+[scope.tenant,scope.store,scope.page,id].join('|'))
 .digest('hex').slice(0,32);
const A={tenant:TA,store:SA,page:PA},B={tenant:TA,store:SB,page:PB};
const RA=opaque(A,IDA),RB=opaque(B,IDB);
const sign=(id,exp=TIME+300000)=>{
 const k=String(exp);
 const h=createHmac('sha256',SKEY)
  .update('tien404/messenger/operator/session/v1\0'+id+'|'+k).digest('hex');
 return 'v1.'+id+'.'+k+'.'+h;
};
const report=(p)=>({
 plan_id:p.id,plan_status:'PREPARED',expected_count:3,observed_count:3,
 planned_count:0,inflight_count:0,stale_inflight_count:0,uncertain_count:1,
 mock_ack_count:2,unknown_count:0
});
function fake(){
 let time=TIME, txs=0, writes=0;
 const sessions=[
  {id:SU,actor:actorA,role:'ownerA',...A,active:true,expires:TIME+600000},
  {id:SV,actor:actorM,role:'managerA',...A,active:true,expires:TIME+600000},
  {id:SW,actor:actorS,role:'staffA',...A,active:true,expires:TIME+600000},
  {id:SX,actor:actorB,role:'ownerB',...B,active:true,expires:TIME+600000}
 ];
 const grants=[
  {actor:actorA,role:'ownerA',access:'OWNER',...A,active:true,expires:TIME+600000},
  {actor:actorM,role:'managerA',access:'MANAGER',...A,active:true,expires:TIME+600000},
  {actor:actorS,role:'staffA',access:'STAFF',...A,active:true,expires:TIME+600000},
  {actor:actorB,role:'ownerB',access:'OWNER',...B,active:true,expires:TIME+600000}
 ];
 const plans=[{id:IDA,...A},{id:IDB,...B}];
 const refs=[{reference:RA,id:IDA,...A},{reference:RB,id:IDB,...B}];
 const audits=[];
 const current=(role,ref,sid)=>{
  const session=sessions.find(x=>x.id===sid&&x.role===role&&x.active&&x.expires>time);
  if(!session)return null;
  const grant=grants.find(g=>g.role===role&&g.actor===session.actor&&g.active&&g.expires>time&&
    g.tenant===session.tenant&&g.store===session.store&&g.page===session.page);
  if(!grant)return null;
  const mapping=refs.find(r=>r.reference===ref&&r.tenant===session.tenant&&
   r.store===session.store&&r.page===session.page);
  if(!mapping)return null;
  const p=plans.find(p=>p.id===mapping.id&&p.tenant===session.tenant&&
   p.store===session.store&&p.page===session.page);
  return p&&{session,grant,p};
 };
 const driver=role=>({
  synthetic:true,externalWrites:false,rollbackOnThrow:true,journalOnly:true,
  profile:'SYNTHETIC_OPAQUE_OPERATOR_SESSION_PG_TX',
  async transaction(fn){
   let startedRO=false;
   const tx={async query(sql,v){
    if(sql===SQL.readOnly){startedRO=true;return {rows:[]};}
    if(sql===SQL.view){
     if(!startedRO)throw Error('MISSING_READ_ONLY_GUARD');
     const x=current(role,v[0],v[1]);
     return {rows:x?[report(x.p)]:[]};
    }
    if(sql===SQL.append){
     if(startedRO)throw Error('APPEND_AFTER_READ_ONLY');
     const [ref,sid,id,decision,hash]=v;
     const x=current(role,ref,sid);
     if(!x||x.grant.access==='STAFF'||
        (x.grant.access==='MANAGER'&&decision==='ACKNOWLEDGE_NO_SEND')||
        audits.some(a=>a.planId===x.p.id&&a.digest===hash))
      return {rows:[]};
     audits.push({planId:x.p.id,ref,role,actor:x.session.actor,
       decision,digest:hash,id});
     writes++;
     return {rows:[{review_id:id,decision_code:decision}]};
    }
    throw Error('UNALLOWLISTED_SQL');
   }};
   const result=await fn(tx);txs++;return result;
  }
 });
 const bridge=role=>createPrivateOpaqueSessionBridgeCandidate({
  mode:'SYNTHETIC_SQL_QA_ONLY',driver:driver(role),
  sessionSecret:SKEY,requestSecret:RKEY,now:()=>time
 });
 return {bridge,sessions,grants,plans,refs,audits,
  advance:(delta)=>{time+=delta},setTime:(newTime)=>{time=newTime},
  stats:()=>({txs,writes})};
}
test('blocked-by-default and non-offline driver refused',()=>{
 assert.throws(()=>createPrivateOpaqueSessionBridgeCandidate(),/HOSTED_NOT_APPROVED/);
 const f=fake();
 assert.throws(()=>createPrivateOpaqueSessionBridgeCandidate({
  mode:'HOSTED',driver:{},sessionSecret:SKEY,requestSecret:RKEY
 }),/HOSTED_NOT_APPROVED/);
 assert.throws(()=>createPrivateOpaqueSessionBridgeCandidate({
  mode:'SYNTHETIC_SQL_QA_ONLY',driver:{synthetic:true,externalWrites:true,
   rollbackOnThrow:true,profile:'SYNTHETIC_OPAQUE_OPERATOR_SESSION_PG_TX',transaction:()=>{}},
  sessionSecret:SKEY,requestSecret:RKEY
 }),/DRIVER_NOT_APPROVED/);
 assert.equal(f.stats().txs,0);
});
test('owner, manager and staff can view same scoped opaque ref without raw IDs',async()=>{
 const f=fake();
 for(const [actor,sid] of [['ownerA',SU],['managerA',SV],['staffA',SW]]){
  const out=await f.bridge(actor).view({sessionToken:sign(sid),reference:RA});
  assert.equal(out.status,'PRIVATE_REVIEW_PREVIEW_ONLY');
  assert.equal(out.reason,'UNCERTAIN_OUTCOME_REVIEW');
  assert.equal(out.mockAcknowledged,2);
  assert.equal(out.uncertain,1);
  assert.equal(out.reference,RA);
  assert.equal(out.sendAllowed,false);
  assert.ok(!JSON.stringify(out).includes(IDA));
  assert.ok(!JSON.stringify(out).includes(TA));
 }
});
test('cross-store ref cannot be used even by a valid signed Owner A session',async()=>{
 const f=fake();
 assert.equal((await f.bridge('ownerA').view({
  sessionToken:sign(SU),reference:RB
 })).status,'NOT_AUTHORIZED_OR_NOT_FOUND_HOLD');
 assert.equal((await f.bridge('ownerB').view({
  sessionToken:sign(SX),reference:RA
 })).status,'NOT_AUTHORIZED_OR_NOT_FOUND_HOLD');
 assert.equal((await f.bridge('ownerB').view({
  sessionToken:sign(SX),reference:RB
 })).status,'PRIVATE_REVIEW_PREVIEW_ONLY');
});
test('copying an otherwise valid session token to a different DB operator role is denied',async()=>{
 const f=fake();
 for(const role of ['ownerB','managerA','staffA']){
  assert.equal((await f.bridge(role).view({
   sessionToken:sign(SU),reference:RA
  })).status,'NOT_AUTHORIZED_OR_NOT_FOUND_HOLD');
 }
});
test('invalid, fabricated, tampered or too-long token refuses BEFORE SQL',async()=>{
 const f=fake(),valid=sign(SU);
 const variants=['fake','',null,12,'v1.'+SU+'.'+(TIME+100000)+'.'+'a'.repeat(64),
  valid.slice(0,-1)+(valid.slice(-1)==='0'?'1':'0'),
  sign(SU,TIME+16*60*1000),sign(SU,TIME),valid+'.extra', 'x'.repeat(500)];
 for(const t of variants){
  await assert.rejects(f.bridge('ownerA').view({sessionToken:t,reference:RA}),
   /OPAQUE_OPERATOR_SESSION_NOT_AUTHENTICATED/);
 }
 assert.equal(f.stats().txs,0);
});
test('session can expire or be revoked even when signed token is not expired',async()=>{
 const f=fake(),token=sign(SU,TIME+600000);
 assert.equal((await f.bridge('ownerA').view({
  sessionToken:token,reference:RA
 })).status,'PRIVATE_REVIEW_PREVIEW_ONLY');
 f.sessions[0].active=false;
 assert.equal((await f.bridge('ownerA').view({
  sessionToken:token,reference:RA
 })).status,'NOT_AUTHORIZED_OR_NOT_FOUND_HOLD');
 f.sessions[0].active=true;f.sessions[0].expires=TIME-1;
 assert.equal((await f.bridge('ownerA').view({
  sessionToken:token,reference:RA
 })).status,'NOT_AUTHORIZED_OR_NOT_FOUND_HOLD');
});
test('grant revocation and scope reassignment is authoritative on next query',async()=>{
 const f=fake(),token=sign(SU);
 f.grants[0].active=false;
 assert.equal((await f.bridge('ownerA').view({
  sessionToken:token,reference:RA
 })).status,'NOT_AUTHORIZED_OR_NOT_FOUND_HOLD');
 f.grants[0].active=true;
 f.grants[0].store=SB;f.grants[0].page=PB;
 assert.equal((await f.bridge('ownerA').view({
  sessionToken:token,reference:RA
 })).status,'NOT_AUTHORIZED_OR_NOT_FOUND_HOLD');
});
test('staff cannot journal, manager cannot acknowledge, owner may record no-send',async()=>{
 const f=fake();
 const r=async(role,sid,decision)=>f.bridge(role).record({
  sessionToken:sign(sid),reference:RA,decision,requestId:randomUUID()
 });
 assert.equal((await r('staffA',SW,'REQUEST_PROVIDER_REVIEW')).status,
  'NOT_AUTHORIZED_OR_NOT_FOUND_HOLD');
 assert.equal((await r('managerA',SV,'ACKNOWLEDGE_NO_SEND')).status,
  'NOT_AUTHORIZED_OR_NOT_FOUND_HOLD');
 assert.equal((await r('managerA',SV,'REQUEST_PROVIDER_REVIEW')).status,
  'PRIVATE_REVIEW_JOURNALED_MOCK');
 const out=await r('ownerA',SU,'ACKNOWLEDGE_NO_SEND');
 assert.equal(out.status,'PRIVATE_REVIEW_JOURNALED_MOCK');
 assert.equal(out.sendAllowed,false);assert.equal(out.retryAllowed,false);
 assert.equal(out.ledgerMutated,false);
 assert.equal(f.audits.length,2);assert.equal(f.plans.length,2);
});
test('cross-store journal is denied without disclosing plan id',async()=>{
 const f=fake();
 const out=await f.bridge('ownerA').record({
  sessionToken:sign(SU),reference:RB,decision:'ESCALATE_TO_OWNER',
  requestId:randomUUID()
 });
 assert.equal(out.status,'NOT_AUTHORIZED_OR_NOT_FOUND_HOLD');
 assert.equal(f.audits.length,0);
});
test('duplicate idempotency across sessions cannot rewrite review decision',async()=>{
 const f=fake(),requestId=randomUUID();
 const p={reference:RA,requestId,sessionToken:sign(SU)};
 assert.equal((await f.bridge('ownerA').record({
  ...p,decision:'REQUEST_PROVIDER_REVIEW'
 })).status,'PRIVATE_REVIEW_JOURNALED_MOCK');
 assert.equal((await f.bridge('ownerA').record({
  ...p,decision:'ACKNOWLEDGE_NO_SEND'
 })).status,'NOT_AUTHORIZED_OR_NOT_FOUND_HOLD');
 assert.equal(f.audits.length,1);
});
test('revoking current owner grant prevents any further decision append',async()=>{
 const f=fake();
 f.grants[0].active=false;
 const out=await f.bridge('ownerA').record({
  sessionToken:sign(SU),reference:RA,decision:'ESCALATE_TO_OWNER',
  requestId:randomUUID()
 });
 assert.equal(out.status,'NOT_AUTHORIZED_OR_NOT_FOUND_HOLD');
 assert.equal(f.stats().writes,0);
});
test('unknown ref, bad ref and unsupported SEND/RETRY commands fail closed',async()=>{
 const f=fake();
 assert.equal((await f.bridge('ownerA').view({
  sessionToken:sign(SU),reference:'f'.repeat(32)
 })).status,'NOT_AUTHORIZED_OR_NOT_FOUND_HOLD');
 for(const ref of ['not32','A'.repeat(32),'',null]){
  await assert.rejects(f.bridge('ownerA').view({
   sessionToken:sign(SU),reference:ref
  }),/OPAQUE_BRIDGE_REFERENCE_INVALID/);
 }
 for(const decision of ['SEND','RESEND','MARK_DELIVERED','DELETE','RETRY']){
  await assert.rejects(f.bridge('ownerA').record({
   sessionToken:sign(SU),reference:RA,decision,requestId:randomUUID()
  }),/OPAQUE_BRIDGE_DECISION_NOT_ALLOWED/);
 }
 assert.equal(f.stats().writes,0);
});
test('invalid requestId fails before journal; no browser-supplied scope/role used',async()=>{
 const f=fake();
 await assert.rejects(f.bridge('ownerA').record({
  sessionToken:sign(SU),reference:RA,decision:'ACKNOWLEDGE_NO_SEND',
  requestId:'bad',role:'OWNER',tenantId:TA,storeId:SA,pageId:PA,
  serverPrivatePlanId:IDA
 }),/OPAQUE_BRIDGE_IDEMPOTENCY_REQUIRED/);
 assert.equal(f.audits.length,0);
});
test('SQL binds private DB subject + actor + session + grant + reference for BOTH paths',()=>{
 for(const sql of [SQL.view,SQL.append]){
  for(const fragment of [
   'app_private.messenger_reconciliation_refs',
   'app_private.messenger_operator_sessions',
   'app_private.messenger_operator_grants',
   'CURRENT_USER::name','os.subject_user_id','g.subject_user_id',
   'g.active','os.active','transaction_timestamp()',
   'plan_id'
  ])assert.ok(sql.includes(fragment),fragment);
  assert.doesNotMatch(sql,/SECURITY DEFINER|service_role|request\.jwt\.claims/i);
 }
 assert.equal(SQL.readOnly,'SET TRANSACTION READ ONLY');
 assert.match(SQL.view,/^SELECT /);
 assert.match(SQL.append,/^INSERT INTO app_private\.messenger_review_events/);
 assert.doesNotMatch(SQL.append,/\b(UPDATE|DELETE|TRUNCATE|DROP|ALTER)\b/i);
 assert.doesNotMatch(SQL.view,/\b(INSERT|UPDATE|DELETE|TRUNCATE|DROP|ALTER)\b/i);
});
test('no real provider, hosted access, or tenant identity claimed by offline bridge',()=>{
 const r=fake().bridge('ownerA').readiness;
 assert.equal(r.hostedReady,false);
 assert.equal(r.realOperatorSessionAuthorityWired,false);
 assert.equal(r.privateReferenceMappingDeployed,false);
 assert.equal(r.realOwnerAppWired,false);
 assert.equal(r.realMetaSendEnabled,false);
 assert.equal(r.automaticRetryEnabled,false);
});
