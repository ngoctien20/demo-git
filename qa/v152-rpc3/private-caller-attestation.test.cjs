'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {CONTRACT,PROJECT,BASE,REQUIRED,ROLES,createPrivateCallerIntake}=
 require('./private-caller-attestation.cjs');
const NOW=Date.parse('2026-11-16T08:00:00Z');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const clone=x=>structuredClone(x);
function fixture(){
 const roles=ROLES.map(role=>{
   const pair=crypto.generateKeyPairSync('ed25519');
   return {role,keyId:'EV-'+role.replaceAll('_','')+'KEY00001',
     actorDigest:sha(role+'-synthetic-actor'),...pair};
 });
 const seen=new Set();
 const api=createPrivateCallerIntake({
   mode:'SYNTHETIC_NO_SEND',clock:()=>NOW,
   trustAnchors:roles.map(x=>({
     role:x.role,keyId:x.keyId,actorDigest:x.actorDigest,
     publicKey:x.publicKey
   })),
   nonceLedger:{claimOnce:async hash=>{
     if(seen.has(hash))return false;seen.add(hash);return true;
   }}
 });
 const payload=()=>({
   contract:CONTRACT,projectRef:PROJECT,parentSha:BASE,
   scope:'PRIVATE_CALLER_EVIDENCE_REVIEW_ONLY',
   issuedAtMs:NOW-20000,expiresAtMs:NOW+120000,
   nonceHex:crypto.randomBytes(32).toString('hex'),
   observationStart:'2026-11-15T06:00:00Z',
   observationEnd:'2026-11-16T06:00:00Z',
   records:REQUIRED.map((domain,i)=>({
     domain,evidenceRef:'EV-'+String(i).padStart(2,'0')+'CALLERRECEIPT2026',
     sha256:sha('fake-ref-'+domain),observedAtMs:NOW-40000,
     independentlyInspected:i===0,
     coverageCertified:false
   })),decision:'REVIEW_ONLY_NO_EXECUTE'
 });
 const packet=(p=payload())=>({payload:p,signatures:roles.map(x=>({
   role:x.role,keyId:x.keyId,actorDigest:x.actorDigest,
   signatureBase64Url:crypto.sign(null,
    Buffer.from('T404:RPC3:CALLER-ATTESTATION:V1:'+x.role+':'+JSON.stringify(p)),
    x.privateKey).toString('base64url')
 }))});
 return {api,payload,packet,roles};
}
test('01 valid synthetic three-signature metadata is NOT actual caller attestation',async()=>{
 const f=fixture(),r=await f.api.intake(f.packet());
 assert.equal(r.status,'SIGNED_METADATA_PENDING_PRIVATE_EVIDENCE_VALIDATION');
 assert.equal(r.signerRoles,3);assert.equal(r.evidenceDomains,6);
 assert.equal(r.completeExternalCallerInventoryCertified,false);
 assert.equal(r.rpcRevokeAuthorized,false);
 assert.equal(r.productionReleaseAuthorized,false);
});
test('02 tamper with any digest invalidates Ed25519 signatures',async()=>{
 const f=fixture(),p=f.packet();p.payload.records[0].sha256=sha('new digest');
 await assert.rejects(()=>f.api.intake(p),/RPC3_DETACHED_SIGNATURE_INVALID/);
});
test('03 signed packet cannot replay without durable nonce ledger',async()=>{
 const f=fixture(),p=f.packet();await f.api.intake(p);
 await assert.rejects(()=>f.api.intake(p),/RPC3_CALLER_PACKET_REPLAY_OR_LEDGER_UNAVAILABLE/);
});
test('04 exact project/base SHA/scope are mandatory',async()=>{
 for(const patch of [{projectRef:'wrong-project'},{parentSha:'0'.repeat(40)},
   {scope:'REVOKE_NOW'},{decision:'APPROVE'}]){
  const f=fixture(),p={...f.payload(),...patch};
  await assert.rejects(()=>f.api.intake(f.packet(p)),/RPC3_PACKET_SCOPE_DENIED/);
 }
});
test('05 evidence must cover all six independent caller domains',async()=>{
 const f=fixture(),p=f.payload();p.records.pop();
 await assert.rejects(()=>f.api.intake(f.packet(p)),/RPC3_CALLER_DOMAINS_INCOMPLETE/);
});
test('06 duplicate domain or opaque reference is refused',async()=>{
 for(const field of ['domain','evidenceRef']){
  const f=fixture(),p=f.payload();p.records[1][field]=p.records[0][field];
  await assert.rejects(()=>f.api.intake(f.packet(p)),/RPC3_CALLER_EVIDENCE_REFERENCE_INVALID/);
 }
});
test('07 direct JWT, raw logs or customer PII cannot be added to reference fields',async()=>{
 const f=fixture(),p=f.payload();p.records[0].access_token='secret';
 await assert.rejects(()=>f.api.intake(f.packet(p)),/RPC3_CALLER_EVIDENCE_REFERENCE_INVALID/);
});
test('08 missing independent Security Reviewer signature denied',async()=>{
 const f=fixture(),p=f.packet();p.signatures.pop();
 await assert.rejects(()=>f.api.intake(p),/RPC3_THREE_INDEPENDENT_SIGNERS_REQUIRED/);
});
test('09 one actor cannot claim 2 roles with reused signature',async()=>{
 const f=fixture(),p=f.packet();p.signatures[1]=clone(p.signatures[0]);
 await assert.rejects(()=>f.api.intake(p),/RPC3_DUPLICATE_OR_INVALID_SIGNER/);
});
test('10 unenrolled signer key ID denied',async()=>{
 const f=fixture(),p=f.packet();p.signatures[0].keyId='EV-UNTRUSTEDKEY000';
 await assert.rejects(()=>f.api.intake(p),/RPC3_SIGNER_NOT_ENROLLED/);
});
test('11 stale, future and overlong signed packet leases denied',async()=>{
 for(const patch of [{expiresAtMs:NOW-1},{issuedAtMs:NOW+15000},
    {expiresAtMs:NOW+2000000}]){
  const f=fixture(),p={...f.payload(),...patch};
  await assert.rejects(()=>f.api.intake(f.packet(p)),/RPC3_PACKET_WINDOW_OR_TTL_INVALID/);
 }
});
test('12 future observation window or inverted times denied',async()=>{
 for(const patch of [
  {observationStart:'2026-11-17T00:00:00Z',observationEnd:'2026-11-18T00:00:00Z'},
  {observationStart:'2026-11-16T06:00:00Z',observationEnd:'2026-11-15T06:00:00Z'}
 ]){
  const f=fixture(),p={...f.payload(),...patch};
  await assert.rejects(()=>f.api.intake(f.packet(p)),/RPC3_PACKET_WINDOW_OR_TTL_INVALID/);
 }
});
test('13 no trusted key registry or no nonce ledger cannot start',()=>{
 assert.throws(()=>createPrivateCallerIntake(),/RPC3_INDEPENDENT_TRUST_ENROLLMENT_MISSING/);
 assert.throws(()=>createPrivateCallerIntake({mode:'PRODUCTION',trustAnchors:[]}),
   /RPC3_INDEPENDENT_TRUST_ENROLLMENT_MISSING/);
});
test('14 all caller domains claiming coverage still do not independently certify',async()=>{
 const f=fixture(),p=f.payload();
 p.records=p.records.map(x=>({...x,independentlyInspected:true,coverageCertified:true}));
 const r=await f.api.intake(f.packet(p));
 assert.equal(r.selfReportedCoverageGaps.length,0);
 assert.equal(r.completeExternalCallerInventoryCertified,false);
 assert.equal(r.packetActualHostedCallerAttestation,false);
});
test('15 privileged operations have no code path to execute',()=>{
 const f=fixture();
 for(const operation of ['revoke','execute','authorize'])
  assert.throws(()=>f.api[operation](),/RPC3_RPC_REVOKE_DISABLED|RPC3_HOSTED_EXECUTION_DISABLED|RPC3_APPROVAL_REQUIRES_EXTERNAL_AUTHORITY/);
});
test('16 metadata receipt never emits token, nonce, signature or raw record digest',async()=>{
 const f=fixture(),p=f.packet(),r=JSON.stringify(await f.api.intake(p));
 assert(!r.includes(p.payload.nonceHex));
 assert(!r.includes(p.payload.records[0].sha256));
 assert(!r.includes(p.signatures[0].signatureBase64Url));
});
