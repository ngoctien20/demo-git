'use strict';
/**
 * TIEN404 G0.9 — Isolated Meta No-Send *admission candidate*.
 *
 * ORCHESTRATION ONLY: reuses real V17.1E handleIsolatedMeta from PR #243
 * through a pinned, injected function. Does not recreate HMAC verifier.
 *
 * No listener, network, credentials, Messenger reply, AI, Commerce read/write.
 * Private source authority, durable claim implementation and private config
 * are supplied by a future independently approved *operator-controlled* server.
 * Test synthetic callbacks do NOT prove provider Page/App ownership.
 */
const CONTRACT='T404_G09_ISOLATED_SIGNED_NOSEND_V1';
const REFERENCE='T404_V171E_ISOLATED_SIGNED_NOSEND_V1';
const SHA=/^[0-9a-f]{64}$/;
const ID=/^[a-zA-Z0-9_-]{8,96}$/;
const FIELD_KEYS=['source','independentReviewer','privateOwnerEvidenceHash',
  'privateProviderEvidenceHash','ownerAndReviewerDistinct','qaPageOwnerVerified',
  'qaAppOwnerVerified','qaPageSubscriptionVerified','qaPageAppIsolated',
  'testSenderApproved','callbackScopeApproved','productionCallbackUnchanged',
  'originalStoreOwnerVerified','canonicalStoreBindingVerified','validUntilMs',
  'reviewerReceiptId'];
const validObj=(v,k)=>!!v&&typeof v==='object'&&!Array.isArray(v)&&
  Object.getPrototypeOf(v)===Object.prototype&&
  Object.keys(v).length===k.length&&k.every(p=>Object.hasOwn(v,p));
