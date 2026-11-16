'use strict';
/** ADV.4: browser-only Advanced Custom Bot Studio. No network, persistence,
 * live agent, backend signer, provider send, Commerce write or real model.
 * Uses EXACT ADV.3 evaluator/ADV.2 canonical in the browser (UMD wrappers).
 */
(function(){
 const studioApi=window.T404Studio;
 const evaluator=window.T404PresentationEvaluator;
 const registry=window.T404Adv2Registry;
 const crosswalk=window.T404Adv4Capabilities;
 if(!studioApi||!evaluator||!registry||!crosswalk)
  throw Error('ADV4_REQUIRED_DEPENDENCIES_MISSING');
 const $=id=>document.getElementById(id);
 let studio=studioApi.createStudio(),last=null,renderCount=0;
 const text=(tag,value,cls)=>{
  const e=document.createElement(tag);
  if(value!==undefined)e.textContent=String(value);
  if(cls)e.className=cls;
  return e;
 };
 const enums={
  action:{NONE:'Không có',CATALOG:'Xem sản phẩm',QUOTE:'Xem giá',
   ORDER_REQUEST:'Yêu cầu đặt hàng',ASK_STAFF:'Gặp nhân viên',POLICY:'Chính sách',
   TRACK_ORDER:'Tra cứu đơn · cần xác minh',OPEN_VERIFIED_LINK:'Mở link · cần duyệt'},
  emphasis:{NONE:'Bình thường',PRICE:'Làm nổi bật giá',WARNING:'Cảnh báo',NOTE:'Ghi chú'},
  component:{TEXT:'Chữ thông thường',RICH_TEXT:'Chữ đậm/nghiêng/màu',
   PRODUCT_CARD:'Thẻ sản phẩm',PRODUCT_CAROUSEL:'Nhiều thẻ sản phẩm',
   QUICK_REPLIES:'Trả lời nhanh',OA_CTA:'Nút OA',ZBS_TEMPLATE:'ZBS · có phí',
   WIDGET_CAROUSEL:'Thẻ trượt web'},
  intent:{GREETING:'Chào hỏi',DISCOVER:'Tư vấn sản phẩm',QUOTE:'Báo giá',
   LOW_STOCK:'Kiểm tra tồn kho',POLICY:'Chính sách',ORDER_REQUEST:'Đặt hàng',
   ORDER_LOOKUP:'Tra đơn hàng',SUPPORT:'Hỗ trợ'}
 };
 const mapComponent={QUICK_REPLIES:'QUICK_REPLY',PRODUCT_CAROUSEL:'CAROUSEL',
  WIDGET_CAROUSEL:'CAROUSEL',TEXT:'TEXT',RICH_TEXT:'RICH_TEXT',
  PRODUCT_CARD:'PRODUCT_CARD',OA_CTA:'OA_CTA',ZBS_TEMPLATE:'ZBS_TEMPLATE'};
 const heuristic=input=>{
  const s=String(input||'').toLocaleLowerCase('vi-VN');
  if(/mã đơn|tra đơn|kiểm tra đơn/.test(s))return 'ORDER_LOOKUP';
  if(/tồn kho|sắp hết|còn bao nhiêu|hết hàng/.test(s))return 'LOW_STOCK';
  if(/đặt hàng|chốt đơn|muốn mua/.test(s))return 'ORDER_REQUEST';
  if(/đổi trả|chính sách|bảo hành/.test(s))return 'POLICY';
  if(/nhân viên|khiếu nại|hỗ trợ/.test(s))return 'SUPPORT';
  if(/báo giá|bao nhiêu tiền|giá/.test(s))return 'QUOTE';
  if(/gợi ý|sản phẩm|mẫu|tư vấn/.test(s))return 'DISCOVER';
  return 'GREETING';
 };
 function populate(id,values,labels,withAuto=false){
  const select=$(id);select.replaceChildren();
  if(withAuto){const opt=text('option','Tự chọn theo luật QA (không gọi AI)');opt.value='AUTO';select.append(opt);}
  for(const value of values){const opt=text('option',labels[value]||value);opt.value=value;select.append(opt);}
 }
 function start(){
  populate('intent',Object.keys(enums.intent),enums.intent,true);
  populate('emphasis',evaluator.EMPHASIS,enums.emphasis,true);
  populate('component',evaluator.COMPONENT,enums.component,true);
  populate('action',evaluator.ACTION,enums.action,true);
  populate('tone',studioApi.TONES,Object.fromEntries(studioApi.TONES.map(x=>[x,x])));
  refreshProfile();
  for(const id of ['shop','channel'])$(id).addEventListener('change',()=>{refreshProfile();preview()});
  for(const id of ['question','intent','emphasis','component','action','media'])$(id).addEventListener('input',preview);
  $('saveDraft').addEventListener('click',saveDraft);
  $('exportDraft').addEventListener('click',exportDraft);
  $('resetDraft').addEventListener('click',()=>{studio=studioApi.createStudio();last=null;refreshProfile();preview();notice('Đã đặt lại bản nháp trong bộ nhớ QA.')});
  preview();
 }
 function scope(){return{shop:$('shop').value,channel:$('channel').value}}
 function refreshProfile(){
  const {shop,channel}=scope(),cfg=studio.get(shop,channel);
  $('assistantName').value=cfg.assistantName;
  $('greeting').value=cfg.greeting;
  $('tone').value=cfg.tone;
  $('shopColor').value=cfg.color;
  $('showStock').checked=cfg.showStock;
  $('profileVersion').textContent='Nháp ' +cfg.bot_profile_version+' · '+cfg.approval_status+' · riêng '+shop+'/'+channel;
  $('exportJson').value='';
 }
 function notice(message){
  $('notice').textContent=message;
 }
 function saveDraft(){
  const {shop,channel}=scope(),prev=studio.get(shop,channel);
  const incoming={
   assistantName:$('assistantName').value,greeting:$('greeting').value,
   tone:$('tone').value,color:$('shopColor').value,showStock:$('showStock').checked
  },patch={};
  for(const [key,v] of Object.entries(incoming))if(prev[key]!==v)patch[key]=v;
  if(!Object.keys(patch).length){notice('Không có thay đổi cần lưu.');return}
  try{
   const cfg=studio.update(shop,channel,patch,'INTERNAL_STAFF_QA');
   $('profileVersion').textContent='Nháp '+cfg.bot_profile_version+' · '+cfg.approval_status+' · riêng '+shop+'/'+channel;
   notice('Đã lưu vào bộ nhớ trang QA, chưa gửi lên server.');
   preview();
  }catch(e){notice('Không lưu được: '+e.message)}
 }
 function choose(intent,channel){
  const emphasis=['QUOTE','ORDER_REQUEST'].includes(intent)?'PRICE':
   ['LOW_STOCK','ORDER_LOOKUP'].includes(intent)?'WARNING':
   ['POLICY','SUPPORT'].includes(intent)?'NOTE':'NONE';
  const component=intent==='GREETING'&&channel==='MESSENGER'?'QUICK_REPLIES':
   intent==='DISCOVER'&&['MESSENGER','WEB_WIDGET'].includes(channel)?'PRODUCT_CARD':
   ['QUOTE','LOW_STOCK','POLICY'].includes(intent)&&['ZALO_BOT','WEB_WIDGET'].includes(channel)?'RICH_TEXT':'TEXT';
  const action={GREETING:'CATALOG',DISCOVER:'QUOTE',QUOTE:'ORDER_REQUEST',
   POLICY:'ASK_STAFF',ORDER_REQUEST:'ASK_STAFF',ORDER_LOOKUP:'TRACK_ORDER',
   SUPPORT:'ASK_STAFF'}[intent]||'NONE';
  return {emphasis,component,action};
 }
 function parseControls(){
  const {shop,channel}=scope();
  const intent=$('intent').value==='AUTO'?heuristic($('question').value):$('intent').value;
  const defaultProposal=choose(intent,channel);
  return {shop,channel,intent,
   presentation:{emphasis:$('emphasis').value==='AUTO'?defaultProposal.emphasis:$('emphasis').value,
    component:$('component').value==='AUTO'?defaultProposal.component:$('component').value,
    action:$('action').value==='AUTO'?defaultProposal.action:$('action').value,
    media:$('media').value}};
 }
 function addStyled(container,value,segments){
  if(!Array.isArray(segments)){container.append(text('span',value));return}
  let end=0;
  const allowed=new Set(['PRICE','WARNING','NOTE']);
  for(const span of [...segments].sort((a,b)=>a.start-b.start)){
   if(!span||!Number.isSafeInteger(span.start)||!Number.isSafeInteger(span.len)||
     span.start<end||span.len<=0||span.start+span.len>value.length||!allowed.has(span.kind))continue;
   container.append(document.createTextNode(value.slice(end,span.start)));
   const el=text(span.kind==='NOTE'?'em':'strong',value.slice(span.start,span.start+span.len));
   el.className='style-'+span.kind.toLowerCase();
   container.append(el);end=span.start+span.len;
  }
  container.append(document.createTextNode(value.slice(end)));
 }
 function draw(decision,cross,requestedCapability){
  const screen=$('screen');screen.replaceChildren();
  const d=decision.decision,r=decision.preview;
  const safeRich=cross.previewEligible && d.selectedComponent!=='TEXT';
  screen.append(text('div','MÔ PHỎNG · KHÔNG GỬI','simulation'));
  const bubble=text('div',undefined,'bubble');
  const message=String(r.text||'');
  addStyled(bubble,message,safeRich?r.segments:[]);
  screen.append(bubble);
  if(safeRich && d.selectedComponent==='PRODUCT_CARD'){
   const cards=text('div',undefined,'cards');
   for(const item of r.cards||[]){
    const card=text('div',undefined,'product-card');
    card.append(text('span','▣ Ảnh chưa xác minh','image-missing'));
    card.append(text('strong',item.title));
    card.append(text('span',item.priceLabel||item.subtitle||''));
    card.append(text('small','SKU: '+item.sku+' · dữ liệu QA'));
    cards.append(card);
   }
   screen.append(cards);
  }
  const a=screen.appendChild(text('div',undefined,'buttons'));
  const canShowButtons=safeRich || d.selectedComponent==='TEXT'&&cross.previewEligible;
  if(canShowButtons){
   for(const item of r.buttons||[]){
    if(item.interactive!==false||item.requiresSignedServerAction!==true)continue;
    const b=text('button',item.label+' · chưa kích hoạt');
    b.type='button';b.disabled=true;b.setAttribute('aria-label',item.label+' — xem trước, không thể thực thi');
    a.append(b);
   }
   for(const item of r.cards||[])for(const b0 of item.buttons||[]){
    if(item && b0.interactive===false&&b0.requiresSignedServerAction===true){
     // Card CTA is a visual-only, disabled suggestion.
     const b=text('button',b0.label+' · cần ký server');b.type='button';b.disabled=true;a.append(b);
    }
   }
  }
  $('selectedInfo').textContent='Hợp đồng: '+decision.contract+' · '+d.selectedComponent+
   (cross.previewEligible?' · thành phần hợp lệ để xem trước':' · chuyển thành chữ do khác biệt registry');
  $('actionStatus').textContent=d.actionSuggestion==='NONE'?
   'Không có action được policy cấp cho preview.':
   'Hành động gợi ý: '+d.actionSuggestion+' · KHÔNG thực thi, chưa có chữ ký server.';
  $('fallbackInfo').textContent=[...new Set([...d.fallbackReasons,
   ...(cross.previewEligible?[]:[cross.reason]),
   ...(requestedCapability?.previewEligible?[]:[requestedCapability?.reason])].filter(Boolean))].join(' · ')||'Không có fallback bổ sung.';
  $('qaStatus').textContent='EXPERIMENTAL / QA / 0 provider send / 0 order write';
 }
 function matrix(shop,channel){
  const f=studioApi.FIXTURES[shop],tbody=$('capabilityRows');tbody.replaceChildren();
  const rows=crosswalk.list({channel,tenant_id:f.tenantId,store_id:f.storeId});
  for(const m of rows){
   const tr=text('tr');tr.dataset.component=m.component;tr.dataset.status=m.sourceState;
   tr.append(text('td',m.component));
   tr.append(text('td',m.sourceState.replaceAll('_',' ')));
   tr.append(text('td',m.canonicalComponent||'Chưa ánh xạ'));
   tr.append(text('td',m.previewEligible?'Xem thử · Không gửi':'Fallback TEXT / kiểm tra'));
   tbody.append(tr);
  }
  $('capabilitySummary').textContent=rows.length+' thành phần mô tả từ ADV.2 #144 → registry chuẩn #138 ('+
   registry.REGISTRY.length+' bản ghi theo kênh). Không có quyền gửi tin đã xác nhận.';
 }
 function preview(){
  const c=parseControls(),{shop,channel}=c;
  try{
   const raw=JSON.stringify({contract:evaluator.INPUT_CONTRACT,intent:c.intent,
    presentation:{emphasis:c.presentation.emphasis,component:c.presentation.component,
     media:c.presentation.media,action:c.presentation.action}});
   const decision=evaluator.decide({raw,shop,channel,studio});
   const feature=mapComponent[decision.decision.selectedComponent]||'TEXT';
   const f=studioApi.FIXTURES[shop];
   const capability=crosswalk.row({channel,component:feature,tenant_id:f.tenantId,store_id:f.storeId});
   const requestedCapability=crosswalk.row({channel,
    component:mapComponent[c.presentation.component]||'TEXT',tenant_id:f.tenantId,store_id:f.storeId});
   $('shopName').textContent=studio.get(shop,channel).assistantName+' · '+f.name;
   $('channelName').textContent=channel+' · '+c.intent+' · mô hình thật chưa chạy';
   $('screen').style.borderColor=studio.get(shop,channel).color;
   draw(decision,capability,requestedCapability);matrix(shop,channel);
   $('outJson').textContent=JSON.stringify({source:'SYNTHETIC_QA_ONLY',contract:decision.contract,
    intent:c.intent,shop,channel,decision:decision.decision,
    capability:{version:crosswalk.VERSION,feature,previewEligible:capability.previewEligible,
     reason:capability.reason,requestedFeature:requestedCapability.component,
     requestedReason:requestedCapability.reason},
    actionRegistry:'SERVER_ONLY_NOT_EXECUTED',providerSends:0,ordersWritten:0,
    hostedReads:0,hostedWrites:0,paidModelCalls:0},null,2);
   last={scope:c,decision,capability};renderCount++;notice('Xem trước an toàn · bản nháp chưa được xuất bản.');
  }catch(e){
   last=null;$('screen').replaceChildren(text('p','Đã chặn bản xem trước: '+e.message));
   $('actionStatus').textContent='Hành động bị chặn';$('qaStatus').textContent='QA / FAIL-CLOSED';
   $('outJson').textContent=JSON.stringify({status:'BLOCKED',reason:e.message},null,2);
  }
 }
 function exportDraft(){
  if(!last){notice('Chưa có bản xem trước hợp lệ để xuất.');return}
  const {shop,channel}=scope();
  const file=studio.exportDraft(shop,channel);
  // Export contains only synthetic Shop configuration and policy metadata;
  // it is NOT a deployable manifest, authenticated proof, or live token.
  $('exportJson').value=JSON.stringify({scope:'ADVANCED_STUDIO_QA_ONLY',
   schema:'V15_2_ADV4_DRAFT_EXPORT_1',config:file,
   presentation:{intent:last.scope.intent,proposal:last.scope.presentation,
    resultComponent:last.decision.decision.selectedComponent,
    reasons:last.decision.decision.fallbackReasons},
   actionRegistry:{receipt:'NOT_ISSUED_BROWSER',serverSignerRequired:true,
    actionExecutable:false,providerSendAuthorized:false},
   releaseAuthorized:false},null,2);
  notice('Đã xuất JSON QA vào ô bên dưới; không gửi dữ liệu ra ngoài.');
 }
 start();
 Object.defineProperty(window,'T404Adv4Inspector',{value:Object.freeze({
  status:()=>Object.freeze({renderCount,hasPreview:!!last,canSend:false,
   canWriteOrders:false,realModelCalls:0,hostedReads:0,
   studio:studio.inspect()}),
 }),writable:false});
})();
