'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createPrivateWorkerSecurityGate}=require('./private-worker-security-gate.cjs');
const NOW=Date.parse('2026-11-17T12:30:00Z');
const PROJECT='ifxlvrhyjhbzbrkdsida',SHA='b'.repeat(40);
const AR='audit_'+'A'.repeat(28),QR='qaplan_'+'Q'.repeat(28),NN='qa_'+'N'.repeat(28);
const ROLES=['INFRA_SECURITY','AUTH_RLS_INDEPENDENT'];
const clone=x=>JSON.parse(JSON.stringify(x));
function canonical(x){
 if(x===null||typeof x==='string'||typeof x==='boolean'||typeof x==='number')return JSON.stringify(x);
 if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';
 return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';
}
const digest=x=>crypto.createHash('sha256').update(canonical(x)).digest('hex');
function fixture(overrides={}){
 const pairs={},reviewers={},nonces=overrides.sharedNonces||new Set();
 for(const [i,role] of ROLES.entries()){
  const pair=crypto.generateKeyPairSync('ed25519');pairs[role]=pair;
  reviewers[role]={active:true,role,kid:'QA_KID_'+role,
   signerRef:'QA_PRIVATE_SIGNER_'+i,enrollment:'INDEPENDENT_PRIVATE_REVIEWER',
   publicJwk:pair.publicKey.export({format:'jwk'})};
 }
 const snapshot={
  ref:AR,schema:'TIEN404_V171W_WORKER_R2_OBSERVATION_V1',
  projectRef:PROJECT,commitSha:SHA,collectedAtMs:NOW-2000,
  worker:{name:'tien404-rpc16-merchant-evidence-inactive-staging',exists:true,
   workersDevEnabled:false,previewsEnabled:false,customDomains:0,r2Binding:true},
  access:{name:'TIEN404 RPC16 Merchant Evidence Staging — DENY ALL',
   exists:true,policies:0,externalDenyProbe:false},
  r2:{name:'tien404-merchant-evidence-quarantine-staging',exists:true,
   managedPublic:false,customDomains:0,objectDeletionPolicyAttested:false,
   lockRuleCount:0,malwareScannerAttested:false,cdrAttested:false,
   objectVersionProofAttested:false},
  replay:{namespaceCount:3,workerBindingAttested:false,atomicReplayTestAttested:false},
  auth:{sameTenantTwoStoreOwnerPairs:0,sameTenantSessionPairs:0,storeRlsProofAttested:false}
 };
 const qa={ref:QR,schema:'TIEN404_V171W_DISPOSABLE_QA_AUTH_PLAN_V1',
  projectRef:PROJECT,commitSha:SHA,status:'REVIEW_ONLY_NOT_APPROVED',
  tenantMode:'NEW_DISPOSABLE_QA_TENANT_PROPOSED',
  stores:['QA_STORE_A','QA_STORE_B'],owners:['QA_OWNER_A','QA_OWNER_B'],
  noExistingMerchantTransfer:true,noRealCustomerData:true,
  noProductionChanges:true,noAuthWrites:true,noStoreRlsWrites:true,
  noProviderCalls:true,noNewSpend:true,backupRequired:true,
  twoIndependentRealSessionsRequired:true,storeRlsProofRequired:true
 };
 let time=NOW;
 const opts={
  expectedCommitSha:SHA,clock:()=>time,
  loadTrustedObservation:async()=>snapshot,
  loadTrustedQaPlan:async()=>qa,
  getIndependentApprovals:async({obsDigest,planDigest,projectRef,commitSha,nonce})=>
   ROLES.map(role=>{
    const kid=reviewers[role].kid,issuedAtMs=NOW-2000,expiresAtMs=NOW+100000;
    const buf=Buffer.from('TIEN404_V171W_TRUSTED_HOST_AUDIT_APPROVAL_V1\0'+canonical({
     role,kid,obsDigest,planDigest,projectRef,commitSha,nonce,issuedAtMs,expiresAtMs
    }));
    return {role,kid,signature:crypto.sign(null,buf,pairs[role].privateKey).toString('base64url'),
      issuedAtMs,expiresAtMs};
   }),
  lookupReviewerKey:async({role,kid})=>reviewers[role]?.kid===kid?reviewers[role]:null,
  reserveAtomicNonce:async({nonce})=>{
    if(nonces.has(nonce))return false;
    nonces.add(nonce);return true;
  },...overrides
 };
 delete opts.sharedNonces;
 const gate=createPrivateWorkerSecurityGate(opts);
 return {gate,snapshot,qa,pairs,reviewers,nonces,opts,
  setTime:v=>time=v,args:{auditRef:AR,qaPlanRef:QR,nonce:NN}};
}
const review=f=>f.gate.review(f.args);
async function denied(p,code){const v=await p;assert.equal(v.ok,false);if(code)assert.equal(v.reason,code);}
test('W01 signed observed existing infrastructure yields seven specific missing hosted controls',async()=>{
 const f=fixture(),r=await review(f);
 assert.equal(r.ok,true);assert.equal(r.plan.gapCount,7);
 assert.equal(r.plan.kind,'PRIVATE_WORKER_R2_AUTH_GAP_REVIEW_ONLY');
 assert.equal(r.plan.currentReadiness,'HOSTED_ACCEPTANCE_BLOCKED');
 assert.equal(r.plan.release,'HOSTED_NO_GO');
});
test('W02 no reviewer success can provision users, deploy, change R2 or bill',async()=>{
 const r=await review(fixture());assert.equal(r.ok,true);
 for(const [k,v] of Object.entries(r.plan)){
  if(k.startsWith('allow')||k==='productionReleaseApproved')assert.equal(v,false,k);
  if(k.startsWith('actual'))assert.equal(v,0,k);
 }
});
test('W03 source plan never discloses registry ref, nonce, signer IDs or private token',async()=>{
 const f=fixture(),r=await review(f);const t=JSON.stringify(r);
 assert.equal(r.ok,true);
 for(const v of [AR,QR,NN,'QA_PRIVATE_SIGNER_0','QA_KID_INFRA_SECURITY'])
  assert.equal(t.includes(v),false);
});
test('W04 untrusted user URL is not a private collector reference',async()=>{
 const f=fixture();await denied(f.gate.review({...f.args,auditRef:'https://169.254.169.254'}),
  'W_INPUT_REFERENCE_SHAPE');
});
test('W05 hidden client permit flag rejected',async()=>{
 const f=fixture();await denied(f.gate.review({...f.args,allowAuthWrites:true}),'W_INPUT_REFERENCE_SHAPE');
});
test('W06 duplicate synchronous private review attempt rejects before signer await',async()=>{
 const f=fixture();assert.equal((await review(f)).ok,true);
 await denied(review(f),'W_SAME_PROCESS_REPLAY');
});
test('W07 concurrent exact same request issues one source plan maximum',async()=>{
 const f=fixture(),r=await Promise.all([review(f),review(f)]);
 assert.equal(r.filter(x=>x.ok).length,1);
 assert.equal(r.filter(x=>x.reason==='W_SAME_PROCESS_REPLAY').length,1);
});
test('W08 reused nonce with another private reference rejected globally',async()=>{
 const f=fixture();assert.equal((await review(f)).ok,true);
 await denied(f.gate.review({...f.args,qaPlanRef:'qaplan_'+'Z'.repeat(28)}),'W_SAME_PROCESS_REPLAY');
});
test('W09 cross-instance durable nonce rejects reuse',async()=>{
 const sharedNonces=new Set(),a=fixture({sharedNonces}),b=fixture({sharedNonces});
 assert.equal((await review(a)).ok,true);
 await denied(review(b),'W_NONCE_REPLAY_OR_NON_ATOMIC');
});
test('W10 false-ish replay callback success is never accepted',async()=>{
 const f=fixture({reserveAtomicNonce:async()=> 'true'});
 await denied(review(f),'W_NONCE_REPLAY_OR_NON_ATOMIC');
});
test('W11 replay backend outage fails closed',async()=>{
 const f=fixture({reserveAtomicNonce:async()=>{throw Error('DOWN')}});
 await denied(review(f),'W_ATOMIC_REPLAY_SERVICE_UNAVAILABLE');
});
test('W12 only old snapshots are rejected',async()=>{
 const f=fixture();f.snapshot.collectedAtMs=NOW-320000;
 await denied(review(f),'W_SNAPSHOT_UNTRUSTED');
});
test('W13 attacker cannot move scoped snapshot to another project',async()=>{
 const f=fixture();f.snapshot.projectRef='ANOTHER_PROJECT';
 await denied(review(f),'W_SNAPSHOT_UNTRUSTED');
});
test('W14 source collector outage denies without alternate public URL',async()=>{
 const f=fixture({loadTrustedObservation:async()=>{throw Error('NO_CONNECTOR')}});
 await denied(review(f),'W_PRIVATE_REGISTRY_UNAVAILABLE');
});
test('W15 untrusted observation cannot carry customer PII or extra fields',async()=>{
 const f=fixture();f.snapshot.auth.customerPhone='secret';
 await denied(review(f),'W_SNAPSHOT_SCHEMA');
});
test('W16 forged worker name is not trusted',async()=>{
 const f=fixture();f.snapshot.worker.name='public-worker';
 await denied(review(f),'W_SNAPSHOT_SCHEMA');
});
test('W17 no private R2 binding produces explicit blocker',async()=>{
 const f=fixture();f.snapshot.worker.r2Binding=false;
 const r=await review(f);assert.equal(r.ok,true);
 assert.equal(r.plan.gaps.includes('R2_PRIVATE_BINDING_NOT_VERIFIED'),true);
});
test('W18 a public workers.dev or preview makes worker unsafe',async()=>{
 const f=fixture();f.snapshot.worker.workersDevEnabled=true;
 const r=await review(f);assert.equal(r.ok,true);
 assert.equal(r.plan.gaps.includes('WORKER_PUBLIC_SURFACE_NOT_ISOLATED'),true);
});
test('W19 public custom domain on bucket is explicitly blocked',async()=>{
 const f=fixture();f.snapshot.r2.customDomains=1;
 const r=await review(f);assert.equal(r.ok,true);
 assert.equal(r.plan.gaps.includes('R2_PRIVATE_BINDING_NOT_VERIFIED'),true);
});
test('W20 Access application with zero policies still requires independent external deny proof',async()=>{
 const r=await review(fixture());assert.equal(r.ok,true);
 assert.equal(r.plan.gaps.includes('INDEPENDENT_ACCESS_DENY_PROBE_MISSING'),true);
});
test('W21 R2 multipart abort does not prove retention/deletion',async()=>{
 const r=await review(fixture());assert.equal(r.ok,true);
 assert.equal(r.plan.gaps.includes('R2_OBJECT_DELETION_RETENTION_NOT_ATTESTED'),true);
});
test('W22 three existing Durable Object namespaces do not prove Worker replay binding',async()=>{
 const r=await review(fixture());assert.equal(r.ok,true);
 assert.equal(r.plan.gaps.includes('HOSTED_ATOMIC_REPLAY_NOT_ATTESTED'),true);
});
test('W23 synthetic JWT pair from two tenants cannot clear same-Tenant owner gate',async()=>{
 const r=await review(fixture());assert.equal(r.ok,true);
 assert.equal(r.plan.gaps.includes('TWO_REAL_SAME_TENANT_OWNER_SESSIONS_NOT_ADMITTED'),true);
});
test('W24 two Store scoped owners without real RLS still fail admission',async()=>{
 const f=fixture();f.snapshot.auth.sameTenantTwoStoreOwnerPairs=2;
 f.snapshot.auth.sameTenantSessionPairs=2;
 const r=await review(f);assert.equal(r.ok,true);
 assert.equal(r.plan.gaps.includes('REAL_STORE_RLS_NOT_ATTESTED'),true);
});
test('W25 full synthetic all-green snapshot still never grants real hosting',async()=>{
 const f=fixture();
 Object.assign(f.snapshot.access,{externalDenyProbe:true});
 Object.assign(f.snapshot.r2,{objectDeletionPolicyAttested:true,
  lockRuleCount:1,objectVersionProofAttested:true,malwareScannerAttested:true,cdrAttested:true});
 Object.assign(f.snapshot.replay,{workerBindingAttested:true,atomicReplayTestAttested:true});
 Object.assign(f.snapshot.auth,{sameTenantTwoStoreOwnerPairs:1,sameTenantSessionPairs:1,storeRlsProofAttested:true});
 const r=await review(f);
 assert.equal(r.ok,true);assert.equal(r.plan.gapCount,0);
 assert.equal(r.plan.currentReadiness,'SOURCE_POLICY_CONFORMS_NOT_HOSTED_ACCEPTANCE');
 assert.equal(r.plan.release,'HOSTED_NO_GO');
 assert.equal(r.plan.realProviderOrOwnerUatActuallyRun,false);
});
test('W26 extra requested privilege in QA plan is denied',async()=>{
 const f=fixture();f.qa.service_role=true;
 await denied(review(f),'W_QA_PROVISIONING_PLAN_UNSAFE');
});
test('W27 signed but unsafe owner transfer plan denied',async()=>{
 const f=fixture();f.qa.noExistingMerchantTransfer=false;
 await denied(review(f),'W_QA_PROVISIONING_PLAN_UNSAFE');
});
test('W28 source cannot automatically create Auth even for QA',async()=>{
 const f=fixture();f.qa.noAuthWrites=false;
 await denied(review(f),'W_QA_PROVISIONING_PLAN_UNSAFE');
});
test('W29 source cannot mutate RLS',async()=>{
 const f=fixture();f.qa.noStoreRlsWrites=false;
 await denied(review(f),'W_QA_PROVISIONING_PLAN_UNSAFE');
});
test('W30 canary may never send to real customers',async()=>{
 const f=fixture();f.qa.noProviderCalls=false;
 await denied(review(f),'W_QA_PROVISIONING_PLAN_UNSAFE');
});
test('W31 new spending requires separate approval',async()=>{
 const f=fixture();f.qa.noNewSpend=false;
 await denied(review(f),'W_QA_PROVISIONING_PLAN_UNSAFE');
});
test('W32 design must require backup before first write',async()=>{
 const f=fixture();f.qa.backupRequired=false;
 await denied(review(f),'W_QA_PROVISIONING_PLAN_UNSAFE');
});
test('W33 both owner identities must be from distinct QA slots',async()=>{
 const f=fixture();f.qa.owners=['QA_OWNER_A','QA_OWNER_A'];
 await denied(review(f),'W_QA_PROVISIONING_PLAN_UNSAFE');
});
test('W34 reviewer identities cannot be reused across security and Auth scope',async()=>{
 const f=fixture();f.reviewers.AUTH_RLS_INDEPENDENT.signerRef=f.reviewers.INFRA_SECURITY.signerRef;
 await denied(review(f),'W_SIGNER_NOT_ENROLLED_OR_NOT_INDEPENDENT');
});
test('W35 reviewer key must never include private JWK data',async()=>{
 const f=fixture();f.reviewers.INFRA_SECURITY.publicJwk={
  ...f.pairs.INFRA_SECURITY.privateKey.export({format:'jwk'})};
 await denied(review(f),'W_SIGNER_NOT_ENROLLED_OR_NOT_INDEPENDENT');
});
test('W36 unsigned fake source review is rejected',async()=>{
 const f=fixture({getIndependentApprovals:async()=>ROLES.map(role=>({
  role,kid:'QA_KID_'+role,signature:'fake',
  issuedAtMs:NOW-2000,expiresAtMs:NOW+100000
 }))});
 await denied(review(f),'W_SIGNER_CRYPTO_INVALID');
});
test('W37 duplicate signer role cannot replace independent reviewer',async()=>{
 const f=fixture({getIndependentApprovals:async()=>ROLES.map(()=>({
  role:'INFRA_SECURITY'
 }))});
 await denied(review(f),'W_APPROVAL_ROLE_SHAPE');
});
test('W38 signer must be privately enrolled',async()=>{
 const f=fixture();f.reviewers.AUTH_RLS_INDEPENDENT.enrollment='CLIENT_ONLY';
 await denied(review(f),'W_SIGNER_NOT_ENROLLED_OR_NOT_INDEPENDENT');
});
test('W39 revoked reviewer no longer authorizes fake evidence',async()=>{
 const f=fixture();f.reviewers.INFRA_SECURITY.active=false;
 await denied(review(f),'W_SIGNER_NOT_ENROLLED_OR_NOT_INDEPENDENT');
});
test('W40 signed snapshot drifting after first validation denied',async()=>{
 let calls=0,fx;
 fx=fixture({loadTrustedObservation:async()=>{calls++;
  if(calls>1){const z=clone(fx.snapshot);z.r2.managedPublic=true;return z;}
  return fx.snapshot;
 }});
 await denied(review(fx),'W_PRIVATE_EVIDENCE_DRIFT_AT_COMMIT');
});
test('W41 trusted owner QA plan drifting after review denied',async()=>{
 let calls=0,fx;
 fx=fixture({loadTrustedQaPlan:async()=>{calls++;
  if(calls>1){const z=clone(fx.qa);z.noRealCustomerData=false;return z;}
  return fx.qa;
 }});
 await denied(review(fx),'W_PRIVATE_EVIDENCE_DRIFT_AT_COMMIT');
});
test('W42 reviewer Ed25519 key rekeyed after signature denied',async()=>{
 let calls=0,fx;
 const altered=crypto.generateKeyPairSync('ed25519').publicKey.export({format:'jwk'});
 fx=fixture({lookupReviewerKey:async({role})=>{
  calls++;if(calls>2&&role==='INFRA_SECURITY')
   return {...fx.reviewers[role],publicJwk:altered};
  return fx.reviewers[role];
 }});
 await denied(review(fx),'W_SIGNER_REVOKED_AT_COMMIT');
});
test('W43 expired signature cannot approve snapshot',async()=>{
 const f=fixture();f.setTime(NOW+110000);
 await denied(review(f),'W_SIGNER_SCOPE_OR_EXPIRY');
});
test('W44 missing trusted private signing authority service blocks even before review',()=>{
 assert.throws(()=>createPrivateWorkerSecurityGate({expectedCommitSha:SHA}),
 /TRUSTED_PRIVATE_EVIDENCE_BACKENDS_REQUIRED/);
});
