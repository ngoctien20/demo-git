'use strict';
const {readFreshQaProduct} = require('./catalog.cjs');
const {isVerifiedCustomer} = require('./ingress.cjs');
const {normalise, skusIn, parseQuantity, intents} = require('./intent.cjs');
const vnd = amount => amount.toLocaleString('vi-VN')+'đ';
const redact = text => String(text || '').replace(/(?<![\d+])(?:\+84|0)(?:[ .()-]*\d){9}(?!\d)/g,'[PHONE]')
  .replace(/\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/gi,'[EMAIL]');
const guard = s => /^(?:admin|owner|ghep|set|delete|xoa|sua)\b/.test(s) ? 'OWNER_COMMAND_DENIED' :
  /\b(?:secret|token|api key|mat khau|system prompt|bo qua (?:chi dan|huong dan)|du lieu shop khac)\b/.test(s) ? 'PROMPT_INJECTION_DENIED' : null;

function result(status, replyCandidate = null, details = {}) {
  return Object.freeze({...details, stage:'V12_4_CORE_SANDBOX', status, replyCandidate,
    externalSends:0, ordersWritten:0, outboxWrites:0, customerMessagesSent:0,
    readyForZalo:false, productionReady:false, mode:'PREVIEW_ONLY'});
}
function complete(status, reply, phase, sku = null, quantity = null, details = {}) {
  return {reply:result(status,reply,{...details,phase}), next:{phase,sku,quantity}};
}
function keep(status, prior, reply = null) {
  return {reply:result(status,reply,{phase:prior.phase}), next:prior};
}
const emptyState = () => ({phase:'NEW',sku:null,quantity:null});
function validModel(m) {
  return m && !Array.isArray(m) && Object.keys(m).sort().join(',') === 'intent,quantity,sku' &&
    intents.has(m.intent) && typeof m.sku === 'string' && (m.sku === 'UNKNOWN' || /^[A-Z]{1,4}\d{2,5}$/.test(m.sku)) &&
    (m.quantity === null || (Number.isSafeInteger(m.quantity) && m.quantity >= 1 && m.quantity <= 9999));
}

