import {createHmac,timingSafeEqual} from 'node:crypto';

/**
 * V17.23N — source-only assurance. Meta HMAC fixture is NOT a provider event.
 * Zalo native/provider-auth mode requires independent documented protocol
 * and verified private receipt. No hosted grants, writes, RPC or sends.
 */
export const OBSERVATION=Object.freeze({
 workersListed:31, workerDeploymentsRead:31,workerSubdomainSettingsRead:31,
 workersDevEnabled:21,workersDevDisabled:10,
 workerDomains:1,zoneWorkerRoutes:0,bioRpcScripts:13,
 commercePrivilegedExactBioCalls:0,
 bioProductionName:'ngoctien20-bio',
 bioProductionDeployment:'22addbba-2cba-452a-9bac-63c5225d47be',
 bioProductionVersion:'dcfea800-b954-419b-8bd9-8e2d9862a29b',
 bioProductionTrafficPercent:100
});
export const BIO_RPC_NAMES=Object.freeze([
 'is_personal_admin','bio_publish_setting','bio_published_settings','bio_public_media_manifest'
]);
export const PRIVILEGED_COMMERCE_NAMES=Object.freeze([
 'qa_shop_b_zalo_claim','qa_owner_pairing','save_merchant_product'
]);
const unique=a=>Object.freeze([...new Set(a)]);

export function classifyBioRpcNames(names){
 const problems=[];
 if(!Array.isArray(names))return Object.freeze({status:'REVIEW_REQUIRED',problems:Object.freeze(['INVALID_RPC_NAMES']),privilegedTargetFound:false,canRevoke:false});
 const exact=names.filter(x=>typeof x==='string'&&PRIVILEGED_COMMERCE_NAMES.includes(x));
 const unknown=names.filter(x=>typeof x!=='string'||!BIO_RPC_NAMES.includes(x)&&!PRIVILEGED_COMMERCE_NAMES.includes(x));
 if(exact.length)problems.push('COMMERCE_PRIVILEGED_RPC_LITERAL_FOUND');
 if(unknown.length)problems.push('UNKNOWN_RPC_NAME_REQUIRES_CLASSIFICATION');
 return Object.freeze({status:problems.length?'REVIEW_REQUIRED':'BIO_STATIC_NAMES_CLASSIFIED',problems:unique(problems),
   staticPersonalRpcCount:names.length-exact.length-unknown.length,
   privilegedTargetFound:exact.length>0,externalDynamicCallerAttested:false,canRevoke:false,canDeploy:false});
}
export function evaluateDeployedRoutes(observed={}){
 const blockers=[];
 for(const [key,val] of Object.entries(OBSERVATION))if(observed[key]!==val)blockers.push('REVERIFY_'+key.toUpperCase());
 if(observed?.zoneRoutesComplete!==true)blockers.push('ZONES_OUTSIDE_ACCOUNT_NOT_ATTESTED');
 if(observed?.deploymentSourceHashVerified!==true)blockers.push('DEPLOYED_VERSION_SOURCE_HASH_NOT_VERIFIED');
 if(observed?.externalCallersAudited!==true)blockers.push('DYNAMIC_AND_EXTERNAL_CALLERS_NOT_VERIFIED');
 if(observed?.trafficPathRealVerified!==true)blockers.push('PRODUCTION_TRAFFIC_ROUTE_NOT_INDEPENDENTLY_VERIFIED');
 blockers.push('INDEPENDENT_PRIVATE_ROUTE_ACCEPTANCE_NOT_PRESENT');
 return Object.freeze({status:'DEPLOYMENT_REVIEW_NOT_ACCEPTED',blockers:unique(blockers),observedCurrentAccountOnly:true,
   canChangeRoutes:false,canRevokeRpc:false,canDeploy:false});
}
/** Pure-fixture Meta x-hub-signature-256 verifier.
 * Requires raw unmodified bytes; never runs with actual Meta secret here.
 */
export function verifyMetaSyntheticFixture({rawBody,header,appSecret}={}){
 if(!Buffer.isBuffer(rawBody)||rawBody.length===0||rawBody.length>65536) return false;
 if(typeof appSecret!=='string'||appSecret.length<16||appSecret.length>256)return false;
 if(typeof header!=='string'||!/^sha256=[a-f0-9]{64}$/.test(header))return false;
 const expected=createHmac('sha256',appSecret).update(rawBody).digest();
 const supplied=Buffer.from(header.slice(7),'hex');
 return supplied.length===expected.length&&timingSafeEqual(supplied,expected);
}
export const NATIVE_INGRESS_PROOFS=Object.freeze([
 'provider_owned_qa_app_and_merchant_consent_privately_verified',
 'documented_provider_signature_protocol_approved_for_this_channel',
 'actual_raw_event_verified_before_normalization',
 'signature_nonce_timestamp_and_replay_control_accepted',
 'installation_id_bound_to_canonical_store_server_side',
 'negative_invalid_signature_expired_replay_and_wrong_install_tests',
 'independent_operator_and_security_reviewer_signed',
 'hosted_no_send_no_order_write_controls_independently_accepted'
]);
export function assessNativeIngress(provider,receipt={}){
 const reasons=[];
 if(!['meta-messenger','zalo-bot','zalo-oa'].includes(provider))reasons.push('PROVIDER_UNSUPPORTED');
 for(const name of NATIVE_INGRESS_PROOFS)if(receipt?.[name]!==true)reasons.push('MISSING_'+name.toUpperCase());
 for(const k of ['rawBody','signature','token','secret','accessToken','customerId','ownerDocument','providerEvent','jwt'])
   if(receipt&&typeof receipt==='object'&&Object.hasOwn(receipt,k))reasons.push('PRIVATE_INPUT_REJECTED');
 reasons.push('NO_REAL_PROVIDER_NATIVE_EVENT_IN_PUBLIC_CI');
 return Object.freeze({status:'NATIVE_PROVIDER_NO_GO',reasons:unique(reasons),realNativeSignatureVerified:false,verifiedInstallation:false,
   canReadOrder:false,canPairCustomer:false,canSend:false,canRevokeRpc:false,canDeploy:false});
}
