'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createOfflineOwnershipIntake}=require('./owner-intake-offline.cjs');
const {TYPES}=require('../security-definer-v1443/four-row-owner-evidence.cjs');
const NOW=Date.parse('2026-11-16T08:00:00Z');
const TA='11111111-1111-4111-8111-111111111111';
const TB='22222222-2222-4222-8222-222222222222';
const SA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ACTOR={
 coordinator:'eeeeeeee-0000-4000-8000-000000000001',
 merchantA:'aaaaaaaa-0000-4000-8000-000000000002',
 merchantB:'bbbbbbbb-0000-4000-8000-000000000003',
 reviewer:'dddddddd-0000-4000-8000-000000000004',
 outsider:'cccccccc-0000-4000-8000-000000000005'
};
const ID=[
 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaa1',
 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbb2',
 'aaaaaaaa-3333-4333-8333-aaaaaaaaaaa3',
 'bbbbbbbb-4444-4444-8444-bbbbbbbbbbb4'
];
const D='2026-11-15T08:00:00Z';
function rows(){
 return ID.map((rowId,i)=>{
  const table=i<2?'products':'orders',tenantId=i%2?TB:TA,storeId=i%2?SB:SA;
  const merchantActorId=i%2?ACTOR.merchantB:ACTOR.merchantA;
  const snapshotSha256=String.fromCharCode(97+i).repeat(64);
  return {table,rowId,tenantId,candidateStoreId:storeId,
   merchantActorId,reviewerActorId:ACTOR.reviewer,
   snapshotSha256,sourceUpdatedAt:D,evidence:TYPES[table].map((type,j)=>({
    type,reference:'EVD-'+String(i*3+j).padStart(12,'0'),
    rowId,tenantId,storeId,snapshotSha256,
    actorId:type==='INDEPENDENT_QA_REVIEW'?ACTOR.reviewer:merchantActorId,
    signedAt:D
   }))};
 });
}
const baseline={products:2,orders:2,distinctTenants:2,
 eachTenantHasOneProductAndOneOrder:true};
