'use strict';
/**
 * TIEN404 V15 Sales Lite P0-G — SYNTHETIC channel-to-Store read contract.
 *
 * Reuses V15.03H's two independently signed, replay-gated QA context and
 * V15.04H's scoped read adapter. The source of truth here is V14.7's FIXTURES,
 * NEVER real Supabase Products, tenant-scoped DEMO Sheets or provider replies.
 *
 * A native Meta/Zalo signature, independently approved Store ownership and
 * authenticated hosted JWT/RLS are NOT present. Every result is QA NO-SEND,
 * and cannot create Orders, charge AI, notify a merchant, or publish a bot.
 */
const {createHash}=require('node:crypto');
const {isAcceptedSyntheticContext}=require('../v15-hosted-readiness/trusted-ingress-gate.cjs');
const {authorizeQaBusinessTool}=require('../v15-hosted-readiness/authorized-business-tools.cjs');
const {previewCommerceRequest}=require('../v15-sales-lite-p0/commerce-preview-bridge.cjs');
const {FIXTURES,CHANNELS}=require('../v147-custom-studio/studio-core.js');

const approvedRegistries=new WeakSet();
const ALLOWED_KINDS=Object.freeze(['catalog','quote','order_request']);
const syntheticKeys=Object.freeze(Object.keys(FIXTURES));
const validChannels=new Set(CHANNELS);
const digest=value=>createHash('sha256').update(value).digest('hex');
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
  Object.getPrototypeOf(x)===Object.prototype;
const strictKeys=(x,allowed)=>plain(x)&&Object.keys(x).every(k=>allowed.includes(k));
function blocked(reason){
 return Object.freeze({
  status:'BLOCKED',reason,contract:'V15_P0G_SYNTHETIC_READ_V1',
  synthetic_only:true,provider_identity_real:false,hosted_store_authority_verified:false,
  real_price_verified:false,can_send:false,can_write_orders:false,can_publish:false,
  orders_written:0,stock_deducted:false,owner_notifications_sent:0,paid_model_calls:0
 });
}

/** QA store binding registry, pinned in source and never dynamically merchant-editable. */
function createSyntheticStoreRegistry({pausedStores=[],disabledChannels=[]}={}){
 if(!Array.isArray(pausedStores)||!Array.isArray(disabledChannels)||
    pausedStores.some(k=>typeof k!=='string'||!syntheticKeys.includes(k))||
    disabledChannels.some(k=>{
      if(typeof k!=='string')return true;
      const [store,channel,...rest]=k.split('|');
      return rest.length>0||!syntheticKeys.includes(store)||!validChannels.has(channel);
    }))throw Error('INVALID_SYNTHETIC_REGISTRY_SETTINGS');
 const paused=new Set(pausedStores),disabled=new Set(disabledChannels);
 const entries=new Map();
 for(const key of syntheticKeys){
  const f=FIXTURES[key];
  for(const channel of CHANNELS){
   entries.set([digest(f.tenantId),digest(f.storeId),channel].join('|'),
     Object.freeze({storeKey:key,tenantId:f.tenantId,storeId:f.storeId,
       channel,paused:paused.has(key),enabled:!disabled.has(key+'|'+channel),
       product:f.product}));
  }
 }
 const registry=Object.freeze({
  mode:'PINNED_OFFLINE_QA_REGISTRY',
  getPinned(context){
   if(!isAcceptedSyntheticContext(context))return null;
   return entries.get([context.tenant_digest,context.store_digest,context.channel].join('|'))||null;
  },
  summary(){
   return Object.freeze({storeCount:syntheticKeys.length,
     channelCount:CHANNELS.length,providerBindings:entries.size,
     synthetic_only:true,real_hosted_bindings:0,provider_sends:0});
  }
 });
 approvedRegistries.add(registry);
 return registry;
}

