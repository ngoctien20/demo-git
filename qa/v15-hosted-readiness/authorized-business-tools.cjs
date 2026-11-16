'use strict';
/** V15.0-04H read/draft-only BUSINESS TOOL security adapter.
 * Inputs are only valid after two distinct P256 signed QA attestations.
 * This adapter neither calls Supabase/n8n nor sends messages/writes orders.
 */
const {isAcceptedSyntheticContext}=require('./trusted-ingress-gate.cjs');
const {createHash,timingSafeEqual}=require('node:crypto');
const SKU=/^[A-Z][0-9]{3}$/;
const ACTIONS=new Set(['catalog_read','price_quote','order_draft','support_draft']);
function fail(code){return Object.freeze({
 status:'BLOCKED',reason:code,source:'V15_04H_NO_SEND',
 can_send:false,orders_written:0,inventory_writes:0,paid_model_calls:0,provider_sends:0,
 any_authenticated_merchant_grants:false
})}
function eq64(a,b){return typeof a==='string'&&typeof b==='string'&&/^[a-f0-9]{64}$/.test(a)&&/^[a-f0-9]{64}$/.test(b)&&timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'))}
function digest(s){return createHash('sha256').update(s).digest('hex')}
async function authorizeQaBusinessTool({context,request,backend}={}){
 if(!isAcceptedSyntheticContext(context))return fail('SIGNED_BACKEND_CONTEXT_REQUIRED');
 if(!backend||backend.source!=='PRIVATE_QA_READONLY_FIXTURE_ADAPTER'||typeof backend.readPinnedFixture!=='function')return fail('PRIVATE_DATA_ADAPTER_REQUIRED');
 if(!request||typeof request!=='object'||Array.isArray(request)||
   !Object.keys(request).every(x=>['capability','sku','quantity'].includes(x)))return fail('STRICT_TOOL_ARGUMENT_SCHEMA_REQUIRED');
 const capability=request.capability;
 if(!ACTIONS.has(capability)||!context.allowed_tools.includes(capability))return fail('TOOL_NOT_ALLOWED_OR_SIDE_EFFECT');
 if(capability==='support_draft'){
   if(request.sku!==undefined||request.quantity!==undefined)return fail('STRICT_SUPPORT_ARGUMENT_SCHEMA_REQUIRED');
   return Object.freeze({status:'QA_DRAFT_ONLY',capability,reply:'[QA] Yêu cầu hỗ trợ chỉ được phân loại; chưa gửi, chưa lưu phiếu.',
    source:'PRIVATE_QA_READONLY_FIXTURE_ADAPTER',orders_written:0,inventory_writes:0,
    real_price_found:false,can_send:false,provider_sends:0,paid_model_calls:0});
 }
 if(!SKU.test(request.sku||''))return fail('SKU_REQUIRED_AND_STRICT_FORMAT');
 if(capability!=='order_draft'&&request.quantity!==undefined)return fail('READ_ONLY_SKILL_REJECTS_QUANTITY');
 if(capability==='order_draft'&&(!Number.isSafeInteger(request.quantity)||request.quantity<1||request.quantity>99))return fail('DRAFT_QUANTITY_INVALID');
 let fixture;
 try{fixture=await backend.readPinnedFixture({tenantDigest:context.tenant_digest,storeDigest:context.store_digest,
    channel:context.channel,readOnly:true,source:'V15_SIGNED_QA_PRIVATE_CONTEXT'})}catch{}
 if(!fixture||fixture.source!=='V14_7_SYNTHETIC_FIXTURE'||
   typeof fixture.tenantId!=='string'||typeof fixture.storeId!=='string'||
   !eq64(digest(fixture.tenantId),context.tenant_digest)||
   !eq64(digest(fixture.storeId),context.store_digest)||!fixture.product||
   typeof fixture.product.sku!=='string')return fail('PINNED_STORE_FIXTURE_CANNOT_BE_VERIFIED');
 if(fixture.product.sku!==request.sku)return Object.freeze({
   status:'NOT_FOUND_IN_QA_STORE',capability,sku:request.sku,
   text:'[QA] Không tìm thấy mã trong danh mục synthetic của cửa hàng này.',
   price_vnd:null,stock:null,orders_written:0,inventory_writes:0,can_send:false,
   provider_sends:0,paid_model_calls:0,synthetic_only:true
 });
 const p=fixture.product;
 if(!Number.isSafeInteger(p.priceVnd)||p.priceVnd<=0||
   !Number.isSafeInteger(p.stock)||p.stock<0||typeof p.name!=='string'||p.name.length<1||p.name.length>160)return fail('INVALID_PINNED_PRICE_OR_STOCK');
 const safeBase={sku:p.sku,name:p.name,price_vnd:p.priceVnd,stock:p.stock,
  source:'V14_7_SYNTHETIC_FIXTURE',synthetic_only:true,verified_real_data:false,
  can_send:false,orders_written:0,inventory_writes:0,provider_sends:0,paid_model_calls:0};
 if(capability==='catalog_read')return Object.freeze({status:'QA_CATALOG_READ_RESULT',capability,...safeBase});
 if(capability==='price_quote')return Object.freeze({status:'QA_PRICE_QUOTE_RESULT',capability,...safeBase});
 const q=request.quantity,total=q*p.priceVnd;
 if(!Number.isSafeInteger(total)||total<0)return fail('TOTAL_INTEGER_OVERFLOW');
 if(p.stock<q)return Object.freeze({
  status:'QA_DRAFT_INSUFFICIENT_STOCK',capability,quantity:q,...safeBase,
  total_vnd:total,customer_order_confirmed:false,stock_deducted:false
 });
 return Object.freeze({
  status:'QA_ORDER_DRAFT_REQUIRES_CONFIRMATION',capability,quantity:q,
  total_vnd:total,expected_total_vnd:total,
  customer_order_confirmed:false,backend_order_execution_authorized:false,
  stock_deducted:false,...safeBase
 });
}
module.exports={authorizeQaBusinessTool};
