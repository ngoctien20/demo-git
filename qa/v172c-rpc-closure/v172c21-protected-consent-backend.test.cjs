'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createPrivateConsentBackend}=require('./v172c21-protected-consent-backend.cjs');
const token='Bearer '+'x'.repeat(32);
const scope='synthetic_catalog_readonly_no_send_no_write';
const accepted={bearer:token,requestedScope:scope,consentAction:'accept',challenge:'a'.repeat(24)};
function setup(overrides={}){
 const calls=[];
 const services={
  verifySession:async t=>{calls.push(['verifySession',t]);return {verified:true,active:true,
    sessionIdVerified:true,sessionEvidenceRef:'opaque-private',subjectRef:'actor-a',
    expiresAtMs:Date.now()+60000};},
  resolveStoreAuthority:async subject=>{calls.push(['resolveStoreAuthority',subject]);
    return {active:true,ownerVerified:true,tenantRef:'synthetic',storeRef:'A',slot:'QA_A'};},
  verifyConsentChallenge:async x=>{calls.push(['verifyConsentChallenge',x]);return {verified:true,singleUseConsumed:true,consentIntentVerified:true};},
  recordExplicitConsent:async x=>{calls.push(['recordExplicitConsent',x]);
    return {persisted:true,verifiedProvenance:true,consentEvidenceRef:'opaque-private'};},
  getTrustedAuthority:async()=>null,getPrivateEvidence:async()=>null,
  getSignedReceipts:async()=>null,
  verifyReviewerSession:async()=>({verified:true,active:true,independent:true,role:'independent_security_reviewer',sessionIdVerified:true,expiresAtMs:Date.now()+60000,subjectRef:'reviewer'}),
  ...overrides
 };
 return {api:createPrivateConsentBackend(services),calls};
}
test('valid synthetic server intake records only scoped consent not JWT GO',async()=>{
 const {api,calls}=setup();const x=await api.intake(accepted);
 assert.deepEqual(x,{status:'PRIVATE_CONSENT_RECORDED_NOT_UAT_GO',slot:'QA_A'});
 assert.equal(calls.length,4);
 assert.equal(calls[3][1].subjectRef,'actor-a');
 assert.equal(calls[3][1].storeRef,'A');
 assert.equal(JSON.stringify(x).includes('Bearer'),false);
});
for(const [n,input] of [
 ['no bearer',{requestedScope:scope}],
 ['wrong scope',{...accepted,requestedScope:'order-write'}],
 ['no explicit action',{bearer:token,requestedScope:scope,challenge:'a'.repeat(24)}],
 ['missing challenge',{bearer:token,requestedScope:scope,consentAction:'accept'}],
 ['short token',{bearer:'Bearer x',requestedScope:scope}],
 ['user fields alone',{subjectRef:'attacker',storeRef:'B',requestedScope:scope}]
])test('DENY '+n+' before server auth',async()=>{
 const {api,calls}=setup();const x=await api.intake(input);
 assert.equal(x.status,'DENY');assert.equal(calls.length,0);
});
for(const [name,fn] of [
 ['unverified session',()=>({verifySession:async()=>({verified:false})})],
 ['expired session',()=>({verifySession:async()=>({verified:true,active:true,sessionIdVerified:true,
   subjectRef:'a',sessionEvidenceRef:'e',expiresAtMs:1})})],
 ['unverified session id',()=>({verifySession:async()=>({verified:true,active:true,
   sessionIdVerified:false,subjectRef:'a',sessionEvidenceRef:'e',expiresAtMs:Date.now()+100000})})],
 ['untrusted Store binding',()=>({resolveStoreAuthority:async()=>({active:true,ownerVerified:false,slot:'QA_A'})})],
 ['invalid actor slot',()=>({resolveStoreAuthority:async()=>({active:true,ownerVerified:true,slot:'QA_C',
   tenantRef:'t',storeRef:'s'})})],
 ['consent not persisted',()=>({recordExplicitConsent:async()=>({persisted:false})})],
 ['unverified challenge',()=>({verifyConsentChallenge:async()=>({verified:false})})],
 ['replayed challenge',()=>({verifyConsentChallenge:async()=>({verified:true,singleUseConsumed:false,consentIntentVerified:true})})],
 ['Auth service throws',()=>({verifySession:async()=>{throw Error('offline')}})]
])test('DENY '+name,async()=>{const {api}=setup(fn());assert.equal((await api.intake(accepted)).status,'DENY');});
test('untrusted client fields never replace server authority',async()=>{
 const {api,calls}=setup();
 const ret=await api.intake({...accepted,subjectRef:'evil',storeRef:'evil',tenantRef:'evil',slot:'QA_B'});
 assert.equal(ret.slot,'QA_A');assert.equal(calls[3][1].storeRef,'A');
});
test('reviewPair denies absent reviewer bearer before reading evidence',async()=>{
 const {api,calls}=setup();const x=await api.reviewPair();
 assert.equal(x.status,'DENY');assert.equal(calls.length,0);
});
test('reviewPair denies missing private authority after reviewer auth',async()=>{
 const {api}=setup();assert.equal((await api.reviewPair({reviewerBearer:token})).status,'DENY');
});
test('constructor refuses incomplete adapters',()=>{
 assert.throws(()=>createPrivateConsentBackend({verifySession:()=>{}}),/MISSING_TRUSTED_SERVER_ADAPTERS/);
});

