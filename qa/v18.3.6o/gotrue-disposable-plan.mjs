/**
 * V18.3.6O — non-executable disposable GoTrue UAT admission plan.
 * No containers, Auth service, users or secrets are created here.
 * GoTrue semantics must be measured using supported local APIs only
 * AFTER isolated resource/cost + operator approvals.
 */
export const gotrueScenarios=Object.freeze([
 ['GT01','local','current-session signOut removes only current session'],
 ['GT02','global','global signOut removes all same-user sessions'],
 ['GT03','others','others signOut keeps current and ends other same-user sessions'],
 ['GT04','jwt-exp','a cryptographically valid JWT may outlive signout'],
 ['GT05','session-delete-first','signOut committed before protected read denies'],
 ['GT06','session-read-first','protected read linearizes before signOut; subsequent read denies'],
 ['GT07','session-user-binding','session_id exists but user mismatch denies'],
 ['GT08','timebox','timeboxed session can be ineligible before row cleanup'],
 ['GT09','inactivity','inactive session ineligible before row cleanup'],
 ['GT10','single-session','new login invalidates previous session according to config'],
 ['GT11','password-change','security event and Auth/user state enforcement'],
 ['GT12','refresh-reuse','reuse detection and refresh token rotation'],
 ['GT13','auth-unavailable','unreachable Auth API denies; never cached allow'],
 ['GT14','db-lock-timeout','lock wait timeout returns denial, no nonce'],
 ['GT15','store-revocation','same Auth session, revoked Store member denies'],
 ['GT16','jti-replay','same receipt replay returns denial'],
 ['GT17','cross-store','independent synthetic A/B in same Tenant cannot cross-read'],
 ['GT18','restarted-services','GoTrue/DB restart cannot restore stale privilege'],
 ['GT19','ambiguous-ack','network interrupted after signOut response unclear; fail closed'],
 ['GT20','shutdown-cleanup','test accounts, keys, database volumes removed after acceptance'],
].map(([id,scope,description])=>Object.freeze({id,scope,description,
   realEvidence:'NOT_COLLECTED',passed:false})));
const hex=/^[a-f0-9]{64}$/;
export function assessDisposableGoTruePlan(p){
 const x=p&&typeof p==='object'&&!Array.isArray(p)?p:{};
 const blockers=[];
 if(x.executionMode!=='PLAN_ONLY')blockers.push('MUST_REMAIN_PLAN_ONLY');
 if(x.target!=='LOCAL_DISPOSABLE_SUPABASE_STACK')blockers.push('LOCAL_DISPOSABLE_ONLY');
 if(x.targetProjectRef!==null)blockers.push('REMOTE_PROJECT_REFERENCE_FORBIDDEN');
 if(x.egressDisabled!==true)blockers.push('PROHIBIT_EXTERNAL_EGRESS');
 if(x.publicEndpointDisabled!==true)blockers.push('NO_PUBLIC_AUTH_LISTENER');
 if(x.syntheticUsersOnly!==true)blockers.push('NO_REAL_USERS_OR_OWNER_A_B');
 if(x.credentialsGeneratedEphemerally!==true)blockers.push('EPHEMERAL_TEST_CREDENTIALS_REQUIRED');
 if(x.noSecretLogging!==true)blockers.push('AUTH_TOKEN_REDACTION_REQUIRED');
 if(x.noProductionConfigMounts!==true)blockers.push('NO_PRODUCTION_MOUNTS');
 if(x.noPersistentCustomerData!==true)blockers.push('NO_REAL_CUSTOMER_DATA');
 if(x.samePostgresAuthAndStoreVerified!==true)blockers.push('SAME_DB_TEST_PREREQUISITE');
 if(x.teardownAndEvidenceRetentionPlan!==true)blockers.push('TEARDOWN_PLAN_REQUIRED');
 if(x.approvalForResourceCreation!==true)blockers.push('RESOURCE_CREATION_APPROVAL_PENDING');
 if(x.independentReviewerAssigned!==true)blockers.push('INDEPENDENT_REVIEWER_NOT_ASSIGNED');
 if(typeof x.toolVersionPinnedDigest!=='string'||!hex.test(x.toolVersionPinnedDigest))
  blockers.push('PINNED_TOOL_VERSION_EVIDENCE_REQUIRED');
 if(x.realSupabaseProjectConnected===true||x.productionCredentialMounted===true||
    x.providerSendsAllowed===true||x.migrationsToStagingAllowed===true)
  blockers.push('LIVE_SYSTEM_OR_ESCALATED_OPERATION_FORBIDDEN');
 return Object.freeze({
  status:blockers.length?'BLOCKED_PLAN_GATES':'PLAN_PACKET_READY_FOR_RESOURCE_APPROVAL',
  blockers:Object.freeze([...new Set(blockers)]),
  scenarioCount:gotrueScenarios.length,
  localRuntimeStarted:false,
  resourcesCreated:false,
  realAuthUatExecuted:false,
  authorizedToStart:false,
  actualSignOutSemanticsVerified:false,
  productionAdmitted:false,
 });
}
export function makeGoTrueEvidenceChecklist(){
 return Object.freeze({
   environment:'LOCAL_DISPOSABLE_SUPABASE_STACK',
   proposedSequence:Object.freeze([
     'PIN_CLI_GOTRUE_POSTGRES_VERSIONS_WITH_DIGEST',
     'ISOLATE_LOCAL_NETWORK_AND_SECRET_STORE',
     'CAPTURE_NO_PII_BASELINE',
     'CREATE_EPHEMERAL_SYNTHETIC_USERS_ON_LOCAL_AUTH',
     'RUN_SIGNOUT_SCOPES_WITH_TWO_SESSIONS_ONE_TEST_USER',
     'RUN_TXN_DELETE_READ_LOCK_ORDER_IN_LOCAL_POSTGRES',
     'TEST_TIMEOUTS_REFRESH_ROTATION_AND_FAILURES',
     'TEARDOWN_AND_VERIFY_NO_RESIDUAL_SECRETS',
     'INDEPENDENT_HUMAN_REVIEW_BEFORE_PROMOTION'
   ]),
   rawTokensAllowedInLogs:false,
   actualUatCompleted:false,
   approvalGranted:false,
 });
}
