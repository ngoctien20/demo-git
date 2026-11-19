import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluatePrivateApprovalIntake,privateApprovalChecklist,intakeDigest} from './private-approval-intake.mjs';
import {evaluateGoTrueRuntimeAdmission,runtimeAdmissionEvidenceMatrix} from './gotrue-runtime-admission.mjs';
import {FIXTURE_HMAC_KEY_HEX,canonicalFixtureClaim,signPublicQaFixture,
 verifyPublicQaFixture,rpcProofReviewVerdict} from './rpc-proof-fixture.mjs';

const H=c=>c.repeat(64),U=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const NOW=1800000000;
const request=()=>({
 request_id:'qa-review-457',project_ref:'ifxlvrhyjhbzbrkdsida',
 scope:'REDACTED_SECDEF_SOURCE_INSPECTION_ONLY',
 manifest_sha256:H('a'),base_commit_sha:'f8404ca771244592db4fcb795b27c4deae5d496e',
 owner_evidence_hash:H('b'),reviewer_evidence_hash:H('c'),
 reviewer_scope_agreement_hash:H('d'),
 owner_actor:'private-synthetic-owner',reviewer_actor:'private-synthetic-reviewer',
 implementer_actor:'private-synthetic-implementer',
 window_start:NOW-1,window_end:NOW+900,read_only:true,
 private_storage:true,no_auth_sessions:true,no_secrets:true,
 no_permission_changes:true,function_identity_count:4,
 authorization_type:'REVIEW_REQUEST_NOT_GRANT',
 actual_human_identity_verified:false,function_body_read:false,
 grant_change_performed:false,production_access_granted:false
});
function intake(){return evaluatePrivateApprovalIntake(request(),NOW);}
test('A01 review intake metadata can be complete, still not a grant',()=>{
 const x=intake();assert.equal(x.status,'COMPLETE_REQUEST_AWAITING_EXTERNAL_OWNER_HUMAN_VERIFICATION');
 assert.equal(x.ownerConsentVerified,false);assert.equal(x.functionBodyAccessAuthorized,false);
});
test('A02 intake hash is deterministic and canonical',()=>assert.equal(intakeDigest(request()),intakeDigest({...request()})));
test('A03 intake hash changes when function manifest changes',()=>{
 const x=request();x.manifest_sha256=H('0');assert.notEqual(intakeDigest(x),intakeDigest(request()));
});
test('A04 no real reviewer is verified by self-submitted metadata',()=>assert.equal(intake().independentReviewerVerified,false));
test('A05 no access to real Auth via SECDEF review',()=>assert.equal(intake().realAuthExperimentAuthorized,false));
test('A06 no production write authorization',()=>assert.equal(intake().productionChangesAuthorized,false));
test('A07 empty request blocked',()=>assert.equal(evaluatePrivateApprovalIntake({},NOW).status,'BLOCKED_INTAKE'));
const approvalMutations=[
 ['wrong staging project','project_ref','not-staging','STAGING_ONLY'],
 ['unbounded operation','scope','CHANGE_SQL_GRANTS','SCOPE_NOT_READ_ONLY'],
 ['missing manifest','manifest_sha256','','INVALID_manifest_sha256'],
 ['incorrect Git SHA','base_commit_sha',H('f'),'INVALID_base_commit_sha'],
 ['missing owner evidence','owner_evidence_hash','','INVALID_owner_evidence_hash'],
 ['missing reviewer evidence','reviewer_evidence_hash','','INVALID_reviewer_evidence_hash'],
 ['missing agreement','reviewer_scope_agreement_hash','','INVALID_reviewer_scope_agreement_hash'],
 ['same reviewer owner','reviewer_actor','private-synthetic-owner','REVIEWER_OPERATOR_INDEPENDENCE_UNVERIFIED'],
 ['same implementer reviewer','implementer_actor','private-synthetic-reviewer','REVIEWER_OPERATOR_INDEPENDENCE_UNVERIFIED'],
 ['future review window','window_start',NOW+30,'BOUNDED_REVIEW_WINDOW_REQUIRED'],
 ['window exceeds hour','window_end',NOW+7000,'BOUNDED_REVIEW_WINDOW_REQUIRED'],
 ['not read only','read_only',false,'READ_ONLY_REDACTION_BOUNDARY_REQUIRED'],
 ['unsafe evidence storage','private_storage',false,'READ_ONLY_REDACTION_BOUNDARY_REQUIRED'],
 ['auth session access','no_auth_sessions',false,'READ_ONLY_REDACTION_BOUNDARY_REQUIRED'],
 ['read secrets','no_secrets',false,'READ_ONLY_REDACTION_BOUNDARY_REQUIRED'],
 ['modify permissions','no_permission_changes',false,'READ_ONLY_REDACTION_BOUNDARY_REQUIRED'],
 ['wrong function scope count','function_identity_count',5,'EXACT_MANIFEST_COUNT_REQUIRED'],
 ['false authorization document','authorization_type','GRANT_ACCESS','FALSE_AUTHORIZATION_CLAIM'],
 ['pretend real owner verified','actual_human_identity_verified',true,'UNVERIFIED_REAL_WORLD_ACTION_CLAIM'],
 ['pretend function body read','function_body_read',true,'UNVERIFIED_REAL_WORLD_ACTION_CLAIM'],
 ['pretend grant changed','grant_change_performed',true,'UNVERIFIED_REAL_WORLD_ACTION_CLAIM'],
 ['pretend production permitted','production_access_granted',true,'UNVERIFIED_REAL_WORLD_ACTION_CLAIM'],
];
for(let i=0;i<approvalMutations.length;i++){
 const [label,key,val,want]=approvalMutations[i];
 test('A'+String(i+8).padStart(2,'0')+' '+label+' blocked',()=>{
   const x=request();x[key]=val;
   assert.ok(evaluatePrivateApprovalIntake(x,NOW).findings.includes(want));
 });
}
test('A30 human review and extra signoff still required',()=>{
 const x=privateApprovalChecklist();assert.equal(x.approvalAlreadyGiven,false);
 assert.equal(x.actions.length,7);
});