test('invalid challenge stops before session verification',async()=>{const {api,calls}=setup();assert.equal((await api.intake({...accepted,challenge:'short'})).status,'DENY');assert.equal(calls.length,0);});

test('DENY session expiry undefined (NaN bypass regression)',async()=>{
 const {api}=setup({verifySession:async()=>({verified:true,active:true,sessionIdVerified:true,
 sessionEvidenceRef:'opaque',subjectRef:'actor-a'})});
 assert.equal((await api.intake(accepted)).reason,'SESSION_NOT_VERIFIED');
});
test('DENY session expiry NaN',async()=>{
 const {api}=setup({verifySession:async()=>({verified:true,active:true,sessionIdVerified:true,
 sessionEvidenceRef:'opaque',subjectRef:'actor-a',expiresAtMs:NaN})});
 assert.equal((await api.intake(accepted)).reason,'SESSION_NOT_VERIFIED');
});
test('DENY reviewer without required role',async()=>{
 const {api}=setup({verifyReviewerSession:async()=>({verified:true,active:true,independent:true,
 sessionIdVerified:true,role:'merchant_owner',subjectRef:'person',expiresAtMs:Date.now()+10000})});
 assert.equal((await api.reviewPair({reviewerBearer:token})).reason,'REVIEWER_NOT_AUTHORIZED');
});
test('DENY expired reviewer session',async()=>{
 const {api}=setup({verifyReviewerSession:async()=>({verified:true,active:true,independent:true,
 sessionIdVerified:true,role:'independent_security_reviewer',subjectRef:'person',expiresAtMs:1})});
 assert.equal((await api.reviewPair({reviewerBearer:token})).reason,'REVIEWER_NOT_AUTHORIZED');
});
test('DENY reviewer who is also Actor A',async()=>{
 const {api}=setup({
  getPrivateEvidence:async()=>({QA_A:{subjectRef:'actor-a'},QA_B:{subjectRef:'actor-b'}}),
  getTrustedAuthority:async()=>({project:'dummy'}),
  getSignedReceipts:async()=>[{},{},],
  verifyReviewerSession:async()=>({verified:true,active:true,independent:true,
   sessionIdVerified:true,role:'independent_security_reviewer',subjectRef:'actor-a',expiresAtMs:Date.now()+10000})
 });
 assert.equal((await api.reviewPair({reviewerBearer:token})).reason,'REVIEWER_NOT_INDEPENDENT');
});
