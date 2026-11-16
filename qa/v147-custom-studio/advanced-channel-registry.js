'use strict';
/* V15.2 ADV.2 — documentation-scoped capability registry + safe fallback compiler.
 * No provider calls. Account capabilities are informational NOT verified entitlements.
 * Input model payload remains strict {intent}, business facts still come from V14.7 fixtures.
 */
(function(factory){
 const api=factory();
 if(typeof module!=='undefined' && module.exports)module.exports=api;
 if(typeof window!=='undefined')Object.defineProperty(window,'T404ChannelRegistry',{value:api,writable:false});
})(function(){
 const CHANNELS=Object.freeze(['MESSENGER','ZALO_BOT','ZALO_OA','WEB_WIDGET']);
 const COMPONENTS=Object.freeze(['TEXT','RICH_TEXT','IMAGE','PRODUCT_CARD','CAROUSEL','QUICK_REPLY',
  'ACTION_BUTTON','PERSISTENT_MENU','PUBLIC_WEBVIEW','OA_CTA','OA_MENU','ZBS_TEMPLATE','VERIFIED_LINK']);
 const STATES=Object.freeze(['DOCUMENTED','ACCOUNT_GATED','LOCAL_PREVIEW','UNVERIFIED','UNSUPPORTED','APPROVAL_SPEND']);
 const DOCS=Object.freeze({
  MESSENGER:'https://developers.facebook.com/docs/messenger-platform/getting-started/quick-start',
  ZALO_BOT:'https://docs.zaloplatforms.com/docs/BOT/apis/sendMessage',
  ZALO_BOT_PHOTO:'https://docs.zaloplatforms.com/docs/BOT/apis/sendPhoto',
  ZALO_OA:'https://oa.zalo.me/home/function/interaction'
 });
 const D='DOCUMENTED',A='ACCOUNT_GATED',L='LOCAL_PREVIEW',U='UNVERIFIED',X='UNSUPPORTED',P='APPROVAL_SPEND';
 const TABLE=Object.freeze({
  MESSENGER:Object.freeze([D,X,A,A,A,A,A,A,A,X,X,X,A]),
  ZALO_BOT:Object.freeze([D,D,A,X,U,U,U,X,X,X,X,X,A]),
  ZALO_OA:Object.freeze([A,U,A,U,U,U,A,X,A,A,A,P,A]),
  WEB_WIDGET:Object.freeze([L,L,L,L,L,L,L,L,L,X,X,X,L])
 });
 const FBACK=Object.freeze({
  TEXT:'TEXT',RICH_TEXT:'TEXT',IMAGE:'TEXT',PRODUCT_CARD:'TEXT',CAROUSEL:'TEXT',
  QUICK_REPLY:'TEXT',ACTION_BUTTON:'TEXT',PERSISTENT_MENU:'TEXT',PUBLIC_WEBVIEW:'TEXT',
  OA_CTA:'TEXT',OA_MENU:'TEXT',ZBS_TEMPLATE:'TEXT',VERIFIED_LINK:'TEXT'
 });
 const REVIEW=Object.freeze({
  TEXT:'VERIFY_ACCOUNT_BEFORE_SEND',
  RICH_TEXT:'VERIFY_PROVIDER_STYLES',
  IMAGE:'VERIFIED_MEDIA_ASSET_REQUIRED',
  PRODUCT_CARD:'VERIFIED_CATALOG_AND_ACCOUNT_REQUIRED',
  CAROUSEL:'VERIFIED_CATALOG_AND_ACCOUNT_REQUIRED',
  QUICK_REPLY:'SIGNED_POSTBACK_REQUIRED',
  ACTION_BUTTON:'SIGNED_POSTBACK_REQUIRED',
  PERSISTENT_MENU:'PAGE_OR_OA_ADMIN_APPROVAL',
  PUBLIC_WEBVIEW:'VERIFIED_DOMAIN_AND_SESSION',
  OA_CTA:'OA_ACCOUNT_AND_MESSAGE_ELIGIBILITY',
  OA_MENU:'OA_ACCOUNT_ADMIN_APPROVAL',
  ZBS_TEMPLATE:'APPROVED_TEMPLATE_ELIGIBILITY_BUDGET',
  VERIFIED_LINK:'TRUSTED_HTTPS_DOMAIN_ALLOWLIST'
 });
 function deny(s){throw Error(s)}
 function assertChannel(channel){if(!CHANNELS.includes(channel))deny('UNKNOWN_CHANNEL')}
 function assertComponent(component){if(!COMPONENTS.includes(component))deny('UNKNOWN_COMPONENT')}
 function entry(channel,component){
  assertChannel(channel);assertComponent(component);
  const state=TABLE[channel][COMPONENTS.indexOf(component)];
  const providerDoc=channel==='WEB_WIDGET'?null:
   channel==='ZALO_BOT'&&component==='IMAGE'?DOCS.ZALO_BOT_PHOTO:DOCS[channel];
  const requiresOwnerApproval=state===A||state===P||state===U;
  return Object.freeze({channel,component,state,providerDoc,
   fallback:FBACK[component],review:REVIEW[component],
   requiresOwnerApproval,requiresProviderVerification:channel!=='WEB_WIDGET',
   costsOrApproval:state===P,canSend:false,entitlementVerified:false,
   version:'v15.2-adv2-docs-20261116',previewOnly:true});
 }
 function list(channel){assertChannel(channel);return COMPONENTS.map(x=>entry(channel,x))}
 function decision(channel,component){
  const m=entry(channel,component),isPreviewable=[D,A,L].includes(m.state);
  return Object.freeze({
   ...m,preview:isPreviewable?'STRUCTURED_NO_SEND_PREVIEW':'TEXT_FALLBACK_PREVIEW',
   fallbackRequired:!isPreviewable,
   reason:m.state===P?'PAID_TEMPLATE_APPROVAL_REQUIRED':
    m.state===U?'UNVERIFIED_NATIVE_COMPONENT':
    m.state===X?'UNSUPPORTED_BY_CHANNEL':
    m.state===A?'ACCOUNT_AND_OWNER_PERMISSION_UNVERIFIED':
    m.state===L?'OWNED_WIDGET_PREVIEW_ONLY':'DOCUMENTED_NOT_ACCOUNT_CERTIFIED',
   nativeSendAuthorized:false,orderActionAuthorized:false
  });
 }
 function selectComponent(render,channel){
  if(!render||typeof render!=='object'||Array.isArray(render))deny('RENDER_CONTRACT_REQUIRED');
  assertChannel(channel);
  if(render.type==='GENERIC_TEMPLATE_PREVIEW')return 'PRODUCT_CARD';
  if(render.type==='QUICK_REPLIES_PREVIEW')return 'QUICK_REPLY';
  if(render.type==='TEXT_STYLES_PREVIEW')return render.image?'IMAGE':'RICH_TEXT';
  if(render.type==='OA_TEXT_FALLBACK_PREVIEW')return 'TEXT';
  if(render.type==='WEB_PRODUCT_CARD_PREVIEW')return 'PRODUCT_CARD';
  if(render.type==='WEB_RICH_TEXT_PREVIEW')return 'RICH_TEXT';
  if(render.type==='TEXT')return 'TEXT';
  deny('UNRECOGNIZED_RENDER_TYPE');
 }
 function compose({studio,studioApi,policy,shop,channel,proposal}={}){
  if(!policy||typeof policy.compile!=='function')deny('PRESENTATION_POLICY_REQUIRED');
  const base=policy.compile({studio,api:studioApi,shop,channel,proposal});
  if(base.channel!==channel||base.shop!==shop||base.providerSends!==0||
   base.orderWrites!==0||base.canPublish!==false)deny('UNTRUSTED_PRESENTATION_CONTRACT');
  const preferred=selectComponent(base.render,channel);
  const meta=decision(channel,preferred);
  const originalText=base.render.text;
  if(typeof originalText!=='string'||!originalText||originalText.length>2000)deny('BAD_TEXT_FALLBACK');
  const notes=base.warnings.slice();
  if(meta.fallbackRequired)notes.push('Thành phần '+preferred+' chưa được chứng minh cho '+channel+'. Chuyển sang TEXT.');
  if(preferred==='IMAGE'&&!base.render.image?.verifiedImageAsset){
   notes.push('Chưa có ảnh được duyệt; chỉ hiển thị văn bản thay thế.');
  }
  const imageMissing=preferred==='IMAGE'&&!base.render.image?.verifiedImageAsset;
  const finalComponent=meta.fallbackRequired||imageMissing?'TEXT':preferred;
  const output={
   contract:'T404_ADV2_CAPABILITY_COMPOSE_1',
   registryVersion:meta.version,source:'SYNTHETIC_QA_ONLY',channel,shop,
   tenantId:base.tenantId,storeId:base.storeId,knowledgeVersion:base.knowledgeVersion,
   intent:base.plan.intent,
   preferredComponent:preferred,renderedComponent:finalComponent,
   capabilityDecision:meta,reason:finalComponent==='TEXT'&&preferred!=='TEXT'?
     imageMissing?'VERIFIED_MEDIA_MISSING':meta.reason:meta.reason,
   fallbackText:originalText,render:base.render,
   notes,canPublish:false,canSend:false,providerSends:0,orderWrites:0,customerDataReads:0,
   signedActionsIssued:0,accountPermissionsVerified:false,ownerConsentVerified:false
  };
  // A preview can illustrate a button or card. It never turns that illustration into an active action.
  if(output.render.buttons?.some(a=>a.interactive||!a.requiresSignedServerAction)||
   output.render.cards?.some(c=>c.buttons?.some(a=>a.interactive||!a.requiresSignedServerAction)))
   deny('UNSIGNED_ACTION_NOT_ALLOWED');
  return JSON.parse(JSON.stringify(output));
 }
 return Object.freeze({CHANNELS,COMPONENTS,STATES,DOCS,entry,list,decision,selectComponent,compose});
});