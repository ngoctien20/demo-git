'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {CONTRACT,ACTION,createTrustedPairingGateway}=
 require('./trusted-pairing-capability.cjs');
const NOW=Date.parse('2026-11-16T06:30:00.000Z');
function fixture(){
 const fakeProviderKey=crypto.randomBytes(32);
 let current=NOW,signatureOk=true,consentOk=true,challengeOk=true;
 let bindingOk=true,allowEventClaim=true,allowCapabilityClaim=true;
 const eventSeen=new Set(),capSeen=new Set();
 const accounts=new Map([
 ['page-a',{tenant_id:'tenant-1',store_id:'shop-a',bot_id:'bot-a'}],
 ['page-b',{tenant_id:'tenant-1',store_id:'shop-b',bot_id:'bot-b'}]
 ]);
 const counts={signature:0,binding:0,consent:0,challenge:0,
   inboundClaim:0,capabilityClaim:0};
 const gate=createTrustedPairingGateway({
   mode:'SYNTHETIC_NO_SEND',
   signerKey:crypto.randomBytes(32),kid:'qa-kid-a',
   clock:()=>current,
   verifyProviderEvent:async({channel,rawBody,headers})=>{
     counts.signature++;
     const calc=crypto.createHmac('sha256',fakeProviderKey).update(rawBody).digest('hex');
     if(!signatureOk||headers['x-qa-provider-mac']!==calc)
       throw new Error('PROVIDER_SIG_NOT_VALID');
     const e=JSON.parse(rawBody.toString('utf8'));
     return {
       channel,account_id:e.account_id,event_id:e.event_id,
       subject_hash:e.subject_hash,occurred_at_ms:e.occurred_at_ms
     };
   },
   lookupTrustedChannelBinding:async({channel,account_id})=>{
     counts.binding++;
     const b=accounts.get(account_id);
     return bindingOk&&b?{channel,account_id,...b,status:'active'}:null;
   },
   checkMerchantConsent:async()=>{counts.consent++;return consentOk},
   verifyOwnerChallenge:async({challenge_proof})=>{
     counts.challenge++;return challengeOk&&challenge_proof==='a'.repeat(32);
   },
   claimInboundEventOnce:async(key)=>{
     counts.inboundClaim++;
     if(!allowEventClaim||eventSeen.has(key))return false;
     eventSeen.add(key);return true;
   },
   claimCapabilityOnce:async(key)=>{
     counts.capabilityClaim++;
     if(!allowCapabilityClaim||capSeen.has(key))return false;
     capSeen.add(key);return true;
   }
 });
 function envelope({
   account_id='page-a',event_id='evt-1',subject_hash='b'.repeat(64),
   channel='ZALO_BOT',occurred_at_ms=current
 }={}){
   const rawBody=Buffer.from(JSON.stringify({account_id,event_id,
     subject_hash,occurred_at_ms}),'utf8');
   const mac=crypto.createHmac('sha256',fakeProviderKey).update(rawBody).digest('hex');
   return {channel,rawBody,headers:{'x-qa-provider-mac':mac}};
 }
 const request=(options={})=>({
   envelope:envelope(options),challenge_ref:'qa-challenge-1',
   challenge_proof:'a'.repeat(32)
 });
 const flags={
   signature:v=>signatureOk=v,
   consent:v=>consentOk=v,
   challenge:v=>challengeOk=v,
   binding:v=>bindingOk=v,
   eventLedger:v=>allowEventClaim=v,
   capabilityLedger:v=>allowCapabilityClaim=v,
   shiftTime:delta=>current+=delta
 };
 return {gate,request,envelope,flags,counts};
}
test('01 verifies signed provider event and Store A binding; emits NO WRITE token',async()=>{
 const f=fixture(),out=await f.gate.issueCandidate(f.request());
 assert.equal(out.contract,CONTRACT);
 assert.equal(out.action,ACTION);
 assert.equal(out.store_id,'shop-a');
 assert.equal(out.status,'PAIRING_CAPABILITY_PREVIEW_ONLY');
 assert.equal(out.dbWrites,0);
 assert.equal(out.providerSent,false);
 assert.equal(out.liveAuthorized,false);
 assert.match(out.token,/^tp1\./);
});
test('02 one signed event yields one synthetic review-only claim',async()=>{
 const f=fixture(),req=f.request();
 const issued=await f.gate.issueCandidate(req);
 const v=await f.gate.verifyAndClaimPreview({
    ...req,token:issued.token
 });
 assert.equal(v.status,'SIGNED_CAPABILITY_CLAIMED_NO_DB_WRITE');
 assert.equal(v.scope.tenant_id,'tenant-1');
 assert.equal(v.scope.store_id,'shop-a');
 assert.equal(v.executionAllowed,false);
 assert.equal(v.productionNonceCertified,false);
 assert.equal(v.legacyRpcInvoked,false);
 assert.equal(v.dbWrites,0);
});
test('03 same provider event cannot issue second capability',async()=>{
 const f=fixture(),req=f.request();
 await f.gate.issueCandidate(req);
 await assert.rejects(()=>f.gate.issueCandidate(req),
   /PROVIDER_EVENT_REPLAY_OR_LEDGER_UNAVAILABLE/);
});
test('04 same signed capability cannot be claimed twice',async()=>{
 const f=fixture(),req=f.request();
 const issued=await f.gate.issueCandidate(req);
 await f.gate.verifyAndClaimPreview({...req,token:issued.token});
 await assert.rejects(()=>f.gate.verifyAndClaimPreview({...req,token:issued.token}),
   /PAIRING_CAPABILITY_REPLAY_OR_LEDGER_UNAVAILABLE/);
});
test('05 wrong Store under same tenant is rejected on consume',async()=>{
 const f=fixture(),req=f.request(),issued=await f.gate.issueCandidate(req);
 await assert.rejects(()=>f.gate.verifyAndClaimPreview({
   ...f.request({account_id:'page-b'}),token:issued.token
 }),/PAIRING_SCOPE_OR_EVENT_MISMATCH/);
});
test('06 wrong provider event ID or recipient is blocked on consume',async()=>{
 for(const opts of [{event_id:'evt-2'},{subject_hash:'c'.repeat(64)}]){
   const f=fixture(),req=f.request(),issued=await f.gate.issueCandidate(req);
   await assert.rejects(()=>f.gate.verifyAndClaimPreview({
     ...f.request(opts),token:issued.token
   }),/PAIRING_SCOPE_OR_EVENT_MISMATCH/);
 }
});
test('07 forged provider signature fails closed before Store lookup',async()=>{
 const f=fixture(),req=f.request();
 f.flags.signature(false);
 await assert.rejects(()=>f.gate.issueCandidate(req),/PROVIDER_SIG_NOT_VALID/);
 assert.equal(f.counts.binding,0);
});
test('08 invalid provider event age blocks',async()=>{
 const f=fixture(),req=f.request({occurred_at_ms:NOW-9*60*1000});
 await assert.rejects(()=>f.gate.issueCandidate(req),
   /PROVIDER_SIGNATURE_OR_EVENT_UNVERIFIED/);
});
test('09 unsigned transport, forbidden channel, raw text fails closed',async()=>{
 for(const envelope of [
  {channel:'WEB_WIDGET',rawBody:Buffer.from('{}'),headers:{}},
  {channel:'ZALO_BOT',rawBody:'{"foo":1}',headers:{}},
  {channel:'MESSENGER',rawBody:Buffer.alloc(0),headers:{}}
 ]){
  const f=fixture();await assert.rejects(()=>f.gate.issueCandidate({
    ...f.request(),envelope
  }),/UNTRUSTED_PROVIDER_ENVELOPE/);
 }
});
test('10 unknown account or deactivated binding fails',async()=>{
 const f=fixture();
 await assert.rejects(()=>f.gate.issueCandidate(f.request({account_id:'unknown'})),
   /CANONICAL_CHANNEL_STORE_BINDING_REQUIRED/);
 f.flags.binding(false);
 await assert.rejects(()=>f.gate.issueCandidate(f.request()),
   /CANONICAL_CHANNEL_STORE_BINDING_REQUIRED/);
});
test('11 missing owner consent blocks issuance',async()=>{
 const f=fixture();f.flags.consent(false);
 await assert.rejects(()=>f.gate.issueCandidate(f.request()),
   /OWNER_CONSENT_UNVERIFIED/);
 assert.equal(f.counts.inboundClaim,0);
});
test('12 invalid pairing challenge proof blocks; cannot be bypassed by role flag',async()=>{
 const f=fixture(),req=f.request();
 await assert.rejects(()=>f.gate.issueCandidate({
  ...req,challenge_proof:'b'.repeat(32),role:'administrator',verified:true
 }),/OWNER_PAIRING_PROOF_DENIED/);
 assert.equal(f.counts.inboundClaim,0);
});
test('13 missing challenge, oversized tokens, malicious SQL fields are not accepted',async()=>{
 const f=fixture();
 await assert.rejects(()=>f.gate.issueCandidate({
   ...f.request(),challenge_ref:'a'.repeat(160)
 }),/PAIRING_CHALLENGE_INPUT_INVALID/);
 assert.throws(()=>f.gate.runSql('SELECT * FROM customers'),/ARBITRARY_SQL_DISABLED/);
});
test('14 token modified after signature is rejected',async()=>{
 const f=fixture(),req=f.request(),issued=await f.gate.issueCandidate(req);
 const token=issued.token.slice(0,-2)+'99';
 await assert.rejects(()=>f.gate.verifyAndClaimPreview({...req,token}),
   /PAIRING_CAPABILITY_BAD_SIGNATURE/);
});
test('15 token cannot cross channels',async()=>{
 const f=fixture(),req=f.request(),issued=await f.gate.issueCandidate(req);
 await assert.rejects(()=>f.gate.verifyAndClaimPreview({
   ...f.request({channel:'MESSENGER'}),token:issued.token
 }),/PAIRING_SCOPE_OR_EVENT_MISMATCH/);
});
test('16 expired capability cannot be claimed',async()=>{
 const f=fixture(),req=f.request(),issued=await f.gate.issueCandidate({
   ...req,ttlMs:1000
 });
 f.flags.shiftTime(2000);
 await assert.rejects(()=>f.gate.verifyAndClaimPreview({...req,token:issued.token}),
   /PAIRING_CAPABILITY_CLAIMS_INVALID/);
});
test('17 confirmation/challenge revoked after issuance blocks consume',async()=>{
 const f=fixture(),req=f.request(),issued=await f.gate.issueCandidate(req);
 f.flags.challenge(false);
 await assert.rejects(()=>f.gate.verifyAndClaimPreview({...req,token:issued.token}),
  /OWNER_PAIRING_PROOF_DENIED/);
 assert.equal(f.counts.capabilityClaim,0);
});
test('18 owner consent revoked after issuance blocks consume',async()=>{
 const f=fixture(),req=f.request(),issued=await f.gate.issueCandidate(req);
 f.flags.consent(false);
 await assert.rejects(()=>f.gate.verifyAndClaimPreview({...req,token:issued.token}),
  /OWNER_CONSENT_UNVERIFIED/);
 assert.equal(f.counts.capabilityClaim,0);
});
test('19 inbound event ledger unavailable fails closed',async()=>{
 const f=fixture();f.flags.eventLedger(false);
 await assert.rejects(()=>f.gate.issueCandidate(f.request()),
  /PROVIDER_EVENT_REPLAY_OR_LEDGER_UNAVAILABLE/);
});
test('20 capability ledger unavailable fails closed',async()=>{
 const f=fixture(),req=f.request(),issued=await f.gate.issueCandidate(req);
 f.flags.capabilityLedger(false);
 await assert.rejects(()=>f.gate.verifyAndClaimPreview({...req,token:issued.token}),
  /PAIRING_CAPABILITY_REPLAY_OR_LEDGER_UNAVAILABLE/);
});
test('21 bad signing keys, missing provider verifier, unsupported mode rejected',()=>{
 assert.throws(()=>createTrustedPairingGateway(),/TRUSTED_PRIVATE_GATEWAY_PORTS_REQUIRED/);
 assert.throws(()=>createTrustedPairingGateway({mode:'LIVE'}),/TRUSTED_PRIVATE_GATEWAY_PORTS_REQUIRED/);
});
test('22 legacy public RPC, private DB claim, send, publish unavailable',()=>{
 const f=fixture();
 assert.throws(()=>f.gate.callLegacyRpc(),/PUBLIC_SECURITY_DEFINER_RPC_DISABLED_IN_GATEWAY/);
 assert.throws(()=>f.gate.executePrivateClaim(),/PRIVATE_PAIRING_WRITER_REQUIRES_HOSTED_APPROVAL/);
 assert.throws(()=>f.gate.send(),/PROVIDER_SEND_DISABLED/);
 assert.throws(()=>f.gate.publish(),/PUBLISH_APPROVAL_REQUIRED/);
});
test('23 different Shop B event gets isolated Store B capability',async()=>{
 const f=fixture();
 const out=await f.gate.issueCandidate(f.request({account_id:'page-b'}));
 assert.equal(out.store_id,'shop-b');
 assert.equal(out.tenant_id,'tenant-1');
 assert.equal(out.legacyRpcInvoked,false);
});
test('24 one-time capability input never contains raw sender PII in decoded claims',async()=>{
 const f=fixture(),out=await f.gate.issueCandidate(f.request());
 const decoded=JSON.parse(Buffer.from(out.token.split('.')[1],'base64url').toString('utf8'));
 assert.equal(Object.hasOwn(decoded,'sender'),false);
 assert.equal(Object.hasOwn(decoded,'phone'),false);
 assert.equal(Object.hasOwn(decoded,'headers'),false);
 assert.equal(Object.hasOwn(decoded,'challenge_proof'),false);
 assert.equal(Object.hasOwn(decoded,'customer_name'),false);
});
