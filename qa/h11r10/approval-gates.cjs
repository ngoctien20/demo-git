'use strict';
// TIEN404 H11R.10 — metadata-based review ONLY; no execution path.
// Boolean declarations are not independent external verification. Even an
// all-green self-report cannot authorize RPC REVOKE, backup, or migration.
const DOMAINS=Object.freeze([
 'N8N_DRAFT_PUBLISHED_CALL_GRAPH',
 'CLOUDFLARE_WORKERS_ROUTES_AND_PAGES',
 'SUPABASE_EDGE_FUNCTION_DEPENDENCIES',
 'POSTGREST_REAL_REQUEST_OBSERVATION',
 'EXTERNAL_OPERATOR_MANUAL_SCRIPTS',
 'THIRD_PARTY_API_CLIENTS'
]);
const unique=x=>Array.isArray(x)&&new Set(x).size===x.length;
const isDigest=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const noGo=(kind,blockers)=>Object.freeze({
 contract:'T404_H11R10_REVIEW_ONLY_V1',kind,
 status:blockers.length?'NO_GO':'REQUIRES_INDEPENDENT_EXTERNAL_APPROVAL',
 blockers:Object.freeze(blockers),
 metadataReviewedOnly:true,
 callerCompletenessCertified:false,
 reviewerIdentityVerifiedByThisCode:false,
 canRevokeRpc:false,
 canExportAuth:false,
 canApplyStoreMigration:false,
 canMerge:false,
 canSendProvider:false,
 productionReleaseAuthorized:false
});
function reviewCutover(packet={}){
 const blockers=[];
 if(packet.projectRef!=='ifxlvrhyjhbzbrkdsida')blockers.push('PROJECT_SCOPE_NOT_PINNED');
 if(packet.rpc!=='public.qa_shop_b_zalo_claim(uuid,text,text,text)')
   blockers.push('EXACT_RPC_SIGNATURE_REQUIRED');
 if(packet.publishedV1!=='yIJk8LvJoLF40Z62'||
    packet.publishedV2!=='OgDZNSAvKEvhnAvn'||
    packet.enabledPostObserved!==true)
   blockers.push('PUBLISHED_CALLER_CHAIN_UNVERIFIED');
 if(packet.oldRpcAnonExecute!==true)blockers.push('OLD_RPC_PRIVILEGE_NOT_RECONFIRMED');
 const records=Array.isArray(packet.domains)?packet.domains:[];
 if(records.length!==DOMAINS.length || !unique(records.map(x=>x?.domain)) ||
    DOMAINS.some(k=>!records.some(x=>x?.domain===k&&
      x.independentlyObserved===true&&x.coverageCertified===true&&isDigest(x.evidenceSha256))))
   blockers.push('SIX_INDEPENDENT_CALLER_DOMAINS_NOT_PROVEN');
 for(const [key,label] of [
  ['providerSignatureObserved','REAL_PROVIDER_SIGNATURE_UNVERIFIED'],
  ['noUnknownExternalCallers','EXTERNAL_CALLER_COMPLETENESS_UNKNOWN'],
  ['privateTwoStepHostedAcceptance','PRIVATE_HOSTED_TWO_STEP_NOT_ACCEPTED'],
  ['hostedJwtStoreIsolation','HOSTED_SAME_TENANT_JWT_RLS_NOT_PROVEN'],
  ['canaryAndRollbackProven','CANARY_ROLLBACK_NOT_PROVEN'],
  ['postCutoverMonitoringReady','POST_CUTOVER_MONITORING_NOT_PROVEN'],
  ['independentOperationApproval','EXACT_REVOKE_AUTHORIZATION_NOT_VERIFIED']
 ])if(packet[key]!==true)blockers.push(label);
 return noGo('RPC_CUTOVER',blockers);
}
function reviewRecovery(packet={}){
 const blockers=[];
 for(const [key,label] of [
  ['controllerIndependentlyAuthenticated','CONTROLLER_NOT_VERIFIED'],
  ['securityReviewerIndependentlyAuthenticated','SECURITY_REVIEWER_NOT_VERIFIED'],
  ['backupOperatorIndependentlyAuthenticated','OPERATOR_NOT_VERIFIED'],
  ['independentHumanSeparationVerified','SEPARATION_OF_DUTIES_NOT_VERIFIED'],
  ['merchantDataScopeAndLawfulBasisApproved','MERCHANT_SCOPE_AND_DATA_BASIS_NOT_APPROVED'],
  ['encryptedOffsiteStoreAndKeyCustodyProven','OFFSITE_ENCRYPTION_NOT_PROVEN'],
  ['authRolesAclAndExternalCoverageProven','RECOVERY_COVERAGE_INCOMPLETE'],
  ['oneTimeExportAuthorizationSigned','OPERATION_SPECIFIC_AUTH_EXPORT_NOT_APPROVED'],
  ['consistentIsolatedRestoreCertified','INDEPENDENT_RESTORE_NOT_CERTIFIED'],
  ['retentionAndErasureApproved','RETENTION_NOT_APPROVED']
 ])if(packet[key]!==true)blockers.push(label);
 return noGo('PRIVATE_RECOVERY',blockers);
}
function reviewStoreMigration(packet={}){
 const blockers=[];
 if(packet.hostedCanonicalStores!==true)blockers.push('CANONICAL_STORES_NOT_HOSTED');
 if(packet.storeIdCoreTables!==true)blockers.push('STORE_ID_NOT_HOSTED');
 if(packet.legacyPerRowOwnershipProof!==true)blockers.push('LEGACY_OWNERSHIP_NOT_PROVEN');
 if(packet.allLegacyBackfillReconciled!==true)blockers.push('LEGACY_BACKFILL_NOT_RECONCILED');
 if(packet.sameTenantJwtApiRlsVerified!==true)blockers.push('HOSTED_SAME_TENANT_JWT_NOT_PROVEN');
 if(packet.tenantSkuCompatibilityApproved!==true)blockers.push('LEGACY_TENANT_SKU_CONTRACT_NOT_MIGRATED');
 if(packet.compositeForeignKeysVerified!==true)blockers.push('STORE_COMPOSITE_FK_NOT_PROVEN');
 if(packet.legacyWritersDualReadCompatibilityVerified!==true)blockers.push('LEGACY_READ_WRITE_COMPAT_NOT_PROVEN');
 if(packet.recoveryConsentCertified!==true)blockers.push('RESTORE_GATE_NOT_APPROVED');
 if(packet.rollbackCanaryApproved!==true)blockers.push('STORE_ROLLBACK_NOT_APPROVED');
 return noGo('STORE_MIGRATION',blockers);
}
module.exports=Object.freeze({DOMAINS,reviewCutover,reviewRecovery,reviewStoreMigration});
