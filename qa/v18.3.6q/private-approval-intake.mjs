/**
 * TIEN404 V18.3.6Q — human authorization INTAKE, not issuance of access.
 * Draft-PR approval, self-attested booleans and synthetic signature checks
 * are NEVER equivalent to verified owner consent or independent human review.
 * No network, secrets, SQL source/body reads or actions occur here.
 */
import { createHash } from 'node:crypto';
const h64 = s => typeof s === 'string' && /^[a-f0-9]{64}$/.test(s);
const gitCommit = s => typeof s === 'string' && /^[a-f0-9]{40}$/.test(s);
const actor = x => typeof x === 'string' && /^private-[a-z0-9-]{5,80}$/.test(x);
const REQUIRED = Object.freeze([
 'request_id','project_ref','scope','manifest_sha256','base_commit_sha',
 'owner_evidence_hash','reviewer_evidence_hash','reviewer_scope_agreement_hash',
 'owner_actor','reviewer_actor','implementer_actor','window_start','window_end',
 'read_only','private_storage','no_auth_sessions','no_secrets','no_permission_changes'
]);
export function intakeDigest(x) {
 const serial=JSON.stringify({
   schema:'TIEN404_Q_REVIEW_INTAKE_V1',requestId:x.request_id,
   project:x.project_ref,scope:x.scope,
   manifest:x.manifest_sha256,base:x.base_commit_sha,
   owner:x.owner_actor,reviewer:x.reviewer_actor,implementer:x.implementer_actor,
   start:x.window_start,end:x.window_end
 });
 return createHash('sha256').update(serial,'utf8').digest('hex');
}
export function evaluatePrivateApprovalIntake(candidate,now) {
 const x=candidate && typeof candidate==='object' && !Array.isArray(candidate)?candidate:{};
 const findings=[];
 for(const k of REQUIRED)if(x[k]===undefined||x[k]===null||x[k]==='')
   findings.push('MISSING_'+k);
 if(x.project_ref!=='ifxlvrhyjhbzbrkdsida')findings.push('STAGING_ONLY');
 if(x.scope!=='REDACTED_SECDEF_SOURCE_INSPECTION_ONLY')findings.push('SCOPE_NOT_READ_ONLY');
 if(!gitCommit(x.base_commit_sha))findings.push('INVALID_base_commit_sha');
 for(const k of ['manifest_sha256','owner_evidence_hash',
                  'reviewer_evidence_hash','reviewer_scope_agreement_hash'])
   if(!h64(x[k]))findings.push('INVALID_'+k);
 if(!actor(x.owner_actor)||!actor(x.reviewer_actor)||!actor(x.implementer_actor)||
    new Set([x.owner_actor,x.reviewer_actor,x.implementer_actor]).size!==3)
   findings.push('REVIEWER_OPERATOR_INDEPENDENCE_UNVERIFIED');
 if(!Number.isSafeInteger(now)||!Number.isSafeInteger(x.window_start)||
    !Number.isSafeInteger(x.window_end)||x.window_start>now||
    x.window_start<now-300||x.window_end<=now||
    x.window_end-x.window_start>3600)findings.push('BOUNDED_REVIEW_WINDOW_REQUIRED');
 if(x.read_only!==true||x.private_storage!==true||x.no_auth_sessions!==true||
    x.no_secrets!==true||x.no_permission_changes!==true)
    findings.push('READ_ONLY_REDACTION_BOUNDARY_REQUIRED');
 if(x.function_identity_count!==4)findings.push('EXACT_MANIFEST_COUNT_REQUIRED');
 if(x.authorization_type!=='REVIEW_REQUEST_NOT_GRANT')
   findings.push('FALSE_AUTHORIZATION_CLAIM');
 if(x.actual_human_identity_verified===true||x.function_body_read===true||
    x.grant_change_performed===true||x.production_access_granted===true)
   findings.push('UNVERIFIED_REAL_WORLD_ACTION_CLAIM');
 const digest=REQUIRED.every(k=>x[k]!==undefined && x[k]!==null)?intakeDigest(x):null;
 return Object.freeze({
  status:findings.length?'BLOCKED_INTAKE':'COMPLETE_REQUEST_AWAITING_EXTERNAL_OWNER_HUMAN_VERIFICATION',
  findings:Object.freeze([...new Set(findings)]),requestDigest:digest,
  documentsAreOnlyMetadata:true,
  ownerConsentVerified:false,
  independentReviewerVerified:false,
  functionBodyAccessAuthorized:false,
  signedRealOwnerApprovalReceived:false,
  realAuthExperimentAuthorized:false,
  productionChangesAuthorized:false,
 });
}
export function privateApprovalChecklist() {
 return Object.freeze({
   owner:'REAL PROJECT OWNER MUST APPROVE NAMED HASHED FUNCTIONS OUTSIDE THIS QA REPO',
   reviewer:'INDEPENDENT HUMAN REVIEWS REAL OWNER IDENTITY AND READ-ONLY WINDOW',
   evidence:'PRIVATE REDACTED REFERENCE ONLY; NO SQL FUNCTION BODY / JWT / PII',
   actions:Object.freeze([
    'VERIFY_REAL_OWNER_AND_REVIEWER_IDENTITIES_IN_PRIVATE_APPROVED_CHANNEL',
    'COMPARE EXACT STAGING SECDEF TARGETS_AND_O_METADATA_DRIFT',
    'RECORD_TIME_BOUND_READ_ONLY_SCOPE_AND_PRIVATE_REDACTION',
    'AUTHORIZE_FUNCTION_BODY_VIEW_SEPARATELY_FROM_ANY_DDL_OR_INVOKE',
    'PROTECT_CREDENTIAL_AND_AUTH_SESSION_ROWS_FROM_REVIEW_WORKSPACE',
    'STORE_REDACTED_FINDINGS_OUTSIDE_PUBLIC_PR',
    'OBTAIN_INDEPENDENT_SIGNOFF_BOUND_TO_HEAD_SHA_AND_EXPIRY'
   ]),
   approvalAlreadyGiven:false,productionAdmitted:false
 });
}