const runtime=()=>({
 mode:'PREFLIGHT_ONLY',target:'NEW_ISOLATED_LOCAL_STACK',connectedProjectRef:null,
 cliVersion:'2.99.1',authImageDigest:'sha256:'+H('a'),
 postgresImageDigest:'sha256:'+H('b'),
 cliHelpReviewed:true,dockerEngineObserved:true,imageCompatibilityReviewed:true,
 publicPortExposed:false,loopbackOnly:true,outboundInternetDisabled:true,
 smsSmtpDeliveryDisabled:true,webhookOutboundDisabled:true,
 fixtureUsersOnly:true,noExistingAuthTokens:true,noStagingVolumes:true,
 ephemeralCredentialsOnly:true,verifiedSamePgDomain:true,
 privateDbLockPreflight:true,noGenericServiceRoleSqlProxy:true,
 rollbackTeardownReviewed:true,redactedEvidenceRetentionReviewed:true,
 resourceApprovalRequested:true,independentSecurityReviewerRequested:true,
 ownerActuallyAuthorized:false,realUserLoggedIn:false,
 networkSendOccurred:false,stagingDatabaseModified:false,productionKeyMounted:false
});
test('G01 fully complete plan cannot start GoTrue',()=>{
 const r=evaluateGoTrueRuntimeAdmission(runtime());
 assert.equal(r.state,'PLAN_READY_FOR_INDEPENDENT_RUNTIME_APPROVAL');
 assert.equal(r.mayStartRuntime,false);assert.equal(r.localGoTrueStarted,false);
});
test('G02 complete plan still does not verify human approval',()=>assert.equal(evaluateGoTrueRuntimeAdmission(runtime()).trustedHumanApprovalVerified,false));
test('G03 empty runtime plan denied',()=>assert.equal(evaluateGoTrueRuntimeAdmission({}).state,'BLOCKED_PLAN'));
const runtimeMutations=[
 ['wrong run mode','mode','START','RUN_MODE_NOT_PREFLIGHT'],
 ['existing project link','connectedProjectRef','ifxlvrhyjhbzbrkdsida','LOCAL_DISPOSABLE_ONLY'],
 ['wrong target','target','REAL_STAGING','LOCAL_DISPOSABLE_ONLY'],
 ['invalid CLI version','cliVersion','latest','PIN_LOCAL_CLI_AND_CONTAINER_DIGEST'],
 ['no GoTrue image SHA','authImageDigest','','PIN_LOCAL_CLI_AND_CONTAINER_DIGEST'],
 ['no PG image SHA','postgresImageDigest','','PIN_LOCAL_CLI_AND_CONTAINER_DIGEST'],
 ['CLI help not reviewed','cliHelpReviewed',false,'SUPPORTED_RUNTIME_UNVERIFIED'],
 ['Docker engine not observed','dockerEngineObserved',false,'SUPPORTED_RUNTIME_UNVERIFIED'],
 ['unreviewed image compatibility','imageCompatibilityReviewed',false,'SUPPORTED_RUNTIME_UNVERIFIED'],
 ['public port exposed','publicPortExposed',true,'NETWORK_EGRESS_POLICY_UNVERIFIED'],
 ['loopback missing','loopbackOnly',false,'NETWORK_EGRESS_POLICY_UNVERIFIED'],
 ['external egress enabled','outboundInternetDisabled',false,'NETWORK_EGRESS_POLICY_UNVERIFIED'],
 ['SMS SMTP delivery enabled','smsSmtpDeliveryDisabled',false,'NETWORK_EGRESS_POLICY_UNVERIFIED'],
 ['webhook outbound enabled','webhookOutboundDisabled',false,'NETWORK_EGRESS_POLICY_UNVERIFIED'],
 ['real user fixture','fixtureUsersOnly',false,'AUTH_IDENTITY_AND_VOLUME_BOUNDARY_UNVERIFIED'],
 ['existing Auth token reused','noExistingAuthTokens',false,'AUTH_IDENTITY_AND_VOLUME_BOUNDARY_UNVERIFIED'],
 ['staging volumes mounted','noStagingVolumes',false,'AUTH_IDENTITY_AND_VOLUME_BOUNDARY_UNVERIFIED'],
 ['credential persistence','ephemeralCredentialsOnly',false,'AUTH_IDENTITY_AND_VOLUME_BOUNDARY_UNVERIFIED'],
 ['Auth and store not same DB','verifiedSamePgDomain',false,'AUTH_STORE_TX_PREREQUISITE_UNVERIFIED'],
 ['session SQL lock path unchecked','privateDbLockPreflight',false,'AUTH_STORE_TX_PREREQUISITE_UNVERIFIED'],
 ['generic service SQL proxy','noGenericServiceRoleSqlProxy',false,'AUTH_STORE_TX_PREREQUISITE_UNVERIFIED'],
 ['missing cleanup plan','rollbackTeardownReviewed',false,'CLEANUP_AND_REDACTION_UNVERIFIED'],
 ['unreviewed evidence retention','redactedEvidenceRetentionReviewed',false,'CLEANUP_AND_REDACTION_UNVERIFIED'],
 ['resource request missing','resourceApprovalRequested',false,'RESOURCE_AND_REVIEW_REQUEST_MISSING'],
 ['independent review request missing','independentSecurityReviewerRequested',false,'RESOURCE_AND_REVIEW_REQUEST_MISSING'],
 ['false owner authorized claim','ownerActuallyAuthorized',true,'UNVERIFIED_LIVE_ACTION_FLAG'],
 ['false login claim','realUserLoggedIn',true,'UNVERIFIED_LIVE_ACTION_FLAG'],
 ['false external send claim','networkSendOccurred',true,'UNVERIFIED_LIVE_ACTION_FLAG'],
 ['false staging write','stagingDatabaseModified',true,'UNVERIFIED_LIVE_ACTION_FLAG'],
 ['false production key','productionKeyMounted',true,'UNVERIFIED_LIVE_ACTION_FLAG']
];
for(let i=0;i<runtimeMutations.length;i++){
 const [name,key,value,issue]=runtimeMutations[i];
 test('G'+String(i+4).padStart(2,'0')+' '+name+' denied',()=>{
  const x=runtime();x[key]=value;
  assert.ok(evaluateGoTrueRuntimeAdmission(x).unmet.includes(issue));
 });
}
test('G34 plan scenarios do not prove live session revocation',()=>{
 const x=runtimeAdmissionEvidenceMatrix();assert.equal(x.liveScenarioCount,0);
 assert.equal(x.futureExecutionRequiresSeparateOwnerApproval,true);
});

