'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createPrivateHostingReadinessGate,INFRA_CONTROLS,QA_CONTROLS}=require('./private-hosting-readiness.cjs');
const NOW=Date.parse('2026-11-17T11:30:00Z'), SHA='a'.repeat(40);
const PRJ='ifxlvrhyjhbzbrkdsida';
const IFREF='infra_'+'I'.repeat(28),QPREF='qaplan_'+'Q'.repeat(28);
const NONCE='qa_'+'N'.repeat(28);
const ROLES=['INFRA_SECURITY_REVIEWER','AUTH_RLS_REVIEWER'];
function canonical(x){
 if(x===null||typeof x==='string'||typeof x==='boolean'||typeof x==='number')return JSON.stringify(x);
 if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';
 return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';
}
function digest(x){return crypto.createHash('sha256').update(canonical(x)).digest('hex');}
const clone=x=>JSON.parse(JSON.stringify(x));
function fixture(overrides={}){
 const keys={},registry={},seen=overrides.sharedSeen||new Set();
 const infra={ref:IFREF,projectRef:PRJ,commitSha:SHA,
  kind:'PRIVATE_EVIDENCE_HOSTING_BLUEPRINT',status:'REVIEWED_DESIGN_NOT_DEPLOYED',
  controls:clone(INFRA_CONTROLS)};
 const qa={ref:QPREF,projectRef:PRJ,commitSha:SHA,
  kind:'DISPOSABLE_QA_TENANT_STORE_PLAN',status:'REVIEWED_DESIGN_NOT_AUTHORIZED',
  controls:clone(QA_CONTROLS)};
 let time=NOW;
 for(const [i,role] of ROLES.entries()){
  const pair=crypto.generateKeyPairSync('ed25519');keys[role]=pair;
  registry[role]={active:true,enrollment:'INDEPENDENT_PRIVATE_REVIEWER',role,
   kid:'QA_KID_'+role,signerRef:'QA_INDEPENDENT_ACTOR_'+i,
   publicJwk:pair.publicKey.export({format:'jwk'})};
 }
 const service={
  clock:()=>time,
  expectedCommitSha:SHA,
  lookupBlueprint:async()=>infra,
  lookupQaTenantPlan:async()=>qa,
  getPrivateReviewAttestations:async({infraDigest,qaDigest,projectRef,commitSha,reviewNonce})=>
   ROLES.map(role=>{
    const kid=registry[role].kid,issuedAtMs=NOW-2000,expiresAtMs=NOW+100000;
    const content=Buffer.from('TIEN404_V171V_PRIVATE_REVIEW_V1\0'+canonical({
     role,kid,projectRef,commitSha,infraDigest,qaDigest,reviewNonce,
     issuedAtMs,expiresAtMs
    }));
    return {role,kid,issuedAtMs,expiresAtMs,
     signature:crypto.sign(null,content,keys[role].privateKey).toString('base64url')};
   }),
  lookupPrivateReviewerKey:async({role,kid})=>registry[role]?.kid===kid?registry[role]:null,
  reserveReviewOnce:async({nonce})=>{
   if(seen.has(nonce))return false;seen.add(nonce);return true;
  },...overrides
 };
 delete service.sharedSeen;
 const gate=createPrivateHostingReadinessGate(service);
 const args={infrastructureRef:IFREF,qaPlanRef:QPREF,reviewNonce:NONCE};
 return {gate,infra,qa,registry,keys,seen,args,
  setTime:v=>time=v,service};
}
const review=(f,args)=>f.gate.reviewBlueprint(args||f.args);
async function denied(p,reason){const x=await p;assert.equal(x.ok,false);if(reason)assert.equal(x.reason,reason);}
test('V01 independent two signed synthetic reviewer blueprint passes only DESIGN review',async()=>{
 const f=fixture(),r=await review(f);assert.equal(r.ok,true);
 assert.equal(r.plan.kind,'PRIVATE_INFRA_QA_TENANT_DESIGN_REVIEW_ONLY');
 assert.equal(r.plan.plannedStoreCount,2);assert.equal(r.plan.independentDesignReviewerCount,2);
 assert.equal(r.plan.release,'HOSTED_NO_GO');
});
test('V02 success never allows writes, production, cloud hosting, secrets, provider or billing',async()=>{
 const r=await review(fixture());assert.equal(r.ok,true);
 for(const [key,value] of Object.entries(r.plan)){
  if(key.startsWith('allow')||key.endsWith('Verified')||key==='productionReleaseApproved')
   assert.equal(value,false,key);
  if(key.startsWith('actual'))assert.equal(value,0,key);
 }
});
test('V03 fake evidence review exposes neither private reviewer IDs nor source refs',async()=>{
 const f=fixture(),r=await review(f),raw=JSON.stringify(r);
 assert.equal(r.ok,true);
 for(const s of [IFREF,QPREF,NONCE,'QA_INDEPENDENT_ACTOR_0','QA_KID_INFRA_SECURITY_REVIEWER'])
 assert.equal(raw.includes(s),false);
});
test('V04 HTTP URL cannot become trusted infrastructure ref',async()=>{
 const f=fixture();await denied(review(f,{...f.args,infrastructureRef:'https://127.0.0.1/a'}),'HOSTING_REFERENCE_SHAPE');
});
test('V05 traversal and object URI cannot become private plan ref',async()=>{
 const f=fixture();await denied(review(f,{...f.args,qaPlanRef:'../../private/secret'}),'HOSTING_REFERENCE_SHAPE');
});
test('V06 client unapproved flags cannot be injected as extra parameters',async()=>{
 const f=fixture();f.infra.publicUrl='https://example.com/attack';
 await denied(review(f),'HOSTING_INFRA_BLUEPRINT_UNSAFE');
});
test('V07 same private gate rejects replay of identical attempt after success',async()=>{
 const f=fixture();assert.equal((await review(f)).ok,true);
 await denied(review(f),'HOSTING_REVIEW_ALREADY_ATTEMPTED');
});
test('V08 two simultaneous independent signatures cannot admit same request twice',async()=>{
 const f=fixture(),rr=await Promise.all([review(f),review(f)]);
 assert.equal(rr.filter(x=>x.ok).length,1);
 assert.equal(rr.filter(x=>x.reason==='HOSTING_REVIEW_ALREADY_ATTEMPTED').length,1);
});
test('V09 cross-instance private durable nonce replay is rejected',async()=>{
 const sharedSeen=new Set(),a=fixture({sharedSeen}),b=fixture({sharedSeen});
 assert.equal((await review(a)).ok,true);
 await denied(review(b),'HOSTING_REVIEW_REPLAY_OR_NON_ATOMIC');
});
test('V10 falsified Ed25519 signature fails closed',async()=>{
 const f=fixture();const orig=f.service.getPrivateReviewAttestations;
 f.service.getPrivateReviewAttestations=async()=>[]; // immutable created gate still uses original
 // Instead inject malicious provider at gate construction.
 const e=fixture({getPrivateReviewAttestations:async()=>
  ROLES.map(role=>({role,kid:'QA_KID_'+role,signature:'not-a-signature',issuedAtMs:NOW,expiresAtMs:NOW+100000}))});
 await denied(review(e),'HOSTING_REVIEW_SIGNATURE_INVALID');
});
test('V11 untrusted reviewer public keys supplied by client cannot authorize',async()=>{
 const f=fixture();await denied(review(f,{...f.args,publicJwk:{kty:'OKP'}}),'HOSTING_REFERENCE_SHAPE');
});
test('V12 two roles using same enrolled human identity are refused',async()=>{
 const f=fixture();f.registry.AUTH_RLS_REVIEWER.signerRef=f.registry.INFRA_SECURITY_REVIEWER.signerRef;
 await denied(review(f),'HOSTING_REVIEWER_NOT_INDEPENDENT');
});
test('V13 revoked infrastructure reviewer denied',async()=>{
 const f=fixture();f.registry.INFRA_SECURITY_REVIEWER.active=false;
 await denied(review(f),'HOSTING_REVIEWER_NOT_INDEPENDENT');
});
test('V14 reviewer key containing private JWK d is not accepted',async()=>{
 const f=fixture();
 f.registry.INFRA_SECURITY_REVIEWER.publicJwk={
  ...f.keys.INFRA_SECURITY_REVIEWER.privateKey.export({format:'jwk'})};
 await denied(review(f),'HOSTING_REVIEWER_NOT_INDEPENDENT');
});
test('V15 source fails closed with no trusted private key lookup',async()=>{
 const f=fixture({lookupPrivateReviewerKey:async()=>null});
 await denied(review(f),'HOSTING_REVIEWER_NOT_INDEPENDENT');
});
test('V16 reviewer signing key rotates before final review commit',async()=>{
 let n=0;let f;
 const other=crypto.generateKeyPairSync('ed25519').publicKey.export({format:'jwk'});
 f=fixture({lookupPrivateReviewerKey:async({role})=>{
  n++;if(n>2&&role==='AUTH_RLS_REVIEWER')
   return {...f.registry[role],publicJwk:other};
  return f.registry[role];
 }});
 await denied(review(f),'HOSTING_REVIEWER_REVOKED_AT_COMMIT');
});
test('V17 infrastructure controls changed between initial and final authority checks',async()=>{
 let count=0;let f;
 f=fixture({lookupBlueprint:async()=>{count++;
  if(count>1){const changed=clone(f.infra);
   changed.controls.worker.logs='RAW_PII';return changed;}
  return f.infra;
 }});
 await denied(review(f),'HOSTING_BLUEPRINT_CHANGED_AT_COMMIT');
});
test('V18 QA identity plan changed between initial and final lookup',async()=>{
 let count=0;let f;
 f=fixture({lookupQaTenantPlan:async()=>{count++;
  if(count>1){const changed=clone(f.qa);changed.controls.rows='CUSTOMER_DATA';return changed;}
  return f.qa;
 }});
 await denied(review(f),'HOSTING_BLUEPRINT_CHANGED_AT_COMMIT');
});
test('V19 mismatching trusted commitSHA in blueprint is denied',async()=>{
 const f=fixture();f.infra.commitSha='b'.repeat(40);
 await denied(review(f),'HOSTING_INFRA_BLUEPRINT_UNSAFE');
});
test('V20 wrong project ref in plan is denied',async()=>{
 const f=fixture();f.qa.projectRef='OTHER_PROJECT';
 await denied(review(f),'HOSTING_QA_TENANT_PLAN_UNSAFE');
});
test('V21 no immutable evidence object version binding is denied',async()=>{
 const f=fixture();f.infra.controls.storage.evidenceVersionBinding='OPTIONAL';
 await denied(review(f),'HOSTING_INFRA_BLUEPRINT_UNSAFE');
});
test('V22 approval without two independent reviewers is denied',async()=>{
 const e=fixture({getPrivateReviewAttestations:async()=>[]});
 await denied(review(e),'HOSTING_APPROVALS_SHAPE');
});
test('V23 same role twice instead of security and Auth/RLS review is denied',async()=>{
 const e=fixture({getPrivateReviewAttestations:async()=>[
 {role:'INFRA_SECURITY_REVIEWER'},{role:'INFRA_SECURITY_REVIEWER'}]});
 await denied(review(e),'HOSTING_APPROVALS_SHAPE');
});
test('V24 unsigned reviewer approval payload fails closed',async()=>{
 const e=fixture({getPrivateReviewAttestations:async()=>ROLES.map(role=>({
 role,kid:'QA_KID_'+role,signature:'true',issuedAtMs:NOW,expiresAtMs:NOW+100000}))});
 await denied(review(e),'HOSTING_REVIEW_SIGNATURE_INVALID');
});
test('V25 reviewer attestation with stale issue timestamp fails closed',async()=>{
 const e=fixture({getPrivateReviewAttestations:async()=>ROLES.map(role=>({
 role,kid:'QA_KID_'+role,signature:'test',issuedAtMs:NOW-900000,expiresAtMs:NOW+100000}))});
 await denied(review(e),'HOSTING_APPROVAL_SCOPE_OR_EXPIRY');
});
test('V26 no durable private replay service fails closed',async()=>{
 const e=fixture({reserveReviewOnce:async()=>{throw Error('DOWN')}});
 await denied(review(e),'HOSTING_DURABLE_REPLAY_BACKEND_UNAVAILABLE');
});
test('V27 a truthy string is not an atomic nonce reservation',async()=>{
 const e=fixture({reserveReviewOnce:async()=> 'true'});
 await denied(review(e),'HOSTING_REVIEW_REPLAY_OR_NON_ATOMIC');
});
test('V28 private blueprint registry outage fails closed',async()=>{
 const e=fixture({lookupBlueprint:async()=>{throw Error('DOWN')}});
 await denied(review(e),'HOSTING_PRIVATE_REGISTRY_UNAVAILABLE');
});
test('V29 signed but expired attestation denied at commit',async()=>{
 const e=fixture();e.setTime(NOW+110000);
 await denied(review(e),'HOSTING_APPROVAL_SCOPE_OR_EXPIRY');
});
test('V30 no direct client secret can be included in ref input',async()=>{
 const e=fixture();await denied(review(e,{...e.args,secret:'malicious'}),
 'HOSTING_REFERENCE_SHAPE');
});
const hostileInfrastructure=[
 ['Access bypass',x=>x.worker.bypass='ENABLED'],
 ['public Workers route',x=>x.worker.publicWebhooks='ENABLED'],
 ['workers.dev enabled',x=>x.worker.workersDev='ENABLED'],
 ['preview URL without Access',x=>x.worker.previewRoutes='PUBLIC'],
 ['lack of MFA',x=>x.worker.operatorMfa='DISABLED'],
 ['unmanaged secrets',x=>x.worker.credentials='ENV_CLIENT_SIDE'],
 ['PII logging',x=>x.worker.logs='RAW_PII'],
 ['R2 r2.dev public',x=>x.storage.publicDevUrl='ENABLED'],
 ['R2 custom domain public',x=>x.storage.publicCustomDomains='PUBLIC_DOMAIN'],
 ['direct client uploads',x=>x.storage.directClientUpload='ENABLED'],
 ['unscanned evidence',x=>x.storage.contentReview='NONE'],
 ['cross-tenant object storage',x=>x.storage.tenantPartition='SHARED_LIVE'],
 ['non-atomic replay',x=>x.replay.mode='KV_EVENTUAL'],
 ['no retention',x=>x.lifecycle.retentionHours=0],
 ['unapproved deletions',x=>x.lifecycle.deleteApproval='AUTO'],
 ['unbounded files',x=>x.limits.maxObjectBytes=999999999],
 ['unbounded bill',x=>x.limits.maxDeploymentSpendUsd=9999]
];
for(const [name,mutate] of hostileInfrastructure){
 test('V-I unsafe private hosting design denies: '+name,async()=>{
  const f=fixture();mutate(f.infra.controls);
  await denied(review(f),'HOSTING_INFRA_BLUEPRINT_UNSAFE');
 });
}
const hostileQa=[
 ['same Store twice',x=>x.stores=['QA_STORE_A','QA_STORE_A']],
 ['same owner twice',x=>x.ownerSlots=['QA_OWNER_A','QA_OWNER_A']],
 ['real merchant transfer',x=>x.ownerTransfer='ALLOWED'],
 ['production customer rows',x=>x.rows='REAL_CUSTOMERS'],
 ['service_role bypass',x=>x.privilege='SERVICE_ROLE'],
 ['Auth creation without approval',x=>x.operations='CREATE_USERS_NOW'],
 ['migration auto deploy',x=>x.rls='AUTO_APPLY'],
 ['missing backup',x=>x.backup='NOT_REQUIRED'],
 ['no rollback plan',x=>x.rollback='DELETE_ALL_TENANTS'],
 ['shared DEMO catalog',x=>x.catalog='SHARED_DEMO']
];
for(const [name,mutate] of hostileQa){
 test('V-Q unsafe disposable QA tenant plan denies: '+name,async()=>{
  const f=fixture();mutate(f.qa.controls);
  await denied(review(f),'HOSTING_QA_TENANT_PLAN_UNSAFE');
 });
}
