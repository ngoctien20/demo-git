'use strict';
/**
 * TIEN404 V15.2 ADV.6C-RPC.6 — SOURCE-ONLY FOUR-ROW RECOVERY DECISION.
 * Reuses V14.4.3 private four-row linter and earlier ADV.6C backup DENY.
 * No network, env, DB connection, SQL execution, secret loading, file IO,
 * actual backup, restore, migration, publish, or provider messages.
 *
 * NOTE: A JSON packet, hash, signature or local QA success cannot establish
 * real private operator authority or substitute for independently inspected
 * original records. This code CAN NEVER approve or execute a hosted change.
 */
const {reviewPrivateEvidence}=require('../security-definer-v1443/four-row-owner-evidence.cjs');
const CONTRACT='T404_RPC6_FOUR_ROW_PRE_MIGRATION_RECOVERY_V1';
const PROJECT='ifxlvrhyjhbzbrkdsida';
const PARENT='33b3c85013f4fc034261de8eb114537bf8e6c368';
const REQUIRED_COUNTS=Object.freeze({products:2,orders:2,customers:0,tenants:2});
const BACKUP_SCOPE='PRE_M1_ENCRYPTED_FULL_DATA_RECOVERY_ONLY';
const PHASES=Object.freeze(['M0_OWNER_LEDGER_PRIVATE_REVIEW',
 'M0_RECOVERY_EXPORT_SEPARATELY_APPROVED',
 'M0_INDEPENDENT_ISOLATED_RESTORE',
 'M1_STORES_SCHEMA_EXPAND_SEPARATELY_APPROVED',
 'M2_FOUR_ROW_BACKFILL_SEPARATELY_APPROVED',
 'M3_STORE_COMPOSITE_FK_AND_SKU_SEPARATELY_APPROVED',
 'M4_ATOMIC_RLS_REPLACEMENT_SEPARATELY_APPROVED',
 'M5_INDEPENDENT_HOSTED_JWT_NEGATIVE_ACCEPTANCE']);
