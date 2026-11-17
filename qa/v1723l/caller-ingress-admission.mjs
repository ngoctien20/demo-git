// TIEN404 V17.23L: source-only review, never authority or hosted execution.
export const KNOWN = Object.freeze({
 totalWorkflows:151,activeWorkflows:22,scannedActive:22,
 directRpcWorkflow:'OgDZNSAvKEvhnAvn',directRpc:'qa_shop_b_zalo_claim',
 parentWorkflow:'yIJk8LvJoLF40Z62',
 rpcNameSet:['qa_shop_b_zalo_claim','qa_owner_pairing','save_merchant_product']
});
const unique=items=>Object.freeze([...new Set(items)]);
export function inspectCallerReconciliation(x={}){
 const reasons=[];
 if(x?.totalWorkflows!==KNOWN.totalWorkflows || x?.activeWorkflows!==KNOWN.activeWorkflows ||
    x?.scannedActive!==KNOWN.scannedActive)reasons.push('N8N_INVENTORY_RECHECK_REQUIRED');
 if(x?.directRpcWorkflow!==KNOWN.directRpcWorkflow || x?.directRpc!==KNOWN.directRpc ||
    x?.parentWorkflow!==KNOWN.parentWorkflow)reasons.push('KNOWN_PUBLISHED_CALLER_MISMATCH');
 if(x?.externalWorkerInventoryIndependentlyVerified!==true)reasons.push('WORKERS_NOT_EXHAUSTIVELY_INVENTORIED');
 if(x?.edgeFunctionInventoryIndependentlyVerified!==true)reasons.push('EDGE_FUNCTIONS_NOT_EXHAUSTIVELY_INVENTORIED');
 if(x?.inactiveWorkflowDynamicCallersReviewed!==true)reasons.push('INACTIVE_OR_DYNAMIC_CALLERS_UNREVIEWED');
 // Metadata promises are not primary evidence. Never allow revoke, even all claimed green.
 reasons.push('INDEPENDENT_CALLER_RECONCILIATION_REQUIRED');
 return Object.freeze({status:'NO_REVOKE',reasonCodes:unique(reasons),activeN8nNodesReviewedOnly:true,
 completeGlobalCallerInventory:false,canRevokeRpc:false,canRunRpc:false,canChangeWorkflow:false,canDeploy:false});
}
export const INGRESS_CHECKS=Object.freeze([
 'provider_native_signature_or_documented_authn_verified',
 'raw_event_integrity_attested_by_trusted_ingress',
 'verified_provider_installation_bound_to_store_server_side',
 'anti_replay_atomic_durable_nonce_verified',
 'origin_authorization_is_not_llm_or_client_supplied',
 'no_outbound_reply_or_order_write',
 'independent_private_operator_review'
]);
export function inspectIngressAdmission({provider,assertions={},payload}={}){
 const reasons=[];
 if(!['messenger','zalo'].includes(provider))reasons.push('UNKNOWN_PROVIDER');
 for(const flag of INGRESS_CHECKS)if(assertions?.[flag]!==true)reasons.push('MISSING_'+flag.toUpperCase());
 if(payload!==undefined)reasons.push('RAW_PROVIDER_PAYLOAD_NOT_ALLOWED_IN_PUBLIC_CHECKER');
 reasons.push('NATIVE_PROVIDER_SIGNATURE_NOT_ACTUALLY_VERIFIED_HERE');
 return Object.freeze({status:'PROVIDER_NO_GO',reasonCodes:unique(reasons),nativeSignatureVerified:false,
 verifiedInstallation:false,storeAuthorityVerified:false,canPairCustomer:false,canReadOrder:false,canSend:false,canDeploy:false});
}
export function inspectPrivateJwtAdmission({mode,claims={},token,privatePacket}={}){
 const reasons=[];
 if(mode!=='NO_SEND_READ_ONLY')reasons.push('NO_SEND_ONLY');
 for(const key of ['private_owner_authority_verified','independent_reviewer_verified','current_m0_restore_accepted','canonical_same_tenant_store_ab_verified','issuer_signed_jwt_a_and_b_verified','active_sessions_rechecked','rls_cross_store_negative_passed','customer_one_time_pairing_verified']){
   if(claims?.[key]!==true)reasons.push('MISSING_'+key.toUpperCase());
 }
 if(token!==undefined||privatePacket!==undefined)reasons.push('SENSITIVE_INPUT_DISALLOWED');
 reasons.push('PRIVATE_AUTH_RUNNER_NOT_CONNECTED');
 return Object.freeze({status:'HOSTED_JWT_NO_GO',reasonCodes:unique(reasons),realJwtVerified:false,realRlsVerified:false,canReadOrder:false,canUseServiceRole:false,canWrite:false,canSend:false,canDeploy:false});
}
