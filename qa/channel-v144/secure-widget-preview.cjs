'use strict';
/**
 * TIEN404 V14.4 — OFFLINE-ONLY integration candidate for the existing V14.3
 * Website Widget contract. No HTTP listener, database driver, provider API,
 * model invocation, orders mutation or public install route is included.
 *
 * Security ports are injected from synthetic fixture tests ONLY; real hosted
 * deployment MUST replace these with independently verified atomic durable
 * adapters and pass Store/RLS, backup/restore and signed-owner release gates.
 *
 * Origin is an allowlist signal, NOT proof of customer identity or domain
 * ownership. Neither widget ID nor opaque session grants access to private data.
 */
const {createHmac}=require('node:crypto');
const {locate,mint,verify,theme}=require('../channel-v143/widget-gateway.cjs');
const {widgetPreview}=require('../channel-v143/renderers.cjs');

const PORTS=Object.freeze(['loadRegistry','readDomainProof','consumeQuota',
  'claimEvent','readPublicCatalog','readSalesIntent','readReviewedTheme']);
const ALLOWED_TYPES=new Set(['TEXT','GREETING','PRODUCT_CARD','PRODUCT_LIST',
  'UNAVAILABLE_PRODUCT','SHOP_PAUSED','KNOWLEDGE_ANSWER','ERROR_FALLBACK']);
