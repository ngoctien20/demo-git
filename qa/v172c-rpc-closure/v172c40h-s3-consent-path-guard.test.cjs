'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createS3LockedConsentGuard}=require('./v172c40h-s3-consent-path-guard.cjs');

function setup(snapshotFn) {
  const calls=[];
  const backend={
    intake:async x=>{calls.push(['intake',x]);return {status:'SHOULD_NOT_RUN'};},
    reviewPair:async x=>{calls.push(['reviewPair',x]);return {status:'SHOULD_NOT_RUN'};}
  };
  const getCurrentDecision=snapshotFn || (async()=>({
    decision_ref:'synthetic-decision-s3-v1',
    decision_version:1,
    decision:'S3',
    status:'OWNER_DECISION_LOCKED',
    lock_state:'LOCKED',
    authority_effect:'NONE',
    owner_authority_verified:false,
    identity_verified:false,
    real_authority_requested:false
  }));
  return {guard:createS3LockedConsentGuard({getCurrentDecision,backend}),calls};
}

test('S3 lock blocks owner consent before V21 backend is called',async()=>{
  const {guard,calls}=setup();
  const result=await guard.intake({decision:'S1',storeRef:'attacker-store',ownerRef:'attacker'});
  assert.deepEqual(result,{status:'DENY',reason:'OWNER_DECISION_S3_LOCKED'});
  assert.equal(calls.length,0);
});

test('S3 lock blocks independent reviewer path before backend is called',async()=>{
  const {guard,calls}=setup();
  const result=await guard.reviewPair({reviewerRole:'admin',approved:true});
  assert.deepEqual(result,{status:'DENY',reason:'OWNER_DECISION_S3_LOCKED'});
  assert.equal(calls.length,0);
});

test('caller-supplied S1/S2 or authority fields cannot override S3 snapshot',async()=>{
  const {guard,calls}=setup();
  const result=await guard.intake({
    decision:'S2',decision_ref:'client-supplied',decision_version:99,
    authority_effect:'GRANT',owner_authority_verified:true,
    auth_user_id:'attacker',tenant_id:'attacker',store_id:'attacker',
    role:'owner',provider_installation_id:'attacker'
  });
  assert.equal(result.reason,'OWNER_DECISION_S3_LOCKED');
  assert.equal(calls.length,0);
});

test('missing decision snapshot fails closed',async()=>{
  const {guard,calls}=setup(async()=>null);
  assert.equal((await guard.intake()).reason,'OWNER_DECISION_LOCK_UNVERIFIED');
  assert.equal(calls.length,0);
});

test('decision service error fails closed',async()=>{
  const {guard,calls}=setup(async()=>{throw Error('offline');});
  assert.equal((await guard.reviewPair()).reason,'DECISION_SNAPSHOT_UNAVAILABLE');
  assert.equal(calls.length,0);
});

for(const [name,mutate] of [
  ['S2 selected',s=>{s.decision='S2';}],
  ['S1 selected',s=>{s.decision='S1';}],
  ['lock removed',s=>{s.lock_state='UNLOCKED';}],
  ['wrong decision version',s=>{s.decision_version=2;}],
  ['authority effect changed',s=>{s.authority_effect='GRANT';}],
  ['owner authority claimed',s=>{s.owner_authority_verified=true;}],
  ['identity asserted',s=>{s.identity_verified=true;}],
  ['wrong decision reference',s=>{s.decision_ref='other';}],
  ['status not locked',s=>{s.status='OWNER_DECISION_DRAFT';}],
  ['real authority requested',s=>{s.real_authority_requested=true;}]
]) {
  test('DENY tampered snapshot: '+name,async()=>{
    const {guard,calls}=setup(async()=>{
      const s={
        decision_ref:'synthetic-decision-s3-v1',decision_version:1,decision:'S3',
        status:'OWNER_DECISION_LOCKED',lock_state:'LOCKED',authority_effect:'NONE',
        owner_authority_verified:false,identity_verified:false,real_authority_requested:false
      };
      mutate(s);return s;
    });
    assert.equal((await guard.intake()).reason,'OWNER_DECISION_LOCK_UNVERIFIED');
    assert.equal(calls.length,0);
  });
}

test('guard constructor requires trusted decision source and backend adapters',()=>{
  assert.throws(()=>createS3LockedConsentGuard({}),/S3_GUARD_SERVER_ADAPTERS_MISSING/);
  assert.throws(()=>createS3LockedConsentGuard({
    getCurrentDecision:async()=>({}),backend:{intake:async()=>{}}
  }),/S3_GUARD_SERVER_ADAPTERS_MISSING/);
});


