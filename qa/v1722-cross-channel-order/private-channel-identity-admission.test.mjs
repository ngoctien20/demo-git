import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {createPrivateQaIdentityRoute,IDENTITY_ADMISSION_CONTRACT,
 privateQaEventHash,privateQaSenderHash} from './private-channel-identity-admission.mjs';

const NOW=Date.parse('2026-11-17T13:35:00.000Z');
const fixtures=()=> {
 const key=generateKeyPairSync('ed25519');
 const attacker=generateKeyPairSync('ed25519');
 const original={channel:'messenger',route_ref:'QA_PAGE_A',sender_ref:'QA_ACTOR_M_A',
  message_id:'QA_EVENT_M_100',message_text:'QA_ORDER PREVIEW QA_SKU_001 2',
  timestamp_ms:NOW};
 const installations=[
  {channel:'messenger',route_ref:'QA_PAGE_A',tenant:'QA_TENANT_1',
   store:'QA_STORE_A',scope:'SYNTHETIC_ONLY',status:'QA_APPROVED',owner_verified:false},
  {channel:'zalo_bot',route_ref:'QA_BOT_A',tenant:'QA_TENANT_1',
   store:'QA_STORE_A',scope:'SYNTHETIC_ONLY',status:'QA_APPROVED',owner_verified:false},
  {channel:'messenger',route_ref:'QA_PAGE_B',tenant:'QA_TENANT_1',
   store:'QA_STORE_B',scope:'SYNTHETIC_ONLY',status:'QA_APPROVED',owner_verified:false}
 ];
 let latest;
 function issue(raw=original,patch={},privateKey=key.privateKey){
  const payload={
   contract:IDENTITY_ADMISSION_CONTRACT,issuer:'QA_INTERNAL_ISSUER',
   key_id:'QA_ED25519_V1',scope:'SYNTHETIC_ONLY',
   channel:raw.channel,route_ref:raw.route_ref,
   sender_sha256:privateQaSenderHash(raw),event_sha256:privateQaEventHash(raw),
   tenant:'QA_TENANT_1',store:'QA_STORE_A',actor_hash:'a'.repeat(64),
   issued_at_ms:NOW-1000,expires_at_ms:NOW+30000,
   native_verified:false,owner_verified:false,no_send:true,
   ...patch
  };
  latest={payload,signature:sign(null,Buffer.from(JSON.stringify(payload)),privateKey)
    .toString('base64url')};
  return latest;
 }
 const resolver=(options={})=>createPrivateQaIdentityRoute({
  trustedPublicKey:key.publicKey,issuerId:'QA_INTERNAL_ISSUER',
  keyId:'QA_ED25519_V1',installations,fetchPrivateReceipt:async()=>latest,
  now:()=>NOW,...options
 });
 issue();
 return {original,installations,issue,resolver,key,attacker};
};
const checkDeny=r=>{
 assert.equal(r.route,'DENY_NO_SEND');
 assert.equal(r.provider_sends,0);
 assert.equal(r.commerce_writes,0);
 assert.equal(r.native_provider_verified,false);
 assert.equal(r.real_store_owner_verified,false);
};

test('E01 valid private signed QA Messenger attestation routes ONLY to no-send plan',async()=>{
 const f=fixtures(),r=await f.resolver()(f.original);
 assert.equal(r.route,'PRIVATE_QA_ORDER_CORE_NO_SEND');
 assert.equal(r.command,'ORDER_PREVIEW');
 assert.equal(r.tenant,'QA_TENANT_1');
 assert.equal(r.store,'QA_STORE_A');
 assert.equal(r.actor_hash,'a'.repeat(64));
 assert.equal(r.admission_scope,'SYNTHETIC_ONLY');
 assert.equal(r.native_provider_verified,false);
 assert.equal(r.real_store_owner_verified,false);
 assert.equal(r.provider_sends,0);
 assert.equal(r.commerce_writes,0);
 assert.equal(r.model_calls,0);
 assert.equal('sender_ref' in r,false);
});

test('E02 private QA Zalo same-Store plan, NOT actual order lookup',async()=>{
 const f=fixtures();
 const z={...f.original,channel:'zalo_bot',route_ref:'QA_BOT_A',
  sender_ref:'QA_ACTOR_Z_A',message_id:'QA_EVENT_Z_100',
  message_text:'QA_ORDER STATUS QA-ORD-00001'};
 f.issue(z);
 const out=await f.resolver()(z);
 assert.equal(out.route,'PRIVATE_QA_ORDER_CORE_NO_SEND');
 assert.equal(out.command,'ORDER_STATUS');
 assert.equal(out.store,'QA_STORE_A');
 assert.equal(out.native_provider_verified,false);
 assert.equal('order_status' in out,false);
});

test('E03 raw sender and store authority claims cannot bypass schema',async()=>{
 const f=fixtures();
 const out=await f.resolver()({...f.original,store:'QA_STORE_A',provider_verified:true,
  tenant:'QA_TENANT_1',role:'owner'});
 checkDeny(out);
});