function make(status,reason,extra={}){
 return Object.freeze({
  contract:CONTRACT,status,reason,
  ...extra,
  noSend:true,providerSends:0,modelCalls:0,orderWrites:0,
  stockWrites:0,hostedCommerceReads:0,hostedWrites:0,
  canPublish:false,canModifyProviderCallback:false,
  canUseProductionCredentials:false,canReadCustomerOrders:false,
  canSendMessages:false,canCreateOrders:false,canPromoteRls:false,
  realProviderEventIndependentlyCertifiedHere:false,
  independentlyReviewedRealPageOwnershipHere:false,
  realCommerceStoreOwnershipCertifiedHere:false,
  realSignedPilotCompletedHere:false,
  durableIdempotencyProvenHere:false
 });
}
const deny=(reason)=>make('G09_REAL_SIGNED_NO_SEND_NOT_ADMITTED',reason);
function validAuthority(a,now){
 if(!validObj(a,FIELD_KEYS)||a.source!=='PRIVATE_OPERATOR_CONTROL_PLANE'||
  a.independentReviewer!==true||a.ownerAndReviewerDistinct!==true||
  a.qaPageOwnerVerified!==true||a.qaAppOwnerVerified!==true||
  a.qaPageSubscriptionVerified!==true||a.qaPageAppIsolated!==true||
  a.testSenderApproved!==true||a.callbackScopeApproved!==true||
  a.productionCallbackUnchanged!==true||
  a.originalStoreOwnerVerified!==true||
  a.canonicalStoreBindingVerified!==true||
  typeof a.privateOwnerEvidenceHash!=='string'||!SHA.test(a.privateOwnerEvidenceHash)||
  typeof a.privateProviderEvidenceHash!=='string'||!SHA.test(a.privateProviderEvidenceHash)||
  !ID.test(a.reviewerReceiptId)||
  !Number.isSafeInteger(a.validUntilMs)||a.validUntilMs<=now||
  a.validUntilMs>now+30*60*1000)return false;
 return true;
}
function createCandidate({handler,loadPrivateAuthority,loadPrivateMetaConfig,clock=()=>Date.now()}={}){
 if(typeof handler!=='function'||typeof loadPrivateAuthority!=='function'||
    typeof loadPrivateMetaConfig!=='function'||typeof clock!=='function')
  throw Error('G09_PRIVATE_INJECTION_REQUIRED');
 return Object.freeze({
  async inspectOne({request}={}){
   // Context is *never* accepted from HTTP body/headers or caller options.
   // This module itself has no source of primary authority beyond dependencies.
   if(!request||Object.keys(request).sort().join(',')!=='headers,method,rawBody,url'||
    request.method!=='POST'||!Buffer.isBuffer(request.rawBody)||
    request.rawBody.length===0||request.rawBody.length>32768||
    !request.headers||typeof request.headers!=='object'||Array.isArray(request.headers)||
    typeof request.url!=='string')
    return deny('POST_RAW_BYTES_ONLY_NO_CALLER_AUTHORITY');
   let authority;
   try{authority=await loadPrivateAuthority()}
   catch{return deny('PRIVATE_OPERATOR_AUTHORITY_UNAVAILABLE')}
   const now=clock();
   if(!Number.isSafeInteger(now)||now<=0)return deny('CLOCK_INVALID');
   if(!validAuthority(authority,now))return deny('ORIGINAL_PROVIDER_STORE_OWNER_REVIEW_NOT_ACCEPTED');
   let cfg;
   try{cfg=await loadPrivateMetaConfig()}
   catch{return deny('PRIVATE_META_APP_CONFIGURATION_UNAVAILABLE')}
   if(!cfg||typeof cfg!=='object'||typeof cfg.claimOnce!=='function')
    return deny('PRIVATE_DURABLE_REPLAY_CLAIM_MISSING');
   // Validate operator signoff against independently fetched QA policy.
   // The V17.1E module will again enforce app/page isolation,
   // AppSecret raw-body HMAC, sender, recipient, MID, timestamp & atomic claim.
   if(cfg.ownerApproval?.qaAppPageIsolated!==true||
      cfg.ownerApproval?.callbackPermissionGranted!==true||
      cfg.ownerApproval?.merchantPageControlVerified!==true||
      cfg.ownerApproval?.productionAppCallbackUnchanged!==true)
    return deny('OPERATOR_SIGNOFF_NOT_ALIGNED_WITH_META_QA_POLICY');
   let out;
   try{out=await handler(request,cfg,clock)}
   catch{return deny('PINNED_META_NO_SEND_HANDLER_FAILED')}
   if(!out||out.contract!==REFERENCE||out.meta_outbound!==0||
      out.model_calls!==0||out.commerce_writes!==0)
    return deny('PINNED_META_HANDLER_CONTRACT_DRIFT');
   if(out.status==='DUPLICATE_IGNORED')
    return make('G09_DUPLICATE_NO_SEND','PINNED_META_DURABLE_CLAIM_SAYS_DUPLICATE');
   if(out.status!=='SIGNED_QA_EVENT_NO_SEND'||out.http_status!==200||
      out.signature_matched_configured_app_secret!==true||
      out.page_and_test_sender_matched_private_configuration!==true||
      out.accepted_as_real_provider_delivery!==false||
      out.merchant_owner_proved_independently_by_this_code!==false||
      out.mock_outbound!=='NO_SEND')
    return deny('SIGNED_QA_EVENT_NOT_ELIGIBLE');
   // Source cryptographic checks passed *under injected private QA config*,
   // but this source code cannot assert that a real Meta event was received.
   // Completion requires a separate authenticated infra log/Reviewer receipt.
   return make('G09_PINNED_META_HMAC_QA_NO_SEND_PASSED',
    'REAL_PROVIDER_DELIVERY_AND_STORE_AUTHORITY_NOT_CERTIFIED_BY_THIS_MODULE',{
    receiptId:typeof out.receipt_id==='string'&&SHA.test(out.receipt_id)?
       out.receipt_id:undefined,
    metaCryptoByPinnedHandler:true,
    manualOperatorEvidenceRequired:true,
    independentRealEventReceiptRequired:true
   });
  }
 });
}
module.exports=Object.freeze({CONTRACT,REFERENCE,FIELD_KEYS,createCandidate,validAuthority});
