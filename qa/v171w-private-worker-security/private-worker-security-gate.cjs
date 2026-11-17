'use strict';
// TIEN404 V17.1W — source-only, NO SEND/NO DEPLOY private readiness admission.
// All live Cloudflare/Supabase reads must occur in separately approved private collectors.
// This module does NOT read Cloudflare, Supabase, R2, files, JWTs or network.
const crypto=require('node:crypto');
const {isDeepStrictEqual}=require('node:util');
const PROJECT='ifxlvrhyjhbzbrkdsida';
const WORKER='tien404-rpc16-merchant-evidence-inactive-staging';
const BUCKET='tien404-merchant-evidence-quarantine-staging';
const ACCESS='TIEN404 RPC16 Merchant Evidence Staging — DENY ALL';
const REF=/^(?:audit|qaplan)_[A-Za-z0-9_-]{22,72}$/;
const NONCE=/^qa_[A-Za-z0-9_-]{22,84}$/;
const SHA=/^[0-9a-f]{40}$/;
const SAFE=/^[A-Za-z0-9_.:-]{1,96}$/;
const ROLES=Object.freeze(['INFRA_SECURITY','AUTH_RLS_INDEPENDENT']);
const TYPE={snapshot:'TIEN404_V171W_WORKER_R2_OBSERVATION_V1',
 plan:'TIEN404_V171W_DISPOSABLE_QA_AUTH_PLAN_V1'};
