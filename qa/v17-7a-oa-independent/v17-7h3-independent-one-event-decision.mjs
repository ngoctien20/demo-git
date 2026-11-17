// TIEN404 V17.7H.3 — Independent Owner / One-Event Admission Decision.
// Both H.2 drafts are acknowledged without merging/cherry-picking either.
// A user-supplied screenshot is UI evidence, not verified Zalo identity.
// The H.2 getMe transport is mock-only, never a real readback.
// This module cannot read users, Vault, Cloudflare, n8n, Messenger or DB.
// It NEVER authorizes a public webhook or real provider send based on JSON.
const UI_SHA='da459617e310e2341eb7f27430b8c6e0c6fe3f745560ab54e2be771b74b54258';
const SCREEN_PR=360;
const READBACK_PR=364;
const WORKER='tien404-v177h-provider-nosend-inactive-staging';
const VERSION='c39b8e9d-2dfc-454d-b29d-40b495ff2043';
const SCREEN_FIELDS=new Set(['origin','pr','sha256','classification','botIdVisible',
  'providerSessionVerified','separateQaBotVerified']);
const MOCK_FIELDS=new Set(['origin','pr','classification','realApiCalls',
  'webhookChanged','ownerVerified']);
const WORKER_FIELDS=new Set(['source','name','version','deployments','bindings',
  'workersDev','previews','publicRoute']);
const FRAME_FIELDS=new Set(['mode','screenshot','operatorMock','worker',
 'noProviderSend','noCommerceWrite','noCustomerData','operatorGrantExists',
 'trustedProviderSessionExists','realBotIdKnown','realGetMeVerified',
 'hostedReplayVerified','independentProviderNoSendAudited']);

const GUARDED=Object.freeze({
  realOwnerIndependentlyVerified:false,
  realOperatorAndReviewerVerified:false,
  realGetMeVerified:false,
  realGetWebhookInfoVerified:false,
  realBotIsDisposableAndUnbound:false,
  realNativeProviderEventReceived:false,
  realCloudflareReplayVerified:false,
  realExternalNoSendAuditVerified:false,
  realCrossStoreJwtRlsVerified:false,
  allowActivateWorker:false,
  allowPublicProviderCallback:false,
  allowSetWebhook:false,
  allowSendProviderMessage:false,
  allowCommerceReader:false,
  allowCommerceWriter:false,
  allowPublish:false
});
function outcome(status, reason, additional={}){
 return Object.freeze({status,reason,sourceOnly:true,...GUARDED,...additional});
}
const shape=(v,keys)=>!!v&&typeof v==='object'&&!Array.isArray(v)&&
   Object.keys(v).every(k=>keys.has(k));

export function reconcileParallelH2Evidence(frame){
 if(!shape(frame,FRAME_FIELDS)||
    frame.mode!=='H3_REDACTED_OFFLINE_CROSS_PR_RECONCILIATION'||
    frame.noProviderSend!==true||frame.noCommerceWrite!==true||
    frame.noCustomerData!==true)
   return outcome('NO_GO','CROSS_CHECKPOINT_SCOPE_UNTRUSTED');
 const {screenshot:ui,operatorMock:op,worker:w}=frame;
 if(!shape(ui,SCREEN_FIELDS)||
    ui.origin!=='USER_SCREENSHOT_SHA_ONLY'||
    ui.pr!==SCREEN_PR||ui.sha256!==UI_SHA||
    ui.classification!=='USER_UI_ONLY_NOT_PROVIDER_AUTH'||
    ui.botIdVisible!==false||ui.providerSessionVerified!==false||
    ui.separateQaBotVerified!==false)
   return outcome('NO_GO','SCREENSHOT_IS_NOT_VERIFIED_OWNER_OR_QA_BOT');
 if(!shape(op,MOCK_FIELDS)||
    op.origin!=='GITHUB_CI_OFFLINE_MOCK'||
    op.pr!==READBACK_PR||
    op.classification!=='GETME_WEBHOOKINFO_MOCK_ONLY'||
    op.realApiCalls!==0||op.webhookChanged!==false||
    op.ownerVerified!==false)
   return outcome('NO_GO','MOCK_GETME_IS_NOT_PROVIDER_NATIVE_READBACK');
 if(!shape(w,WORKER_FIELDS)||w.source!=='CONNECTED_CLOUDFLARE_READONLY'||
    w.name!==WORKER||w.version!==VERSION||
    w.deployments!==0||w.bindings!==0||w.workersDev!==false||
    w.previews!==false||w.publicRoute!==false)
   return outcome('NO_GO','INACTIVE_WORKER_OR_PUBLIC_ROUTE_DRIFT_REQUIRES_AUDIT');

 // Claimed private owner/provider flags may be pasted into this structure;
 // only an independent trusted issuer/secure live readback could prove them.
 // There are no trusted issuer roots or native signed provider receipts here,
 // so an ALL TRUE JSON report is suspicious and must NOT grant a callback.
 if(frame.operatorGrantExists!==false||
    frame.trustedProviderSessionExists!==false||
    frame.realBotIdKnown!==false||
    frame.realGetMeVerified!==false||
    frame.hostedReplayVerified!==false||
    frame.independentProviderNoSendAudited!==false)
   return outcome('NO_GO','UNVERIFIED_LIVE_OR_AUTHORITY_CLAIM_NOT_ACCEPTED');
 return outcome('PRIVATE_EVIDENCE_INTAKE_READY_REAL_UAT_NO_GO',
   'PR360_UI_AND_PR364_MOCK_RECONCILED_NEITHER_IS_REAL_BOT_OWNER',{
    sourceEvidenceCount:2,
    screenPr:SCREEN_PR,methodMockPr:READBACK_PR,
    screenshotIsUserSuppliedOnly:true,
    realNativeOwnerSessionCount:0,
    realBotApiRequestsCount:0,
    workerRemainsInactive:true
 });
}

