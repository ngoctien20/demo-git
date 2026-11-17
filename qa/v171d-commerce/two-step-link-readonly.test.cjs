'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {VERSION,makeLinkService,createMemoryStoreQa}=require('./two-step-link-readonly.cjs');
const sha=x=>x.repeat(64);
let seq=0;
function harness(opts={}){
 let now=1794873600000,orderCalls=0;
 let source={source:'SERVER_VERIFIED_PROVIDER_AND_STORE',verified:true,consent:true,
  tenantId:'tenant-one',storeId:'store-a',channel:'MESSENGER',
  accountId:'page-a',subjectHash:sha('a'),canonicalCustomerId:'customer-one',
  ...(opts.source||{})};
 let target={source:'SERVER_VERIFIED_PROVIDER_AND_STORE',verified:true,consent:true,
  tenantId:'tenant-one',storeId:'store-a',channel:'ZALO_OA',
  accountId:'oa-a',subjectHash:sha('b'),...(opts.target||{})};
 const store=createMemoryStoreQa();
 const service=makeLinkService({verifySource:async()=>source,verifyTarget:async()=>target,
  privateStore:store,pepper:Buffer.alloc(32,4),
  randomBytes:()=>crypto.createHash('sha256').update('D-'+(++seq)).digest(),
  clock:()=>now,
  lookupOrder:async x=>{orderCalls++;
   return typeof opts.order==='function'?opts.order(x):{
    source:'AUTHORIZED_ORDER_STATUS_READBACK',verified:true,
    tenantId:x.tenantId,storeId:x.storeId,
    canonicalCustomerId:x.canonicalCustomerId,
    orderRef:x.orderRef,status:'pending',privatePhone:'DO_NOT_LEAK',
    privateAddress:'DO_NOT_LEAK'};}
 });
 return {service,store,source,target,
  setSource:x=>{source={...source,...x}},setTarget:x=>{target={...target,...x}},
  advance:ms=>{now+=ms},orders:()=>orderCalls,
  issue:()=>service.issue({targetChannel:'ZALO_OA'}),
  present:t=>service.present({token:t}),
  approve:t=>service.approve({token:t}),
  read:ref=>service.readOrder({orderRef:ref||'T404-QA-0001'})};
}
test('01 mandatory independent provider & storage callbacks',()=>{
 assert.throws(()=>makeLinkService(),/TWO_STEP_INDEPENDENT_PROOF_AND_STORAGE_REQUIRED/);
});
test('02 challenge issuance remains no-send/no-read',async()=>{
 const h=harness(),r=await h.issue();
 assert.equal(r.status,'CHALLENGE_ISSUED_ON_SOURCE_QA');
 assert.equal(r.token.length,43);
 assert.equal(r.providerSends,0);assert.equal(r.canCreateOrder,false);
});
test('03 order code alone never authorizes lookup',async()=>{
 const h=harness();
 assert.equal((await h.read()).status,'ORDER_ACCESS_DENIED');
 assert.equal(h.orders(),0);
});
test('04 presenting code from target is only PENDING, not an authorized link',async()=>{
 const h=harness(),token=(await h.issue()).token;
 const r=await h.present(token);assert.equal(r.status,'AWAIT_SOURCE_APPROVAL');
 assert.equal((await h.read()).status,'ORDER_ACCESS_DENIED');
 assert.equal(h.orders(),0);
});
test('05 signed-looking target with stolen code still cannot read until SOURCE approves',async()=>{
 const h=harness(),token=(await h.issue()).token;
 await h.present(token);assert.equal(h.store.stats().activeLinks,0);
 assert.equal((await h.read()).status,'ORDER_ACCESS_DENIED');
});
test('06 original source approves pending target, then read-only status works',async()=>{
 const h=harness(),token=(await h.issue()).token;
 await h.present(token);
 const r=await h.approve(token);
 assert.equal(r.status,'LINK_ACTIVE_QA_RECHECK_EACH_READ');
 assert.equal((await h.read()).status,'ORDER_STATUS_READ_ONLY_QA');
 assert.equal(h.orders(),1);
});
test('07 approval without target presentation denied',async()=>{
 const h=harness(),token=(await h.issue()).token;
 assert.equal((await h.approve(token)).status,'LINK_APPROVAL_DENIED');
});
test('08 source identity changing after issue prevents approval',async()=>{
 const h=harness(),token=(await h.issue()).token;
 await h.present(token);
 h.setSource({subjectHash:sha('c')});
 assert.equal((await h.approve(token)).status,'LINK_APPROVAL_DENIED');
 assert.equal((await h.read()).status,'ORDER_ACCESS_DENIED');
});
test('09 source changing Store prevents approval',async()=>{
 const h=harness(),token=(await h.issue()).token;await h.present(token);
 h.setSource({storeId:'store-b'});
 assert.equal((await h.approve(token)).status,'LINK_APPROVAL_DENIED');
});
test('10 target wrong Store cannot present',async()=>{
 const h=harness(),token=(await h.issue()).token;h.setTarget({storeId:'store-b'});
 assert.equal((await h.present(token)).status,'LINK_CHALLENGE_DENIED');
});
test('11 target wrong Tenant cannot present',async()=>{
 const h=harness(),token=(await h.issue()).token;h.setTarget({tenantId:'tenant-two'});
 assert.equal((await h.present(token)).status,'LINK_CHALLENGE_DENIED');
});
test('12 target wrong channel cannot present',async()=>{
 const h=harness(),token=(await h.issue()).token;h.setTarget({channel:'ZALO_BOT'});
 assert.equal((await h.present(token)).status,'LINK_CHALLENGE_DENIED');
});
test('13 invalid target provider verification refused',async()=>{
 const h=harness(),token=(await h.issue()).token;h.setTarget({verified:false});
 await assert.rejects(()=>h.present(token),/TARGET_PROVIDER_PROOF_REQUIRED/);
});
test('14 invalid source consent refused before token issue',async()=>{
 await assert.rejects(()=>harness({source:{consent:false}}).issue(),/SOURCE_CHANNEL_PROOF_REQUIRED/);
});
test('15 challenge cannot be used after five-minute expiration',async()=>{
 const h=harness(),token=(await h.issue()).token;h.advance(300001);
 assert.equal((await h.present(token)).status,'LINK_CHALLENGE_DENIED');
});
test('16 pending target cannot approve after timeout',async()=>{
 const h=harness(),token=(await h.issue()).token;await h.present(token);
 h.advance(300001);
 assert.equal((await h.approve(token)).status,'LINK_APPROVAL_DENIED');
});
test('17 one token cannot be used to bind a second target',async()=>{
 const h=harness(),token=(await h.issue()).token;
 await h.present(token);await h.approve(token);
 assert.equal((await h.present(token)).status,'LINK_CHALLENGE_DENIED');
});
test('18 forged order response from different Store denied',async()=>{
 const h=harness({order:x=>({source:'AUTHORIZED_ORDER_STATUS_READBACK',verified:true,
  tenantId:x.tenantId,storeId:'store-b',canonicalCustomerId:x.canonicalCustomerId,
  orderRef:x.orderRef,status:'paid'})});
 const token=(await h.issue()).token;await h.present(token);await h.approve(token);
 assert.equal((await h.read()).status,'ORDER_ACCESS_DENIED');
});
test('19 forged order response from different Customer denied',async()=>{
 const h=harness({order:x=>({source:'AUTHORIZED_ORDER_STATUS_READBACK',verified:true,
  tenantId:x.tenantId,storeId:x.storeId,canonicalCustomerId:'customer-two',
  orderRef:x.orderRef,status:'paid'})});
 const token=(await h.issue()).token;await h.present(token);await h.approve(token);
 assert.equal((await h.read()).status,'ORDER_ACCESS_DENIED');
});
test('20 target binding mismatch after approval denies order lookup',async()=>{
 const h=harness(),token=(await h.issue()).token;await h.present(token);await h.approve(token);
 h.setTarget({subjectHash:sha('c')});
 assert.equal((await h.read()).status,'ORDER_ACCESS_DENIED');
});
test('21 revoked link denies new reads without relying on expired JWT',async()=>{
 const h=harness(),token=(await h.issue()).token;await h.present(token);await h.approve(token);
 h.store.revoke({tenantId:'tenant-one',storeId:'store-a',channel:'ZALO_OA',
  accountId:'oa-a',subjectHash:sha('b')});
 assert.equal((await h.read()).status,'ORDER_ACCESS_DENIED');
});
test('22 no private phone/address leaked even if readback contains both',async()=>{
 const h=harness(),token=(await h.issue()).token;await h.present(token);await h.approve(token);
 const s=JSON.stringify(await h.read());
 assert(!s.includes('DO_NOT_LEAK'));assert(!s.includes('privatePhone'));
});
test('23 cannot create an order via read-only UAT',async()=>{
 const h=harness(),token=(await h.issue()).token;await h.present(token);await h.approve(token);
 const r=await h.read();assert.equal(r.canCreateOrder,false);assert.equal(r.hostedWrites,0);
 assert.equal(r.providerSends,0);
});
test('24 wrong order ref or guessed code never causes tool access',async()=>{
 const h=harness(),token=(await h.issue()).token;await h.present(token);await h.approve(token);
 const before=h.orders();
 assert.equal((await h.read('T404-!')).status,'ORDER_REFERENCE_INVALID');
 assert.equal(h.orders(),before);
});
test('25 all results are self-declared QA and no real proof certified',async()=>{
 const h=harness(),token=(await h.issue()).token;
 const r=await h.present(token);assert.equal(r.actualMetaZaloProofVerifiedHere,false);
 assert.equal(r.hostedStoreRlsCertified,false);
 assert.equal(h.store.stats().durable,false);
 assert.equal(VERSION,'T404_V171D_TWO_STEP_IDENTITY_ORDER_UAT_V1');
});
