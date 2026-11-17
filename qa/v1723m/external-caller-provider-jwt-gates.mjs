/**
 * TIEN404 V17.23M independent RPC/Ingress/JWT evidence gates.
 * READ-ONLY SOURCE-ONLY: never authorize an external caller, owner or JWT.
 * No credentials, JWT, raw provider events, customer records or original
 * Store provenance are accepted as evidence by this public module.
 */
export const BASELINE=Object.freeze({
  projectRef:'ifxlvrhyjhbzbrkdsida',
  workerScriptsListed:31,workerSourcesInspected:31,
  privilegedRpcLiteralWorkerMatches:0,genericRpcBioWorkers:13,
  edgeFunctionsListed:1,edgeFunctionSourcesInspected:1,
  edgeJwtGatewayEnabled:true,edgeTenantOnlyOwnerCheck:true,
  n8nWorkflowCount:151,n8nActiveReviewed:22,
  n8nPrivilegedRpcDirectCallers:1,
  knownRpc:'qa_shop_b_zalo_claim',
  knownN8nCaller:'OgDZNSAvKEvhnAvn',
  confirmedNativeProviderEventSignatures:0,
  confirmedPrivateSameTenantStoreAbJwtUat:0
});
export const REQUIRED_PROVIDER_PROOFS=Object.freeze([
 'native_signed_payload_from_approved_test_installation',
 'raw_payload_bytes_authenticated_before_normalization',
 'provider_request_timestamp_checked_within_window',
 'event_nonce_replay_guard_durable_and_atomic',
 'provider_installation_server_mapped_to_canonical_store',
 'merchant_owner_granted_scoped_private_qa_consent',
 'independent_security_operator_verified_primary_event',
 'no_send_no_write_guards_independently_observed'
]);
export const REQUIRED_JWT_PROOFS=Object.freeze([
 'two_issuer_verified_supabase_user_access_tokens',
 'distinct_subjects_with_live_unrevoked_sessions',
 'same_tenant_two_canonical_stores_with_independent_owner_proof',
 'user_scoped_rls_reader_without_service_role',
 'store_ab_positive_negative_same_tenant_sql_acceptance',
 'cross_customer_and_cross_tenant_negative_acceptance',
 'private_auth_operator_verified_and_owner_consented',
 'current_m0_recovery_accepted_by_independent_reviewer',
 'signed_provider_pairing_challenge_single_use',
 'test_environment_no_order_write_or_provider_send'
]);
const dedup=a=>Object.freeze([...new Set(a)]);
const plain=x=>!!x&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
export function assessGlobalCallerCoverage(snapshot={}){
 const issues=[];
 for(const [key,v] of Object.entries(BASELINE))if(snapshot[key]!==v)issues.push('RECHECK_'+key.toUpperCase());
 if(snapshot?.allProductionDeploymentsMapped!==true)issues.push('PRODUCTION_DEPLOYMENT_MAPPING_MISSING');
 if(snapshot?.allWorkerDynamicRpcPathsReviewed!==true)issues.push('DYNAMIC_RPC_CALLERS_NOT_FULLY_CLASSIFIED');
 if(snapshot?.thirdPartyAndInactiveCallersIndependentlyReconciled!==true)issues.push('EXTERNAL_OR_INACTIVE_CALLERS_UNVERIFIED');
 // All self assertions are untrusted; no global clearance.
 issues.push('INDEPENDENT_CROSS_PLATFORM_CALLER_ATTESTATION_REQUIRED');
 return Object.freeze({status:'GLOBAL_CALLER_NO_GO',issues:dedup(issues),workerSourceInventoryReviewed:true,globalCallerInventoryAccepted:false,canRevokeRpc:false,canChangePrivilege:false,canDeploy:false});
}
export function assessProviderEvidence(provider,receipt={}){
 const issues=[];
 if(!['messenger','zalo'].includes(provider))issues.push('INVALID_PROVIDER');
 if(!plain(receipt))issues.push('INVALID_RECEIPT');
 for(const key of REQUIRED_PROVIDER_PROOFS)if(receipt?.[key]!==true)issues.push('MISSING_'+key.toUpperCase());
 for(const key of ['jwt','token','rawPayload','signature','secret','pageAccessToken','senderId','customerPhone','merchantId'])
  if(plain(receipt)&&Object.hasOwn(receipt,key))issues.push('SENSITIVE_OR_UNTRUSTED_INPUT_REJECTED');
 issues.push('NO_PRIMARY_SIGNED_EVENT_VERIFIED_IN_PUBLIC_CI');
 return Object.freeze({status:'NATIVE_SIGNATURE_NO_GO',issues:dedup(issues),actualProviderSignatureVerified:false,installationOwnershipVerified:false,canPair:false,canSend:false,canReadCustomerOrder:false,canDeploy:false});
}
export function assessPrivateJwtUat(receipt={}){
 const issues=[];
 if(!plain(receipt))issues.push('INVALID_RECEIPT');
 for(const key of REQUIRED_JWT_PROOFS)if(receipt?.[key]!==true)issues.push('MISSING_'+key.toUpperCase());
 for(const key of ['jwtA','jwtB','refreshToken','userId','storeId','customerId','authHeader','privateOwnerLedger','serviceRoleKey'])
  if(plain(receipt)&&Object.hasOwn(receipt,key))issues.push('PRIVATE_INPUT_REJECTED');
 issues.push('PRIVATE_AUTHENTICATED_TEST_RUNNER_NOT_ATTESTED');
 return Object.freeze({status:'PRIVATE_JWT_NO_GO',issues:dedup(issues),realSessionAdmitted:false,canonicalStoreIsolationAdmitted:false,canReadOrders:false,canWriteOrders:false,canIssueJwt:false,canSend:false,canDeploy:false});
}
