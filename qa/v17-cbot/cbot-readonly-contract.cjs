'use strict';
/**
 * V17 CBOT PHASE B/C/D SOURCE-ONLY bounded bridge:
 * - delegates provider signatures, Page/OA→Store, customer link, catalog and
 *   Commerce readback to INJECTED trusted server implementations
 * - reuses V14.3 Store-scoped catalog/response validator
 * - in-memory synthetic conversation for QA, never a durable session
 * - NO HTTP, DB, model, provider SEND, order/stock update or credentials.
 * A fake/mock verifier in these tests is NOT a real Meta/Zalo/Auth authority.
 */
const crypto=require('node:crypto');
const {build}=require('../channel-v143/channel-core.cjs');
const CONTRACT='T404_V17_CBOT_READONLY_BRIDGE_V1';
const CHANNELS=Object.freeze(['MESSENGER','ZALO_BOT','ZALO_OA']);
const ALLOWED_ORDER_STATES=new Set(['pending','confirmed','paid','cancelled','refunded']);
const fail=(code)=>{throw Error(code);};
const id=x=>typeof x==='string'&&x.length>=2&&x.length<=90&&/^[a-z0-9_-]+$/i.test(x);
const sha=x=>crypto.createHash('sha256').update('T404-CBOT-V17:').update(x).digest('hex');
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const cleanString=(x,n)=>typeof x==='string'&&x.length<=n&&!/[\u0000-\u001f\u007f]/.test(x);
function createReadOnlyPilot({attestInbound,readCatalog,matchImage,
 resolveVerifiedLink,lookupOrder,clock=()=>Date.now()}={}){
 if(![attestInbound,readCatalog,matchImage,resolveVerifiedLink,
    lookupOrder,clock].every(x=>typeof x==='function'))
   fail('INJECTED_VERIFIERS_AND_CATALOG_REQUIRED');
 const states=new Map(), seen=new Map(), SESSION_TTL=15*60*1000, EVENT_TTL=5*60*1000;
 function now(){const t=clock();if(!Number.isSafeInteger(t)||t<=0)fail('INVALID_CLOCK');return t;}
 function preview(status,payload={}){
  return Object.freeze({contract:CONTRACT,mode:'SOURCE_ONLY_NO_SEND',
    status,...payload,providerSends:0,hostedWrites:0,realModelCalls:0,
    orderWrites:0,stockWrites:0,canPublish:false,canCreateOrder:false,
    canReadSensitiveCustomerData:false,actualWebhookSignatureCheckedHere:false,
    actualIdentityProofInspectedHere:false});
 }
 function validateEvent(event,channel,t){
  if(!plain(event)||event.source!=='SERVER_ATTESTED_INBOUND'||
   event.verified!==true||event.channel!==channel||
   !id(event.accountId)||!id(event.tenantId)||!id(event.storeId)||
   !/^[a-f0-9]{64}$/.test(event.subjectHash||'')||
   !id(event.eventId)||!Number.isSafeInteger(event.occurredAtMs)||
   Math.abs(t-event.occurredAtMs)>EVENT_TTL||
   !['text','image'].includes(event.kind)||
   (event.kind==='text'&&(!cleanString(event.text,1000)||!event.text.trim()))||
   (event.kind==='image'&&!id(event.imageRef)))
    fail('ATTESTED_INBOUND_REQUIRED');
 }
 function validateLink(link,e,t){
  if(link===null||link===undefined)return null;
  if(!plain(link)||link.source!=='VERIFIED_SERVER_IDENTITY_LINK'||
    link.verified!==true||link.scope!=='ORDER_READ_ONLY'||
    !id(link.canonicalCustomerId)||
    link.tenantId!==e.tenantId||link.storeId!==e.storeId||
    link.channel!==e.channel||link.subjectHash!==e.subjectHash||
    !Number.isSafeInteger(link.expiresAtMs)||link.expiresAtMs<=t||
    link.expiresAtMs-t>24*3600000)
    fail('CROSS_CHANNEL_IDENTITY_LINK_DENIED');
  return link;
 }
 function validatedReadback(c,e){
  if(!plain(c)||c.source!=='TRUSTED_CATALOG_READBACK'||
    c.verified!==true||c.tenantId!==e.tenantId||
    c.storeId!==e.storeId||!Number.isSafeInteger(c.revision)||
    c.revision<1||!Array.isArray(c.products)||c.products.length>100)
   fail('STORE_SCOPED_CATALOG_NOT_ATTESTED');
  const names=new Set();
  for(const p of c.products){
   if(!plain(p)||p.source!=='SERVER_VERIFIED_SHOP_CATALOG'||
      p.verified!==true||p.tenantId!==e.tenantId||p.storeId!==e.storeId||
      !id(p.itemId)||names.has(p.itemId)||!cleanString(p.sku,80)||
      !p.sku||!cleanString(p.name,80)||!p.name||
      !Number.isSafeInteger(p.priceVnd)||p.priceVnd<0||
      !Number.isSafeInteger(p.stock)||p.stock<0)
       fail('CATALOG_ITEM_TRUTH_OR_SCOPE_INVALID');
   names.add(p.itemId);
  }
  return c;
 }
 function responseFor(e,c,ids,status){
  const binding={source:'SERVER_VERIFIED_CHANNEL_SCOPE',verified:true,serverDerived:true,
    tenantId:e.tenantId,storeId:e.storeId,channel:e.channel,
    subscriptionActive:true,shopActive:true,allowedImageOrigins:[]};
  const intent={source:'TRUSTED_SALES_CORE',verified:true,
    tenantId:e.tenantId,storeId:e.storeId,type:'IMAGE_RESULT',
    text:'Đây là các sản phẩm tương tự. Vui lòng chọn đúng mã trước khi đặt hàng.',
    productIds:ids,dispatch_authorized:false};
  const out=build({binding,intent,catalog:c});
  return preview(status,{candidateProducts:out.products.map(p=>({
    sku:p.sku,itemId:p.itemId,name:p.name,priceVnd:p.priceVnd,
    stock:p.stock,imageUrl:null
  })),needsCustomerSkuSelection:true,needsFinalOrderConfirmation:true});
 }
 function memoryKey(e,link){
  const subject=link?'verified:'+link.canonicalCustomerId:
    'channel:'+e.channel+':'+e.accountId+':'+e.subjectHash;
  return sha([e.tenantId,e.storeId,subject].join('|'));
 }
 function getState(key,t){
  const old=states.get(key);
  if(!old||t-old.updatedAt>SESSION_TTL){
   states.delete(key);return {pendingIds:[],selectedId:null,quantity:null,awaitingConfirmation:false};
  }
  return {...old,pendingIds:old.pendingIds.slice()};
 }
 function saveState(key,ctx,t){states.set(key,{...ctx,pendingIds:ctx.pendingIds.slice(),updatedAt:t});}
 async function run({channel,rawBody,headers={}}={}){
  if(!CHANNELS.includes(channel)||!Buffer.isBuffer(rawBody)||rawBody.length<1||
    rawBody.length>262144||!plain(headers))fail('PROVIDER_INPUT_INVALID');
  const t=now(),e=await attestInbound({channel,rawBody,headers});
  validateEvent(e,channel,t);
  const replayKey=sha([e.tenantId,e.storeId,e.channel,e.accountId,e.eventId].join('|'));
  for(const [k,at] of seen)if(t-at>EVENT_TTL)seen.delete(k);
  if(seen.has(replayKey))return preview('DUPLICATE_EVENT_IGNORED');
  const link=validateLink(await resolveVerifiedLink({
    channel:e.channel,accountId:e.accountId,subjectHash:e.subjectHash,
    tenantId:e.tenantId,storeId:e.storeId
  }),e,t);
  // The provider verifier and identity linker are injected ONLY. This module
  // never falsely claims real credential/JWT verification or durable replay.
  const c=validatedReadback(await readCatalog({
    tenantId:e.tenantId,storeId:e.storeId
  }),e);
  seen.set(replayKey,t);
  const key=memoryKey(e,link),ctx=getState(key,t);
  if(e.kind==='image'){
    const result=await matchImage({
      tenantId:e.tenantId,storeId:e.storeId,imageRef:e.imageRef,
      catalogRevision:c.revision
    });
    if(!Array.isArray(result)||result.length>20)fail('IMAGE_CANDIDATES_INVALID');
    const ranked=[],dedupe=new Set();
    for(const item of result){
      if(!plain(item)||!id(item.itemId)||
        typeof item.score!=='number'||!Number.isFinite(item.score)||
        item.score<0||item.score>1||dedupe.has(item.itemId))
        fail('IMAGE_SCORE_OR_DUPLICATE_INVALID');
      dedupe.add(item.itemId);
      // Model scores are hypotheses, never catalog/Store authority.
      if(c.products.some(p=>p.itemId===item.itemId)&&item.score>=0.35)
        ranked.push(item);
    }
    ranked.sort((a,b)=>b.score-a.score);
    const ids=ranked.slice(0,3).map(x=>x.itemId);
    saveState(key,{pendingIds:ids,selectedId:null,quantity:null,
      awaitingConfirmation:false},t);
    if(ids.length===0)return preview('NO_RELIABLE_IMAGE_MATCH',{
      needsBetterImageOrDescription:true,needsCustomerSkuSelection:true
    });
    return responseFor(e,c,ids,'SIMILAR_PRODUCTS_REQUIRES_SKU_SELECTION');
  }
  const text=e.text.trim();
  // A reference is only a lookup hint; never identity/authz.
  const orderRef=text.match(/\bT404-[A-Z0-9-]{4,40}\b/i);
  if(orderRef){
    if(!link)return preview('ORDER_LOOKUP_VERIFICATION_REQUIRED');
    const order=await lookupOrder({tenantId:e.tenantId,storeId:e.storeId,
      customerId:link.canonicalCustomerId,orderRef:orderRef[0].toUpperCase(),
      scope:'READ_ONLY'});
    if(!plain(order)||order.source!=='AUTHORIZED_ORDER_READBACK'||
      order.tenantId!==e.tenantId||order.storeId!==e.storeId||
      order.customerId!==link.canonicalCustomerId||
      order.orderRef!==orderRef[0].toUpperCase()||
      !ALLOWED_ORDER_STATES.has(order.status))
     return preview('ORDER_LOOKUP_DENIED_OR_NOT_FOUND');
    return preview('ORDER_STATUS_AUTHORIZED_READ_ONLY',{
      orderRef:order.orderRef,orderStatus:order.status
    });
  }
  if(/^(xác nhận|xác nhận đặt hàng|đồng ý đặt hàng)$/iu.test(text)){
   return preview('CONFIRMATION_CANNOT_EXECUTE_IN_SOURCE_ONLY',{
     requiresTrustedServerAction:true,needsFinalOrderConfirmation:true});
  }
  const skuMention=text.match(/\b(?:[A-Z]\d{3}|[A-Z]{2,8}(?:-[A-Z0-9]{1,12}){1,3})\b/i);
  if(skuMention){
    const sku=skuMention[0].toUpperCase();
    const found=c.products.filter(p=>p.sku.toUpperCase()===sku);
    if(found.length!==1)return preview('SKU_UNKNOWN_OR_AMBIGUOUS');
    ctx.selectedId=found[0].itemId;ctx.pendingIds=[found[0].itemId];
    ctx.awaitingConfirmation=false;
  }
  const q=text.match(/(?:lấy|mua|đặt)\s+(\d{1,2})\s*(?:cái|chiếc|sp|sản phẩm)?/iu)||
     text.match(/\b(\d{1,2})\s*(?:cái|chiếc)\b/iu);
  if(q){
    const quantity=Number(q[1]);
    if(!Number.isSafeInteger(quantity)||quantity<1||quantity>50)
      return preview('QUANTITY_INVALID');
    if(!ctx.selectedId){
      return preview('PRODUCT_SELECTION_REQUIRED',{pendingCandidates:ctx.pendingIds.length});
    }
    const p=c.products.find(x=>x.itemId===ctx.selectedId);
    if(!p||p.stock<quantity)return preview('PRODUCT_UNAVAILABLE_OR_CATALOG_CHANGED');
    const total=p.priceVnd*quantity;
    if(!Number.isSafeInteger(total)||total<0)fail('VND_OVERFLOW');
    ctx.quantity=quantity;ctx.awaitingConfirmation=true;saveState(key,ctx,t);
    return preview('ORDER_DRAFT_AWAITING_CONFIRMATION',{
      itemId:p.itemId,sku:p.sku,quantity,
      unitPriceVnd:p.priceVnd,totalVnd:total,
      needsFinalOrderConfirmation:true});
  }
  saveState(key,ctx,t);
  return preview('ASK_CLARIFICATION_OR_CATALOG_LOOKUP',{
    hasPreviousSelectedProduct:!!ctx.selectedId,
    candidatesAwaitingSelection:ctx.pendingIds.length});
 }
 function stats(){return Object.freeze({kind:'EPHEMERAL_QA_ONLY',
   sessionCount:states.size,ephemeralReplayKeys:seen.size,
   serverPersisted:false,realIdentityLinked:false,
   authorizedOrderWrites:0,providerSends:0});}
 function createOrder(){fail('REAL_ORDER_WRITE_DISABLED');}
 function sendProvider(){fail('PROVIDER_SEND_DISABLED');}
 return Object.freeze({CONTRACT,run,stats,createOrder,sendProvider});
}
module.exports=Object.freeze({CONTRACT,CHANNELS,createReadOnlyPilot});
