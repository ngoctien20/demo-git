'use strict';
/**
 * TIEN404 V15 — SOURCE ONLY / SYNTHETIC IN-MEMORY QA HARNESS.
 * The only accepted channel context is minted by the existing V15 two-issuer
 * signed synthetic gate. NOT Meta/Zalo identity, NOT hosted JWT, NOT a durable
 * database or a replacement for an authorized Commerce order writer.
 * It does no network I/O, sends no messages and cannot mutate live data.
 */
const {createHash,randomBytes,timingSafeEqual}=require('node:crypto');
const {isAcceptedSyntheticContext}=require('../v15-hosted-readiness/trusted-ingress-gate.cjs');
const SKU=/^[A-Z][0-9]{3}$/;
const CODE=/^QA-[A-Z0-9]{8}$/;
const MAX_QTY=99;
const noop=Object.freeze({provider_sends:0,hosted_order_writes:0,stock_deducted:false,paid_model_calls:0,
  hosted_jwt_verified:false,provider_identity_real:false,owner_certified:false,synthetic_only:true});
const hash=s=>createHash('sha256').update(s).digest('hex');
const hasOwn=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const plain=o=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&Object.getPrototypeOf(o)===Object.prototype;
function blocked(reason){return Object.freeze({status:'BLOCKED',reason,...noop});}
function safeNotFound(){return Object.freeze({status:'NOT_FOUND_OR_NOT_AUTHORIZED',...noop});}
function idOf(ctx){return ctx.channel+':'+ctx.subject_digest;}
function scoped(ctx){return ctx.tenant_digest+':'+ctx.store_digest;}
const allowedChannels=new Set(['MESSENGER','ZALO_BOT','ZALO_OA']);
function createNoSendCommerceLab({now=Date.now,sourceCatalog}={}){
  if(typeof now!=='function'||!sourceCatalog||sourceCatalog.source!=='V15_PRIVATE_SYNTHETIC_CATALOG'||
    typeof sourceCatalog.getForPinnedStore!=='function')throw Error('PRIVATE_SYNTHETIC_QA_CATALOG_REQUIRED');
  const orders=new Map(),idempotency=new Map(),links=new Map(),challenges=new Map();
  const permitted=c=>isAcceptedSyntheticContext(c)&&allowedChannels.has(c.channel)&&c.actor_role==='customer';
  let counter=0;
  const customerKey=c=>{
    const k=scoped(c)+':'+idOf(c);
    if(c.channel==='MESSENGER')return hash(k);
    return links.get(k)||null;
  };
  async function createConfirmedQaOrder({context,request}={}){
    if(!permitted(context)||context.channel!=='MESSENGER')return blocked('SIGNED_SYNTHETIC_MESSENGER_CUSTOMER_REQUIRED');
    if(!plain(request)||Object.keys(request).sort().join(',')!=='confirmed,expected_total_vnd,quantity,sku')
      return blocked('STRICT_CONFIRMED_QA_ORDER_REQUEST');
    if(request.confirmed!==true||!SKU.test(request.sku)||!Number.isSafeInteger(request.quantity)||
      request.quantity<1||request.quantity>MAX_QTY||!Number.isSafeInteger(request.expected_total_vnd)||
      request.expected_total_vnd<=0)return blocked('INVALID_CONFIRMATION_OR_ORDER');
    const key=scoped(context)+':'+context.event_digest;
    const fingerprint=hash(JSON.stringify({actor:idOf(context),request}));
    if(idempotency.has(key)){
      const old=idempotency.get(key);
      if(old.fingerprint!==fingerprint)return blocked('DUPLICATE_EVENT_PAYLOAD_CONFLICT');
      return Object.freeze({status:'QA_PERSISTED_IN_MEMORY_NOT_HOSTED',order_code:old.orderCode,
        replay:true,...noop});
    }
    let product;
    try{product=await sourceCatalog.getForPinnedStore({tenant_digest:context.tenant_digest,
      store_digest:context.store_digest,sku:request.sku,read_only:true});}catch{return blocked('CATALOG_UNAVAILABLE');}
    if(!plain(product)||product.source!=='V15_PINNED_SYNTHETIC_STORE_CATALOG'||
      product.tenant_digest!==context.tenant_digest||product.store_digest!==context.store_digest||
      product.sku!==request.sku||!Number.isSafeInteger(product.price_vnd)||product.price_vnd<=0||
      !Number.isSafeInteger(product.stock)||product.stock<0)return blocked('PINNED_STORE_CATALOG_INVALID');
    const total=product.price_vnd*request.quantity;
    if(!Number.isSafeInteger(total)||total<=0)return blocked('VND_OVERFLOW');
    if(total!==request.expected_total_vnd)return blocked('PRICE_CHANGED_REQUOTE_REQUIRED');
    if(product.stock<request.quantity)return blocked('INSUFFICIENT_STOCK');
    const orderCode='QA-'+(++counter).toString(36).toUpperCase().padStart(8,'0');
    const record=Object.freeze({tenant_digest:context.tenant_digest,store_digest:context.store_digest,
      customer_key:customerKey(context),code:orderCode,sku:request.sku,quantity:request.quantity,
      price_vnd:product.price_vnd,total_vnd:total,status:'PENDING_QA',version:1});
    orders.set(orderCode,record);
    idempotency.set(key,{fingerprint,orderCode});
    return Object.freeze({status:'QA_PERSISTED_IN_MEMORY_NOT_HOSTED',order_code:orderCode,
      replay:false,total_vnd:total,...noop});
  }
  function beginCustomerLink({sourceContext,consent}={}){
    if(!permitted(sourceContext)||sourceContext.channel!=='MESSENGER'||consent!==true)
      return blocked('SIGNED_MESSENGER_AND_EXPLICIT_CONSENT_REQUIRED');
    const challengeId=randomBytes(16).toString('hex');
    const oneTimeCode=randomBytes(16).toString('base64url');
    const expiresAt=now()+60000;
    challenges.set(challengeId,{digest:hash(oneTimeCode),store:scoped(sourceContext),
      sourceKey:customerKey(sourceContext),expiresAt,attempts:0,consumed:false});
    // ONLY synthetic test caller receives code. Never log/store plaintext code.
    return Object.freeze({status:'QA_LINK_CHALLENGE_ONLY',challenge_id:challengeId,
      one_time_qa_code:oneTimeCode,expires_at_ms:expiresAt,...noop});
  }
  function completeCustomerLink({targetContext,challenge_id,one_time_qa_code,consent}={}){
    if(!permitted(targetContext)||!['ZALO_BOT','ZALO_OA'].includes(targetContext.channel)||consent!==true)
      return blocked('SIGNED_ZALO_AND_EXPLICIT_CONSENT_REQUIRED');
    if(typeof challenge_id!=='string'||typeof one_time_qa_code!=='string')return blocked('CHALLENGE_REQUIRED');
    const c=challenges.get(challenge_id);
    if(!c||c.consumed||c.attempts>=3||c.expiresAt<=now()||c.store!==scoped(targetContext))
      return blocked('CHALLENGE_INVALID_EXPIRED_REPLAY_OR_WRONG_STORE');
    c.attempts++;
    const submitted=hash(one_time_qa_code);
    if(!timingSafeEqual(Buffer.from(c.digest,'hex'),Buffer.from(submitted,'hex')))
      return blocked('CHALLENGE_INVALID');
    c.consumed=true;
    links.set(scoped(targetContext)+':'+idOf(targetContext),c.sourceKey);
    return Object.freeze({status:'QA_LINKED_SYNTHETIC_CONSENT_ONLY',...noop});
  }
  function revokeCustomerLink({targetContext}={}){
    if(!permitted(targetContext)||!['ZALO_BOT','ZALO_OA'].includes(targetContext.channel))
      return blocked('SIGNED_SYNTHETIC_ZALO_CONTEXT_REQUIRED');
    const existed=links.delete(scoped(targetContext)+':'+idOf(targetContext));
    return Object.freeze({status:existed?'QA_LINK_REVOKED':'QA_LINK_NOT_FOUND',...noop});
  }
  function lookupQaOrder({context,order_code}={}){
    if(!permitted(context))return blocked('SIGNED_SYNTHETIC_CUSTOMER_REQUIRED');
    if(typeof order_code!=='string'||!CODE.test(order_code))return safeNotFound();
    const order=orders.get(order_code),customer=customerKey(context);
    if(!order||!customer||order.store_digest!==context.store_digest||
      order.tenant_digest!==context.tenant_digest||order.customer_key!==customer)return safeNotFound();
    return Object.freeze({status:'QA_ORDER_READ_IN_MEMORY_NOT_HOSTED',order_code:order.code,
      sku:order.sku,quantity:order.quantity,price_vnd:order.price_vnd,
      total_vnd:order.total_vnd,order_status:order.status,version:order.version,
      personal_details_included:false,...noop});
  }
  function lookupAsOwner(){return blocked('REAL_OWNER_G23_AND_HOSTED_STORE_MEMBERSHIP_NOT_CERTIFIED');}
  return Object.freeze({createConfirmedQaOrder,beginCustomerLink,completeCustomerLink,
    revokeCustomerLink,lookupQaOrder,lookupAsOwner,inspectForQa:()=>Object.freeze({
      mode:'SYNTHETIC_IN_MEMORY_NO_SEND',orders_in_memory:orders.size,
      identity_links_in_memory:links.size,provider_sends:0,hosted_order_writes:0,
      real_provider_certified:false,hosted_jwt_verified:false})});
}
module.exports={createNoSendCommerceLab};