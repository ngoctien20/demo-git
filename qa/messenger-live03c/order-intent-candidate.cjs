'use strict';
/**
 * TIEN404 V14.5-LIVE03C — Synthetic Messenger Order Intent Candidate.
 *
 * This is a CLOSED, NO-TRANSPORT end-to-end QA candidate:
 * synthetic signed Meta-style JSON -> existing trusted HMAC Page/Store registry
 * -> deterministic conversational intent planner (stand-in for LLM proposals)
 * -> existing LIVE03B deny-by-default tool gateway -> synthetic reply object.
 *
 * Never imports n8n, HTTP, credential, Meta, Google Sheets, Supabase, PG,
 * AI provider or notifications; no process.env; never saves any real order.
 * All callers MUST supply a signed test fixture. No real Meta HMAC is used.
 * Real LLM isn't used in this candidate. Claims ONLY deterministic sandbox QA.
 */
const {createNoWriteQaDispatch}=require('../messenger-live03b/write-denial-gateway.cjs');
const MAX_TEXT=2000;
const SKU=/\b[A-Z][A-Z0-9]{1,19}\b/u;
const QTY=/^(?:(?:tôi|mình|em)\s+muốn\s+)?(?:đặt|mua)\s+(?:thử\s+)?([1-9][0-9]{0,3})\s+/iu;
const CONFIRM=/^XAC NHAN (QA-[A-F0-9]{12})$/u;
const CANCEL=/^HUY (QA-[A-F0-9]{12})$/u;
const NO_EXTERNAL_WRITES=Object.freeze({
  actualOrderWrites:0,googleSheetsWrites:0,hostedWrites:0,
  providerSends:0,stockWrites:0,externalToolCalls:0,isRealOrder:false
});
function safeReply(r){
  return Object.freeze({mode:'QA_SYNTHETIC_CONVERSATION_ONLY',
    sentToMessenger:false,providerMessageId:null,
    ...NO_EXTERNAL_WRITES,...r});
}
function fail(code){
 return safeReply({status:'DENIED',reason:code,
   text:'Không thể thực hiện yêu cầu này trong phòng thử nghiệm an toàn. Không có đơn nào được tạo.'});
}
function fmt(v){return Number.isSafeInteger(v)&&v>=0?v.toLocaleString('vi-VN')+'đ':'GIÁ_KHÔNG_HỢP_LỆ';}
function makeCandidate({mode,appSecret,pageRegistry,catalog,now}={}){
  if(mode!=='OFFLINE_SIGNED_FIXTURE_CANDIDATE_ONLY'){
    const e=new Error('LIVE03C_OFFLINE_ONLY');e.code=e.message;throw e;
  }
  const gateway=createNoWriteQaDispatch({
    mode:'OFFLINE_NO_WRITE_QA',appSecret,pageRegistry,catalog,now
  });
  const products=new Map();
  for(const row of catalog){
    if(!products.has(row.pageId))products.set(row.pageId,new Set());
    products.get(row.pageId).add(row.sku);
  }
  const knownPages=new Set(pageRegistry.map(x=>x.pageId));
  const stats={handled:0,denied:0,syntheticAgentProposals:0};
  function plan(text){
    if(typeof text!=='string'||text.length<1||text.length>MAX_TEXT)
      return {kind:'DENY',reason:'QA_TEXT_INVALID'};
    const trimmed=text.trim();
    const confirm=CONFIRM.exec(trimmed);
    if(confirm)return {kind:'TOOL',tool:'qa.order.confirm',
      arguments:{confirmationCode:confirm[1]}};
    const cancel=CANCEL.exec(trimmed);
    if(cancel)return {kind:'TOOL',tool:'qa.order.cancel',
      arguments:{confirmationCode:cancel[1]}};
    const mQty=QTY.exec(trimmed);
    if(mQty){
      const sku=(trimmed.match(SKU)||[])[0];
      if(!sku)return {kind:'DENY',reason:'ORDER_SKU_REQUIRED'};
      return {kind:'PREPARE',sku,quantity:Number(mQty[1])};
    }
    if(/(?:giá|bao nhiêu|báo giá|còn hàng|tồn kho)/iu.test(trimmed)){
      const sku=(trimmed.match(SKU)||[])[0];
      if(!sku)return {kind:'DENY',reason:'QUOTE_SKU_REQUIRED'};
      return {kind:'TOOL',tool:'quote.read',arguments:{sku,quantity:1}};
    }
    if(/(?:có|sản phẩm|thông tin|tư vấn)/iu.test(trimmed)){
      const sku=(trimmed.match(SKU)||[])[0];
      if(!sku)return {kind:'DENY',reason:'CATALOG_SKU_REQUIRED'};
      return {kind:'TOOL',tool:'catalog.read',arguments:{sku}};
    }
    if(/(?:xin chào|chào|hello)/iu.test(trimmed))return {kind:'GREETING'};
    return {kind:'DENY',reason:'UNSUPPORTED_QA_INTENT'};
  }
  function replyFor(handled,tool){
    if(!handled.allowed){
      stats.denied++;
      return fail(handled.reason||'TOOL_DENIED');
    }
    if(handled.status==='SYNTHETIC_CATALOG_RESULT'){
      const p=handled.product;
      return safeReply({status:'QA_REPLY_READY',tool,
        text:'[MÔ PHỎNG] '+p.sku+' — '+p.name+'. Giá niêm yết QA '+fmt(p.priceVnd)+
          '; tồn kho mẫu '+p.stock+'. Chưa đặt hàng.'});
    }
    if(handled.status==='SYNTHETIC_QUOTE'){
      return safeReply({status:'QA_REPLY_READY',tool,
        text:'[MÔ PHỎNG] SKU '+handled.sku+': '+handled.quantity+' × '+
          fmt(handled.unitPriceVnd)+' = '+fmt(handled.totalVnd)+
          '; tồn kho mẫu '+handled.stockSnapshot+'. Chưa tạo đơn.'});
    }
    if(handled.status==='AWAITING_EXPLICIT_QA_CONFIRMATION'){
      return safeReply({status:'QA_CONFIRMATION_REQUIRED',tool,
        qaCode:handled.confirmationCode,
        text:'[MÔ PHỎNG] Yêu cầu '+handled.quantity+' sản phẩm, tổng '+fmt(handled.totalVnd)+
          '. Để kiểm thử riêng bước xác nhận, dùng: XAC NHAN '+
          handled.confirmationCode+'. Chưa lưu bất kỳ đơn nào.'});
    }
    if(handled.status==='SIMULATED_QA_REQUEST_NOT_SAVED'){
      return safeReply({status:'QA_MOCK_CONFIRMED_NOT_SAVED',tool,
        qaCode:handled.qaRequestCode,replayed:handled.replay,
        text:'[MÔ PHỎNG] Đã xác nhận yêu cầu QA '+handled.qaRequestCode+
          '. KHÔNG phải đơn đã lưu, không trừ kho và không gửi cho shop.'});
    }
    if(handled.status==='QA_REQUEST_CANCELLED_NOT_SAVED'){
      return safeReply({status:'QA_MOCK_CANCELLED',tool,
        text:'[MÔ PHỎNG] Đã hủy yêu cầu QA chưa xác nhận. Không có đơn nào được lưu.'});
    }
    stats.denied++;
    return fail('UNKNOWN_TOOL_RESULT');
  }
  // A raw signed fixture is the only accepted event source. Even a forged
  // syntheticAgentProposal cannot bypass the tool boundary.
  function handleSigned({rawBody,signature,syntheticAgentProposal}={}){
    let context,body;
    try{
      context=gateway.ingress({rawBody,signature});
      body=JSON.parse(rawBody.toString('utf8'));
    }catch(e){
      stats.denied++;
      return fail(e?.code||'SIGNED_INGRESS_REJECTED');
    }
    const entry=body.entry?.[0],evt=entry?.messaging?.[0];
    if(!entry||!knownPages.has(entry.id)||!evt||
      typeof evt.message?.text!=='string'){
      stats.denied++;return fail('INVALID_TRUSTED_EVENT_SHAPE');
    }
    // No sender, PSID, user-input text, token or raw request is returned.
    stats.handled++;
    let p;
    if(syntheticAgentProposal!==undefined){
      stats.syntheticAgentProposals++;
      p={kind:'QA_AGENT_PROPOSAL',value:syntheticAgentProposal};
    }else{
      p=plan(evt.message.text);
    }
    if(p.kind==='GREETING')return safeReply({status:'QA_REPLY_READY',tool:null,
      text:'[MÔ PHỎNG] Chào bạn! Bạn có thể hỏi giá hoặc tư vấn sản phẩm theo mã SKU. Đây không phải bot Messenger đang hoạt động.'});
    if(p.kind==='DENY'){stats.denied++;return fail(p.reason);}
    if(p.kind==='QA_AGENT_PROPOSAL'){
      const result=gateway.dispatch(context,p.value);
      return replyFor(result,p.value?.tool||null);
    }
    if(p.kind==='PREPARE'){
      // Read trusted price/stock first; never take unit price from sender/LLM.
      const q=gateway.dispatch(context,{tool:'quote.read',
        arguments:{sku:p.sku,quantity:p.quantity}});
      if(!q.allowed)return replyFor(q,'quote.read');
      const r=gateway.dispatch(context,{tool:'qa.order.prepare',
        arguments:{sku:p.sku,quantity:p.quantity,expectedTotalVnd:q.totalVnd}});
      return replyFor(r,'qa.order.prepare');
    }
    if(p.kind==='TOOL'){
      const r=gateway.dispatch(context,{tool:p.tool,arguments:p.arguments});
      return replyFor(r,p.tool);
    }
    stats.denied++;return fail('DEFAULT_DENY');
  }
  function inspect(){
    const status=gateway.inspect();
    return Object.freeze({
      mode:'OFFLINE_SIGNED_FIXTURE_CANDIDATE_ONLY',
      integration:'SIGNED_RAW_HMAC_TO_STORE_TO_DETERMINISTIC_PLANNER_TO_DENY_GATE_TO_REPLY',
      providerSendTransport:false,actualMessengerWebhook:false,
      realLlmCalls:false,hasAnyExternalWriteTool:false,
      attachedToPublished:false,actualOrderWrites:0,
      hostedWrites:0,providerSends:0,
      durableReplayAcrossProcesses:false,
      servedSignedTestMessages:stats.handled,
      rejectedTestMessages:stats.denied,
      simulatedAgentToolProposals:stats.syntheticAgentProposals,
      simulatedPending:status.pendingQaRequestsInMemory,
      simulatedConfirmed:status.confirmedQaRequestsInMemory,
      approvalToWireRealPage:false
    });
  }
  return Object.freeze({handleSigned,inspect});
}
module.exports={makeCandidate};
