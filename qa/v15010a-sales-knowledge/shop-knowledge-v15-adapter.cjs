'use strict';
/**
 * V15.0-10A — OFFLINE Shop Knowledge adapter, NOT a hosted RAG/authorization service.
 * Reuses V14.7 Shop Studio FIXTURES and V15 offline Universal Agent Core.
 * No vector DB, LLM call, network, message send, customer data or hosted writes.
 */
const {FIXTURES,CHANNELS,createStudio,money}=require('../v147-custom-studio/studio-core.js');
const {createOfflineLabEngine}=require('../v15-commerce-core/offline-orchestrator.cjs');
const SHOP_DOCS=Object.freeze({
  A:Object.freeze({v1:Object.freeze({
    status:'APPROVED_QA_ONLY',intro:'Tạp hóa An là cửa hàng tạp hóa QA giả lập.',
    founded:'Chưa có thông tin năm thành lập.',returns:'Tạp hóa An: đổi hàng trong 3 ngày theo điều kiện giả lập.',
    shipping:'Tạp hóa An: liên hệ nhân viên để hỏi phí giao hàng.',
    hours:'Chưa có thông tin giờ mở cửa.'
  })}),
  B:Object.freeze({
    v1:Object.freeze({status:'APPROVED_QA_ONLY',
      intro:'Thời trang Bình là cửa hàng thời trang QA giả lập.',
      founded:'Chưa có thông tin năm thành lập.',
      returns:'Thời trang Bình: đổi size trong 7 ngày theo điều kiện giả lập.',
      shipping:'Thời trang Bình: phí giao hàng chưa được cung cấp.',
      hours:'Chưa có thông tin giờ mở cửa.'}),
    v2:Object.freeze({status:'DRAFT_ONLY',
      intro:'Thời trang Bình có bản Knowledge mới chờ duyệt.',
      founded:'Chưa có thông tin năm thành lập.',
      returns:'Thời trang Bình: đổi size trong 10 ngày theo điều kiện QA đang chờ duyệt.',
      shipping:'Thời trang Bình: chưa có chính sách vận chuyển.',
      hours:'Chưa có thông tin giờ mở cửa.'})
  }),
  C:Object.freeze({v1:Object.freeze({status:'APPROVED_QA_ONLY',
    intro:'Vật liệu Cường là cửa hàng vật liệu xây dựng QA giả lập.',
    founded:'Chưa có thông tin năm thành lập.',
    returns:'Vật liệu Cường: kiểm tra điều kiện trả hàng cùng nhân viên.',
    shipping:'Vật liệu Cường: cần xác định địa điểm và khối lượng để báo phí giao hàng.',
    hours:'Chưa có thông tin giờ mở cửa.'})})
});
const KEYS=Object.freeze({
 intro:['giới thiệu','cửa hàng nào','shop nào','kinh doanh gì','shop là gì'],
 founded:['thành lập','thành lập năm','ra đời năm'],
 returns:['đổi trả','đổi size','trả hàng','đổi hàng'],
 shipping:['giao hàng','vận chuyển','ship','phí giao'],
 hours:['mở cửa','giờ làm','mấy giờ']
});
const fail=reason=>Object.freeze({status:'BLOCKED',reason,
 synthetic:true,can_send:false,hosted_reads:0,hosted_writes:0,model_calls:0});
