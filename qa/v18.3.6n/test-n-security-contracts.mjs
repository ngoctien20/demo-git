import test from 'node:test';
import assert from 'node:assert/strict';
import {assessFunctionReviewRequest,buildFunctionReviewAuthorizationRequest} from './function-review-authorization.mjs';
import {simulateSignOut,evaluateSensitiveReadSession,authServiceRaceMatrix,assessRealAuthServiceAdmission} from './auth-service-delete-contract.mjs';
import {designDecision,assessProductionCryptoBoundary} from './crypto-trust-boundary.mjs';

const NOW=1800000000;
const H=c=>c.repeat(64);
const approval=()=>({
 projectEnvironment:'STAGING',targetFunctionDigests:[H('a'),H('b')],
 purpose:'PRIVILEGED_FUNCTION_BODY_SECURITY_REVIEW',
 ownerApprovalReference:'private-owner-reference',ownerApprovalEvidenceHash:H('c'),
 independentReviewerReference:'reviewer-other',implementerReference:'implementer-person',
 approvedWindowStart:NOW+1,approvedWindowEnd:NOW+1000,readOnly:true,
 redactionProtocol:'PRIVATE_REVIEW_NO_TOKENS_NO_PII_NO_LOGGED_BODIES',
 backupGrantsSnapshotHash:H('d'),authorizedScopeDigest:H('e'),
 allowAuthSessionsRead:false,allowSecretsRead:false,allowGrantChange:false,
 allowProduction:false,allowProviderSend:false,allowServiceRoleTokenExport:false
});
const n=Object.freeze({now:NOW});
test('F01 synthetic complete approval never grants access',()=>{
 const x=assessFunctionReviewRequest(approval(),NOW);
 assert.equal(x.status,'READY_FOR_EXTERNAL_PRIVATE_APPROVAL_VERIFICATION');
 assert.equal(x.functionBodiesRead,false);
 assert.equal(x.ownerApprovalVerifiedByIndependentParty,false);
 assert.equal(x.productionAccessAuthorized,false);
});
test('F02 empty request blocked',()=>assert.equal(assessFunctionReviewRequest({},NOW).status,'BLOCKED'));
test('F03 owner signature reference absent',()=>{const x=approval();x.ownerApprovalReference='';assert.equal(assessFunctionReviewRequest(x,NOW).status,'BLOCKED');});
test('F04 no trusted current time blocked',()=>assert.ok(assessFunctionReviewRequest(approval(),-1).blockers.includes('TRUSTED_CLOCK_MISSING')));
test('F05 cannot select production environment',()=>{const x=approval();x.projectEnvironment='PRODUCTION';assert.ok(assessFunctionReviewRequest(x,NOW).blockers.includes('STAGING_ONLY'));});
test('F06 function hash identity must be pinned',()=>{const x=approval();x.targetFunctionDigests=['function-name'];assert.ok(assessFunctionReviewRequest(x,NOW).blockers.includes('EXACT_TARGET_FUNCTION_HASHES_REQUIRED'));});
test('F07 duplicate targets rejected',()=>{const x=approval();x.targetFunctionDigests=[H('a'),H('a')];assert.ok(assessFunctionReviewRequest(x,NOW).blockers.includes('EXACT_TARGET_FUNCTION_HASHES_REQUIRED'));});
test('F08 more than four functions requires separate approval',()=>{const x=approval();x.targetFunctionDigests=['a','b','c','d','e'].map(H);assert.ok(assessFunctionReviewRequest(x,NOW).blockers.includes('EXACT_TARGET_FUNCTION_HASHES_REQUIRED'));});
test('F09 reviewer and implementer cannot be same',()=>{const x=approval();x.independentReviewerReference=x.implementerReference;assert.ok(assessFunctionReviewRequest(x,NOW).blockers.includes('SAME_PERSON_REVIEW_FORBIDDEN'));});
test('F10 approval cannot be expired',()=>{const x=approval();x.approvedWindowStart=NOW-20;assert.ok(assessFunctionReviewRequest(x,NOW).blockers.includes('APPROVAL_TIME_WINDOW_NOT_VALID'));});
test('F11 approval maximum one hour',()=>{const x=approval();x.approvedWindowEnd=NOW+9000;assert.ok(assessFunctionReviewRequest(x,NOW).blockers.includes('APPROVAL_TIME_WINDOW_NOT_VALID'));});
test('F12 read-only is mandatory',()=>{const x=approval();x.readOnly=false;assert.ok(assessFunctionReviewRequest(x,NOW).blockers.includes('READ_ONLY_REQUIRED'));});
test('F13 redacted private evidence required',()=>{const x=approval();x.redactionProtocol='public-logs';assert.ok(assessFunctionReviewRequest(x,NOW).blockers.includes('PRIVATE_REDACTION_AND_LOGGING_POLICY_REQUIRED'));});
test('F14 current grant snapshot needed',()=>{const x=approval();x.backupGrantsSnapshotHash='';assert.ok(assessFunctionReviewRequest(x,NOW).blockers.includes('PRE_REVIEW_GRANT_SNAPSHOT_REQUIRED'));});
test('F15 can never implicitly approve access to Auth sessions',()=>{const x=approval();x.allowAuthSessionsRead=true;assert.ok(assessFunctionReviewRequest(x,NOW).blockers.includes('FORBIDDEN_ESCALATED_OPERATION'));});
test('F16 can never implicitly approve access to secrets',()=>{const x=approval();x.allowSecretsRead=true;assert.ok(assessFunctionReviewRequest(x,NOW).blockers.includes('FORBIDDEN_ESCALATED_OPERATION'));});
test('F17 no grant changes from review authorization',()=>{const x=approval();x.allowGrantChange=true;assert.ok(assessFunctionReviewRequest(x,NOW).blockers.includes('FORBIDDEN_ESCALATED_OPERATION'));});
test('F18 no provider send from review authorization',()=>{const x=approval();x.allowProviderSend=true;assert.ok(assessFunctionReviewRequest(x,NOW).blockers.includes('FORBIDDEN_ESCALATED_OPERATION'));});
test('F19 no production or service_role extraction',()=>{const x=approval();x.allowServiceRoleTokenExport=true;assert.ok(assessFunctionReviewRequest(x,NOW).blockers.includes('FORBIDDEN_ESCALATED_OPERATION'));});
test('F20 authorization request builder never marks approved',()=>{const x=buildFunctionReviewAuthorizationRequest();assert.equal(x.approved,false);assert.equal(x.functionGrantChangeAllowed,false);});

