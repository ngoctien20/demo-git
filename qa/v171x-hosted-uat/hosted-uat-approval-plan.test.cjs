'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createHostedReadinessPlan,originalRule,candidateRule,ALL_CHECKS}=require('./hosted-uat-approval-plan.cjs');
const NOW=Date.parse('2026-11-17T13:15:00Z'),SHA='c'.repeat(40);
const INFRA='infra_'+'A'.repeat(26),AUTH='authplan_'+'B'.repeat(26);
const PROJECT='ifxlvrhyjhbzbrkdsida';
const copy=x=>JSON.parse(JSON.stringify(x));
function fixture(overrides={}){
 const infra={ref:INFRA,projectRef:PROJECT,commitSha:SHA,collectedAtMs:NOW-1000,
  worker:{name:'tien404-rpc16-merchant-evidence-inactive-staging',exists:true,
    workersDevEnabled:false,previewEnabled:false,customDomains:0,r2Bound:true},
  r2:{name:'tien404-merchant-evidence-quarantine-staging',exists:true,
    managedPublicEnabled:false,customDomains:0,lockRuleCount:0},
  access:{name:'TIEN404 RPC16 Merchant Evidence Staging — DENY ALL',
    exists:true,policiesReturned:0,bypassPolicyCount:0,
    externalDeniedCanaryVerified:false,externalAuthorizedCanaryVerified:false},
  replay:{namespacesExist:3,workerDurableBindingVerified:false,
    crossRestartAtomicCanaryVerified:false},
  lifecycleRules:[copy(originalRule)],
  verification:{prefixZeroObjectsVerified:false,lifecycleBackupRecorded:false,
    ownerDeletionConsentRecorded:false,actualRetentionCanaryVerified:false,
    actualScannerCdrVerified:false,lockConflictIndependentlyReviewed:false}
 };
 const identity={ref:AUTH,projectRef:PROJECT,commitSha:SHA,
  mode:'DISPOSABLE_QA_REVIEW_ONLY',provisioningApproved:false,
  tenantMode:'NEW_TENANT_QA_ONLY',owners:['QA_OWNER_A','QA_OWNER_B'],
  stores:['QA_STORE_A','QA_STORE_B'],usesOnlySyntheticRows:true,
  noExistingMerchantChanges:true,noServiceRoleBypass:true,
  noDemoCatalogReuse:true,noAuthWrites:true,noRlsChanges:true,
  ownerSessionPairVerified:false,actualStoreRlsJwtUatVerified:false,
  costAndRollbackApproved:false};
 const opts={expectedCommitSha:SHA,clock:()=>NOW,
  readTrustedInfrastructure:async()=>infra,
  readTrustedIdentity:async()=>identity,...overrides};
 return {infra,identity,opts,gate:createHostedReadinessPlan(opts),
  request:{infraRef:INFRA,identityRef:AUTH}};
}
async function denial(p,reason){
 const r=await p;assert.equal(r.ok,false);if(reason)assert.equal(r.reason,reason);
}
test('X01 existing private Worker/R2 audit produces truthful review-only output',async()=>{
 const f=fixture(),r=await f.gate.review(f.request);
 assert.equal(r.ok,true);assert.equal(r.review.kind,'PRIVATE_HOSTED_CANARY_AND_R2_APPROVAL_PLAN_ONLY');
 assert.equal(r.review.release,'HOSTED_NO_GO');
 assert.equal(r.review.totalChecks,16);assert.equal(r.review.checksPassed,3);
 assert.equal(r.review.blockers.length,13);
});
test('X02 lifecycle proposal preserves exact existing multipart abort after 7 days',async()=>{
 const r=await fixture().gate.review({infraRef:INFRA,identityRef:AUTH});
 assert.equal(r.ok,true);
 assert.deepEqual(r.preview.rules[0],originalRule);
 assert.equal(r.preview.rules[0].abortMultipartUploadsTransition.condition.maxAge,604800);
});
test('X03 candidate applies only to disposable prefix, not whole bucket',async()=>{
 const r=await fixture().gate.review({infraRef:INFRA,identityRef:AUTH});
 assert.deepEqual(r.preview.rules[1],candidateRule);
 assert.equal(r.preview.rules[1].conditions.prefix,'qa-v171x-disposable/');
 assert.equal(r.preview.rules[1].deleteObjectsTransition.condition.maxAge,86400);
 assert.equal(r.preview.rules[1].enabled,false);
});
test('X04 even with signed-off source synthetic flags proposal cannot touch Cloudflare or Supabase',async()=>{
 const f=fixture();Object.assign(f.infra.verification,{
  prefixZeroObjectsVerified:true,lifecycleBackupRecorded:true,
  ownerDeletionConsentRecorded:true,actualRetentionCanaryVerified:true,
  actualScannerCdrVerified:true,lockConflictIndependentlyReviewed:true});
 Object.assign(f.infra.access,{policiesReturned:1,bypassPolicyCount:0,
  externalDeniedCanaryVerified:true,externalAuthorizedCanaryVerified:true});
 Object.assign(f.infra.replay,{workerDurableBindingVerified:true,crossRestartAtomicCanaryVerified:true});
 Object.assign(f.identity,{ownerSessionPairVerified:true,actualStoreRlsJwtUatVerified:true,costAndRollbackApproved:true});
 const r=await f.gate.review(f.request);
 assert.equal(r.ok,true);assert.equal(r.review.checksPassed,16);
 assert.equal(r.review.blockers.length,0);
 assert.equal(r.review.release,'HOSTED_NO_GO');
 assert.equal(r.review.realR2LifecycleApplied,false);
 assert.equal(r.review.realAuthUsersProvisioned,0);
 assert.equal(r.preview.apply,false);
 for(const [key,value] of Object.entries(r.review))
  if(key.startsWith('allow')||key==='productionReleaseApproved')assert.equal(value,false,key);
});
test('X05 unverified external no-send route is an explicit blocker',async()=>{
 const f=fixture(),r=await f.gate.review(f.request);
 assert.equal(r.review.blockers.includes('ACCESS_APP_UNAUTH_PROBE'),true);
 assert.equal(r.review.realCloudflareWorkerCanaryRun,false);
});
test('X06 R2 multipart abort does not count as object retention',async()=>{
 const r=await fixture().gate.review({infraRef:INFRA,identityRef:AUTH});
 assert.equal(r.review.blockers.includes('R2_RETENTION_REAL_CANARY'),true);
 assert.equal(r.review.blockers.includes('R2_LIFECYCLE_BACKUP'),true);
});
test('X07 three namespaces alone are not a worker replay binding',async()=>{
 const r=await fixture().gate.review({infraRef:INFRA,identityRef:AUTH});
 assert.equal(r.review.blockers.includes('WORKER_BOUND_ATOMIC_REPLAY'),true);
 assert.equal(r.review.blockers.includes('REAL_REPLAY_RESTART_CANARY'),true);
});
test('X08 0 same-Tenant Store owner receipts blocks Auth UAT',async()=>{
 const r=await fixture().gate.review({infraRef:INFRA,identityRef:AUTH});
 assert.equal(r.review.blockers.includes('TWO_AUTH_OWNER_SESSION_ATTESTATIONS'),true);
 assert.equal(r.review.blockers.includes('STORE_LEVEL_RLS_ACTUAL_JWT_UAT'),true);
});
test('X09 public R2 endpoint is never accepted',async()=>{
 const f=fixture();f.infra.r2.managedPublicEnabled=true;
 const r=await f.gate.review(f.request);
 assert.equal(r.review.blockers.includes('R2_PRIVATE_ENDPOINTS'),true);
});
test('X10 public Worker preview requires lockdown before acceptance',async()=>{
 const f=fixture();f.infra.worker.previewEnabled=true;
 const r=await f.gate.review(f.request);
 assert.equal(r.review.blockers.includes('WORKER_PUBLIC_SURFACE'),true);
});
test('X11 no R2 binding counts as failing the existing worker existence gate',async()=>{
 const f=fixture();f.infra.worker.r2Bound=false;
 const r=await f.gate.review(f.request);
 assert.equal(r.review.blockers.includes('PRIVATE_WORKER_EXISTENCE'),true);
});
test('X12 Auth creation without explicit separate approval invalidates request',async()=>{
 const f=fixture();f.identity.noAuthWrites=false;
 await denial(f.gate.review(f.request),'X_QA_OWNER_SCOPE_UNSAFE');
});
test('X13 bypassing Store RLS with service role invalidates request',async()=>{
 const f=fixture();f.identity.noServiceRoleBypass=false;
 await denial(f.gate.review(f.request),'X_QA_OWNER_SCOPE_UNSAFE');
});
test('X14 copying live Merchant data into QA plan is forbidden',async()=>{
 const f=fixture();f.identity.usesOnlySyntheticRows=false;
 await denial(f.gate.review(f.request),'X_QA_OWNER_SCOPE_UNSAFE');
});
test('X15 no owner consent for deletion must remain a blocker',async()=>{
 const f=fixture();const r=await f.gate.review(f.request);
 assert.equal(r.review.blockers.includes('R2_OWNER_DELETION_APPROVAL'),true);
});
test('X16 24h expiry cannot apply until QA prefix is shown empty',async()=>{
 const r=await fixture().gate.review({infraRef:INFRA,identityRef:AUTH});
 assert.equal(r.review.blockers.includes('R2_PREFIX_EMPTY_VERIFIED'),true);
 assert.equal(r.preview.apply,false);
});
test('X17 unverified scanner/CDR means no Merchant evidence intake',async()=>{
 const r=await fixture().gate.review({infraRef:INFRA,identityRef:AUTH});
 assert.equal(r.review.blockers.includes('R2_SCANNER_CDR_REAL_EVIDENCE'),true);
});
test('X18 missing bucket lock conflict review remains blocked',async()=>{
 const r=await fixture().gate.review({infraRef:INFRA,identityRef:AUTH});
 assert.equal(r.review.blockers.includes('R2_LOCK_CONFLICT_REVIEW'),true);
});
test('X19 source cannot accept requested HTTP URL to private collector',async()=>{
 const f=fixture();
 await denial(f.gate.review({...f.request,infraRef:'https://169.254.169.254/meta'}),'X_REFERENCE_SHAPE');
});
test('X20 request additional permission smuggling is rejected',async()=>{
 const f=fixture();
 await denial(f.gate.review({...f.request,createOwner:true}),'X_REFERENCE_SHAPE');
});
test('X21 private collector backend error fails closed',async()=>{
 const f=fixture({readTrustedInfrastructure:async()=>{throw Error('OFFLINE')}});
 await denial(f.gate.review(f.request),'X_TRUSTED_READ_UNAVAILABLE');
});
test('X22 future collected timestamp denies stale fake canary',async()=>{
 const f=fixture();f.infra.collectedAtMs=NOW+60000;
 await denial(f.gate.review(f.request),'X_OBSERVATION_UNTRUSTED_OR_STALE');
});
test('X23 stale preflight older than 5min fails closed',async()=>{
 const f=fixture();f.infra.collectedAtMs=NOW-600000;
 await denial(f.gate.review(f.request),'X_OBSERVATION_UNTRUSTED_OR_STALE');
});
test('X24 wrong tenant project ref denies before creating any plan',async()=>{
 const f=fixture();f.identity.projectRef='ATTACKER_SUPABASE';
 await denial(f.gate.review(f.request),'X_QA_OWNER_SCOPE_UNSAFE');
});
test('X25 Git commit SHA mismatch denies',async()=>{
 const f=fixture();f.infra.commitSha='a'.repeat(40);
 await denial(f.gate.review(f.request),'X_OBSERVATION_UNTRUSTED_OR_STALE');
});
test('X26 live R2 lifecycle drift prevents blindly merging rules',async()=>{
 const f=fixture();f.infra.lifecycleRules[0].enabled=false;
 await denial(f.gate.review(f.request),'X_R2_LIFECYCLE_DRIFT_REQUIRES_REAUDIT');
});
test('X27 new unknown pre-existing deletion rule also forces re-audit',async()=>{
 const f=fixture();f.infra.lifecycleRules.push({id:'OTHER',enabled:true});
 await denial(f.gate.review(f.request),'X_R2_LIFECYCLE_DRIFT_REQUIRES_REAUDIT');
});
test('X28 client cannot inject untrusted object keys in collector evidence',async()=>{
 const f=fixture();f.infra.objectKeys=['private-name.pdf'];
 await denial(f.gate.review(f.request),'X_OBSERVATION_UNTRUSTED_OR_STALE');
});
test('X29 trusted QA plan cannot be changed after evaluation',async()=>{
 let calls=0,fx;
 fx=fixture({readTrustedIdentity:async()=>{calls++;if(calls>1){
  const out=copy(fx.identity);out.noExistingMerchantChanges=false;return out;
 }return fx.identity;}});
 await denial(fx.gate.review(fx.request),'X_BACKEND_SNAPSHOT_CHANGED');
});
test('X30 trusted hosted observation cannot be changed after initial check',async()=>{
 let calls=0,fx;
 fx=fixture({readTrustedInfrastructure:async()=>{calls++;if(calls>1){
  const out=copy(fx.infra);out.r2.managedPublicEnabled=true;return out;
 }return fx.infra;}});
 await denial(fx.gate.review(fx.request),'X_BACKEND_SNAPSHOT_CHANGED');
});
test('X31 output contains no JWT, reviewer key, object path or private URL',async()=>{
 const r=await fixture().gate.review({infraRef:INFRA,identityRef:AUTH});
 const raw=JSON.stringify(r);assert.equal(r.ok,true);
 for(const s of [INFRA,AUTH,'password','jwt-secret','merchant@','signed_url='])
  assert.equal(raw.includes(s),false);
});
test('X32 reviews never become production release authorization',async()=>{
 const r=await fixture().gate.review({infraRef:INFRA,identityRef:AUTH});
 assert.equal(r.review.productionReleaseApproved,false);
 assert.equal(r.review.allowDataDeletion,false);
 assert.equal(r.review.allowProviderSend,false);
 assert.equal(r.review.allowRealCanary,false);
});
const attackCases=[
 ['public Worker',f=>f.infra.worker.workersDevEnabled=true,'WORKER_PUBLIC_SURFACE'],
 ['Worker domain',f=>f.infra.worker.customDomains=1,'WORKER_PUBLIC_SURFACE'],
 ['R2 domain',f=>f.infra.r2.customDomains=1,'R2_PRIVATE_ENDPOINTS'],
 ['lost binding',f=>f.infra.worker.r2Bound=false,'PRIVATE_WORKER_EXISTENCE'],
 ['unverified prefix',f=>f.infra.verification.prefixZeroObjectsVerified=false,'R2_PREFIX_EMPTY_VERIFIED'],
 ['missing lifecycle backup',f=>f.infra.verification.lifecycleBackupRecorded=false,'R2_LIFECYCLE_BACKUP'],
 ['missing consent',f=>f.infra.verification.ownerDeletionConsentRecorded=false,'R2_OWNER_DELETION_APPROVAL'],
 ['missing scanner',f=>f.infra.verification.actualScannerCdrVerified=false,'R2_SCANNER_CDR_REAL_EVIDENCE'],
 ['no replay bind',f=>f.infra.replay.workerDurableBindingVerified=false,'WORKER_BOUND_ATOMIC_REPLAY'],
 ['no real JWT',f=>f.identity.ownerSessionPairVerified=false,'TWO_AUTH_OWNER_SESSION_ATTESTATIONS']
];
for(const [desc,mutate,reason] of attackCases){
 test('X-A missing hosted proof blocks '+desc,async()=>{
  const f=fixture();mutate(f);
  const r=await f.gate.review(f.request);
  assert.equal(r.ok,true);assert.equal(r.review.blockers.includes(reason),true);
  assert.equal(r.review.release,'HOSTED_NO_GO');
 });
}
const forbiddenPlanCases=[
 ['existing merchant transfer',f=>f.identity.noExistingMerchantChanges=false],
 ['DEMO Products shared',f=>f.identity.noDemoCatalogReuse=false],
 ['RLS migration without approval',f=>f.identity.noRlsChanges=false],
 ['QA Owner account creation pre-approved',f=>f.identity.provisioningApproved=true],
 ['one owner both stores',f=>f.identity.owners=['QA_OWNER_A','QA_OWNER_A']],
 ['store B wrong scope',f=>f.identity.stores=['QA_STORE_A','STORE_LIVE']],
 ['foreign project',f=>f.identity.projectRef='FOREIGN'],
 ['unbounded scope additional flag',f=>f.identity.billingEnabled=true]
];
for(const [desc,mutate] of forbiddenPlanCases){
 test('X-Q disposition rejects '+desc,async()=>{
  const f=fixture();mutate(f);
  await denial(f.gate.review(f.request),'X_QA_OWNER_SCOPE_UNSAFE');
 });
}

