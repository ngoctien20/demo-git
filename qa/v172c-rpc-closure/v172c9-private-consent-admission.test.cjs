'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
// PURE synthetic admission contract — no network, credentials, real consent or JWT.
// A passing test MUST NEVER be promoted to hosted JWT proof.
const valid={
  founderScopeApproved:true, qaOnly:true, noSend:true, noOrderWrite:true,
  recoveryReviewed:true, independentReviewerApproved:true,
  project:'isolated-qa', tenant:'synthetic-t',
  a:{subjectRef:'qa-a',store:'store-a',consented:true,authenticatedPrivately:true,expiresInFuture:true,revoked:false},
  b:{subjectRef:'qa-b',store:'store-b',consented:true,authenticatedPrivately:true,expiresInFuture:true,revoked:false},
  canonicalStoreRlsReady:true,knownSyntheticRows:true,realJwtPrivateProofReady:true
};
function evaluate(x){
  if(!x.founderScopeApproved||!x.qaOnly||!x.noSend||!x.noOrderWrite||!x.recoveryReviewed||!x.independentReviewerApproved)return 'NO_GO';
  if(!x.project||!x.tenant||!x.canonicalStoreRlsReady||!x.knownSyntheticRows||!x.realJwtPrivateProofReady)return 'NO_GO';
  const a=x.a,b=x.b;
  if(!a||!b||a.subjectRef===b.subjectRef||a.store===b.store||!a.store||!b.store)return 'NO_GO';
  if([a,b].some(v=>!v.consented||!v.authenticatedPrivately||!v.expiresInFuture||v.revoked))return 'NO_GO';
  return 'REVIEW_ONLY_NOT_AUTOMATIC_GO';
}
test('fully staged fixture never grants automatic GO',()=>assert.equal(evaluate(valid),'REVIEW_ONLY_NOT_AUTOMATIC_GO'));
const variants=[
  ['missing founder scope',{founderScopeApproved:false}],
  ['no recovery',{recoveryReviewed:false}],
  ['same account',{b:{...valid.b,subjectRef:valid.a.subjectRef}}],
  ['same Store',{b:{...valid.b,store:valid.a.store}}],
  ['missing A consent',{a:{...valid.a,consented:false}}],
  ['missing B consent',{b:{...valid.b,consented:false}}],
  ['not privately authenticated',{b:{...valid.b,authenticatedPrivately:false}}],
  ['revoked A consent',{a:{...valid.a,revoked:true}}],
  ['expired B consent',{b:{...valid.b,expiresInFuture:false}}],
  ['no independent reviewer',{independentReviewerApproved:false}],
  ['live sends enabled',{noSend:false}],
  ['order writes enabled',{noOrderWrite:false}],
  ['missing canonical RLS',{canonicalStoreRlsReady:false}],
  ['missing fixtures',{knownSyntheticRows:false}],
  ['no private real JWT evidence',{realJwtPrivateProofReady:false}],
  ['not QA isolated',{qaOnly:false}]
];
for(const [name,change] of variants) test('deny: '+name,()=>{
 assert.equal(evaluate({...valid,...change}),'NO_GO');
});
