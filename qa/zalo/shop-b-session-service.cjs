'use strict';
// TIEN404 V12.2 Shop B conversational staging orchestration.
// No network, n8n dispatch, Zalo sends or Order writes.
// Repository adapter MUST execute transact(scope) with an atomic row lock
// + deduped receipt in the SAME database transaction, not read-then-write.
const crypto = require('node:crypto');
const SCOPE={tenant_key:'qa-tenant-b',store_key:'qa-store-b',bot_key:'qa-bot-b'};
const SESSION_TTL_MS=30*60_000;
const QUOTE_TTL_MS=10*60_000;
const fail=(code)=>{const e=new Error(code);e.code=code;throw e;};
const valid=(v,n=150)=>typeof v==='string'&&v.length>0&&v.length<=n&&/^[a-zA-Z0-9:_-]+$/.test(v);
const normalize=(value)=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').toLowerCase().trim().replace(/\s+/g,' ');
const hash=(text)=>crypto.createHash('sha256').update(text).digest('hex');
const cents=(v)=>v.toLocaleString('vi-VN')+'đ';
const response=(status,reply,extra={})=>({status,reply:reply?'[SANDBOX-ONLY] '+reply:null,
  external_sends:0,orders_written:0,needs_approval_for_order_commit:true,...extra});
