'use strict';
/**
 * TIEN404 V13.6M.3 — CANONICAL offline-only Messenger ingress pipeline.
 * One audited adapter path:
 *   raw HMAC -> restricted store repository -> verified Page/Store entitlement
 *   -> signed intent/replay DRY_RUN -> store-scoped catalog -> Rich UI PREVIEW.
 *
 * This file DOES NOT connect to n8n, Supabase, Messenger Graph or a customer.
 * The retired V13.6M.2 abstract resolver remains for historical QA only.
 * Injection ports in tests use synthetic fixtures, not proof of hosted RLS.
 */
const {verifyMetaRaw,processCandidate} = require('../messenger-rich-v136m1/integration.cjs');
const {createTrustedPorts} = require('../messenger-rich-v136m2/trusted-repository.cjs');

const SAFE_CODES=new Set([
 'META_APP_SECRET_MISSING','RAW_BODY_INVALID','META_SIGNATURE_REQUIRED',
 'META_SIGNATURE_INVALID','SERVER_ACTION_SECRET_MISSING',
 'SCHEMA_INSPECTION_UNVERIFIED','RESTRICTED_DB_PORT_REQUIRED',
 'CANONICAL_STORE_RLS_MISSING','PRIVATE_BACKEND_PORT_MISSING','DB_RESPONSE_INVALID',
 'PAGE_SENDER_INVALID','PAGE_NOT_BOUND','PAGE_AMBIGUOUS',
 'CHANNEL_BINDING_NOT_AUTHORIZED','PUBLIC_SHOP_CONFIG_UNVERIFIED',
 'SHOP_OR_SUBSCRIPTION_UNAUTHORIZED','SCOPE_REUSE_ACROSS_PAGE_OR_SENDER',
 'SCOPE_NOT_ISSUED_BY_RESOLVER','ENTITLEMENT_GATE_REQUIRED',
 'CATALOG_READ_SCOPE_REQUIRED','CATALOG_LIMIT_EXCEEDED',
 'CATALOG_ROW_SCOPE_INVALID','CATALOG_PRICE_INVALID','CATALOG_DUPLICATE_SKU',
 'REPLAY_DRY_RUN_ONLY','REPLAY_CHECK_NOT_SAFE',
 'META_BODY_JSON_INVALID','META_ENVELOPE_INVALID','META_ENTRIES_INVALID',
 'META_SENDER_RECIPIENT_UNVERIFIED','META_TIMESTAMP_INVALID',
 'MESSENGER_TIME_WINDOW_DENIED','TOO_MANY_EVENTS','REPLAY_KEY_TOO_LONG',
 'TRUSTED_PAGE_SHOP_SCOPE_DENIED','SHOP_STATUS_UNVERIFIED',
 'SHOP_DISABLED_OR_SUBSCRIPTION_UNVERIFIED','CATALOG_SCOPE_UNVERIFIED',
 'CATALOG_TENANT_OR_SKU_DENIED','CATALOG_STORE_ROW_SCOPE_DENIED',
 'CATALOG_VND_INVALID','CATALOG_STOCK_INVALID','CATALOG_UNBOUNDED',
 'CATALOG_DUPLICATE_SKU','ACTION_SIGNATURE_INVALID','ACTION_PAYLOAD_INVALID',
 'ACTION_EXPIRED_OR_UNTRUSTED','ACTION_PAYLOAD_TOO_LONG',
 'ACTION_DENIED','UNSUPPORTED_MESSENGER_EVENT','WEBHOOK_IDENTITY_UNVERIFIED',
 'REPLAY_GUARD_UNVERIFIED','WEBVIEW_URL_NOT_ALLOWED',
 'WEBVIEW_ORIGIN_ONLY','WEBVIEW_ALLOWLIST_REQUIRED'
]);
function blocked(code){
 const e=new Error(code);e.code=code;return e;
}
function publicError(error) {
 const value=error&&typeof error.code==='string'?error.code:'';
 return blocked(SAFE_CODES.has(value)?value:'CANONICAL_PIPELINE_BLOCKED');
}
function isPreview(x){
 if(!x||x.previewOnly!==true||x.sendEnabled!==false) return false;
 if(x.status==='DUPLICATE_SUPPRESSED')return true;
 if(x.status!=='PREVIEW_CREATED'||x.allowedOrderWrites!==false||
   x.requiresMetaPolicyReview!==true||
   !x.prepared||x.prepared.previewOnly!==true||
   x.prepared.sendEnabled!==false)return false;
 return true;
}
async function previewMessengerV136M3({
 mode='BLOCKED', rawBody,signature,appSecret,actionSecret,siteOrigin,
 db,readEntitlement,readPublicConfig,replayCheck,now=Date.now
}={}){
 // No hosted read switch exists here. Staging integration requires separate
 // explicit approval, schema readiness and actual authenticated RLS QA.
 if(mode!=='SYNTHETIC_QA_ONLY')throw blocked('HOSTED_MESSENGER_INTEGRATION_NOT_APPROVED');
 try{
  // Verify the exact signed bytes BEFORE any repository query.
  verifyMetaRaw({rawBody,signature,appSecret});
  const {ports,gate}=await createTrustedPorts({
   db,readEntitlement,readPublicConfig,replayCheck,now,mode:'OFFLINE_TEST'
  });
  if(gate.status!=='SCHEMA_READY_FOR_HOSTED_QA'||gate.canSendMessenger!==false||
    gate.canWriteOrders!==false)throw blocked('CANONICAL_REPOSITORY_GATE_DENIED');
  const result=await processCandidate({
   rawBody,signature,appSecret,actionSecret,ports,siteOrigin,now
  });
  if(result.status!=='CANDIDATE_PREVIEW_ONLY'||result.previewOnly!==true||
     result.sendEnabled!==false||!Array.isArray(result.events)||
     !result.events.every(isPreview))throw blocked('UNSAFE_RICH_UI_RESULT');
  return Object.freeze({
   stage:'MESSENGER_RICH_UI_V136M3',
   lifecycle:'OFFLINE_CANDIDATE',
   status:'CANDIDATE_PREVIEW_ONLY',
   previewOnly:true,sendEnabled:false,
   allowOrderWrites:false,hostedReady:false,
   providerTransportEnabled:false,profileMutationEnabled:false,
   durableReplayReady:false,
   canonicalResolver:'trusted-repository.cjs',
   events:result.events
  });
 }catch(error){throw publicError(error)}
}
module.exports={previewMessengerV136M3};
