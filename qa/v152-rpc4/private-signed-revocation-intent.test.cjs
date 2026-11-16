'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const baseline=require('../v152-rpc3/hosted-readonly-baseline.json');
const {
 CONTRACT,PROJECT,PARENT,TARGET,OPERATION,ROLES,DOMAINS,
 createPrivateRevocationIntake,evaluateHostedReadiness
}=require('./private-signed-revocation-intent.cjs');
const NOW=Date.parse('2026-11-16T08:30:00Z');
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
function fixture(){
 const pairs=ROLES.map(role=>({
   role,actorDigest:hash('synthetic-actor:'+role),
   keyId:'EV-'+role.replaceAll('_','')+'KEY000001',
   ...crypto.generateKeyPairSync('ed25519')
 }));
 const seen=new Set();
 const api=createPrivateRevocationIntake({
  mode:'SYNTHETIC_NO_SEND',clock:()=>NOW,
  trustAnchors:pairs.map(p=>({role:p.role,keyId:p.keyId,
   actorDigest:p.actorDigest,publicKey:p.publicKey})),
  nonceLedger:{claimOnce:async n=>{
   if(seen.has(n))return false;seen.add(n);return true;
  }}
 });
 function payload(){
   return {
    contract:CONTRACT,projectRef:PROJECT,parentSha:PARENT,
    operation:OPERATION,targetFunction:TARGET,grantees:['PUBLIC','anon'],
    nonceHex:crypto.randomBytes(32).toString('hex'),
    issuedAtMs:NOW-5000,expiresAtMs:NOW+120000,
    scope:'PRIVATE_DRAFT_REVIEW_ONLY_NO_EXECUTION',
    evidence:DOMAINS.map((domain,i)=>({
      domain,ref:'EV-'+String(i).padStart(2,'0')+'OFFLINEEVIDENCE01',
      sha256:hash('synthetic-evidence:'+domain),
      independentlyInspected:i===0,observationCertified:false
    })),
    controllerDecision:'REQUEST_SEPARATE_OPERATION_APPROVAL'
   };
 }
 const packet=(p=payload())=>({
  payload:p,signatures:pairs.map(k=>({
   role:k.role,keyId:k.keyId,actorDigest:k.actorDigest,
   signatureBase64Url:crypto.sign(null,
    Buffer.from('TIEN404:RPC4:REVOKE-INTENT:V1:'+k.role+':'+JSON.stringify(p)),
    k.privateKey).toString('base64url')
  }))
 });
 return {pairs,api,payload,packet};
}
test('01 synthetic three-role signed packet accepted only as non-executable intent',async()=>{
 const f=fixture(),r=await f.api.inspect(f.packet());
 assert.equal(r.status,'THREE_SIGNED_INTENTS_REVIEW_ONLY_NOT_AUTHORIZATION');
 assert.equal(r.roleCount,3);
 assert.equal(r.evidenceRefCount,6);
 assert.equal(r.revokeAllowed,false);
 assert.equal(r.hostedWrites,0);
});
test('02 current hosted baseline is NO-GO, live anon RPC still accessible',()=>{
 const v=evaluateHostedReadiness(baseline);
 assert.equal(v.status,'NO_GO');
 assert(v.blockers.includes('ANON_RPC_STILL_PUBLIC'));
 assert(v.blockers.includes('STORE_SCHEMA_AND_OWNER_AUTH_MISSING'));
 assert.equal(v.canRevoke,false);
});
test('03 signed metadata tampering breaks cryptographic signature',async()=>{
 const f=fixture(),p=f.packet();
 p.payload.evidence[0].sha256=hash('malicious-override');
 await assert.rejects(()=>f.api.inspect(p),/RPC4_DETACHED_SIGNATURE_INVALID/);
});
test('04 signed intent cannot be reused',async()=>{
 const f=fixture(),p=f.packet();
 await f.api.inspect(p);
 await assert.rejects(()=>f.api.inspect(p),/RPC4_SIGNED_INTENT_REPLAY_OR_LEDGER_FAILED/);
});
test('05 wrong project and wrong immutable parent SHA denied',async()=>{
 for(const key of ['projectRef','parentSha']){
  const f=fixture(),p=f.payload();p[key]='forged';
  await assert.rejects(()=>f.api.inspect(f.packet(p)),/RPC4_SCOPE_OR_TARGET_DENIED/);
 }
});
test('06 scope cannot be expanded to other functions or role grants',async()=>{
 for(const patch of [
   {targetFunction:'public.another_function()'},
   {operation:'GRANT_ADMIN_ALL'},
   {grantees:['PUBLIC','anon','authenticated']},
   {grantees:['authenticated','anon']},
   {scope:'EXECUTE_REAL_DB_MIGRATION'}
 ]){
  const f=fixture(),p={...f.payload(),...patch};
  await assert.rejects(()=>f.api.inspect(f.packet(p)),/RPC4_SCOPE_OR_TARGET_DENIED/);
 }
});
test('07 controllerDecision APPROVED flag never becomes authority',async()=>{
 const f=fixture(),p=f.payload();p.controllerDecision='APPROVED';
 await assert.rejects(()=>f.api.inspect(f.packet(p)),/RPC4_SCOPE_OR_TARGET_DENIED/);
});
test('08 zero or excessive TTL, expired or future request denied',async()=>{
 for(const patch of [
   {expiresAtMs:NOW-1},{expiresAtMs:NOW+900000},
   {issuedAtMs:NOW+15000},{issuedAtMs:NOW+10000,expiresAtMs:NOW+10000}
 ]){
  const f=fixture(),p={...f.payload(),...patch};
  await assert.rejects(()=>f.api.inspect(f.packet(p)),/RPC4_ONE_TIME_TTL_INVALID/);
 }
});
test('09 missing evidence domain, duplicate source, duplicate reference denied',async()=>{
 const f=fixture(),p=f.payload();p.evidence.pop();
 await assert.rejects(()=>f.api.inspect(f.packet(p)),/RPC4_PRIVATE_EVIDENCE_INCOMPLETE/);
 const g=fixture(),q=g.payload();q.evidence[1].domain=q.evidence[0].domain;
 await assert.rejects(()=>g.api.inspect(g.packet(q)),/RPC4_EVIDENCE_SCHEMA_DENIED/);
 const h=fixture(),u=h.payload();u.evidence[1].ref=u.evidence[0].ref;
 await assert.rejects(()=>h.api.inspect(h.packet(u)),/RPC4_EVIDENCE_SCHEMA_DENIED/);
});
test('10 raw bearer, customer phone or API token fields are structurally forbidden',async()=>{
 const f=fixture(),p=f.payload();
 p.evidence[0].rawJwt='example_sensitive_jwt';
 await assert.rejects(()=>f.api.inspect(f.packet(p)),/RPC4_EVIDENCE_SCHEMA_DENIED/);
 const g=fixture(),q=g.packet();q.payload.api_key='not-allowed';
 await assert.rejects(()=>g.api.inspect(q),/RPC4_SCOPE_OR_TARGET_DENIED/);
});
test('11 no forged single signer can stand in for independent roles',async()=>{
 const f=fixture(),p=f.packet();
 p.signatures[1]={...p.signatures[0]};
 await assert.rejects(()=>f.api.inspect(p),/RPC4_DUPLICATE_OR_MALFORMED_SIGNER/);
});
test('12 wrong signing key or unknown key denied',async()=>{
 const f=fixture(),p=f.packet();p.signatures[0].keyId='EV-UNTRUSTEDKEY0001';
 await assert.rejects(()=>f.api.inspect(p),/RPC4_UNENROLLED_SIGNER_DENIED/);
});
test('13 missing third signature denied',async()=>{
 const f=fixture(),p=f.packet();p.signatures.pop();
 await assert.rejects(()=>f.api.inspect(p),/RPC4_THREE_SIGNERS_REQUIRED/);
});
test('14 role enrollment must be independent and pre-enrolled',()=>{
 assert.throws(()=>createPrivateRevocationIntake(),
   /RPC4_TRUST_ANCHOR_AND_LEDGER_REQUIRED/);
 const f=fixture(),keys=f.pairs.map(p=>({role:p.role,keyId:p.keyId,
   actorDigest:p.actorDigest,publicKey:p.publicKey}));
 keys[1].actorDigest=keys[0].actorDigest;
 assert.throws(()=>createPrivateRevocationIntake({
   mode:'SYNTHETIC_NO_SEND',trustAnchors:keys,
   nonceLedger:{claimOnce:async()=>true}}),/RPC4_INVALID_INDEPENDENT_TRUST_ENROLLMENT/);
});
test('15 self-declared all-green evidence is NOT externally authenticated',async()=>{
 const f=fixture(),p=f.payload();
 p.evidence=p.evidence.map(e=>({...e,independentlyInspected:true,observationCertified:true}));
 const r=await f.api.inspect(f.packet(p));
 assert.deepEqual(r.selfDeclaredEvidenceGaps,[]);
 assert.equal(r.underlyingEvidenceIndependentlyVerified,false);
 assert.equal(r.controllerConsentForRealRevokeVerified,false);
 assert.equal(r.revokeAllowed,false);
});
test('16 forged all-green baseline cannot make the library authorize revoke',()=>{
 const b=structuredClone(baseline);
 b.supabase_rpc.anon_execute=false;
 b.caller_chain.external_callers_independently_certified=true;
 for(const k of ['public_stores_table_exists','public_store_memberships_table_exists',
   'authenticated_real_owner_a_jwt_proof','authenticated_real_owner_b_jwt_proof',
   'same_tenant_cross_store_denial_proof','active_jwt_session_revocation_proof',
   'claim_call_executed_on_hosted','confirm_call_executed_on_hosted'])
   b.hosted_two_step[k]=true;
 for(const k of Object.keys(b.backup))b.backup[k]=true;
 for(const k of Object.keys(b.migration))b.migration[k]=true;
 const r=evaluateHostedReadiness(b);
 assert.equal(r.status,'PENDING_INDEPENDENT_HOSTED_CERTIFICATION');
 assert.equal(r.canRevoke,false);
 assert.equal(r.verifiedExternalSignedAuthority,false);
});
test('17 malformed baseline, arbitrary user flags or wrong project fail closed',()=>{
 for(const b of [null,undefined,{},[],{supabase_project:'wrong'}]){
  const r=evaluateHostedReadiness(b);
  assert.equal(r.status,'NO_GO');
  assert.equal(r.canRevoke,false);
 }
});
test('18 actual operation, SQL and granting authority unavailable in this module',()=>{
 const f=fixture();
 assert.throws(()=>f.api.revoke(),/RPC4_REAL_REVOKE_REQUIRES_EXTERNAL_APPROVAL/);
 assert.throws(()=>f.api.issueAuthority(),/RPC4_AUTHORITY_NOT_IN_THIS_MODULE/);
 assert.throws(()=>f.api.sql(),/RPC4_ARBITRARY_SQL_DISABLED/);
});
test('19 private receipt never outputs signed nonce, signature, digest, raw evidence',async()=>{
 const f=fixture(),p=f.packet(),r=JSON.stringify(await f.api.inspect(p));
 for(const sensitive of [p.payload.nonceHex,p.signatures[0].signatureBase64Url,
   p.payload.evidence[0].sha256])assert(!r.includes(sensitive));
});
test('20 unexpected extra action or backup request on packet is rejected',async()=>{
 const f=fixture(),p=f.packet();p.payload.backupExport=true;
 await assert.rejects(()=>f.api.inspect(p),/RPC4_SCOPE_OR_TARGET_DENIED/);
});
