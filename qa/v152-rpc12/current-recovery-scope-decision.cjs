'use strict';
/*
 * RPC.12: DECISION-AID ONLY for existing H11R historical local QA and
 * future current recovery scope. Does NOT inspect backups, Supabase Auth,
 * Storage object bytes, independently verify restore, or authorize changes.
 * All packet flags are UNTRUSTED until primary-source operator verification.
 */
const CONTRACT='T404_RPC12_CURRENT_RECOVERY_SCOPE_DECISION_V1';
const PROJECT='ifxlvrhyjhbzbrkdsida';
const HISTORICAL='H11R_PARTIAL_APPLICATION_ARCHIVE_LOCAL_QA_OWNER_ACCEPTED_WITH_LIMITATIONS';
const SCOPE=Object.freeze([
  'UNDECIDED',
  'APPLICATION_WITH_EXTERNAL_AUTH_STORAGE_PLAN',
  'FULL_SERVICE'
]);
const CLAIMS=Object.freeze([
 'currentRecoveryPointMatchesLiveSource',
 'approvedRestoreDestinationIndependent',
 'isolatedRestoreActualDataAccepted',
 'authUserRecoveryIndependentlyTested',
 'authAndApiSettingsRecoveryReviewed',
 'storageMetadataAndObjectBytesCoveredOrProvenNotApplicable',
 'independentSecurityReviewerInspectedActualRestore',
 'currentSourceFreshnessAndRpoRtoApproved',
 'namedOperatorControllerAndBudgetAuthorized'
]);
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const exact=(x,keys)=>plain(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const distinct=x=>Object.freeze([...new Set(x)].sort());
function reviewRecoveryScope({scope='UNDECIDED',currentSnapshot,h11rReceipt,claimedEvidence}={}){
 const issues=[];
 if(!SCOPE.includes(scope))issues.push('RECOVERY_SCOPE_NOT_ALLOWED');
 if(!exact(currentSnapshot,['projectRef','capturedDateJst','tenants','products','orders','customers','authUsers','storageBuckets','storageObjects'])||
  currentSnapshot?.projectRef!==PROJECT||
  currentSnapshot?.capturedDateJst!=='2026-11-17'||
  currentSnapshot?.tenants!==2||
  currentSnapshot?.products!==2||
  currentSnapshot?.orders!==2||
  currentSnapshot?.customers!==0||
  currentSnapshot?.authUsers!==3||
  currentSnapshot?.storageBuckets!==0||
  currentSnapshot?.storageObjects!==0)
  issues.push('CURRENT_AGGREGATE_SNAPSHOT_NOT_GROUNDED_OR_CHANGED');
 if(!exact(h11rReceipt,['status','localArchiveShaMatch','localArchiveBytesMatch','applicationEntries','authEntries','storageEntries','operatorReported'])||
  h11rReceipt?.status!==HISTORICAL||
  h11rReceipt?.localArchiveShaMatch!==true||
  h11rReceipt?.localArchiveBytesMatch!==true||
  h11rReceipt?.applicationEntries!==5||
  h11rReceipt?.authEntries!==0||
  h11rReceipt?.storageEntries!==0||
  h11rReceipt?.operatorReported!==true)
  issues.push('H11R_LIMITED_ACCEPTANCE_NOT_RECONCILED');
 if(scope==='UNDECIDED')issues.push('MIGRATION_RECOVERY_SCOPE_NOT_YET_CHOSEN_BY_OWNER');
 if(scope==='FULL_SERVICE'&&h11rReceipt?.authEntries===0)
  issues.push('HISTORICAL_ARCHIVE_DOES_NOT_COVER_CURRENT_AUTH');
 if(scope==='APPLICATION_WITH_EXTERNAL_AUTH_STORAGE_PLAN')
  issues.push('EXTERNAL_AUTH_STORAGE_RECOVERY_PLAN_AND_INDEPENDENT_RESTORE_MISSING');
 const x=plain(claimedEvidence)?claimedEvidence:{};
 for(const key of CLAIMS)if(x[key]!==true)issues.push('INDEPENDENT_PRIMARY_'+key.toUpperCase()+'_UNVERIFIED');
 // Even a complete self-reported packet has no source authentication.
 const structurallyComplete=issues.length===0;
 return Object.freeze({
  contract:CONTRACT,
  status:scope==='UNDECIDED'?'OWNER_RECOVERY_SCOPE_DECISION_PENDING':
    structurallyComplete?'CLAIMED_CURRENT_RECOVERY_PACKET_REQUIRES_EXTERNAL_VERIFICATION':
    'CURRENT_M0_RECOVERY_NO_GO',
  scope:SCOPE.includes(scope)?scope:'INVALID',
  blockers:distinct(issues),
  historicalH11rAcceptedWithLimitations:true,
  historicalH11rAcceptsCurrentHostedRestore:false,
  observedAuthUsers:3,observedStorageMetadataObjects:0,
  actualCurrentBackupInspected:false,
  actualCurrentIsolatedRestoreVerified:false,
  authRecoveryCertified:false,
  storageObjectBytesCertified:false,
  currentSourceProvenanceAuthenticated:false,
  operatorAndReviewerAuthorityVerified:false,
  m0Approved:false,m1Approved:false,
  canExportBackup:false,canRestore:false,canApplyM1:false,
  canBackfill:false,canAlterRls:false,canApplyM3:false,
  canRevokeLegacyRpc:false,canPublish:false
 });
}
function executeCurrentRecovery(){throw Error('RPC12_REAL_BACKUP_OR_RESTORE_REQUIRES_SEPARATE_APPROVAL');}
module.exports=Object.freeze({CONTRACT,PROJECT,HISTORICAL,SCOPE,CLAIMS,
 reviewRecoveryScope,executeCurrentRecovery});