test('X33 Access Bypass policy blocks even if test-only denied and operator success are both true',async()=>{
 const f=fixture();
 Object.assign(f.infra.access,{policiesReturned:2,bypassPolicyCount:1,
  externalDeniedCanaryVerified:true,externalAuthorizedCanaryVerified:true});
 const r=await f.gate.review(f.request);
 assert.equal(r.ok,true);assert.equal(r.review.blockers.includes('ACCESS_APP_UNAUTH_PROBE'),true);
});
test('X34 anonymous deny alone cannot substitute valid protected operator acceptance',async()=>{
 const f=fixture();
 Object.assign(f.infra.access,{policiesReturned:1,bypassPolicyCount:0,
  externalDeniedCanaryVerified:true,externalAuthorizedCanaryVerified:false});
 const r=await f.gate.review(f.request);
 assert.equal(r.ok,true);assert.equal(r.review.blockers.includes('ACCESS_APP_UNAUTH_PROBE'),true);
});
test('X35 an Access app without policies cannot claim authenticated acceptance via forged canary flags',async()=>{
 const f=fixture();
 Object.assign(f.infra.access,{policiesReturned:0,bypassPolicyCount:0,
  externalDeniedCanaryVerified:true,externalAuthorizedCanaryVerified:true});
 const r=await f.gate.review(f.request);
 assert.equal(r.ok,true);assert.equal(r.review.blockers.includes('ACCESS_APP_UNAUTH_PROBE'),true);
});
