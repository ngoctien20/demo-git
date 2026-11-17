import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign as rsaSign} from 'node:crypto';
import {verifyPrivateOperatorAdmission,reviewPrivateOperatorAndReservePermit,hashPermit} from './hosted4b3-private-operator-admission.mjs';
const pair=generateKeyPairSync('rsa',{modulusLength:2048});
const now=Date.parse('2026-11-17T10:00:00.000Z'),seconds=now/1000;
const p={deployment_operator_email:'operator@example.com',nonce:'a'.repeat(32),
 worker_name:'tien404-v174p-private-qa-issuer'};
const trust=()=>({
 source:'PRIVATE_IDENTITY_BROKER_OUT_OF_BAND',independent_operator_registry_verified:true,
 kid:'synthetic-private-broker-k1',spki_pem:pair.publicKey.export({format:'pem',type:'spki'}),
 issuer:'https://qa-identity.example.com',audience:'t404-private-qa-admission',
 authorized_operator_subject:'qa-test-operator-0001',authorized_operator_email:'operator@example.com'
});
const base=()=>({
 iss:'https://qa-identity.example.com',aud:'t404-private-qa-admission',
 sub:'qa-test-operator-0001',email:'operator@example.com',email_verified:true,
 role:'qa_deployment_operator',scope:'t404:qa:inactive-first-upload',
 iat:seconds-20,nbf:seconds-20,exp:seconds+180,auth_time:seconds-30,
 amr:['password','mfa'],permit_sha256:hashPermit(p)
});
function issue(payload=base(),header={alg:'RS256',kid:'synthetic-private-broker-k1'}){
 const h=Buffer.from(JSON.stringify(header)).toString('base64url');
 const c=Buffer.from(JSON.stringify(payload)).toString('base64url');
 const sig=rsaSign('RSA-SHA256',Buffer.from(h+'.'+c),pair.privateKey).toString('base64url');
 return h+'.'+c+'.'+sig;
}
const verify=(token=issue(),t=trust(),permit=p)=>verifyPrivateOperatorAdmission({
 jwt:token,trustConfig:t,permit,now});
