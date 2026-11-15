'use strict';
/*
 * V14.7-04/05 — Provider capability-aware experience PREVIEW.
 * The presentation is NOT a provider request or a verified account permission.
 * No fetch, database, gateway, token, paid ZBS, provider send or real image.
 * Reuses existing T404Studio scoped synthetic shop/channel configs.
 */
(function(factory){
  const x=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=x;
  if(typeof window!=='undefined')Object.defineProperty(window,'T404Experience',{value:x,writable:false});
})(function(){
 const MODES=Object.freeze({
  MESSENGER:Object.freeze(['STANDARD','CAROUSEL','QUICK_REPLIES','PERSISTENT_MENU','WEBVIEW']),
  ZALO_BOT:Object.freeze(['STANDARD','RICH_TEXT','PHOTO_CAPTION','NUMBERED_MENU']),
  ZALO_OA:Object.freeze(['STANDARD','OA_CTA','OA_MENU','ZBS_TEMPLATE']),
  WEB_WIDGET:Object.freeze(['STANDARD'])
 });
 const META=Object.freeze({
  MESSENGER:Object.freeze({CAROUSEL:'DOCUMENTED_NOT_TESTED',QUICK_REPLIES:'DOCUMENTED_NOT_TESTED',
   PERSISTENT_MENU:'DOCUMENTED_NOT_TESTED',WEBVIEW:'ACCOUNT_PERMISSION_REQUIRED'}),
  ZALO_BOT:Object.freeze({RICH_TEXT:'DOCUMENTED_NOT_TESTED',PHOTO_CAPTION:'DOCUMENTED_NOT_TESTED',
   NUMBERED_MENU:'TEXT_FALLBACK_ONLY'}),
  ZALO_OA:Object.freeze({OA_CTA:'ACCOUNT_PERMISSION_REQUIRED',OA_MENU:'ACCOUNT_PERMISSION_REQUIRED',
   ZBS_TEMPLATE:'APPROVAL_AND_COST_GATE_REQUIRED'})
 });
 const fail=s=>{throw Error(s)};
 const text=(v,n)=>typeof v==='string'&&v.length>0&&v.length<=n&&!/[\u0000-\u001f\u007f<>]/.test(v);
 const copy=x=>JSON.parse(JSON.stringify(x));
 const money=x=>new Intl.NumberFormat('vi-VN').format(x)+'đ';
 function build({studio,api,shop,channel,mode='STANDARD'}={}){
  if(!studio||typeof studio.get!=='function'||!api||!api.FIXTURES||!api.CHANNELS)
   fail('TRUSTED_SYNTHETIC_STUDIO_REQUIRED');
  if(!Object.hasOwn(api.FIXTURES,shop)||!Object.hasOwn(MODES,channel)||
   !MODES[channel].includes(mode))fail('MODE_NOT_AVAILABLE_FOR_CHANNEL');
  const f=api.FIXTURES[shop],cfg=studio.get(shop,channel);
  if(cfg.tenant_id!==f.tenantId||cfg.store_id!==f.storeId||cfg.channel!==channel||
   cfg.approval_status!=='EXPERIMENTAL'||cfg.policy_version!=='GLOBAL_CORE_LOCKED')
   fail('CONFIG_SCOPE_OR_POLICY_UNVERIFIED');
  const p=f.product;
  if(!Number.isSafeInteger(p.priceVnd)||p.priceVnd<0||!Number.isSafeInteger(p.stock)||p.stock<0||
    !text(p.name,80)||!text(p.sku,80))fail('SYNTHETIC_CATALOG_INVALID');
  const options=cfg.menu.map(x=>{
   if(!api.ALLOWED_ACTIONS.includes(x.id)||!text(x.label,30))fail('ACTION_NOT_ALLOWED');
   return {id:x.id,label:x.label,interactive:false};
  });
  const out={mode,channel,tenantId:f.tenantId,storeId:f.storeId,botVersion:cfg.bot_profile_version,
    title:'BẢN XEM TRƯỚC · '+mode,providerCapability:META[channel]?.[mode]||'SOURCE_PREVIEW_ONLY',
    status:'SYNTHETIC_NO_SEND',providerSends:0,realAiCalls:0,orderWrites:0,realProviderVerified:false,
    pagePermissionVerified:false,merchantApprovalVerified:false,canPublish:false,
    message:cfg.greeting,cards:[],buttons:[],menu:[],photo:null,richRuns:[],webview:null,
    notes:['Chỉ xem trước bằng dữ liệu mẫu. Không gửi tin và không ghi đơn.']};
  if(mode==='CAROUSEL'){
   out.message='Ba thẻ sản phẩm QA độc lập trong Messenger Generic Template';
   out.cards=[1,2,3].map(i=>({itemId:'qa_'+shop+'_item_'+i,
    title:p.name+' · Mẫu '+i,sku:p.sku,priceVnd:p.priceVnd,
    priceLabel:money(p.priceVnd),stock:p.stock,emoji:p.emoji,
    buttons:[{label:'Xem giá',action:'VIEW_PRODUCT',interactive:false},
     {label:'Gặp nhân viên',action:'ASK_STAFF',interactive:false}]}));
   out.notes.push('Các thẻ cùng giá thử nghiệm; không phải catalog thật. Chưa ký postback và chưa có Page entitlement.');
  }else if(mode==='QUICK_REPLIES'){
   out.message=cfg.greeting;
   out.buttons=options.map(x=>({label:x.label,action:x.id,interactive:false}));
   out.notes.push('Quick Replies là hình ảnh mô phỏng; khi tích hợp phải dùng signed action và giới hạn nút API.');
  }else if(mode==='PERSISTENT_MENU'){
   out.message='Menu Page theo cấu hình shop (bản nháp, chưa áp dụng trên Fanpage)';
   out.menu=options;
   out.notes.push('Đây là menu cấp Page, không phải menu có thể thay đổi tùy ý theo PSID; cần Page owner approval.');
  }else if(mode==='WEBVIEW'){
   out.message='Webview hiển thị Catalog công khai ở website shop (mô phỏng)';
   out.webview={label:'Xem trên web',type:'PUBLIC_CATALOG_PREVIEW',url:null,
    personalOrdersAllowed:false,authenticated:false};
   out.notes.push('Không tạo URL triển khai thật; cần domain verified, quyền Meta và đăng nhập độc lập cho thông tin riêng tư.');
  }else if(mode==='RICH_TEXT'){
   const prefix='Báo giá QA: ';
   out.message=prefix+p.name+' — '+money(p.priceVnd);
   out.richRuns=[{start:0,len:prefix.length,st:['b']},
    {start:out.message.indexOf(money(p.priceVnd)),len:money(p.priceVnd).length,st:['b','c_15a85f']}];
   out.notes.push('Rich Text dùng text_styles UTF-16; chỉ cho phép style codes do tài liệu Bot công bố.');
  }else if(mode==='PHOTO_CAPTION'){
   out.message=p.name+' · '+money(p.priceVnd);
   out.photo={emoji:p.emoji,caption:out.message,photoUrl:null,source:'SYNTHETIC_EMOJI_NO_EXTERNAL_IMAGE'};
   out.notes.push('sendPhoto cần URL ảnh thật đã duyệt; demo chỉ sử dụng biểu tượng, không tạo đường dẫn giả.');
  }else if(mode==='NUMBERED_MENU'){
   out.message=cfg.greeting+'\n'+options.map((x,i)=>(i+1)+'. '+x.label).join('\n');
   out.notes.push('Đây là tin văn bản đánh số, KHÔNG phải native button của Zalo Bot.');
  }else if(mode==='OA_CTA'){
   out.message='Mẫu CTA tư vấn OA cho '+f.name+' (chưa có quyền OA được xác nhận)';
   out.buttons=options.map(x=>({label:x.label,action:x.id,interactive:false}));
   out.notes.push('Khả năng OA được tài liệu mô tả; API/UID/quyền gửi và điều kiện tương tác phải được chứng minh riêng.');
  }else if(mode==='OA_MENU'){
   out.message='Menu Zalo Official Account (chỉ mô phỏng)';
   out.menu=options;
   out.notes.push('Không phải cấu hình menu Bot. Chưa xác minh quyền quản trị hoặc OpenAPI OA.');
  }else if(mode==='ZBS_TEMPLATE'){
   out.message='ZBS Template: chỉ có khung xem trước. Chưa có mẫu được duyệt.';
   out.notes.push('Bị chặn: thiếu approved template ID, người nhận hợp lệ, quyền tài khoản và phê duyệt chi phí.');
  }else{
   out.message=cfg.greeting;
  }
  return copy(Object.freeze(out));
 }
 return Object.freeze({MODES,META,build});
});
