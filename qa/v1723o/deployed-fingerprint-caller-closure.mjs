/**
 * V17.23O public, source-only read-only inventory policy.
 * Metadata from Cloudflare APIs is an observation, not independent binary,
 * live-route traffic, private Merchant authority, or provider signature proof.
 */
export const BASELINE=Object.freeze({
  workersListed:31,
  deploymentsInspected:31,
  weightedDeployedVersionEtagMatches:30,
  inactiveWithNoVersion:1,
  pagesProjects:2,
  pagesUsingFunctions:0,
  zones:1,
  zoneRoutes:0,
  workerDomains:1,
  bioStaticRpcSources:13,
  bioExactCommercePrivilegedRpcCalls:0,
  n8nWorkflows:151,
  n8nPublishedActive:22,
  n8nInactiveDefinitions:129,
  n8nKnownDirectCommerceRpcCallers:1,
  supabaseEdgeFunctions:1,
  supabaseStoreScopedColumns:0,
  realProviderSignedCanariesAccepted:0
});
export const BIO_STATIC_RPC_NAMES=Object.freeze([
  'is_personal_admin','bio_publish_setting','bio_published_settings','bio_public_media_manifest'
]);
export const COMMERCE_PRIVILEGED_NAMES=Object.freeze([
  'qa_shop_b_zalo_claim','qa_owner_pairing','save_merchant_product'
]);
export const BIO_PRODUCTION=Object.freeze({
  script:'ngoctien20-bio',
  customDomain:'ngoctien20.io.vn',
  deployment:'22addbba-2cba-452a-9bac-63c5225d47be',
  version:'dcfea800-b954-419b-8bd9-8e2d9862a29b',
  versionWeight:100,
  metadataScriptETag:'af2b7091ee5ea9a944eee853e29406796bdeb1ae8fe3681b4eb258087adcce61',
  extractedCurrentSourceSha256:'b43e8793564d7adf6864dd2cf321ca67c618912fd94195cddfbba40f96f7579d'
});
function uniq(xs){return Object.freeze([...new Set(xs)])}
function plain(x){return x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype}
export function reconcileWorkerVersionMetadata(evidence={}){
 const issues=[];
 for(const k of ['script','customDomain','deployment','version','versionWeight','metadataScriptETag']){
  if(evidence[k]!==BIO_PRODUCTION[k])issues.push('VERSION_METADATA_DRIFT_'+k.toUpperCase());
 }
 if(typeof evidence.scriptListETag!=='string'||evidence.scriptListETag!==evidence.versionResourceETag)
  issues.push('CLOUDFLARE_ETAG_PAIR_MISMATCH');
 if(evidence.versionResourceETag!==BIO_PRODUCTION.metadataScriptETag)
  issues.push('VERSION_ETAG_NOT_AT_BASELINE');
 if(evidence.extractedCurrentSourceSha256!==BIO_PRODUCTION.extractedCurrentSourceSha256)
  issues.push('SCRIPT_CONTENT_FINGERPRINT_CHANGED');
 // script ETag is an opaque Cloudflare version fingerprint: NOT necessarily
 // SHA-256 of the client-returned multipart source.
 return Object.freeze({
  status:issues.length?'DEPLOYMENT_METADATA_REAUDIT':'DEPLOYMENT_METADATA_STRUCTURALLY_RECONCILED',
  issues:uniq(issues),
  sourceByteEqualityProven:false,
  liveRequestTrafficIndependentlyProven:false,
  providerIngressProven:false,
  canDeploy:false,canChangeRoutes:false,canRevokeRpc:false
 });
}
export function assessCallerCoverage(snapshot={}){
 const blockers=[];
 for(const [k,v] of Object.entries(BASELINE))if(snapshot[k]!==v)blockers.push('INVENTORY_CHANGED_'+k.toUpperCase());
 if(snapshot?.dynamicCodeCallsReviewed!==true)blockers.push('DYNAMIC_CODE_CALLERS_PENDING');
 if(snapshot?.externalClientCallersReviewed!==true)blockers.push('EXTERNAL_CLIENT_CALLERS_PENDING');
 if(snapshot?.productionRequestTraceIndependentlyVerified!==true)blockers.push('LIVE_TRAFFIC_ROUTE_UNVERIFIED');
 blockers.push('INDEPENDENT_EXTERNAL_CALLER_ACCEPTANCE_REQUIRED');
 return Object.freeze({
  status:'GLOBAL_CALLER_NO_GO',
  observedConnectedAccountOnly:true,
  reviewScope:['CLOUDFLARE_WORKERS','CLOUDFLARE_PAGES','N8N','SUPABASE_EDGE'],
  blockers:uniq(blockers),
  allCallersIndependentlyVerified:false,
  canRevokeRpc:false,canChangePrivileges:false,canReadStoreOrder:false,canDeploy:false
 });
}
export function assessBioRpcNames(names){
 const unknown=[],privileged=[];
 if(!Array.isArray(names))return Object.freeze({status:'INVALID_INPUT',unknown:[],privileged:[],canRevokeRpc:false});
 for(const n of names){
  if(COMMERCE_PRIVILEGED_NAMES.includes(n))privileged.push(n);
  else if(!BIO_STATIC_RPC_NAMES.includes(n))unknown.push('UNCLASSIFIED_RPC_NAME');
 }
 return Object.freeze({status:privileged.length||unknown.length?'NEEDS_MANUAL_REVIEW':'BIO_PERSONAL_RPC_STATIC_ONLY',unknown:uniq(unknown),privileged:uniq(privileged),dynamicRuntimeReviewRequired:true,canRevokeRpc:false});
}
