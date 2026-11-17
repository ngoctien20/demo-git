'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {canonical,validate}=require('./v172c16-private-ab-consent-admission.cjs');
// Synthetic in-memory keys and actors. No private identity, real Supabase Auth,
// external calls, persisted receipts or actual consent.
const now=Date.parse('2026-11-18T06:00:00Z');
const keyA=crypto.generateKeyPairSync('ed25519');
const keyB=crypto.generateKeyPairSync('ed25519');
const pub=x=>x.publicKey.export({type:'spki',format:'pem'});
const trust={
 project:'disposable-project-only',tenant:'synthetic-tenant',
 publicKeys:{QA_A:pub(keyA),QA_B:pub(keyB)},
 expectedIssuerRefs:{QA_A:'synthetic-issuer-a',QA_B:'synthetic-issuer-b'},
 expectedSubjectRefs:{QA_A:'opaque-synthetic-a',QA_B:'opaque-synthetic-b'},
 releaseApproved:true,recoveryApproved:true,disposableApproved:true,
 reviewerApproved:true,privateActorSessionBindingVerified:true,
 independentConsentAudited:true
};
function mk(slot){
 const isA=slot==='QA_A';
 const r={
  version:1,slot,project:trust.project,tenant:trust.tenant,
  store:isA?'test-store-a':'test-store-b',
  subjectRef:isA?'opaque-synthetic-a':'opaque-synthetic-b',
  issuerRef:isA?'synthetic-issuer-a':'synthetic-issuer-b',
  scope:'synthetic_catalog_readonly_no_send_no_write',
  issuedAt:'2026-11-18T05:00:00Z',expiresAt:'2026-11-18T07:00:00Z',
  authProofRef:isA?'private-auth-ref-a':'private-auth-ref-b',
  consentProofRef:isA?'private-consent-a':'private-consent-b',
  reviewerRef:'private-reviewer-ref'
 };
 r.signature=crypto.sign(null,Buffer.from(canonical(r)),isA?keyA.privateKey:keyB.privateKey).toString('base64');
 return r;
}
const pair=()=>({receipts:[mk('QA_A'),mk('QA_B')]});
const check=(p=pair(),t=trust)=>validate(p,t,now);
test('even two verified simulated signatures NEVER automatically grant real JWT GO',()=>{
 assert.equal(check().status,'REVIEW_REQUIRED_NOT_JWT_GO');
});
const scenarios=[
 ['missing receipts',()=>({receipts:[]})],
 ['null receipt',()=>({receipts:[null,mk('QA_B')]})],
 ['same actor slot',()=>{let p=pair();p.receipts[1]={...p.receipts[0]};return p;}],
 ['same Store',()=>{let p=pair();p.receipts[1].store=p.receipts[0].store;return p;}],
 ['same Auth subject',()=>{let p=pair();p.receipts[1].subjectRef=p.receipts[0].subjectRef;return p;}],
 ['same issuer',()=>{let p=pair();p.receipts[1].issuerRef=p.receipts[0].issuerRef;return p;}],
 ['cross tenant',()=>{let p=pair();p.receipts[1].tenant='forged-tenant';return p;}],
 ['cross project',()=>{let p=pair();p.receipts[1].project='staging';return p;}],
 ['scope escalation',()=>{let p=pair();p.receipts[0].scope='order-write';return p;}],
 ['expired receipt',()=>{let p=pair();p.receipts[0].expiresAt='2026-11-18T05:00:01Z';return p;}],
 ['tampered signature',()=>{let p=pair();p.receipts[0].signature='AA==';return p;}],
 ['missing private proof',()=>{let p=pair();p.receipts[1].authProofRef='';return p;}]
];
for(const [name,fn] of scenarios)test('DENY '+name,()=>assert.equal(check(fn()).status,'DENY'));
for(const [name,key] of [
 ['founder release approval','releaseApproved'],
 ['recovery approval','recoveryApproved'],
 ['disposable approval','disposableApproved'],
 ['reviewer approval','reviewerApproved'],
 ['actual Auth session binding','privateActorSessionBindingVerified'],
 ['actual independent consent audit','independentConsentAudited']
])test('DENY missing '+name,()=>assert.equal(check(pair(),{...trust,[key]:false}).status,'DENY'));
test('DENY untrusted replacement public key',()=>{
 const fake=crypto.generateKeyPairSync('ed25519');
 assert.equal(check(pair(),{...trust,publicKeys:{...trust.publicKeys,QA_A:pub(fake)}}).status,'DENY');
});
test('DENY zero trust config',()=>assert.equal(validate(pair(),null,now).status,'DENY'));

test('DENY same pinned issuer key for both slots',()=>assert.equal(check(pair(),{...trust,publicKeys:{QA_A:pub(keyA),QA_B:pub(keyA)}}).status,'DENY'));
test('DENY different private trusted Auth subject mapping',()=>assert.equal(check(pair(),{...trust,expectedSubjectRefs:{...trust.expectedSubjectRefs,QA_B:'unexpected-subject'}}).status,'DENY'));
