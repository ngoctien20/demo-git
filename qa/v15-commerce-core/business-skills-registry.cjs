'use strict';
/** V15.0-04 synthetic Business Skills; NO provider, DB, sends or real writes. */
const {FIXTURES,money}=require('../v147-custom-studio/studio-core.js');
const {scopeKey}=require('../v15-agent-core/universal-agent-core.cjs');
const MODES=Object.freeze(['READ_ONLY','DRAFT','CONFIRM_REQUIRED','AUTHORIZED_EXECUTION']);
const SKILLS=Object.freeze({
 catalog_read:{mode:'READ_ONLY',role:['customer','staff','manager','owner']},
 price_quote:{mode:'READ_ONLY',role:['customer','staff','manager','owner']},
 order_draft:{mode:'DRAFT',role:['customer','staff','manager','owner']},
 support_draft:{mode:'DRAFT',role:['customer','staff','manager','owner']},
 owner_report_read:{mode:'READ_ONLY',role:['owner','manager']},
 order_modify:{mode:'CONFIRM_REQUIRED',role:['owner','manager']},
 inventory_write:{mode:'AUTHORIZED_EXECUTION',role:['owner','manager']}
});
function denied(code){return Object.freeze({status:'DENIED',reason:code,can_send:false,tools_executed:0,orders_written:0,inventory_writes:0,real_data_used:false,synthetic:true})}
function runOfflineSkill({plan,server,fixtureStore,customerText=''}={}){
 if(!plan||plan.status!=='CANDIDATE_OFFLINE_NO_SEND'||plan.can_send!==false||
    plan.real_llm_calls!==0||plan.tools_executed!==0)return denied('OFFLINE_CORE_PLAN_REQUIRED');
 if(!server||server.source!=='TRUSTED_SERVER_IDENTITY'||server.environment!=='SYNTHETIC_OFFLINE_FIXTURE'||
    server.authorizedForStaging!==true||server.sendEnabled!==false)return denied('SERVER_SYNTHETIC_SCOPE_REQUIRED');
 if(!Object.hasOwn(FIXTURES,fixtureStore))return denied('UNKNOWN_QA_STORE');
 const f=FIXTURES[fixtureStore];
 if(server.storeId!==f.storeId||server.tenantId!==f.tenantId||
    plan.session_ref!==scopeKey(server))return denied('CROSS_STORE_OR_SESSION_MISMATCH');
 if(!plan.tool)return denied('NO_TOOL_FOR_INTENT');
 const skill=SKILLS[plan.tool.capability];
 if(!skill||!skill.role.includes(server.actorRole)||
    !plan.allowed_capabilities.includes(plan.tool.capability)||
    !(server.capabilities||[]).includes(plan.tool.capability))
   return denied('SKILL_OR_ROLE_NOT_GRANTED');
 if(skill.mode==='AUTHORIZED_EXECUTION'||skill.mode==='CONFIRM_REQUIRED')return denied('REAL_SIDE_EFFECT_REQUIRES_SEPARATE_APPROVAL');
 if(plan.tool.read_only===false&&skill.mode!=='DRAFT')return denied('MODE_CONTRACT_MISMATCH');
 if(plan.tool.read_only===true&&skill.mode!=='READ_ONLY')return denied('MODE_CONTRACT_MISMATCH');
 let response='',record=null;
 if(skill.mode==='READ_ONLY'&&(plan.tool.capability==='catalog_read'||plan.tool.capability==='price_quote')){
   const requestedSku=typeof customerText==='string'?(customerText.toUpperCase().match(/\b[A-Z]\d{3}\b/)||[])[0]:undefined;
   if(requestedSku&&requestedSku!==f.product.sku)return Object.freeze({status:'SYNTHETIC_QA_RESULT',mode:skill.mode,skill:plan.tool.capability,record:null,response:'[DỮ LIỆU QA] Không tìm thấy mã '+requestedSku+' trong danh mục mô phỏng của cửa hàng này. Chưa báo giá hoặc tồn kho.',store_ref:f.storeId,product_source:'V14_7_STATIC_SYNTHETIC_FIXTURE',synthetic:true,real_data_used:false,can_send:false,tools_executed:0,orders_written:0,inventory_writes:0,provider_sends:0});
   record={sku:f.product.sku,name:f.product.name,price_vnd:f.product.priceVnd,stock:f.product.stock,unit:f.product.unit};
   response=plan.tool.capability==='price_quote'
      ?'[DỮ LIỆU QA] '+f.product.name+' ('+f.product.sku+'): '+money(f.product.priceVnd)+' / '+f.product.unit+'. Tồn kho mô phỏng: '+f.product.stock+'.'
      :'[DỮ LIỆU QA] '+f.product.name+' ('+f.product.sku+'), tồn kho mô phỏng: '+f.product.stock+' '+f.product.unit+'.';
 }
 if(plan.tool.capability==='owner_report_read')
    response='[DỮ LIỆU QA] Không có báo cáo doanh thu thật. Chỉ xem được dữ liệu mô phỏng sau khi có snapshot được cấp quyền.';
 if(skill.mode==='DRAFT')
   response=plan.tool.capability==='order_draft'
     ?'[BẢN NHÁP QA] Đã phân loại ý định đặt hàng. Chưa thu thập thông tin cá nhân, chưa ghi đơn hoặc trừ kho.'
     :'[BẢN NHÁP QA] Đã nhận ý định hỗ trợ. Chưa tạo phiếu thật hoặc gửi tin cho chủ shop.';
 return Object.freeze({status:'SYNTHETIC_QA_RESULT',mode:skill.mode,skill:plan.tool.capability,
   record,response,store_ref:f.storeId,product_source:'V14_7_STATIC_SYNTHETIC_FIXTURE',
   backend_authorization_verified:false,real_data_used:false,synthetic:true,
   can_send:false,tools_executed:0,orders_written:0,inventory_writes:0,provider_sends:0});
}
module.exports={MODES,SKILLS,runOfflineSkill};
