'use strict';
/**
 * RPC.9 — source-only readiness reconciliation. No network/DB I/O.
 * NOTE this cannot accept actual original signatures, real Auth JWT,
 * individual row ownership or approved backup; all supplied flags are
 * untrusted operator statements. Never use to authorize a hosted change.
 */
const {checkHostedCounts}=require('../v152-rpc6/fourrow-recovery-migration-gate.cjs');
const CONTRACT='T404_RPC9_PRIVATE_OWNER_ATOMIC_M2M4_AUTHORIZATION_PREFLIGHT_V1';
const PROJECT='ifxlvrhyjhbzbrkdsida';
const PHASE='M2_M4_ATOMIC_CONTROLLED_READER_BLACKOUT';
const EXPECTED_INPUTS=Object.freeze([
 'realSourceFreshnessInspected',
 'fourIndividualRowsOwnerAttributedToCanonicalStore',
 'independentMerchantAndReviewerAttestationInspected',
 'allPrimaryEvidencePrivateAndEncrypted',
 'approvedPreMigrationBackupAndIndependentRestore',
 'm1AlreadyAppliedAndRealHostedSchemaVerified',
 'allCallingReadersAndWritersInventoryCertified',
 'allSessionsAndReadersMaintenanceRestrictionApproved',
 'readLockBudgetAndStatementTimeoutApproved',
 'singleAtomicDbTransactionReviewed',
 'tenantStoreForeignKeysAndIntegrityReviewed',
 'legacyPermissivePoliciesAtomicallyRemoved',
 'realOwnerAJwtAndOwnerBJwtSameTenantNegative',
 'crossTenantAndRevokedStaffReadNegative',
 'realProviderWebhooksSignatureAndReplayVerified',
 'singleWriterCutoverAndRollbackVerified',
 'separateControllerSecurityAndDbOperatorAuthorization'
]);
function recordPreflight({baseline,ownerPacket,m0Receipt,hostedProofs,changeRequest}={}){
 const count=checkHostedCounts(baseline),p=hostedProofs&&typeof hostedProofs==='object'&&!Array.isArray(hostedProofs)?hostedProofs:{};
 const req=changeRequest&&typeof changeRequest==='object'&&!Array.isArray(changeRequest)?changeRequest:{};
 const issues=[...count.blockers];
 if(ownerPacket?.status!=='PRIVATE_LEDGER_FORMAT_READY_FOR_REAL_REVIEW'||
    ownerPacket?.validatedShapeCount!==4)
  issues.push('PRIVATE_FOUR_ROW_OWNER_LEDGER_NOT_ATTESTED');
 if(m0Receipt?.status!=='CLAIMED_M0_READY_FOR_EXTERNAL_ATTESTATION')
  issues.push('M0_REAL_BACKUP_RESTORE_NOT_INDEPENDENTLY_ACCEPTED');
 if(req.projectRef!==PROJECT||req.exactPhase!==PHASE||
   req.singleTransactionApproved!==true||
   req.zeroDowntimeClaim===true||req.changeScope!=='STAGING_ONLY')
  issues.push('EXACT_AUTHORIZED_STAGE_AND_DOWNTIME_SCOPE_MISSING');
 for(const key of EXPECTED_INPUTS)
  if(p[key]!==true)issues.push('HOSTED_PROOF_'+key.toUpperCase()+'_MISSING');
 return Object.freeze({
  contract:CONTRACT,phase:PHASE,
  status:issues.length?'RPC9_M2_M4_HOSTED_NO_GO':
   'SELF_REPORTED_READY_FOR_SEPARATE_INDEPENDENT_OPERATOR_REVIEW',
  blockers:Object.freeze([...new Set(issues)]),
  dbAccessPerformed:false,privateOriginalRecordsRead:false,
  signaturesCryptographicallyVerified:false,actualOwnerStoreVerified:false,
  realIndependentRestoreCertified:false,
  realJwtRlsAccepted:false,zeroDowntimeCertified:false,
  realControllerApprovalValidated:false,
  canReadPrivateRows:false,canApplyM1:false,canBackfill:false,
  canReplaceRls:false,canApplyCutover:false,canRevokeRpc:false,
  canChangePublished:false,canSendProviderMessages:false,
  recordsChanged:0
 });
}
function executeHostedCutover(){
 throw Error('RPC9_HOSTED_CUTOVER_REQUIRES_SEPARATE_REAL_M0_M1_M2M4_APPROVAL');
}
module.exports=Object.freeze({CONTRACT,PROJECT,PHASE,EXPECTED_INPUTS,
 recordPreflight,executeHostedCutover});
