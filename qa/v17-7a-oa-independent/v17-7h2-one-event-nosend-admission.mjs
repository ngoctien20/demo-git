// TIEN404 V17.7H.2 — single-event QA-only authorization boundary.
// No real provider, message or DB effect: every result explicitly NO-GO.
// A successful offline plan/receipt SHAPE is NOT an Owner/Provider approval.
const NAME='tien404-v177h-provider-nosend-inactive-staging';
const VERSION='c39b8e9d-2dfc-454d-b29d-40b495ff2043';
const SIGNATURE_POLICY='ZALO_BOT_NATIVE_SECRET_HEADER_AND_BOUND_BOT';
const DENY=Object.freeze({
  sourceOnly:true,realOwnerConsentVerified:false,
  independentOperatorVerified:false,
  realNativeSignatureVerified:false,
  realProviderEventReceived:false,
  realHostedDurableLedgerVerified:false,
  realHostedStoreJwtRlsVerified:false,
  realExternalEdgeDenyVerified:false,
  canEnableWorker:false,canSetWebhook:false,
  canReceiveRealEvent:false,canSendProvider:false,
  canReadCommerce:false,canWriteOrders:false,
  canUpdateStock:false,canPublish:false
});
const denied=(reason,extra={})=>Object.freeze({
  shapePrepared:false,reason,...DENY,...extra
});
const candidate=(reason,extra={})=>Object.freeze({
  shapePrepared:true,reason,...DENY,...extra
});
const ALLOWED=new Set([
 'mode','channel','worker','version','maxInboundEvents',
 'maxProviderSends','maxOrderWrites','maxStockWrites',
 'maxCommerceReads','replayRequired','nativeProofRequired',
 'qaWindowSeconds','existingZaloWebhookUnchanged',
 'existingMessengerWebhookUnchanged','newPublicRoute',
 'providerTokenInstalled','merchantEvidenceWorkerShared',
 'legacyN8nWorkflowReused','independentLogsRequired'
]);
/**
 * To be considered a safe source-only plan, must be dormant in Cloudflare.
 * A real event requires a NEW owner-approved provider callback and a different
 * deployment gate; this code can never turn the Worker on.
 */
export function inspectOneEventNoSendPlan(plan){
 if(!plan||typeof plan!=='object'||Array.isArray(plan)||
   Object.keys(plan).some(k=>!ALLOWED.has(k))||
   plan.mode!=='OFFLINE_ONE_EVENT_READINESS_ONLY'||
   plan.channel!=='ZALO_BOT'||
   plan.worker!==NAME||plan.version!==VERSION)
  return denied('CANARY_PLAN_UNTRUSTED_OR_WORKER_VERSION_DRIFT');
 if(plan.maxInboundEvents!==1 ||
    plan.maxProviderSends!==0 ||
    plan.maxOrderWrites!==0||plan.maxStockWrites!==0||
    plan.maxCommerceReads!==0 ||
    plan.replayRequired!==true ||
    plan.nativeProofRequired!==SIGNATURE_POLICY||
    plan.qaWindowSeconds!==600 ||
    plan.existingZaloWebhookUnchanged!==true||
    plan.existingMessengerWebhookUnchanged!==true||
    plan.newPublicRoute!==false||
    plan.providerTokenInstalled!==false||
    plan.merchantEvidenceWorkerShared!==false||
    plan.legacyN8nWorkflowReused!==false||
    plan.independentLogsRequired!==true)
  return denied('ONE_EVENT_ZERO_SEND_ZERO_WRITE_AND_ROLLBACK_LIMITS_MISSING');
 return candidate('ONE_EVENT_SOURCE_PLAN_PREPARED_REAL_OWNER_STILL_NO_GO',{
   plannedMaxInbound:1,plannedMaxOutbound:0,
   plannedOrderWrites:0,plannedStockWrites:0,
   newPublicEndpointCreated:false,
   currentWorkerDeployed:false
 });
}
/**
 * Shape-only independent UAT report. All fields are redacted numbers/booleans,
 * never raw request, phone, message, token, Store or customer/order row.
 * A user-supplied "passed" packet is NOT authenticated by this function.
 */
export function inspectIndependentNoSendUatReceiptShape(receipt){
 const expected=new Set(['source','mode','singleInbound','providerSends',
  'n8nSends','commerceOrderWrites','commerceStockWrites',
  'privilegedRpcWrites','crossStoreReads','signatureFailures',
  'replayedEventsDenied','auditorDistinctFromOperator',
  'nativeProviderLogReconciled','hostedDbLogReconciled',
  'rawSensitiveFieldsExcluded']);
 if(!receipt||typeof receipt!=='object'||Array.isArray(receipt)||
    Object.keys(receipt).some(k=>!expected.has(k))||
    receipt.mode!=='SYNTHETIC_AUDIT_FIXTURE_ONLY'||
    receipt.source!=='OFFLINE_INDEPENDENT_MOCK'||
    receipt.singleInbound!==1||receipt.providerSends!==0||
    receipt.n8nSends!==0||receipt.commerceOrderWrites!==0||
    receipt.commerceStockWrites!==0||receipt.privilegedRpcWrites!==0||
    receipt.crossStoreReads!==0||receipt.signatureFailures!==0||
    receipt.replayedEventsDenied!==1||
    receipt.auditorDistinctFromOperator!==true||
    receipt.nativeProviderLogReconciled!==false||
    receipt.hostedDbLogReconciled!==false||
    receipt.rawSensitiveFieldsExcluded!==true)
  return denied('NATIVE_INDEPENDENT_RECONCILIATION_NOT_VERIFIED');
 return candidate('SYNTHETIC_ONE_EVENT_NO_SEND_REPORT_FORMAT_ONLY',{
   dryRunInboundCount:1,realProviderSendAudited:false,
   realHostedDatabaseAudited:false
 });
}
export const oneEventDefaultPlan=Object.freeze({
 mode:'OFFLINE_ONE_EVENT_READINESS_ONLY',
 channel:'ZALO_BOT',worker:NAME,version:VERSION,
 maxInboundEvents:1,maxProviderSends:0,maxOrderWrites:0,
 maxStockWrites:0,maxCommerceReads:0,replayRequired:true,
 nativeProofRequired:SIGNATURE_POLICY,qaWindowSeconds:600,
 existingZaloWebhookUnchanged:true,existingMessengerWebhookUnchanged:true,
 newPublicRoute:false,providerTokenInstalled:false,
 merchantEvidenceWorkerShared:false,legacyN8nWorkflowReused:false,
 independentLogsRequired:true
});
