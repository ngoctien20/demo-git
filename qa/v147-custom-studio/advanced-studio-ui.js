'use strict';
/*
 * V15.2-ADV.4 Advanced Studio Browser QA.
 * Entirely memory-local. Reuses exact ADV.3 policy/evaluator and ADV.2 registry.
 * No fetch/credential, storage, provider API, hosted write, model inference or publish.
 * All dynamic content uses textContent/createTextNode (never HTML injection).
 */
(function(){
 const api=window.T404Studio;
 const engine=window.T404PresentationEvaluator;
 const registry=window.T404ChannelRegistry;
 if(!api||!engine||!registry)throw Error('ADV4_REQUIRED_DEPENDENCIES_MISSING');
 const $=id=>document.getElementById(id);
 const el=(tag,text,className)=>{
   const node=document.createElement(tag);
   if(text!==undefined&&text!==null)node.textContent=String(text);
   if(className)node.className=className;
   return node;
 };
 const channelLabels={
   MESSENGER:'Messenger',ZALO_BOT:'Zalo Bot',
   ZALO_OA:'Zalo Official Account',WEB_WIDGET:'Website Widget'
 };
 const intentLabels={
   GREETING:'Chào hỏi',DISCOVER:'Tư vấn sản phẩm',QUOTE:'Báo giá',
   LOW_STOCK:'Tồn kho',POLICY:'Chính sách',ORDER_REQUEST:'Yêu cầu đặt hàng',
   ORDER_LOOKUP:'Tra mã đơn',SUPPORT:'Gặp nhân viên'
 };
 const componentLabels={
   TEXT:'Văn bản đơn giản',RICH_TEXT:'Chữ đậm / nghiêng / cảnh báo',
   PRODUCT_CARD:'Thẻ sản phẩm',PRODUCT_CAROUSEL:'Carousel sản phẩm',
   QUICK_REPLIES:'Lựa chọn nhanh',OA_CTA:'Nút CTA Zalo OA',
   ZBS_TEMPLATE:'Mẫu tin ZBS có phí',WIDGET_CAROUSEL:'Carousel Website'
 };
 const actionLabels={
   NONE:'Không có hành động',CATALOG:'Xem danh mục',QUOTE:'Xem báo giá',
   ORDER_REQUEST:'Yêu cầu đơn hàng',ASK_STAFF:'Gặp nhân viên',POLICY:'Xem chính sách',
   TRACK_ORDER:'Tra cứu đơn',OPEN_VERIFIED_LINK:'Mở đường dẫn đã duyệt'
 };
 const reasonLabels={
   COMPONENT_NOT_AVAILABLE_OR_APPROVED:'Định dạng chưa được duyệt cho kênh.',
   PRODUCT_CARD_CONTEXT_OR_CHANNEL_DENIED:'Thẻ sản phẩm không phù hợp ngữ cảnh hoặc kênh.',
   RICH_TEXT_CONTEXT_OR_CHANNEL_DENIED:'Kênh hoặc ngữ cảnh không hỗ trợ định dạng chữ.',
   QUICK_REPLY_CONTEXT_OR_CHANNEL_DENIED:'Lựa chọn nhanh không phù hợp kênh/ngữ cảnh.',
   CAROUSEL_REQUIRES_MULTIPLE_VERIFIED_PRODUCTS:'Thiếu nhiều sản phẩm đã xác minh để tạo carousel.',
   PRIVILEGED_OR_ACCOUNT_COMPONENT_NOT_READY:'Quyền tính năng nâng cao của nhà cung cấp chưa được xác minh.',
   UNTRUSTED_EMPHASIS_NOT_GROUNDED:'Không có dữ liệu tin cậy cho kiểu nhấn mạnh này.',
   CHANNEL_OR_COMPONENT_CANNOT_APPLY_EMPHASIS:'Định dạng hiện tại không cho phép nhấn mạnh.',
   VERIFIED_CUSTOMER_IDENTITY_REQUIRED:'Tra cứu đơn phải xác minh danh tính khách/Owner.',
   ACTION_NOT_AUTHORIZED_BY_POLICY:'Hành động chưa được bộ quy tắc kinh doanh cho phép.',
   APPROVED_STORE_MEDIA_UNAVAILABLE:'Cửa hàng chưa có ảnh được duyệt trong thư viện.'
 };
 let studio=api.createStudio();
 const history=new Map();
 let viewMode='MOBILE';
 const key=()=>String($('shop').value)+'|'+String($('channel').value);
 const current=()=>({shop:$('shop').value,channel:$('channel').value});
 const clone=x=>JSON.parse(JSON.stringify(x));
 function appendOption(select,value,label){
   const option=el('option',label);
   option.value=value;select.append(option);
 }
 for(const value of engine.COMPONENT)appendOption($('component'),value,componentLabels[value]||value);
 for(const value of engine.ACTION)appendOption($('action'),value,actionLabels[value]||value);
 function ensureHistory(){
   const k=key();
   if(!history.has(k)){
     const {shop,channel}=current();
     history.set(k,[clone(studio.get(shop,channel))]);
   }
   return history.get(k);
 }
 function getBrandPatch(){
   return {
     assistantName:$('assistantName').value.trim(),
     greeting:$('greeting').value.trim(),
     tone:$('tone').value,
     color:$('color').value.toUpperCase(),
     showStock:$('showStock').checked
   };
 }
 function liveStudio(){
   const selected=current();
   return {
     get(shop,channel){
       const cfg=studio.get(shop,channel);
       if(shop!==selected.shop||channel!==selected.channel)return cfg;
       return {...cfg,...getBrandPatch()};
     }
   };
 }
 function fillBrand(){
   const {shop,channel}=current();
   const cfg=studio.get(shop,channel);
   $('assistantName').value=cfg.assistantName;
   $('greeting').value=cfg.greeting;
   $('tone').value=cfg.tone;
   $('color').value=cfg.color;
   $('colorLabel').textContent=cfg.color.toUpperCase();
   $('showStock').checked=cfg.showStock;
   $('version').textContent='Draft v'+cfg.bot_profile_version;
   $('status').textContent='';
   ensureHistory();
   showHistory();
 }
 function preset(){
   const {shop,channel}=current(),intent=$('intent').value;
   const knownStock=api.FIXTURES[shop].product.stock;
   let component='TEXT',emphasis='NONE',media='NONE',action='NONE';
   if(intent==='GREETING'){component=channel==='MESSENGER'?'QUICK_REPLIES':'TEXT';action='CATALOG'}
   if(intent==='DISCOVER'){component=['MESSENGER','WEB_WIDGET'].includes(channel)?'PRODUCT_CARD':'TEXT';media='PRODUCT_IMAGE';action='QUOTE'}
   if(intent==='QUOTE'){component=channel==='MESSENGER'?'QUICK_REPLIES':['ZALO_BOT','WEB_WIDGET'].includes(channel)?'RICH_TEXT':'TEXT';emphasis='PRICE';action='ORDER_REQUEST'}
   if(intent==='LOW_STOCK'){component=['ZALO_BOT','WEB_WIDGET'].includes(channel)?'RICH_TEXT':'TEXT';emphasis=knownStock<=3?'WARNING':'NONE'}
   if(intent==='POLICY'){component=['ZALO_BOT','WEB_WIDGET'].includes(channel)?'RICH_TEXT':'TEXT';emphasis='NOTE';action='ASK_STAFF'}
   if(intent==='ORDER_REQUEST'){component=channel==='MESSENGER'?'QUICK_REPLIES':['ZALO_BOT','WEB_WIDGET'].includes(channel)?'RICH_TEXT':'TEXT';emphasis='PRICE';action='ASK_STAFF'}
   if(intent==='ORDER_LOOKUP'){component='TEXT';emphasis='NONE';action='TRACK_ORDER'}
   if(intent==='SUPPORT'){component=channel==='MESSENGER'?'QUICK_REPLIES':['ZALO_BOT','WEB_WIDGET'].includes(channel)?'RICH_TEXT':'TEXT';emphasis='NOTE';action='ASK_STAFF'}
   $('component').value=component;$('emphasis').value=emphasis;$('media').value=media;$('action').value=action;
 }
 function proposal(){
   return JSON.stringify({
     contract:engine.INPUT_CONTRACT,intent:$('intent').value,
     presentation:{emphasis:$('emphasis').value,component:$('component').value,
       media:$('media').value,action:$('action').value}
   });
 }
 function addStyledText(target,text,segments){
   const valid=(segments||[]).filter(x=>Number.isInteger(x.start)&&Number.isInteger(x.len)
     &&x.start>=0&&x.len>0&&x.start+x.len<=text.length)
     .sort((a,b)=>a.start-b.start);
   let offset=0;
   for(const segment of valid){
     if(segment.start<offset)continue;
     target.append(document.createTextNode(text.slice(offset,segment.start)));
     const span=el(segment.kind==='PRICE'?'strong':segment.kind==='NOTE'?'em':'span',
       text.slice(segment.start,segment.start+segment.len),
       segment.kind==='PRICE'?'price':segment.kind==='WARNING'?'warning':'note');
     target.append(span);
     offset=segment.start+segment.len;
   }
   target.append(document.createTextNode(text.slice(offset)));
 }
 function createButtons(items){
   const line=el('div',null,'action-list');
   for(const item of items||[]){
     const b=el('button',item.label+' · xem trước');
     b.type='button';b.disabled=true;
     b.setAttribute('aria-label',item.label+' — chỉ xem trước, không thực thi');
     line.append(b);
   }
   return line;
 }
 function paintDecision(result){
   const {shop,channel}=current();
   const cfg=liveStudio().get(shop,channel);
   const fixture=api.FIXTURES[shop];
   $('scope').textContent='Store QA: '+fixture.storeId+' · Tenant QA: '+fixture.tenantId+' · Chỉ có dữ liệu tổng hợp.';
   $('shopName').textContent=fixture.name;
   $('avatar').textContent=fixture.initials;
   $('assistantLabel').textContent=cfg.assistantName+' · '+channelLabels[channel]+' · bản nháp QA';
   $('device').style.setProperty('--store-accent',cfg.color);
   $('previewChannel').textContent=channelLabels[channel];
   $('capability').textContent='Registry '+registry.VERSION+' · chưa xác minh tài khoản';
   $('version').textContent='Draft v'+studio.get(shop,channel).bot_profile_version;
   const output=$('chat');output.replaceChildren();
   output.append(el('div','SYNTHETIC · NO SEND · KHÔNG DÙNG MODEL AI','stamp'));
   const bubble=el('div',null,'bubble');
   addStyledText(bubble,result.preview.text,result.preview.segments);
   output.append(bubble);
   if(result.preview.cards.length){
     const group=el('div',null,'cards');
     for(const card of result.preview.cards){
       const c=el('div',null,'product');
       c.append(el('div',fixture.product.emoji,'product-photo'));
       const body=el('div',null,'product-body');
       body.append(el('div',card.title,'product-title'));
       body.append(el('small','SKU '+card.sku+' · catalog QA'));
       body.append(el('div',card.priceLabel||card.subtitle||'', 'product-price'));
       c.append(body);
       if(card.buttons&&card.buttons.length)c.append(createButtons(card.buttons));
       group.append(c);
     }
     output.append(group);
   }
   if(result.preview.image){
     output.append(el('div','Ảnh được yêu cầu nhưng chưa có tài nguyên được xác minh.','stamp'));
   }
   if(result.preview.buttons.length)output.append(createButtons(result.preview.buttons));
   $('decisionTitle').textContent=intentLabels[result.modelProposal.intent]+' → '+(componentLabels[result.decision.selectedComponent]||result.decision.selectedComponent);
   $('decisionDetail').textContent='Nhấn mạnh: '+result.decision.selectedEmphasis+
     ' · Nút đề xuất: '+(actionLabels[result.decision.actionSuggestion]||result.decision.actionSuggestion)+
     ' · Không thực thi / không gửi.';
   $('decisionFallback').textContent=result.decision.fallbackReasons.length?
     'Hạ cấp bảo mật: '+result.decision.fallbackReasons.map(x=>reasonLabels[x]||x).join(' '):
     'Không phát hiện điều kiện cần hạ cấp trong fixture. Vẫn chưa có quyền gửi thật.';
   $('json').textContent=JSON.stringify({
     contract:result.contract,source:result.source,shop,channel,
     botVersion:studio.get(shop,channel).bot_profile_version,
     intent:result.modelProposal.intent,selectedComponent:result.decision.selectedComponent,
     selectedEmphasis:result.decision.selectedEmphasis,fallbackReasons:result.decision.fallbackReasons,
     actionExecutable:result.decision.actionExecutable,orderLookupAuthorized:result.orderLookupAuthorized,
     providerSends:result.providerSends,hostedWrites:result.hostedWrites,
     realModelCalls:result.realModelCalls,releaseAuthorized:result.releaseAuthorized
   },null,2);
 }
 function render(){
   const {shop,channel}=current();
   $('colorLabel').textContent=$('color').value.toUpperCase();
   try{
     const result=engine.decide({raw:proposal(),shop,channel,studio:liveStudio(),api});
     paintDecision(result);
     $('status').dataset.error='false';
   }catch(err){
     $('chat').replaceChildren(el('div','Không thể xem trước: '+err.message,'bubble'));
     $('decisionTitle').textContent='Đã chặn đầu vào không hợp lệ';
     $('decisionDetail').textContent='Vui lòng điều chỉnh tên hoặc lời chào; không có dữ liệu nào được gửi.';
     $('decisionFallback').textContent='';
     $('json').textContent=JSON.stringify({mode:'FAILED_CLOSED',error:String(err.message),providerSends:0,hostedWrites:0});
     $('status').dataset.error='true';
   }
 }
 function showHistory(){
   const list=ensureHistory();
   const wrap=$('history');wrap.replaceChildren();
   const selectedKey=key();
   const recent=list.slice(-8).reverse();
   for(const snapshot of recent){
     const line=el('div',null,'history-row');
     const info=el('span','Nháp v'+snapshot.bot_profile_version);
     const date=el('small',snapshot.tone+' · '+snapshot.assistantName);
     const restore=el('button','Tạo nháp từ v'+snapshot.bot_profile_version,'btn');
     restore.type='button';
     restore.disabled=snapshot.bot_profile_version===studio.get(...Object.values(current())).bot_profile_version;
     // The handler captures the exact scope; a stale button cannot edit another Shop.
     restore.addEventListener('click',()=>{
       if(key()!==selectedKey){$('status').textContent='Không thể khôi phục khác phạm vi Store/kênh.';return}
       try{
         const {shop,channel}=current();
         const patch={assistantName:snapshot.assistantName,greeting:snapshot.greeting,
           tone:snapshot.tone,color:snapshot.color,showStock:snapshot.showStock};
         const saved=studio.update(shop,channel,patch,'INTERNAL_STAFF_QA');
         ensureHistory().push(clone(saved));
         fillBrand();render();
         $('status').textContent='Đã tạo bản nháp khôi phục v'+saved.bot_profile_version+
           ' từ v'+snapshot.bot_profile_version+' (chỉ lưu trong bộ nhớ).';
       }catch(err){$('status').textContent='Không thể khôi phục: '+err.message}
     });
     line.append(info,date,restore);wrap.append(line);
   }
 }
 function saveDraft(){
   try{
     const {shop,channel}=current(),patch=getBrandPatch();
     const cfg=studio.update(shop,channel,patch,'INTERNAL_STAFF_QA');
     ensureHistory().push(clone(cfg));
     showHistory();render();
     $('status').textContent='Đã lưu bản nháp v'+cfg.bot_profile_version+
       ' trong bộ nhớ trình duyệt. Chưa phê duyệt hoặc phát hành.';
   }catch(err){$('status').textContent='Không thể lưu: '+err.message}
 }
 function resetDraft(){
   const {shop,channel}=current();
   const fresh=api.createStudio().get(shop,channel);
   const restored=studio.update(shop,channel,{
     assistantName:fresh.assistantName,greeting:fresh.greeting,tone:fresh.tone,
     color:fresh.color,showStock:fresh.showStock
   },'INTERNAL_STAFF_QA');
   ensureHistory().push(clone(restored));
   fillBrand();preset();render();
   $('status').textContent='Đã khôi phục mẫu '+shop+'/'+channel+' dưới nháp v'+restored.bot_profile_version+'. Các Shop khác không đổi.';
 }
 function exportDraft(){
   const {shop,channel}=current();
   const cfg=studio.exportDraft(shop,channel);
   const result={kind:'TIEN404_ADV4_MEMORY_ONLY_EXPORT',source:'SYNTHETIC_NO_SEND',
     approved:false,providerSends:0,hostedWrites:0,
     configuration:cfg,proposal:JSON.parse(proposal()),lifecycle:'EXPERIMENTAL'};
   const url=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:'application/json'}));
   try{
     const a=el('a');
     a.href=url;a.download='TIEN404_ADV4_QA_'+shop+'_'+channel+'.json';
     document.body.append(a);a.click();a.remove();
     $('status').textContent='Đã xuất JSON QA chưa được phê duyệt. Không chứa credential.';
   }finally{URL.revokeObjectURL(url)}
 }
 function validate(){
   const {shop,channel}=current();
   let passed=0,firstError=null;
   const snapshot={intent:$('intent').value,component:$('component').value,
     emphasis:$('emphasis').value,action:$('action').value,media:$('media').value};
   for(const intent of engine.INPUT_CONTRACT?Object.keys(intentLabels):[]){
     $('intent').value=intent;preset();
     try{
       const r=engine.decide({raw:proposal(),shop,channel,studio,api});
       if(r.providerSends===0&&r.hostedWrites===0&&r.realModelCalls===0&&
          r.releaseAuthorized===false&&r.decision.actionExecutable===false&&
          r.storeId===api.FIXTURES[shop].storeId)passed++;
     }catch(err){firstError=err.message;break}
   }
   $('intent').value=snapshot.intent;$('component').value=snapshot.component;
   $('emphasis').value=snapshot.emphasis;$('action').value=snapshot.action;$('media').value=snapshot.media;
   render();
   const ok=passed===8;
   $('qaStatus').textContent=(ok?'PASS':'FAIL')+' '+passed+'/8 ý định, Store '+shop+
     ' · '+channelLabels[channel]+'. Chỉ kiểm tra fixture offline'+(firstError?' · '+firstError:'')+
     '; không chứng minh quyền provider/JWT.';
   $('status').textContent=ok?'Đã kiểm tra bản nháp QA tổng hợp, không gửi hoặc ghi.':
     'QA chưa đạt: cần sửa trước khi yêu cầu duyệt.';
 }
 function changeScope(){
   ensureHistory();fillBrand();preset();render();
   $('qaStatus').textContent='Chưa chạy QA cho lựa chọn hiện tại.';
 }
 $('shop').addEventListener('change',changeScope);
 $('channel').addEventListener('change',changeScope);
 $('intent').addEventListener('change',()=>{preset();render()});
 for(const id of ['component','emphasis','media','action'])$(id).addEventListener('change',render);
 for(const id of ['assistantName','greeting','tone','color','showStock'])
   $(id).addEventListener(id==='showStock'||id==='tone'?'change':'input',render);
 $('save').addEventListener('click',saveDraft);
 $('reset').addEventListener('click',resetDraft);
 $('export').addEventListener('click',exportDraft);
 $('validate').addEventListener('click',validate);
 for(const [id,value] of [['mobile','MOBILE'],['desktop','DESKTOP']]){
   $(id).addEventListener('click',()=>{
     viewMode=value;
     $('device').dataset.device=value;
     for(const [button,mode] of [['mobile','MOBILE'],['desktop','DESKTOP']]){
       $(button).dataset.active=String(mode===viewMode);
       $(button).setAttribute('aria-pressed',String(mode===viewMode));
     }
   });
 }
 ensureHistory();fillBrand();preset();render();
})();
