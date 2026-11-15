'use strict';
/*
 * TIEN404 AI V13.8 — Conversation state machine (PRIVATE QA, NO SEND).
 * This module is designed to be called ONLY after ingress authentication and a
 * trusted server-side Bot→Tenant→Store resolver. It is not an auth service.
 *
 * Separates customer/AI conversation and staff handoff, but NEVER fetches
 * customer data, sends messages, saves transcript, creates Orders or calls AI.
 * The owner/shop is NOT given bot-admin/design controls by this contract.
 */
const STATES=Object.freeze(['AI_ACTIVE','WAITING_STAFF','HUMAN_ACTIVE','RESOLVED']);
const EVENTS=Object.freeze(['CUSTOMER_MESSAGE','STAFF_ACCEPT','STAFF_REPLY','STAFF_CLOSE','STAFF_RETURN_AI','STAFF_PAUSE','STAFF_RESUME']);
const STAFF_ROLES=new Set(['SHOP_OPERATOR','TIEN404_SUPPORT']);
const ALLOWED_PERMISSIONS=new Set(['conversation:read','conversation:respond','conversation:assign','shop:pause']);
const TTL_MS=24*60*60*1000;
function denied(s){const e=new Error(s);e.code=s;throw e;}
const isId=s=>typeof s==='string'&&/^[a-z0-9_-]{2,80}$/i.test(s);
const safeText=(s,max)=>typeof s==='string'&&s.trim().length>0&&s.length<=max&&!/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(s);
function serverBinding(binding,now){
 if(!binding||typeof binding!=='object'||binding.verified!==true||
    binding.source!=='TRUSTED_TENANT_RESOLVER'||binding.channel!=='ZALO_BOT'||
    !isId(binding.tenant_id)||!isId(binding.store_id)||
    !isId(binding.bot_id)||!isId(binding.customer_chat_id)||
    !Number.isFinite(binding.expires_at_ms)||binding.expires_at_ms<=now)
   denied('TRUSTED_SCOPE_REQUIRED');
 // Important: no tenant/store IDs from the inbound message body.
 return [binding.tenant_id,binding.store_id,binding.bot_id,binding.customer_chat_id].join('::');
}
function blank(scope,now){return {version:1,scope,revision:0,status:'AI_ACTIVE',
  previous_status:'AI_ACTIVE',shop_paused:false,assignee:null,
  last_ids:[],handoff_reason:null,opened_at_ms:now,expires_at_ms:now+TTL_MS};}