function getScope(owner,event,now){
  if(!owner||owner.source!=='VERIFIED_BACKEND_BINDING'||owner.server_verified!==true||
     owner.binding_status!=='paired'||owner.owner_claim_status!=='CONFIRMED'||
     owner.owner_recipient_matches===false||owner.owner_recipient_matches!==true||
     owner.enabled_mode!=='dry_run'||owner.identity_status!=='synthetic_qa'||
     Object.keys(SCOPE).some(k=>owner[k]!==SCOPE[k])||
     !valid(owner.binding_fingerprint)||!valid(owner.recipient_fingerprint)||
     !Number.isFinite(Date.parse(owner.expires_at))||Date.parse(owner.expires_at)<=now)
    fail('OWNER_SCOPE_UNVERIFIED');
  if(!event||event.source!=='VERIFIED_ZALO_WEBHOOK_NORMALIZER'||event.accepted!==true||
     event.eventName!=='message.text.received'||event.chatType!=='PRIVATE'||
     event.recipient_fingerprint!==owner.recipient_fingerprint||
     !valid(event.message_ref,128)||typeof event.text!=='string'||
     !event.text.trim()||event.text.length>512)
    fail('INBOUND_UNVERIFIED');
  const key=hash(['SHOP_B_CONVERSATION_V2',...Object.keys(SCOPE).map(k=>owner[k]),
    owner.binding_fingerprint,owner.recipient_fingerprint].join(':'));
  return {key,owner,event};
}
function productCheck(row,owner){
  if(!row||row.source!=='VERIFIED_DB_READBACK'||Object.keys(SCOPE).some(k=>row[k]!==owner[k])||
     row.sku!=='F01'||typeof row.product_name!=='string'||row.product_name.length>80||
     !/^[^\r\n\u0000-\u001f]+$/.test(row.product_name)||
     !Number.isSafeInteger(row.price_vnd)||row.price_vnd<1||
     !Number.isSafeInteger(row.stock)||row.stock<0||row.stock>1000000)
    fail('CATALOG_INVALID_OR_FOREIGN');
  return row;
}
function compareChallenge(scope,submitted,expectedHash){
  if(!/^[A-Fa-f0-9]{32}$/.test(submitted||'')||
     !/^[a-f0-9]{64}$/.test(expectedHash||''))return false;
  const actual=hash('TIEN404_SHOP_B_QA_CONFIRM_V2:'+scope+':'+submitted.toUpperCase());
  return crypto.timingSafeEqual(Buffer.from(actual,'hex'),Buffer.from(expectedHash,'hex'));
}
function zeroState(owner,now){
  return {version:2,binding_fingerprint:owner.binding_fingerprint,phase:'idle',
    sku:null,quantity:null,expected_total_vnd:null,confirmation_hash:null,
    quote_expires_at:null,order_key:null,idempotency_key:null,session_ref:null,
    expires_at:Math.min(Date.parse(owner.expires_at),now+SESSION_TTL_MS)};
}
function assertState(state,owner,now){
  if(!state)return zeroState(owner,now);
  if(state.version!==2||state.binding_fingerprint!==owner.binding_fingerprint||
     !['idle','viewing','await_quantity','await_confirmation','commit_pending'].includes(state.phase)||
     !Number.isFinite(state.expires_at))fail('SESSION_INVALID');
  if(state.expires_at<=now)return zeroState(owner,now);
  if(state.phase==='await_confirmation'&&
    (!/^[a-f0-9]{64}$/.test(state.confirmation_hash||'')||
     !Number.isSafeInteger(state.expected_total_vnd)||
     !Number.isFinite(state.quote_expires_at)||
     !Number.isSafeInteger(state.quantity)||state.quantity<1||
     !valid(state.order_key)||!valid(state.idempotency_key)||!valid(state.session_ref)))fail('SESSION_CONFIRMATION_INVALID');
  return {...state};
}
// tx contract: getState, getCatalog, hasReceipt, saveState, markReceipt.
// Writes are to a dedicated PRIVATE QA session/receipt store only, never Orders.
async function processTurn({owner,event,repository,now=Date.now(),randomBytes=crypto.randomBytes}){
  if(!repository||typeof repository.transact!=='function')fail('ATOMIC_REPOSITORY_REQUIRED');
  const {key}=getScope(owner,event,now);
  if(typeof randomBytes!=='function')fail('SECURE_RANDOM_REQUIRED');
  const receipt=hash('QA_EVENT:'+key+':'+event.message_ref);
  return repository.transact(key,async(tx)=>{
    if(await tx.hasReceipt(receipt))return response('duplicate',null);
    const state=assertState(await tx.getState(),owner,now);
    const raw=await tx.getCatalog({tenant_key:owner.tenant_key,store_key:owner.store_key,
      bot_key:owner.bot_key,sku:'F01'});
    const product=productCheck(raw,owner);
    const text=normalize(event.text);
    let next={...state,expires_at:Math.min(Date.parse(owner.expires_at),now+SESSION_TTL_MS)};
    let answer;
    const set=(status,reply,patch={},extra={})=>{
      next={...next,...patch};answer=response(status,reply,extra);
    };
    if(/(?:token|mat khau|secret|api key|shop a|cua hang a|tenant khac|bo qua (?:quy tac|huong dan))/.test(text)){
      set('denied','Không cung cấp dữ liệu ngoài Shop B.');
    } else if(/^(huy|huy don|thoi|bo qua|khong mua)$/.test(text)){
      set('cancel','Đã huỷ bản nháp QA, chưa tạo đơn.',{
        phase:'idle',sku:null,quantity:null,expected_total_vnd:null,
        confirmation_hash:null,quote_expires_at:null,order_key:null,
        idempotency_key:null,session_ref:null});
    } else if(state.phase==='commit_pending'){
      set('pending','Đề xuất QA đang chờ kiểm tra, không ghi lại đơn.');
    } else if(/^xac nhan qa\b/.test(text)){
      const code=text.match(/^xac nhan qa ([a-f0-9]{32})$/)?.[1];
      if(state.phase!=='await_confirmation'||!compareChallenge(key,code,state.confirmation_hash))
        set('confirmation_denied','Mã xác nhận QA không hợp lệ hoặc đã hết lượt.');
      else if(now>=state.quote_expires_at||
         state.quantity>product.stock||
         !Number.isSafeInteger(state.quantity*product.price_vnd)||
         state.quantity*product.price_vnd!==state.expected_total_vnd)
        set('quote_stale','Giá hoặc tồn kho đã thay đổi. Vui lòng hỏi giá lại.',{
          phase:'viewing',confirmation_hash:null,quote_expires_at:null,
          quantity:null,expected_total_vnd:null,order_key:null,idempotency_key:null,session_ref:null});
      else {
        // Only an explicit proposal. External commit_order_qa remains disabled.
        const proposal={
          tenant_key:owner.tenant_key,store_key:owner.store_key,bot_key:owner.bot_key,
          sku:'F01',quantity:state.quantity,
          expected_total_vnd:state.expected_total_vnd,
          order_key:state.order_key,session_ref:state.session_ref,
          idempotency_key:state.idempotency_key,
          confirmation_key:state.confirmation_hash,
          confirmed:true,write_executed:false,
          requires_server_reauth:true,requires_db_readback:true
        };
        set('proposal_ready','Đã xác nhận bản nháp, chờ hệ thống kiểm thử lưu đơn.',{
          phase:'commit_pending',confirmation_hash:null,quote_expires_at:null
        },{commit_proposal:proposal});
      }
    } else if(text==='gia f01'||text==='f01'||text==='f01 con bao nhieu'||text==='f01 con hang khong'){
      set('catalog',product.product_name+' giá '+cents(product.price_vnd)+
          ', tồn kho QA '+product.stock+'.',{phase:'viewing',sku:'F01'});
    } else if(text==='mua f01'){
      set('ask_quantity','Bạn muốn mua mấy sản phẩm F01?',{phase:'await_quantity',sku:'F01'});
    } else {
      const qty=/^(?:mua f01 )([0-9]{1,4})$/.exec(text)?.[1]||
        (state.phase==='await_quantity'&&/^[0-9]{1,4}$/.test(text)?text:null);
      if(qty!==null){
        const q=Number(qty);
        if(q<1||q>product.stock)
          set('quantity_invalid','Số lượng phải từ 1 đến '+product.stock+' (QA).',{
            phase:'await_quantity',sku:'F01'});
        else{
          const total=q*product.price_vnd;
          if(!Number.isSafeInteger(total))fail('AMOUNT_OVERFLOW');
          const challenge=randomBytes(16).toString('hex').toUpperCase();
          const ref=randomBytes(12).toString('hex').toUpperCase();
          const confirmationHash=hash('TIEN404_SHOP_B_QA_CONFIRM_V2:'+key+':'+challenge);
          set('draft','Bản nháp '+q+' × '+cents(product.price_vnd)+' = '+cents(total)+
            '. Xác nhận thử nghiệm: XAC NHAN QA '+challenge+'. Chưa ghi đơn.',{
            phase:'await_confirmation',sku:'F01',quantity:q,
            expected_total_vnd:total,confirmation_hash:confirmationHash,
            quote_expires_at:Math.min(now+QUOTE_TTL_MS,Date.parse(owner.expires_at)),
            order_key:'QA-B-'+ref,session_ref:'qa-session-'+ref.toLowerCase(),
            idempotency_key:hash('QA-B-IDEMPOTENCY:'+key+':'+ref)
          },{draft:{sku:'F01',quantity:q,unit_price_vnd:product.price_vnd,total_vnd:total,
            status:'draft_only'}});
        }
      }else if(text==='xin chao'||text==='chao'||text==='hi')
        set('greeting','Chào bạn! Đây là bot Shop B đang thử nghiệm. Hãy hỏi giá F01.');
      else
        set('unsupported','Vui lòng hỏi giá F01 hoặc nhắn “mua F01 2”.');
    }
    // A real Postgres adapter MUST wrap receipt+session atomically with row lock.
    await tx.saveState(next);
    await tx.markReceipt(receipt);
    return answer;
  });
}
module.exports={processTurn,SCOPE,SESSION_TTL_MS,QUOTE_TTL_MS};
