'use strict';
/* V14.7 internal EXPERIMENTAL synthetic-only configuration contract.
 * UMD for a zero-dependency in-memory staff preview (browser + node:test).
 * NO credentials, AI calls, outbound sends, databases, persistent storage,
 * hosted authorization, or browser-as-identity assumptions.
 */
(function(factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
  if(typeof window!=='undefined') Object.defineProperty(window,'T404Studio',{value:api,writable:false});
})(function(){
 const CHANNELS=Object.freeze(['MESSENGER','ZALO_BOT','ZALO_OA','WEB_WIDGET']);
 const TONES=Object.freeze(['thân thiện','cao cấp','chuyên nghiệp','ngắn gọn','kỹ thuật']);
 const ALLOWED_ACTIONS=Object.freeze(['CATALOG','QUOTE','ORDER_REQUEST','ASK_STAFF','POLICY']);
 const FEATURES=Object.freeze(['text','image','carousel','quickReply','button','menu','richText','webview','handoff']);
 const DOCUMENTED='DOCUMENTED_NOT_TESTED',UNKNOWN='UNKNOWN',NEEDS='ACCOUNT_PERMISSION_REQUIRED';
 const CAPABILITIES=Object.freeze({
  MESSENGER:Object.freeze({text:DOCUMENTED,image:DOCUMENTED,carousel:DOCUMENTED,quickReply:DOCUMENTED,button:DOCUMENTED,menu:DOCUMENTED,richText:UNKNOWN,webview:NEEDS,handoff:NEEDS}),
  ZALO_BOT:Object.freeze({text:DOCUMENTED,image:DOCUMENTED,carousel:UNKNOWN,quickReply:UNKNOWN,button:UNKNOWN,menu:UNKNOWN,richText:DOCUMENTED,webview:UNKNOWN,handoff:UNKNOWN}),
  ZALO_OA:Object.freeze({text:NEEDS,image:NEEDS,carousel:UNKNOWN,quickReply:UNKNOWN,button:NEEDS,menu:NEEDS,richText:UNKNOWN,webview:NEEDS,handoff:NEEDS}),
  WEB_WIDGET:Object.freeze({text:'SOURCE_PREVIEW_ONLY',image:'SOURCE_PREVIEW_ONLY',carousel:'SOURCE_PREVIEW_ONLY',quickReply:'SOURCE_PREVIEW_ONLY',button:'SOURCE_PREVIEW_ONLY',menu:'SOURCE_PREVIEW_ONLY',richText:'SOURCE_PREVIEW_ONLY',webview:'SOURCE_PREVIEW_ONLY',handoff:'SOURCE_PREVIEW_ONLY'})
 });
 const FIXTURES=Object.freeze({
  A:Object.freeze({tenantId:'qa_tenant_1',storeId:'qa_shop_a',industry:'Tạp hóa',name:'Tạp hóa An',initials:'AN',tone:'thân thiện',color:'#16A085',
   greeting:'Xin chào! Tiệm An có thể giúp bạn tìm hàng và xem giá nhé.',assistantName:'An AI',product:Object.freeze({sku:'A001',name:'Gạo thơm túi 5kg',priceVnd:159000,stock:3,unit:'túi',emoji:'🌾'})}),
  B:Object.freeze({tenantId:'qa_tenant_1',storeId:'qa_shop_b',industry:'Thời trang',name:'Thời trang Bình',initials:'BÌ',tone:'cao cấp',color:'#8960D6',
   greeting:'Chào bạn, Bình rất vui được tư vấn phong cách phù hợp.',assistantName:'Bình Stylist',product:Object.freeze({sku:'A001',name:'Áo kiểu nữ',priceVnd:209000,stock:8,unit:'chiếc',emoji:'👗'})}),
  C:Object.freeze({tenantId:'qa_tenant_2',storeId:'qa_shop_c',industry:'Vật liệu',name:'Vật liệu Cường',initials:'CƯ',tone:'kỹ thuật',color:'#D58936',
   greeting:'Chào anh/chị, Cường hỗ trợ tra mã vật liệu và báo giá.',assistantName:'Cường Tư vấn',product:Object.freeze({sku:'A001',name:'Xi măng bao 50kg',priceVnd:259000,stock:2,unit:'bao',emoji:'🧱'})})
 });
 const CONTRACT_FIELDS=Object.freeze(['tenant_id','store_id','channel','merchant_profile_version','bot_profile_version','prompt_version','knowledge_version','template_set_id','theme_version','industry_profile','capability_snapshot_version','policy_version','approval_status','approved_by','published_at','last_qa_result','rollback_version']);
 const fail=(s)=>{throw new Error(s)};
 const text=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.trim().length<=max&&!/[\u0000-\u001f\u007f<>]/.test(v);
 const money=(v)=>{if(!Number.isSafeInteger(v)||v<0)fail('INVALID_SYNTHETIC_VND');return new Intl.NumberFormat('vi-VN').format(v)+'đ'};
 const clone=(v)=>JSON.parse(JSON.stringify(v));
 function createStudio(){
  const drafts=new Map(),audit=[];
  const key=(s,c)=>{if(!Object.hasOwn(FIXTURES,s)||!CHANNELS.includes(c))fail('UNKNOWN_STORE_OR_CHANNEL');return s+'|'+c};
  function initial(s,c){const f=FIXTURES[s];return {contractVersion:'14.7.0-draft',tenant_id:f.tenantId,store_id:f.storeId,channel:c,
    merchant_profile_version:'qa-v1',bot_profile_version:1,prompt_version:'qa-prompt-v1',knowledge_version:'qa-knowledge-v1',
    template_set_id:'qa-'+s.toLowerCase(),theme_version:1,industry_profile:f.industry,capability_snapshot_version:'2026-11-16-docs',
    policy_version:'GLOBAL_CORE_LOCKED',approval_status:'EXPERIMENTAL',approved_by:null,published_at:null,
    last_qa_result:null,rollback_version:null,
    assistantName:f.assistantName,greeting:f.greeting,tone:f.tone,color:f.color,
    menu:[{id:'CATALOG',label:'Xem sản phẩm'},{id:'QUOTE',label:'Hỏi giá'},{id:'ASK_STAFF',label:'Gặp nhân viên'}],
    showStock:true,providerSends:0,hostedWrites:0,realAiCalls:0};}
  function get(s,c){const k=key(s,c);if(!drafts.has(k))drafts.set(k,initial(s,c));return clone(drafts.get(k))}
  function update(s,c,patch,actor='INTERNAL_STAFF_QA'){
   const k=key(s,c),old=get(s,c);
   if(actor!=='INTERNAL_STAFF_QA'&&actor!=='MERCHANT_QA')fail('ACTOR_ROLE_DENIED');
   if(!patch||typeof patch!=='object'||Array.isArray(patch))fail('CONFIG_PATCH_INVALID');
   const permitted=actor==='MERCHANT_QA'?['assistantName','greeting','tone','showStock']:['assistantName','greeting','tone','color','menu','showStock'];
   const fields=Object.keys(patch);
   if(!fields.length||fields.some(x=>!permitted.includes(x)))fail('GLOBAL_POLICY_OR_SCOPE_LOCKED');
   const next={...old};
   for(const field of fields){
    const v=patch[field];
    if(field==='assistantName'||field==='greeting'){
      if(!text(v,field==='assistantName'?60:240))fail('CUSTOM_TEXT_INVALID');
      next[field]=v.trim();
    }else if(field==='tone'){
      if(!TONES.includes(v))fail('TONE_NOT_APPROVED');next.tone=v;
    }else if(field==='color'){
      if(typeof v!=='string'||!/^#[0-9A-Fa-f]{6}$/.test(v))fail('COLOR_INVALID');next.color=v;
    }else if(field==='showStock'){
      if(typeof v!=='boolean')fail('DISPLAY_FLAG_INVALID');next.showStock=v;
    }else if(field==='menu'){
      if(!Array.isArray(v)||!v.length||v.length>5)fail('MENU_INVALID');
      const seen=new Set();
      next.menu=v.map(x=>{if(!x||!ALLOWED_ACTIONS.includes(x.id)||!text(x.label,30)||seen.has(x.id))fail('MENU_ACTION_DENIED');seen.add(x.id);return{id:x.id,label:x.label.trim()}});
    }
   }
   next.bot_profile_version=old.bot_profile_version+1;
   next.theme_version=old.theme_version+(fields.includes('color')?1:0);
   next.approval_status='EXPERIMENTAL';next.approved_by=null;next.published_at=null;
   next.last_qa_result=null;next.rollback_version=null;
   drafts.set(k,next);audit.push({store:s,channel:c,change:fields.slice(),version:next.bot_profile_version,mode:'MEMORY_ONLY'});
   return clone(next);
  }
  function preview(s,c,flow='CONSULT'){
   const cfg=get(s,c),f=FIXTURES[s];
   if(!['CONSULT','QUOTE','ORDER','SUPPORT'].includes(flow))fail('UNKNOWN_FLOW');
   const p=f.product,formatted=money(p.priceVnd);
   let answer='';
   if(flow==='CONSULT')answer=cfg.greeting+' Gợi ý: '+p.name+' ('+p.sku+').';
   if(flow==='QUOTE')answer=p.name+' ('+p.sku+'): '+formatted+(cfg.showStock?' · Còn '+p.stock+' '+p.unit:'')+'. Chỉ là giá QA giả lập.';
   if(flow==='ORDER')answer='Yêu cầu thử 1 '+p.unit+' '+p.name+' — '+formatted+'. Cần khách xác nhận; KHÔNG lưu đơn hay giữ kho.';
   if(flow==='SUPPORT')answer='Mình ghi nhận bạn cần gặp nhân viên. Chế độ mô phỏng KHÔNG gửi thông báo cho shop.';
   const card=(c==='MESSENGER'||c==='WEB_WIDGET')&&flow==='CONSULT';
   const numbered=(c==='ZALO_BOT'||c==='ZALO_OA');
   const actions=cfg.menu.map(m=>({...m,interactive:false}));
   return {mode:'SYNTHETIC_NO_SEND',source:'UNTRUSTED_VISUAL_FIXTURE',channel:c,tenantId:f.tenantId,storeId:f.storeId,
    assistantName:cfg.assistantName,storeName:f.name,industry:f.industry,version:cfg.bot_profile_version,
    tone:cfg.tone,color:cfg.color,flow,text:answer,product:clone(p),priceLabel:formatted,
    showCard:card,numberedFallback:numbered,menu:actions,capabilities:clone(CAPABILITIES[c]),
    orderCreated:false,stockReserved:false,providerSends:0,hostedWrites:0,realAiCalls:0,
    realProviderVerified:false,releaseAuthorized:false};
  }
  function exportDraft(s,c){const cfg=get(s,c);return{kind:'TIEN404_V147_SYNTHETIC_DRAFT',releaseAuthorized:false,credentialFields:0,
    config:cfg,capabilities:clone(CAPABILITIES[c]),disclaimer:'Local QA only. Untrusted export; import requires approval and server identity.'};}
  function inspect(){return{draftCount:drafts.size,audit:clone(audit),realAiCalls:0,hostedWrites:0,providerSends:0,publishedConfigWrites:0,canRelease:false};}
  return Object.freeze({get,update,preview,exportDraft,inspect,
   publish(){fail('PUBLISH_REQUIRES_AUTHENTICATED_SERVER_GATE')},
   applyToHosted(){fail('HOSTED_WRITE_DISABLED')}});
 }
 return Object.freeze({CHANNELS,TONES,ALLOWED_ACTIONS,FEATURES,CAPABILITIES,FIXTURES,CONTRACT_FIELDS,createStudio,money});
});
