// TIEN404 P0R: deliberately SYNTHETIC adapter tests. No JWT, user data, hosted network or writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createCandidateVerifier} from './server-auth-verifier-admission.mjs';
const tenant='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const owners=['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'];
const sessions=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
const pair='qa_private_pair_01234567',consents=['consent_alpha_01234567','consent_bravo_01234567'];
const bearer=['SYNTHETIC_NO_REAL_JWT_ACTOR_A_0001','SYNTHETIC_NO_REAL_JWT_ACTOR_B_0002'];
const assertions=['SYNTHETIC_SIGNED_ACCESS_A','SYNTHETIC_SIGNED_ACCESS_B'];
const issuer='https://synthetic.example.supabase.co/auth/v1',accessIssuer='https://synthetic-access.invalid';
const now=1800000000;
function setup() {
  const state={
    access:owners.map((_,i)=>({signatureVerified:true,issuer:accessIssuer,audience:'tien404-private-qa',
      expiresAt:now+300,principalId:'private-access-actor-'+i})),
    bindings:owners.map((userId)=>({active:true,authUserId:userId})),
    claims:owners.map((sub,i)=>({signatureVerified:true,iss:issuer,aud:'authenticated',role:'authenticated',
      sub,session_id:sessions[i],iat:now-50,exp:now+300,is_anonymous:false})),
    users:owners.map(id=>({verified:true,id,disabled:false})),
    sessions:owners.map((userId,i)=>({exists:true,revoked:false,id:sessions[i],userId,expiresAt:now+600})),
    members:owners.map(userId=>({active:true,userId,tenantId:tenant,role:'owner'})),
    consents:owners.map((userId,i)=>({verified:true,approvedByOwner:true,used:false,userId,
      pairingHandle:pair,scope:'read_only_identity',expiresAt:now+200}))
  };
  const pos=(input,keys)=>keys.indexOf(input);
  const ports={
    verifyProtectedAccess:async assertion=>state.access[pos(assertion,assertions)],
    getTrustedAccessBinding:async principal=>state.bindings[pos(principal,state.access.map(x=>x.principalId))],
    verifySignedClaims:async token=>state.claims[pos(token,bearer)],
    fetchLiveAuthUser:async token=>state.users[pos(token,bearer)],
    lookupCurrentAuthSession:async id=>state.sessions.find(x=>x.id===id),
    lookupCurrentOwnerMembership:async (t,u)=>state.members.find(x=>x.tenantId===t&&x.userId===u),
    lookupIndependentConsent:async (handle,u,p)=>state.consents[
      pos(handle,consents)]?.userId===u&&p===pair?state.consents[pos(handle,consents)]:undefined
  };
  const verifier=createCandidateVerifier({ports,issuer,accessIssuer,
    accessAudience:'tien404-private-qa',tenantScope:tenant,nowSeconds:()=>now});
  const args=i=>({bearer:bearer[i],accessAssertion:assertions[i],
    consentHandle:consents[i],pairingHandle:pair});
  const admit=i=>verifier.admitActor(args(i));
  return {state,verifier,args,admit};
}
async function expectDenied(callback,code) {
  await assert.rejects(callback,e=>e?.name==='AdmissionDenied'&&e.code===code);
}
test('P0R synthetic pair correlation: opaque handles and zero Store/send grants',async()=>{
  const q=setup(),a=await q.admit(0),b=await q.admit(1);
  assert.deepEqual(Object.keys(a),[]);
  assert.deepEqual(Object.keys(b),[]);
  const result=await q.verifier.correlatePair(a,b);
  assert.equal(result.status,'IN_MEMORY_PAIR_CORRELATION_CANDIDATE');
  for(const k of ['serverPortsLiveVerified','signedReceiptIssued','storeAuthorityVerified',
    'storeReadAuthorized','orderAccessAuthorized','providerSendAuthorized','productionApproved'])
    assert.equal(result[k],false,k);
  assert.equal(Object.values(result).some(v=>typeof v==='string'&&v.includes(owners[0])),false);
});
test('default deny without audited backend ports',()=>expectDenied(
  ()=>Promise.resolve(createCandidateVerifier({issuer,tenantScope:tenant})),
  'VERIFIER_NOT_CONFIGURED'));
