'use strict';
// TIEN404 V17.2B: pure private-hosted provisioning ADMISSION PREVIEW.
// No network, file, database, Auth Admin, JWT, credentials, tenant writes,
// migration application, provider sends, billing or external side effects.
const crypto=require('node:crypto');
const PROJECT='ifxlvrhyjhbzbrkdsida';
const SHA=/^[a-f0-9]{40}$/;
const REF=/^(?:evidence|approval)_[A-Za-z0-9_-]{24,76}$/;
const NONCE=/^qa_[A-Za-z0-9_-]{24,88}$/;
const ROLES=Object.freeze(['STAGING_INFRA_OWNER','INDEPENDENT_AUTH_SECURITY_REVIEWER']);
const STEPS=Object.freeze([
 'PINNED_STAGING_PROJECT_AND_HEAD',
 'KNOWN_RECOVERY_BACKUP',
 'DISPOSABLE_SQL_ROLLBACK_TESTED',
 'EMPTY_QA_TARGET_SCHEMA_AND_PUBLIC_VIEW',
 'NO_UNRECONCILED_LIVE_QA_MUTATIONS',
 'SIGNED_FOUNDER_QA_PROVISIONING_CONSENT',
 'INDEPENDENT_SECURITY_REVIEW',
 'NO_NEW_PAID_RESOURCE_APPROVAL',
 'PRIVATE_AUTH_ADMIN_SESSION_MFA',
 'PRIVATE_AUTH_USER_CREATION_SCOPE',
 'PRIVATE_DATA_API_VIEW_EXPOSURE_REVIEW',
 'SAME_TENANT_TWO_STORE_MEMBERSHIP_PLAN',
 'TWO_REAL_OWNER_JWT_SESSION_RECEIPTS',
 'REAL_STORE_A_B_POSTGREST_NEGATIVE_QA',
 'SESSION_REVOKED_DENIAL_VERIFIED',
 'QA_ROLLBACK_RESOURCE_LEDGER_READY'
]);
const DENIED=reason=>Object.freeze({ok:false,reason,release:'HOSTED_NO_GO'});
function isObj(x){return x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;}
function exact(x,keys){return isObj(x)&&Object.keys(x).sort().join('|')===keys.slice().sort().join('|');}
function stable(x,depth=0){
 if(depth>12)throw Error('OVERDEEP');
 if(x===null||typeof x==='string'||typeof x==='boolean')return JSON.stringify(x);
 if(typeof x==='number'&&Number.isSafeInteger(x))return JSON.stringify(x);
 if(Array.isArray(x))return '['+x.map(v=>stable(v,depth+1)).join(',')+']';
 if(isObj(x))return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+stable(x[k],depth+1)).join(',')+'}';
 throw Error('UNSIGNED_VALUE');
}
const digest=x=>crypto.createHash('sha256').update(stable(x)).digest('hex');
function createAuthorizedQaStorePreflight({
 expectedCommitSha,loadPrivateEvidence,loadPrivateApproval,
 getTrustedReviewerPublicKey,reserveGlobalNonce,clock=()=>Date.now()
}={}){
 if(!SHA.test(String(expectedCommitSha||''))||
  [loadPrivateEvidence,loadPrivateApproval,getTrustedReviewerPublicKey,
   reserveGlobalNonce,clock].some(f=>typeof f!=='function'))
  throw Error('PRIVATE_OPERATOR_BACKENDS_REQUIRED');
 const attempts=new Set();
 async function review(req={}){
  if(!exact(req,['evidenceRef','approvalRef','nonce'])||
   typeof req.evidenceRef!=='string'||!REF.test(req.evidenceRef)||
   !req.evidenceRef.startsWith('evidence_')||
   typeof req.approvalRef!=='string'||!REF.test(req.approvalRef)||
   !req.approvalRef.startsWith('approval_')||
   typeof req.nonce!=='string'||!NONCE.test(req.nonce))
   return DENIED('REQUEST_REFERENCES_NOT_PRIVATE');
  const now=clock();
  if(!Number.isSafeInteger(now)||now<=0)return DENIED('UNTRUSTED_CLOCK');
  if(attempts.has(req.nonce))return DENIED('LOCAL_NONCE_REPLAY');
  attempts.add(req.nonce); // before first awaited operation
  let e,a;
  try{
   [e,a]=await Promise.all([
    loadPrivateEvidence({ref:req.evidenceRef,projectRef:PROJECT}),
    loadPrivateApproval({ref:req.approvalRef,projectRef:PROJECT})
   ]);
  }catch{return DENIED('PRIVATE_RECORDS_UNAVAILABLE');}
  const ek=['ref','projectRef','commitSha','observedAtMs','state'];
  if(!exact(e,ek)||e.ref!==req.evidenceRef||e.projectRef!==PROJECT||
   e.commitSha!==expectedCommitSha||
   !Number.isSafeInteger(e.observedAtMs)||e.observedAtMs>now+30000||
   now-e.observedAtMs>300000)return DENIED('EVIDENCE_STALE_OR_WRONG_SHA');
  const stateKeys=[
   'projectActive','preexistingStoreObjectsUntouched','newQaSchemaAbsent',
   'newPublicQaViewAbsent','migrationTestedWithRollback',
   'migrationApplied','qaAuthUsersAlreadyCreated','newPaidBranchExists',
   'backupRestoreVerified','privateOperatorMfaVerified',
   'dataApiViewSecurityReviewed','twoLiveSameTenantQaJwtSessions',
   'realPostgrestABDeniedAndOwnAllowed','revokedSessionDenied',
   'isolatedQaTenantAuthorized','twoDisposableAuthAccountsAuthorized',
   'newPublicQaViewAuthorized','extraPaidResourcesAuthorized',
   'qaResourceLedgerVerified'
  ];
  if(!exact(e.state,stateKeys)||Object.values(e.state).some(x=>typeof x!=='boolean'))
   return DENIED('EVIDENCE_SCHEMA_REJECTED');
  const ak=['ref','projectRef','commitSha','purpose','issuedAtMs','expiresAtMs',
   'expectedResources','noLiveMerchantCopy','noDemoOrdersOrProducts',
   'noProviderSend','noCredentialExport','noProductionChange',
   'maxNewPaidResources','reviewerSignatures'];
  if(!exact(a,ak)||a.ref!==req.approvalRef||a.projectRef!==PROJECT||
   a.commitSha!==expectedCommitSha||
   a.purpose!=='DISPOSABLE_QA_ONLY_NO_SEND'||
   !Number.isSafeInteger(a.issuedAtMs)||!Number.isSafeInteger(a.expiresAtMs)||
   a.issuedAtMs>now+30000||a.issuedAtMs<now-600000||
   a.expiresAtMs<=now||a.expiresAtMs-a.issuedAtMs>600000||
   !exact(a.expectedResources,['tenants','stores','authUsers','qaCatalogRows'])||
   a.expectedResources.tenants!==1||a.expectedResources.stores!==2||
   a.expectedResources.authUsers!==2||a.expectedResources.qaCatalogRows!==2||
   a.maxNewPaidResources!==0||a.noLiveMerchantCopy!==true||
   a.noDemoOrdersOrProducts!==true||a.noProviderSend!==true||
   a.noCredentialExport!==true||a.noProductionChange!==true||
   !Array.isArray(a.reviewerSignatures)||a.reviewerSignatures.length!==2||
   new Set(a.reviewerSignatures.map(x=>x?.role)).size!==2)
   return DENIED('APPROVAL_SCOPE_INVALID');
  const digestEvidence=digest(e);
  const signedScope={...a};delete signedScope.reviewerSignatures;
  const digestApproval=digest(signedScope);
  const enrolledIds=new Set(),signers=[];
  for(const role of ROLES){
   const sig=a.reviewerSignatures.find(s=>s?.role===role);
   if(!exact(sig,['role','kid','signature'])||
    typeof sig.kid!=='string'||!/^[A-Za-z0-9_.:-]{1,100}$/.test(sig.kid)||
    typeof sig.signature!=='string')return DENIED('SIGNATURE_FIELDS_INVALID');
   let trusted;
   try{trusted=await getTrustedReviewerPublicKey({role,kid:sig.kid,projectRef:PROJECT});}
   catch{return DENIED('TRUST_REGISTRY_OFFLINE');}
   if(!trusted||trusted.active!==true||trusted.role!==role||
    trusted.kid!==sig.kid||trusted.enrollment!=='PRIVATE_MFA_REVIEWED'||
    typeof trusted.identityRef!=='string'||enrolledIds.has(trusted.identityRef)||
    !isObj(trusted.publicJwk)||trusted.publicJwk.kty!=='OKP'||
    trusted.publicJwk.crv!=='Ed25519'||typeof trusted.publicJwk.x!=='string'||
    trusted.publicJwk.d!==undefined)
    return DENIED('TWO_INDEPENDENT_REVIEWERS_NOT_PROVEN');
   enrolledIds.add(trusted.identityRef);
   let good=false;
   try{
    if(/^[A-Za-z0-9_-]{85,88}$/.test(sig.signature)){
     const raw=Buffer.from(sig.signature,'base64url');
     const data=Buffer.from('TIEN404_V172B_PRIVATE_DISPOSABLE_AUTH_ADMISSION_V1\0'+
       stable({role,kid:sig.kid,digestEvidence,digestApproval,nonce:req.nonce}));
     if(raw.length===64&&raw.toString('base64url')===sig.signature)
      good=crypto.verify(null,data,crypto.createPublicKey({key:trusted.publicJwk,format:'jwk'}),raw);
    }
   }catch{}
   if(!good)return DENIED('UNTRUSTED_ED25519_APPROVAL');
   signers.push({role,kid:sig.kid,identityRef:trusted.identityRef,x:trusted.publicJwk.x});
  }
  let reserved;
  try{reserved=await reserveGlobalNonce({nonce:req.nonce,
   reviewDigest:digest({digestEvidence,digestApproval,nonce:req.nonce}),
   projectRef:PROJECT,ttlMs:600000});}
  catch{return DENIED('GLOBAL_REPLAY_BACKEND_UNAVAILABLE');}
  if(reserved!==true)return DENIED('GLOBAL_NONCE_REPLAY_OR_NOT_ATOMIC');
  // Trust decisions must remain stable at moment of planning, not just on first read.
  try{
   const [freshE,freshA]=await Promise.all([
    loadPrivateEvidence({ref:req.evidenceRef,projectRef:PROJECT}),
    loadPrivateApproval({ref:req.approvalRef,projectRef:PROJECT})
   ]);
   if(digest(freshE)!==digestEvidence||digest(freshA)!==digest(a))
    return DENIED('EVIDENCE_OR_APPROVAL_CHANGED');
   for(const s of signers){
    const t=await getTrustedReviewerPublicKey({role:s.role,kid:s.kid,projectRef:PROJECT});
    if(t?.active!==true||t.enrollment!=='PRIVATE_MFA_REVIEWED'||
     t.identityRef!==s.identityRef||t.publicJwk?.x!==s.x||
     t.publicJwk?.d!==undefined)
     return DENIED('REVIEWER_REVOKED_OR_ROTATED');
   }
  }catch{return DENIED('AUTHORITY_RECHECK_UNAVAILABLE');}
  const commitTime=clock();
  if(!Number.isSafeInteger(commitTime)||commitTime>=a.expiresAtMs||
   commitTime-e.observedAtMs>300000)return DENIED('APPROVAL_EXPIRED_AT_COMMIT');
  const s=e.state;
  const checks={
   PINNED_STAGING_PROJECT_AND_HEAD: s.projectActive&&s.preexistingStoreObjectsUntouched,
   KNOWN_RECOVERY_BACKUP:s.backupRestoreVerified,
   DISPOSABLE_SQL_ROLLBACK_TESTED:s.migrationTestedWithRollback,
   EMPTY_QA_TARGET_SCHEMA_AND_PUBLIC_VIEW:s.newQaSchemaAbsent&&s.newPublicQaViewAbsent,
   NO_UNRECONCILED_LIVE_QA_MUTATIONS:!s.migrationApplied&&!s.qaAuthUsersAlreadyCreated,
   SIGNED_FOUNDER_QA_PROVISIONING_CONSENT:true,
   INDEPENDENT_SECURITY_REVIEW:true,
   NO_NEW_PAID_RESOURCE_APPROVAL:!s.newPaidBranchExists&&!s.extraPaidResourcesAuthorized,
   PRIVATE_AUTH_ADMIN_SESSION_MFA:s.privateOperatorMfaVerified,
   PRIVATE_AUTH_USER_CREATION_SCOPE:s.twoDisposableAuthAccountsAuthorized,
   PRIVATE_DATA_API_VIEW_EXPOSURE_REVIEW:s.dataApiViewSecurityReviewed&&s.newPublicQaViewAuthorized,
   SAME_TENANT_TWO_STORE_MEMBERSHIP_PLAN:s.isolatedQaTenantAuthorized,
   TWO_REAL_OWNER_JWT_SESSION_RECEIPTS:s.twoLiveSameTenantQaJwtSessions,
   REAL_STORE_A_B_POSTGREST_NEGATIVE_QA:s.realPostgrestABDeniedAndOwnAllowed,
   SESSION_REVOKED_DENIAL_VERIFIED:s.revokedSessionDenied,
   QA_ROLLBACK_RESOURCE_LEDGER_READY:s.qaResourceLedgerVerified
  };
  const blockers=STEPS.filter(k=>checks[k]!==true);
  return Object.freeze({ok:true,plan:Object.freeze({
   kind:'DISPOSABLE_QA_AUTH_PROVISIONING_APPROVAL_PREVIEW_ONLY',
   projectRef:PROJECT,expectedResources:Object.freeze({...a.expectedResources}),
   noExistingMerchantChanges:true,noNewPaidResources:true,
   independentReviewReceipts:2,sourceGateChecks:STEPS.length,
   blockers:Object.freeze(blockers),blockerCount:blockers.length,
   actualLiveUserProvisioningExecuted:false,actualJwtUatExecuted:false,
   actualMigrationApplied:false,realIndependentMerchantOwnersAttested:false,
   allowAuthUserCreation:false,allowApplyMigration:false,
   allowDataApiExposure:false,allowLiveJwtUat:false,allowDeleteUsers:false,
   allowProductionRelease:false,allowBillingChanges:false,
   release:'HOSTED_NO_GO'
  })});
 }
 return Object.freeze({review});
}
module.exports={createAuthorizedQaStorePreflight};
