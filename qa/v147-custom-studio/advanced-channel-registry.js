'use strict';
/* Browser + Node entrypoint, no provider I/O. */
(function(factory){
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(typeof window!=='undefined')Object.defineProperty(window,'T404ChannelRegistry',{value:api,writable:false});
})(function(){
/* V15.2-ADV.2: documentation-backed, NO-SEND component registry.
 * Capability metadata is informational, never a provider entitlement.
 * Must be consumed by a server-authorized renderer before any real send.
 */
const VERSION = 'T404_ADV_CHANNEL_REGISTRY_1.0';
const SCOPE = 'TENANT_STORE_CHANNEL';
const CHANNELS = Object.freeze(['MESSENGER','ZALO_BOT','ZALO_OA','WEB_WIDGET']);
const DOC = Object.freeze({
  MESSENGER: 'https://developers.facebook.com/docs/messenger-platform/send-messages/templates',
  ZALO_BOT: 'https://bot.zapps.me/docs/apis/sendMessage/',
  ZALO_PHOTO: 'https://bot.zapps.me/docs/apis/sendPhoto/',
  ZALO_OA: 'https://oa.zaloapp.com/home/function/interaction',
  WEB_WIDGET: 'LOCAL_WIDGET_CONTRACT_V14_7'
});
const defs = [
  ['TEXT',['MESSENGER','ZALO_BOT','ZALO_OA','WEB_WIDGET'],'none','TEXT'],
  ['PRODUCT_CARD',['MESSENGER','WEB_WIDGET'],'provider_grant','TEXT'],
  ['PRODUCT_CAROUSEL',['MESSENGER','WEB_WIDGET'],'provider_grant','NUMBERED_TEXT'],
  ['QUICK_REPLIES',['MESSENGER'],'provider_grant','NUMBERED_TEXT'],
  ['BUTTON_TEMPLATE',['MESSENGER'],'provider_grant','NUMBERED_TEXT'],
  ['PERSISTENT_MENU',['MESSENGER'],'page_admin_grant','NUMBERED_TEXT'],
  ['WEBVIEW_LINK',['MESSENGER'],'verified_url_and_page_grant','TEXT'],
  ['IMAGE',['MESSENGER','ZALO_OA','WEB_WIDGET'],'verified_store_media','TEXT'],
  ['SIGNED_POSTBACK',['MESSENGER','WEB_WIDGET'],'signed_backend_action','TEXT'],
  ['RICH_TEXT',['ZALO_BOT','WEB_WIDGET'],'documented_styles','TEXT'],
  ['PHOTO_CAPTION',['ZALO_BOT'],'verified_store_media','TEXT'],
  ['NUMBERED_MENU',['ZALO_BOT','ZALO_OA','WEB_WIDGET'],'none','TEXT'],
  ['OA_CTA',['ZALO_OA'],'account_permission_and_message_eligibility','NUMBERED_TEXT'],
  ['OA_MENU',['ZALO_OA'],'oa_admin_grant','NUMBERED_TEXT'],
  ['OA_INTERACTIVE_TEMPLATE',['ZALO_OA'],'approved_template_and_recipient','TEXT'],
  ['ZBS_TEMPLATE',['ZALO_OA'],'approved_template_recipient_and_spend','TEXT'],
  ['WIDGET_DROPDOWN',['WEB_WIDGET'],'local_accessible_renderer','TEXT'],
  ['WIDGET_GALLERY',['WEB_WIDGET'],'verified_store_media','TEXT'],
  ['WIDGET_COMPARISON',['WEB_WIDGET'],'trusted_store_catalog','TEXT'],
  ['WIDGET_CAROUSEL',['WEB_WIDGET'],'trusted_store_catalog','TEXT']
];
const DOCUMENTED_BOT_TYPES = new Set(['TEXT','RICH_TEXT','PHOTO_CAPTION']);
const ACTION_TYPES = new Set(['SIGNED_POSTBACK','QUICK_REPLIES','BUTTON_TEMPLATE','OA_CTA','OA_MENU','PERSISTENT_MENU','WEBVIEW_LINK','WIDGET_DROPDOWN']);
const MEDIA_TYPES = new Set(['IMAGE','PHOTO_CAPTION','WIDGET_GALLERY','WEBVIEW_LINK']);
function docsFor(channel,id){
  if(channel==='ZALO_BOT' && id==='PHOTO_CAPTION')return DOC.ZALO_PHOTO;
  return DOC[channel];
}
const REGISTRY = Object.freeze(defs.flatMap(([id,channels,requirement,fallback])=>channels.map(channel=>Object.freeze({
  componentId:id,componentType:id,channel,scope:SCOPE,version:VERSION,
  documentation:docsFor(channel,id),requiredCapability:requirement,
  requiredPermissions:requirement==='none'?[]:[requirement],
  contentLimits:Object.freeze({verified:false,maxItems:null,maxChars:null}),
  fallback,requiresSignedServerAction:ACTION_TYPES.has(id),
  requiresVerifiedMedia:MEDIA_TYPES.has(id),
  needsApproval:channel==='ZALO_OA'||(channel==='MESSENGER'&&requirement!=='none'),
  billingGate:id==='ZBS_TEMPLATE'?'OWNER_SPEND_APPROVAL_REQUIRED':'NO_SPEND_ASSUMED',
  qaStatus:'SOURCE_PREVIEW_ONLY',providerSendAuthorized:false
}))));
function resolve({channel,componentId,tenant_id,store_id}={}){
  if(typeof tenant_id!=='string'||!tenant_id.trim()||typeof store_id!=='string'||!store_id.trim()){
    return Object.freeze({status:'DENY',reason:'STORE_SCOPE_MISSING',type:'TEXT',sendable:false});
  }
  if(!CHANNELS.includes(channel)){
    return Object.freeze({status:'DENY',reason:'UNKNOWN_CHANNEL',type:'TEXT',sendable:false});
  }
  const item=REGISTRY.find(x=>x.channel===channel&&x.componentId===componentId);
  if(!item){
    return Object.freeze({status:'FALLBACK',reason:'UNSUPPORTED_CHANNEL_COMPONENT',type:'TEXT',sendable:false,tenant_id,store_id,channel});
  }
  if(item.billingGate==='OWNER_SPEND_APPROVAL_REQUIRED'){
    return Object.freeze({status:'FALLBACK',reason:'PAID_TEMPLATE_APPROVAL_LOCKED',type:'TEXT',sendable:false,tenant_id,store_id,channel});
  }
  // No account-level permissions, trusted media, or provider message eligibility proven here.
  // Semantic previews may be built offline, but never treated as authorization to send.
  return Object.freeze({status:'PREVIEW_ONLY',reason:'INDEPENDENT_PROVIDER_AND_OWNER_GATE_PENDING',type:componentId,
    fallback:item.fallback,needsApproval:item.needsApproval,requiresSignedServerAction:item.requiresSignedServerAction,
    requiresVerifiedMedia:item.requiresVerifiedMedia,providerDocumentation:item.documentation,
    storeScope:SCOPE,tenant_id,store_id,channel,sendable:false,actionExecutable:false});
}
function capabilities(channel){
  return Object.freeze(REGISTRY.filter(x=>x.channel===channel));
}
return Object.freeze({VERSION,CHANNELS,REGISTRY,resolve,capabilities,DOCUMENTED_BOT_TYPES});

});
