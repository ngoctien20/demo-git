'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createProtectedOrderWriterPreflight,LEGACY_WORKFLOW_IDS} =
 require('./v172c34-protected-order-writer-preflight.cjs');
const NOW=1890000000000;
const intentBase={
 intentRef:'intent-synthetic-A',sourceLane:'commerce_v2_candidate',
 originWorkflowId:'commerce_v2_candidate_no_send',action:'create_order',
 tenantRef:'tenant-1',storeRef:'store-A',
 installationRef:'install-A',actorSessionRef:'session-A',
 providerEventRef:'event-A',channel:'messenger',sku:'A-101',
 quantity:2,expectedTotalVnd:318000
};
const actorBase={
 verified:true,active:true,sessionCurrent:true,providerAuthenticated:true,
 expiresAtMs:NOW+60000,actorSubjectRef:'subject-A',
 providerActorRef:'messenger-person-A',channel:'messenger',
 externalAccountRef:'page-A'
};
const installationBase={
 verified:true,active:true,installationRef:'install-A',
 tenantRef:'tenant-1',storeRef:'store-A',channel:'messenger',
 externalAccountRef:'page-A'
};
const orderBase={
 orderRef:'order-A',tenantRef:'tenant-1',storeRef:'store-A',
 ownershipAttested:true,status:'pending',originChannel:'messenger',
 originProviderActorRef:'messenger-person-A'
};
const quoteBase={
 tenantRef:'tenant-1',storeRef:'store-A',sku:'A-101',
 priceVerified:true,stockVerified:true,active:true,
 unitPriceVnd:159000,stockOnHand:10
};
function fixture(overrides={}){
 const calls=[];const base={
  readReleaseGate:async()=>({syntheticOnly:true,noSend:true,noOrderWrites:true,
    allowHostedUat:false,legacyDemoSeparated:true}),
  loadPrivateIntent:async()=>({...intentBase}),
  verifyActorSession:async()=>({...actorBase}),
  resolveInstallation:async()=>({...installationBase}),
  verifyStoreAuthority:async expected=>({verified:true,active:true,...expected}),
  loadOrder:async()=>({...orderBase}),
  loadVerifiedQuote:async()=>({...quoteBase}),
  verifyConfirmation:async expected=>({
   verified:true,singleUseConsumed:true,sessionBound:true,
   expiresAtMs:NOW+60000,...expected
  }),
  checkIdempotency:async()=>({checked:true,unseen:true}),
  verifyCrossChannelProof:async()=>({
   verified:true,scope:'read_order_status_only',canWrite:false,canSend:false
  }),
  now:()=>NOW,...overrides
 };
 for(const k of Object.keys(base)){
  if(k==='now')continue;const original=base[k];
  base[k]=async(...args)=>{calls.push(k);return original(...args);};
 }
 return {run:createProtectedOrderWriterPreflight(base),calls};
}
const request=()=>({intentRef:'intent-synthetic-A'});
const denied=async(f)=>assert.equal((await f.run(request())).status,'DENY');
test('candidate create passes private checks but NEVER grants a real order write',async()=>{
 const f=fixture();const x=await f.run(request());
 assert.deepEqual(x,{status:'SECURITY_PREFLIGHT_ONLY_NO_ORDER_WRITE',
   action:'create_order',canWriteOrder:false,canSend:false,
   requiresAtomicCommit:true,requiresIndependentSecurityApproval:true});
 assert.equal(f.calls.includes('loadOrder'),false);
 assert.ok(!JSON.stringify(x).includes('159000'));
});
test('change_lines with same-channel customer ownership and exact total: NO WRITE only',async()=>{
 const f=fixture({loadPrivateIntent:async()=>({...intentBase,action:'change_lines',orderRef:'order-A'})});
 const r=await f.run(request());assert.equal(r.status,'SECURITY_PREFLIGHT_ONLY_NO_ORDER_WRITE');
 assert.equal(r.canWriteOrder,false);
 assert.ok(f.calls.includes('loadOrder'));
});
test('same-channel status preview never reveals status/customer/order, no authorization to fetch',async()=>{
 const f=fixture({loadPrivateIntent:async()=>({
   ...intentBase,action:'preview_order_status',orderRef:'order-A'
 })});
 const r=await f.run(request());
 assert.deepEqual(r,{status:'SECURITY_PREFLIGHT_ONLY_NO_ORDER_WRITE',
   action:'preview_order_status',canReadOrderData:false,
   canWriteOrder:false,canSend:false});
 assert.equal(f.calls.includes('loadVerifiedQuote'),false);
});
test('different verified Zalo customer with signed dual-consent link may ONLY pass status preflight',async()=>{
 const f=fixture({
  loadPrivateIntent:async()=>({
   ...intentBase,action:'preview_order_status',orderRef:'order-A',
   channel:'zalo',installationRef:'install-Z',crossChannelProofRef:'proof-A'
  }),
  verifyActorSession:async()=>({...actorBase,channel:'zalo',
   providerActorRef:'zalo-person-A',externalAccountRef:'bot-Z'}),
  resolveInstallation:async()=>({...installationBase,installationRef:'install-Z',
   channel:'zalo',externalAccountRef:'bot-Z'})
 });
 const r=await f.run(request());
 assert.equal(r.status,'SECURITY_PREFLIGHT_ONLY_NO_ORDER_WRITE');
 assert.equal(r.canReadOrderData,false);
 assert.ok(f.calls.includes('verifyCrossChannelProof'));
});
for(const field of ['tenantRef','storeRef','role','verified','orderRef','sku','quantity',
 'phone','expectedTotalVnd','originWorkflowId','actorSubjectRef','channel']){
 test('DENY external caller override '+field+' before server reads',async()=>{
  const f=fixture();
  assert.equal((await f.run({...request(),[field]:'untrusted'})).status,'DENY');
  assert.equal(f.calls.length,0);
 });
}
test('DENY unsupported/malformed envelope',async()=>{
 const f=fixture();
 for(const requestLike of [null,{},[],{intentRef:'a'},{intentRef:'x'.repeat(300)}])
  assert.equal((await f.run(requestLike)).status,'DENY');
 assert.equal(f.calls.length,0);
});
test('DENY every published legacy Google Sheets tool even if called through new candidate path',async()=>{
 for(const workflowId of LEGACY_WORKFLOW_IDS){
  const f=fixture({loadPrivateIntent:async()=>({...intentBase,originWorkflowId:workflowId})});
  await denied(f);assert.equal(f.calls.includes('verifyActorSession'),false);
 }
});
for(const badLane of ['legacy_google_sheets','AI_SALES_DEMO','commerce_production',null]){
 test('DENY legacy or unapproved lane '+badLane,async()=>{
  const f=fixture({loadPrivateIntent:async()=>({...intentBase,sourceLane:badLane})});
  await denied(f);assert.equal(f.calls.includes('verifyActorSession'),false);
 });
}
for(const [label,gate] of [
 ['prod enabled',{syntheticOnly:false,noSend:true,noOrderWrites:true,allowHostedUat:false,legacyDemoSeparated:true}],
 ['send enabled',{syntheticOnly:true,noSend:false,noOrderWrites:true,allowHostedUat:false,legacyDemoSeparated:true}],
 ['write enabled',{syntheticOnly:true,noSend:true,noOrderWrites:false,allowHostedUat:false,legacyDemoSeparated:true}],
 ['hosted enabled',{syntheticOnly:true,noSend:true,noOrderWrites:true,allowHostedUat:true,legacyDemoSeparated:true}],
 ['legacy merged',{syntheticOnly:true,noSend:true,noOrderWrites:true,allowHostedUat:false,legacyDemoSeparated:false}]
])test('DENY unsafe release gate '+label,async()=>{
 const f=fixture({readReleaseGate:async()=>gate});await denied(f);
 assert.equal(f.calls.includes('loadPrivateIntent'),false);
});
for(const [label,patch] of [
 ['expired',{expiresAtMs:NOW-1}],
 ['nonfinite expiry',{expiresAtMs:NaN}],
 ['revoked',{active:false}],
 ['unverified',{verified:false}],
 ['stale session',{sessionCurrent:false}],
 ['provider not authenticated',{providerAuthenticated:false}],
 ['other channel',{channel:'zalo'}],
 ['unsupported channel',{channel:'web'}]
])test('DENY actor '+label,async()=>{
 const f=fixture({verifyActorSession:async()=>({...actorBase,...patch})});await denied(f);
});
for(const [label,patch] of [
 ['store swapped',{storeRef:'store-B'}],
 ['tenant swapped',{tenantRef:'tenant-2'}],
 ['installation changed',{installationRef:'install-B'}],
 ['page/account changed',{externalAccountRef:'page-B'}],
 ['inactive',{active:false}],
 ['not verified',{verified:false}]
])test('DENY protected installation '+label,async()=>{
 const f=fixture({resolveInstallation:async()=>({...installationBase,...patch})});
 await denied(f);assert.equal(f.calls.includes('loadVerifiedQuote'),false);
});
test('DENY Store membership missing or actor mismatch',async()=>{
 for(const v of [
  {verified:false,active:true,tenantRef:'tenant-1',storeRef:'store-A',installationRef:'install-A',actorSubjectRef:'subject-A'},
  {verified:true,active:true,tenantRef:'tenant-1',storeRef:'store-B',installationRef:'install-A',actorSubjectRef:'subject-A'},
  {verified:true,active:true,tenantRef:'tenant-1',storeRef:'store-A',installationRef:'install-A',actorSubjectRef:'subject-B'}
 ]){
  const f=fixture({verifyStoreAuthority:async()=>v});
  await denied(f);
 }
});
for(const [label,patch] of [
 ['wrong Store',{storeRef:'store-B'}],
 ['wrong tenant',{tenantRef:'tenant-2'}],
 ['wrong source actor',{originProviderActorRef:'messenger-person-B'}],
 ['unattested owner',{ownershipAttested:false}],
 ['already completed',{status:'completed'}]
])test('DENY order change '+label,async()=>{
 const f=fixture({loadPrivateIntent:async()=>({...intentBase,action:'change_lines',orderRef:'order-A'}),
   loadOrder:async()=>({...orderBase,...patch})});
 await denied(f);assert.equal(f.calls.includes('verifyConfirmation'),false);
});
test('DENY cross-channel write even when a READ status link is present',async()=>{
 const f=fixture({
  loadPrivateIntent:async()=>({...intentBase,action:'change_lines',orderRef:'order-A',
    channel:'zalo',installationRef:'install-Z',crossChannelProofRef:'proof-A'}),
  verifyActorSession:async()=>({...actorBase,channel:'zalo',
    providerActorRef:'zalo-person-A',externalAccountRef:'bot-Z'}),
  resolveInstallation:async()=>({...installationBase,installationRef:'install-Z',
    channel:'zalo',externalAccountRef:'bot-Z'})
 });
 await denied(f);assert.equal(f.calls.includes('verifyCrossChannelProof'),false);
});
test('DENY cross-channel order lookup on same phone without a proofRef',async()=>{
 const f=fixture({
  loadPrivateIntent:async()=>({...intentBase,action:'preview_order_status',orderRef:'order-A',
    channel:'zalo',installationRef:'install-Z',phone:'0900000000'}),
  verifyActorSession:async()=>({...actorBase,channel:'zalo',
    providerActorRef:'zalo-person-A',externalAccountRef:'bot-Z'}),
  resolveInstallation:async()=>({...installationBase,installationRef:'install-Z',
    channel:'zalo',externalAccountRef:'bot-Z'})
 });await denied(f);
});
test('DENY cross-channel status when link is revoked or signed link does not allow only read',async()=>{
 for(const result of [
  {verified:false,scope:'read_order_status_only',canWrite:false,canSend:false},
  {verified:true,scope:'change_order',canWrite:false,canSend:false},
  {verified:true,scope:'read_order_status_only',canWrite:true,canSend:false}
 ]){
  const f=fixture({
   loadPrivateIntent:async()=>({...intentBase,action:'preview_order_status',
      orderRef:'order-A',channel:'zalo',installationRef:'install-Z',crossChannelProofRef:'proof-A'}),
   verifyActorSession:async()=>({...actorBase,channel:'zalo',
     providerActorRef:'zalo-person-A',externalAccountRef:'bot-Z'}),
   resolveInstallation:async()=>({...installationBase,installationRef:'install-Z',
     channel:'zalo',externalAccountRef:'bot-Z'}),
   verifyCrossChannelProof:async()=>result
  });
  await denied(f);
 }
});
for(const [label,patch] of [
 ['price changed',{unitPriceVnd:160000}],
 ['other Store product',{storeRef:'store-B'}],
 ['other tenant product',{tenantRef:'tenant-2'}],
 ['price not verified',{priceVerified:false}],
 ['stock not verified',{stockVerified:false}],
 ['out of stock',{stockOnHand:1}],
 ['disabled',{active:false}],
 ['invalid monetary value',{unitPriceVnd:NaN}]
])test('DENY catalog/price/stock '+label,async()=>{
 const f=fixture({loadVerifiedQuote:async()=>({...quoteBase,...patch})});
 await denied(f);
});
for(const patch of [
 {expectedTotalVnd:null},{expectedTotalVnd:NaN},
 {expectedTotalVnd:159000},{quantity:0},{quantity:1000},
 {quantity:1.5},{quantity:-1},{sku:''}
])test('DENY missing/mismatched VND or invalid quantity '+JSON.stringify(patch),async()=>{
 const f=fixture({loadPrivateIntent:async()=>({...intentBase,...patch})});
 await denied(f);
});
test('DENY arithmetic beyond Number.MAX_SAFE_INTEGER',async()=>{
 const f=fixture({
  loadPrivateIntent:async()=>({...intentBase,expectedTotalVnd:9007199254740991}),
  loadVerifiedQuote:async()=>({...quoteBase,unitPriceVnd:9007199254740991,stockOnHand:2})
 });await denied(f);
});
for(const [label,patch] of [
 ['missing confirmation',{verified:false}],
 ['not session bound',{sessionBound:false}],
 ['not single use',{singleUseConsumed:false}],
 ['expired',{expiresAtMs:NOW-1}],
 ['changed total',{expectedTotalVnd:300000}],
 ['cross Store',{storeRef:'store-B'}],
 ['different actor',{actorSubjectRef:'subject-B'}],
 ['wrong intent',{intentRef:'intent-B'}]
])test('DENY confirmation '+label,async()=>{
 const f=fixture({verifyConfirmation:async expected=>({...expected,verified:true,
   singleUseConsumed:true,sessionBound:true,expiresAtMs:NOW+60000,...patch})});
 await denied(f);
});
for(const idem of [
 {checked:true,unseen:false},{checked:false,unseen:true},
 {checked:true},{checked:false},{checked:true,unseen:null}
])test('DENY duplicate, missing, or unverified idempotency '+JSON.stringify(idem),async()=>{
 const f=fixture({checkIdempotency:async()=>idem});await denied(f);
});
test('DENY protected store backend error, never return stack traces or PII',async()=>{
 const f=fixture({resolveInstallation:async()=>{throw Error('sensitive backend unavailable')}});
 const result=await f.run(request());
 assert.deepEqual(result,{status:'DENY',reason:'ORDER_WRITER_NOT_ADMITTED'});
});
test('required protected adapters cannot be omitted',()=>{
 assert.throws(()=>createProtectedOrderWriterPreflight({}),
   /PROTECTED_SERVER_ADAPTERS_REQUIRED/);
});