function deny(reason){return Object.freeze({ok:false,reason});}
function isObj(x){return x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;}
function exact(x,keys){return isObj(x)&&Object.keys(x).sort().join('|')===keys.slice().sort().join('|');}
function canonical(x,level=0){
 if(level>12)throw Error('DEPTH');
 if(x===null||typeof x==='string'||typeof x==='boolean')return JSON.stringify(x);
 if(typeof x==='number'&&Number.isSafeInteger(x))return JSON.stringify(x);
 if(Array.isArray(x))return '['+x.map(v=>canonical(v,level+1)).join(',')+']';
 if(isObj(x))return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k],level+1)).join(',')+'}';
 throw Error('INVALID_SIGNED_DATA');
}
function digest(x){return crypto.createHash('sha256').update(canonical(x)).digest('hex');}
function safeNumber(x){return Number.isSafeInteger(x)&&x>=0&&x<=100000;}
function createPrivateWorkerSecurityGate({expectedCommitSha,loadTrustedObservation,
 loadTrustedQaPlan,getIndependentApprovals,lookupReviewerKey,reserveAtomicNonce,
 clock=()=>Date.now()}={}){
 if(!SHA.test(String(expectedCommitSha||''))||
   [loadTrustedObservation,loadTrustedQaPlan,getIndependentApprovals,
    lookupReviewerKey,reserveAtomicNonce,clock].some(f=>typeof f!=='function'))
  throw Error('TRUSTED_PRIVATE_EVIDENCE_BACKENDS_REQUIRED');
 const attempts=new Set();
 async function review({auditRef,qaPlanRef,nonce}={}){
  if(!exact(arguments[0],['auditRef','qaPlanRef','nonce'])||
    typeof auditRef!=='string'||!REF.test(auditRef)||!auditRef.startsWith('audit_')||
    typeof qaPlanRef!=='string'||!REF.test(qaPlanRef)||!qaPlanRef.startsWith('qaplan_')||
    typeof nonce!=='string'||!NONCE.test(nonce))
   return deny('W_INPUT_REFERENCE_SHAPE');
  const now=clock();
  if(!Number.isSafeInteger(now)||now<=0)return deny('W_CLOCK_UNTRUSTED');
  if(attempts.has(nonce))return deny('W_SAME_PROCESS_REPLAY');
  attempts.add(nonce); // before first awaited operation; globally single-use nonce
  let obs,plan;
  try{[obs,plan]=await Promise.all([
    loadTrustedObservation({ref:auditRef,projectRef:PROJECT}),
    loadTrustedQaPlan({ref:qaPlanRef,projectRef:PROJECT})
   ]);}catch{return deny('W_PRIVATE_REGISTRY_UNAVAILABLE');}
  const obsKeys=['ref','schema','projectRef','commitSha','collectedAtMs','worker','access','r2','replay','auth'];
  if(!exact(obs,obsKeys)||obs.ref!==auditRef||obs.schema!==TYPE.snapshot||
    obs.projectRef!==PROJECT||obs.commitSha!==expectedCommitSha||
    !Number.isSafeInteger(obs.collectedAtMs)||obs.collectedAtMs>now+30000||
    now-obs.collectedAtMs>300000)
   return deny('W_SNAPSHOT_UNTRUSTED');
  if(!exact(obs.worker,['name','exists','workersDevEnabled','previewsEnabled','customDomains','r2Binding'])||
    obs.worker.name!==WORKER||obs.worker.exists!==true||
    typeof obs.worker.workersDevEnabled!=='boolean'||
    typeof obs.worker.previewsEnabled!=='boolean'||
    !safeNumber(obs.worker.customDomains)||
    typeof obs.worker.r2Binding!=='boolean'||
    !exact(obs.access,['name','exists','policies','externalDenyProbe'])||
    obs.access.name!==ACCESS||typeof obs.access.exists!=='boolean'||
    !safeNumber(obs.access.policies)||typeof obs.access.externalDenyProbe!=='boolean'||
    !exact(obs.r2,['name','exists','managedPublic','customDomains',
       'objectDeletionPolicyAttested','lockRuleCount','malwareScannerAttested',
       'cdrAttested','objectVersionProofAttested'])||
    obs.r2.name!==BUCKET||typeof obs.r2.exists!=='boolean'||
    typeof obs.r2.managedPublic!=='boolean'||!safeNumber(obs.r2.customDomains)||
    !safeNumber(obs.r2.lockRuleCount)||
    ['objectDeletionPolicyAttested','malwareScannerAttested','cdrAttested',
      'objectVersionProofAttested'].some(k=>typeof obs.r2[k]!=='boolean')||
    !exact(obs.replay,['namespaceCount','workerBindingAttested','atomicReplayTestAttested'])||
    !safeNumber(obs.replay.namespaceCount)||
    typeof obs.replay.workerBindingAttested!=='boolean'||
    typeof obs.replay.atomicReplayTestAttested!=='boolean'||
    !exact(obs.auth,['sameTenantTwoStoreOwnerPairs','sameTenantSessionPairs','storeRlsProofAttested'])||
    !safeNumber(obs.auth.sameTenantTwoStoreOwnerPairs)||
    !safeNumber(obs.auth.sameTenantSessionPairs)||
    typeof obs.auth.storeRlsProofAttested!=='boolean')
   return deny('W_SNAPSHOT_SCHEMA');
  const planKeys=['ref','schema','projectRef','commitSha','status','tenantMode','stores',
    'owners','noExistingMerchantTransfer','noRealCustomerData','noProductionChanges',
    'noAuthWrites','noStoreRlsWrites','noProviderCalls','noNewSpend',
    'backupRequired','twoIndependentRealSessionsRequired','storeRlsProofRequired'];
  if(!exact(plan,planKeys)||plan.ref!==qaPlanRef||
   plan.schema!==TYPE.plan||plan.projectRef!==PROJECT||
   plan.commitSha!==expectedCommitSha||plan.status!=='REVIEW_ONLY_NOT_APPROVED'||
   plan.tenantMode!=='NEW_DISPOSABLE_QA_TENANT_PROPOSED'||
   !Array.isArray(plan.stores)||!isDeepStrictEqual(plan.stores,['QA_STORE_A','QA_STORE_B'])||
   !Array.isArray(plan.owners)||!isDeepStrictEqual(plan.owners,['QA_OWNER_A','QA_OWNER_B'])||
   plan.noExistingMerchantTransfer!==true||plan.noRealCustomerData!==true||
   plan.noProductionChanges!==true||plan.noAuthWrites!==true||
   plan.noStoreRlsWrites!==true||plan.noProviderCalls!==true||
   plan.noNewSpend!==true||plan.backupRequired!==true||
   plan.twoIndependentRealSessionsRequired!==true||
   plan.storeRlsProofRequired!==true)
   return deny('W_QA_PROVISIONING_PLAN_UNSAFE');
  const obsDigest=digest(obs),planDigest=digest(plan);
  let approvals;
  try{approvals=await getIndependentApprovals({
    obsDigest,planDigest,projectRef:PROJECT,commitSha:expectedCommitSha,nonce
  });}catch{return deny('W_APPROVAL_SERVICE_UNAVAILABLE');}
  if(!Array.isArray(approvals)||approvals.length!==2||
    new Set(approvals.map(a=>a?.role)).size!==2||
    !ROLES.every(role=>approvals.some(a=>a.role===role)))
   return deny('W_APPROVAL_ROLE_SHAPE');
  const people=new Set(),keyIds=new Set(),enrolled=[];
  for(const role of ROLES){
   const a=approvals.find(a=>a.role===role);
   if(!exact(a,['role','kid','signature','issuedAtMs','expiresAtMs'])||
      typeof a.kid!=='string'||!SAFE.test(a.kid)||keyIds.has(a.kid)||
      typeof a.signature!=='string'||
      !Number.isSafeInteger(a.issuedAtMs)||!Number.isSafeInteger(a.expiresAtMs)||
      a.issuedAtMs>now+30000||a.issuedAtMs<now-600000||
      a.expiresAtMs<=now||a.expiresAtMs-a.issuedAtMs>600000)
    return deny('W_SIGNER_SCOPE_OR_EXPIRY');
   keyIds.add(a.kid);
   let k;
   try{k=await lookupReviewerKey({role,kid:a.kid});}catch{return deny('W_REVIEWER_REGISTRY_UNAVAILABLE');}
   if(!k||k.active!==true||k.role!==role||k.kid!==a.kid||
      k.enrollment!=='INDEPENDENT_PRIVATE_REVIEWER'||
      typeof k.signerRef!=='string'||!SAFE.test(k.signerRef)||people.has(k.signerRef)||
      !isObj(k.publicJwk)||k.publicJwk.kty!=='OKP'||k.publicJwk.crv!=='Ed25519'||
      typeof k.publicJwk.x!=='string'||k.publicJwk.d!==undefined)
    return deny('W_SIGNER_NOT_ENROLLED_OR_NOT_INDEPENDENT');
   people.add(k.signerRef);
   const msg=Buffer.from('TIEN404_V171W_TRUSTED_HOST_AUDIT_APPROVAL_V1\0'+canonical({
    role,kid:a.kid,obsDigest,planDigest,projectRef:PROJECT,
    commitSha:expectedCommitSha,nonce,issuedAtMs:a.issuedAtMs,
    expiresAtMs:a.expiresAtMs
   }));
   let good=false;
   try{if(/^[A-Za-z0-9_-]{85,88}$/.test(a.signature)){
    const sig=Buffer.from(a.signature,'base64url');
    if(sig.length===64&&sig.toString('base64url')===a.signature)
     good=crypto.verify(null,msg,crypto.createPublicKey({key:k.publicJwk,format:'jwk'}),sig);
   }}catch{}
   if(!good)return deny('W_SIGNER_CRYPTO_INVALID');
   enrolled.push({role,kid:a.kid,signerRef:k.signerRef,x:k.publicJwk.x,expiresAt:a.expiresAtMs});
  }
  let reserved;
  try{reserved=await reserveAtomicNonce({nonce,digest:digest({obsDigest,planDigest,nonce}),
    ttlMs:600000,projectRef:PROJECT});}catch{return deny('W_ATOMIC_REPLAY_SERVICE_UNAVAILABLE');}
  if(reserved!==true)return deny('W_NONCE_REPLAY_OR_NON_ATOMIC');
  try{
   const [o2,p2]=await Promise.all([
    loadTrustedObservation({ref:auditRef,projectRef:PROJECT}),
    loadTrustedQaPlan({ref:qaPlanRef,projectRef:PROJECT})
   ]);
   if(digest(o2)!==obsDigest||digest(p2)!==planDigest)
    return deny('W_PRIVATE_EVIDENCE_DRIFT_AT_COMMIT');
   for(const old of enrolled){
    const k=await lookupReviewerKey({role:old.role,kid:old.kid});
    if(!k||k.active!==true||k.enrollment!=='INDEPENDENT_PRIVATE_REVIEWER'||
       k.role!==old.role||k.kid!==old.kid||
       k.signerRef!==old.signerRef||k.publicJwk?.x!==old.x||
       k.publicJwk?.d!==undefined)
     return deny('W_SIGNER_REVOKED_AT_COMMIT');
   }
  }catch{return deny('W_RECHECK_SERVICE_UNAVAILABLE');}
  const commitTime=clock();
  if(!Number.isSafeInteger(commitTime)||enrolled.some(x=>x.expiresAt<=commitTime)||
      commitTime-obs.collectedAtMs>300000)
   return deny('W_EVIDENCE_EXPIRED_AT_COMMIT');
  const gaps=[];
  if(!obs.worker.exists||obs.worker.workersDevEnabled||
     obs.worker.previewsEnabled||obs.worker.customDomains!==0)
   gaps.push('WORKER_PUBLIC_SURFACE_NOT_ISOLATED');
  if(!obs.worker.r2Binding||!obs.r2.exists||
     obs.r2.managedPublic||obs.r2.customDomains!==0)
   gaps.push('R2_PRIVATE_BINDING_NOT_VERIFIED');
  if(!obs.access.exists||obs.access.policies!==0||
     !obs.access.externalDenyProbe)
   gaps.push('INDEPENDENT_ACCESS_DENY_PROBE_MISSING');
  if(!obs.r2.objectDeletionPolicyAttested)
   gaps.push('R2_OBJECT_DELETION_RETENTION_NOT_ATTESTED');
  if(obs.r2.lockRuleCount===0||!obs.r2.objectVersionProofAttested)
   gaps.push('R2_OBJECT_IMMUTABILITY_NOT_ATTESTED');
  if(!obs.r2.malwareScannerAttested||!obs.r2.cdrAttested)
   gaps.push('REAL_FILE_SCANNER_CDR_NOT_ATTESTED');
  if(!obs.replay.workerBindingAttested||
     !obs.replay.atomicReplayTestAttested)
   gaps.push('HOSTED_ATOMIC_REPLAY_NOT_ATTESTED');
  if(obs.auth.sameTenantTwoStoreOwnerPairs<1||obs.auth.sameTenantSessionPairs<1)
   gaps.push('TWO_REAL_SAME_TENANT_OWNER_SESSIONS_NOT_ADMITTED');
  if(!obs.auth.storeRlsProofAttested)
   gaps.push('REAL_STORE_RLS_NOT_ATTESTED');
  return {ok:true,plan:Object.freeze({
    kind:'PRIVATE_WORKER_R2_AUTH_GAP_REVIEW_ONLY',
    observedAtMs:obs.collectedAtMs,
    projectRef:PROJECT,
    reviewDigest:digest({obsDigest,planDigest,nonce}),
    evidenceSource:'SIGNED_PRIVATE_COLLECTOR_SOURCE_ONLY',
    independentReviewers:2,plannedStores:2,
    gaps:Object.freeze(gaps),
    gapCount:gaps.length,
    currentReadiness:gaps.length===0?'SOURCE_POLICY_CONFORMS_NOT_HOSTED_ACCEPTANCE':'HOSTED_ACCEPTANCE_BLOCKED',
    independentExternalAccessCanaryActuallyRun:false,
    realProviderOrOwnerUatActuallyRun:false,
    actualAuthUsersCreated:0,actualStoreWrites:0,actualUploads:0,
    actualMessagesSent:0,actualCloudflareChanges:0,
    allowWorkerDeploy:false,allowR2Changes:false,
    allowAuthProvision:false,allowStoreRlsChanges:false,
    allowCredentials:false,allowProviderCalls:false,
    productionReleaseApproved:false,release:'HOSTED_NO_GO'
  })};
 }
 return Object.freeze({review});
}
module.exports={createPrivateWorkerSecurityGate};
