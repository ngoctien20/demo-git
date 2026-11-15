'use strict';
/**
 * V14.8 Owner UAT preview: READ-ONLY SYNTHETIC UI built on existing V14.7
 * T404Studio source. This is NOT the cryptographically verified Node resolver.
 * It NEVER invokes network, provider, DB or AI. Never claim actual Store rights.
 */
(function(factory){
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(typeof window!=='undefined')
   Object.defineProperty(window,'T404IdentityUAT',{value:api,writable:false});
})(function(){
 const scenarios=['GREETING','CATALOG','QUOTE','AI','ORDER'];
 const money=v=>new Intl.NumberFormat('vi-VN').format(v)+'đ';
 function build({studio,api,shop,channel,scenario='GREETING'}={}){
  if(!studio||typeof studio.get!=='function'||!api||
    !Object.hasOwn(api.FIXTURES||{},shop)||
    !(api.CHANNELS||[]).includes(channel)||!scenarios.includes(scenario))
   throw Error('QA_UAT_INVALID_SELECTION');
  const cfg=studio.get(shop,channel),f=api.FIXTURES[shop];
  if(cfg.tenant_id!==f.tenantId||cfg.store_id!==f.storeId||
    cfg.channel!==channel||cfg.approval_status!=='EXPERIMENTAL'||
    cfg.policy_version!=='GLOBAL_CORE_LOCKED')
   throw Error('QA_UAT_SCOPE_OR_LIFECYCLE_DENIED');
  const p=f.product;
  let preview=cfg.greeting,route='FAST';
  if(scenario==='CATALOG')preview='[QA] '+p.sku+' — '+p.name+
    '. Đây là dữ liệu sản phẩm mẫu của '+f.name+'.';
  if(scenario==='QUOTE')preview='[QA] '+p.name+' · '+money(p.priceVnd)+
    (cfg.showStock?' · Tồn mẫu '+p.stock:'');
  if(scenario==='AI'){route='AI_DISABLED';preview='[QA] Tư vấn nâng cao cần AI Sales Core đã được phân quyền; chưa gọi AI thật.';}
  if(scenario==='ORDER'){route='TRANSACTION_BLOCKED';preview='[QA] Ý định đặt hàng được ghi nhận trong phần xem trước; không tạo đơn.';}
  return Object.freeze({version:'V14.8-OWNER-UAT-CANDIDATE',
    tenant_id:f.tenantId,store_id:f.storeId,
    channel,channel_binding_id:'synthetic_binding_'+channel+'_'+shop,
    bot_profile_id:'synthetic_botprofile_'+channel+'_'+shop,
    bot_profile_version:cfg.bot_profile_version,assistant_name:cfg.assistantName,
    profile_greeting:cfg.greeting,theme_color:cfg.color,
    scenario,route_path:route,preview_text:preview,
    product:scenario==='QUOTE'||scenario==='CATALOG'?{sku:p.sku,name:p.name,
     price_vnd:p.priceVnd,stock:p.stock}:null,
    lifecycle:'EXPERIMENTAL',synthetic_only:true,
    backend_identity_verified:false,actual_provider_auth_verified:false,
    real_ai_called:false,provider_sends:0,order_writes:0,hosted_writes:0,
    can_publish:false});
 }
 return Object.freeze({build,scenarios:Object.freeze(scenarios)});
});