const sessions=()=>[
{id:'A1',userId:'userA'},{id:'A2',userId:'userA'},{id:'A3',userId:'userA'},{id:'B1',userId:'userB'}
];
const sim=scope=>simulateSignOut({sessions:sessions(),actorSessionId:'A1',scope});
test('A01 global revokes all user A, not unrelated B',()=>{const x=sim('global');assert.deepEqual(x.revoked,['A1','A2','A3']);assert.deepEqual(x.preserved,['B1']);});
test('A02 local revokes only current session',()=>{const x=sim('local');assert.deepEqual(x.revoked,['A1']);assert.deepEqual(x.preserved,['A2','A3','B1']);});
test('A03 others preserves current, revokes other sessions same user',()=>{const x=sim('others');assert.deepEqual(x.revoked,['A2','A3']);assert.deepEqual(x.preserved,['A1','B1']);});
test('A04 unknown scope blocked',()=>assert.equal(sim('everyone').code,'INVALID_SIMULATED_SIGNOUT_REQUEST'));
test('A05 missing actor blocked',()=>assert.equal(simulateSignOut({sessions:sessions(),actorSessionId:'Z1',scope:'local'}).code,'ACTOR_SESSION_NOT_FOUND'));
test('A06 duplicate session IDs blocked',()=>{const x=sessions();x[1].id='A1';assert.equal(simulateSignOut({sessions:x,actorSessionId:'A1',scope:'local'}).code,'INVALID_SIMULATED_SIGNOUT_REQUEST');});
test('A07 malformed sessions input denied',()=>assert.equal(simulateSignOut({sessions:null,actorSessionId:'A1',scope:'local'}).code,'INVALID_SIMULATED_SIGNOUT_REQUEST'));
test('A08 signout scope tests NEVER call Auth service',()=>assert.equal(sim('global').realAuthServiceVerified,false));
test('A09 session ids in test are synthetic, never production',()=>assert.equal(sim('others').model,'SYNTHETIC_CONTRACT_ONLY'));
test('A10 policy scenarios include timebox not yet deleted',()=>assert.ok(authServiceRaceMatrix.includes('TIMEBOX_EXPIRED_ROW_STILL_PRESENT')));
test('A11 policy scenarios include password change',()=>assert.ok(authServiceRaceMatrix.includes('PASSWORD_CHANGE_OR_USER_DISABLE')));
test('A12 race matrix includes token still valid after logout',()=>assert.ok(authServiceRaceMatrix.includes('ACCESS_JWT_VALID_AFTER_SIGNOUT')));
test('A13 all 15 race cases have no live evidence by default',()=>{const x=assessRealAuthServiceAdmission({});assert.equal(x.scenarioCount,15);assert.equal(x.realAuthUatExecuted,false);});
const sensitive=()=>({
 signatureVerified:true,sessionId:'A1',userId:'userA',tokenExpiresAt:NOW+100,
 sessionRecord:{id:'A1',userId:'userA',notAfterEpochSec:NOW+200},
 authPolicy:{authoritativePolicyVersionVerified:true,userStatusKnownActive:true,
    isTimeboxEligible:true,isInactivityEligible:true,isSingleSessionEligible:true},
 nowEpochSec:NOW
});
test('A14 all synthetic conditions pass but no production authorization',()=>{const x=evaluateSensitiveReadSession(sensitive());assert.equal(x.code,'SYNTHETIC_PRECONDITIONS_SATISFIED');assert.equal(x.productionPermission,false);});
test('A15 bad JWT signature denied',()=>{const x=sensitive();x.signatureVerified=false;assert.equal(evaluateSensitiveReadSession(x).code,'DENY_BAD_TOKEN_OR_CLOCK');});
test('A16 expired JWT denied despite session row present',()=>{const x=sensitive();x.tokenExpiresAt=NOW;assert.equal(evaluateSensitiveReadSession(x).code,'DENY_ACCESS_JWT_EXPIRED');});
test('A17 absent session denied',()=>{const x=sensitive();x.sessionRecord=null;assert.equal(evaluateSensitiveReadSession(x).code,'DENY_MISSING_OR_MISMATCHED_SESSION');});
test('A18 session to wrong user denied',()=>{const x=sensitive();x.sessionRecord.userId='userB';assert.equal(evaluateSensitiveReadSession(x).code,'DENY_MISSING_OR_MISMATCHED_SESSION');});
test('A19 timebox unknown denied',()=>{const x=sensitive();x.authPolicy.isTimeboxEligible=false;assert.equal(evaluateSensitiveReadSession(x).code,'DENY_AUTH_POLICY_UNVERIFIED_OR_INELIGIBLE');});
test('A20 inactivity unknown denied',()=>{const x=sensitive();x.authPolicy.isInactivityEligible=false;assert.equal(evaluateSensitiveReadSession(x).code,'DENY_AUTH_POLICY_UNVERIFIED_OR_INELIGIBLE');});
test('A21 single-session constraint unknown denied',()=>{const x=sensitive();x.authPolicy.isSingleSessionEligible=false;assert.equal(evaluateSensitiveReadSession(x).code,'DENY_AUTH_POLICY_UNVERIFIED_OR_INELIGIBLE');});
test('A22 disabled user denied despite active-looking JWT',()=>{const x=sensitive();x.authPolicy.userStatusKnownActive=false;assert.equal(evaluateSensitiveReadSession(x).code,'DENY_AUTH_POLICY_UNVERIFIED_OR_INELIGIBLE');});
test('A23 missing validated Auth policy denied',()=>{const x=sensitive();x.authPolicy.authoritativePolicyVersionVerified=false;assert.equal(evaluateSensitiveReadSession(x).code,'DENY_AUTH_POLICY_UNVERIFIED_OR_INELIGIBLE');});
test('A24 session not_after expired denied',()=>{const x=sensitive();x.sessionRecord.notAfterEpochSec=NOW;assert.equal(evaluateSensitiveReadSession(x).code,'DENY_SESSION_NOT_AFTER');});
test('A25 session row exists but sensitive read still not real proof',()=>{const x=evaluateSensitiveReadSession(sensitive());assert.equal(x.sameTransactionAuthLockVerified,false);});
test('A26 even complete fake Auth proof matrix only advances to private review',()=>{
 const x=assessRealAuthServiceAdmission({
   testEvidenceHashes:Object.fromEntries(authServiceRaceMatrix.map(k=>[k,H('a')])),
   ownerApprovedRealAuthTest:true,isolatedPrivateAuthProject:true,
   independentHumanSecurityReviewer:true,
   verifiedRealSessionIdAndUserBinding:true,attestedActualPostgresLockOrdering:true,
 });
 assert.equal(x.status,'PRIVATE_EVIDENCE_PACKAGE_FOR_HUMAN_REVIEW_ONLY');
 assert.equal(x.productionAdmitted,false);
});

