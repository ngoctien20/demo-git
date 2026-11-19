/**
 * V18.3.6Q — local GoTrue runtime admission, PRE-LAUNCH ONLY.
 * A plan packet is never executable authority; no child_process/network/API.
 */
const DIGEST=/^sha256:[a-f0-9]{64}$/;
const SEMVER=/^\d+\.\d+\.\d+$/;
const result=(state,failed)=>Object.freeze({
 state,
  unmet:Object.freeze([...new Set(failed)]),
  hostEnvironmentVerified:false,
  trustedHumanApprovalVerified:false,
  localGoTrueStarted:false,
  localUsersCreated:0,
  localSessionsObserved:0,
  protectedSessionDeleteUatVerified:false,
  productionAdmitted:false,
  mayStartRuntime:false,
});
export function evaluateGoTrueRuntimeAdmission(candidate) {
 const x=candidate&&typeof candidate==='object'&&!Array.isArray(candidate)?candidate:{};
 const failure=[];
 if(x.mode!=='PREFLIGHT_ONLY')failure.push('RUN_MODE_NOT_PREFLIGHT');
 if(x.target!=='NEW_ISOLATED_LOCAL_STACK'||x.connectedProjectRef!==null)
   failure.push('LOCAL_DISPOSABLE_ONLY');
 if(!SEMVER.test(x.cliVersion||'')||!DIGEST.test(x.authImageDigest||'')||
    !DIGEST.test(x.postgresImageDigest||''))failure.push('PIN_LOCAL_CLI_AND_CONTAINER_DIGEST');
 if(x.cliHelpReviewed!==true||x.dockerEngineObserved!==true||
    x.imageCompatibilityReviewed!==true)failure.push('SUPPORTED_RUNTIME_UNVERIFIED');
 if(x.publicPortExposed!==false||x.loopbackOnly!==true||
    x.outboundInternetDisabled!==true||x.smsSmtpDeliveryDisabled!==true||
    x.webhookOutboundDisabled!==true)failure.push('NETWORK_EGRESS_POLICY_UNVERIFIED');
 if(x.fixtureUsersOnly!==true||x.noExistingAuthTokens!==true||
    x.noStagingVolumes!==true||x.ephemeralCredentialsOnly!==true)
   failure.push('AUTH_IDENTITY_AND_VOLUME_BOUNDARY_UNVERIFIED');
 if(x.verifiedSamePgDomain!==true||x.privateDbLockPreflight!==true||
    x.noGenericServiceRoleSqlProxy!==true)
   failure.push('AUTH_STORE_TX_PREREQUISITE_UNVERIFIED');
 if(x.rollbackTeardownReviewed!==true||x.redactedEvidenceRetentionReviewed!==true)
   failure.push('CLEANUP_AND_REDACTION_UNVERIFIED');
 if(x.resourceApprovalRequested!==true||x.independentSecurityReviewerRequested!==true)
   failure.push('RESOURCE_AND_REVIEW_REQUEST_MISSING');
 if(x.ownerActuallyAuthorized===true||x.realUserLoggedIn===true||
    x.networkSendOccurred===true||x.stagingDatabaseModified===true||
    x.productionKeyMounted===true)failure.push('UNVERIFIED_LIVE_ACTION_FLAG');
 return result(failure.length?'BLOCKED_PLAN':'PLAN_READY_FOR_INDEPENDENT_RUNTIME_APPROVAL',failure);
}
export function runtimeAdmissionEvidenceMatrix() {
 return Object.freeze({
  designOnly:true,
  scenarios:Object.freeze([
    'local/global/others signOut', 'JWT signature still valid after signOut',
    'READ_FIRST_VS_GOTRUE_DELETE', 'DELETE_FIRST_VS_READ',
    'timebox/inactivity/session-row-lingering', 'refresh reuse/rotation',
    'Store A/B intra-Tenant negative', 'private RPC replay and credential rotation',
    'db failover/timeout', 'isolated cleanup'
  ]),
  liveScenarioCount:0,
  futureExecutionRequiresSeparateOwnerApproval:true,
  noExternalEgress:true,
  noLiveAccounts:true,
 });
}
