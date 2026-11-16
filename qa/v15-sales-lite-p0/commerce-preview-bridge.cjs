'use strict';
/**
 * V15 Sales Lite P0 — safe Commerce integration seam; SOURCE-ONLY QA.
 * The signed context is QA-only and is NOT a real Meta/Zalo provider proof.
 * Never connects to Supabase, Commerce writer, DEMO Google Sheets or Send API.
 */
const {isAcceptedSyntheticContext}=require('../v15-hosted-readiness/trusted-ingress-gate.cjs');
const {authorizeQaBusinessTool}=require('../v15-hosted-readiness/authorized-business-tools.cjs');
function blocked(reason){return Object.freeze({status:'BLOCKED',reason,can_send:false,
  can_write_orders:false,orders_written:0,stock_deducted:false,owner_notifications_sent:0,paid_model_calls:0})}
const plain=o=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&Object.getPrototypeOf(o)===Object.prototype;
async function previewCommerceRequest({context,intent,qaBackend}={}){
  if(!isAcceptedSyntheticContext(context))return blocked('SIGNED_SYNTHETIC_CONTEXT_REQUIRED');
  if(!plain(intent)||!Object.keys(intent).every(k=>['kind','sku','quantity','expected_total_vnd'].includes(k))||
    !['quote','order_request'].includes(intent.kind))return blocked('STRICT_INTENT_CONTRACT');
  if(typeof intent.sku!=='string')return blocked('SKU_REQUIRED');
  if(intent.kind==='quote'&&(Object.hasOwn(intent,'quantity')||Object.hasOwn(intent,'expected_total_vnd')))
    return blocked('QUOTE_MUST_BE_READ_ONLY');
  if(intent.kind==='order_request' && (!Number.isSafeInteger(intent.quantity)||intent.quantity<1||intent.quantity>99))
    return blocked('ORDER_REQUEST_QUANTITY_INVALID');
  if(Object.hasOwn(intent,'expected_total_vnd')&&
    (!Number.isSafeInteger(intent.expected_total_vnd)||intent.expected_total_vnd<=0))
    return blocked('INVALID_EXPECTED_TOTAL');
  const skill=intent.kind==='quote'?'price_quote':'order_draft';
  const tool=await authorizeQaBusinessTool({
    context,
    request: skill==='price_quote'?{capability:skill,sku:intent.sku}:
      {capability:skill,sku:intent.sku,quantity:intent.quantity},
    backend:qaBackend
  });
  if(tool.status==='BLOCKED')return blocked(tool.reason);
  if(tool.status==='NOT_FOUND_IN_QA_STORE')return blocked('SKU_NOT_IN_TRUSTED_QA_STORE');
  if(tool.status==='QA_DRAFT_INSUFFICIENT_STOCK')return blocked('INSUFFICIENT_QA_STOCK');
  if(skill==='price_quote' && tool.status==='QA_PRICE_QUOTE_RESULT'){
    return Object.freeze({status:'QA_QUOTE_ONLY',sku:tool.sku,price_vnd:tool.price_vnd,
      stock:tool.stock,synthetic_only:true,can_send:false,can_write_orders:false,
      orders_written:0,stock_deducted:false,owner_notifications_sent:0,paid_model_calls:0});
  }
  if(skill!=='order_draft'||tool.status!=='QA_ORDER_DRAFT_REQUIRES_CONFIRMATION')
    return blocked('ORDER_DRAFT_BACKEND_STATE_INVALID');
  if(Object.hasOwn(intent,'expected_total_vnd')&&intent.expected_total_vnd!==tool.total_vnd)
    return blocked('EXPECTED_TOTAL_MISMATCH_REQUOTE_REQUIRED');
  return Object.freeze({status:'QA_ORDER_CONFIRMATION_PROPOSAL_ONLY',
    sku:tool.sku,quantity:tool.quantity,price_vnd:tool.price_vnd,
    expected_total_vnd:tool.total_vnd,
    customer_confirmation_required:true,backend_write_approved:false,
    atomic_order_outbox_certified:false,
    synthetic_only:true,can_send:false,can_write_orders:false,
    orders_written:0,stock_deducted:false,owner_notifications_sent:0,paid_model_calls:0});
}
module.exports={previewCommerceRequest};
