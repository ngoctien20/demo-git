'use strict';
/**
 * TIEN404 AI V14.3 — unified channel response contract, SOURCE-ONLY / NO SEND.
 * Validated SERVER inputs only: model-supplied scopes, catalog facts, staff
 * authorization, URLs, prices or send permissions cannot be trusted.
 * No I/O, credentials, provider calls, Orders mutation, or browser dependencies.
 */
const CHANNELS=Object.freeze(['MESSENGER','WEB_WIDGET','ZALO_BOT']);
const TYPES=Object.freeze(['TEXT','GREETING','PRODUCT_CARD','PRODUCT_LIST',
 'PRODUCT_VARIANTS','CHOICE_MENU','ORDER_REQUEST_SUMMARY',
 'ORDER_CONFIRMATION_REQUIRED','KNOWLEDGE_ANSWER','UNAVAILABLE_PRODUCT',
 'SHOP_PAUSED','STAFF_HANDOFF','IMAGE_RESULT','ERROR_FALLBACK']);
const ACTIONS=Object.freeze(['PRODUCT_VIEW','PRODUCT_PRICE_CHECK','PRODUCT_VARIANT_SELECT',
 'BROWSE_CATALOG','ASK_STAFF','ORDER_REQUEST_START','RETURN_TO_AI']);
