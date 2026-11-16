'use strict';
/**
 * TIEN404 RPC.7 — M0 PRIVATE OPERATOR READINESS WITHOUT A NEW FAKE SIGNER.
 * No DB, network, credentials, file I/O or migration executor. Inputs are
 * untrusted metadata; true is only "claimed", never independent acceptance.
 * Reuses the V14.4.3/RPC6 four-row linter and backup/restore decisions.
 */
const rpc6=require('../v152-rpc6/fourrow-recovery-migration-gate.cjs');
const {inspectArchiveToc}=require('./local-archive-coverage.cjs');
const CONTRACT='T404_RPC7_PRIVATE_M0_REAL_EVIDENCE_RESOLUTION_V1';
const PROJECT='ifxlvrhyjhbzbrkdsida';
const PARENT='d8a713290ec2d31fb56446028f17171f4ff8d2ea';
const sha=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const o=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
function reviewM0Evidence({
 baseline,archiveToc,archiveProvenance,ownerReview,
 recovery,reviewer,recoveryScope='FULL_SERVICE',now=Date.now()
}={}){
 const b=o(baseline)?baseline:{};
 const p=o(archiveProvenance)?archiveProvenance:{};
 const r=o(recovery)?recovery:{};
 const sec=o(reviewer)?reviewer:{};
 const owner=o(ownerReview)?ownerReview:{};
 const blockers=[];
 const req=(valid,code)=>{if(valid!==true)blockers.push(code)};
 req(b.contract==='T404_RPC6_HOSTED_FOUR_ROW_RECOVERY_BASELINE_V1'&&
     b.project_ref===PROJECT,'HOSTED_COUNT_BASELINE_INVALID');
 const count=rpc6.checkHostedCounts(b);
 req(count.status==='AGGREGATE_ROW_SHAPE_VERIFIED_ONLY',
   'REAL_HOSTED_COUNT_OR_TENANT_SHAPE_DRIFT');
 const archive=inspectArchiveToc(archiveToc);
 const fullScope=recoveryScope==='FULL_SERVICE';
 const scopedApp=recoveryScope==='APPLICATION_WITH_EXTERNAL_AUTH_STORAGE_PLAN';
 req(fullScope||scopedApp,'RECOVERY_SCOPE_INVALID_OR_NOT_REVIEWED');
 req(archive.coverage?.application?.includesAllTableDataEntries===true,
   'APPLICATION_TABLE_DATA_MISSING_FROM_EXISTING_ARCHIVE');
 if(fullScope){
   req(archive.coverage?.auth?.includesAllTableDataEntries===true,
     'AUTH_TABLE_DATA_NOT_IN_EXISTING_ARCHIVE');
   req(archive.coverage?.storage?.includesAllTableDataEntries===true,
     'STORAGE_TABLE_METADATA_NOT_IN_EXISTING_ARCHIVE');
   req(archive.status==='STRUCTURAL_TOC_COVERAGE_CANDIDATE_UNVERIFIED',
     'OLD_ARCHIVE_IS_PARTIAL_OR_UNPARSEABLE');
 }else if(scopedApp){
   // A partial archive may be useful, but it NEVER proves whole-service
   // recovery. External Auth and Storage recovery must be reviewed separately.
   req(r.externalAuthRecoveryPlanApproved===true&&
       r.externalStorageMetadataRecoveryPlanApproved===true&&
       r.externalStorageObjectBytesRecoveryPlanApproved===true&&
       r.externalDependencyPlanIndependentlyTested===true,
     'EXTERNAL_AUTH_STORAGE_RECOVERY_PLAN_UNVERIFIED');
   req(sec.applicationScopeExplicitlyApproved===true&&
       sec.externalDependencyResidualRiskIndependentlyAccepted===true,
     'APPLICATION_ONLY_RECOVERY_SCOPE_NOT_APPROVED');
 }
 req(p.projectRef===PROJECT&&p.scope==='PRE_M1_ENCRYPTED_FULL_DATA_RECOVERY_ONLY'&&
     sha(p.archiveDigest)&&sha(p.hostedReadOnlySnapshotDigest),
   'EXACT_HOSTED_ARCHIVE_OR_SOURCE_SNAPSHOT_PROVENANCE_MISSING');
 req(p.archiveOriginAuthenticated===true&&
     p.archiveFreshnessAgainstCurrentHostedVerified===true,
   'ARCHIVE_SOURCE_AND_FRESHNESS_NOT_INDEPENDENTLY_PROVEN');
 req(owner.status==='PRIVATE_LEDGER_FORMAT_READY_FOR_REAL_REVIEW'&&
     owner.validatedShapeCount===4,
   'FOUR_ROW_PRIVATE_OWNER_LEDGER_NOT_READY');
 req(r.scope==='PRE_M1_ENCRYPTED_FULL_DATA_RECOVERY_ONLY'&&
     r.projectRef===PROJECT&&sha(r.archiveDigest)&&
     r.archiveDigest===p.archiveDigest,
   'RECOVERY_ARCHIVE_NOT_BOUND_TO_SOURCE');
 req(r.encryptedAtRest===true&&
     r.independentIsolatedRestoreCompleted===true&&
     r.restoredApplicationRowsMatchReadOnlyBaseline===true&&
     r.rlsAndGrantsRestoreComparisonPassed===true&&
     (!fullScope||(r.authDependencyRecoveryTestPassed===true&&
      r.storageObjectBytesHandledInSeparateApprovedPlan===true)),
   'REAL_INDEPENDENT_FULL_DEPENDENCY_RESTORE_UNVERIFIED');
 req(sec.controllerIndependentlyVerified===true&&
     sec.securityReviewerIndependentlyVerified===true&&
     sec.backupOperatorAuthorized===true&&
     sec.privatePrimaryEvidenceInspected===true&&
     sec.oneTimeExportConsentRecorded===true&&
     sec.archiveCustodyAndRetentionCostApproved===true,
   'REAL_OPERATOR_REVIEW_AND_ONE_TIME_BACKUP_AUTHORITY_MISSING');
 req(Number.isSafeInteger(now)&&now>0,
   'INVALID_REVIEW_TIME');
 return Object.freeze({
   contract:CONTRACT,status:blockers.length?'M0_EVIDENCE_BLOCKED':'CLAIMED_M0_READY_FOR_EXTERNAL_ATTESTATION',
   blockers:Object.freeze([...new Set(blockers)]),
   archiveClassification:archive.status,
   recoveryScope:fullScope?'FULL_SERVICE':scopedApp?'APPLICATION_WITH_EXTERNAL_AUTH_STORAGE_PLAN':'INVALID',
   fullServiceRestoreClaimedByCode:false,
   aggregateRowShapeVerified:count.blockers.length===0,
   sourceArchiveReadByThisCode:false,
   independentlyInspectedBackup:false,
   actualFullRecoveryCertified:false,
   realMerchantOwnerVerified:false,
   approvalGranted:false,
   backupExportAuthorized:false,
   restoreAuthorized:false,
   m1MigrationAuthorized:false,
   m2RowBackfillAuthorized:false,
   m4RlsChangeAuthorized:false,
   productionTrafficChanged:false,recordsWritten:0
 });
}
function reviewM1Readiness({baseline,m0Review,ownershipPacket,m1Packet}={}){
 const b=o(baseline)?baseline:{},m=o(m1Packet)?m1Packet:{};
 const issues=[];
 const count=rpc6.checkHostedCounts(b);
 if(count.blockers.length)issues.push('HOSTED_BASELINE_NOT_FROZEN_AND_REVERIFIED');
 if(m0Review?.status!=='CLAIMED_M0_READY_FOR_EXTERNAL_ATTESTATION')
    issues.push('M0_PRIVATE_SOURCE_EVIDENCE_NOT_COMPLETE');
 if(ownershipPacket?.status!=='PRIVATE_LEDGER_FORMAT_READY_FOR_REAL_REVIEW')
    issues.push('INDEPENDENT_FOUR_ROW_OWNER_MAPPING_NOT_AVAILABLE');
 if(m.projectRef!==PROJECT||m.baseSha!==PARENT||
    m.exactPhase!=='M1_EXPAND_SCHEMA_ONLY'||m.changeKind!=='NO_ROW_BACKFILL_NO_POLICY_SWAP')
    issues.push('M1_SCOPE_OR_BASE_COMMIT_MISMATCH');
 if(m.currentPublishedCallerFrozen!==true||
    m.migrationCodeReviewedAgainstActualHostedSchema!==true||
    m.disposablePg17UpgradeRollbackRehearsed!==true||
    m.independentControllerAndSecurityApproval!==true||
    m.realOperatorAuthorization!==true)
    issues.push('M1_CONTRACT_AND_ROLLBACK_UNCERTIFIED');
 return Object.freeze({
   contract:CONTRACT,phase:'M1_EXPAND_SCHEMA_ONLY',
   status:issues.length?'M1_MIGRATION_NO_GO':'M1_REVIEW_PACKET_PENDING_REAL_OPERATOR_APPROVAL',
   blockers:Object.freeze(issues),
   actualPrivatePrimaryEvidenceInspected:false,
   userOperationSpecificConsentVerified:false,
   canApplyM1:false,canRunSql:false,
   canBackfill:false,canChangeRls:false,
   canRevokeRpc:false,canPublish:false,
   canExportBackup:false,realHostMutation:false
 });
}
function executeM1(){throw Error('RPC7_M1_HOSTED_EXECUTION_NOT_AUTHORIZED')}
function exportHosted(){throw Error('RPC7_REAL_EXPORT_NOT_AUTHORIZED')}
module.exports=Object.freeze({
 CONTRACT,PROJECT,PARENT,reviewM0Evidence,reviewM1Readiness,executeM1,exportHosted
});