test('E04 unsigned event / no private receipt denied',async()=>{
 const f=fixtures();
 checkDeny(await f.resolver({fetchPrivateReceipt:async()=>null})(f.original));
});

test('E05 alternate Ed25519 issuer private key denied',async()=>{
 const f=fixtures();f.issue(f.original,{},f.attacker.privateKey);
 checkDeny(await f.resolver()(f.original));
});

test('E06 signed receipt for a different sender cannot be substituted',async()=>{
 const f=fixtures();checkDeny(await f.resolver()({...f.original,sender_ref:'QA_ATTACKER_A'}));
});

test('E07 signed receipt for a different message text cannot be substituted',async()=>{
 const f=fixtures();checkDeny(await f.resolver()({...f.original,message_text:'QA_ORDER PREVIEW QA_SKU_001 9'}));
});

test('E08 signed receipt for a different event ID cannot be substituted',async()=>{
 const f=fixtures();checkDeny(await f.resolver()({...f.original,message_id:'QA_EVENT_M_999'}));
});

test('E09 signed receipt for a different transport channel cannot be substituted',async()=>{
 const f=fixtures();checkDeny(await f.resolver()({...f.original,channel:'zalo_bot',route_ref:'QA_BOT_A'}));
});

test('E10 no forged source proof/native verified flag admitted',async()=>{
 const f=fixtures();f.issue(f.original,{native_verified:true,owner_verified:true});
 checkDeny(await f.resolver()(f.original));
});

test('E11 no client-controlled send/hosted flag admitted',async()=>{
 const f=fixtures();f.issue(f.original,{no_send:false});
 checkDeny(await f.resolver()(f.original));
});

test('E12 expired or excessive TTL signed receipt denied',async()=>{
 const f=fixtures();f.issue(f.original,{expires_at_ms:NOW-1});
 checkDeny(await f.resolver()(f.original));
 f.issue(f.original,{expires_at_ms:NOW+70000});
 checkDeny(await f.resolver()(f.original));
});

test('E13 future issued receipt denied',async()=>{
 const f=fixtures();f.issue(f.original,{issued_at_ms:NOW+1});
 checkDeny(await f.resolver()(f.original));
});

test('E14 signed but wrong Store B or Tenant is denied by private installation registry',async()=>{
 const f=fixtures();
 f.issue(f.original,{store:'QA_STORE_B'});
 checkDeny(await f.resolver()(f.original));
 f.issue(f.original,{tenant:'QA_TENANT_2'});
 checkDeny(await f.resolver()(f.original));
});

test('E15 revoked installation cannot receive trusted route',async()=>{
 const f=fixtures();const installations=f.installations.map(r=>
  r.route_ref==='QA_PAGE_A'?{...r,status:'QA_REVOKED'}:r);
 assert.throws(()=>f.resolver({installations}),/SYNTHETIC_INSTALLATION_REGISTRY_REQUIRED/);
 checkDeny(await f.resolver({installations:f.installations.filter(r=>r.route_ref!=='QA_PAGE_A')})(f.original));
});

test('E16 wrong issuer and unapproved key id denied',async()=>{
 const f=fixtures();f.issue(f.original,{issuer:'QA_FAKE_ALT'});
 checkDeny(await f.resolver()(f.original));
 f.issue(f.original,{key_id:'QA_OLD_KEY'});
 checkDeny(await f.resolver()(f.original));
});

test('E17 extra or missing receipt keys denied, even if signed',async()=>{
 const f=fixtures();const receipt=f.issue();
 const extra={...receipt.payload,untrusted_store_claim:'QA_STORE_B'};
 const signed=sign(null,Buffer.from(JSON.stringify(extra)),f.key.privateKey).toString('base64url');
 checkDeny(await f.resolver({fetchPrivateReceipt:async()=>({payload:extra,signature:signed})})(f.original));
});

test('E18 malformed QA and unknown commands deny; non-QA legacy remains unexecuted',async()=>{
 const f=fixtures();
 checkDeny(await f.resolver()({...f.original,message_text:'QA_ORDER CONFIRM QA-BOGUS'}));
 const r=await f.resolver()({...f.original,message_text:'Xin chào'});
 assert.equal(r.route,'LEGACY_UNCHANGED_NOT_EXECUTED');
 assert.equal(r.provider_sends,0);
});

test('E19 cannot create an issuer-less, blank, duplicated or real-owner registry',()=>{
 const f=fixtures();
 assert.throws(()=>f.resolver({issuerId:''}),/PRIVATE_TRUST_CONFIGURATION_REQUIRED/);
 assert.throws(()=>f.resolver({installations:[...f.installations,f.installations[0]]}),/DUPLICATE_QA_INSTALLATION/);
 assert.throws(()=>f.resolver({installations:[{...f.installations[0],owner_verified:true}]}),
  /SYNTHETIC_INSTALLATION_REGISTRY_REQUIRED/);
});
