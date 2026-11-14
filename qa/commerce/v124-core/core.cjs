'use strict';
// Channel-neutral V12.4 sandbox AI Sales preview. No external send/write APIs.
const {readFreshQaProduct}=require('./catalog.cjs');
const INTENTS=new Set(['GREETING','PRODUCT_QUERY','ORDER_PREVIEW','HUMAN','CANCEL','UNKNOWN']);
const forbidden=/\b(?:admin|owner|ghep|set|delete|xoa|sua)\b/i;
const injection=/\b(?:secret|token|api key|mat khau|system prompt|bo qua chi dan|du lieu shop khac)\b/i;
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/\s+/g,' ').trim();
const vnd=n=>n.toLocaleString('vi-VN')+'đ';
function redact(text){
 return String(text||'').replace(/(?:\+84|0)\d{9}\b/g,'[PHONE]').replace(/\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/gi,'[EMAIL]');
}
function result(status,replyCandidate=null,details={}){
 const out={stage:'V12_4_CORE_SANDBOX',status,replyCandidate,
  externalSends:0,ordersWritten:0,outboxWrites:0,customerMessagesSent:0,
  readyForZalo:false,productionReady:false,mode:'PREVIEW_ONLY',...details};
 // These constants override any optional metadata.
 out.externalSends=0;out.ordersWritten=0;out.outboxWrites=0;out.customerMessagesSent=0;
 out.readyForZalo=false;out.productionReady=false;
 return Object.freeze(out);
}
function parseQty(s){
 const a=s.match(/\b(?:mua|lay|dat)\s+(?:[a-z]{1,4}\d{2,5}\s+)?(\d{1,4})\b/);
 const b=s.match(/\b(?:mua|lay|dat)\s+(\d{1,4})\s+[a-z]{1,4}\d{2,5}\b/);
 return a?Number(a[1]):b?Number(b[1]):null;
}
function createReadOnlyReplyCore({ingress,repository,classifier,receipts,limiter,clock=()=>Date.now()}={}){
 if(!ingress||typeof ingress.verify!=='function'||!repository||
    !classifier||typeof classifier.classify!=='function'||
    !receipts||typeof receipts.claim!=='function'||
    !limiter||typeof limiter.allow!=='function')throw Error('CORE_PORTS_REQUIRED');
 return Object.freeze({async preview(envelope){
  let e;
  try{e=ingress.verify(envelope);}catch{return result('INGRESS_DENIED');}
  if(e.trust!=='SIGNED_INTERNAL_QA_FIXTURE'||e.channel!=='qa-fixture')
    return result('CHANNEL_NOT_INTEGRATED');
  let allowed;
  try{
   allowed=await limiter.allow({scopeKey:e.scopeKey,actorHash:e.actorHash});
   if(!allowed)return result('RATE_LIMITED');
   if(!await receipts.claim({scopeKey:e.scopeKey,receiptHash:e.receiptHash}))
    return result('DUPLICATE_BLOCKED');
  }catch{return result('STATE_PORT_UNAVAILABLE');}
  const s=norm(e.text);
  if(forbidden.test(s)&&/^(?:admin|owner|ghep|set|delete|xoa|sua)\b/.test(s))
    return result('OWNER_COMMAND_DENIED');
  if(injection.test(s))return result('PROMPT_INJECTION_DENIED');
  let model;
  try{model=await classifier.classify({text:redact(e.text)});}
  catch(err){return result(err?.code==='MODEL_COST_GATE_UNVERIFIED'||err?.message==='MODEL_COST_GATE_UNVERIFIED'?
    'MODEL_BUDGET_BLOCKED':'MODEL_UNAVAILABLE');}
  if(!model||typeof model!=='object'||Array.isArray(model)||
     Object.keys(model).sort().join(',')!=='intent,quantity,sku'||
     !INTENTS.has(model.intent)||
     (model.sku!=='UNKNOWN'&&!/^[A-Z]{1,4}\d{2,5}$/.test(model.sku))||
     (model.quantity!==null&&(!Number.isSafeInteger(model.quantity)||model.quantity<1)))
    return result('MODEL_OUTPUT_REJECTED');
  if(model.intent==='GREETING')return result('GREETING','Dạ chào mình! Shop có thể hỗ trợ tìm sản phẩm. Đây là bản tư vấn thử nghiệm.');
  if(model.intent==='HUMAN')return result('HUMAN_HANDOFF','Dạ, mình cần nhân viên hỗ trợ. Hiện hệ thống chưa tự chuyển tin đến nhân viên.');
  if(model.intent==='CANCEL')return result('CANCELLED','Dạ, shop ghi nhận mình muốn dừng. Chưa có đơn nào được tạo.');
  if(model.intent==='UNKNOWN'||model.sku==='UNKNOWN')
    return result('NEED_PRODUCT','Dạ, mình cho shop xin mã sản phẩm để tra cứu chính xác nhé.');
  const mentioned=s.match(/\b[a-z]{1,4}\d{2,5}\b/g)||[];
  if(!mentioned.some(t=>t.toUpperCase()===model.sku)||
     mentioned.some(t=>t.toUpperCase()!==model.sku))
    return result('MODEL_SKU_MISMATCH','Dạ, mình vui lòng xác nhận lại mã sản phẩm nhé.');
  let found;
  try{found=await readFreshQaProduct({repository,context:e,sku:model.sku,clock});}
  catch{return result('CATALOG_UNTRUSTED');}
  if(found.status==='NOT_FOUND')return result('PRODUCT_NOT_FOUND','Dạ, shop chưa tìm thấy sản phẩm này trong dữ liệu thử nghiệm.');
  if(found.status==='STALE'||found.status==='INVALID')
    return result('CATALOG_NOT_FRESH','Dạ, thông tin giá và tồn kho chưa đủ mới; shop cần kiểm tra lại trước khi báo giá.');
  if(found.status!=='OK')return result('CATALOG_UNTRUSTED');
  const p=found.product;
  if(model.intent==='PRODUCT_QUERY')
    return result('PRODUCT_QA_PREVIEW','[QA] '+p.name+' có giá thử nghiệm '+vnd(p.priceVnd)+
      ', tồn kho QA '+p.stock+'. Chưa xác nhận giá hiện tại.',{scope:e.storeId,sku:p.sku});
  if(model.intent==='ORDER_PREVIEW'){
    const exact=parseQty(s);
    if(!Number.isSafeInteger(exact)||exact<1||model.quantity!==exact)
      return result('QUANTITY_UNVERIFIED','Dạ, mình muốn lấy chính xác bao nhiêu sản phẩm ạ?');
    if(exact>p.stock)return result('INSUFFICIENT_STOCK','Dạ, số lượng vượt tồn kho QA; shop cần kiểm tra lại.');
    const total=exact*p.priceVnd;
    if(!Number.isSafeInteger(total))return result('TOTAL_INVALID');
    return result('ORDER_QA_PREVIEW','[QA] '+p.name+': '+exact+' × '+vnd(p.priceVnd)+' = '+vnd(total)+
      '. Chưa tạo đơn, giữ hàng hoặc trừ kho.',{scope:e.storeId,sku:p.sku,quantity:exact,totalVnd:total});
  }
  return result('SAFE_FALLBACK');
 }});
}
module.exports={createReadOnlyReplyCore,redact};
