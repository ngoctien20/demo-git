// V17.MC03B — Meta QA Page/App NO-SEND preflight, never Graph executor.
// Reuses the existing V17.1D read-only Page subscribed_apps helper response.
// Successful GET never establishes Page ownership, handover or send rights.
const REF=/^[A-Za-z0-9_.:-]{8,128}$/;
const ref=x=>typeof x==='string'&&REF.test(x);
const deny=reason=>Object.freeze({
  status:'BLOCKED',reason,graphReadVisibilityObserved:false,
  independentPageOwnerProved:false,independentAppPermissionsProved:false,
  realSignedHandoverReceived:false,canEnableCallback:false,
  canUseGraphPost:false,canPassThreadControl:false,
  canSendMessages:false,canDeploy:false,canReadRealInbox:false,noSend:true
});
const IDS=['qaPageRef','productionPageRef','qaAppRef','productionAppRef',
  'qaTesterRef','ownerReviewTicket','operatorReviewTicket'];
export function inspectMetaQaPageNoSend({manifest,readOnlyReceipt,privateReview,nowMs}={}){
 if(!manifest||manifest.source!=='OFFLINE_PRIVATE_META_QA_PLAN'||
  !IDS.every(k=>ref(manifest[k]))||
  manifest.qaPageRef===manifest.productionPageRef||
  manifest.qaAppRef===manifest.productionAppRef||
  manifest.qaCallbackInactive!==true||
  manifest.productionCallbackUnchanged!==true||
  manifest.singleResponderIsolationPlanned!==true||
  manifest.existingLegacyBotSendDisabledDuringQa!==true||
  manifest.allowProviderSend!==false||
  manifest.allowGraphMutation!==false||
  manifest.allowCommerceReadWrite!==false||
  manifest.allowPaidModel!==false||
  manifest.allowedOperation!=='PRIVATE_READ_ONLY_PREFLIGHT'||
  !Number.isSafeInteger(nowMs)||nowMs<=0)
  return deny('PRIVATE_ISOLATED_QA_MANIFEST_INVALID');
 if(!readOnlyReceipt||readOnlyReceipt.contract!=='T404_V171D_META_PAGE_APP_READONLY_V1'||
  readOnlyReceipt.page_token_can_read_page!==true||
  readOnlyReceipt.expected_app_subscription_visible!==true||
  readOnlyReceipt.status!=='APP_SUBSCRIPTION_VISIBLE_OWNER_UNVERIFIED'||
  readOnlyReceipt.verified_merchant_business_owner!==false||
  readOnlyReceipt.authorized_to_change_callback!==false||
  readOnlyReceipt.real_messenger_send_count!==0||
  readOnlyReceipt.commerce_writes!==0)
  return deny('META_PAGE_APP_READ_VISIBILITY_NOT_VERIFIED');
 const visible={...deny('PRIVATE_INDEPENDENT_PAGE_OWNER_REVIEW_PENDING'),
   source:'T404_V17_MC03B_META_QA_PAGE_PREFLIGHT',graphReadVisibilityObserved:true};
 if(!privateReview||privateReview.source!=='PRIVATE_OPERATOR_REVIEW_SUMMARY_ONLY'||
  !ref(privateReview.ticket)||!ref(privateReview.operatorRef)||
  !ref(privateReview.independentReviewerRef)||
  privateReview.operatorRef===privateReview.independentReviewerRef||
  privateReview.ticket!==manifest.operatorReviewTicket||
  !['originalPageOwnerEvidenceReviewed','appAdminAndHandoverRolesReviewed',
    'qaAppPageBindingReviewed','pageHandoversSubscriptionReviewed',
    'realProviderUserPermissionsReviewed','separateProductionCallbackVerified',
    'singleNamedTesterConsentReviewed','killSwitchAndRollbackReviewed',
    'noSendAndNoThreadMutationInThisPhase'].every(k=>privateReview[k]===true)||
  !Number.isSafeInteger(privateReview.reviewedAtMs)||
  nowMs<privateReview.reviewedAtMs ||
  nowMs-privateReview.reviewedAtMs>4*60*60*1000)
  return Object.freeze(visible);
 return Object.freeze({...visible,status:'PRIVATE_REVIEW_CANDIDATE_ONLY',
  reason:'MANIFEST_AND_READ_ONLY_PROVIDER_SHAPES_OK_REQUIRES_INDEPENDENT_AUDIT',
  privateReviewSummaryShapePresent:true});
}
