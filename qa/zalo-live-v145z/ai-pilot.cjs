'use strict';
/** TIEN404 V14.5Z: offline QA only. No provider send, DB writes, paid AI or credentials.
 * External server must verify Zalo ingress and independently issue trusted binding.
 * String source markers DO NOT authenticate anything and MUST NOT unlock a live send.
 */
const {transition,routeCustomer}=require('../conversation-v138/conversation-core.cjs');
const ID=/^[a-z0-9_-]{2,80}$/i;
const okId=x=>typeof x==='string'&&ID.test(x);
function deny(code){const e=new Error(code);e.code=code;throw e}
const scope=b=>[b.tenant_id,b.store_id,b.bot_id,b.customer_chat_id].join('::');
const norm=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').toLowerCase();
const cash=n=>new Intl.NumberFormat('vi-VN').format(n)+'đ';
function verifyBinding(b,now){
 if(!b||b.source!=='TRUSTED_TENANT_RESOLVER'||b.verified!==true||b.channel!=='ZALO_BOT'||
 ![b.tenant_id,b.store_id,b.bot_id,b.customer_chat_id].every(okId)||
 !Number.isFinite(b.expires_at_ms)||b.expires_at_ms<=now)deny('TRUSTED_BINDING_REQUIRED');
 return scope(b);
}
function verifyCatalog(c,b,now){
 if(!c||c.source!=='TRUSTED_QA_CATALOG_READBACK'||c.environment!=='OFFLINE_QA'||
 c.tenant_id!==b.tenant_id||c.store_id!==b.store_id||c.bot_id!==b.bot_id||
 !Number.isFinite(c.fetched_at_ms)||c.fetched_at_ms>now||now-c.fetched_at_ms>60000||
 !Array.isArray(c.products)||c.products.length>50)deny('CATALOG_NOT_TRUSTED_OR_STALE');
 const seen=new Set();
 for(const p of c.products){
  if(!p||!okId(p.sku)||seen.has(p.sku)||typeof p.name!=='string'||!p.name.trim()||p.name.length>120||
  !Number.isSafeInteger(p.price_vnd)||p.price_vnd<0||
  !Number.isSafeInteger(p.stock_on_hand)||p.stock_on_hand<0||p.is_active!==true)deny('CATALOG_ROW_INVALID');
  seen.add(p.sku);
 }
 return c.products;
}
function candidate(kind,text,extra={}){
 return Object.freeze({kind,text, ...extra, provider_payload:null,provider_sends:0,
 orders_written:0,stock_changed:0,outbox_written:0,dispatch_authorized:false,
 production_ready:false,live_verified:false});
}
function skuFrom(question,products,focus){
 const tokens=norm(question).match(/\b[a-z]+\d+[a-z\d_-]*\b/g)||[];
 const token=tokens.length?tokens[0].toUpperCase():focus;
 return {sku:token||null,product:products.find(x=>x.sku.toUpperCase()===String(token||'').toUpperCase())||null,
 mentioned:tokens.length>0};
}
function guardModel(result){
 // Fake model can add non-factual, nonnumeric introduction only. Facts are deterministic.
 if(!result||result.origin!=='OFFLINE_FAKE_MODEL'||typeof result.text!=='string'||
 result.text.length>100||!/^[\p{L}\p{M}\p{P}\p{Zs}]+$/u.test(result.text)||
 /\b(token|api key|password|system prompt)\b/i.test(result.text)||
 /\b(gia|tien|dong|vnd|con hang|ton kho|giam gia|khuyen mai)\b/i.test(norm(result.text)))
 deny('MODEL_PHRASE_REJECTED');
 return result.text.trim();
}
async function preview({mode='OFFLINE_QA',binding,event,catalog,session=null,memory=null,modelPort=null,now=Date.now()}={}){
 if(mode!=='OFFLINE_QA')deny('LIVE_MODE_UNAUTHORIZED');
 const key=verifyBinding(binding,now);
 if(!event||!okId(event.event_id)||typeof event.text!=='string'||event.text.length>1000||
 ['tenant_id','store_id','bot_id','role','verified','customer_chat_id'].some(k=>Object.hasOwn(event,k)))
 deny('PROVIDER_EVENT_INVALID_OR_UNTRUSTED_SCOPE');
 const result=transition({binding,event:{
  type:'CUSTOMER_MESSAGE',event_id:event.event_id,text:event.text,
  chat_type:'PRIVATE',source:'AUTHENTICATED_ZALO_WEBHOOK',role:'CUSTOMER',
  chat_id:event.chat_id,is_bot:event.is_bot,
  expected_revision:event.expected_revision,received_at_ms:event.received_at_ms
 },session,now});
 if(result.kind==='DUPLICATE_IGNORED')return {proposal:candidate('DUPLICATE_IGNORED',null),state:result.next_state,memory,model_calls:0,model_origin:null};
 if(['AI_SUPPRESSED','SHOP_PAUSED','HANDOFF_PENDING'].includes(result.kind))
 return {proposal:result.proposals[0]||candidate('AI_SUPPRESSED',null),state:result.next_state,memory,model_calls:0,model_origin:null};
 const products=verifyCatalog(catalog,binding,now);
 if(memory!==null&&(!memory||memory.scope!==key||memory.revision!==result.next_state.revision-1||
 (memory.focused_sku!==null&&!okId(memory.focused_sku))))deny('MEMORY_SCOPE_OR_REVISION_INVALID');
 const target=skuFrom(event.text,products,memory?.focused_sku||null);
 const n=norm(event.text);
 const intent=routeCustomer(event.text).intent;
 const stock=/\b(con bao nhieu|con may|ton kho|con hang|so luong con)\b/.test(n);
 const price=/\b(gia|bao nhieu tien|mua|lay|tinh tien|tong tien)\b/.test(n)||/\b\d+\s*(cai|chiec|san pham)\b/.test(n);
 let response='Mình có thể hỗ trợ tìm sản phẩm hoặc trả lời câu hỏi về cửa hàng nhé.';
 if(target.mentioned&&!target.product)response='Mình chưa tìm thấy mã sản phẩm này trong danh mục QA đã xác minh.';
 else if(target.product){
  const p=target.product;
  if(stock)response=p.name+' ('+p.sku+') hiện có '+p.stock_on_hand+' sản phẩm trong dữ liệu QA.';
  else if(price){
   const match=n.match(/\b(\d{1,4})\s*(cai|chiec|san pham)\b/);
   const qty=match?Number(match[1]):1;
   if(!Number.isSafeInteger(qty)||qty<1||qty>1000||!Number.isSafeInteger(p.price_vnd*qty))deny('QUANTITY_UNSUPPORTED');
   response=p.name+' ('+p.sku+') giá QA '+cash(p.price_vnd)+'/sản phẩm'+
   (qty>1?', '+qty+' sản phẩm là '+cash(p.price_vnd*qty):'')+'. Chưa tạo đơn hay giữ hàng.';
  }else response='Mình đã ghi nhận bạn đang quan tâm '+p.name+' ('+p.sku+'). Bạn muốn hỏi giá hay số lượng còn lại?';
 }
 if(intent==='ORDER_REQUEST')response='Mình chỉ có thể xem trước yêu cầu đặt hàng trong môi trường QA; chưa tạo đơn hoặc giữ hàng.';
 let phrase='',calls=0;
 if(modelPort!==null){
  if(typeof modelPort!=='function')deny('MODEL_PORT_INVALID');
  const generated=await modelPort(Object.freeze({intent,question:event.text,
   catalog_scope:binding.tenant_id+'/'+binding.store_id,focused_sku:target.sku,
   instructions:'Return a short non-factual Vietnamese introduction. Never state numbers, prices or policies.'}));
  phrase=guardModel(generated);calls=1;
 }
 return {proposal:candidate('AI_OFFLINE_CANDIDATE',phrase?phrase+' '+response:response,{
  catalog_version:'OFFLINE_QA',fact_source:'TRUSTED_QA_CATALOG_READBACK',
  model_used:calls===1,model_origin:calls?'OFFLINE_FAKE_MODEL':null}),
  state:result.next_state,memory:{scope:key,revision:result.next_state.revision,
  focused_sku:target.product?.sku||memory?.focused_sku||null},
  model_calls:calls,model_origin:calls?'OFFLINE_FAKE_MODEL':null};
}
module.exports={preview,verifyCatalog,verifyBinding,skuFrom};