test('integration: S3 guard blocks existing V21 backend before trusted adapters run',async()=>{
  const {createPrivateConsentBackend}=require('./v172c21-protected-consent-backend.cjs');
  const calls=[];
  const services={};
  for(const name of ['verifySession','resolveStoreAuthority','verifyConsentChallenge',
    'recordExplicitConsent','getPrivateEvidence','getTrustedAuthority','getSignedReceipts',
    'verifyReviewerSession']) {
    services[name]=async()=>{calls.push(name);return null;};
  }
  const v21=createPrivateConsentBackend(services);
  const {guard}=setup();
  const guarded=createS3LockedConsentGuard({
    getCurrentDecision:async()=>({
      decision_ref:'synthetic-decision-s3-v1',decision_version:1,decision:'S3',
      status:'OWNER_DECISION_LOCKED',lock_state:'LOCKED',authority_effect:'NONE',
      owner_authority_verified:false,identity_verified:false,real_authority_requested:false
    }),
    backend:v21
  });
  const result=await guarded.intake({
    bearer:'Bearer '+ 'x'.repeat(32),
    requestedScope:'synthetic_catalog_readonly_no_send_no_write',
    consentAction:'accept',challenge:'x'.repeat(24)
  });
  assert.equal(result.reason,'OWNER_DECISION_S3_LOCKED');
  assert.deepEqual(calls,[]);
});

test('integration: V24 QA HTTPS handler cannot bypass S3 guard into V21 consent backend',async()=>{
  const {createPrivateConsentBackend}=require('./v172c21-protected-consent-backend.cjs');
  const {createProtectedConsentHttpRoute}=require('./v172c24-private-consent-https-handler.cjs');
  const calls=[];
  const services={};
  for(const name of ['verifySession','resolveStoreAuthority','verifyConsentChallenge',
    'recordExplicitConsent','getPrivateEvidence','getTrustedAuthority','getSignedReceipts',
    'verifyReviewerSession']) {
    services[name]=async()=>{calls.push(name);return null;};
  }
  const v21=createPrivateConsentBackend(services);
  const guard=createS3LockedConsentGuard({
    getCurrentDecision:async()=>({
      decision_ref:'synthetic-decision-s3-v1',decision_version:1,decision:'S3',
      status:'OWNER_DECISION_LOCKED',lock_state:'LOCKED',authority_effect:'NONE',
      owner_authority_verified:false,identity_verified:false,real_authority_requested:false
    }),
    backend:v21
  });
  const origin='https://s3-guard.example.test';
  const route=createProtectedConsentHttpRoute({
    backend:guard,allowedOrigin:origin,
    verifyDeploymentGate:async()=>({approved:true,isolatedDisposable:true,noSend:true,
      recoveryApproved:true,independentReviewerApproved:true}),
    checkRateLimit:async()=>true
  });
  const token='Bearer '+['a'.repeat(30),'b'.repeat(30),'c'.repeat(40)].join('.');
  const request=new Request(origin+'/private/qa-consent/intake',{
    method:'POST',
    headers:{origin,authorization:token,'content-type':'application/json'},
    body:JSON.stringify({requestedScope:'synthetic_catalog_readonly_no_send_no_write',
      consentAction:'accept',challenge:'x'.repeat(24)})
  });
  const response=await route(request);
  assert.equal(response.status,403);
  assert.deepEqual(await response.json(),{status:'DENY'});
  assert.deepEqual(calls,[]);
});

test('integration: V24 reviewer route also remains blocked under S3',async()=>{
  const {createPrivateConsentBackend}=require('./v172c21-protected-consent-backend.cjs');
  const {createProtectedConsentHttpRoute}=require('./v172c24-private-consent-https-handler.cjs');
  const calls=[];
  const services={};
  for(const name of ['verifySession','resolveStoreAuthority','verifyConsentChallenge',
    'recordExplicitConsent','getPrivateEvidence','getTrustedAuthority','getSignedReceipts',
    'verifyReviewerSession']) {
    services[name]=async()=>{calls.push(name);return null;};
  }
  const v21=createPrivateConsentBackend(services);
  const guard=createS3LockedConsentGuard({
    getCurrentDecision:async()=>({
      decision_ref:'synthetic-decision-s3-v1',decision_version:1,decision:'S3',
      status:'OWNER_DECISION_LOCKED',lock_state:'LOCKED',authority_effect:'NONE',
      owner_authority_verified:false,identity_verified:false,real_authority_requested:false
    }),
    backend:v21
  });
  const origin='https://s3-review-guard.example.test';
  const route=createProtectedConsentHttpRoute({
    backend:guard,allowedOrigin:origin,
    verifyDeploymentGate:async()=>({approved:true,isolatedDisposable:true,noSend:true,
      recoveryApproved:true,independentReviewerApproved:true}),
    checkRateLimit:async()=>true
  });
  const token='Bearer '+['d'.repeat(30),'e'.repeat(30),'f'.repeat(40)].join('.');
  const request=new Request(origin+'/private/qa-consent/review-pair',{
    method:'POST',
    headers:{origin,authorization:token,'content-type':'application/json'},
    body:'{}'
  });
  const response=await route(request);
  assert.equal(response.status,403);
  assert.deepEqual(await response.json(),{status:'DENY'});
  assert.deepEqual(calls,[]);
});

test('guard response is redacted and contains no owner or Store identifiers',async()=>{
  const {guard}=setup();
  const result=await guard.intake({jwt:'do-not-return',email:'private@example.invalid',store_id:'private'});
  assert.deepEqual(Object.keys(result).sort(),['reason','status']);
  assert.equal(JSON.stringify(result).includes('private@example.invalid'),false);
  assert.equal(JSON.stringify(result).includes('do-not-return'),false);
});

test('guard methods are frozen and cannot be replaced by caller',()=>{
  const {guard}=setup();
  assert.equal(Object.isFrozen(guard),true);
});