function readState(input,scope,now){
 if(input==null)return blank(scope,now);
 if(!input||input.version!==1||input.scope!==scope||!STATES.includes(input.status)||
    !Number.isSafeInteger(input.revision)||input.revision<0||
    !Array.isArray(input.last_ids)||input.last_ids.length>64||
    input.last_ids.some(x=>!isId(x))||new Set(input.last_ids).size!==input.last_ids.length||
    typeof input.shop_paused!=='boolean'||!Number.isFinite(input.expires_at_ms)||
    input.expires_at_ms<=now||!Number.isFinite(input.opened_at_ms)||
    (input.assignee!==null&&!isId(input.assignee)))
   denied('STATE_INVALID_EXPIRED_OR_FOREIGN');
 if(input.status==='HUMAN_ACTIVE'&&!isId(input.assignee))denied('ASSIGNEE_REQUIRED');
 return {...input,last_ids:[...input.last_ids]};
}
function eventEnvelope(event,state,now){
 if(!event||typeof event!=='object'||!EVENTS.includes(event.type)||
    !isId(event.event_id)||!Number.isSafeInteger(event.expected_revision)||
    event.expected_revision<0||!Number.isFinite(event.received_at_ms)||
    Math.abs(now-event.received_at_ms)>10*60*1000)
   denied('EVENT_INVALID');
 if(state.last_ids.includes(event.event_id))return 'REPLAY';
 if(event.expected_revision!==state.revision)denied('REVISION_CONFLICT');
 return 'FRESH';
}
function staffGuard(actor,scope,binding,event){
 if(!actor||actor.server_verified!==true||actor.source!=='VERIFIED_STAFF_SESSION'||
   !STAFF_ROLES.has(actor.role)||!isId(actor.user_id)||
   actor.tenant_id!==binding.tenant_id||actor.store_id!==binding.store_id||
   !Array.isArray(actor.permissions)||actor.permissions.some(x=>!ALLOWED_PERMISSIONS.has(x)))
   denied('STAFF_AUTH_REQUIRED');
 const required=event.type==='STAFF_PAUSE'||event.type==='STAFF_RESUME'?'shop:pause':
   event.type==='STAFF_ACCEPT'?'conversation:assign':'conversation:respond';
 if(!actor.permissions.includes(required))denied('STAFF_PERMISSION_DENIED');
 if(event.type==='STAFF_REPLY'&&
    (event.text===undefined||!safeText(event.text,1000)))denied('STAFF_TEXT_INVALID');
 return actor;
}
function customerGuard(event,binding){
 if(event.source!=='AUTHENTICATED_ZALO_WEBHOOK'||event.role!=='CUSTOMER'||
    event.chat_type!=='PRIVATE'||event.chat_id!==binding.customer_chat_id||
    !safeText(event.text,1000)||event.is_bot===true)
   denied('CUSTOMER_EVENT_INVALID');
}
function makeProposal(kind,text,metadata={}){
 if(!safeText(text,2000))denied('PREVIEW_TEXT_INVALID');
 return Object.freeze({kind,channel:'ZALO_BOT',text,metadata,
   provider_payload:null,provider_sends:0,orders_written:0,
   outbox_written:0,dispatch_authorized:false});
}
const normalize=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').toLowerCase().trim();
function routeCustomer(text){
 const t=normalize(text);
 if(/\b(nhan vien|nguoi that|tu van vien|khieu nai|hoan tien|doi tra|can ho tro)\b/.test(t))
  return {intent:'HANDOFF',reason:'customer_requested_staff'};
 if(/\b(mua|dat hang|chot don|thanh toan)\b/.test(t))
  return {intent:'ORDER_REQUEST',reason:'requires_authorized_order_flow'};
 if(/\b(gia|bao nhieu|ton kho|con hang|san pham|xem anh)\b/.test(t))
  return {intent:'CATALOG_QUERY',reason:'delegate_to_verified_catalog'};
 if(/\b(chao|hello|hi)\b/.test(t))return {intent:'GREETING',reason:'simple_greeting'};
 return {intent:'CLARIFY',reason:'intent_unsure'};
}
function previewCustomer(event,binding){
 const intent=routeCustomer(event.text);
 switch(intent.intent){
  case 'GREETING':return {intent,proposal:makeProposal('AI_TEXT_CANDIDATE',
    'Chào bạn! Mình là trợ lý của cửa hàng. Bạn muốn xem sản phẩm, hỏi giá hay gặp nhân viên?')};
  case 'CATALOG_QUERY':return {intent,proposal:makeProposal('CATALOG_DELEGATION_ONLY',
    'Mình đang kiểm tra thông tin sản phẩm của cửa hàng. Nhân viên sẽ hỗ trợ nếu chưa có dữ liệu xác thực.',
    {requires_verified_catalog:true,requires_r1_router:true})};
  case 'ORDER_REQUEST':return {intent,proposal:makeProposal('ORDER_REQUEST_DRAFT_ONLY',
    'Mình đã ghi nhận nhu cầu mua hàng. Vui lòng cho biết sản phẩm và số lượng; chưa tạo đơn hoặc trừ kho.',
    {requires_confirmation:true,requires_order_readback:true})};
  default:return {intent,proposal:makeProposal('CLARIFICATION_ONLY',
    'Bạn muốn tìm sản phẩm, hỏi giá hay cần nhân viên tư vấn ạ?')};
 }
}
function transition({binding,event,session=null,actor=null,now=Date.now()}={}){
 const scope=serverBinding(binding,now),state=readState(session,scope,now);
 // Authenticate BEFORE checking deduplication: a forged replay cannot access state.
 if(!event||!EVENTS.includes(event.type))denied('EVENT_INVALID');
 const verifiedActor=event.type==='CUSTOMER_MESSAGE'
   ?(customerGuard(event,binding),null):staffGuard(actor,scope,binding,event);
 const freshness=eventEnvelope(event,state,now);
 if(freshness==='REPLAY')return Object.freeze({kind:'DUPLICATE_IGNORED',next_state:state,
   proposals:[],provider_sends:0,orders_written:0,outbox_written:0,
   dispatch_authorized:false,production_ready:false,duplicate:true});
 const s={...state,revision:state.revision+1,
   last_ids:[...state.last_ids.slice(-63),event.event_id],
   expires_at_ms:Math.min(now+TTL_MS,binding.expires_at_ms)};
 let kind='NONE',proposals=[];
 if(event.type==='CUSTOMER_MESSAGE'){
  if(s.status==='RESOLVED'){s.status='AI_ACTIVE';s.assignee=null;s.handoff_reason=null;}
  if(s.shop_paused){
   kind='SHOP_PAUSED';
   proposals=[makeProposal('SHOP_PAUSED_DRAFT',
     'Cửa hàng hiện đang tạm nghỉ. Bạn có thể để lại lời nhắn, nhân viên sẽ phản hồi khi hoạt động trở lại.')];
  }else if(s.status==='HUMAN_ACTIVE'||s.status==='WAITING_STAFF'){
   kind='AI_SUPPRESSED';
   // Customer transcript would be queued by an authenticated, separate persist layer; this mock does not write.
   proposals=[];
  }else{
   const candidate=previewCustomer(event,binding);
   if(candidate.intent.intent==='HANDOFF'){
    s.status='WAITING_STAFF';s.handoff_reason=candidate.intent.reason;kind='HANDOFF_PENDING';
    proposals=[makeProposal('HANDOFF_ACK_DRAFT',
      'Mình sẽ chuyển yêu cầu của bạn tới nhân viên cửa hàng. Bạn có thể để lại nội dung cần hỗ trợ.')];
   }else{kind=candidate.intent.intent;proposals=[candidate.proposal];}
  }
 }else{
  if(event.type==='STAFF_ACCEPT'){
   if(s.status!=='WAITING_STAFF')denied('HANDOFF_NOT_PENDING');
   s.status='HUMAN_ACTIVE';s.assignee=verifiedActor.user_id;kind='STAFF_ASSIGNED';
  }else if(event.type==='STAFF_REPLY'){
   if(s.status!=='HUMAN_ACTIVE'||s.assignee!==verifiedActor.user_id)
    denied('ASSIGNEE_REQUIRED_FOR_REPLY');
   kind='STAFF_REPLY_DRAFT';
   proposals=[makeProposal('STAFF_TEXT_DRAFT',event.text.trim(),{requires_authorized_dispatch:true})];
  }else if(event.type==='STAFF_CLOSE'){
   if(s.status!=='HUMAN_ACTIVE'||s.assignee!==verifiedActor.user_id)
    denied('STAFF_CLOSE_NOT_ALLOWED');
   s.status='RESOLVED';s.assignee=null;kind='CONVERSATION_RESOLVED';
  }else if(event.type==='STAFF_RETURN_AI'){
   if(s.status!=='HUMAN_ACTIVE'||s.assignee!==verifiedActor.user_id)
    denied('STAFF_RELEASE_NOT_ALLOWED');
   s.status='AI_ACTIVE';s.assignee=null;s.handoff_reason=null;kind='AI_RESUMED';
  }else if(event.type==='STAFF_PAUSE'){
   s.shop_paused=true;kind='SHOP_PAUSE_PREVIEW';
  }else if(event.type==='STAFF_RESUME'){
   s.shop_paused=false;kind='SHOP_RESUME_PREVIEW';
  }
 }
 return Object.freeze({kind,next_state:Object.freeze(s),proposals:Object.freeze(proposals),
   provider_sends:0,orders_written:0,outbox_written:0,dispatch_authorized:false,
   production_ready:false});
}
module.exports={STATES,EVENTS,transition,routeCustomer,previewCustomer};