const blocked=(mutation,reason)=>{
 const c=base(),h={alg:'RS256',kid:'synthetic-private-broker-k1'},t=trust();
 mutation(c,h,t);
 const result=verify(issue(c,h),t);
 assert.equal(result.state,'BLOCKED_OPERATOR_IDENTITY');
 assert.equal(result.reason,reason);
 assert.equal(result.can_upload,false);
};
test('01 valid synthetic broker RS256 identity is REVIEW-ONLY, never real owner admission',()=>{
 const r=verify();assert.equal(r.identity_admitted_for_private_review,true);
 assert.equal(r.real_identity_independently_proven,false);
 assert.equal(r.can_upload,false);assert.equal(r.can_modify_cloudflare,false);
 assert.match(r.operator_subject_hash,/^[a-f0-9]{64}$/);
});
test('02 missing JWT denied',()=>assert.equal(verifyPrivateOperatorAdmission({now}).can_upload,false));
test('03 forged RS256 signature denied',()=>{
 const t=issue().split('.');t[2]=(t[2].startsWith('A')?'B':'A')+t[2].slice(1);
 assert.equal(verify(t.join('.')).reason,'JWT_SIGNATURE_INVALID');
});
test('04 alg none denied even with RSA signature',()=>blocked((c,h)=>{h.alg='none'},'JWT_ALGORITHM_OR_KEY_INJECTION'));
test('05 kid mismatch denied',()=>blocked((c,h)=>{h.kid='attacker-kid'},'NO_INDEPENDENT_BROKER_TRUST'));
test('06 header jwk injection denied',()=>blocked((c,h)=>{h.jwk={kty:'RSA'}},'JWT_ALGORITHM_OR_KEY_INJECTION'));
test('07 JWT issuer mismatch denied',()=>blocked(c=>{c.iss='https://phishing.example.com'},'JWT_ISSUER_OR_AUDIENCE'));
test('08 JWT audience mismatch denied',()=>blocked(c=>{c.aud='other-audience'},'JWT_ISSUER_OR_AUDIENCE'));
test('09 expired JWT denied',()=>blocked(c=>{c.exp=seconds-1},'JWT_EXPIRED_STALE_OR_FUTURE'));
test('10 future nbf denied',()=>blocked(c=>{c.nbf=seconds+30},'JWT_EXPIRED_STALE_OR_FUTURE'));
test('11 stale MFA authentication denied',()=>blocked(c=>{c.auth_time=seconds-301},'JWT_EXPIRED_STALE_OR_FUTURE'));
test('12 token life above five minutes denied',()=>blocked(c=>{c.exp=seconds+600},'JWT_EXPIRED_STALE_OR_FUTURE'));
test('13 missing mfa denied',()=>blocked(c=>{c.amr=['password']},'OPERATOR_SUBJECT_ROLE_MFA_OR_SCOPE'));
test('14 impersonated subject denied',()=>blocked(c=>{c.sub='attacker'},'OPERATOR_SUBJECT_ROLE_MFA_OR_SCOPE'));
test('15 changed email denied',()=>blocked(c=>{c.email='other@example.com'},'OPERATOR_SUBJECT_ROLE_MFA_OR_SCOPE'));
test('16 unverified email denied',()=>blocked(c=>{c.email_verified=false},'OPERATOR_SUBJECT_ROLE_MFA_OR_SCOPE'));
test('17 wrong operator role denied',()=>blocked(c=>{c.role='admin'},'OPERATOR_SUBJECT_ROLE_MFA_OR_SCOPE'));
test('18 excess provider/Commerce scope denied',()=>blocked(c=>{c.scope='t404:commerce:write'},'OPERATOR_SUBJECT_ROLE_MFA_OR_SCOPE'));
test('19 signed JWT bound to different permit denied',()=>blocked(c=>{c.permit_sha256='e'.repeat(64)},'OPERATOR_NOT_BOUND_TO_SIGNED_PERMIT'));
test('20 no independent registry flag denied',()=>blocked((c,h,t)=>{t.independent_operator_registry_verified=false},'NO_INDEPENDENT_BROKER_TRUST'));
test('21 attacker public key mismatch denied',()=>{
 const t=trust(),attacker=generateKeyPairSync('rsa',{modulusLength:2048});
 t.spki_pem=attacker.publicKey.export({format:'pem',type:'spki'});
 assert.equal(verify(issue(),t).reason,'JWT_SIGNATURE_INVALID');
});
test('22 bearer JWT attached to changed permit denied',()=>{
 assert.equal(verify(issue(),trust(),{...p,nonce:'f'.repeat(32)}).reason,'OPERATOR_NOT_BOUND_TO_SIGNED_PERMIT');
});
test('23 unsupported noncanonical base64url encoding denied',()=>{
 const t=issue().split('.');t[2]+='=';assert.equal(verify(t.join('.')).reason,'JWT_PARSE_OR_CANONICALIZATION');
});
test('24 missing signed permit prevents claiming ledger',async()=>{
 let called=false;
 const result=await reviewPrivateOperatorAndReservePermit({
  operatorJwt:issue(),trustConfig:trust(),evidence:{permit:{...p,nonce:'wrong'}},
  privateLedger:{claimOnce:async()=>{called=true;return {claimed:true}}},
  getFreshInventory:async()=>{called=true;return null},now
 });
 assert.equal(result.permit_ledger_attempted,false);
 assert.equal(called,false);
});
test('25 valid JWT alone cannot bypass missing owner signatures or claim ledger',async()=>{
 let called=false;
 const result=await reviewPrivateOperatorAndReservePermit({
  operatorJwt:issue(),trustConfig:trust(),evidence:{permit:p},
  privateLedger:{claimOnce:async()=>{called=true;return {claimed:true}}},
  getFreshInventory:async()=>{called=true;return null},now
 });
 assert.equal(result.status,'BLOCKED_PERMIT_PREFLIGHT');
 assert.equal(called,false);
 assert.equal(result.can_upload,false);
});
