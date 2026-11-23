'use strict';
/* V14.3: one Response Intent -> channel-specific PREVIEW. Reuses V13.6M.
 * NO Graph calls, NO Web Widget network, NO Orders DB writes.
 */
const messenger=require('../messenger-rich-v136m/adapter.cjs');
const {build,fallback}=require('./channel-core.cjs');
const fail=code=>{const e=new Error(code);e.code=code;throw e};
function messengerPreview({binding,intent,catalog,trustedMessenger,serverActionSecret,siteOrigin,now=Date.now}={}){
 const r=build({binding,intent,catalog});
 if(r.channel!=='MESSENGER')fail('MESSENGER_CHANNEL_REQUIRED');
 if(!trustedMessenger||trustedMessenger.source!=='SERVER_VERIFIED_MESSENGER_BINDING'||
    trustedMessenger.serverDerived!==true||trustedMessenger.verified!==true||
    trustedMessenger.tenantId!==r.internalScope.tenantId||
    trustedMessenger.storeId!==r.internalScope.storeId)
   fail('MESSENGER_BINDING_MISMATCH');
 let result;
 if(r.products.length&&['PRODUCT_CARD','PRODUCT_LIST','PRODUCT_VARIANTS','IMAGE_RESULT'].includes(r.type)){
  result=messenger.buildCarousel({
   trusted:trustedMessenger,secret:serverActionSecret,siteOrigin,now,
   products:r.products.map(p=>({source:'SERVER_VERIFIED_SHOP_CATALOG',verified:true,
    tenantId:trustedMessenger.tenantId,storeId:trustedMessenger.storeId,
    itemId:p.itemId,name:p.name,priceVnd:p.priceVnd,stock:p.stock,imageUrl:p.imageUrl}))
  });
 }else if(r.actions.length){
  const allowed={PRODUCT_VIEW:'VIEW_PRODUCT',ASK_STAFF:'ASK_STAFF',
   BROWSE_CATALOG:'BROWSE_CATALOG'};
  const choices=r.actions.filter(a=>allowed[a.id]).map(a=>({title:a.label,
   action:allowed[a.id],itemId:a.itemId??'NONE'}));
  result=choices.length?messenger.buildQuickReplies({
   trusted:trustedMessenger,secret:serverActionSecret,text:r.text,choices,now
  }):Object.freeze({previewOnly:true,sendEnabled:false,channel:'MESSENGER',
    body:{message:{text:fallback(r).text}}});
 }else result=Object.freeze({previewOnly:true,sendEnabled:false,channel:'MESSENGER',
    body:{message:{text:fallback(r).text}}});
 return Object.freeze({mode:'OFFLINE_STAGING_PREVIEW',channel:'MESSENGER',
   responseType:r.type,providerPayloadPreview:result,
   requiresMetaPermission:true,requiresPolicyWindow:true,
   requiresDurableReplay:true,providerSends:0,ordersWritten:0,
   dispatchAuthorized:false,productionReady:false});
}
function widgetPreview({binding,intent,catalog,reviewedTheme}={}){
 const r=build({binding,intent,catalog});
 if(r.channel!=='WEB_WIDGET')fail('WEB_WIDGET_CHANNEL_REQUIRED');
 if(!reviewedTheme||reviewedTheme.previewOnly!==true)fail('WIDGET_THEME_NOT_REVIEWED');
 const data=Object.freeze({
  type:r.type,text:r.text,
  products:r.products.map(p=>({sku:p.sku,name:p.name,priceVnd:p.priceVnd,
    stock:p.stock,imageUrl:p.imageUrl,itemId:p.itemId})),
  actions:r.actions,theme:reviewedTheme
 });
 return Object.freeze({mode:'OFFLINE_STAGING_PREVIEW',channel:'WEB_WIDGET',
   // Public presentation only: no tenant/store IDs, PSID, credentials, raw model payload.
   presentation:data,providerSends:0,ordersWritten:0,
   dispatchAuthorized:false,productionReady:false});
}
function zaloFallback({binding,intent,catalog}={}){
 const r=build({binding,intent,catalog});
 if(r.channel!=='ZALO_BOT')fail('ZALO_CHANNEL_REQUIRED');
 return Object.freeze({mode:'OFFLINE_STAGING_PREVIEW',channel:'ZALO_BOT',
  presentation:fallback(r),providerSends:0,ordersWritten:0,
  dispatchAuthorized:false,productionReady:false});
}
module.exports={messengerPreview,widgetPreview,zaloFallback};
