'use strict';
// TIEN404 V13.6M.1 integration candidate. SOURCE-ONLY, NO I/O, NO MESSENGER SEND.
// All injected ports must be independently trusted server implementations.
// A browser, AI Agent, or webhook body cannot mint trusted shop or catalogue proof.
const {createHmac,timingSafeEqual,createHash}=require('node:crypto');
const {buildCarousel,buildQuickReplies,parseClick}=require('../messenger-rich-v136m/adapter.cjs');
const MAX_BODY=128*1024,MAX_EVENTS=20,MAX_CARDS=10,ONE_DAY=24*60*60*1000;
const ID=/^[A-Za-z0-9_-]{1,64}$/;
const PSID=/^\d{5,30}$/;
const BLOCKED=new Set(['POST','PUT','PATCH','DELETE']);
const failure=code=>{const e=new Error(code);e.code=code;throw e};
const safeSecret=(s,code)=>{if(typeof s!=='string'||Buffer.byteLength(s)<32)failure(code);return s};
function verifyMetaRaw({rawBody,signature,appSecret}={}){
  safeSecret(appSecret,'META_APP_SECRET_MISSING');
  if(typeof rawBody!=='string'||!rawBody||Buffer.byteLength(rawBody)>MAX_BODY)failure('RAW_BODY_INVALID');
  if(typeof signature!=='string'||!/^sha256=[a-f0-9]{64}$/.test(signature))failure('META_SIGNATURE_REQUIRED');
  const expected=createHmac('sha256',appSecret).update(Buffer.from(rawBody,'utf8')).digest();
  const got=Buffer.from(signature.slice(7),'hex');
  if(!timingSafeEqual(expected,got))failure('META_SIGNATURE_INVALID');
  return true;
}
function checkPorts(ports){
  const required=['resolveBinding','readShopStatus','readCatalog','checkAndReserveEvent'];
  if(!ports||required.some(k=>typeof ports[k]!=='function'))failure('SERVER_PORT_MISSING');
}
function verifyBinding(b,pageId,psid){
 if(!b||b.source!=='SERVER_VERIFIED_MESSENGER_BINDING'||b.serverDerived!==true||
    b.verified!==true||b.pageId!==pageId||b.recipientPsid!==psid||
    !ID.test(b.tenantId||'')||!ID.test(b.storeId||'')||
    !ID.test(b.shopSlug||''))failure('TRUSTED_PAGE_SHOP_SCOPE_DENIED');
 return b;
}
function mapCatalogRecord(row,b){
 if(!row||row.tenant_id!==b.tenantId||row.is_active!==true||
    !ID.test(row.sku||'')||typeof row.name!=='string'||
    row.name.trim().length<1||row.name.trim().length>80)failure('CATALOG_TENANT_OR_SKU_DENIED');
 let price=row.price_vnd;
 if(typeof price==='string'){
    if(!/^\d{1,16}$/.test(price))failure('CATALOG_VND_INVALID');
    const integer=BigInt(price);
    if(integer>BigInt(Number.MAX_SAFE_INTEGER))failure('CATALOG_VND_INVALID');
    price=Number(integer);
 }
 if(!Number.isSafeInteger(price)||price<0)failure('CATALOG_VND_INVALID');
 if(!Number.isSafeInteger(row.stock_on_hand)||row.stock_on_hand<0)failure('CATALOG_STOCK_INVALID');
 return {
  source:'SERVER_VERIFIED_SHOP_CATALOG',verified:true,
  tenantId:b.tenantId,storeId:b.storeId,
  itemId:row.sku,name:row.name,priceVnd:price,stock:row.stock_on_hand,
  // public.products has no image column. Omit image rather than inventing one.
  ...(row.image_url_verified?{imageUrl:row.image_url_verified}:{})
 };
}
function verifyCatalogResponse(r,b){
 if(!r||r.source!=='SERVER_VERIFIED_TENANT_CATALOG'||
    r.tenantId!==b.tenantId||r.storeId!==b.storeId||
    r.serverAuthorized!==true||r.readOnly!==true||
    r.isolationProof!=='ONE_STORE_PER_TENANT_VERIFIED'||
    !Array.isArray(r.rows))failure('CATALOG_SCOPE_UNVERIFIED');
 if(r.rows.length>100)failure('CATALOG_UNBOUNDED');
 const result=[],ids=new Set();
 for(const raw of r.rows){
    const mapped=mapCatalogRecord(raw,b);
    if(ids.has(mapped.itemId))failure('CATALOG_DUPLICATE_SKU');
    ids.add(mapped.itemId);result.push(mapped);
 }
 return result;
}
function guardStatus(v,b,nowMs){
 if(!v||v.source!=='SERVER_VERIFIED_SHOP_STATUS'||
    v.tenantId!==b.tenantId||v.storeId!==b.storeId)failure('SHOP_STATUS_UNVERIFIED');
 if(v.active!==true||v.botPaused!==false||v.entitlement!=='MESSENGER_RICH_UI_CANDIDATE'||
    !Number.isFinite(Date.parse(v.expiresAt))||Date.parse(v.expiresAt)<=nowMs)
    failure('SHOP_DISABLED_OR_SUBSCRIPTION_UNVERIFIED');
}
function normalize(raw){
 let x;try{x=JSON.parse(raw)}catch{failure('META_BODY_JSON_INVALID')}
 if(!x||x.object!=='page'||!Array.isArray(x.entry)||!x.entry.length||x.entry.length>10)
    failure('META_ENVELOPE_INVALID');
 const events=[];
 for(const en of x.entry){
    if(!PSID.test(String(en.id||''))||!Array.isArray(en.messaging)||en.messaging.length>MAX_EVENTS)
       failure('META_ENTRIES_INVALID');
    for(const e of en.messaging){
       if(e.message?.is_echo===true||e.message?.is_deleted===true||
          e.message?.is_unsupported===true)continue;
       if(!e.message&&!e.postback)continue;
       if(!PSID.test(String(e.sender?.id||''))||String(e.recipient?.id||'')!==String(en.id))
          failure('META_SENDER_RECIPIENT_UNVERIFIED');
       if(!Number.isSafeInteger(e.timestamp)||e.timestamp<1)failure('META_TIMESTAMP_INVALID');
       events.push({pageId:String(en.id),senderPsid:String(e.sender.id),event:e});
       if(events.length>MAX_EVENTS)failure('TOO_MANY_EVENTS');
    }
 }
 return events;
}
function replayKey(pageId,sender,event){
 const mid=event.message?.mid??event.postback?.mid;
 const base=mid?String(mid):String(event.timestamp)+'|'+String(event.postback?.payload??event.message?.quick_reply?.payload??event.message?.text??'');
 if(base.length>2048)failure('REPLAY_KEY_TOO_LONG');
 return createHash('sha256').update(pageId+'|'+sender+'|'+base).digest('hex');
}
function detectIntent(event,b,actionSecret,now){
 const button=event.postback||event.message?.quick_reply;
 if(button){
  return parseClick({trusted:b,secret:actionSecret,metaSignatureVerified:true,
    event:{pageId:b.pageId,senderPsid:b.recipientPsid,
    ...(event.postback?{postback:{payload:event.postback.payload}}:
       {message:{quick_reply:{payload:event.message.quick_reply.payload}}})},now});
 }
 if(typeof event.message?.text==='string'&&event.message.text.trim().length<=800)
   return {action:'QUICK_MENU',itemId:'NONE',allowedMutation:false,requiresServerSideReplayGuard:true};
 failure('UNSUPPORTED_MESSENGER_EVENT');
}
function quick(b,actionSecret,now){
 return buildQuickReplies({
  trusted:b,secret:actionSecret,now,text:'Xin chào! Bạn muốn xem sản phẩm hay gặp nhân viên?',
  choices:[{action:'BROWSE_CATALOG',title:'Xem sản phẩm'},
   {action:'TRACK_ORDER',title:'Tra cứu đơn'},
   {action:'ASK_STAFF',title:'Gặp nhân viên'}]
 });
}
async function processCandidate({rawBody,signature,appSecret,actionSecret,ports,siteOrigin,now=Date.now}={}){
 checkPorts(ports);verifyMetaRaw({rawBody,signature,appSecret});
 safeSecret(actionSecret,'SERVER_ACTION_SECRET_MISSING');
 const events=normalize(rawBody),result=[];
 for(const item of events){
  const nowMs=now(),e=item.event;
  if(e.timestamp>nowMs+5*60*1000||nowMs-e.timestamp>ONE_DAY)
     failure('MESSENGER_TIME_WINDOW_DENIED');
  const binding=verifyBinding(await ports.resolveBinding({
      pageId:item.pageId,senderPsid:item.senderPsid}),item.pageId,item.senderPsid);
  const status=await ports.readShopStatus({tenantId:binding.tenantId,storeId:binding.storeId});
  guardStatus(status,binding,nowMs);
  const intent=detectIntent(e,binding,actionSecret,now);
  const key=replayKey(item.pageId,item.senderPsid,e);
  const claim=await ports.checkAndReserveEvent({
    tenantId:binding.tenantId,storeId:binding.storeId,
    channel:'MESSENGER',replayKey:key,mode:'DRY_RUN'});
  if(claim?.source!=='SERVER_VERIFIED_REPLAY_GUARD'||claim.tenantId!==binding.tenantId||
     claim.storeId!==binding.storeId||claim.mode!=='DRY_RUN')
      failure('REPLAY_GUARD_UNVERIFIED');
  if(claim.firstSeen!==true){
   if(claim.firstSeen===false){result.push({status:'DUPLICATE_SUPPRESSED',previewOnly:true,sendEnabled:false});continue}
   failure('REPLAY_GUARD_UNVERIFIED');
  }
  let draft,route=intent.action;
  if(route==='BROWSE_CATALOG'||route==='VIEW_PRODUCT'){
   const catalog=verifyCatalogResponse(
     await ports.readCatalog({tenantId:binding.tenantId,storeId:binding.storeId,
       readOnly:true,limit:100}),binding);
   const chosen=route==='VIEW_PRODUCT'?catalog.filter(x=>x.itemId===intent.itemId):catalog;
   if(!chosen.length){
      draft={previewOnly:true,sendEnabled:false,body:{recipient:{id:binding.recipientPsid},
         messaging_type:'RESPONSE',message:{text:'Hiện chưa có sản phẩm được xác minh. Vui lòng gặp nhân viên.'}}};
   }else{
      draft=buildCarousel({trusted:binding,products:chosen.slice(0,MAX_CARDS),
         siteOrigin,secret:actionSecret,now});
   }
  }else if(route==='QUICK_MENU'){
    draft=quick(binding,actionSecret,now);
  }else if(route==='ASK_STAFF'){
    draft={previewOnly:true,sendEnabled:false,body:{recipient:{id:binding.recipientPsid},
      messaging_type:'RESPONSE',message:{text:'Yêu cầu gặp nhân viên cần được xác nhận trên hệ thống hỗ trợ.'}}};
  }else if(route==='TRACK_ORDER'){
    draft={previewOnly:true,sendEnabled:false,body:{recipient:{id:binding.recipientPsid},
      messaging_type:'RESPONSE',message:{text:'Vui lòng đăng nhập trang tài khoản để tra cứu đơn hàng an toàn.'}}};
  }else failure('ACTION_NOT_ALLOWED');
  result.push({status:'PREVIEW_CREATED',previewOnly:true,sendEnabled:false,
    route,requiresMetaPolicyReview:true,allowedOrderWrites:false,
    requiresAtomicReplayStore:true,requiresTrustedShop:true,prepared:draft});
 }
 return Object.freeze({stage:'MESSENGER_RICH_UI_V136M1',status:'CANDIDATE_PREVIEW_ONLY',
    previewOnly:true,sendEnabled:false,events:result});
}
module.exports={verifyMetaRaw,mapCatalogRecord,verifyCatalogResponse,processCandidate};
