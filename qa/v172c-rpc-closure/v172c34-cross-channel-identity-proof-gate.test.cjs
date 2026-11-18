'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createCrossChannelIdentityProofGate}=require('./v172c34-cross-channel-identity-proof-gate.cjs');
const NOW=1890000000000;
const expected=Object.freeze({
 proofRef:'proof-synthetic-A',orderRef:'order-synthetic-A',
 tenantRef:'tenant-1',storeRef:'store-A',
 originChannel:'messenger',originActorRef:'messenger-actor-A',
 targetChannel:'zalo',targetActorRef:'zalo-actor-A'
});
const proof={
 ...expected,active:true,revoked:false,originConsentVerified:true,
 targetConsentVerified:true,originAccountOwnershipVerified:true,
 targetAccountOwnershipVerified:true,oneTimeChallengeConsumed:true,
 atomicReplayProtectionVerified:true,expiresAtMs:NOW+60000,
 scope:'read_order_status_only'
};
function setup(options={}){
 let calls=0;
 const services={
  now:()=>NOW,
  getPrivateProof:async()=>{calls++;return proof;},
  verifySignedLinkProof:async()=>({signatureVerified:true,issuerTrusted:true,boundToAllClaims:true}),
  ...options
 };
 return {verify:createCrossChannelIdentityProofGate(services),calls:()=>calls};
}
test('valid independent dual-consent and signed proof allows only read-status preflight, never a write',async()=>{
 const f=setup();
 const result=await f.verify(expected);
 assert.deepEqual(result,{verified:true,scope:'read_order_status_only',canWrite:false,canSend:false});
 assert.equal(f.calls(),1);
 assert.ok(!JSON.stringify(result).includes('actor'));
 assert.ok(!JSON.stringify(result).includes('proof-synthetic'));
});
for(const [label,field,value] of [
 ['missing origin consent','originConsentVerified',false],
 ['missing target consent','targetConsentVerified',false],
 ['unverified origin account','originAccountOwnershipVerified',false],
 ['unverified target account','targetAccountOwnershipVerified',false],
 ['revoked proof','revoked',true],
 ['inactive proof','active',false],
 ['missing atomic replay defense','atomicReplayProtectionVerified',false],
 ['challenge not consumed','oneTimeChallengeConsumed',false],
 ['expired proof','expiresAtMs',NOW-1],
 ['NaN expiry','expiresAtMs',NaN],
 ['wrong scope','scope','create_order'],
 ['wrong Store','storeRef','store-B'],
 ['wrong tenant','tenantRef','tenant-2'],
 ['wrong order','orderRef','order-synthetic-B'],
 ['target actor not matching','targetActorRef','zalo-actor-B'],
 ['origin actor swapped','originActorRef','messenger-actor-B'],
 ['target channel mismatch','targetChannel','messenger'],
 ['missing proof ref','proofRef',null]
])test('DENY '+label,async()=>{
 const f=setup({getPrivateProof:async()=>({...proof,[field]:value})});
 assert.equal((await f.verify(expected)).verified,false);
});
for(const [label,signature] of [
 ['bad signature',{signatureVerified:false,issuerTrusted:true,boundToAllClaims:true}],
 ['wrong issuer',{signatureVerified:true,issuerTrusted:false,boundToAllClaims:true}],
 ['claims only partially bound',{signatureVerified:true,issuerTrusted:true,boundToAllClaims:false}],
 ['missing result',null]
])test('DENY '+label,async()=>{
 const f=setup({verifySignedLinkProof:async()=>signature});
 assert.equal((await f.verify(expected)).verified,false);
});
test('DENY phone/order ID coincidence and missing actual link proof',async()=>{
 const f=setup({getPrivateProof:async()=>null});
 assert.equal((await f.verify({...expected,phone:'0900000000'})).verified,false);
});
test('DENY both channels identical even when actor reference matches',async()=>{
 const f=setup();
 assert.equal((await f.verify({...expected,targetChannel:'messenger'})).verified,false);
 assert.equal(f.calls(),0);
});
test('DENY invalid required context without reading proof',async()=>{
 const f=setup();
 assert.equal((await f.verify({...expected,storeRef:''})).verified,false);
 assert.equal((await f.verify({...expected,proofRef:''})).verified,false);
 assert.equal(f.calls(),0);
});
test('DENY server-only proof backend outage',async()=>{
 const f=setup({getPrivateProof:async()=>{throw Error('offline')}});
 assert.equal((await f.verify(expected)).verified,false);
});
test('require all protected verification dependencies',()=>{
 assert.throws(()=>createCrossChannelIdentityProofGate(),/PRIVATE_PROOF_VERIFIERS_REQUIRED/);
});
