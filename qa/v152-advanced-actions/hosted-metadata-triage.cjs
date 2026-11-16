'use strict';
/**
 * TIEN404 V15.2 ADV.6B.1
 * Hosted METADATA triage only. This gate CANNOT validate JWT/Store ownership,
 * independently approved backup, privileged RPC safety, or nonce operations.
 * No Supabase connection, token parsing, file writes or production actions.
 */
const VERSION='T404_ADV6B1_HOSTED_METADATA_TRIAGE_V1';
const KEYS=Object.freeze([
  'capturedAtUtc','source','pgMajor',
  'storesTableCount','storeMembershipTableCount',
  'ordersStoreIdColumnCount','membershipStoreIdColumnCount',
  'privateNonceSchemaCount','dedicatedNonceRoleCount',
  'tenantCoreTablesWithRls','publicAnonDefinerRpcCount',
  'authenticatedDefinerRpcCount','queryRoleIsPrivileged',
  'serviceRoleBypassesRls'
]);
const NO_AUTH=Object.freeze({
  authenticatedOwnerJwtCertified:false,
  sameTenantCrossStoreRlsCertified:false,
  backupRestoreIndependentlyCertified:false,
  realHostedNonceCertified:false,
  hostedMigrationAuthorized:false,
  privilegeRevocationAuthorized:false,
  providerSendAuthorized:false,
  commerceWriteAuthorized:false,
  productionReleaseAuthorized:false
});
const isPlain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 Object.getPrototypeOf(x)===Object.prototype;
function classify(input,{now=Date.now()}={}){
  if(!Number.isSafeInteger(now)||now<=0)throw Error('ADV6B1_CLOCK_INVALID');
  const invalid=()=>Object.freeze({
   contract:VERSION,status:'BLOCKED_INVALID_OR_STALE_METADATA',
   metadataValid:false,priority:'P0_REVIEW_REQUIRED',
   blockers:Object.freeze(['TRUSTED_METADATA_CAPTURE_REQUIRED']),
   ...NO_AUTH
  });
  if(!isPlain(input)||Object.keys(input).length!==KEYS.length||
     !KEYS.every(k=>Object.hasOwn(input,k)))return invalid();
  if(input.source!=='SUPABASE_HOSTED_METADATA_READ_ONLY'||input.pgMajor!==17||
    typeof input.queryRoleIsPrivileged!=='boolean'||
    typeof input.serviceRoleBypassesRls!=='boolean'||
    !KEYS.filter(k=>k.endsWith('Count')||k==='tenantCoreTablesWithRls').every(k=>
      Number.isSafeInteger(input[k])&&input[k]>=0&&input[k]<=100000))return invalid();
  const timestamp=Date.parse(input.capturedAtUtc);
  if(typeof input.capturedAtUtc!=='string'||
     !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(input.capturedAtUtc)||
     !Number.isFinite(timestamp)||timestamp>now+300000||now-timestamp>86400000)
    return invalid();
  const blockers=[];
  if(input.storesTableCount!==1||input.storeMembershipTableCount!==1||
     input.ordersStoreIdColumnCount!==1||input.membershipStoreIdColumnCount!==1)
     blockers.push('P0_STORE_LEVEL_SCHEMA_NOT_PRESENT');
  if(input.publicAnonDefinerRpcCount>0)
     blockers.push('P0_ANON_EXECUTABLE_SECURITY_DEFINER_REQUIRES_SEPARATE_REVIEW');
  if(input.authenticatedDefinerRpcCount>0)
     blockers.push('P0_AUTH_EXECUTABLE_SECURITY_DEFINER_REQUIRES_SEPARATE_REVIEW');
  if(input.privateNonceSchemaCount!==1||input.dedicatedNonceRoleCount!==1)
     blockers.push('P0_HOSTED_PRIVATE_NONCE_ROLE_NOT_PROVEN');
  if(input.queryRoleIsPrivileged||input.serviceRoleBypassesRls)
     blockers.push('P0_PRIVILEGED_METADATA_QUERY_CANNOT_CERTIFY_OWNER_RLS');
  // No self-reported metadata can ever prove actual Owner JWT, backup restore,
  // provider entitlement, or allow a GRANT / migration / production deploy.
  blockers.push('INDEPENDENT_REAL_OWNER_JWT_BACKUP_AND_ROLE_ATTESTATION_MISSING');
  return Object.freeze({
   contract:VERSION,status:'BLOCKED_PENDING_INDEPENDENT_EVIDENCE',
   metadataValid:true,priority:'P0_REVIEW_REQUIRED',
   snapshotAgeSeconds:Math.floor((now-timestamp)/1000),
   blockers:Object.freeze(blockers),
   recommendation:'READ_ONLY_METADATA_ONLY__SECURITY_REVIEW_BEFORE_ANY_HOSTED_CHANGE',
   ...NO_AUTH
  });
}
module.exports=Object.freeze({VERSION,KEYS,classify});
