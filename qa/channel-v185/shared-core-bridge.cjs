'use strict';
/**
 * TIEN404 V18.5 — WEBSITE WIDGET x EXISTING COMMERCE CORE ADAPTER.
 * SOURCE-ONLY / OFFLINE SYNTHETIC QA / NOT A HOSTED API / NO REAL MESSAGES.
 *
 * Builds on PR #94 / #97 source, not a second AI Sales Core:
 *  - V14.3 channel-core and WEB_WIDGET renderer
 *  - V14.4 protected installation, signed anon session, quota and replay
 *  - one injected server-only port to EXISTING n8n core iyfGUiEsZlNTBWOR
 *
 * The injected ports are ONLY synthetic test fixtures here. The marker
 * 'SERVER_VERIFIED' is not a substitute for a signed, independently verified
 * hosted receipt. No real Store/Order/Customer records may be connected.
 */
const {createOfflineWidgetPreview} = require('../channel-v144/secure-widget-preview.cjs');

const CORE_WORKFLOW_ID='iyfGUiEsZlNTBWOR';
const MODES=Object.freeze(['PLATFORM_CONSULTANT','MERCHANT_SANDBOX']);
const PLATFORM_TYPES=new Set(['GREETING','TEXT','PRODUCT_CARD','PRODUCT_LIST',
  'UNAVAILABLE_PRODUCT','KNOWLEDGE_ANSWER','ERROR_FALLBACK']);
const MERCHANT_TYPES=new Set(['GREETING','TEXT','PRODUCT_CARD','PRODUCT_LIST',
  'UNAVAILABLE_PRODUCT','SHOP_PAUSED','KNOWLEDGE_ANSWER','ERROR_FALLBACK']);

function deny(code){const e=new Error(code);e.code=code;throw e;}
function createOfflineSharedCoreWidget({
  qaMode='DENY', mode, ports,serverSecret,now=Date.now,
}={}){
  if(qaMode!=='OFFLINE_SYNTHETIC_QA'||!MODES.includes(mode)||
    !ports||typeof ports.invokeExistingCommerceCore!=='function'||
    !['loadRegistry','readDomainProof','consumeQuota','claimEvent',
      'readPublicCatalog','readReviewedTheme'].every(k=>typeof ports[k]==='function'))
    deny('V185_SHARED_CORE_ADMISSION_DENIED');

  const adapter=createOfflineWidgetPreview({
    mode:'OFFLINE_SYNTHETIC_QA',serverSecret,now,
    ports:{
      loadRegistry:ports.loadRegistry,
      readDomainProof:ports.readDomainProof,
      consumeQuota:ports.consumeQuota,
      claimEvent:ports.claimEvent,
      readPublicCatalog:ports.readPublicCatalog,
      readReviewedTheme:ports.readReviewedTheme,
      async readSalesIntent(scope){
        if(!scope||!scope.publicOnly||!scope.previewOnly||
          typeof scope.message!=='string'||!scope.message.trim()||
          scope.message.length>800)deny('V185_MESSAGE_NOT_VERIFIED');
        // Verified store binding comes from V14.4 private registry/session gates.
        // Browser-provided tenant/store fields are intentionally never accepted.
        const result=await ports.invokeExistingCommerceCore(Object.freeze({
          workflowId:CORE_WORKFLOW_ID, channel:'WEB_WIDGET', mode,
          tenantId:scope.tenantId,storeId:scope.storeId,
          widgetId:scope.widgetId,message:scope.message,
          readOnly:true,publicOnly:true,sandboxOnly:true,
          customerAuthenticated:false,privateOrderAccess:false,
          orderWritesAllowed:false,providerSendsAllowed:false
        }));
        if(!result||result.source!=='SYNTHETIC_CORE_READBACK'||result.verified!==true||
          result.workflowId!==CORE_WORKFLOW_ID||result.mode!==mode||
          result.tenantId!==scope.tenantId||result.storeId!==scope.storeId||
          result.widgetId!==scope.widgetId||result.dispatch_authorized!==false||
          result.orderWrites!==0||result.providerSends!==0||
          result.privateOrderAccess!==false)
          deny('V185_EXISTING_CORE_READBACK_REJECTED');
        const supported=mode==='PLATFORM_CONSULTANT'?PLATFORM_TYPES:MERCHANT_TYPES;
        if(!supported.has(result.type))deny('V185_MODE_INTENT_FORBIDDEN');
        // No intent received from the browser may become a trusted output;
        // build a deliberately narrow object from the verified, scoped port.
        return Object.freeze({
          source:'TRUSTED_SALES_CORE',verified:true,
          tenantId:scope.tenantId,storeId:scope.storeId,
          type:result.type,text:result.text,
          productIds:result.productIds,
          actions:result.actions,
          knowledge:result.knowledge,
          dispatch_authorized:false
        });
      }
    }
  });
  return Object.freeze({
    mode,coreWorkflowId:CORE_WORKFLOW_ID,
    async issueSession(input){
      const issued=await adapter.issueSession(input);
      if(!issued||issued.previewOnly!==true||issued.privateOrderAccess!==false||
        issued.providerSends!==0||issued.orderWrites!==0)
        deny('V185_SESSION_SOURCE_UNTRUSTED');
      return Object.freeze({...issued,mode});
    },
    async previewMessage({widgetId,origin,session,eventId,message,tenantId,storeId}={}){
      // Reject browser-declared scope, even when matching actual installation.
      if(tenantId!==undefined||storeId!==undefined)
        deny('V185_CLIENT_SCOPE_NOT_AUTHORITY');
      if(typeof message!=='string'||!message.trim()||message.length>800||
        /[\u0000-\u001f\u007f]/.test(message))
        deny('V185_MESSAGE_INVALID');
      const result=await adapter.preview({widgetId,origin,session,eventId,message});
      if(result.status!=='PREVIEW_ONLY'||result.canRelease!==false||
        result.providerSends!==0||result.orderWrites!==0||
        result.privateOrderAccess!==false)
        deny('V185_RELEASE_BOUNDARY_DENIED');
      return Object.freeze({
        ...result,
        mode,status:'PREVIEW_ONLY',channel:'WEB_WIDGET',
        // Only UI-safe presentation, not raw model, PSID, store key or JWT.
        coreReused:CORE_WORKFLOW_ID,
        guestOnly:true,privateOrderAccess:false,providerSends:0,orderWrites:0,
        noHostedGateway:true,canRelease:false
      });
    },
    releaseState:Object.freeze({
      ...adapter.releaseState,mode,coreWorkflowId:CORE_WORKFLOW_ID,
      liveN8nCoreInvoked:false,hostedVerifiedInstallation:false,
      hostedSignedSessionVerified:false,realSalesConversationTested:false,
      realOrderAccessAuthorized:false,productionReady:false
    })
  });
}
module.exports={createOfflineSharedCoreWidget,CORE_WORKFLOW_ID,MODES};
