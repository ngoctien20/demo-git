'use strict';
// TIEN404 V17.1X -- deterministic, READ-ONLY approval package builder.
// Source-only. No network, storage, credential, Auth, RLS, provider or billing I/O.
// This is not an authorized Cloudflare API mutation or real owner verification.
const crypto=require('node:crypto');
const {isDeepStrictEqual}=require('node:util');
const PROJECT='ifxlvrhyjhbzbrkdsida';
const BUCKET='tien404-merchant-evidence-quarantine-staging';
const WORKER='tien404-rpc16-merchant-evidence-inactive-staging';
const ACCESS='TIEN404 RPC16 Merchant Evidence Staging — DENY ALL';
const PREFIX='qa-v171x-disposable/';
const RULE_ID='TIEN404 V17.1X Disposable QA Evidence TTL 24h';
const DEFAULT_ID='Default Multipart Abort Rule';
const SHA=/^[a-f0-9]{40}$/;
const EXACT_REF=/^(?:infra|authplan)_[A-Za-z0-9_-]{24,80}$/;
const originalRule=Object.freeze({
 id:DEFAULT_ID,enabled:true,conditions:{},
 abortMultipartUploadsTransition:{condition:{type:'Age',maxAge:604800}}
});
const candidateRule=Object.freeze({
 id:RULE_ID,enabled:false,conditions:{prefix:PREFIX},
 deleteObjectsTransition:{condition:{type:'Age',maxAge:86400}}
});
function plain(x){return x&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;}
function exact(x,keys){return plain(x)&&Object.keys(x).sort().join('|')===keys.slice().sort().join('|');}
function deny(reason){return Object.freeze({ok:false,reason});}
function stable(x,depth=0){
 if(depth>12)throw Error('DEPTH');
 if(x===null||typeof x==='string'||typeof x==='boolean')return JSON.stringify(x);
 if(Number.isSafeInteger(x))return JSON.stringify(x);
 if(Array.isArray(x))return '['+x.map(y=>stable(y,depth+1)).join(',')+']';
 if(plain(x))return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+stable(x[k],depth+1)).join(',')+'}';
 throw Error('INVALID');
}
const digest=x=>crypto.createHash('sha256').update(stable(x)).digest('hex');
const copy=x=>JSON.parse(JSON.stringify(x));
const ALL_CHECKS=Object.freeze([
 'PRIVATE_WORKER_EXISTENCE','WORKER_PUBLIC_SURFACE','ACCESS_APP_UNAUTH_PROBE',
 'R2_PRIVATE_ENDPOINTS','R2_PREFIX_EMPTY_VERIFIED','R2_LIFECYCLE_BACKUP',
 'R2_OWNER_DELETION_APPROVAL','R2_RETENTION_REAL_CANARY',
 'R2_SCANNER_CDR_REAL_EVIDENCE','R2_LOCK_CONFLICT_REVIEW',
 'WORKER_BOUND_ATOMIC_REPLAY','REAL_REPLAY_RESTART_CANARY',
 'NEW_QA_TENANT_SCOPE_APPROVAL','TWO_AUTH_OWNER_SESSION_ATTESTATIONS',
 'STORE_LEVEL_RLS_ACTUAL_JWT_UAT','BUDGET_AND_ROLLBACK_APPROVAL'
]);
function createHostedReadinessPlan({expectedCommitSha,readTrustedInfrastructure,
 readTrustedIdentity,clock=()=>Date.now()}={}){
 if(!SHA.test(String(expectedCommitSha||''))||
    typeof readTrustedInfrastructure!=='function'||
    typeof readTrustedIdentity!=='function'||
    typeof clock!=='function')throw Error('PRIVATE_TRUSTED_READERS_REQUIRED');
 async function review(request={}){
  if(!exact(request,['infraRef','identityRef'])||
   typeof request.infraRef!=='string'||!EXACT_REF.test(request.infraRef)||
   !request.infraRef.startsWith('infra_')||
   typeof request.identityRef!=='string'||!EXACT_REF.test(request.identityRef)||
   !request.identityRef.startsWith('authplan_'))
   return deny('X_REFERENCE_SHAPE');
  const now=clock();if(!Number.isSafeInteger(now)||now<=0)return deny('X_TRUSTED_CLOCK');
  let x,a;
  try{
   [x,a]=await Promise.all([
    readTrustedInfrastructure({ref:request.infraRef,projectRef:PROJECT}),
    readTrustedIdentity({ref:request.identityRef,projectRef:PROJECT})
   ]);
  }catch{return deny('X_TRUSTED_READ_UNAVAILABLE');}
  if(!exact(x,['ref','projectRef','commitSha','collectedAtMs','worker','r2','access','replay','lifecycleRules','verification'])||
     x.ref!==request.infraRef||x.projectRef!==PROJECT||x.commitSha!==expectedCommitSha||
     !Number.isSafeInteger(x.collectedAtMs)||x.collectedAtMs>now+30000||
     now-x.collectedAtMs>300000)
   return deny('X_OBSERVATION_UNTRUSTED_OR_STALE');
  const fields={
   worker:['name','exists','workersDevEnabled','previewEnabled','customDomains','r2Bound'],
   r2:['name','exists','managedPublicEnabled','customDomains','lockRuleCount'],
   access:['name','exists','policiesReturned','bypassPolicyCount','externalDeniedCanaryVerified','externalAuthorizedCanaryVerified'],
   replay:['namespacesExist','workerDurableBindingVerified','crossRestartAtomicCanaryVerified'],
   verification:['prefixZeroObjectsVerified','lifecycleBackupRecorded','ownerDeletionConsentRecorded',
     'actualRetentionCanaryVerified','actualScannerCdrVerified','lockConflictIndependentlyReviewed']
  };
  for(const [section,keys] of Object.entries(fields))
   if(!exact(x[section],keys))return deny('X_OBSERVATION_SCHEMA');
  if(x.worker.name!==WORKER||x.worker.exists!==true||
   x.r2.name!==BUCKET||x.r2.exists!==true||
   x.access.name!==ACCESS||x.access.exists!==true||
   typeof x.worker.workersDevEnabled!=='boolean'||
   typeof x.worker.previewEnabled!=='boolean'||
   !Number.isSafeInteger(x.worker.customDomains)||x.worker.customDomains<0||
   typeof x.worker.r2Bound!=='boolean'||
   typeof x.r2.managedPublicEnabled!=='boolean'||
   !Number.isSafeInteger(x.r2.customDomains)||x.r2.customDomains<0||
   !Number.isSafeInteger(x.r2.lockRuleCount)||x.r2.lockRuleCount<0||
   !Number.isSafeInteger(x.access.policiesReturned)||x.access.policiesReturned<0||
   !Number.isSafeInteger(x.access.bypassPolicyCount)||x.access.bypassPolicyCount<0||
   typeof x.access.externalDeniedCanaryVerified!=='boolean'||
   typeof x.access.externalAuthorizedCanaryVerified!=='boolean'||
   !Number.isSafeInteger(x.replay.namespacesExist)||x.replay.namespacesExist<0||
   typeof x.replay.workerDurableBindingVerified!=='boolean'||
   typeof x.replay.crossRestartAtomicCanaryVerified!=='boolean'||
   Object.values(x.verification).some(v=>typeof v!=='boolean'))
    return deny('X_OBSERVATION_VALUES_INVALID');
  if(!Array.isArray(x.lifecycleRules)||x.lifecycleRules.length!==1||
     !isDeepStrictEqual(x.lifecycleRules[0],originalRule))
    return deny('X_R2_LIFECYCLE_DRIFT_REQUIRES_REAUDIT');
  if(!exact(a,['ref','projectRef','commitSha','mode','provisioningApproved',
       'tenantMode','owners','stores','usesOnlySyntheticRows','noExistingMerchantChanges',
       'noServiceRoleBypass','noDemoCatalogReuse','noAuthWrites','noRlsChanges',
       'ownerSessionPairVerified','actualStoreRlsJwtUatVerified',
       'costAndRollbackApproved'])||
     a.ref!==request.identityRef||a.projectRef!==PROJECT||a.commitSha!==expectedCommitSha||
     a.mode!=='DISPOSABLE_QA_REVIEW_ONLY'||a.provisioningApproved!==false||
     a.tenantMode!=='NEW_TENANT_QA_ONLY'||
     !isDeepStrictEqual(a.owners,['QA_OWNER_A','QA_OWNER_B'])||
     !isDeepStrictEqual(a.stores,['QA_STORE_A','QA_STORE_B'])||
     a.usesOnlySyntheticRows!==true||a.noExistingMerchantChanges!==true||
     a.noServiceRoleBypass!==true||a.noDemoCatalogReuse!==true||
     a.noAuthWrites!==true||a.noRlsChanges!==true||
     typeof a.ownerSessionPairVerified!=='boolean'||
     typeof a.actualStoreRlsJwtUatVerified!=='boolean'||
     typeof a.costAndRollbackApproved!=='boolean')
   return deny('X_QA_OWNER_SCOPE_UNSAFE');
  const checks={
   PRIVATE_WORKER_EXISTENCE:x.worker.exists&&x.worker.r2Bound,
   WORKER_PUBLIC_SURFACE:!x.worker.workersDevEnabled&&!x.worker.previewEnabled&&x.worker.customDomains===0,
   ACCESS_APP_UNAUTH_PROBE:x.access.exists===true&&
     x.access.policiesReturned>=1&&x.access.bypassPolicyCount===0&&
     x.access.externalDeniedCanaryVerified&&x.access.externalAuthorizedCanaryVerified,
   R2_PRIVATE_ENDPOINTS:!x.r2.managedPublicEnabled&&x.r2.customDomains===0,
   R2_PREFIX_EMPTY_VERIFIED:x.verification.prefixZeroObjectsVerified,
   R2_LIFECYCLE_BACKUP:x.verification.lifecycleBackupRecorded,
   R2_OWNER_DELETION_APPROVAL:x.verification.ownerDeletionConsentRecorded,
   R2_RETENTION_REAL_CANARY:x.verification.actualRetentionCanaryVerified,
   R2_SCANNER_CDR_REAL_EVIDENCE:x.verification.actualScannerCdrVerified,
   R2_LOCK_CONFLICT_REVIEW:x.verification.lockConflictIndependentlyReviewed,
   WORKER_BOUND_ATOMIC_REPLAY:x.replay.workerDurableBindingVerified,
   REAL_REPLAY_RESTART_CANARY:x.replay.crossRestartAtomicCanaryVerified,
   NEW_QA_TENANT_SCOPE_APPROVAL:a.costAndRollbackApproved,
   TWO_AUTH_OWNER_SESSION_ATTESTATIONS:a.ownerSessionPairVerified,
   STORE_LEVEL_RLS_ACTUAL_JWT_UAT:a.actualStoreRlsJwtUatVerified,
   BUDGET_AND_ROLLBACK_APPROVAL:a.costAndRollbackApproved
  };
  const blockers=ALL_CHECKS.filter(k=>checks[k]!==true);
  let x2,a2;
  try{[x2,a2]=await Promise.all([
   readTrustedInfrastructure({ref:request.infraRef,projectRef:PROJECT}),
   readTrustedIdentity({ref:request.identityRef,projectRef:PROJECT})
  ]);}catch{return deny('X_COMMIT_RECHECK_UNAVAILABLE');}
  if(digest(x)!==digest(x2)||digest(a)!==digest(a2))
   return deny('X_BACKEND_SNAPSHOT_CHANGED');
  if(clock()-x.collectedAtMs>300000)return deny('X_EXPIRED_DURING_REVIEW');
  const previewRules=[copy(originalRule),copy(candidateRule)];
  return {ok:true,review:Object.freeze({
   kind:'PRIVATE_HOSTED_CANARY_AND_R2_APPROVAL_PLAN_ONLY',
   projectRef:PROJECT,workerName:WORKER,bucketName:BUCKET,
   lifecycleStatus:'UNAPPROVED_DRAFT_DISABLED',
   lifecycleCandidatePrefix:PREFIX,lifecycleCandidateMaxAgeSeconds:86400,
   lifecycleExistingRuleCount:1,
   proposedRuleCount:2,
   proposedRulesDigest:digest(previewRules),
   immutableReadOnlySnapshotDigest:digest(x),
   checksPassed:ALL_CHECKS.length-blockers.length,totalChecks:ALL_CHECKS.length,
   blockers:Object.freeze(blockers),
   realCloudflareWorkerCanaryRun:false,
   realR2LifecycleApplied:false,realAuthUsersProvisioned:0,
   allowR2Put:false,allowWorkerDeploy:false,allowAccessPolicyChange:false,
   allowRealCanary:false,allowAuthWrites:false,allowStoreRlsWrites:false,
   allowDataDeletion:false,allowProviderSend:false,
   productionReleaseApproved:false,release:'HOSTED_NO_GO'
  }),preview:Object.freeze({rules:Object.freeze(previewRules),apply:false})};
 }
 return Object.freeze({review});
}
module.exports={createHostedReadinessPlan,originalRule,candidateRule,ALL_CHECKS};
