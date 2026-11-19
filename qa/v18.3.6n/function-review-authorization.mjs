/**
 * TIEN404 V18.3.6N — Authorization REQUEST preflight only.
 * This module has NO capability to fetch PostgreSQL function bodies, request
 * elevated permissions, retrieve Auth sessions or issue an approval.
 * A complete object of user-supplied "approved" flags remains UNVERIFIED.
 */
const SHA=/^[a-f0-9]{64}$/;
const ID=/^[a-z0-9._:-]{3,96}$/i;
const required=[
 'projectEnvironment','targetFunctionDigests','purpose','ownerApprovalReference',
 'ownerApprovalEvidenceHash','independentReviewerReference',
 'implementerReference','approvedWindowStart','approvedWindowEnd',
 'readOnly','redactionProtocol','backupGrantsSnapshotHash',
 'authorizedScopeDigest'
];
const out=(blockers,summary={})=>Object.freeze({
 status:blockers.length?'BLOCKED':'READY_FOR_EXTERNAL_PRIVATE_APPROVAL_VERIFICATION',
 blockers:Object.freeze([...new Set(blockers)]),
 reviewScope:summary,
 ownerApprovalVerifiedByIndependentParty:false,
 independentReviewerVerified:false,
 authUserRowsAccessed:false,
 functionBodiesRead:false,
 grantAlterationAuthorized:false,
 productionAccessAuthorized:false
});
export function assessFunctionReviewRequest(input,nowEpochSec){
 const x=input&&typeof input==='object'&&!Array.isArray(input)?input:{};
 const failures=[];
 if(!Number.isSafeInteger(nowEpochSec)||nowEpochSec<=0)failures.push('TRUSTED_CLOCK_MISSING');
 for(const name of required)if(x[name]===null||x[name]===undefined||x[name]==='')
   failures.push('MISSING_'+name);
 if(x.projectEnvironment!=='STAGING')failures.push('STAGING_ONLY');
 if(!Array.isArray(x.targetFunctionDigests)||x.targetFunctionDigests.length<1||
    x.targetFunctionDigests.length>4||new Set(x.targetFunctionDigests).size!==x.targetFunctionDigests.length||
    !x.targetFunctionDigests.every(v=>typeof v==='string'&&SHA.test(v)))
   failures.push('EXACT_TARGET_FUNCTION_HASHES_REQUIRED');
 if(x.purpose!=='PRIVILEGED_FUNCTION_BODY_SECURITY_REVIEW')
   failures.push('REVIEW_PURPOSE_SCOPE_MISMATCH');
 if(!ID.test(x.ownerApprovalReference||'')||!SHA.test(x.ownerApprovalEvidenceHash||''))
   failures.push('OWNER_SIGNED_EVIDENCE_REQUIRED');
 if(!ID.test(x.independentReviewerReference||'')||!ID.test(x.implementerReference||''))
   failures.push('DISTINCT_REVIEWER_IDENTITIES_REQUIRED');
 if(x.independentReviewerReference&&x.independentReviewerReference===x.implementerReference)
   failures.push('SAME_PERSON_REVIEW_FORBIDDEN');
 if(!Number.isSafeInteger(x.approvedWindowStart)||!Number.isSafeInteger(x.approvedWindowEnd)||
    x.approvedWindowStart<nowEpochSec||x.approvedWindowEnd<=x.approvedWindowStart||
    x.approvedWindowEnd-x.approvedWindowStart>3600)
   failures.push('APPROVAL_TIME_WINDOW_NOT_VALID');
 if(x.readOnly!==true)failures.push('READ_ONLY_REQUIRED');
 if(x.redactionProtocol!=='PRIVATE_REVIEW_NO_TOKENS_NO_PII_NO_LOGGED_BODIES')
   failures.push('PRIVATE_REDACTION_AND_LOGGING_POLICY_REQUIRED');
 if(!SHA.test(x.backupGrantsSnapshotHash||''))failures.push('PRE_REVIEW_GRANT_SNAPSHOT_REQUIRED');
 if(!SHA.test(x.authorizedScopeDigest||''))failures.push('SCOPE_HASH_REQUIRED');
 if(x.allowAuthSessionsRead===true||x.allowSecretsRead===true||
    x.allowGrantChange===true||x.allowProduction===true||
    x.allowProviderSend===true||x.allowServiceRoleTokenExport===true)
   failures.push('FORBIDDEN_ESCALATED_OPERATION');
 return out(failures,{environment:'STAGING',maxFunctions:4,maxWindowSeconds:3600,
   mode:'NO_ACTION_NO_BODY_RETRIEVAL'});
}
export function buildFunctionReviewAuthorizationRequest(){
 return Object.freeze({
  scope:'SINGLE_AUTHORIZED_READ_ONLY_FUNCTION_BODY_REVIEW',
  ownerEvidenceStatus:'NOT_COLLECTED',
  reviewerEvidenceStatus:'NOT_COLLECTED',
  functionBodiesRead:false,
  functionGrantChangeAllowed:false,
  authSessionsRead:false,
  approved:false,
  followUp:'COLLECT_EXPLICIT_OWNER_APPROVAL_AND_INDEPENDENT_REVIEW_OUTSIDE_QA'
 });
}
