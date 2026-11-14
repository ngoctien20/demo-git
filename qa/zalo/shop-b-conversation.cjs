'use strict';
// TIEN404 Shop B Zalo conversation candidate. Pure computation: NO DB writes, NO HTTP sends.
// Only trusted server code may provide binding, catalog, message event and cryptographic challenge.
const SCOPE = Object.freeze({tenant_key:'qa-tenant-b',store_key:'qa-store-b',bot_key:'qa-bot-b'});
const MAX_TURNS=32, TTL_MS=30*60*1000;
const normalize=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').toLowerCase().trim().replace(/\s+/g,' ');
const done=(kind,reply,state,extras={})=>Object.freeze({
  kind, reply:reply ? '[SANDBOX-ONLY] '+reply : null, state,
  external_sends:0, orders_written:0, ...extras
});
const invalid=(code)=>{const e=new Error(code);e.code=code;throw e;};
const safeId=(x,max=128)=>typeof x==='string' && x.length>0 && x.length<=max && /^[a-zA-Z0-9:_-]+$/.test(x);
const int=(x)=>Number.isSafeInteger(x)&&x>=0;
function gate(binding,event,now){
  if(!binding || binding.server_verified!==true || binding.owner_binding_confirmed!==true ||
     binding.owner_recipient_verified!==true || binding.source!=='AUTHENTICATED_STAGING_BACKEND' ||
     binding.enabled_mode!=='dry_run'||binding.identity_status!=='synthetic_qa' ||
     Object.keys(SCOPE).some(k=>binding[k]!==SCOPE[k])||!safeId(binding.scope_key) ||
     !safeId(binding.recipient_chat_id)||!Number.isFinite(Date.parse(binding.expires_at)) ||
     Date.parse(binding.expires_at)<=now) invalid('SHOP_B_BINDING_REQUIRED');
  if(!event||event.stage!=='READ_ONLY'||event.accepted!==true||
     event.eventName!=='message.text.received'||event.chatType!=='PRIVATE'||
     event.chatId!==binding.recipient_chat_id||!safeId(event.messageId)||
     typeof event.text!=='string'||!event.text.trim()||event.text.length>512)
    invalid('INBOUND_OWNER_GATE_DENIED');
}
function products(binding,catalog){
  if(!catalog || catalog.source!=='SUPABASE_STAGING_READBACK'||catalog.readback_verified!==true||
     Object.keys(SCOPE).some(k=>catalog[k]!==binding[k]) ||
     !Array.isArray(catalog.rows)||catalog.rows.length<1||catalog.rows.length>30)
    invalid('CATALOG_NOT_TRUSTED');
  const list=[], seen=new Set();
  for(const p of catalog.rows){
    if(!p || Object.keys(SCOPE).some(k=>p[k]!==binding[k]) ||
       typeof p.sku!=='string'||!/^[A-Z]{1,4}[0-9]{2,5}$/.test(p.sku)||
       seen.has(p.sku)||typeof p.product_name!=='string'||
       !p.product_name.trim()||p.product_name.length>80||
       /[\r\n\u0000-\u001f]/.test(p.product_name)||
       !Number.isSafeInteger(p.price_vnd)||p.price_vnd<=0||
       !int(p.stock)||p.stock>1_000_000)
      invalid('CATALOG_ROW_NOT_TRUSTED');
    seen.add(p.sku);list.push(p);
  }
  return list;
}
function initialState(scope,now){
  return {version:1,scope,phase:'idle',sku:null,qty:null,quoted_total:null,
    confirmation_code:null,order_key:null,receipts:[],expires_at:now+TTL_MS};
}
function stateCheck(input,scope,now){
  if(input===undefined||input===null)return initialState(scope,now);
  if(!input||input.version!==1||input.scope!==scope||
     !['idle','viewing','await_quantity','await_confirmation','commit_pending'].includes(input.phase)||
     !Number.isFinite(input.expires_at)||!Array.isArray(input.receipts)||
     input.receipts.length>MAX_TURNS||input.receipts.some(x=>!safeId(x,128))||
     (input.sku!==null&&input.sku!==undefined&&!/^[A-Z]{1,4}[0-9]{2,5}$/.test(input.sku))||
     (input.qty!==null&&input.qty!==undefined&&!Number.isSafeInteger(input.qty)))
    invalid('STATE_INVALID_OR_FOREIGN');
  if(input.expires_at<=now)return initialState(scope,now);
  if(input.phase==='await_confirmation'&&
     (!Number.isSafeInteger(input.quoted_total)||input.quoted_total<=0||
      !/^[A-F0-9]{24,32}$/.test(input.confirmation_code||'')||
      !safeId(input.order_key||'',90))) invalid('CONFIRMATION_STATE_INVALID');
  return {...input,receipts:[...input.receipts]};
}
const vnd=x=>x.toLocaleString('vi-VN')+'đ';
function turn({binding,event,catalog,state,now=Date.now(),issued_confirmation_code,issued_order_key}){
  gate(binding,event,now);
  const rows=products(binding,catalog);
  const previous=stateCheck(state,binding.scope_key,now);
  if(previous.receipts.includes(event.messageId))return done('duplicate',null,previous);
  if(previous.receipts.length===MAX_TURNS)invalid('SESSION_CAPACITY_REACHED');
  const next={...previous,receipts:[...previous.receipts,event.messageId],expires_at:Math.min(now+TTL_MS,Date.parse(binding.expires_at))};
  const q=normalize(event.text);
  const cancel=/^(?:huy|huy don|thoi|bo qua|khong lay|khong mua|dung lai)(?: nhe)?[.!?]*$/.test(q);
  const reply=(kind,text,patch={},extras={})=>done(kind,text,{...next,...patch},extras);
  if(cancel)return reply('cancel','Đã huỷ lựa chọn thử nghiệm; chưa tạo đơn.',{phase:'idle',sku:null,qty:null,quoted_total:null,confirmation_code:null,order_key:null});
  if(previous.phase==='commit_pending')return reply('pending','Yêu cầu xác nhận QA đang chờ backend đối soát; không tạo thêm đơn.');
  if(/(?:token|mat khau|api key|secret|bo qua (quy tac|huong dan)|shop a|cua hang a|don cua shop khac|tenant khac)/.test(q))
    return reply('denied','Không thể cung cấp dữ liệu hoặc chuyển sang cửa hàng khác.');
  if(/^(?:xac nhan|dong y|chot don)(?: .*?)?$/.test(q) && !/^xac nhan qa [a-f0-9]{24,32}$/.test(q))
    return reply('explicit_confirmation_required','Cần xác nhận chính xác bằng mã xác nhận QA đã cấp; chưa tạo đơn.');
  const confirmation=q.match(/^xac nhan qa ([a-f0-9]{24,32})$/);
  if(confirmation){
    if(previous.phase!=='await_confirmation'||confirmation[1].toUpperCase()!==previous.confirmation_code)
      return reply('confirmation_denied','Mã xác nhận hoặc trạng thái đơn QA không hợp lệ.');
    const p=rows.find(x=>x.sku===previous.sku);
    if(!p||!Number.isSafeInteger(previous.qty)||previous.qty<1||
       previous.qty>p.stock||previous.qty*p.price_vnd!==previous.quoted_total)
      return reply('stale_quote','Giá hoặc tồn kho đã thay đổi; cần lập báo giá mới.',{
        phase:'viewing',sku:p?.sku||null,qty:null,quoted_total:null,confirmation_code:null,order_key:null
      });
    return reply('sandbox_commit_proposal','Đã xác nhận bản nháp. Đang chờ backend ghi đơn sandbox; chưa có mã đơn đã lưu.',
      {phase:'commit_pending'},{
        commit_proposal:{
          tenant_key:binding.tenant_key,store_key:binding.store_key,bot_key:binding.bot_key,
          order_key:previous.order_key,sku:p.sku,quantity:previous.qty,
          unit_price_vnd:p.price_vnd,expected_total_vnd:previous.quoted_total,
          confirmation_code:previous.confirmation_code,
          requires_backend_idempotency:true,requires_order_readback:true,
          write_executed:false
        }});
  }
  const skuTokens=q.match(/\b[a-z]{1,4}\d{2,5}\b/g)||[];
  if(skuTokens.some(code=>!rows.some(p=>p.sku.toLowerCase()===code)))
    return reply('missing','Mã sản phẩm chưa có trong Shop B; vui lòng kiểm tra lại.');
  if(new Set(skuTokens).size>1)
    return reply('clarify','Vui lòng hỏi từng sản phẩm để tránh nhầm giá.');
  let p=skuTokens.length?rows.find(x=>x.sku.toLowerCase()===skuTokens[0]):rows.find(x=>x.sku===previous.sku);
  if(/(?:gia|chot gia|giam gia|tra) \d[\d.,]*\s*(?:d|dong|k)?/.test(q)||
     (/\d[\d.,]*\s*(?:d|dong|k)\b/.test(q)&&!/\bmua\b|\blay\b|\bdat\b/.test(q)))
    return reply('price_denied','Shop B chỉ báo giá từ dữ liệu cửa hàng; không tự chấp nhận giá đề xuất.');
  const buy=/(?:^|\s)(?:mua|lay|dat|chot)(?:\s|$)/.test(q);
  const qtyOnly=/^\d{1,5}$/.test(q)&&previous.phase==='await_quantity';
  const numeric=buy?q.match(/\b\d{1,5}\b/g)||[]:qtyOnly?[q]:[];
  const productMatch=q.includes('ao thun den')||q.includes('ao den');
  if(!p&&productMatch){
    const matches=rows.filter(x=>normalize(x.product_name).includes('ao thun den'));
    if(matches.length===1)p=matches[0];
  }
  if(!p){
    if(q==='xin chao'||q==='chao'||q==='hi'||q==='hello')
      return reply('greeting','Chào bạn! Bot Shop B đang thử nghiệm. Bạn có thể hỏi giá hoặc tồn kho mã F01.');
    return reply('clarify','Bạn muốn xem mã sản phẩm nào của Shop B? Ví dụ: F01.');
  }
  const viewing={sku:p.sku,qty:null,quoted_total:null,confirmation_code:null,order_key:null};
  if(p.stock===0)return reply('out_of_stock',p.product_name+' đang hết hàng (dữ liệu QA).',{...viewing,phase:'viewing'});
  if(buy||qtyOnly){
    if(numeric.length!==1||!/^\d+$/.test(numeric[0]))
      return reply('await_quantity','Bạn muốn lấy bao nhiêu sản phẩm '+p.sku+'?',{...viewing,phase:'await_quantity'});
    const qty=Number(numeric[0]);
    if(!Number.isSafeInteger(qty)||qty<1||qty>p.stock)
      return reply('invalid_quantity','Số lượng phải từ 1 đến '+p.stock+' (tồn kho QA).',{...viewing,phase:'await_quantity'});
    if(!/^[A-F0-9]{24,32}$/.test(issued_confirmation_code||'')||!safeId(issued_order_key||'',90))
      return reply('challenge_unavailable','Backend chưa cấp mã xác nhận đơn QA an toàn, không thể chốt đơn.',{...viewing,phase:'viewing'});
    const total=qty*p.price_vnd;
    if(!Number.isSafeInteger(total))invalid('TOTAL_OVERFLOW');
    return reply('await_confirmation',
      'Bản nháp Shop B: '+p.product_name+', '+qty+' × '+vnd(p.price_vnd)+' = '+vnd(total)+
      '. Để xác nhận thử nghiệm, gửi: XAC NHAN QA '+issued_confirmation_code+'. Chưa lưu hoặc trừ kho.',
      {phase:'await_confirmation',sku:p.sku,qty,quoted_total:total,confirmation_code:issued_confirmation_code,order_key:issued_order_key},
      {draft:{sku:p.sku,quantity:qty,unit_price_vnd:p.price_vnd,total_vnd:total,status:'draft_only'}});
  }
  return reply('catalog',p.product_name+' (mã '+p.sku+') giá '+vnd(p.price_vnd)+
    ', còn '+p.stock+' trong kho QA. Muốn mua, nhắn “mua '+p.sku+' 2”.',
    {...viewing,phase:'viewing'}, {facts:{sku:p.sku,price_vnd:p.price_vnd,stock:p.stock}});
}
module.exports={turn,initialState,normalize,TTL_MS};