test('integrated real-shaped proof contract: independently linked Messenger order to Zalo only passes status preflight',async()=>{
 const {createCrossChannelIdentityProofGate}=require('./v172c34-cross-channel-identity-proof-gate.cjs');
 const actualProof={
  proofRef:'proof-A',orderRef:'order-A',tenantRef:'tenant-1',storeRef:'store-A',
  originChannel:'messenger',originActorRef:'messenger-person-A',
  targetChannel:'zalo',targetActorRef:'zalo-person-A',
  active:true,revoked:false,originConsentVerified:true,targetConsentVerified:true,
  originAccountOwnershipVerified:true,targetAccountOwnershipVerified:true,
  oneTimeChallengeConsumed:true,atomicReplayProtectionVerified:true,
  scope:'read_order_status_only',expiresAtMs:NOW+60000
 };
 const linkGate=createCrossChannelIdentityProofGate({
  getPrivateProof:async()=>actualProof,
  verifySignedLinkProof:async()=>({
    signatureVerified:true,issuerTrusted:true,boundToAllClaims:true
  }),
  now:()=>NOW
 });
 const f=fixture({
  loadPrivateIntent:async()=>({...intentBase,action:'preview_order_status',
    orderRef:'order-A',channel:'zalo',installationRef:'install-Z',
    crossChannelProofRef:'proof-A'}),
  verifyActorSession:async()=>({...actorBase,channel:'zalo',
    providerActorRef:'zalo-person-A',externalAccountRef:'bot-Z'}),
  resolveInstallation:async()=>({...installationBase,installationRef:'install-Z',
    channel:'zalo',externalAccountRef:'bot-Z'}),
  verifyCrossChannelProof:linkGate
 });
 assert.deepEqual(await f.run(request()),{
  status:'SECURITY_PREFLIGHT_ONLY_NO_ORDER_WRITE',
  action:'preview_order_status',canReadOrderData:false,
  canWriteOrder:false,canSend:false
 });
 // Identity cannot be spoofed by switching Zalo actor while retaining proof.
 const spoofed=fixture({
  loadPrivateIntent:async()=>({...intentBase,action:'preview_order_status',
    orderRef:'order-A',channel:'zalo',installationRef:'install-Z',
    crossChannelProofRef:'proof-A'}),
  verifyActorSession:async()=>({...actorBase,channel:'zalo',
    providerActorRef:'zalo-person-B',externalAccountRef:'bot-Z'}),
  resolveInstallation:async()=>({...installationBase,installationRef:'install-Z',
    channel:'zalo',externalAccountRef:'bot-Z'}),
  verifyCrossChannelProof:linkGate
 });
 await denied(spoofed);
});
