/**
 * TIEN404 V18.3.6N — synthetic Supabase Auth signOut scope contract.
 *
 * Supabase documents "global", "local" and "others" scope semantics.
 * This is NOT an implementation of Supabase GoTrue and does not contact Auth.
 * In particular, record existence does NOT prove a time-boxed/inactive
 * session was already deleted; Auth cleanup can be delayed.
 */
const validId=x=>typeof x==='string'&&/^[a-z0-9_-]{2,64}$/i.test(x);
const isTime=x=>Number.isSafeInteger(x)&&x>=0;
const answer=(code,extra={})=>Object.freeze({
 model:'SYNTHETIC_CONTRACT_ONLY',code,...extra,
 realAuthServiceVerified:false,
 realSessionRowsRead:false,
 productionPermission:false,
 });
export function simulateSignOut({sessions,actorSessionId,scope}={}){
 if(!Array.isArray(sessions)||!validId(actorSessionId)||
    !['global','local','others'].includes(scope)||sessions.length<1||
    sessions.length>24||sessions.some(s=>!s||!validId(s.id)||!validId(s.userId))||
    new Set(sessions.map(s=>s.id)).size!==sessions.length)
   return answer('INVALID_SIMULATED_SIGNOUT_REQUEST');
 const current=sessions.find(s=>s.id===actorSessionId);
 if(!current)return answer('ACTOR_SESSION_NOT_FOUND');
 const revoked=[],preserved=[];
 for(const s of sessions){
  const sameUser=s.userId===current.userId;
  const revoke=sameUser&&(scope==='global'||
    (scope==='local'&&s.id===actorSessionId)||
    (scope==='others'&&s.id!==actorSessionId));
  (revoke?revoked:preserved).push(s.id);
 }
 return answer('EXPECTED_SCOPE_SEMANTICS',{
   scope,revoked:Object.freeze(revoked),preserved:Object.freeze(preserved)
 });
}
export function evaluateSensitiveReadSession({
 signatureVerified,sessionId,userId,tokenExpiresAt,
 sessionRecord,authPolicy,nowEpochSec
}={}){
 if(!isTime(nowEpochSec)||!validId(sessionId)||!validId(userId)||
    !isTime(tokenExpiresAt)||signatureVerified!==true)
   return answer('DENY_BAD_TOKEN_OR_CLOCK');
 if(tokenExpiresAt<=nowEpochSec)return answer('DENY_ACCESS_JWT_EXPIRED');
 if(!sessionRecord||sessionRecord.id!==sessionId||
    sessionRecord.userId!==userId)return answer('DENY_MISSING_OR_MISMATCHED_SESSION');
 if(!authPolicy||authPolicy.authoritativePolicyVersionVerified!==true ||
    authPolicy.userStatusKnownActive!==true ||
    authPolicy.isTimeboxEligible!==true ||
    authPolicy.isInactivityEligible!==true ||
    authPolicy.isSingleSessionEligible!==true)
   return answer('DENY_AUTH_POLICY_UNVERIFIED_OR_INELIGIBLE');
 if(!isTime(sessionRecord.notAfterEpochSec)||sessionRecord.notAfterEpochSec<=nowEpochSec)
   return answer('DENY_SESSION_NOT_AFTER');
 // Auth service itself may decide to revoke after this evaluation. Never
 // equate "ALLOW_SYNTHETIC_PRECONDITIONS" with an admission ticket.
 return answer('SYNTHETIC_PRECONDITIONS_SATISFIED',{
   sessionRecordStillExists:true,
   sameTransactionAuthLockVerified:false,
   realProviderSignoutVerified:false,
 });
}
export const authServiceRaceMatrix=Object.freeze([
 'LOCAL_CURRENT_SESSION',
 'GLOBAL_ALL_USER_SESSIONS',
 'OTHERS_PRESERVES_CURRENT',
 'DELETE_WINS_BEFORE_READ',
 'READ_WINS_BEFORE_DELETE',
 'ACCESS_JWT_VALID_AFTER_SIGNOUT',
 'TIMEBOX_EXPIRED_ROW_STILL_PRESENT',
 'INACTIVITY_EXPIRED_ROW_STILL_PRESENT',
 'SINGLE_SESSION_POLICY',
 'PASSWORD_CHANGE_OR_USER_DISABLE',
 'REFRESH_REUSE_AND_TOKEN_ROTATION',
 'AUTH_SERVICE_ERROR',
 'DB_ROW_LOCK_TIMEOUT',
 'STORE_MEMBERSHIP_REVOKED',
 'REPLAY_SAME_JTI',
]);
export function assessRealAuthServiceAdmission(evidence){
 const x=evidence&&typeof evidence==='object'?evidence:{};
 const provided=x.testEvidenceHashes&&typeof x.testEvidenceHashes==='object'?x.testEvidenceHashes:{};
 const blockers=authServiceRaceMatrix
   .filter(t=>typeof provided[t]!=='string'||!/^[a-f0-9]{64}$/.test(provided[t]))
   .map(t=>'MISSING_PRIVATE_EVIDENCE_'+t);
 if(x.ownerApprovedRealAuthTest!==true)blockers.push('REAL_AUTH_TEST_REQUIRES_EXPLICIT_OWNER_APPROVAL');
 if(x.isolatedPrivateAuthProject!==true)blockers.push('ISOLATED_AUTH_PROJECT_NOT_VERIFIED');
 if(x.independentHumanSecurityReviewer!==true)blockers.push('INDEPENDENT_SECURITY_REVIEW_MISSING');
 if(x.verifiedRealSessionIdAndUserBinding!==true)blockers.push('REAL_AUTH_SESSION_BINDING_UNVERIFIED');
 if(x.attestedActualPostgresLockOrdering!==true)blockers.push('REAL_AUTH_DELETE_LOCK_ORDER_UNVERIFIED');
 // Hashes and booleans do not establish signed evidence. This method is a
 // checklist preparer, not a validator of actual third-party evidence.
 return Object.freeze({
   status:blockers.length?'BLOCKED':'PRIVATE_EVIDENCE_PACKAGE_FOR_HUMAN_REVIEW_ONLY',
   blockers:Object.freeze(blockers),
   scenarioCount:authServiceRaceMatrix.length,
   realAuthUatExecuted:false,
   realAuthAdmissionVerified:false,
   productionAdmitted:false,
 });
}
