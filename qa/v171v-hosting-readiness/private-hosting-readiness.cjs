'use strict';
// V17.1V: SOURCE-ONLY design review. Never deploy, open a route, create Auth
// users/memberships, upload evidence, read tenant data or send messages.
const crypto=require('node:crypto');
const {isDeepStrictEqual}=require('node:util');
const REFS=/^(?:infra|qaplan)_[A-Za-z0-9_-]{20,72}$/;
const SHA=/^[a-f0-9]{40}$/;
const ID=/^[A-Za-z0-9_.:-]{1,96}$/;
const DIGEST=/^[a-f0-9]{64}$/;
const ROLES=['INFRA_SECURITY_REVIEWER','AUTH_RLS_REVIEWER'];
const PROJECT='ifxlvrhyjhbzbrkdsida';
const INFRA_CONTROLS=Object.freeze({
 worker:{
  mode:'INACTIVE_ISOLATED_QA_ONLY',access:'WORKER_LEVEL_ACCESS_DENY_DEFAULT',
  bypass:'FORBIDDEN',workersDev:'DISABLED',previewRoutes:'PROTECTED',
  publicWebhooks:'DISABLED',operatorMfa:'REQUIRED',
  credentials:'MANAGED_SECRETS_LEAST_PRIVILEGE',logs:'REDACTED_NO_PII'
 },
 storage:{
  service:'PRIVATE_R2',publicDevUrl:'DISABLED',
  publicCustomDomains:'NONE',publicObjectUrls:'FORBIDDEN',
  directClientUpload:'DISABLED',evidenceVersionBinding:'IMMUTABLE_DIGEST_AND_VERSION',
  contentReview:'QUARANTINE_MALWARE_SCAN_CDR_BEFORE_APPROVAL',
  tenantPartition:'QA_ONLY_NO_CUSTOMER_DATA'
 },
 replay:{mode:'ATOMIC_DURABLE_RESERVATION',ttlSeconds:600},
 limits:{maxObjectBytes:5000000,maxTotalBytes:100000000,
  maxDailyRequests:1000,maxDeploymentSpendUsd:0},
 lifecycle:{retentionHours:24,audit:'PII_FREE_AND_TAMPER_EVIDENT',
  deleteApproval:'SEPARATE_OWNER_AND_OPERATOR',
  rollback:'CHECKPOINTED_AND_APPROVAL_REQUIRED'}
});
const QA_CONTROLS=Object.freeze({
 tenant:'NEW_DISPOSABLE_QA_TENANT_PROPOSED_ONLY',
 stores:['QA_STORE_A','QA_STORE_B'],
 ownerSlots:['QA_OWNER_A','QA_OWNER_B'],
 ownership:'TWO_DIFFERENT_OWNERS_SAME_TENANT',
 identities:'TWO_DISTINCT_REAL_AUTH_SESSIONS_REQUIRED_FOR_FUTURE_UAT',
 catalog:'SEPARATE_FROM_DEMO_AND_LIVE',
 rows:'SYNTHETIC_NON_CUSTOMER',
 ownerTransfer:'FORBIDDEN',
 privilege:'LEAST_PRIVILEGE_NO_BYPASSRLS_OR_SERVICE_ROLE',
 rls:'STORE_SCOPED_MIGRATION_REVIEW_REQUIRED',
 operations:'ZERO_WRITES_UNTIL_SEPARATE_EXPLICIT_APPROVAL',
 backup:'REQUIRED_BEFORE_FIRST_MUTATION',
 rollback:'ONLY_CREATED_QA_FIXTURES_AFTER_SEPARATE_APPROVAL',
 budget:'ZERO_COST_CHANGES_UNTIL_SEPARATE_APPROVAL'
});
function deny(reason){return Object.freeze({ok:false,reason});}
function exact(x,keys){
 return !!x&&typeof x==='object'&&!Array.isArray(x)&&
 Object.getPrototypeOf(x)===Object.prototype&&
 Object.keys(x).sort().join('|')===keys.slice().sort().join('|');
}
function canonical(x,depth=0){
 if(depth>10)throw Error('DEPTH');
 if(x===null||typeof x==='string'||typeof x==='boolean')return JSON.stringify(x);
 if(typeof x==='number'&&Number.isSafeInteger(x))return JSON.stringify(x);
 if(Array.isArray(x))return '['+x.map(v=>canonical(v,depth+1)).join(',')+']';
 if(x&&typeof x==='object'&&Object.getPrototypeOf(x)===Object.prototype)
  return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k],depth+1)).join(',')+'}';
 throw Error('MALFORMED');
}
function digest(x){return crypto.createHash('sha256').update(canonical(x),'utf8').digest('hex');}
function createPrivateHostingReadinessGate({
 expectedCommitSha,lookupBlueprint,lookupQaTenantPlan,
 getPrivateReviewAttestations,lookupPrivateReviewerKey,reserveReviewOnce,
 clock=()=>Date.now()
}={}){
 if(!SHA.test(String(expectedCommitSha||''))||
    [lookupBlueprint,lookupQaTenantPlan,getPrivateReviewAttestations,
     lookupPrivateReviewerKey,reserveReviewOnce,clock].some(x=>typeof x!=='function'))
  throw Error('PRIVATE_HOSTING_TRUST_CONFIG_REQUIRED');
 const pending=new Set();
 async function reviewBlueprint(request={}){
  if(!exact(request,['infrastructureRef','qaPlanRef','reviewNonce']))
   return deny('HOSTING_REFERENCE_SHAPE');
  const {infrastructureRef,qaPlanRef,reviewNonce}=request;
  if(typeof infrastructureRef!=='string'||typeof qaPlanRef!=='string'||
     !REFS.test(infrastructureRef)||!infrastructureRef.startsWith('infra_')||
     !REFS.test(qaPlanRef)||!qaPlanRef.startsWith('qaplan_')||
     typeof reviewNonce!=='string'||!/^qa_[A-Za-z0-9_-]{20,90}$/.test(reviewNonce))
    return deny('HOSTING_REFERENCE_SHAPE');
  const now=clock();
  if(!Number.isSafeInteger(now)||now<=0)return deny('HOSTING_CLOCK');
  const key=infrastructureRef+'|'+qaPlanRef+'|'+reviewNonce;
  if(pending.has(key))return deny('HOSTING_REVIEW_ALREADY_ATTEMPTED');
  // Prevent same-process concurrent requests BEFORE any awaited lookup.
  // Never clear after failure: a fresh independently authorized nonce is needed.
  pending.add(key);
  let infra,qa;
  try{
   [infra,qa]=await Promise.all([
    lookupBlueprint({ref:infrastructureRef,projectRef:PROJECT}),
    lookupQaTenantPlan({ref:qaPlanRef,projectRef:PROJECT})
   ]);
  }catch{return deny('HOSTING_PRIVATE_REGISTRY_UNAVAILABLE');}
  if(!exact(infra,['ref','projectRef','commitSha','kind','status','controls'])||
    infra.ref!==infrastructureRef||infra.projectRef!==PROJECT||
    infra.commitSha!==expectedCommitSha||
    infra.kind!=='PRIVATE_EVIDENCE_HOSTING_BLUEPRINT'||
    infra.status!=='REVIEWED_DESIGN_NOT_DEPLOYED'||
    !isDeepStrictEqual(infra.controls,INFRA_CONTROLS))
    return deny('HOSTING_INFRA_BLUEPRINT_UNSAFE');
  if(!exact(qa,['ref','projectRef','commitSha','kind','status','controls'])||
    qa.ref!==qaPlanRef||qa.projectRef!==PROJECT||
    qa.commitSha!==expectedCommitSha||
    qa.kind!=='DISPOSABLE_QA_TENANT_STORE_PLAN'||
    qa.status!=='REVIEWED_DESIGN_NOT_AUTHORIZED'||
    !isDeepStrictEqual(qa.controls,QA_CONTROLS))
    return deny('HOSTING_QA_TENANT_PLAN_UNSAFE');
  const infraDigest=digest(infra),qaDigest=digest(qa);
  let approvals;
  try{approvals=await getPrivateReviewAttestations({
   infraDigest,qaDigest,projectRef:PROJECT,commitSha:expectedCommitSha,
   reviewNonce
  });}catch{return deny('HOSTING_REVIEW_ATTESTATION_BACKEND_UNAVAILABLE');}
  if(!Array.isArray(approvals)||approvals.length!==2||
     new Set(approvals.map(x=>x?.role)).size!==2)
    return deny('HOSTING_APPROVALS_SHAPE');
  const actors=new Set(),enrolled=[];
  for(const role of ROLES){
   const a=approvals.find(x=>x.role===role);
   if(!exact(a,['role','kid','signature','issuedAtMs','expiresAtMs'])||
      typeof a.kid!=='string'||!ID.test(a.kid)||
      typeof a.signature!=='string'||
      !Number.isSafeInteger(a.issuedAtMs)||
      !Number.isSafeInteger(a.expiresAtMs)||
      a.expiresAtMs<=now||a.issuedAtMs>now+30000||
      a.expiresAtMs-a.issuedAtMs>600000||
      a.issuedAtMs<now-600000)
    return deny('HOSTING_APPROVAL_SCOPE_OR_EXPIRY');
   let k;
   try{k=await lookupPrivateReviewerKey({role,kid:a.kid});}
   catch{return deny('HOSTING_KEY_REGISTRY_UNAVAILABLE');}
   if(k?.active!==true||k?.enrollment!=='INDEPENDENT_PRIVATE_REVIEWER'||
      k?.role!==role||k?.kid!==a.kid||typeof k?.signerRef!=='string'||
      !ID.test(k.signerRef)||actors.has(k.signerRef)||
      k.publicJwk?.kty!=='OKP'||k.publicJwk?.crv!=='Ed25519'||
      typeof k.publicJwk?.x!=='string'||k.publicJwk?.d!==undefined)
    return deny('HOSTING_REVIEWER_NOT_INDEPENDENT');
   actors.add(k.signerRef);
   const content=Buffer.from('TIEN404_V171V_PRIVATE_REVIEW_V1\0'+canonical({
    role,kid:a.kid,projectRef:PROJECT,commitSha:expectedCommitSha,
    infraDigest,qaDigest,reviewNonce,
    issuedAtMs:a.issuedAtMs,expiresAtMs:a.expiresAtMs
   }),'utf8');
   let valid=false;
   try{
    if(/^[A-Za-z0-9_-]{85,88}$/.test(a.signature)){
     const sig=Buffer.from(a.signature,'base64url');
     if(sig.length===64&&sig.toString('base64url')===a.signature)
      valid=crypto.verify(null,content,
       crypto.createPublicKey({key:k.publicJwk,format:'jwk'}),sig);
    }
   }catch{}
   if(!valid)return deny('HOSTING_REVIEW_SIGNATURE_INVALID');
   enrolled.push({role,kid:a.kid,signerRef:k.signerRef,pubX:k.publicJwk.x,
    expiresAtMs:a.expiresAtMs});
  }
  let reserved;
  try{reserved=await reserveReviewOnce({
   nonce:reviewNonce,digest:digest({infraDigest,qaDigest,reviewNonce}),
   ttlMs:600000,projectRef:PROJECT
  });}catch{return deny('HOSTING_DURABLE_REPLAY_BACKEND_UNAVAILABLE');}
  if(reserved!==true)return deny('HOSTING_REVIEW_REPLAY_OR_NON_ATOMIC');
  try{
   const [newInfra,newQa]=await Promise.all([
    lookupBlueprint({ref:infrastructureRef,projectRef:PROJECT}),
    lookupQaTenantPlan({ref:qaPlanRef,projectRef:PROJECT})
   ]);
   if(digest(newInfra)!==infraDigest||digest(newQa)!==qaDigest)
    return deny('HOSTING_BLUEPRINT_CHANGED_AT_COMMIT');
   for(const old of enrolled){
    const k=await lookupPrivateReviewerKey({role:old.role,kid:old.kid});
    if(k?.active!==true||k?.enrollment!=='INDEPENDENT_PRIVATE_REVIEWER'||
       k.role!==old.role||k.kid!==old.kid||
       k.signerRef!==old.signerRef||k.publicJwk?.x!==old.pubX||
       k.publicJwk?.d!==undefined)
      return deny('HOSTING_REVIEWER_REVOKED_AT_COMMIT');
   }
  }catch{return deny('HOSTING_RECHECK_BACKEND_UNAVAILABLE');}
  const committed=clock();
  if(!Number.isSafeInteger(committed)||
      enrolled.some(x=>x.expiresAtMs<=committed))
   return deny('HOSTING_REVIEW_EXPIRED_AT_COMMIT');
  // Signed design review is never evidence of actual Cloudflare deployment,
  // an existing private R2 bucket, owner Auth identity, or real file scan.
  return {ok:true,plan:Object.freeze({
   kind:'PRIVATE_INFRA_QA_TENANT_DESIGN_REVIEW_ONLY',
   projectRef:PROJECT,plannedStoreCount:2,plannedOwnerCount:2,
   independentDesignReviewerCount:2,
   blueprintDigest:infraDigest,qaPlanDigest:qaDigest,
   realCloudflareAccessVerified:false,realR2BucketVerified:false,
   realQaAuthOwnersVerified:false,realStoreRlsVerified:false,
   realPrivateEvidenceVerified:false,
   actualWorkerDeployed:0,actualBucketsCreated:0,
   actualQaUsersCreated:0,actualStoreMembershipsWritten:0,
   allowDeployment:false,allowAuthWrites:false,
   allowStoreOrRlsWrites:false,allowSecretChanges:false,
   allowEvidenceUpload:false,allowProviderSends:false,
   allowBilling:false,productionReleaseApproved:false,
   release:'HOSTED_NO_GO'
  })};
 }
 return Object.freeze({reviewBlueprint});
}
module.exports={createPrivateHostingReadinessGate,INFRA_CONTROLS,QA_CONTROLS};