const crypto=()=>({
 nodeEd25519VerifierIndependentlyReviewed:true,
 supabaseJwksPinnedAndRotationTested:true,
 authSessionAndStoreTransactionRealQa:true,
 privateRpcIdentityChannelIndependentlyReviewed:true,
 productionKmsKeyCustodyAndRotationDrilled:true,
 dbSignatureOrMacVerifierSupportedAndReviewed:true,
 noServiceRoleOrBypassRlsEscalationVerified:true,
 independentHumanSecurityReviewSigned:true,
 usePublicSyntheticHmacKey:false,useClientSuppliedStoreClaims:false,
 installPgSodiumWithoutApproval:false
});
test('C01 architecture direction selects private Node Ed25519 verifier',()=>{
 assert.equal(designDecision.preferred,'PRIVATE_BACKEND_NODE_ED25519_VERIFY_WITH_SAME_PG_AUTH_STORE_TRANSACTION');
 assert.equal(designDecision.productionSelected,false);
});
test('C02 crypto evidence missing is NOT_READY',()=>assert.equal(assessProductionCryptoBoundary({}).status,'NOT_READY'));
test('C03 fully marked fake packet is still review-only',()=>{
 const x=assessProductionCryptoBoundary(crypto());
 assert.equal(x.status,'EVIDENCE_PACKET_READY_FOR_OFFLINE_HUMAN_REVIEW');
 assert.equal(x.productionSelected,false);assert.equal(x.productionAdmitted,false);
});
test('C04 no real JWT JWKS pinning blocked',()=>{const x=crypto();x.supabaseJwksPinnedAndRotationTested=false;assert.ok(assessProductionCryptoBoundary(x).blockers.includes('SUPABASE_JWKS_TRUST_UNVERIFIED'));});
test('C05 no real session Store transaction proof blocked',()=>{const x=crypto();x.authSessionAndStoreTransactionRealQa=false;assert.ok(assessProductionCryptoBoundary(x).blockers.includes('SAME_DB_AUTH_STORE_REAL_QA_MISSING'));});
test('C06 no RPC transport identity blocked',()=>{const x=crypto();x.privateRpcIdentityChannelIndependentlyReviewed=false;assert.ok(assessProductionCryptoBoundary(x).blockers.includes('PRIVATE_RPC_IDENTITY_UNVERIFIED'));});
test('C07 no KMS verified custody blocked',()=>{const x=crypto();x.productionKmsKeyCustodyAndRotationDrilled=false;assert.ok(assessProductionCryptoBoundary(x).blockers.includes('PRODUCTION_KMS_CUSTODY_UNVERIFIED'));});
test('C08 no DB crypto mechanism approved blocked',()=>{const x=crypto();x.dbSignatureOrMacVerifierSupportedAndReviewed=false;assert.ok(assessProductionCryptoBoundary(x).blockers.includes('DB_CRYPTO_VERIFIER_NOT_APPROVED'));});
test('C09 no service-role bypass closure blocked',()=>{const x=crypto();x.noServiceRoleOrBypassRlsEscalationVerified=false;assert.ok(assessProductionCryptoBoundary(x).blockers.includes('SERVICE_ROLE_BYPASS_NOT_CLOSED'));});
test('C10 unsigned independent human review blocked',()=>{const x=crypto();x.independentHumanSecurityReviewSigned=false;assert.ok(assessProductionCryptoBoundary(x).blockers.includes('HUMAN_SECURITY_REVIEW_NOT_SIGNED'));});
test('C11 public synthetic HMAC key must never ship',()=>{const x=crypto();x.usePublicSyntheticHmacKey=true;assert.ok(assessProductionCryptoBoundary(x).blockers.includes('KNOWN_PUBLIC_QA_KEY_FORBIDDEN'));});
test('C12 user-supplied Store scope explicitly forbidden',()=>{const x=crypto();x.useClientSuppliedStoreClaims=true;assert.ok(assessProductionCryptoBoundary(x).blockers.includes('USER_STORE_AUTHORITY_FORBIDDEN'));});
test('C13 unapproved pgSodium installation forbidden',()=>{const x=crypto();x.installPgSodiumWithoutApproval=true;assert.ok(assessProductionCryptoBoundary(x).blockers.includes('UNAPPROVED_EXTENSION_INSTALL_FORBIDDEN'));});
test('C14 never activates production signer',()=>{const x=assessProductionCryptoBoundary(crypto());assert.equal(x.liveSignerConnected,false);assert.equal(x.deployed,false);});
test('C15 never assumes SQL Ed25519 verifier exists',()=>{const x=assessProductionCryptoBoundary(crypto());assert.equal(x.databaseCryptoMechanism,'UNSELECTED_PENDING_TRUST_REVIEW');});
test('C16 user-supplied JWT signature alone cannot satisfy backend trust',()=>assert.ok(designDecision.rejected.includes('JWT_SIGNATURE_ONLY_AS_ACTIVE_SESSION')));
test('C17 public generic service_role proxy forbidden',()=>assert.ok(designDecision.rejected.includes('PUBLIC_OR_CLIENT_SERVICE_ROLE_PROXY')));
test('C18 PostgreSQL pgSodium unverified is rejected for live signing',()=>assert.ok(designDecision.rejected.includes('PGJWT_OR_PGSODIUM_WITHOUT_SUPPORTED_VERIFIER_QA')));
