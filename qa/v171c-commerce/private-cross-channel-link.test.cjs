'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {createLinkService,createInMemoryPrivateQaStore,TTL_MS}=require('./private-cross-channel-link.cjs');
let clock=1794873600000,seq=0;
const SH=x=>x.repeat(64);
function make(opts={}){
 const store=opts.store||createInMemoryPrivateQaStore();
 let now=clock;
 const src={source:'SERVER_VERIFIED_PROVIDER_AND_STORE',verified:true,consent:true,
  tenantId:'tenant-one',storeId:'store-one',channel:'MESSENGER',accountId:'page-one',
  subjectHash:SH('a'),canonicalCustomerId:'customer-one',...(opts.source||{})};
 const dst={source:'SERVER_VERIFIED_PROVIDER_AND_STORE',verified:true,consent:true,
  tenantId:'tenant-one',storeId:'store-one',channel:'ZALO_OA',accountId:'oa-one',
  subjectHash:SH('b'),...(opts.destination||{})};
 const service=createLinkService({
  attestSource:async()=>src,
  attestDestination:async()=>dst,
  privateStore:store,
  pepper:Buffer.alloc(32,1),
  randomBytes:()=>crypto.createHash('sha256').update('QA_'+(++seq)).digest(),
  clock:()=>now
 });
 return {service,store,src,dst,setTime:t=>{now=t},now:()=>now};
}
test('01 missing dependencies fail closed',()=>{
 assert.throws(()=>createLinkService(),/PRIVATE_SERVER_PROOFS/);
});
test('02 weak secret rejected',()=>{
 const store=createInMemoryPrivateQaStore();
 assert.throws(()=>createLinkService({
  attestSource:async()=>true,attestDestination:async()=>true,privateStore:store,
  pepper:Buffer.from('weak')}),/PRIVATE_SERVER_PROOFS/);
});
test('03 authenticated source issues 5-minute challenge, not provider message',async()=>{
 const h=make(),x=await h.service.issue({targetChannel:'ZALO_OA'});
 assert.equal(x.status,'CHALLENGE_ISSUED_QA_ONLY');
 assert.equal(x.expiresAtMs-h.now(),TTL_MS);
 assert.equal(x.challengeToken.length,43);
 assert.equal(x.providerSends,0);
 assert.equal(h.store.snapshot().links,0);
});
test('04 valid source Messenger and valid target Zalo OA bind in QA memory',async()=>{
 const h=make(),token=(await h.service.issue({targetChannel:'ZALO_OA'})).challengeToken;
 const r=await h.service.redeem({token});
 assert.equal(r.status,'IDENTITY_LINK_BOUND_QA_MEMORY_ONLY');
 assert.equal(r.canonicalCustomerId,'customer-one');
 assert.equal(r.canReadOrder,false);
 assert.equal(h.store.snapshot().links,1);
});
test('05 challenge is single use even with second authenticated message',async()=>{
 const h=make(),token=(await h.service.issue({targetChannel:'ZALO_OA'})).challengeToken;
 await h.service.redeem({token});
 const x=await h.service.redeem({token});
 assert.equal(x.status,'CHALLENGE_DENIED_OR_EXPIRED');
 assert.equal(h.store.snapshot().links,1);
});
test('06 expires exactly at 5 minutes',async()=>{
 const h=make(),token=(await h.service.issue({targetChannel:'ZALO_OA'})).challengeToken;
 h.setTime(clock+TTL_MS);
 assert.equal((await h.service.redeem({token})).status,'CHALLENGE_DENIED_OR_EXPIRED');
});
test('07 cannot issue without source channel consent',async()=>{
 const h=make({source:{consent:false}});
 await assert.rejects(()=>h.service.issue({targetChannel:'ZALO_OA'}),/SOURCE_CHANNEL_AND_CUSTOMER_PROOF_REQUIRED/);
});
test('08 source cannot forge verified flag',async()=>{
 const h=make({source:{verified:false}});
 await assert.rejects(()=>h.service.issue({targetChannel:'ZALO_OA'}),/SOURCE_CHANNEL_AND_CUSTOMER_PROOF_REQUIRED/);
});
test('09 destination cannot redeem without independent provider attestation',async()=>{
 const h=make({destination:{verified:false}});
 const token=(await h.service.issue({targetChannel:'ZALO_OA'})).challengeToken;
 await assert.rejects(()=>h.service.redeem({token}),/DESTINATION_PROVIDER_PROOF_REQUIRED/);
 assert.equal(h.store.snapshot().links,0);
});
test('10 destination Store mismatch cannot link or consume challenge',async()=>{
 const store=createInMemoryPrivateQaStore();
 const bad=make({store,destination:{storeId:'store-two'}});
 const token=(await bad.service.issue({targetChannel:'ZALO_OA'})).challengeToken;
 assert.equal((await bad.service.redeem({token})).status,'CHALLENGE_DENIED_OR_EXPIRED');
 assert.equal(store.snapshot().links,0);
});
test('11 destination Tenant mismatch rejected',async()=>{
 const h=make({destination:{tenantId:'tenant-other'}});
 const token=(await h.service.issue({targetChannel:'ZALO_OA'})).challengeToken;
 assert.equal((await h.service.redeem({token})).status,'CHALLENGE_DENIED_OR_EXPIRED');
});
test('12 source and destination identical channel forbidden',async()=>{
 const h=make();
 await assert.rejects(()=>h.service.issue({targetChannel:'MESSENGER'}),/SOURCE_CHANNEL_AND_CUSTOMER_PROOF_REQUIRED/);
});
test('13 provider account ID and channel do not establish canonical identity by name',async()=>{
 const h=make({source:{canonicalCustomerId:undefined}});
 await assert.rejects(()=>h.service.issue({targetChannel:'ZALO_BOT'}),/SOURCE_CHANNEL_AND_CUSTOMER_PROOF_REQUIRED/);
});
test('14 target Zalo Bot challenge cannot redeem from Zalo OA',async()=>{
 const h=make(),token=(await h.service.issue({targetChannel:'ZALO_BOT'})).challengeToken;
 assert.equal((await h.service.redeem({token})).status,'CHALLENGE_DENIED_OR_EXPIRED');
});
test('15 malformed guessed token fails before store lookup',async()=>{
 await assert.rejects(()=>make().service.redeem({token:'T404-TEST-0001'}),/CHALLENGE_TOKEN_INVALID/);
});
test('16 token hash only stored, plaintext never in QA backing store',async()=>{
 const h=make(),token=(await h.service.issue({targetChannel:'ZALO_OA'})).challengeToken;
 assert.equal(h.store.snapshot().challenges,1);
 assert(!JSON.stringify(h.store.snapshot()).includes(token));
});
test('17 same Store destination cannot be rebound to other canonical Customer',async()=>{
 const store=createInMemoryPrivateQaStore();
 const a=make({store}),ta=(await a.service.issue({targetChannel:'ZALO_OA'})).challengeToken;
 assert.equal((await a.service.redeem({token:ta})).status,'IDENTITY_LINK_BOUND_QA_MEMORY_ONLY');
 const b=make({store,source:{canonicalCustomerId:'customer-two'}});
 const tb=(await b.service.issue({targetChannel:'ZALO_OA'})).challengeToken;
 assert.equal((await b.service.redeem({token:tb})).status,'CHALLENGE_DENIED_OR_EXPIRED');
});
test('18 simultaneous same token consumes return one success in test store',async()=>{
 const h=make(),token=(await h.service.issue({targetChannel:'ZALO_OA'})).challengeToken;
 const r=await Promise.all([h.service.redeem({token}),h.service.redeem({token})]);
 assert.equal(r.filter(x=>x.status==='IDENTITY_LINK_BOUND_QA_MEMORY_ONLY').length,1);
});
test('19 invalid CSPRNG dependency fails',async()=>{
 const store=createInMemoryPrivateQaStore();
 const h=createLinkService({privateStore:store,pepper:Buffer.alloc(32,1),
  attestSource:async()=>make().src,attestDestination:async()=>make().dst,
  randomBytes:()=>Buffer.from([1]),clock:()=>clock});
 await assert.rejects(()=>h.issue({targetChannel:'ZALO_OA'}),/CSPRNG_REQUIRED/);
});
test('20 source-only contract never claims hosted verification or order access',async()=>{
 const h=make(),token=(await h.service.issue({targetChannel:'ZALO_OA'})).challengeToken;
 const r=await h.service.redeem({token});
 assert.equal(r.realChannelProofVerifiedHere,false);
 assert.equal(r.durableHostedLinkCertified,false);
 assert.equal(r.orderWrites,0);
 assert.equal(r.hostedWrites,0);
});
