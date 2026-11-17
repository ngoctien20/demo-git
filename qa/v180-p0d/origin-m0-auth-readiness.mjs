/**
 * TIEN404 V18.0-P0D. A non-authoritative RED release signal for a solo Founder.
 * This code reads only nonidentifying COUNT aggregates provided by an operator.
 * It cannot authenticate Merchant source files, Auth sessions, signed JWTs,
 * actual backup/restore points, human authorization or financial approval.
 * No database/network imports and NO operational mutation methods.
 */
const expected=Object.freeze({
  tenants:2,products:2,orders:2,customers:0,authUsers:3,
  qaIdentityMaps:2,qaOwnerBindings:2,qaPairingMatches:2,
  sameTenantStoreGroups:0,commerceStoreColumns:0,
  publicStores:false,publicStoreMemberships:false,rpc178Qa:false,
  storageBuckets:0,storageObjects:0,
});
export const SNAPSHOT_REFERENCE=expected;
const forbidden = Object.freeze([
 'jwt','access_token','refresh_token','service_role','password','secret',
 'row_id','rowId','user_id','userId','customer_id','customerId',
 'store_id','storeId','tenant_id','tenantId','email','phone','ip',
 'credential','private_key','signature','token','authHeader','rawEvidence',
 'canMigrate','canRestore','canRelease','ownerApproved','m0Approved',
 'realJwtVerified','independentRestoreVerified','evidence',
]);
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const immutable=(codes,shapeValid=false)=>Object.freeze({
  contract:'T404_V180_P0D_NON_IDENTIFYING_ORIGIN_M0_REAL_AUTH_READINESS_V1',
  status:'REAL_HOSTED_STORE_AB_NO_GO',
  baselineShapeValid:shapeValid,
  blockers:Object.freeze([...new Set(codes)]),
  originalFourHostedRowsOwnerCertified:false,
  sameTenantRealStoreABOwnerMapped:false,
  m0CurrentRecoveryApproved:false,
  currentIndependentRestoreTested:false,
  realSupabaseJwtAandBVerified:false,
  signedSupabaseIssuerVerified:false,
  sameTenantRealJwtNegativeUatAccepted:false,
  canReadRealOrder:false,canWriteRealOrder:false,
  canApplyMigration:false,canBackfill:false,canAlterRls:false,
  canChangeRpcGrant:false,canCreateUser:false,canSend:false,
  canOpenAccess:false,canDeploy:false,canPublish:false,
});
export function inspectSnapshot(baseline) {
  const issues=[
    'FOUR_ORIGINAL_PRODUCT_ORDER_ROWS_REQUIRE_PRIVATE_PRIMARY_SOURCE_ATTESTATION',
    'OWNER_DEFERRED_LOCAL_BACKUP_AND_CURRENT_M0_SCOPE_UNDECIDED',
    'ACTUAL_CURRENT_BACKUP_AND_INDEPENDENT_RESTORE_NOT_VERIFIED',
    'REAL_SUPABASE_ISSUER_VERIFIED_JWT_A_B_NOT_ADMITTED',
    'REAL_CANONICAL_SAME_TENANT_STORE_MEMBERSHIP_NOT_MIGRATED',
    'RPC10_INHERITED_CI_P1_397_OPEN',
  ];
  if(!plain(baseline))return immutable([...issues,'INVALID_AGGREGATE_PACKET']);
  const keys=Object.keys(expected);
  const supplied=Object.keys(baseline);
  if(supplied.some(k=>forbidden.includes(k)||!keys.includes(k)))
    issues.push('RAW_OR_UNTRUSTED_AUTHORITY_FIELD_REJECTED');
  if(keys.some(k=>!Object.hasOwn(baseline,k)))issues.push('INCOMPLETE_AGGREGATE');
  if(keys.some(k=>typeof baseline[k]!==typeof expected[k]||
       (typeof baseline[k]==='number'&&(!Number.isSafeInteger(baseline[k])||baseline[k]<0))))
    issues.push('INVALID_AGGREGATE_TYPE_OR_RANGE');
  if(keys.some(k=>baseline[k]!==expected[k]))issues.push('LIVE_BASELINE_DRIFT_REQUIRES_NEW_READ_ONLY_AUDIT');
  if((baseline.sameTenantStoreGroups??0)===0)
    issues.push('NO_TWO_QA_STORES_IN_SAME_TENANT');
  const valid=!issues.some(k=>
    ['RAW_OR_UNTRUSTED_AUTHORITY_FIELD_REJECTED','INCOMPLETE_AGGREGATE',
     'INVALID_AGGREGATE_TYPE_OR_RANGE','LIVE_BASELINE_DRIFT_REQUIRES_NEW_READ_ONLY_AUDIT']
      .includes(k));
  return immutable(issues,valid);
}
export const noHostedAuthorization=()=>immutable(['PRIVATE_INDEPENDENT_REAL_EVIDENCE_NOT_RECEIVED']);