const code=/^[a-z0-9_-]{2,90}$/i;
const fail=c=>{const x=new Error(c);x.code=c;throw x};
function text(s,n=1000){if(typeof s!=='string'||!s.trim()||s.length>n||/[\u0000-\u001f\u007f]/.test(s))fail('TEXT_INVALID');return s.trim()}
function trusted(binding){
 if(!binding||binding.source!=='SERVER_VERIFIED_CHANNEL_SCOPE'||binding.verified!==true||
  binding.serverDerived!==true||!code.test(binding.tenantId||'')||
  !code.test(binding.storeId||'')||!CHANNELS.includes(binding.channel)||
  binding.subscriptionActive!==true||binding.shopActive!==true)
  fail('CHANNEL_SCOPE_UNVERIFIED_OR_INACTIVE');
 return binding;
}
function checkedUrl(raw,origins){
 if(raw===null||raw===undefined)return null;
 if(typeof raw!=='string'||!Array.isArray(origins)||origins.length<1)fail('IMAGE_ORIGIN_NOT_TRUSTED');
 let url;try{url=new URL(raw)}catch{fail('IMAGE_URL_INVALID')}
 if(url.protocol!=='https:'||url.username||url.password||url.hash||
  !origins.includes(url.origin)||url.searchParams.has('token')||
  url.searchParams.has('access_token')||url.searchParams.has('psid')||
  url.searchParams.has('tenant_id')||url.searchParams.has('store_id'))
  fail('IMAGE_URL_NOT_ALLOWED');
 return url.toString();
}
function productsFromReadback(binding,snapshot,ids){
 if(!snapshot||snapshot.source!=='TRUSTED_CATALOG_READBACK'||snapshot.verified!==true||
   snapshot.tenantId!==binding.tenantId||snapshot.storeId!==binding.storeId||
   !Number.isSafeInteger(snapshot.revision)||snapshot.revision<1||
   !Array.isArray(snapshot.products)||snapshot.products.length>100)
   fail('CATALOG_READBACK_UNVERIFIED');
 if(!Array.isArray(ids)||ids.length<1||ids.length>10||ids.some(x=>!code.test(x||''))||
    new Set(ids).size!==ids.length)fail('PRODUCT_SELECTION_INVALID');
 const map=new Map();
 for(const p of snapshot.products){
  if(!p||p.source!=='SERVER_VERIFIED_SHOP_CATALOG'||p.verified!==true||
    p.tenantId!==binding.tenantId||p.storeId!==binding.storeId||
    !code.test(p.itemId||'')||map.has(p.itemId)||!Number.isSafeInteger(p.priceVnd)||
    p.priceVnd<0||!Number.isSafeInteger(p.stock)||p.stock<0)
    fail('CATALOG_ROW_SCOPE_OR_MONEY_INVALID');
  map.set(p.itemId,p);
 }
 return ids.map(id=>{
  const p=map.get(id);if(!p)fail('PRODUCT_NOT_FOUND_IN_STORE');
  return Object.freeze({itemId:p.itemId,sku:text(p.sku,80),name:text(p.name,80),
    priceVnd:p.priceVnd,stock:p.stock,
    imageUrl:checkedUrl(p.imageUrl??null,binding.allowedImageOrigins)});
 });
}
function checkActions(actions){
 if(actions==null)return [];
 if(!Array.isArray(actions)||actions.length>8)return fail('ACTIONS_INVALID');
 const keys=new Set();
 return actions.map(a=>{
  if(!a||!ACTIONS.includes(a.id)||keys.has(a.id)||a.itemId!=null&&!code.test(a.itemId))
   fail('ACTION_NOT_ALLOWED');
  keys.add(a.id);
  if(a.id==='ORDER_REQUEST_START'&&a.confirmed===true)fail('ORDER_ACTION_CANNOT_CONFIRM');
  return Object.freeze({id:a.id,label:text(a.label,40),itemId:a.itemId??null,
   requiresConfirmation:a.id==='ORDER_REQUEST_START'});
 });
}
function build({binding,intent,catalog=null}={}){
 const b=trusted(binding);
 if(!intent||intent.source!=='TRUSTED_SALES_CORE'||!TYPES.includes(intent.type)||
   intent.verified!==true||intent.tenantId!==b.tenantId||
   intent.storeId!==b.storeId||intent.dispatch_authorized!==false)
   fail('RESPONSE_INTENT_UNTRUSTED');
 const requiresProducts=['PRODUCT_CARD','PRODUCT_LIST','PRODUCT_VARIANTS','IMAGE_RESULT'].includes(intent.type);
 const list=requiresProducts?productsFromReadback(b,catalog,intent.productIds):[];
 const actions=checkActions(intent.actions);
 if(requiresProducts&&actions.some(a=>a.itemId&&!list.some(p=>p.itemId===a.itemId)))
   fail('ACTION_PRODUCT_NOT_SELECTED');
 if(intent.type==='KNOWLEDGE_ANSWER'&&
   (!intent.knowledge||intent.knowledge.source!=='TRUSTED_PUBLISHED_KNOWLEDGE'||
   intent.knowledge.storeId!==b.storeId||intent.knowledge.tenantId!==b.tenantId||
   intent.knowledge.releaseState!=='PUBLISHED'||intent.knowledge.visibility!=='PUBLIC'||
   intent.knowledge.merchantApproved!==true))
   fail('KNOWLEDGE_NOT_PUBLISHED');
 const copy=Object.freeze({contractVersion:'14.3',channel:b.channel,type:intent.type,
   // Keep scoped internal IDs only in the server-side result; never render as authorization.
   internalScope:Object.freeze({tenantId:b.tenantId,storeId:b.storeId}),
   text:text(intent.text,1000),products:Object.freeze(list),
   actions:Object.freeze(actions),
   previewOnly:true,hostedReady:false,providerSends:0,orderWrites:0,outboxWrites:0,
   dispatchAuthorized:false,requiresServerPolicy:true});
 return copy;
}
function fallback(response,channel=response?.channel){
 if(!response||response.previewOnly!==true||response.dispatchAuthorized!==false||
   !CHANNELS.includes(channel))fail('RENDER_INPUT_UNTRUSTED');
 const items=response.products.map(p=>p.name+' (SKU '+p.sku+'): '+
   new Intl.NumberFormat('vi-VN').format(p.priceVnd)+'đ'+(p.stock>0?' — còn hàng':' — hết hàng'));
 return Object.freeze({channel,type:'TEXT',text:[response.text,...items].join('\n').slice(0,2000),
   previewOnly:true,providerSends:0,dispatchAuthorized:false});
}
module.exports={CHANNELS,TYPES,ACTIONS,build,fallback,checkedUrl};