export function independentOneEventDecision(_selfReported,context={}){
 const ownerAction='OPEN_DISPOSABLE_QA_BOT_IN_OFFICIAL_CREATOR_AND_PIN_BOT_ID_PRIVATELY';
 const blockers=Object.freeze([
  'BOT_CREATOR_PRIVATE_ADMIN_SESSION_NOT_INDEPENDENTLY_ATTESTED',
  'DISPOSABLE_QA_BOT_ID_AND_CURRENT_WEBHOOK_NOT_PROVED',
  'OWNER_SCOPED_CONSENT_AND_INDEPENDENT_OPERATOR_NOT_APPROVED',
  'MANAGED_SECRET_REAL_GETME_GETWEBHOOKINFO_NOT_EXECUTED',
  'NO_HOSTED_NATIVE_SIGNED_ONE_EVENT_CALLBACK',
  'NO_HOSTED_DURABLE_REPLAY_RATE_AND_EDGE_DENY_ACCEPTANCE',
  'NO_PROVIDER_N8N_COMMERCE_ZERO_SEND_ZERO_WRITE_AUDIT',
  'NO_REAL_SAME_TENANT_AB_JWT_RLS_BEFORE_STORE_READ'
 ]);
 return outcome('REAL_ONE_EVENT_NO_GO',
  'TRUSTED_PROVIDER_OWNER_AND_OPERATOR_ATTESTATION_MISSING',{
   blockers,nextUserAction:ownerAction,
   approvedRealEventCount:0,allowedInboundInSourcePlan:1,
   maxRealOutbound:0,maxRealCommerceWrites:0,
   selfReportedFlagsIgnored:_selfReported!=null,
   backendClaimNotAuthoritative:context?.source!=='PRIVATE_TRUSTED_ISSUER_VERIFIED'
 });
}

export const canonicalParallelH2Evidence=Object.freeze({
 mode:'H3_REDACTED_OFFLINE_CROSS_PR_RECONCILIATION',
 screenshot:Object.freeze({
  origin:'USER_SCREENSHOT_SHA_ONLY',pr:SCREEN_PR,sha256:UI_SHA,
  classification:'USER_UI_ONLY_NOT_PROVIDER_AUTH',botIdVisible:false,
  providerSessionVerified:false,separateQaBotVerified:false
 }),
 operatorMock:Object.freeze({
  origin:'GITHUB_CI_OFFLINE_MOCK',pr:READBACK_PR,
  classification:'GETME_WEBHOOKINFO_MOCK_ONLY',realApiCalls:0,
  webhookChanged:false,ownerVerified:false
 }),
 worker:Object.freeze({
  source:'CONNECTED_CLOUDFLARE_READONLY',name:WORKER,version:VERSION,
  deployments:0,bindings:0,workersDev:false,previews:false,
  publicRoute:false
 }),
 noProviderSend:true,noCommerceWrite:true,noCustomerData:true,
 operatorGrantExists:false,trustedProviderSessionExists:false,
 realBotIdKnown:false,realGetMeVerified:false,
 hostedReplayVerified:false,independentProviderNoSendAudited:false
});
