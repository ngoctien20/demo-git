'use strict';
/**
 * TIEN404 V15 Agent Core 2.0 — SOURCE-ONLY offline CANDIDATE.
 * Pure request classifier/policy gate; no provider, n8n, credential, DB,
 * memory persistence, send or order side-effect.
 * resolveTrusted is PRIVATE backend injected, not a user-supplied flag.
 * Client-provided IDs/capabilities NEVER grant.
 */
const {createHash}=require('node:crypto');
const CHANNELS=new Set(['messenger','zalo_bot','zalo_oa','web_widget','dashboard','automation']);
const CAPABILITIES=new Set(['catalog_read','price_quote','order_draft','order_status_read','support_draft','owner_report_read']);
const ROLE_CAPABILITIES={customer:new Set(['catalog_read','price_quote','order_draft','order_status_read','support_draft']),owner:CAPABILITIES,manager:CAPABILITIES,staff:new Set(['catalog_read','price_quote','order_status_read','support_draft']),service:new Set(['catalog_read'])};
const fail=(reason,extra={})=>Object.freeze({status:'BLOCKED',reason,can_send:false,provider_sends:0,actual_orders_written:0,real_llm_calls:0,model_id:null,tools_executed:0,owner_authority_granted:false,...extra});
function classify(message){
 const m=message.normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();
 if(/(?:doanh thu|báo cáo|lợi nhuận|thống kê)/iu.test(m))return 'OWNER_REPORT';
 if(/(?:hủy đơn|sửa đơn|đổi đơn|thay đơn|xác nhận đơn)/iu.test(m))return 'ORDER_CHANGE';
 if(/(?:đặt|mua|lên đơn|chốt đơn)/iu.test(m))return 'ORDER_DRAFT';
 if(/(?:giá|bao nhiêu|báo giá|giá sỉ|giá lẻ)/iu.test(m))return 'PRICE_QUOTE';
 if(/(?:còn hàng|tồn kho|có mẫu|tìm|có.*không|sản phẩm|mã hàng)/iu.test(m))return 'CATALOG';
 if(/(?:khiếu nại|bảo hành|đổi trả|hỗ trợ)/iu.test(m))return 'SUPPORT';
 if(/^(?:chào|xin chào|hi|hello|shop ơi|alo|hey|chao)\W*$/iu.test(m))return 'GREETING';
 return 'NEEDS_UNDERSTANDING';
}
function scopeKey({tenantId,storeId,channel,conversationId}){
 return createHash('sha256').update(JSON.stringify({tenantId,storeId,channel,conversationId})).digest('hex');
}
async function planAgent(input,{resolveTrusted}={}){
 if(!input||typeof input!=='object'||Array.isArray(input)||typeof resolveTrusted!=='function')return fail('SERVER_IDENTITY_RESOLVER_REQUIRED');
 if(typeof input.message!=='string'||input.message.length>4000||input.message.trim().length===0||input.message.includes('\0'))return fail('INVALID_INPUT_MESSAGE');
 if(typeof input.request_id!=='string'||!/^[a-zA-Z0-9_-]{8,100}$/.test(input.request_id))return fail('INVALID_REQUEST_ID');
 let trusted=null;try{trusted=await resolveTrusted({requestId:input.request_id,channelEvent:input.channel_event})}catch{}
 if(!trusted||trusted.source!=='TRUSTED_SERVER_IDENTITY'||trusted.authorizedForStaging!==true||
   !trusted.tenantId||!trusted.storeId||!trusted.conversationId||
   !CHANNELS.has(trusted.channel)||!ROLE_CAPABILITIES[trusted.actorRole]||
   !trusted.policyVersion||trusted.sendEnabled!==false)
   return fail('TRUSTED_TENANT_CHANNEL_POLICY_MISSING');
 for(const [field,verifiedKey] of [['tenant_id','tenantId'],['store_id','storeId'],['channel','channel'],['conversation_id','conversationId']]){
   if(Object.hasOwn(input,field)&&input[field]!==trusted[verifiedKey])return fail('UNTRUSTED_CLIENT_IDENTITY_CONFLICT');
 }
 const roleAllows=ROLE_CAPABILITIES[trusted.actorRole];
 const allowed=new Set((Array.isArray(trusted.capabilities)?trusted.capabilities:[]).filter(x=>CAPABILITIES.has(x)&&roleAllows.has(x)));
 const intent=classify(input.message);
 const needs={CATALOG:'catalog_read',PRICE_QUOTE:'price_quote',ORDER_DRAFT:'order_draft',OWNER_REPORT:'owner_report_read',SUPPORT:'support_draft'}[intent];
 const session=scopeKey(trusted);
 if(intent==='ORDER_CHANGE')return fail('TRANSACTION_CHANGE_NEEDS_AUTHORIZED_BACKEND_AND_CONFIRMATION',{intent,session_ref:session});
 if(needs&&!allowed.has(needs))return fail('CAPABILITY_OR_ROLE_DENIED',{intent,session_ref:session});
 let action='MODEL_EVAL_ONLY_NO_PROVIDER_CALL',response=null,tool=null;
 if(intent==='GREETING'){action='DETERMINISTIC_GREETING';response='Chào bạn! Tôi có thể hỗ trợ tìm sản phẩm hoặc tư vấn thông tin cửa hàng.';}
 if(intent==='PRICE_QUOTE'||intent==='CATALOG'){
   action='AWAIT_AUTHORIZED_BACKEND_CATALOG';tool={capability:needs,read_only:true,args_from_model_untrusted:true};
 }
 if(intent==='OWNER_REPORT'){
   action='AWAIT_TRUSTED_OWNER_REPORT_TOOL';tool={capability:'owner_report_read',read_only:true,args_from_model_untrusted:true};
 }
 if(intent==='ORDER_DRAFT'||intent==='SUPPORT'){
   action='DRAFT_NO_PERSIST';tool={capability:needs,read_only:false,requires_confirmation:true};
 }
 return Object.freeze({status:'CANDIDATE_OFFLINE_NO_SEND',
   contract_version:'V15.0-01',request_id:input.request_id,intent,action,response,tool,
   channel:trusted.channel,actor_role:trusted.actorRole,session_ref:session,
   bot_profile_version:trusted.botProfileVersion||null,policy_version:trusted.policyVersion,
   allowed_capabilities:[...allowed].sort(),trusted_store_isolated:true,
   price_quoted:null,stock_quoted:null,orders_created:0,
   can_send:false,provider_sends:0,real_llm_calls:0,
   actual_orders_written:0,tools_executed:0,model_id:null,owner_authority_granted:false,
   next_stage:'SOURCE_ONLY_AGENT_CORE_REQUIRES_HOSTED_IDENTITY_AND_MODEL_QA'});
}
module.exports={planAgent,classify,scopeKey,CHANNELS,CAPABILITIES};