function createReadOnlyReplyCore({ingress,repository,classifier,receipts,limiter,sessions,clock=Date.now,modelTimeoutMs=1500}={}) {
  if (!Number.isSafeInteger(modelTimeoutMs) || modelTimeoutMs<1 || modelTimeoutMs>3000) throw Error('MODEL_TIMEOUT_INVALID');
  if (typeof ingress?.verify!=='function' || typeof repository?.readProduct!=='function' || typeof classifier?.classify!=='function' ||
      (sessions ? typeof sessions.process!=='function' : typeof receipts?.claim!=='function' || typeof limiter?.allow!=='function'))
    throw Error('CORE_PORTS_REQUIRED');

  async function plan(e, prior, client) {
    const s = normalise(e.text), denied = guard(s);
    if (denied) return keep(denied, prior);
    // Keep service failures retryable in the transactional port. Never store raw text or a model reply.
    const abort = new AbortController();
    const timer = setTimeout(()=>abort.abort(), modelTimeoutMs);
    let model;
    try {
      const timeout = new Promise((_,reject)=>abort.signal.addEventListener('abort',()=>reject(Error('MODEL_TIMEOUT')),{once:true}));
      model = await Promise.race([timeout, classifier.classify({text:redact(e.text), signal:abort.signal})]);
    } catch (err) {
      throw Error(err?.message === 'MODEL_COST_GATE_UNVERIFIED' ? 'MODEL_COST_GATE_UNVERIFIED' : 'MODEL_UNAVAILABLE');
    } finally {clearTimeout(timer);}
    if (!validModel(model)) return keep('MODEL_OUTPUT_REJECTED',prior);
    const {intent} = model, codes = skusIn(s);
    if (model.sku !== 'UNKNOWN' && !codes.includes(model.sku))
      return keep('MODEL_SKU_MISMATCH',prior,'Mình xác nhận lại mã sản phẩm giúp shop nhé.');
    if (codes.length > 1 && (intent !== 'COMPARE' || codes.length !== 2))
      return keep('MODEL_SKU_MISMATCH',prior,'Mình muốn xem giá mã nào trước ạ?');
    if (intent === 'CANCEL') return complete('CANCELLED','Shop đã dừng bản nháp của mình. Chưa có đơn nào được tạo.','CANCELLED');
    if (intent === 'HUMAN') return complete('HUMAN_HANDOFF','Trường hợp này cần nhân viên hỗ trợ. Bản thử nghiệm chưa tự chuyển tin.','HANDOFF_REQUIRED');
    if (intent === 'GREETING') return keep('GREETING',prior,'Chào mình! Mình muốn xem mẫu nào ạ?');
    if (intent === 'PROMOTION') return keep('POLICY_UNVERIFIED',prior,'Shop cần kiểm tra chính sách áp dụng trước khi báo ưu đãi hoặc phí giao hàng.');
    if (intent === 'RECOMMEND') return complete('ASK_PREFERENCE','Mình đang tìm loại sản phẩm nào, tầm giá bao nhiêu ạ?','DISCOVERING');
    if (intent === 'CONFIRM') return keep('PREVIEW_ONLY',prior,'Mình đang dùng bản thử nghiệm. Shop chưa tạo đơn hay giữ hàng.');
    if (intent === 'UNKNOWN') return keep('NEED_PRODUCT',prior,'Mình cho shop xin mã sản phẩm muốn xem nhé.');
    const sku = codes[0] || prior.sku;
    if (!sku || (codes.length && model.sku !== sku) || (intent==='COMPARE' && codes.length!==2))
      return complete('NEED_PRODUCT',prior.phase === 'EXPIRED' ? 'Phiên trước đã hết hạn. Mình cho shop xin lại mã sản phẩm nhé.' :
        'Mình cho shop xin mã sản phẩm cần tra nhé.',prior.phase === 'EXPIRED' ? 'EXPIRED' : 'WAITING_FOR_CUSTOMER');
    async function lookup(code) {
      try {return await readFreshQaProduct({repository, context:e, sku:code, clock, client});}
      catch {throw Error('CATALOG_UNTRUSTED');}
    }
    const products = [];
    for (const code of intent==='COMPARE' ? codes : [sku]) {
      const found = await lookup(code);
      if (found.status==='NOT_FOUND') return complete('PRODUCT_NOT_FOUND','Shop chưa tìm thấy mã này. Mình kiểm tra lại mã giúp shop nhé.','DISCOVERING');
      if (found.status!=='OK') return complete('CATALOG_NOT_FRESH','Shop cần kiểm tra lại giá và tồn kho trước khi tư vấn.','WAITING_FOR_CUSTOMER');
      products.push(found.product);
    }
    const p = products[0], details = {scope:e.storeId,sku:p.sku};
    if (intent==='COMPARE') return complete('COMPARE_PREVIEW','[QA] '+products.map(x=>x.sku+' giá '+vnd(x.priceVnd)+', còn '+x.stock).join('. ')+'. Mình muốn xem mã nào?', 'DISCOVERING');
    if (intent==='WHOLESALE') {
      const reply = p.wholesale ? '[QA] '+p.sku+' từ '+p.wholesale.minQuantity+' sản phẩm có giá '+vnd(p.wholesale.priceVnd)+'/sản phẩm.' :
        'Shop chưa có bảng giá sỉ đã xác minh cho '+p.sku+'. Mình cần bao nhiêu sản phẩm ạ?';
      return complete(p.wholesale?'WHOLESALE_PREVIEW':'WHOLESALE_UNVERIFIED',reply,'PRODUCT_SELECTED',p.sku);
    }
    if (intent==='PRODUCT_QUERY')
      return complete('PRODUCT_QA_PREVIEW','[QA] '+p.sku+' giá '+vnd(p.priceVnd)+', '+(p.stock?'còn '+p.stock+' sản phẩm.':'đã hết hàng.'),'PRODUCT_SELECTED',p.sku,null,details);
    const exact = parseQuantity(s);
    if (!exact || model.quantity !== exact) return complete('QUANTITY_UNVERIFIED','Mình muốn lấy chính xác bao nhiêu sản phẩm ạ?','WAITING_FOR_CUSTOMER',sku);
    if (exact > p.stock) return complete('INSUFFICIENT_STOCK','Số lượng này vượt tồn kho thử nghiệm. Mình muốn chọn lại số lượng không ạ?','WAITING_FOR_CUSTOMER',sku);
    const price = p.wholesale && exact >= p.wholesale.minQuantity ? p.wholesale.priceVnd : p.priceVnd;
    const total = exact * price;
    if (!Number.isSafeInteger(total)) return complete('TOTAL_INVALID','Shop cần kiểm tra lại tổng tiền.','WAITING_FOR_CUSTOMER',sku);
    return complete('ORDER_QA_PREVIEW','[QA] '+sku+': '+exact+' × '+vnd(price)+' = '+vnd(total)+'. Chưa tạo đơn hoặc giữ hàng.',
      'QUOTE_PREVIEW',sku,exact,{...details,quantity:exact,totalVnd:total});
  }

  return Object.freeze({async preview(envelope) {
    let e;
    try {e=ingress.verify(envelope);} catch {return result('INGRESS_DENIED');}
    if (!isVerifiedCustomer(e)) return result('CHANNEL_NOT_INTEGRATED');
    try {
      if (sessions) {
        const turn = await sessions.process(e, (prior, client)=>plan(e,prior,client));
        return turn.reply || result(turn.status);
      }
      if (!await limiter.allow(e)) return result('RATE_LIMITED');
      if (!await receipts.claim(e)) return result('DUPLICATE_BLOCKED');
    } catch (err) {
      return result(['CATALOG_UNTRUSTED','MODEL_BUDGET_BLOCKED','MODEL_UNAVAILABLE'].includes(err.message) ? err.message :
        err.message==='MODEL_COST_GATE_UNVERIFIED' ? 'MODEL_BUDGET_BLOCKED' : 'STATE_PORT_UNAVAILABLE');
    }
    try { return (await plan(e,emptyState())).reply; }
    catch(err) {return result(err.message==='MODEL_COST_GATE_UNVERIFIED' ? 'MODEL_BUDGET_BLOCKED' :
      err.message==='CATALOG_UNTRUSTED' ? 'CATALOG_UNTRUSTED' : 'MODEL_UNAVAILABLE');}
  }});
}
module.exports={createReadOnlyReplyCore,redact,emptyState};
