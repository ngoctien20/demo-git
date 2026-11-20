// Source-only V19.8.16 admission readiness. Input is trusted reviewer evidence,
// NOT customer payload. Fail-closed; never confers runtime access.
export const gates=Object.freeze([
  'verifiedBackupAndRestore','fullCallerInventory','publishedDraftContractsPinned',
  'realOwnerStoreABVerified','canonicalStoreSchemaApproved',
  'storeCompositeFkReviewed','skuConstraintCollisionResolved',
  'legacyReaderWriterCompatibility','privilegedRpcSecurityApproved',
  'providerInstallationAttested','merchantConsentHostedVerified',
  'privateRegistrySignedEvidence','crossStoreNegativeUat',
  'rollbackApproved','independentSecurityReviewerApproved'
]);
export function assessReadiness(evidence){
 const missing=[];
 if(!evidence||typeof evidence!=='object'||Array.isArray(evidence))
   return Object.freeze({decision:'NO_GO',missing:['trusted_evidence'],canApplyMigration:false,canSend:false,canWriteOrders:false});
 for(const gate of gates)if(evidence[gate]!==true)missing.push(gate);
 if(evidence.origin!=='independent_signed_operator_review')missing.push('verified_evidence_origin');
 if(evidence.scope!=='hosted_store_readonly_preflight')missing.push('read_only_scope');
 if(evidence.targetEnvironment!=='isolated_staging')missing.push('approved_isolated_target');
 return Object.freeze({decision:missing.length?'NO_GO':'READY_FOR_SEPARATE_APPROVAL',missing,canApplyMigration:false,canSend:false,canWriteOrders:false});
}