test('reject unprotected or forged Access proof',async()=>{
  const q=setup();q.state.access[0].signatureVerified=false;
  await expectDenied(()=>q.admit(0),'PRIVATE_ACCESS_DENIED');
});
test('reject wrong Access issuer',async()=>{
  const q=setup();q.state.access[0].issuer='https://wrong.invalid';
  await expectDenied(()=>q.admit(0),'PRIVATE_ACCESS_DENIED');
});
test('reject missing trusted Access to Auth identity binding',async()=>{
  const q=setup();q.state.bindings[0].active=false;
  await expectDenied(()=>q.admit(0),'ACCESS_OWNER_BINDING_DENIED');
});
test('reject unverifiable JWT signature',async()=>{
  const q=setup();q.state.claims[0].signatureVerified=false;
  await expectDenied(()=>q.admit(0),'SIGNED_CLAIMS_DENIED');
});
test('reject mismatched issuer / audience',async()=>{
  for(const field of ['iss','aud']){
    const q=setup();q.state.claims[0][field]='WRONG';
    await expectDenied(()=>q.admit(0),'SIGNED_CLAIMS_DENIED');
  }
});
test('reject expired JWT, missing session id, user-editable anonymous claim',async()=>{
  for(const edit of [s=>{s.exp=now-1;},s=>{delete s.session_id;},
    s=>{s.is_anonymous=true;}]) {
    const q=setup();edit(q.state.claims[0]);
    await expectDenied(()=>q.admit(0),'SIGNED_CLAIMS_DENIED');
  }
});
test('reject live getUser mismatch',async()=>{
  const q=setup();q.state.users[0].id=owners[1];
  await expectDenied(()=>q.admit(0),'LIVE_AUTH_USER_DENIED');
});
test('reject missing/ revoked Auth session',async()=>{
  for(const change of [s=>{s.exists=false;},s=>{s.revoked=true;},
    s=>{s.userId=owners[1];}]){
    const q=setup();change(q.state.sessions[0]);
    await expectDenied(()=>q.admit(0),'SESSION_REVOKED_OR_MISMATCHED');
  }
});
test('reject membership outside pinned tenant / inactive / non-owner',async()=>{
  for(const change of [m=>{m.tenantId=owners[0];},m=>{m.active=false;},m=>{m.role='manager';}]){
    const q=setup();change(q.state.members[0]);
    await expectDenied(()=>q.admit(0),'TENANT_OWNER_DENIED');
  }
});
test('reject missing, used, unapproved or expired independent consent',async()=>{
  for(const change of [c=>{c.used=true;},c=>{c.approvedByOwner=false;},
    c=>{c.expiresAt=now-1;},c=>{c.scope='store_write';}]){
    const q=setup();change(q.state.consents[0]);
    await expectDenied(()=>q.admit(0),'OWNER_CONSENT_DENIED');
  }
});
test('reject forged pair handles and empty bearer',async()=>{
  const q=setup();
  await expectDenied(()=>q.verifier.admitActor({...q.args(0),pairingHandle:'invalid'}),
    'INPUT_NOT_ADMISSIBLE');
  await expectDenied(()=>q.verifier.admitActor({...q.args(0),bearer:''}),
    'INPUT_NOT_ADMISSIBLE');
});
test('reject arbitrary caller-supplied evidence objects',async()=>{
  const q=setup(),a=await q.admit(0);
  await expectDenied(()=>q.verifier.correlatePair(a,Object.freeze({})),
    'PAIR_EVIDENCE_UNTRUSTED');
});
test('reject same actor submitted twice',async()=>{
  const q=setup(),a=await q.admit(0),other=await q.admit(0);
  await expectDenied(()=>q.verifier.correlatePair(a,other),'PAIR_NOT_INDEPENDENT');
});
test('reject a pair from different challenges',async()=>{
  const q=setup(),a=await q.admit(0);
  q.state.consents[1].pairingHandle='other_pairing_0123456789';
  const args={...q.args(1),pairingHandle:'other_pairing_0123456789'};
  const b=await q.verifier.admitActor(args);
  await expectDenied(()=>q.verifier.correlatePair(a,b),'PAIR_SCOPE_MISMATCH');
});
test('re-check revocation at correlation time, not just first token admission',async()=>{
  const q=setup(),a=await q.admit(0),b=await q.admit(1);
  q.state.sessions[1].revoked=true;
  await expectDenied(()=>q.verifier.correlatePair(a,b),'PAIR_SESSION_REVOKED');
});
test('re-check owner loss at correlation time',async()=>{
  const q=setup(),a=await q.admit(0),b=await q.admit(1);
  q.state.members[1].active=false;
  await expectDenied(()=>q.verifier.correlatePair(a,b),'PAIR_OWNER_REVOKED');
});
test('re-check consent revocation at correlation time',async()=>{
  const q=setup(),a=await q.admit(0),b=await q.admit(1);
  q.state.consents[0].used=true;
  await expectDenied(()=>q.verifier.correlatePair(a,b),'PAIR_CONSENT_REVOKED');
});
test('Access actor A cannot reuse actor B JWT',async()=>{
  const q=setup();
  await expectDenied(()=>q.verifier.admitActor({...q.args(0),bearer:bearer[1]}),
    'SIGNED_CLAIMS_DENIED');
});
