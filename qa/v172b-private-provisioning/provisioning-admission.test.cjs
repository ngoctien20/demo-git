'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createAuthorizedQaStorePreflight}=require('./provisioning-admission.cjs');
const NOW=Date.parse('2026-11-18T00:15:00+09:00');
const P='ifxlvrhyjhbzbrkdsida',SHA='e'.repeat(40);
const EREF='evidence_'+'A'.repeat(28),AREF='approval_'+'B'.repeat(28),NONCE='qa_'+'C'.repeat(29);
const ROLES=['STAGING_INFRA_OWNER','INDEPENDENT_AUTH_SECURITY_REVIEWER'];
const copy=x=>JSON.parse(JSON.stringify(x));
function canon(x){
 if(x===null||typeof x==='string'||typeof x==='number'||typeof x==='boolean')return JSON.stringify(x);
 if(Array.isArray(x))return '['+x.map(canon).join(',')+']';
 return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canon(x[k])).join(',')+'}';
}
const digest=x=>crypto.createHash('sha256').update(canon(x)).digest('hex');
function fixture(overrides={}){
 const e={ref:EREF,projectRef:P,commitSha:SHA,observedAtMs:NOW-1000,state:{
  projectActive:true,preexistingStoreObjectsUntouched:true,newQaSchemaAbsent:true,
  newPublicQaViewAbsent:true,migrationTestedWithRollback:true,
  migrationApplied:false,qaAuthUsersAlreadyCreated:false,newPaidBranchExists:false,
  backupRestoreVerified:false,privateOperatorMfaVerified:false,
  dataApiViewSecurityReviewed:false,twoLiveSameTenantQaJwtSessions:false,
  realPostgrestABDeniedAndOwnAllowed:false,revokedSessionDenied:false,
  isolatedQaTenantAuthorized:false,twoDisposableAuthAccountsAuthorized:false,
  newPublicQaViewAuthorized:false,extraPaidResourcesAuthorized:false,
  qaResourceLedgerVerified:false
 }};
 const a={ref:AREF,projectRef:P,commitSha:SHA,
  purpose:'DISPOSABLE_QA_ONLY_NO_SEND',issuedAtMs:NOW-2000,expiresAtMs:NOW+90000,
  expectedResources:{tenants:1,stores:2,authUsers:2,qaCatalogRows:2},
  noLiveMerchantCopy:true,noDemoOrdersOrProducts:true,
  noProviderSend:true,noCredentialExport:true,noProductionChange:true,
  maxNewPaidResources:0,reviewerSignatures:[]};
 const pairs={},registry={};
 ROLES.forEach((role,i)=>{
  pairs[role]=crypto.generateKeyPairSync('ed25519');
  registry[role]={active:true,role,kid:'QA_KID_'+role,
   identityRef:'QA_PRIVATE_PERSON_'+i,enrollment:'PRIVATE_MFA_REVIEWED',
   publicJwk:pairs[role].publicKey.export({format:'jwk'})};
 });
 const sign=()=>{
  const c=copy(a);delete c.reviewerSignatures;
  a.reviewerSignatures=ROLES.map(role=>{
   const kid=registry[role].kid;
   const msg=Buffer.from('TIEN404_V172B_PRIVATE_DISPOSABLE_AUTH_ADMISSION_V1\0'+
    canon({role,kid,digestEvidence:digest(e),digestApproval:digest(c),nonce:NONCE}));
   return {role,kid,signature:crypto.sign(null,msg,pairs[role].privateKey).toString('base64url')};
  });
 };
 let t=NOW;const seen=overrides.sharedSeen||new Set();
 const cfg={
  expectedCommitSha:SHA,clock:()=>t,
  loadPrivateEvidence:async()=>e,loadPrivateApproval:async()=>a,
  getTrustedReviewerPublicKey:async({role,kid})=>registry[role]?.kid===kid?registry[role]:null,
  reserveGlobalNonce:async({nonce})=>{if(seen.has(nonce))return false;seen.add(nonce);return true},
  ...overrides
 };delete cfg.sharedSeen;
 sign();
 const gate=createAuthorizedQaStorePreflight(cfg);
 const request={evidenceRef:EREF,approvalRef:AREF,nonce:NONCE};
 return {e,a,sign,pairs,registry,seen,cfg,request,gate,
  run:()=>gate.review(request),setTime:v=>{t=v}};
}
async function denied(f,reason){
 const r=await f.run();assert.equal(r.ok,false);assert.equal(r.reason,reason);
}
test('B01 privately signed review produces ONLY no-go readiness for current staging',async()=>{
 const r=await fixture().run();assert.equal(r.ok,true);
 assert.equal(r.plan.sourceGateChecks,16);assert.equal(r.plan.blockerCount,9);
 assert.equal(r.plan.release,'HOSTED_NO_GO');
});
test('B02 successful review never allows Auth provisioning, migration, Data API or deletion',async()=>{
 const r=await fixture().run();assert.equal(r.ok,true);
 for(const [k,v] of Object.entries(r.plan))if(k.startsWith('allow'))assert.equal(v,false,k);
 assert.equal(r.plan.actualLiveUserProvisioningExecuted,false);
 assert.equal(r.plan.actualMigrationApplied,false);
});
test('B03 no raw signer identity, JWT, file or private evidence reference in output',async()=>{
 const r=await fixture().run(),j=JSON.stringify(r);
 for(const secret of [EREF,AREF,NONCE,'QA_PRIVATE_PERSON_0','QA_KID_STAGING_INFRA_OWNER','access_token'])
  assert.equal(j.includes(secret),false,secret);
});
test('B04 request cannot supply external URL as evidence record',async()=>{
 const f=fixture();const r=await f.gate.review({...f.request,evidenceRef:'https://attacker.invalid'});
 assert.equal(r.reason,'REQUEST_REFERENCES_NOT_PRIVATE');
});
test('B05 request cannot smuggle createUsers true',async()=>{
 const f=fixture();const r=await f.gate.review({...f.request,createUsers:true});
 assert.equal(r.reason,'REQUEST_REFERENCES_NOT_PRIVATE');
});
test('B06 a nonce is consumed before any asynchronous trust callback',async()=>{
 const f=fixture();assert.equal((await f.run()).ok,true);
 await denied(f,'LOCAL_NONCE_REPLAY');
});
test('B07 concurrent same-instance review never creates two plans',async()=>{
 const f=fixture(),r=await Promise.all([f.run(),f.run()]);
 assert.equal(r.filter(x=>x.ok).length,1);assert.equal(r.filter(x=>x.reason==='LOCAL_NONCE_REPLAY').length,1);
});
test('B08 separate instances need durable global nonce uniqueness',async()=>{
 const sharedSeen=new Set(),a=fixture({sharedSeen}),b=fixture({sharedSeen});
 assert.equal((await a.run()).ok,true);await denied(b,'GLOBAL_NONCE_REPLAY_OR_NOT_ATOMIC');
});
test('B09 non-boolean durable replay success fails closed',async()=>{
 await denied(fixture({reserveGlobalNonce:async()=> 'true'}),'GLOBAL_NONCE_REPLAY_OR_NOT_ATOMIC');
});
test('B10 durable replay backend outage denies admission',async()=>{
 await denied(fixture({reserveGlobalNonce:async()=>{throw Error('offline')}}),'GLOBAL_REPLAY_BACKEND_UNAVAILABLE');
});
test('B11 stale actual Supabase audit cannot be accepted',async()=>{
 const f=fixture();f.e.observedAtMs=NOW-320000;await denied(f,'EVIDENCE_STALE_OR_WRONG_SHA');
});
test('B12 wrong commit pinned by real operator rejected',async()=>{
 const f=fixture();f.e.commitSha='f'.repeat(40);await denied(f,'EVIDENCE_STALE_OR_WRONG_SHA');
});
test('B13 unknown fields including real customer email rejected',async()=>{
 const f=fixture();f.e.state.customerEmail='secret@example.invalid';
 await denied(f,'EVIDENCE_SCHEMA_REJECTED');
});
test('B14 wrong Supabase project refused even when source tests pass',async()=>{
 const f=fixture();f.a.projectRef='ATTACKER_PROJECT';await denied(f,'APPROVAL_SCOPE_INVALID');
});
test('B15 expired private consent receipt invalid',async()=>{
 const f=fixture();f.a.expiresAtMs=NOW-1;await denied(f,'APPROVAL_SCOPE_INVALID');
});
test('B16 same person signing both infrastructure and security violates independence',async()=>{
 const f=fixture();f.registry[ROLES[1]].identityRef=f.registry[ROLES[0]].identityRef;
 await denied(f,'TWO_INDEPENDENT_REVIEWERS_NOT_PROVEN');
});
test('B17 revoked reviewer key blocked',async()=>{
 const f=fixture();f.registry[ROLES[0]].active=false;
 await denied(f,'TWO_INDEPENDENT_REVIEWERS_NOT_PROVEN');
});
test('B18 private Ed25519 key material in registry must never be accepted',async()=>{
 const f=fixture();f.registry[ROLES[0]].publicJwk=f.pairs[ROLES[0]].privateKey.export({format:'jwk'});
 await denied(f,'TWO_INDEPENDENT_REVIEWERS_NOT_PROVEN');
});
test('B19 fake signature bytes cannot approve real Auth writes',async()=>{
 const f=fixture();f.a.reviewerSignatures[0].signature='fake';
 await denied(f,'UNTRUSTED_ED25519_APPROVAL');
});
test('B20 adding a public resource beyond fixed scope invalidates signed permission',async()=>{
 const f=fixture();f.a.expectedResources.qaCatalogRows=10000;
 await denied(f,'APPROVAL_SCOPE_INVALID');
});
test('B21 paid-resource creation explicitly disallowed',async()=>{
 const f=fixture();f.a.maxNewPaidResources=1;await denied(f,'APPROVAL_SCOPE_INVALID');
});
test('B22 no existing Merchant records may be transferred',async()=>{
 const f=fixture();f.a.noLiveMerchantCopy=false;await denied(f,'APPROVAL_SCOPE_INVALID');
});
test('B23 signed permission cannot grant provider send',async()=>{
 const f=fixture();f.a.noProviderSend=false;await denied(f,'APPROVAL_SCOPE_INVALID');
});
test('B24 all mock flags green cannot authorize actual hosted action',async()=>{
 const f=fixture();
 Object.assign(f.e.state,{
  backupRestoreVerified:true,privateOperatorMfaVerified:true,
  dataApiViewSecurityReviewed:true,twoLiveSameTenantQaJwtSessions:true,
  realPostgrestABDeniedAndOwnAllowed:true,revokedSessionDenied:true,
  isolatedQaTenantAuthorized:true,twoDisposableAuthAccountsAuthorized:true,
  newPublicQaViewAuthorized:true,qaResourceLedgerVerified:true
 });
 f.sign();const r=await f.run();assert.equal(r.ok,true);
 assert.equal(r.plan.blockerCount,0);assert.equal(r.plan.release,'HOSTED_NO_GO');
 assert.equal(r.plan.allowAuthUserCreation,false);assert.equal(r.plan.allowLiveJwtUat,false);
});
test('B25 empty-schema preflight needs independent backup before eligibility',async()=>{
 const r=await fixture().run();assert.equal(r.ok,true);
 assert.equal(r.plan.blockers.includes('KNOWN_RECOVERY_BACKUP'),true);
});
const missingChecks=[
 ['backup restore',f=>f.e.state.backupRestoreVerified=false,'KNOWN_RECOVERY_BACKUP'],
 ['MFA verified operator',f=>f.e.state.privateOperatorMfaVerified=false,'PRIVATE_AUTH_ADMIN_SESSION_MFA'],
 ['Store migration rollback',f=>f.e.state.migrationTestedWithRollback=false,'DISPOSABLE_SQL_ROLLBACK_TESTED'],
 ['existing QA schema occupied',f=>f.e.state.newQaSchemaAbsent=false,'EMPTY_QA_TARGET_SCHEMA_AND_PUBLIC_VIEW'],
 ['public QA view occupied',f=>f.e.state.newPublicQaViewAbsent=false,'EMPTY_QA_TARGET_SCHEMA_AND_PUBLIC_VIEW'],
 ['migration accidentally applied',f=>f.e.state.migrationApplied=true,'NO_UNRECONCILED_LIVE_QA_MUTATIONS'],
 ['QA auth accounts already created',f=>f.e.state.qaAuthUsersAlreadyCreated=true,'NO_UNRECONCILED_LIVE_QA_MUTATIONS'],
 ['current merchant isolation',f=>f.e.state.preexistingStoreObjectsUntouched=false,'PINNED_STAGING_PROJECT_AND_HEAD'],
 ['approved private auth admin scope',f=>f.e.state.twoDisposableAuthAccountsAuthorized=false,'PRIVATE_AUTH_USER_CREATION_SCOPE'],
 ['existing new paid Supabase branch',f=>f.e.state.newPaidBranchExists=true,'NO_NEW_PAID_RESOURCE_APPROVAL'],
 ['view exposed without review',f=>f.e.state.dataApiViewSecurityReviewed=false,'PRIVATE_DATA_API_VIEW_EXPOSURE_REVIEW'],
 ['unapproved public view',f=>f.e.state.newPublicQaViewAuthorized=false,'PRIVATE_DATA_API_VIEW_EXPOSURE_REVIEW'],
 ['no isolated QA tenant consent',f=>f.e.state.isolatedQaTenantAuthorized=false,'SAME_TENANT_TWO_STORE_MEMBERSHIP_PLAN'],
 ['no two real active JWTs',f=>f.e.state.twoLiveSameTenantQaJwtSessions=false,'TWO_REAL_OWNER_JWT_SESSION_RECEIPTS'],
 ['real PostgREST negative test never executed',f=>f.e.state.realPostgrestABDeniedAndOwnAllowed=false,'REAL_STORE_A_B_POSTGREST_NEGATIVE_QA']
];
for(const [label,mutate,reason] of missingChecks){
 test('B-MISSING hosted gate '+label,async()=>{
  const f=fixture();mutate(f);f.sign();const r=await f.run();
  assert.equal(r.ok,true);assert.equal(r.plan.blockers.includes(reason),true);
  assert.equal(r.plan.release,'HOSTED_NO_GO');
 });
}
