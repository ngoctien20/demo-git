'use strict';
/** Deterministic intent proposal ONLY: never a trust, authorization or data cache. */
const ORDER=/^(?:tra|kiểm tra|xem)\s+(?:đơn|mã đơn)\s+(QA-[A-Z0-9]{8})\s*$/iu;
const PRICE=/^(?:giá|báo giá)\s+([A-Z][0-9]{3})\s*$/iu;
function routeFastPath(text){
 if(typeof text!=='string'||text.length<1||text.length>2000)
   return Object.freeze({status:'REJECT_INPUT',model_calls:0,authorized:false});
 const trimmed=text.normalize('NFC').trim(), order=ORDER.exec(trimmed),price=PRICE.exec(trimmed);
 if(order)return Object.freeze({status:'AUTH_REQUIRED_ORDER_LOOKUP',order_code:order[1],
   model_calls:0,authorized:false,no_sensitive_cache:true});
 if(price)return Object.freeze({status:'AUTH_REQUIRED_CATALOG_QUOTE',sku:price[1],
   model_calls:0,authorized:false,no_sensitive_cache:true});
 return Object.freeze({status:'MODEL_OR_HUMAN_REVIEW_REQUIRED',model_calls:null,
   authorized:false,no_sensitive_cache:true});
}
module.exports={routeFastPath};