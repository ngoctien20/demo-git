'use strict';
// TIEN404 Messenger Rich UI Lab V13.6M — OFFLINE ONLY; NO GRAPH CALLS, NO TOKEN HANDLING.
// All tenant/store/page/PSID bindings and catalogue records MUST come from verified server ports.
const {createHmac,timingSafeEqual,randomBytes}=require('node:crypto');
const ACTIONS=new Set(['VIEW_PRODUCT','ASK_STAFF','TRACK_ORDER','BROWSE_CATALOG']);
const ID=/^[A-Za-z0-9_-]{1,64}$/;
const PAGE=/^\d{5,30}$/;
const MAX={CARDS:10,BUTTONS:3,QUICK:13,TITLE:80,SUBTITLE:80,BUTTON_TITLE:20,QUICK_TITLE:20,PAYLOAD:1000};
function reject(code){const e=new Error(code);e.code=code;throw e}
function label(value,max,code='INVALID_LABEL'){
 if(typeof value!=='string'||!value.trim()||Array.from(value.trim()).length>max||
    /[\u0000-\u001f\u007f]/.test(value))reject(code);
 return value.trim();
}
function identity(trusted){
 if(!trusted||trusted.source!=='SERVER_VERIFIED_MESSENGER_BINDING'||
    trusted.verified!==true||trusted.serverDerived!==true||
    !PAGE.test(trusted.pageId||'')||!PAGE.test(trusted.recipientPsid||'')||
    !ID.test(trusted.tenantId||'')||!ID.test(trusted.storeId||''))
    reject('SERVER_BINDING_REQUIRED');
 return trusted;
}
function allowedUrl(url,origins,kind){
 if(typeof url!=='string'||!Array.isArray(origins)||!origins.length)reject(kind+'_ALLOWLIST_REQUIRED');
 let u;try{u=new URL(url)}catch{reject(kind+'_URL_INVALID')}
 if(u.protocol!=='https:'||u.username||u.password||u.hash||
    !origins.includes(u.origin)||u.searchParams.has('access_token')||
    u.searchParams.has('psid')||u.searchParams.has('tenant_id')||
    u.searchParams.has('user_id'))reject(kind+'_URL_NOT_ALLOWED');
 return u.toString();
}
function sitePage(origin,allowedOrigins,slug,item){
 if(!ID.test(slug||''))reject('SLUG_INVALID');
 if(item!==undefined&&!ID.test(item||''))reject('ITEM_INVALID');
 const u=allowedUrl(origin,allowedOrigins,'WEBVIEW');
 if(new URL(u).pathname!=='/'||new URL(u).search)reject('WEBVIEW_ORIGIN_ONLY');
 return new URL('/shops/'+slug+(item?'/products/'+item:''),u).toString();
}
function secretCheck(key){
 if(typeof key!=='string'||Buffer.byteLength(key,'utf8')<32)reject('SERVER_ACTION_SECRET_REQUIRED');
 return key;
}
function sign({trusted,secret,action,itemId='NONE',expiresAt,nonce,now=Date.now}){
 const c=identity(trusted);
 if(!ACTIONS.has(action)||!ID.test(itemId))reject('ACTION_DENIED');
 const expires=expiresAt??(now()+15*60*1000);
 if(!Number.isSafeInteger(expires)||expires<=now()||expires>now()+60*60*1000)reject('ACTION_EXPIRY_INVALID');
 const rnd=nonce??randomBytes(12).toString('hex');
 if(!/^[a-f0-9]{24}$/.test(rnd))reject('ACTION_NONCE_INVALID');
 const body=Buffer.from(JSON.stringify({v:1,a:action,i:itemId,e:expires,n:rnd})).toString('base64url');
 const scope=[c.pageId,c.recipientPsid,c.tenantId,c.storeId].join(':');
 const mac=createHmac('sha256',secretCheck(secret)).update(body+'|'+scope).digest('hex');
 const signed='T404M1.'+body+'.'+mac;
 if(Buffer.byteLength(signed)>MAX.PAYLOAD)reject('ACTION_PAYLOAD_TOO_LONG');
 return signed;
}
function verifyAction({trusted,secret,payload,now=Date.now}){
 const c=identity(trusted),s=secretCheck(secret);
 if(typeof payload!=='string'||payload.length>MAX.PAYLOAD)reject('ACTION_PAYLOAD_INVALID');
 const parts=payload.split('.');
 if(parts.length!==3||parts[0]!=='T404M1'||!/^[A-Za-z0-9_-]{10,700}$/.test(parts[1])||
    !/^[a-f0-9]{64}$/.test(parts[2]))reject('ACTION_PAYLOAD_INVALID');
 const scope=[c.pageId,c.recipientPsid,c.tenantId,c.storeId].join(':');
 const sig=createHmac('sha256',s).update(parts[1]+'|'+scope).digest('hex');
 if(!timingSafeEqual(Buffer.from(sig,'hex'),Buffer.from(parts[2],'hex')))reject('ACTION_SIGNATURE_INVALID');
 let a;try{a=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'))}catch{reject('ACTION_PAYLOAD_INVALID')}
 if(a.v!==1||!ACTIONS.has(a.a)||!ID.test(a.i||'')||!/^[a-f0-9]{24}$/.test(a.n||'')||
    !Number.isSafeInteger(a.e)||a.e<=now()||a.e>now()+60*60*1000)reject('ACTION_EXPIRED_OR_UNTRUSTED');
 return Object.freeze({action:a.a,itemId:a.i,nonce:a.n,tenantId:c.tenantId,storeId:c.storeId,
  requiresServerSideReplayGuard:true,allowedMutation:false});
}
function envelope(trusted,message){
 const c=identity(trusted);
 return Object.freeze({previewOnly:true,sendEnabled:false,channel:'MESSENGER',
  endpointHint:'PAGE_ID/messages',body:{recipient:{id:c.recipientPsid},messaging_type:'RESPONSE',message}});
}
function product(trusted,p,siteOrigin,secret,now){
 const c=identity(trusted);
 if(!p||p.source!=='SERVER_VERIFIED_SHOP_CATALOG'||p.verified!==true||
    p.tenantId!==c.tenantId||p.storeId!==c.storeId||
    !ID.test(p.itemId||'')||typeof p.priceVnd!=='number'||
    !Number.isSafeInteger(p.priceVnd)||p.priceVnd<0||
    !Number.isSafeInteger(p.stock)||p.stock<0)reject('CATALOG_SCOPE_OR_MONEY_UNVERIFIED');
 const title=label(p.name,MAX.TITLE);
 const price=new Intl.NumberFormat('vi-VN').format(p.priceVnd)+' đ';
 const stock=p.stock>0?'Còn hàng':'Tạm hết hàng';
 const subtitle=label(price+' • '+stock,MAX.SUBTITLE);
 const image=p.imageUrl==null?null:allowedUrl(p.imageUrl,c.imageOrigins,'IMAGE');
 const browse={type:'postback',title:'Xem sản phẩm',
   payload:sign({trusted:c,secret,action:'VIEW_PRODUCT',itemId:p.itemId,now})};
 const help={type:'postback',title:'Gặp nhân viên',
   payload:sign({trusted:c,secret,action:'ASK_STAFF',itemId:'NONE',now})};
 const website={type:'web_url',title:'Xem trên web',
   url:sitePage(siteOrigin,c.webOrigins,c.shopSlug,p.itemId),webview_height_ratio:'full'};
 return {...(image?{image_url:image}:{}),title,subtitle,buttons:[browse,help,website]};
}
function buildCarousel({trusted,products,siteOrigin,secret,now=Date.now}={}){
 identity(trusted);secretCheck(secret);
 if(!Array.isArray(products)||products.length<1||products.length>MAX.CARDS)reject('CAROUSEL_COUNT_INVALID');
 const seen=new Set();
 const elements=products.map(p=>{
   if(seen.has(p?.itemId))reject('DUPLICATE_CATALOG_ITEM');
   seen.add(p?.itemId);
   return product(trusted,p,siteOrigin,secret,now);
 });
 return envelope(trusted,{attachment:{type:'template',payload:{template_type:'generic',elements}}});
}
function buildQuickReplies({trusted,text,choices,secret,now=Date.now}={}){
 identity(trusted);secretCheck(secret);
 if(!Array.isArray(choices)||choices.length<1||choices.length>MAX.QUICK)reject('QUICK_REPLY_COUNT_INVALID');
 const ids=new Set();
 const replies=choices.map(q=>{
   if(!q||!ACTIONS.has(q.action)||!ID.test(q.itemId||'NONE'))reject('QUICK_REPLY_ACTION_INVALID');
   if(ids.has(q.action+':'+(q.itemId||'NONE')))reject('DUPLICATE_QUICK_REPLY');
   ids.add(q.action+':'+(q.itemId||'NONE'));
   return {content_type:'text',title:label(q.title,MAX.QUICK_TITLE),
     payload:sign({trusted,secret,action:q.action,itemId:q.itemId||'NONE',now})};
 });
 return envelope(trusted,{text:label(text,1000),quick_replies:replies});
}
function buildPersistentMenu({trusted,siteOrigin}={}){
 const c=identity(trusted);
 const website=sitePage(siteOrigin,c.webOrigins,c.shopSlug);
 // Page-level menu cannot use PSID-bound tokens; only safe read-only menu events.
 return Object.freeze({previewOnly:true,profileMutationEnabled:false,requiresMetaReview:true,
   pageIdForInternalScopeOnly:c.pageId,
   body:{persistent_menu:[{locale:'default',composer_input_disabled:false,call_to_actions:[
     {type:'postback',title:'Xem sản phẩm',payload:'T404M1:MENU:BROWSE_CATALOG'},
     {type:'postback',title:'Gặp nhân viên',payload:'T404M1:MENU:ASK_STAFF'},
     {type:'web_url',title:'Mở cửa hàng',url:website,webview_height_ratio:'full'}
   ]}]}});
}
function prepareWebview({trusted,siteOrigin,itemId}={}){
 const c=identity(trusted);
 return Object.freeze({previewOnly:true,customerAuthRequiredForPrivateData:true,
   messengerExtensionsEnabled:false,viewType:'PUBLIC_SHOP_CATALOG',
   url:sitePage(siteOrigin,c.webOrigins,c.shopSlug,itemId)});
}
function parseClick({trusted,secret,metaSignatureVerified,event,now=Date.now}={}){
 const c=identity(trusted);
 if(metaSignatureVerified!==true||!event||event.pageId!==c.pageId||
    event.senderPsid!==c.recipientPsid)reject('WEBHOOK_IDENTITY_UNVERIFIED');
 const raw=event.postback?.payload??event.message?.quick_reply?.payload;
 if(typeof raw!=='string')reject('UNSUPPORTED_INTERACTION');
 if(raw==='T404M1:MENU:BROWSE_CATALOG'||raw==='T404M1:MENU:ASK_STAFF')
  return Object.freeze({action:raw.split(':')[2],itemId:'NONE',
   tenantId:c.tenantId,storeId:c.storeId,
   requiresServerSideReplayGuard:true,allowedMutation:false,source:'PERSISTENT_MENU'});
 return Object.freeze({...verifyAction({trusted:c,secret,payload:raw,now}),
  source:event.postback?'SIGNED_POSTBACK':'SIGNED_QUICK_REPLY'});
}
module.exports={MAX,buildCarousel,buildQuickReplies,buildPersistentMenu,prepareWebview,
 sign,verifyAction,parseClick};
