/**
 * V18.3.6L — authoritative-session revocation timeline model (offline).
 *
 * IMPORTANT: No real Supabase session check or access decision occurs here.
 * All input is synthetic; an attacker can lie about it. This code outputs
 * review findings, NEVER an authorization decision or production approval.
 * "No observed revoke" != "no revoke in external Supabase Auth".
 */
const hash=/^[0-9a-f]{64}$/;
const time=x=>Number.isSafeInteger(x)&&x>=1_500_000_000;
const result=(code,risk,details={})=>Object.freeze({
  status:'REVIEW_ONLY',
  finding:code,
  risk,
  ...details,
  realAuthVerified:false,
  productionAdmitted:false,
  permitsRead:false,
  permitsWrite:false,
  permitsProviderSend:false,
});
export function analyzeRevocationTimeline(input){
  if(!input||typeof input!=='object'||Array.isArray(input))return result('MISSING_EVIDENCE','P0');
  const {session,request,events}=input;
  if(!session||!request||!events||typeof events!=='object')return result('MISSING_EVIDENCE','P0');
  const {tokenVerified,sessionHash,subjectHash,tenantHash,storeHash,memberRevisionHash,
    observedSource,checkedAt,active,revokedAt,validUntil}=session;
  const {startedAt,committedAt,sessionHash:requestedSession,
    subjectHash:requestedSubject,tenantHash:requestedTenant,
    storeHash:requestedStore,memberRevisionHash:requestedRevision,operation}=request;
  if (![sessionHash,subjectHash,tenantHash,storeHash,memberRevisionHash,
       requestedSession,requestedSubject,requestedTenant,requestedStore,requestedRevision].every(x=>typeof x==='string'&&hash.test(x))||
      ![checkedAt,validUntil,startedAt,committedAt].every(time)||
      !['CATALOG_READ','ORDER_READ'].includes(operation)||
      committedAt<startedAt||checkedAt>committedAt||validUntil<checkedAt)
    return result('INVALID_SCOPE_OR_CLOCK','P0');
  if(!tokenVerified||observedSource!=='synthetic_authoritative_session_fixture')
    return result('UNVERIFIED_AUTH_SOURCE','P0');
  if(sessionHash!==requestedSession||subjectHash!==requestedSubject||
     tenantHash!==requestedTenant||storeHash!==requestedStore||
     memberRevisionHash!==requestedRevision)
    return result('SESSION_OR_STORE_BINDING_MISMATCH','P0');
  if(active!==true||revokedAt!==null)
    return result('REVOKED_AT_CHECK','P0');
  if(startedAt-checkedAt>2||checkedAt>startedAt||validUntil<committedAt||
    validUntil>checkedAt+3)
    return result('STALE_OR_UNBOUNDED_AUTH_CHECK','P0');
  if(events.remoteAvailable!==true||events.revocationFeedHealthy!==true)
    return result('REMOTE_AUTH_OR_FEED_UNAVAILABLE','P0');
  const {remoteRevokedAt,localObservedAt}=events;
  if(remoteRevokedAt!==null&&remoteRevokedAt!==undefined){
    if(!time(remoteRevokedAt))
      return result('INVALID_REMOTE_REVOKE_EVIDENCE','P0');
    if(remoteRevokedAt<=checkedAt)
      return result('REMOTE_REVOKED_BEFORE_CHECK_BUT_LOCAL_ACTIVE','P0');
    if(remoteRevokedAt<=committedAt){
      return result('REMOTE_REVOKED_AFTER_CHECK_BEFORE_COMMIT','P0',{
        divergenceSeconds:remoteRevokedAt-checkedAt,
        localPropagationObserved:time(localObservedAt)&&localObservedAt<=committedAt,
      });
    }
    return result('REMOTE_REVOKED_AFTER_COMMIT','P1');
  }
  if(events.revocationLedgerEpoch!==events.sessionEpoch||
     !time(events.revocationLedgerEpoch)||!time(events.sessionEpoch))
    return result('REVOCATION_EPOCH_NOT_AUTHORITY_BACKED','P0');
  // Even a clean fixture has an unproven post-check race in a different
  // transactional domain. This cannot become ADMITTED through simulation.
  return result('NO_REVOKE_OBSERVED_BUT_CROSS_SERVICE_RACE_UNPROVEN','P0',{
    boundedFreshnessSeconds:startedAt-checkedAt,
  });
}
/**
 * Hard release stop: metadata alone NEVER establishes real session authority.
 * Requires independent production evidence outside this offline repository.
 */
export function assessExternalAuthAdmissionEvidence(evidence){
  const blockers=[];
  const e=evidence&&typeof evidence==='object'?evidence:{};
  if(e.realSupabaseAuthSessionProofReviewed!==true)blockers.push('REAL_AUTH_SESSION_EVIDENCE_MISSING');
  if(e.sessionSourceOfTruthApproved!==true)blockers.push('REVOCATION_AUTHORITY_NOT_APPROVED');
  if(e.externalRevocationAtCommitProven!==true)blockers.push('CROSS_SERVICE_REVOCATION_RACE_UNCLOSED');
  if(e.sameTenantStoreABVerified!==true)blockers.push('REAL_STORE_AB_UNVERIFIED');
  if(e.independentHumanReviewerApproved!==true)blockers.push('HUMAN_REVIEW_NOT_APPROVED');
  // Even an all-true metadata package isn't independently verified by code.
  return Object.freeze({
    status:blockers.length?'BLOCKED':'EVIDENCE_PACKAGE_FOR_INDEPENDENT_PRIVATE_REVIEW',
    blockers:Object.freeze(blockers),
    realAuthVerified:false,productionAdmitted:false,
    productionWriteAllowed:false,providerSendAllowed:false,
  });
}