function setup(options={}){
 let t=NOW;
 const state={...ACTOR};
 const perms=new Map();
 const ok=(actor,tenant,role)=>{
  if(actor===ACTOR.coordinator)return role==='QA_INTAKE_OPERATOR';
  if(actor===ACTOR.reviewer)return role==='QA_INDEPENDENT_REVIEWER';
  if(actor===ACTOR.merchantA)return role==='MERCHANT_OWNER'&&tenant===TA;
  if(actor===ACTOR.merchantB)return role==='MERCHANT_OWNER'&&tenant===TB;
  return false;
 };
 const ports={mode:'SYNTHETIC_PRIVATE_ROLE_REGISTRY',
  async verifyBearer(bearer){
   const id=state[bearer];
   return id?{id,active:!perms.get('revoked:'+bearer),
      verifiedBy:'SYNTHETIC_AUTH_SERVER'}:null;
  },
  async checkTenantRole({userId,tenantId,role,storeId}){
   if(!ok(userId,tenantId,role)||perms.get('deny:'+userId+':'+tenantId+':'+role))return null;
   return {source:'SYNTHETIC_PRIVATE_ROLE_REGISTRY',userId,tenantId,role,
     storeId:perms.get('wrongStore:'+userId)?SA:storeId,active:true};
  }
 };
 const svc=createOfflineOwnershipIntake({mode:'OFFLINE_SYNTHETIC_QA',
   ports,now:()=>t,...options});
 return {svc,ports,perms,state,advance:x=>{t+=x;}};
}
async function denial(p,code){await assert.rejects(p,e=>e?.code===code);}
async function staged(svc,extra={}){return svc.stage({bearer:'coordinator',rows:rows(),baseline,...extra});}
async function merchants(svc,id){
 await svc.merchantConfirm({bearer:'merchantA',sessionId:id});
 return svc.merchantConfirm({bearer:'merchantB',sessionId:id});
}
test('01 · cannot create hosted or uncontrolled owner intake service',()=>{
 assert.throws(()=>createOfflineOwnershipIntake(),/INTAKE_OFFLINE_ADAPTER_REQUIRED/);
 assert.throws(()=>createOfflineOwnershipIntake({mode:'HOSTED',ports:setup().ports}),/INTAKE_OFFLINE_ADAPTER_REQUIRED/);
});
test('02 · valid private four-row candidate stages in memory',async()=>{
 const {svc}=setup(),r=await staged(svc);
 assert.equal(r.status,'AWAITING_MERCHANT_CONFIRMATIONS');
 assert.equal(r.productCount,2);assert.equal(r.orderCount,2);
 assert.equal(r.merchantConfirmationsRequired,2);
 assert.equal(r.canBackfill,false);
});
test('03 · stage requires verified coordinator token',async()=>{
 const {svc}=setup();
 await denial(svc.stage({bearer:'outsider',rows:rows(),baseline}), 'INTAKE_ROLE_NOT_AUTHORIZED');
});
test('04 · missing bearer never stages or accesses records',async()=>{
 const {svc}=setup();
 await denial(svc.stage({rows:rows(),baseline}), 'INTAKE_IDENTITY_UNVERIFIED');
});
test('05 · missing independent QA evidence blocks staging',async()=>{
 const {svc}=setup(),r=rows();r[0].evidence.pop();
 await denial(svc.stage({bearer:'coordinator',rows:r,baseline}), 'INTAKE_EVIDENCE_LINT_FAILED');
});
test('06 · fake tenant-to-store assignment is rejected',async()=>{
 const {svc}=setup(),r=rows();r[0].candidateStoreId=SB;
 await denial(svc.stage({bearer:'coordinator',rows:r,baseline}), 'INTAKE_EVIDENCE_LINT_FAILED');
});
test('07 · one merchant cannot authenticate for two separate tenant owners',async()=>{
 const {svc}=setup(),r=rows();
 r[1].merchantActorId=ACTOR.merchantA;
 r[3].merchantActorId=ACTOR.merchantA;
 for(const i of [1,3])for(const e of r[i].evidence)
  if(e.type!=='INDEPENDENT_QA_REVIEW')e.actorId=ACTOR.merchantA;
 await denial(svc.stage({bearer:'coordinator',rows:r,baseline}),
   'INTAKE_REQUIRES_TWO_INDEPENDENT_TENANT_MERCHANTS');
});
test('08 · first merchant confirmation alone is NOT enough for review',async()=>{
 const {svc}=setup(),a=await staged(svc);
 const r=await svc.merchantConfirm({bearer:'merchantA',sessionId:a.sessionId});
 assert.equal(r.merchantConfirmations,1);
 assert.equal(r.status,'AWAITING_MERCHANT_CONFIRMATIONS');
 await denial(svc.independentReview({bearer:'reviewer',sessionId:a.sessionId,
  decision:'ACCEPT_FOR_ADDITIONAL_HOSTED_VERIFICATION'}),'INTAKE_WRONG_STEP');
});
test('09 · merchant B cannot confirm other merchant A slot',async()=>{
 const {svc}=setup(),a=await staged(svc);
 const r=await svc.merchantConfirm({bearer:'merchantB',sessionId:a.sessionId});
 assert.equal(r.merchantConfirmations,1);
});
test('10 · outsider cannot confirm any merchant slot',async()=>{
 const {svc}=setup(),a=await staged(svc);
 await denial(svc.merchantConfirm({bearer:'outsider',sessionId:a.sessionId}),
  'INTAKE_MERCHANT_NOT_ASSIGNED');
});
test('11 · revoked merchant cannot confirm',async()=>{
 const {svc,perms}=setup(),a=await staged(svc);
 perms.set('revoked:merchantA',true);
 await denial(svc.merchantConfirm({bearer:'merchantA',sessionId:a.sessionId}),
  'INTAKE_IDENTITY_UNVERIFIED');
});
test('12 · tenant permission revoked after stage must deny',async()=>{
 const {svc,perms}=setup(),a=await staged(svc);
 perms.set('deny:'+ACTOR.merchantA+':'+TA+':MERCHANT_OWNER',true);
 await denial(svc.merchantConfirm({bearer:'merchantA',sessionId:a.sessionId}),
  'INTAKE_ROLE_NOT_AUTHORIZED');
});
test('13 · duplicate merchant confirmation denied',async()=>{
 const {svc}=setup(),a=await staged(svc);
 await svc.merchantConfirm({bearer:'merchantA',sessionId:a.sessionId});
 await denial(svc.merchantConfirm({bearer:'merchantA',sessionId:a.sessionId}),
  'INTAKE_DUPLICATE_MERCHANT_CONFIRM');
});
test('14 · both merchants complete private synthetic confirmation phase',async()=>{
 const {svc}=setup(),a=await staged(svc);
 const r=await merchants(svc,a.sessionId);
 assert.equal(r.merchantConfirmations,2);
 assert.equal(r.status,'AWAITING_INDEPENDENT_QA');
 assert.equal(r.actualOwnerSignatureVerified,false);
});
test('15 · separate QA reviewer marks private review complete, NOT hosted approval',async()=>{
 const {svc}=setup(),a=await staged(svc);
 await merchants(svc,a.sessionId);
 const r=await svc.independentReview({bearer:'reviewer',sessionId:a.sessionId,
   decision:'ACCEPT_FOR_ADDITIONAL_HOSTED_VERIFICATION'});
 assert.equal(r.status,'PRIVATE_QA_REVIEW_COMPLETED_NOT_HOSTED_VERIFIED');
 assert.equal(r.reviewerActed,true);
 assert.equal(r.canBackfill,false);
});
test('16 · reviewer may reject insufficient private evidence',async()=>{
 const {svc}=setup(),a=await staged(svc);
 await merchants(svc,a.sessionId);
 const r=await svc.independentReview({bearer:'reviewer',sessionId:a.sessionId,
  decision:'REJECT_INSUFFICIENT_EVIDENCE'});
 assert.equal(r.status,'REJECTED_FOR_PRIVATE_REVISION');
});
test('17 · coordinator cannot self-review',async()=>{
 const {svc}=setup(),a=await staged(svc);
 await merchants(svc,a.sessionId);
 await denial(svc.independentReview({bearer:'coordinator',sessionId:a.sessionId,
  decision:'ACCEPT_FOR_ADDITIONAL_HOSTED_VERIFICATION'}),'INTAKE_SELF_REVIEW_DENIED');
});
test('18 · merchant cannot self-review',async()=>{
 const {svc}=setup(),a=await staged(svc);
 await merchants(svc,a.sessionId);
 await denial(svc.independentReview({bearer:'merchantA',sessionId:a.sessionId,
  decision:'ACCEPT_FOR_ADDITIONAL_HOSTED_VERIFICATION'}),'INTAKE_SELF_REVIEW_DENIED');
});
test('19 · outsider cannot act as QA reviewer',async()=>{
 const {svc}=setup(),a=await staged(svc);
 await merchants(svc,a.sessionId);
 await denial(svc.independentReview({bearer:'outsider',sessionId:a.sessionId,
  decision:'ACCEPT_FOR_ADDITIONAL_HOSTED_VERIFICATION'}),'INTAKE_ROLE_NOT_AUTHORIZED');
});
test('20 · revoked QA reviewer fails after merchants confirm',async()=>{
 const {svc,perms}=setup(),a=await staged(svc);
 await merchants(svc,a.sessionId);perms.set('revoked:reviewer',true);
 await denial(svc.independentReview({bearer:'reviewer',sessionId:a.sessionId,
  decision:'ACCEPT_FOR_ADDITIONAL_HOSTED_VERIFICATION'}),'INTAKE_IDENTITY_UNVERIFIED');
});
test('21 · missing one tenant reviewer grant fails closed',async()=>{
 const {svc,perms}=setup(),a=await staged(svc);
 await merchants(svc,a.sessionId);
 perms.set('deny:'+ACTOR.reviewer+':'+TB+':QA_INDEPENDENT_REVIEWER',true);
 await denial(svc.independentReview({bearer:'reviewer',sessionId:a.sessionId,
  decision:'ACCEPT_FOR_ADDITIONAL_HOSTED_VERIFICATION'}),'INTAKE_ROLE_NOT_AUTHORIZED');
});
test('22 · unknown reviewer decision is denied',async()=>{
 const {svc}=setup(),a=await staged(svc);
 await merchants(svc,a.sessionId);
 await denial(svc.independentReview({bearer:'reviewer',sessionId:a.sessionId,
  decision:'PUBLISH_NOW'}),'INTAKE_DECISION_INVALID');
});
test('23 · cannot reuse completed session to approve twice',async()=>{
 const {svc}=setup(),a=await staged(svc);await merchants(svc,a.sessionId);
 await svc.independentReview({bearer:'reviewer',sessionId:a.sessionId,
   decision:'ACCEPT_FOR_ADDITIONAL_HOSTED_VERIFICATION'});
 await denial(svc.independentReview({bearer:'reviewer',sessionId:a.sessionId,
   decision:'ACCEPT_FOR_ADDITIONAL_HOSTED_VERIFICATION'}),'INTAKE_WRONG_STEP');
});
test('24 · memory-bound session expires and is purged',async()=>{
 const {svc,advance}=setup({ttlMs:60000}),a=await staged(svc);
 advance(61000);
 await denial(svc.merchantConfirm({bearer:'merchantA',sessionId:a.sessionId}),
  'INTAKE_SESSION_EXPIRED');
 assert.equal(svc.inspect().activeSessions,0);
});
test('25 · cannot use forged session identifier',async()=>{
 const {svc}=setup();
 await denial(svc.merchantConfirm({bearer:'merchantA',
 sessionId:'00000000-0000-4000-8000-000000000000'}),'INTAKE_SESSION_NOT_FOUND');
});
test('26 · maximum simultaneous private sessions is bounded',async()=>{
 const {svc}=setup({maxSessions:1});await staged(svc);
 await denial(staged(svc),'INTAKE_SESSION_CAP_REACHED');
});
test('27 · response only contains generic data and opaque session',async()=>{
 const {svc}=setup(),a=await staged(svc);
 const text=JSON.stringify(a);
 for(const raw of [...ID,TA,TB,SA,SB,...Object.values(ACTOR),rows()[0].snapshotSha256]){
  assert.equal(text.includes(raw),false);
 }
 assert.equal(a.containsPrivateRecords,false);
});
test('28 · inspection cannot return private content',async()=>{
 const {svc}=setup();await staged(svc);
 const i=JSON.stringify(svc.inspect());
 assert.equal(i.includes(TA),false);
 assert.equal(i.includes(ID[0]),false);
 assert.equal(i.includes(SA),false);
});
test('29 · all flows have no hosted write or service-role capability',async()=>{
 const {svc}=setup();const a=await staged(svc);
 await merchants(svc,a.sessionId);
 await svc.independentReview({bearer:'reviewer',sessionId:a.sessionId,
  decision:'ACCEPT_FOR_ADDITIONAL_HOSTED_VERIFICATION'});
 const i=svc.inspect();
 assert.equal(i.realOwnerApprovals,0);
 assert.equal(i.hostedWrites,0);assert.equal(i.recordsBackfilled,0);
 for(const k of ['writeToSupabase','migrateRls','applyBackfill','publishKnowledge',
  'sendMeta','updateCredential'])assert.equal(svc[k],undefined);
});
test('30 · unverified private snapshots do not authorize hosted record attribution',async()=>{
 const {svc}=setup(),a=await staged(svc);await merchants(svc,a.sessionId);
 const r=await svc.independentReview({bearer:'reviewer',sessionId:a.sessionId,
 decision:'ACCEPT_FOR_ADDITIONAL_HOSTED_VERIFICATION'});
 assert.equal(r.actualOwnerSignatureVerified,false);
 assert.equal(r.independentHostedReadbackVerified,false);
});

test('31 · merchant acknowledgement rejects registry response for wrong Store',async()=>{
 const {svc,perms}=setup(),a=await staged(svc);
 perms.set('wrongStore:'+ACTOR.merchantB,true);
 await denial(svc.merchantConfirm({bearer:'merchantB',sessionId:a.sessionId}),
  'INTAKE_ROLE_NOT_AUTHORIZED');
});

test('32 · incomplete pack cannot nominate different reviewer for individual order',async()=>{
 const {svc}=setup(),items=rows();
 items[3].reviewerActorId=ACTOR.outsider;
 for(const e of items[3].evidence)
  if(e.type==='INDEPENDENT_QA_REVIEW')e.actorId=ACTOR.outsider;
 await denial(svc.stage({bearer:'coordinator',rows:items,baseline}),
  'INTAKE_INDEPENDENT_REVIEWER_MISMATCH');
});
test('33 · TTL eviction frees bounded memory for new private session',async()=>{
 const {svc,advance}=setup({ttlMs:60000,maxSessions:1});
 await staged(svc);advance(61000);
 const r=await staged(svc);
 assert.equal(r.status,'AWAITING_MERCHANT_CONFIRMATIONS');
 assert.equal(svc.inspect().activeSessions,1);
});
