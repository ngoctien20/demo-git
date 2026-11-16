'use strict';
/**
 * TIEN404 RPC.10 — read-only Source/Host authorization checklist.
 * This code validates self-reported evidence shape ONLY, it does NOT
 * authenticate original Owner row IDs, tokens, archive, signatures,
 * or actual DB migration. It has no I/O and can NEVER authorize SQL.
 */
const {checkHostedCounts}=require('../v152-rpc6/fourrow-recovery-migration-gate.cjs');
const CONTRACT='T404_RPC10_PRIVATE_OWNER_M3_FK_INDEPENDENT_AUTHORITY_V1';
const PROJECT='ifxlvrhyjhbzbrkdsida';
const REQUIRED_EVIDENCE=Object.freeze([
 'fourActualProductAndOrderRowsOwnerToStoreProvenIndependently',
 'primarySourceRowSnapshotFrozenAndFresh',
 'merchantAndIndependentReviewerDistinct',
 'approvedPrivateLedgerRetainedOffGitHub',
 'recoveryScopePrivatelyAcceptedByController',
 'realApprovedBackupAndIsolatedRestoreAccepted',
 'hostedM1ExpandDeployedAndVerified',
 'm2m4AtomicStoreAssignmentAndRlsAccepted',
 'realHostedSameTenantOwnerABJwtNegativePass',
 'realHostedCrossTenantAndRevokedStaffNegativePass',
 'allPrivilegedWriterAndSecurityDefinerCallersReviewed',
 'customerOrderSameStoreForeignKeysReviewed',
 'storeScopedSkuAndLegacyWriterCompatibilityReviewed',
 'separateM3ControllerApprovalConfirmed',
 'independentSecurityReviewerAttestationConfirmed',
 'leastPrivilegeDbOperatorBoundToStagingWindow',
 'migrationRollbackAndLockBudgetApproved'
]);
function classifyPrivateM3({currentBaseline,ownerEvidence,m0Evidence,phaseEvidence,primaryEvidence}={}){
 const count=checkHostedCounts(currentBaseline);
 const p=primaryEvidence && typeof primaryEvidence==='object' &&
   !Array.isArray(primaryEvidence)?primaryEvidence:{};
 const issues=[...count.blockers];
 // Actual current hosted baseline has NO stores; this is a preliminary
 // review of readiness, not a post-migration acceptance of M3.
 if(currentBaseline?.project_ref!==PROJECT)
  issues.push('HOSTED_PROJECT_ID_NOT_VERIFIED');
 if(currentBaseline?.current_schema?.stores_exists!==false ||
    currentBaseline?.current_schema?.store_memberships_exists!==false)
  issues.push('PRE_M1_BASELINE_CHANGED_REAUDIT');
 if(ownerEvidence?.status!=='PRIVATE_LEDGER_FORMAT_READY_FOR_REAL_REVIEW' ||
    ownerEvidence?.validatedShapeCount!==4)
  issues.push('FOUR_ROW_PRIVATE_OWNER_LEDGER_NOT_READY_FOR_REVIEW');
 if(m0Evidence?.status!=='CLAIMED_M0_READY_FOR_EXTERNAL_ATTESTATION')
  issues.push('M0_REAL_RECOVERY_NOT_INDEPENDENTLY_ATTESTED');
 if(phaseEvidence?.scope!=='STAGING_ONLY_M3_AFTER_M2M4' ||
    phaseEvidence?.callerContractVersionValidated!==true ||
    phaseEvidence?.m3SqlCanaryRestrictedToDisposableLab!==true)
  issues.push('PHASE_M3_OR_WRITER_COMPATIBILITY_NOT_REVIEWED');
 for(const k of REQUIRED_EVIDENCE)
  if(p[k]!==true)issues.push('MISSING_'+k.toUpperCase());
 return Object.freeze({
  contract:CONTRACT,
  status:issues.length?'HOSTED_M3_NO_GO':'CLAIMED_REVIEW_PACKET_REQUIRES_EXTERNAL_PRIMARY_SOURCE_VERIFICATION',
  issues:Object.freeze([...new Set(issues)]),
  currentLegacyProductOrderCountOnly:true,
  realRowIdsInspectedByThisCode:false,
  actualOwnerToStoreAuthorityVerified:false,
  realIndependentRecoveryCertified:false,
  realCallerAndJwtProofCertified:false,
  schemaNotYetDeployed:true,
  liveMigrationAuthorized:false,
  canReadPrivateRows:false,
  canCreateStores:false,
  canBackfill:false,
  canChangeRls:false,
  canApplyM1:false,
  canApplyM2M4:false,
  canApplyM3:false,
  canRevokeLegacyRpc:false,
  canPublishWorkflows:false,
  customerDataChanged:0
 });
}
function executeRealM3(){throw Error('RPC10_HOSTED_M3_REQUIRES_SEPARATE_VERIFIED_APPROVAL');}
module.exports=Object.freeze({CONTRACT,PROJECT,REQUIRED_EVIDENCE,
 classifyPrivateM3,executeRealM3});
