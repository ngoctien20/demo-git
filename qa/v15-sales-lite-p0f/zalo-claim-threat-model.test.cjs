'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {assessSyntheticZaloClaim}=require('./zalo-claim-threat-model.cjs');
const now=Date.UTC(2026,10,16,5,20,0),sha=s=>createHash('sha256').update(s).digest('hex');
const gate='synTHETIC_DO_NOT_USE_IN_LIVE_1_2345678901234567890';
const challengeId='00000000-0000-4000-8000-000000000001';
const code='SYNTHCODE01';
function setup(){
 const claim={challenge:challengeId,code,sender:'qa-zalo-sender',
  event:'qa-event-mid-1',tenant:'TENANT_A',store:'STORE_A',bot:'BOT_A'};
 const privateQa={mode:'DISPOSABLE_ZALO_QA_THREAT_MATRIX',
  vaultGateSynthetic:gate,binding:{tenant:'TENANT_A',store:'STORE_A',bot:'BOT_A'},
  challenge:{challengeId,codeHash:sha(code),expiresAtMs:now+60000,
    usedAtMs:null,failedAttempts:0},
  eventAlreadySeen:false,providerVerifiedNative:true};
 return {headerGate:gate,claim,privateQa,nowMs:now};
}
const deny=r=>{
 assert.equal(r.status,'BLOCKED');
 assert.equal(r.can_claim_live,false);
 assert.equal(r.can_mutate_hosted,false);
 assert.equal(r.can_send_provider,false);
 assert.equal(r.orders_written,0);
 assert.equal(r.real_zalo_provider_verified,false);
};
test('plausible synthetic request NEVER qualifies as a real provider-verified claim',()=>{
 const v=assessSyntheticZaloClaim(setup());
 assert.equal(v.status,'OFFLINE_REVIEW_ONLY');
 assert.equal(v.can_claim_live,false);assert.equal(v.can_send_provider,false);
 assert.equal(v.real_zalo_provider_verified,false);
});
test('missing or weak vault gate fails closed',()=>{
 for(const x of [undefined,'', 'short']){
  const p=setup();p.privateQa.vaultGateSynthetic=x;
  deny(assessSyntheticZaloClaim(p));
 }
});
test('wrong or absent HTTP gate is rejected before a claim',()=>{
 for(const x of [undefined,'','wrong'.repeat(12),gate+'x']){
  const p=setup();p.headerGate=x;
  deny(assessSyntheticZaloClaim(p));
 }
});
test('untrusted or missing synthetic QA backend is rejected',()=>{
 for(const x of [null,undefined,{},[],{mode:'REAL_ZALO_PRODUCTION'}]){
  const p=setup();p.privateQa=x;
  deny(assessSyntheticZaloClaim(p));
 }
});
test('mismatched tenant-store-bot boundary blocks',()=>{
 for(const k of ['tenant','store','bot']){
  const p=setup();p.claim[k]='OTHER';
  deny(assessSyntheticZaloClaim(p));
 }
});
test('mismatched or malformed challenge blocks',()=>{
 for(const x of ['wrong',null,'00000000-0000-4000-8000-000000000002']){
  const p=setup();p.claim.challenge=x;deny(assessSyntheticZaloClaim(p));
 }
});
test('wrong secret code blocks',()=>{
 const p=setup();p.claim.code='WRONGCODE99';
 deny(assessSyntheticZaloClaim(p));
});
test('empty or oversized code is denied',()=>{
 for(const x of ['', 'A'.repeat(129)]){
  const p=setup();p.claim.code=x;deny(assessSyntheticZaloClaim(p));
 }
});
test('expired challenge is rejected',()=>{
 const p=setup();p.privateQa.challenge.expiresAtMs=now;
 deny(assessSyntheticZaloClaim(p));
});
test('already consumed challenge is rejected (replay)',()=>{
 const p=setup();p.privateQa.challenge.usedAtMs=now-1000;
 deny(assessSyntheticZaloClaim(p));
});
test('failed-attempt counter >= 5 is denied',()=>{
 for(const n of [5,6,100]){
  const p=setup();p.privateQa.challenge.failedAttempts=n;
  deny(assessSyntheticZaloClaim(p));
 }
});
test('duplicate provider event is denied',()=>{
 const p=setup();p.privateQa.eventAlreadySeen=true;
 deny(assessSyntheticZaloClaim(p));
});
test('missing real native provider verification is denied',()=>{
 const p=setup();p.privateQa.providerVerifiedNative=false;
 const r=assessSyntheticZaloClaim(p);
 deny(r);
 assert.equal(r.reason,'NATIVE_PROVIDER_SIGNATURE_UNVERIFIED');
});
test('fake providerVerifiedNative=true cannot trigger real DB or provider',()=>{
 const p=setup();p.privateQa.providerVerifiedNative=true;
 const r=assessSyntheticZaloClaim(p);
 assert.equal(r.can_claim_live,false);
 assert.equal(r.can_mutate_hosted,false);
 assert.equal(r.real_zalo_provider_verified,false);
});
test('client-supplied privileged fields are rejected',()=>{
 for(const key of ['is_owner','verified','store_id','approve','recipient','can_send']){
  const p=setup();p.claim[key]=true;
  deny(assessSyntheticZaloClaim(p));
 }
});
test('invalid sender, empty or large event rejected',()=>{
 for(const [key,value] of [['sender',''],['sender','x'.repeat(129)],
   ['event',''],['event','x'.repeat(129)]]){
  const p=setup();p.claim[key]=value;
  deny(assessSyntheticZaloClaim(p));
 }
});
test('missing or forged local clock is rejected',()=>{
 const p=setup();p.nowMs=0;
 deny(assessSyntheticZaloClaim(p));
});
test('all failures remain no-write even when context is malicious',()=>{
 const p=setup();p.privateQa.challenge.codeHash='x'.repeat(64);
 const r=assessSyntheticZaloClaim(p);
 deny(r);
 assert.equal(r.provider_sends,0);
});