const PLAIN=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const HASH=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const requireIf=(condition,name,issues)=>{if(condition!==true)issues.push(name)};
const safe=items=>Object.freeze([...new Set(items)]);
function checkHostedCounts(snapshot){
 const b=PLAIN(snapshot)?snapshot:{},issues=[];
 requireIf(b.contract==='T404_RPC6_HOSTED_FOUR_ROW_RECOVERY_BASELINE_V1'&&
   b.project_ref===PROJECT&&b.parent_sha===PARENT&&
   b.provenance==='SUPABASE_READ_ONLY_AGGREGATE_SQL_NO_ROW_IDS',
   'LIVE_BASELINE_PROJECT_OR_PROVENANCE_MISMATCH',issues);
 for(const [entity,n] of Object.entries(REQUIRED_COUNTS)){
   requireIf(b.entity_counts?.[entity]===n,'LIVE_'+entity.toUpperCase()+'_COUNT_DRIFT',issues);
 }
 requireIf(b.tenant_shape?.distinct_tenants===2&&
   b.tenant_shape.tenants_each_with_one_product_and_one_order===2&&
   b.tenant_shape.tenants_with_active_owner===2&&
   b.tenant_shape.tenants_without_active_owner===0,
   'LIVE_TENANT_PAIR_OR_ACTIVE_OWNER_SHAPE_DRIFT',issues);
 requireIf(b.order_customer_links?.linked_customer_rows===0,
   'ORDER_CUSTOMER_LINKAGE_CHANGED',issues);
 requireIf(b.current_schema?.stores_exists===false&&
   b.current_schema?.store_memberships_exists===false,
   'BASELINE_SCHEMA_VERSION_CHANGED_REAUDIT_REQUIRED',issues);
 return Object.freeze({contract:CONTRACT,
   status:issues.length?'COUNT_SNAPSHOT_DRIFT_BLOCKED':'AGGREGATE_ROW_SHAPE_VERIFIED_ONLY',
   blockers:safe(issues),verifiedRowsById:0,verifiedStoreOwners:0,
   sourceDataContentsViewed:false,storedCustomerData:false,
   canAttributeStore:false,canBackfill:false});
}
function reviewPrivateFourRow({snapshot,privatePacket,now=Date.now()}={}){
 const count=checkHostedCounts(snapshot);
 let result={status:'NO_PRIVATE_LEDGER',issues:['PRIVATE_LEDGER_MISSING'],
  candidateProducts:0,candidateOrders:0};
 if(PLAIN(privatePacket)){
  // EXACT upstream V14.4.3 private-only linter.
  // The input may contain private UUIDs: never serialize/log them.
  const privateBaseline={
   products:snapshot?.entity_counts?.products,
   orders:snapshot?.entity_counts?.orders,
   distinctTenants:snapshot?.tenant_shape?.distinct_tenants,
   eachTenantHasOneProductAndOneOrder:
     snapshot?.tenant_shape?.tenants_each_with_one_product_and_one_order===2
  };
  result=reviewPrivateEvidence({
   projectRef:privatePacket.projectRef,
   mode:privatePacket.mode,
   rows:privatePacket.rows,
   baseline:privateBaseline
  },now);
 }
 const shapeOk=count.blockers.length===0 &&
   result.status==='READY_FOR_MANUAL_PRIVATE_EVIDENCE_INSPECTION';
 return Object.freeze({contract:CONTRACT,
  status:shapeOk?'PRIVATE_LEDGER_FORMAT_READY_FOR_REAL_REVIEW':'FOUR_ROW_OWNER_PROOF_BLOCKED',
  blockers:safe([...count.blockers,...(result.issues||[])]),
  validatedShapeCount:shapeOk?4:0,
  sourcePrivateLedgerActuallyInspected:false,
  independentMerchantAndSecuritySignaturesVerified:false,
  actualOwnerToCanonicalStoreMappingCertified:false,
  realJwtOwnerSessionVerified:false,
  verifiedHostedRows:0,backfillWrites:0,canBackfill:false,
  resultContainsIds:false,resultContainsSensitiveFields:false});
}
function reviewPreMigrationBackup({snapshot,request,externalApproval,now=Date.now()}={}){
 const count=checkHostedCounts(snapshot),q=PLAIN(request)?request:{};
 const a=PLAIN(externalApproval)?externalApproval:{};
 const blockers=[...count.blockers];
 requireIf(q.scope===BACKUP_SCOPE&&q.projectRef===PROJECT&&
   q.parentSha===PARENT,
   'WRONG_OR_MISSING_PRE_M1_FULL_DATA_RECOVERY_SCOPE',blockers);
 requireIf(HASH(q.sourceSnapshotDigest)&&HASH(q.nonceDigest),
   'SOURCE_SNAPSHOT_AND_ONE_TIME_NONCE_MISSING',blockers);
 requireIf(q.encryptionClass==='ENCRYPTED_PRIVATE_OPERATOR_VAULT'&&
   q.destinationClass==='INDEPENDENT_PRIVATE_BACKUP_STORAGE',
   'PRIVATE_ENCRYPTED_RECOVERY_DESTINATION_NOT_APPROVED',blockers);
 requireIf(Number.isSafeInteger(q.retentionDays)&&q.retentionDays>=1&&
   q.retentionDays<=90&&Number.isSafeInteger(q.costCapVnd)&&
   q.costCapVnd>=0,'BACKUP_RETENTION_AND_COST_CAP_NOT_SCOPED',blockers);
 requireIf(Number.isSafeInteger(now)&&Number.isSafeInteger(q.expiresAtMs)&&
   q.expiresAtMs>now&&q.expiresAtMs-now<=900000,
   'SINGLE_BACKUP_CHANGE_WINDOW_TTL_INVALID',blockers);
 for(const k of ['controllerIdentityVerifiedOutOfBand',
   'independentSecurityReviewerIdentityVerifiedOutOfBand',
   'backupOperatorRoleVerifiedOutOfBand',
   'privateEvidenceStorageAndClassificationApproved',
   'explicitOneTimeOwnerBackupApprovalVerified',
   'immutableScopeAndCostApprovalVerified',
   'independentAuthorizationNonceLedgerVerified']){
   requireIf(a[k]===true,'EXTERNAL_'+k.toUpperCase()+'_MISSING',blockers);
 }
 // Does NOT depend on Store JWT proof: that proof can only exist AFTER M1.
 // This breaks the planning dependency cycle WITHOUT granting an export.
 return Object.freeze({contract:CONTRACT,
  status:blockers.length?'DENY_PRE_M1_REAL_EXPORT':'PRIVATE_RECOVERY_REQUEST_NEEDS_EXTERNAL_APPROVAL',
  blockers:safe(blockers),
  resolvesArchitecturalOwnerJwtBeforeBackupDeadlockInPolicy:true,
  actualControllerAuthorityVerifiedByThisModule:false,
  actualSecurityReviewerAuthorityVerifiedByThisModule:false,
  oneTimeBackupApprovalGranted:false,backupExportPerformed:false,
  restorePerformed:false,canExportBackup:false,canMigrate:false,
  canReadRealCustomerRecords:false,extraCostAuthorized:false});
}
function reviewRestoreReceipt({snapshot,receipt}={}){
 const c=checkHostedCounts(snapshot),r=PLAIN(receipt)?receipt:{};
 const blockers=[...c.blockers];
 requireIf(r.projectRef===PROJECT&&r.scope===BACKUP_SCOPE,
   'RESTORE_SOURCE_PROJECT_AND_SCOPE_UNMATCHED',blockers);
 requireIf(HASH(r.archiveSha256)&&HASH(r.restoredArchiveSha256)&&
   r.archiveSha256===r.restoredArchiveSha256,
   'ARCHIVE_BYTES_INTEGRITY_NOT_VERIFIED',blockers);
 requireIf(HASH(r.privateRestoreLogDigest)&&HASH(r.logicalDataAuditDigest)&&
   HASH(r.schemaAuditDigest),
   'PRIVATE_RESTORE_REPORT_REFERENCES_MISSING',blockers);
 requireIf(r.recoveredProducts===2&&r.recoveredOrders===2&&
   r.recoveredCustomers===0&&r.recoveredTenants===2,
   'RESTORED_ROW_COUNTS_DO_NOT_MATCH_FROZEN_BASELINE',blockers);
 for(const k of ['independentIsolatedHostAttested',
   'realPgRestoreExitSuccess','schemaAndGrantComparisonPassed',
   'dataIntegrityAndForeignKeysPassed','authenticatedIdentityNotCopiedIntoPublicLogs',
   'independentReviewerInspectedPrimaryRestoreLogs',
   'restoreWasFromApprovedExactArchive']){
   requireIf(r[k]===true,'RESTORE_'+k.toUpperCase()+'_UNVERIFIED',blockers);
 }
 // A local/synthetic PG17 run cannot assert these primary-source values.
 return Object.freeze({contract:CONTRACT,
  status:blockers.length?'REAL_HOSTED_RESTORE_NOT_ATTESTED':
    'CLAIMED_RECEIPT_AWAITS_INDEPENDENT_VERIFICATION',
  blockers:safe(blockers),
  independentlyVerifiedRealRestoreByThisModule:false,
  sourceArchiveActuallyInspected:false,
  realBackupRecoveryCertified:false,
  canApplyMigration:false,canClaimRestoreApproved:false,
  reportsSensitiveFileLocations:false});
}
function reviewM1Authorization({snapshot,ownerReview,backupReview,restoreReview,
  privateChangeRequest}={}){
 const c=checkHostedCounts(snapshot),p=PLAIN(privateChangeRequest)?privateChangeRequest:{};
 const issues=[...c.blockers];
 requireIf(ownerReview?.status==='PRIVATE_LEDGER_FORMAT_READY_FOR_REAL_REVIEW',
   'FOUR_ROW_PRIVATE_LEDGER_NOT_READY',issues);
 requireIf(backupReview?.status==='PRIVATE_RECOVERY_REQUEST_NEEDS_EXTERNAL_APPROVAL',
   'PRE_M1_RECOVERY_APPROVAL_NOT_READY',issues);
 requireIf(restoreReview?.status==='CLAIMED_RECEIPT_AWAITS_INDEPENDENT_VERIFICATION',
   'INDEPENDENT_RESTORE_RECEIPT_NOT_READY',issues);
 requireIf(p.projectRef===PROJECT&&p.phase==='M1_EXPAND_STORE_SCHEMA_ONLY'&&
   p.oldPublishedWorkflowsUnchanged===true,
   'EXACT_M1_ONLY_SCOPE_NOT_CERTIFIED',issues);
 for(const k of ['separateM1ControllerApproval','separateM1SecurityReviewerApproval',
   'namedDbOperatorLeastPrivilege','readOnlyCallerCompatibilityAudited',
   'rollbackDrillIndependentlyVerified',
   'schemaMigrationDryRunVerifiedInDisposablePg17']){
   requireIf(p[k]===true,'M1_'+k.toUpperCase()+'_MISSING',issues);
 }
 // Hard exit: even all asserted flags never grant authority to apply DDL.
 return Object.freeze({contract:CONTRACT,phase:'M1_EXPAND_STORE_SCHEMA_ONLY',
   status:issues.length?'MIGRATION_M1_NO_GO':'CLAIMED_M1_REQUEST_AWAITS_REAL_APPROVAL',
   blockers:safe(issues),stages:PHASES,
   privatePrimaryEvidenceReviewedByThisModule:false,
   realBackupAndRestoreVerifiedByThisModule:false,
   realOperatorAuthorized:false,hostedSchemaChanged:false,
   hostedBackfillPerformed:false,canApplyM1:false,canRunAnyMigration:false,
   canChangeRls:false,canRevokeRpc:false,canUpdatePublishedWorkflow:false,
   canSendMessages:false,canUseServiceRoleAsCustomerIdentity:false,
   hostedRowsModified:0});
}
function runHostedMigration(){throw Error('RPC6_HOSTED_MIGRATION_REQUIRES_SEPARATE_EXPLICIT_AUTHORIZATION')}
function exportRealBackup(){throw Error('RPC6_REAL_BACKUP_EXPORT_REQUIRES_ONE_TIME_PRIVATE_APPROVAL')}
module.exports=Object.freeze({CONTRACT,PROJECT,PARENT,BACKUP_SCOPE,PHASES,
 checkHostedCounts,reviewPrivateFourRow,reviewPreMigrationBackup,
 reviewRestoreReceipt,reviewM1Authorization,runHostedMigration,exportRealBackup});
