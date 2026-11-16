'use strict';
/* ADV4 — provider-adapter NO-SEND contracts, not actual Meta/Zalo API payloads.
 * Only expose vetted presentation metadata and inactive action "intent".
 */
(function(factory){
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(typeof window!=='undefined')Object.defineProperty(window,'T404Adv4AdapterContracts',{value:api,writable:false});
})(function(){
 const fail=s=>{throw Error(s)};
 const T={
  MESSENGER:'META_CONCEPT_PREVIEW',
  ZALO_BOT:'ZALO_BOT_CONCEPT_PREVIEW',
  ZALO_OA:'ZALO_OA_CONCEPT_PREVIEW',
  WEB_WIDGET:'WEBSITE_WIDGET_CONCEPT_PREVIEW'
 };
 const REGISTRY_ACTIONS=['VIEW_CATALOG','REQUEST_QUOTE','ASK_STAFF','VIEW_POLICY','ORDER_REQUEST_DRAFT',
  'TRACK_ORDER','OPEN_VERIFIED_LINK'];
 function build({studio,shop,channel,modelOutput}={}){
  if(!studio||typeof studio.preview!=='function'||!Object.hasOwn(T,channel))
   fail('ADV4_TRUSTED_CONTRACT_INPUT_REQUIRED');
  const p=studio.preview(shop,channel,modelOutput);
  if(p.channel!==channel||p.shop!==shop||p.providerSends!==0||p.hostedWrites!==0||
     p.canExecute!==false||p.canPublish!==false||p.senderEnabled!==false||
     p.providerPayload!==null||p.actionPreview?.active!==false||
     p.actionPreview?.requiresSignedServerAction!==true)
    fail('ADV4_UNSAFE_CONTRACT_SOURCE');
  if(!REGISTRY_ACTIONS.includes(p.actionPreview.id))fail('ADV4_UNSAFE_ACTION');
  if(typeof p.sourceText!=='string'||p.sourceText.length>2000)
   fail('ADV4_UNSAFE_TEXT');
  const nativeHints={
   MESSENGER:p.renderedComponent==='PRODUCT_CARD'?['GENERIC_TEMPLATE_ACCOUNT_GATED']:
     ['PLAIN_TEXT','QUICK_REPLIES_PERMISSION_GATED'],
   ZALO_BOT:p.renderedComponent==='RICH_TEXT'?['BOT_TEXT_STYLES_DOCUMENTED_NOT_ACCOUNT_VERIFIED']:
     ['PLAIN_TEXT_FALLBACK'],
   ZALO_OA:['OA_TEXT_FALLBACK','CTA_TEMPLATE_ACCOUNT_AND_SPEND_GATED'],
   WEB_WIDGET:p.renderedComponent==='PRODUCT_CARD'?['LOCAL_PRODUCT_CARD_PREVIEW']:
     ['LOCAL_SAFE_TEXT_PREVIEW']
  };
  return Object.freeze({
   contract:'T404_ADV4_SAFE_CHANNEL_ADAPTER_CONCEPT_V1',
   shop,tenantId:p.tenant_id,storeId:p.store_id,channel,
   presentationVersion:p.configRevision,baseBotVersion:p.baseBotVersion,
   mode:T[channel],semanticIntent:p.intent,
   preferredComponent:p.renderedComponent,
   content:{text:p.sourceText,mediaId:p.mediaRef==='NONE'?null:p.mediaRef,
     approvedMediaUrl:null,linkId:p.linkRef==='NONE'?null:p.linkRef,
     approvedLinkUrl:null},
   components:nativeHints[channel],fallback:'TEXT',
   action:{id:p.actionPreview.id,label:p.actionPreview.label,
     active:false,needsCurrentAuth:true,requiresSignedBackend:true,
     verifiedChannelBinding:false,customerOrOwnerConfirmed:false,
     nonceReceiptIssued:false},
   nativeProviderPayload:null,canSend:false,canExecute:false,
   canPublish:false,writeOrders:false,readCustomerOrders:false,
   providerPermissionsVerified:false,merchantConsentVerified:false,
   registryReleaseApproved:false,costApprovalVerified:false,
   noSendEvidence:{providerSends:0,hostedWrites:0,realAiCalls:0}
  });
 }
 function send(){fail('ADV4_ADAPTER_SEND_DISABLED')}
 function invoke(){fail('ADV4_ADAPTER_ACTION_DISABLED')}
 return Object.freeze({build,send,invoke});
});