/**
 * V18.3.6P: NON-EXECUTING isolated GoTrue harness blueprint.
 * Does NOT create Docker resources, accounts, Auth sessions, ports or keys.
 */
import {gotrueScenarios} from '../v18.3.6o/gotrue-disposable-plan.mjs';
const sha=/^sha256:[0-9a-f]{64}$/;
const ver=/^\d+\.\d+\.\d+$/;
const frozen=(state,blocking,descriptor)=>Object.freeze({
  status:state, blockers:Object.freeze(blocking),
  ...descriptor,containersStarted:0,actualAuthCalls:0,
  authSessionsRead:0,externalNetworkCalls:0,
  authorizedToStart:false,productionAdmitted:false,
});
export function checkLocalHarnessBlueprint(x){
 const p=x&&typeof x==='object'&&!Array.isArray(x)?x:{};
 const failures=[];
 if(p.mode!=='PLAN_ONLY')failures.push('PLAN_ONLY');
 if(p.target!=='BRAND_NEW_DISPOSABLE_LOCAL')failures.push('LOCAL_ONLY');
 if(p.projectRef!==null)failures.push('NO_EXISTING_PROJECT_REF');
 if(!ver.test(p.supabaseCliVersion||''))failures.push('PIN_CLI_VERSION');
 if(!sha.test(p.gotrueImageDigest||'')||!sha.test(p.postgresImageDigest||''))
   failures.push('PIN_CONTAINER_DIGESTS');
 if(p.bindAddress!=='127.0.0.1')failures.push('LOOPBACK_ONLY');
 if(p.externalEgressBlocked!==true||p.smtpNetworkDisabled!==true||
    p.smsNetworkDisabled!==true||p.webhookNetworkDisabled!==true)
   failures.push('NO_EXTERNAL_EGRESS');
 if(p.containerImagePullPreflightComplete!==true)
   failures.push('OFFLINE_IMAGE_CACHE_PREFLIGHT');
 if(p.privateLocalCredentialStore!==true||p.tokenLogRedaction!==true)
   failures.push('CREDENTIAL_REDACTION');
 if(p.noRealOwners!==true||p.syntheticDataOnly!==true||
    p.noStagingVolumes!==true)
   failures.push('SYNTHETIC_ISOLATION_ONLY');
 if(p.sameDatabaseForAuthAndStore!==true)
   failures.push('SAME_DB_TOPOLOGY_REQUIRED');
 if(p.lockingAndRowPrivilegePreflight!==true)
   failures.push('TRANSACTION_LOCKS_AND_ROLES_PREFLIGHT');
 if(p.twoPersonResourceApproval!==true||p.separateLocalTestApproval!==true)
   failures.push('RESOURCE_APPROVAL_REQUIRED');
 if(p.cleanupProcedureReviewed!==true||p.disposableVolumeVerified!==true)
   failures.push('CLEANUP_RESTORE_PLAN');
 if(p.productionServicesEnabled===true||p.providerSendEnabled===true||
    p.usesActualAuthUsers===true||p.usesServiceRoleFromStaging===true)
   failures.push('LIVE_SERVICES_FORBIDDEN');
 return frozen(failures.length?'BLOCKED_HARNESS_BLUEPRINT':'PLAN_READY_FOR_HUMAN_REVIEW_ONLY',
   [...new Set(failures)],{
     scenarioCount:gotrueScenarios.length,
     runtimeType:'LOCAL_DISPOSABLE_GOTRUE_POSTGRES',
     testedAuthBehaviour:false,
     simulatedApprovalDoesNotGrantExecution:true,
     expectedEvidence:'REDACTED_SCENARIO_OUTCOMES_AND_PINNED_IMAGE_DIGESTS'
   });
}
export function getHarnessPlan(){
 return Object.freeze({
  status:'NON_EXECUTABLE_BLUEPRINT',
  actions:Object.freeze([
   'OWNER_APPROVES_NEW_LOCAL_RESOURCE_AND_TEST_IDENTITY_CREATION',
   'INDEPENDENT_REVIEWER_SIGNS_SCOPE_AND_TIMEOUT',
   'PIN_CLI_AND_GO_TRUE_PG17_IMAGES_BY_DIGEST',
   'PREPARE_IMAGE_CACHE_AND_ISOLATED_INTERNAL_NETWORK',
   'VERIFY_EXTERNAL_EGRESS_IS_BLOCKED_AND_LOOPBACK_ONLY',
   'START_EPHEMERAL_LOCAL_GOTRUE_POSTGRES_ONLY_AFTER_APPROVAL',
   'RUN_20_SYNTHETIC_AUTH_SESSION_SCENARIOS',
   'TEST_CROSS_STORE_AND_TRANSACTION_BARRIERS',
   'COLLECT_REDACTED_EVIDENCE_WITHOUT_TOKENS',
   'TEARDOWN_SYNTHETIC_ACCOUNTS_AND_EPHEMERAL_VOLUMES',
   'INDEPENDENT_SECURITY_REVIEW_BEFORE_ANY_PROMOTION'
  ]),
  codeActuallyExecutesContainers:false,
  remoteProjectConnected:false,
  neverLogsTokens:true,
 });
}
