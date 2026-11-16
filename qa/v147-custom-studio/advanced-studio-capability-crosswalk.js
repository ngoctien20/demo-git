'use strict';
/**
 * V15.2 ADV.4 — Canonical ADV.2 (#138) + 13-component UX vocabulary (#144).
 * Reviewed CROSSWALK, not a merge of independent registries. Conservative
 * fallback (TEXT) for any ambiguity. Never grants provider capabilities.
 */
(function(factory){
 const runtime=typeof module!=='undefined'&&module.exports
   ?factory(require('./advanced-channel-registry.js')):factory(window.T404Adv2Registry);
 if(typeof module!=='undefined'&&module.exports)module.exports=runtime;
 if(typeof window!=='undefined')Object.defineProperty(window,'T404Adv4Capabilities',{value:runtime,writable:false});
})(function(canonical){
 if(!canonical||typeof canonical.resolve!=='function')throw Error('ADV2_CANONICAL_REGISTRY_REQUIRED');
 const CHANNELS=Object.freeze(['MESSENGER','ZALO_BOT','ZALO_OA','WEB_WIDGET']);
 const FEATURES=Object.freeze(['TEXT','RICH_TEXT','IMAGE','PRODUCT_CARD','CAROUSEL','QUICK_REPLY',
  'ACTION_BUTTON','PERSISTENT_MENU','PUBLIC_WEBVIEW','OA_CTA','OA_MENU','ZBS_TEMPLATE','VERIFIED_LINK']);
 // Source: PR #144 descriptive matrix. Verification never implied.
 const D='DOCUMENTED',A='ACCOUNT_GATED',L='LOCAL_PREVIEW',U='UNVERIFIED',X='UNSUPPORTED',P='APPROVAL_SPEND';
 const MATRIX=Object.freeze({
  MESSENGER:Object.freeze([D,X,A,A,A,A,A,A,A,X,X,X,A]),
  ZALO_BOT:Object.freeze([D,D,A,X,U,U,U,X,X,X,X,X,A]),
  ZALO_OA:Object.freeze([A,U,A,U,U,U,A,X,A,A,A,P,A]),
  WEB_WIDGET:Object.freeze([L,L,L,L,L,L,L,L,L,X,X,X,L])
 });
 const MAP=Object.freeze({
  TEXT:Object.freeze({all:'TEXT'}),
  RICH_TEXT:Object.freeze({all:'RICH_TEXT'}),
  IMAGE:Object.freeze({MESSENGER:'IMAGE',ZALO_BOT:'PHOTO_CAPTION',ZALO_OA:'IMAGE',WEB_WIDGET:'IMAGE'}),
  PRODUCT_CARD:Object.freeze({all:'PRODUCT_CARD'}),
  CAROUSEL:Object.freeze({MESSENGER:'PRODUCT_CAROUSEL',WEB_WIDGET:'WIDGET_CAROUSEL'}),
  QUICK_REPLY:Object.freeze({MESSENGER:'QUICK_REPLIES'}),
  ACTION_BUTTON:Object.freeze({MESSENGER:'BUTTON_TEMPLATE'}),
  PERSISTENT_MENU:Object.freeze({MESSENGER:'PERSISTENT_MENU'}),
  PUBLIC_WEBVIEW:Object.freeze({MESSENGER:'WEBVIEW_LINK'}),
  OA_CTA:Object.freeze({ZALO_OA:'OA_CTA'}),
  OA_MENU:Object.freeze({ZALO_OA:'OA_MENU'}),
  ZBS_TEMPLATE:Object.freeze({ZALO_OA:'ZBS_TEMPLATE'})
  // VERIFIED_LINK has no 1:1 verified target/allowlist in canonical registry:
  // deliberately unmapped. No URL is ever approved by this layer.
 });
 function row({channel,component,tenant_id,store_id}={}){
  if(!CHANNELS.includes(channel))throw Error('ADV4_UNKNOWN_CHANNEL');
  const i=FEATURES.indexOf(component);
  if(i===-1)throw Error('ADV4_UNKNOWN_FEATURE');
  const sourceState=MATRIX[channel][i];
  const canonicalComponent=MAP[component]?.[channel]||MAP[component]?.all||null;
  const result=canonicalComponent?canonical.resolve({channel,componentId:canonicalComponent,tenant_id,store_id}):null;
  const possible=['DOCUMENTED','ACCOUNT_GATED','LOCAL_PREVIEW'].includes(sourceState)&&
   result?.status==='PREVIEW_ONLY';
  const reason=sourceState==='APPROVAL_SPEND'?'PAID_TEMPLATE_APPROVAL_LOCKED':
   !canonicalComponent?'MISSING_EXACT_CANONICAL_COMPONENT':
   result?.status==='DENY'?'STORE_SCOPE_MISSING':
   !possible?'CHANNEL_SUPPORT_OR_APPROVAL_UNVERIFIED':
   'SYNTHETIC_PREVIEW_ONLY_ACCOUNT_NOT_CERTIFIED';
  return Object.freeze({component,channel,sourceState,canonicalComponent,
   canonicalStatus:result?.status||'UNMAPPED',previewEligible:!!possible,
   presentation:possible?component:'TEXT',fallback:'TEXT',reason,
   documentation:result?.providerDocumentation||null,entitlementVerified:false,
   canSend:false,actionExecutable:false,paidTemplateAuthorized:false,
   signedBusinessActionAuthorized:false,hasVerifiedMedia:false});
 }
 function list(args={}){
  return Object.freeze(FEATURES.map(component=>row({...args,component})));
 }
 return Object.freeze({VERSION:'T404_ADV4_CANONICAL_CROSSWALK_1',CANONICAL_VERSION:canonical.VERSION,
  CHANNELS,FEATURES,MATRIX,MAP,row,list});
});