const c=()=>({
 sessionId:U(112),userId:U(212),tenantId:U(301),storeId:U(402),
 revision:1,itemId:U(502),jti:U(9701),expiresEpoch:1800000100
});
test('R01 fixture HMAC key is deliberately public',()=>assert.equal(FIXTURE_HMAC_KEY_HEX,'51'.repeat(32)));
test('R02 byte-level HMAC verification passes synthetic claim',()=>{
 const x=c();assert.equal(verifyPublicQaFixture(x,signPublicQaFixture(x).macHex),true);
});
test('R03 signed body is deterministic',()=>assert.equal(canonicalFixtureClaim(c()),canonicalFixtureClaim(c())));
test('R04 signed body includes exact version and store',()=>{
 const body=canonicalFixtureClaim(c());assert.ok(body.startsWith('Q1\n'));assert.ok(body.includes(U(402)));
});
const mutations=[
 ['sessionId',U(111)],['userId',U(211)],['tenantId',U(302)],
 ['storeId',U(401)],['revision',2],['itemId',U(501)],
 ['jti',U(9702)],['expiresEpoch',1800000101]
];
for(let i=0;i<mutations.length;i++){
 const [field,val]=mutations[i];
 test('R'+String(i+5).padStart(2,'0')+' HMAC tampering '+field+' denied',()=>{
  const x=c(),mac=signPublicQaFixture(x).macHex;x[field]=val;
  assert.equal(verifyPublicQaFixture(x,mac),false);
 });
}
test('R13 uppercase MAC rejected',()=>assert.equal(verifyPublicQaFixture(c(),signPublicQaFixture(c()).macHex.toUpperCase()),false));
test('R14 empty MAC rejected',()=>assert.equal(verifyPublicQaFixture(c(),''),false));
test('R15 invalid UUID rejected',()=>assert.throws(()=>canonicalFixtureClaim({...c(),storeId:'anything'}),/INVALID_storeId/));
test('R16 invalid revision rejected',()=>assert.throws(()=>canonicalFixtureClaim({...c(),revision:0}),/INVALID_REVISION/));
test('R17 invalid expiry rejected',()=>assert.throws(()=>canonicalFixtureClaim({...c(),expiresEpoch:-1}),/INVALID_EXPIRY/));
test('R18 real JWT/Auth/Store still not proven',()=>{
 const x=rpcProofReviewVerdict();
 assert.equal(x.realGoTrueSessionVerified,false);
 assert.equal(x.actualProductionRpcTrustClosed,false);
 assert.equal(x.productionAdmitted,false);
});
test('R19 no secret storage or safe KMS audited',()=>assert.equal(rpcProofReviewVerdict().signingKeyCustodyVerified,false));
test('R20 alternate SECDEF routes remain unreviewed',()=>assert.equal(rpcProofReviewVerdict().alternateSecdefCallersReviewed,false));
