'use strict';
/*
 * TIEN404 ADV.6C — backup approval DECISION, not an executor.
 * Current project has no private signing trust enrollment, verified hosted
 * Owner A/B Store RLS proof, approved real export/restore or DB role approval.
 * This policy therefore WITHHOLDS one-time approval explicitly.
 *
 * No fallback from synthetic signature packets, QA counts, JSON flags,
 * Supabase service_role access, or generic user permissions.
 */
const {evaluateRelease}=require('../v152-pre6c-security/p0-release-gate.cjs');
const {evaluateEvidence}=require('./owner-evidence-gate.cjs');
const CONTRACT='T404_ADV6C_ONE_TIME_BACKUP_DECISION_V1';
const EXPECTED_PROJECT='ifxlvrhyjhbzbrkdsida';
function decideOneTimeBackup({baseline,privatePacketReview,ownerEvidence,
  controllerApproval,securityApproval,operatorAuthorization}={}){
 const rel=evaluateRelease(baseline);
 const owner=evaluateEvidence(ownerEvidence);
 const signedMeta=privatePacketReview?.status===
   'SIGNED_METADATA_ONLY_PENDING_INDEPENDENT_PRIVATE_INSPECTION';
 // These three fields must be externally verified against an independently
 // enrolled authority and a durable consent ledger. This code deliberately
 // cannot verify/execute them and never treats self assertions as authority.
 const claimsPresent=[controllerApproval,securityApproval,operatorAuthorization]
   .filter(Boolean).length;
 const blockers=new Set([
   ...rel.blockers,
   ...owner.blockers,
   ...(!signedMeta?['PRIVATE_SIGNED_EVIDENCE_METADATA_NOT_ACCEPTED']:[]),
   'CONTROLLER_AND_INDEPENDENT_SECURITY_SIGNER_NOT_HOSTED_VERIFIED',
   'BACKUP_SCOPE_DESTINATION_COST_RETENTION_NOT_INDEPENDENTLY_APPROVED',
   'ONE_TIME_DURABLE_AUTHORIZATION_NONCE_NOT_CERTIFIED',
   'REAL_EXPORT_AND_INDEPENDENT_RESTORE_NOT_VERIFIED',
   'NO_AUTHORIZED_EXECUTOR_IN_THIS_DRAFT'
 ]);
 return Object.freeze({
   contract:CONTRACT,projectRef:EXPECTED_PROJECT,
   decision:'DENY_ONE_TIME_REAL_BACKUP_EXPORT',
   reason:'MISSING_INDEPENDENT_PRIVATE_APPROVAL_AND_HOSTED_OWNER_PROOF',
   evidenceMetadataSignaturesReceived:signedMeta,
   unverifiedClaimCount:claimsPresent,
   blockers:Object.freeze([...blockers].sort()),
   oneTimeApprovalGranted:false,
   privateBackupExportAuthorized:false,
   backupExportExecuted:false,
   restoreVerified:false,
   hostedJwtRlsProofPassed:false,
   databaseRoleChangeAuthorized:false,
   providerSendAuthorized:false,
   productionReleaseAuthorized:false,
   recordsRead:0,recordsModified:0,
   next:'PRIVATE_CONTROLLER_AND_SECURITY_REVIEW_REQUIRED'
 });
}
module.exports=Object.freeze({CONTRACT,decideOneTimeBackup});