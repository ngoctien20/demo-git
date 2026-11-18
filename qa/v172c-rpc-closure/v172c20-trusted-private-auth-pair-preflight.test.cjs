'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {canonical}=require('./v172c16-private-ab-consent-admission.cjs');
const {preflight}=require('./v172c20-trusted-private-auth-pair-preflight.cjs');
const now=Date.parse('2026-11-18T06:00:00Z');
const keys=[crypto.generateKeyPairSync('ed25519'),crypto.generateKeyPairSync('ed25519')];
const pem=k=>k.publicKey.export({type:'spki',format:'pem'});
function fixture(){
 const authority={
  environment:'approved-disposable',project:'synthetic-disposable',tenant:'synthetic-t',
  bioProjectRef:'svxkwpmxgnfvewzwsbdt',costApproved:true,restoreDrillVerified:true,
  noSendApproved:true,independentSecurityReview:true,
  expectedStoreRefs:{QA_A:'store-a',QA_B:'store-b'},
  expectedSubjectRefs:{QA_A:'actor-a',QA_B:'actor-b'},
  expectedIssuerRefs:{QA_A:'issuer-a',QA_B:'issuer-b'},
  expectedReviewerRef:'reviewer-independent',
  publicKeys:{QA_A:pem(keys[0]),QA_B:pem(keys[1])},
  revokedReceiptIds:[],usedReceiptIds:[]
 };
 const evidence={};
 const receipts=['QA_A','QA_B'].map((slot,i)=>{
  const subjectRef=i?'actor-b':'actor-a',store=i?'store-b':'store-a';
  evidence[slot]={slotVerified:true,authSessionVerified:true,sessionActive:true,
   identityIndependentlyVerified:true,explicitConsentVerified:true,consentWithdrawn:false,
   ownerStoreBindingVerified:true,scopeVerified:true,subjectRef,storeRef:store,
   sessionEvidenceRef:i?'session-b':'session-a',proofTimestampMs:now-1000};
  const receipt={version:1,slot,receiptId:(i?'b':'a').repeat(32),
   project:authority.project,tenant:authority.tenant,store,subjectRef,issuerRef:i?'issuer-b':'issuer-a',
   scope:'synthetic_catalog_readonly_no_send_no_write',
   issuedAt:'2026-11-18T05:00:00Z',expiresAt:'2026-11-18T07:00:00Z',
   authProofRef:i?'proof-b':'proof-a',consentProofRef:i?'consent-b':'consent-a',
   reviewerRef:'reviewer-independent'};
  receipt.signature=crypto.sign(null,Buffer.from(canonical(receipt)),keys[i].privateKey).toString('base64');
  return receipt;
 });
 return {receipts,evidence,authority,now};
}
const check=make=>preflight(make||fixture());
test('verified synthetic fixture NEVER automatically grants real JWT',()=>assert.equal(check().status,'REVIEW_REQUIRED_NOT_JWT_GO'));
for(const [name,path,value] of [
 ['real staging project',['authority','project'],'ifxlvrhyjhbzbrkdsida'],
 ['bio project',['authority','project'],'svxkwpmxgnfvewzwsbdt'],
 ['missing cost approval',['authority','costApproved'],false],
 ['missing recovery proof',['authority','restoreDrillVerified'],false],
 ['missing no-send',['authority','noSendApproved'],false],
 ['missing independent reviewer',['authority','independentSecurityReview'],false],
 ['unapproved environment',['authority','environment'],'staging'],
 ['unverified A session',['evidence','QA_A','authSessionVerified'],false],
 ['inactive B session',['evidence','QA_B','sessionActive'],false],
 ['withdrawn A consent',['evidence','QA_A','consentWithdrawn'],true],
 ['no B explicit consent',['evidence','QA_B','explicitConsentVerified'],false],
 ['A Store authority failure',['evidence','QA_A','ownerStoreBindingVerified'],false],
 ['B identity failure',['evidence','QA_B','identityIndependentlyVerified'],false],
 ['B session replay',['evidence','QA_B','sessionEvidenceRef'],'session-a'],
 ['same owner',['evidence','QA_B','subjectRef'],'actor-a'],
 ['A wrong store',['evidence','QA_A','storeRef'],'store-b'],
 ['server authority mismatch',['authority','expectedStoreRefs','QA_A'],'other'],
 ['bad receipt key',['receipts',0,'signature'],'AA=='],
 ['revoked receipt',['authority','revokedReceiptIds'],['a'.repeat(32)]],
 ['used receipt',['authority','usedReceiptIds'],['b'.repeat(32)]],
 ['absent trust ledger',['authority','usedReceiptIds'],null],
 ['wrong signer',['authority','expectedIssuerRefs','QA_B'],'unexpected']
]){
 test('DENY '+name,()=>{
  const f=fixture(); let o=f;
  for(const p of path.slice(0,-1))o=o[p];
  o[path.at(-1)]=value;
  assert.equal(check(f).status,'DENY');
 });
}
test('DENY stale private Auth proof',()=>{let f=fixture();f.evidence.QA_A.proofTimestampMs=now-6*60*1000;assert.equal(check(f).status,'DENY');});
test('DENY impossible future private Auth proof',()=>{let f=fixture();f.evidence.QA_B.proofTimestampMs=now+1;assert.equal(check(f).status,'DENY');});
test('DENY null input',()=>assert.equal(preflight().status,'DENY'));