const EVENT_ID=/^[a-zA-Z0-9_-]{8,80}$/;
function reject(code){const e=new Error(code);e.code=code;throw e;}
function compatibleScope(x,install){
 return x?.tenantId===install.tenantId&&x?.storeId===install.storeId&&
   x?.widgetId===install.widgetId;
}
function createOfflineWidgetPreview({mode='DENY',ports,serverSecret,now=Date.now}={}){
 if(mode!=='OFFLINE_SYNTHETIC_QA'||
    !ports||PORTS.some(k=>typeof ports[k]!=='function')||
    typeof serverSecret!=='string'||Buffer.byteLength(serverSecret,'utf8')<32||
    typeof now!=='function')
   reject('HOSTED_GATEWAY_NOT_AUTHORIZED');
 async function assignment(widgetId,claimedOrigin){
   // A trusted backend must obtain registry and domain proof. A string marker
   // in a user-supplied JSON body is never sufficient in a real deployment.
   const registry=await ports.loadRegistry();
   const install=locate(registry,widgetId,claimedOrigin);
   const proof=await ports.readDomainProof({
     tenantId:install.tenantId,storeId:install.storeId,
     widgetId:install.widgetId,origin:install.origin
   });
   if(proof?.source!=='PRIVATE_STAFF_VERIFIED_DOMAIN_OWNERSHIP'||
      proof?.verified!==true||!compatibleScope(proof,install)||
      proof.origin!==install.origin||!Number.isSafeInteger(proof.expiresAt)||
      proof.expiresAt<=now())
     reject('WIDGET_DOMAIN_OWNERSHIP_NOT_VERIFIED');
   return install;
 }
 async function quota(install,operation){
   const receipt=await ports.consumeQuota({
     tenantId:install.tenantId,storeId:install.storeId,widgetId:install.widgetId,
     operation
   });
   if(receipt?.source!=='DURABLE_QUOTA_LEDGER'||
      receipt?.accepted!==true||!compatibleScope(receipt,install)||
      receipt.operation!==operation)
     reject('WIDGET_QUOTA_DENIED_OR_UNVERIFIED');
 }
 async function issueSession({widgetId,origin:claimedOrigin}={}){
   const install=await assignment(widgetId,claimedOrigin);
   await quota(install,'SESSION_OPEN');
   const session=mint({install,serverSecret,now:now()});
   return Object.freeze({
     session,expiresInSeconds:900,anonymous:true,previewOnly:true,
     privateOrderAccess:false,providerSends:0,orderWrites:0
   });
 }
 async function preview({widgetId,origin:claimedOrigin,session,eventId,message}={}){
   // New V18.5 transport input. Optional for backward-compatible V14.4 QA.
   // Never let the browser supply the verified tenant/store binding.
   if(message!==undefined&&(
     typeof message!=='string'||!message.trim()||message.length>800||
     /[\u0000-\u001f\u007f]/.test(message)))
     reject('WIDGET_MESSAGE_INVALID');
   const install=await assignment(widgetId,claimedOrigin);
   const trusted=verify({install,session,serverSecret,now:now()});
   if(!trusted.verified||!trusted.requiresDurableReplayGuard||
      !trusted.requiresRateLimit||!EVENT_ID.test(eventId||''))
     reject('WIDGET_EVENT_ID_OR_SECURITY_GATE_INVALID');
   await quota(install,'PUBLIC_PREVIEW');
   // Private, server-keyed digest. An input-provided eventId alone is never
   // the persisted uniqueness key. Persisting the claim must be atomic in
   // a SHARED database across workers (not implemented in this module).
   const digest=createHmac('sha256',serverSecret)
     .update('TIEN404/widget/public-event/v1|')
     .update(install.tenantId+'|'+install.storeId+'|'+install.widgetId+'|')
     .update(session+'|'+eventId).digest('hex');
   const claim=await ports.claimEvent({
     tenantId:install.tenantId,storeId:install.storeId,
     widgetId:install.widgetId,eventDigest:digest
   });
   if(claim?.source!=='ATOMIC_PRIVATE_EVENT_LEDGER'||
      claim?.claimed!==true||!compatibleScope(claim,install)||
      claim.eventDigest!==digest)
     reject('WIDGET_EVENT_REPLAY_OR_LEDGER_UNAVAILABLE');
   const [intent,catalog,config]=await Promise.all([
     ports.readSalesIntent({tenantId:install.tenantId,storeId:install.storeId,
       widgetId:install.widgetId,publicOnly:true,previewOnly:true,
       ...(message===undefined?{}:{message:message.trim()})}),
     ports.readPublicCatalog({tenantId:install.tenantId,storeId:install.storeId,
       widgetId:install.widgetId,publicOnly:true}),
     ports.readReviewedTheme({tenantId:install.tenantId,storeId:install.storeId,
       widgetId:install.widgetId})
   ]);
   // All future private order reads, quote writes or provider sends are
   // forbidden.  This integration can preview PUBLIC product/Knowledge only.
   if(!ALLOWED_TYPES.has(intent?.type)||intent?.dispatch_authorized!==false)
     reject('WIDGET_PRIVATE_OR_WRITE_INTENT_DENIED');
   // Even reviewed UI branding can contain a real shop's public phone/address;
   // reject a staff-reviewed theme fetched from the WRONG store.
   if(config?.tenantId!==install.tenantId||
      config?.storeId!==install.storeId||config?.widgetId!==install.widgetId)
     reject('WIDGET_THEME_CROSS_STORE_READBACK');
   // Price and stock must share a bounded versioned catalog snapshot.
   // Existing V14.3 core still validates row scope and integer VND.
   if(['PRODUCT_CARD','PRODUCT_LIST'].includes(intent.type)&&
      (!Number.isSafeInteger(catalog?.priceVersion)||catalog.priceVersion<1||
       !Number.isSafeInteger(catalog?.stockVersion)||catalog.stockVersion<1||
       !Number.isSafeInteger(catalog?.expiresAt)||catalog.expiresAt<=now()))
     reject('WIDGET_PRICE_STOCK_SNAPSHOT_STALE_OR_UNVERSIONED');
   const verifiedTheme=theme(config);
   const binding={
     source:'SERVER_VERIFIED_CHANNEL_SCOPE',verified:true,serverDerived:true,
     tenantId:install.tenantId,storeId:install.storeId,channel:'WEB_WIDGET',
     subscriptionActive:true,shopActive:true,allowedImageOrigins:[]
   };
   const result=widgetPreview({binding,intent,catalog,reviewedTheme:verifiedTheme});
   if(result.dispatchAuthorized!==false||result.providerSends!==0||
      result.ordersWritten!==0||result.productionReady!==false)
     reject('WIDGET_RENDERER_UNSAFE_RESULT');
   return Object.freeze({
     mode:'OFFLINE_SYNTHETIC_QA',status:'PREVIEW_ONLY',
     eventAcceptedInSyntheticLedger:true,providerSends:0,
     orderWrites:0,modelCalls:0,publicPreview:result.presentation,
     privateOrderAccess:false,canRelease:false
   });
 }
 return Object.freeze({
   issueSession,preview,
   releaseState:Object.freeze({
     mode:'OFFLINE_SYNTHETIC_QA',hostedDomainProofVerified:false,
     realDurableEventLedgerVerified:false,realRateLimitVerified:false,
     hostedStoreRlsVerified:false,isolatedRestoreVerified:false,
     providerSendEnabled:false,productionReady:false
   })
 });
}
module.exports={createOfflineWidgetPreview,PORTS,ALLOWED_TYPES};
