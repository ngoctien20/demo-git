'use strict';
/**
 * V17.1E: provider-channel UAT admission review, not a live API or permission
 * checker. Self-reported flags NEVER promote a real service. Real account
 * authority, signed webhook, Store JWT and photo rights require original
 * private evidence and a separate bounded operator approval.
 */
const CONTRACT='T404_V171E_META_ZALO_UAT_NO_SEND_ADMISSION_V1';
const REQUIREMENTS=Object.freeze({
 META:['metaPageOwnerOriginalProof','metaAppPageMessagingScopesGranted',
 'metaRawWebhookHmacIndependentlyVerified','metaImageAttachmentReadAllowed'],
 ZALO_OA:['zaloOaMerchantOwnerOriginalProof','zaloAppAuthorizedForOa',
 'zaloOaEventAndSignatureVerified','zaloOaReceiveMediaPermissionVerified'],
 CROSS_CHANNEL:['distinctZaloBotVsOaContractsReviewed',
 'originalSourceCustomerApprovalProof','destinationCustomerProofVerified',
 'consentRevocationAndLinkReplayTested','statusOnlyOrderAccessGrantApproved'],
 DATA_AND_SECURITY:['fourActualRowsStoreOwnershipIndependentlyAttested',
 'hostedSameTenantStoreJwtRlsNegativePass','latestIndependentBackupRestoreAccepted',
 'merchantImageRightsAndRetentionIndependentlyAttested',
 'realVisionProviderInferenceReceiptApproved','realImageRecallAndUnknownFalsePositiveMeasured',
 'pricingAndModelBudgetOperatorApproved','privateImageStorageAndAclVerified'],
 RELEASE:['dedicatedPageOaAuthorizedNoSendPilotAccepted',
 'independentSecurityReviewerApproved','exactUatWindowAndRollbackApproved']
});
const all=Object.freeze(Object.entries(REQUIREMENTS).flatMap(([group,keys])=>keys.map(k=>({group,key:k}))));
function review({claims={},projectRef,scope='STAGING_READ_ONLY_NO_SEND'}={}){
 const reasons=[];
 if(projectRef!=='ifxlvrhyjhbzbrkdsida'||scope!=='STAGING_READ_ONLY_NO_SEND')
  reasons.push('PROJECT_OR_UAT_SCOPE_UNVERIFIED');
 if(!claims||typeof claims!=='object'||Array.isArray(claims))
  claims={};
 for(const {group,key} of all)if(claims[key]!==true)
  reasons.push(group+'_'+key.toUpperCase()+'_MISSING');
 return Object.freeze({contract:CONTRACT,
  status:reasons.length?'REAL_MESSENGER_ZALO_UAT_NO_GO':
   'CLAIMED_EVIDENCE_PACKET_PENDING_INDEPENDENT_OPERATOR_ACCEPTANCE',
  missingEvidenceCount:reasons.length,
  blockers:Object.freeze(reasons),
  requiredEvidenceCount:all.length,
  realProviderAccountProofVerifiedByThisCode:false,
  actualMetaWebhookCheckedByThisCode:false,
  actualZaloOaWebhookCheckedByThisCode:false,
  realCustomerRightsCheckedByThisCode:false,
  currentHostedStoreJwtRlsVerifiedByThisCode:false,
  canSendProvider:false,canCallRealVision:false,
  canPublishWorkflow:false,canBackfillCommerce:false,
  canReadRealOrders:false,canMergeRelease:false,
  providerSends:0,realModelCalls:0,hostedWrites:0});
}
function permittedQaActions(){
 return Object.freeze({reviewMetadata:true,runSyntheticNodeTests:true,
  useIsolatedDisposableDb:true,inspectAccountPermissionsReadOnlyWithScopedAccess:true,
  modifyPublishedWorkflow:false,realProviderSend:false,uploadMerchantImages:false,
  callPaidModel:false,readRealCustomerOrders:false,applyHostedMigration:false});
}
function authorizeRealUat(){
 throw Error('V171E_REAL_PROVIDER_UAT_REQUIRES_PRIVATE_OPERATOR_APPROVAL');
}
module.exports=Object.freeze({CONTRACT,REQUIREMENTS,review,permittedQaActions,authorizeRealUat});