const norm=s=>s.normalize('NFC').toLocaleLowerCase('vi-VN').trim();
function createShopKnowledgeLab(){
 const studio=createStudio(),agent=createOfflineLabEngine();
 const approved=new Map(Object.keys(FIXTURES).map(s=>[s,'v1']));
 const audit=[];
 function approveKnowledge(shop,version,operator){
   if(!Object.hasOwn(FIXTURES,shop)||!Object.hasOwn(SHOP_DOCS[shop]||{},version))
     return fail('UNKNOWN_SYNTHETIC_KNOWLEDGE');
   if(operator!=='INTERNAL_STAFF_QA')return fail('INDEPENDENT_APPROVAL_REQUIRED');
   approved.set(shop,version);
   audit.push(Object.freeze({shop,version,source:'MEMORY_ONLY_QA_OPERATOR'}));
   return Object.freeze({status:'APPROVED_MEMORY_ONLY',shop,version,
     can_publish:false,hosted_writes:0,model_calls:0});
 }
 function lookup({shop,channel,question,clientClaims={}}={}){
   if(!Object.hasOwn(FIXTURES,shop)||!CHANNELS.includes(channel))return fail('UNKNOWN_QA_STORE_OR_CHANNEL');
   if(typeof question!=='string'||question.length>1000||!question.trim())return fail('INVALID_QUESTION');
   if(!clientClaims||typeof clientClaims!=='object'||Array.isArray(clientClaims)||
     Object.keys(clientClaims).some(k=>/tenant|store|role|knowledge|price|stock|owner|admin|policy|auth|token|secret/i.test(k)))
     return fail('CLIENT_AUTHORITY_OVERRIDE_REJECTED');
   const f=FIXTURES[shop],version=approved.get(shop),doc=SHOP_DOCS[shop][version];
   if(!doc||!['APPROVED_QA_ONLY','DRAFT_ONLY'].includes(doc.status))
      return fail('KNOWLEDGE_UNAVAILABLE');
   const q=norm(question);
   // An approved VERSION is a synthetic QA operator's memory-only selection, not real Owner signoff.
   // Never allow a question to change Store scope or execute instructions embedded in knowledge.
   if(/(bỏ qua|ignore (all|previous)|tiết lộ|system prompt|api.?key|token|credential|tenant_id|store_id|cửa hàng khác|shop khác)/iu.test(q))
     return fail('PROMPT_INJECTION_OR_CROSS_STORE_REQUEST');
   let key=null,reply='',source=null,sku=null;
   const match=question.toUpperCase().match(/\b[A-Z]\d{3}\b/);
   if(match){
     sku=match[0];
     if(sku!==f.product.sku)reply='Chưa có mã sản phẩm này trong danh mục QA của cửa hàng.';
     else reply=f.product.name+' ('+sku+'): '+money(f.product.priceVnd)+
       '/'+f.product.unit+'; tồn kho QA: '+f.product.stock+' '+f.product.unit+'.';
     source='STRUCTURED_V147_STUDIO_QA_FIXTURE';
   }else{
     key=Object.keys(KEYS).find(k=>KEYS[k].some(word=>q.includes(word)))||null;
     reply=key?doc[key]:'Chưa có dữ liệu QA được duyệt để trả lời câu hỏi này.';
     source=key?'APPROVED_QA_KNOWLEDGE_EXACT_KEYWORD':'NO_KNOWLEDGE_MATCH';
   }
   return Object.freeze({
     status:'SYNTHETIC_READ_ONLY',shop,channel,tenant_ref:f.tenantId,
     store_ref:f.storeId,knowledge_version:version,source,key,sku,reply,
     source_is_hosted:false,real_rag:false,vector_calls:0,model_calls:0,
     can_send:false,hosted_reads:0,hosted_writes:0,
     disclaimer:'DỮ LIỆU QA GIẢ LẬP — KHÔNG PHẢI GIÁ, KHO HAY CHÍNH SÁCH THẬT'
   });
 }
 async function preview({shop,channel,question,clientClaims={}}={}){
   const k=lookup({shop,channel,question,clientClaims});
   if(k.status==='BLOCKED')return k;
   const core=await agent.run({shop,channel,message:question,clientClaims,
      conversation:'qa_v15010a_saleslab'});
   if(core.status==='BLOCKED'||core.signed_qa_fixture!==true)
     return fail('V15_AGENT_SYNTHETIC_GATE_DENIED');
   const style=studio.get(shop,channel);
   return Object.freeze({status:'SYNTHETIC_V15_CORE_AND_SHOP_KNOWLEDGE',
      assistant:style.assistantName,industry:FIXTURES[shop].industry,
      channel,shop,knowledge:k,agent_version:core.version,
      core_identity_provenance:core.identity_provenance,
      core_real_provider_verified:false,provider_sends:0,hosted_writes:0,
      model_calls:0,can_publish:false,can_send:false,real_ai_qa:false});
 }
 return Object.freeze({lookup,preview,approveKnowledge,
   inspect:()=>Object.freeze({version:'V15.0-10A',scope:'OFFLINE_REUSE_V147_AND_V15',
    approved:Object.fromEntries(approved),audit:audit.slice(),
    real_rag:false,model_calls:0,hosted_writes:0,provider_sends:0})});
}
module.exports={createShopKnowledgeLab,SHOP_DOCS};
