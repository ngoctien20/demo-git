'use strict';
/**
 * TIEN404 V13.7: offline contracts for five documented Zalo Bot API methods.
 * All payloads are synthetic DRY RUN fixtures with no chat_id, Bot Token, URL endpoints,
 * HTTP transport, tenant lookup, Orders writes, notifications, credentials or live sends.
 * An approved server-side adapter must bind a verified recipient and real media asset.
 */
const API_DOC_ROOT='https://docs.zaloplatforms.com/docs/BOT/apis/';
const METHOD_SPECS=Object.freeze({
  getWebhookInfo:Object.freeze({category:'READ_ONLY',sideEffect:'NONE',requiresRecipient:false,
    document:API_DOC_ROOT+'getWebhookInfo',apiMethod:'getWebhookInfo'}),
  sendPhoto:Object.freeze({category:'OUTBOUND_MEDIA',sideEffect:'SEND',requiresRecipient:true,
    document:API_DOC_ROOT+'sendPhoto',apiMethod:'sendPhoto'}),
  sendChatAction:Object.freeze({category:'OUTBOUND_STATUS',sideEffect:'SEND',requiresRecipient:true,
    document:API_DOC_ROOT+'sendChatAction',apiMethod:'sendChatAction'}),
  sendSticker:Object.freeze({category:'OUTBOUND_MEDIA',sideEffect:'SEND',requiresRecipient:true,
    document:API_DOC_ROOT+'sendSticker',apiMethod:'sendSticker'}),
  sendVoice:Object.freeze({category:'OUTBOUND_MEDIA',sideEffect:'SEND',requiresRecipient:true,
    document:API_DOC_ROOT+'sendVoice',apiMethod:'sendVoice'})
});
const OFFLINE_ASSETS=Object.freeze({
  productImage:Object.freeze({kind:'photo',url:'https://media.qa.invalid/products/catalog-qa.jpg',
    provenance:'SYNTHETIC_NON_ROUTABLE_PLACEHOLDER',approved_for_send:false}),
  customerVoice:Object.freeze({kind:'voice',url:'https://media.qa.invalid/voice/hello-qa.aac',
    provenance:'SYNTHETIC_NON_ROUTABLE_PLACEHOLDER',approved_for_send:false}),
  stickerExample:Object.freeze({kind:'sticker',id:'0e078a2fb66a5f34067b',
    provenance:'OFFICIAL_DOCUMENTATION_SAMPLE_UNVERIFIED_FOR_ACCOUNT',approved_for_send:false})
});
function block(code){const e=new Error(code);e.code=code;throw e;}
const hasOwn=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
function checkExactKeys(obj,keys){
 if(!obj||typeof obj!=='object'||Array.isArray(obj))block('OPTIONS_INVALID');
 const actual=Object.keys(obj).sort();
 if(actual.length!==keys.length||actual.some((k,i)=>k!==keys.slice().sort()[i]))block('OPTIONS_NOT_ALLOWED');
}
function draft(api,options={}){
 if(!hasOwn(METHOD_SPECS,api))block('API_UNSUPPORTED');
 const meta=METHOD_SPECS[api];
 let body={};
 if(api==='getWebhookInfo'){
   checkExactKeys(options,[]);
 } else if(api==='sendPhoto'){
   checkExactKeys(options,['assetKey','caption']);
   if(options.assetKey!=='productImage')block('IMAGE_ASSET_NOT_ALLOWLISTED');
   if(typeof options.caption!=='string'||options.caption.length<1||options.caption.length>2000)
     block('CAPTION_LENGTH_INVALID');
   body={photo:OFFLINE_ASSETS.productImage.url,caption:options.caption};
 } else if(api==='sendChatAction'){
   checkExactKeys(options,['action']);
   if(options.action!=='typing')block('ACTION_UNSUPPORTED');
   body={action:'typing'};
 } else if(api==='sendSticker'){
   checkExactKeys(options,['assetKey']);
   if(options.assetKey!=='stickerExample')block('STICKER_SOURCE_UNVERIFIED');
   body={sticker:OFFLINE_ASSETS.stickerExample.id};
 } else if(api==='sendVoice'){
   checkExactKeys(options,['assetKey','chatType']);
   if(options.assetKey!=='customerVoice')block('VOICE_ASSET_NOT_ALLOWLISTED');
   if(options.chatType!=='private')block('VOICE_ONLY_1_TO_1');
   body={voice_url:OFFLINE_ASSETS.customerVoice.url};
 }
 return Object.freeze({
   api_method:api,
   request_method:'POST',
   document:meta.document,
   purpose:meta.category,
   api_side_effect:meta.sideEffect,
   requires_server_bound_recipient:meta.requiresRecipient,
   body:Object.freeze(body),
   dry_run:true,
   provider_call_allowed:false,
   provider_acceptance_verified:false,
   client_rendering_verified:false,
   no_live_asset:true,
   external_sends:0,
   orders_written:0,
   webhook_changes:0,
   source:'ZALO_BOT_CREATOR_OFFICIAL_API'
 });
}
function readOnlyWebhookResult(reply){
 if(!reply||typeof reply!=='object'||Array.isArray(reply))block('WEBHOOK_RESULT_INVALID');
 const res=reply.result;
 if(reply.ok!==true||!res||typeof res!=='object'||Array.isArray(res))block('WEBHOOK_RESULT_INVALID');
 const configured=typeof res.url==='string'&&res.url.length>0;
 return Object.freeze({
   method:'getWebhookInfo',
   provider_read_ok:true,
   configured,
   url_redacted:true,
   updated_at_valid:typeof res.updated_at==='number'&&Number.isSafeInteger(res.updated_at)&&res.updated_at>=0,
   // No URL, token, headers, query string, error details or user identity in output.
   readonly:true
 });
}
function sanitizeProviderResponse(api,reply){
 if(!hasOwn(METHOD_SPECS,api))block('API_UNSUPPORTED');
 if(api==='getWebhookInfo')return readOnlyWebhookResult(reply);
 if(!reply||typeof reply!=='object'||Array.isArray(reply))block('PROVIDER_RESULT_INVALID');
 const accepted=reply.ok===true;
 return Object.freeze({
   method:api,provider_accepted:accepted,
   provider_message_id_present:typeof reply.result?.message_id==='string'&&reply.result.message_id.length>0,
   client_rendering_verified:false,
   message_delivery_proven:false,
   // No provider message ID or recipient in telemetry.
   });
}
const draftGallery=()=>Object.freeze([
 draft('getWebhookInfo'),
 draft('sendPhoto',{assetKey:'productImage',caption:'TIEN404 · Ảnh sản phẩm thử nghiệm — không phải dữ liệu shop'}),
 draft('sendChatAction',{action:'typing'}),
 draft('sendSticker',{assetKey:'stickerExample'}),
 draft('sendVoice',{assetKey:'customerVoice',chatType:'private'})
]);
module.exports={METHOD_SPECS,OFFLINE_ASSETS,draft,draftGallery,
 readOnlyWebhookResult,sanitizeProviderResponse};