const APPROVED_SCHEMA=Object.freeze({
 catalog:Object.freeze(['kind','sku']),
 quote:Object.freeze(['kind','sku']),
 order_request:Object.freeze(['kind','sku','quantity','expected_total_vnd'])
});
function wrap(status,source,values){
 return Object.freeze({
  status,contract:'V15_P0G_SYNTHETIC_READ_V1',channel:source.channel,
  qa_store_key:source.storeKey,source:'V14_7_PINNED_SYNTHETIC_FIXTURE',
  synthetic_only:true,provider_identity_real:false,
  hosted_store_authority_verified:false,real_price_verified:false,
  can_send:false,can_write_orders:false,can_publish:false,
  orders_written:0,stock_deducted:false,owner_notifications_sent:0,paid_model_calls:0,
  ...values
 });
}
async function previewChannelStoreCommerce({context,intent,registry}={}){
 if(!isAcceptedSyntheticContext(context))return blocked('TWO_SIGNED_QA_PROOFS_REQUIRED');
 if(!approvedRegistries.has(registry))return blocked('PRIVATE_PINNED_QA_REGISTRY_REQUIRED');
 if(!strictKeys(intent,APPROVED_SCHEMA[intent?.kind]||[])||
    !ALLOWED_KINDS.includes(intent?.kind))
    return blocked('STRICT_READONLY_INTENT_SCHEMA');
 if(typeof intent.sku!=='string'||!/^[A-Z][0-9]{3}$/.test(intent.sku))
    return blocked('SKU_REQUIRED_OR_INVALID');
 if(intent.kind==='order_request'){
  if(!Number.isSafeInteger(intent.quantity)||intent.quantity<1||intent.quantity>99||
     (Object.hasOwn(intent,'expected_total_vnd')&&
       (!Number.isSafeInteger(intent.expected_total_vnd)||intent.expected_total_vnd<1)))
    return blocked('ORDER_REQUEST_OR_EXPECTED_TOTAL_INVALID');
 }
 let source;
 try{source=registry.getPinned(context);}catch{return blocked('REGISTRY_BINDING_ERROR');}
 if(!source)return blocked('CHANNEL_TENANT_STORE_NOT_PINNED');
 if(!source.enabled)return blocked('CHANNEL_DISABLED');
 if(source.paused)return blocked('STORE_PAUSED');
 // IMPORTANT: internal immutable fixture only, never a request-provided backend
 // or an LLM-generated "store_id". Context is generated by signed QA attestors.
 const qaBackend=Object.freeze({
  source:'PRIVATE_QA_READONLY_FIXTURE_ADAPTER',
  async readPinnedFixture(){
   return {source:'V14_7_SYNTHETIC_FIXTURE',tenantId:source.tenantId,
      storeId:source.storeId,product:source.product};
  }
 });
 if(intent.kind==='order_request'){
  const result=await previewCommerceRequest({context,intent,qaBackend});
  if(result.status!=='QA_ORDER_CONFIRMATION_PROPOSAL_ONLY')
    return blocked(result.reason||'ORDER_REQUEST_NOT_A_DRAFT');
  return wrap('QA_ORDER_REQUEST_REQUIRES_CONFIRMATION',source,{
   sku:result.sku,quantity:result.quantity,price_vnd:result.price_vnd,
   expected_total_vnd:result.expected_total_vnd,
   customer_confirmation_required:true,atomic_order_outbox_certified:false,
   backend_write_approved:false
  });
 }
 const result=await authorizeQaBusinessTool({
  context,request:{capability:intent.kind==='catalog'?'catalog_read':'price_quote',
    sku:intent.sku},backend:qaBackend
 });
 if(result.status==='NOT_FOUND_IN_QA_STORE')return blocked('SKU_NOT_IN_PINNED_QA_STORE');
 const expected=intent.kind==='catalog'?'QA_CATALOG_READ_RESULT':'QA_PRICE_QUOTE_RESULT';
 if(result.status!==expected)return blocked(result.reason||'UNVERIFIED_PRICE_OR_STOCK');
 return wrap(intent.kind==='catalog'?'QA_CATALOG_READ_ONLY':'QA_QUOTE_READ_ONLY',source,{
  sku:result.sku,name:result.name,price_vnd:result.price_vnd,stock:result.stock
 });
}
module.exports={createSyntheticStoreRegistry,previewChannelStoreCommerce,ALLOWED_KINDS};
