'use strict';
/* Browser-only ephemeral QA preview. All dynamic content rendered via textContent.
 * No API, fetch, credentials, browser storage, external images, or write backend.
 */
(function(){
 const api=window.T404Studio;
 if(!api)throw Error('MISSING_SYNTHETIC_CORE');
 let lab=api.createStudio(),shop='A',channel='MESSENGER',flow='CONSULT';
 const experience=window.T404Experience;
 if(!experience)throw Error('EXPERIENCE_LAB_REQUIRED');
 let experienceMode='STANDARD';
 const $=id=>document.getElementById(id);
 const menuPresets={
  basic:[{id:'CATALOG',label:'Xem sản phẩm'},{id:'QUOTE',label:'Hỏi giá'},{id:'ASK_STAFF',label:'Gặp nhân viên'}],
  sales:[{id:'CATALOG',label:'Xem sản phẩm'},{id:'QUOTE',label:'Hỏi giá'},{id:'ORDER_REQUEST',label:'Đặt thử'}],
  support:[{id:'POLICY',label:'Chính sách'},{id:'ASK_STAFF',label:'Gặp nhân viên'}]
 };
 const flowQuestions={CONSULT:'Shop có sản phẩm gì?',QUOTE:'Cho mình hỏi giá và tồn kho',ORDER:'Mình muốn đặt 1 sản phẩm',SUPPORT:'Mình muốn gặp nhân viên'};
 const channelLabels={MESSENGER:'Messenger',ZALO_BOT:'Zalo Bot',ZALO_OA:'Zalo Official Account',WEB_WIDGET:'Website Chat Widget'};
 const element=(tag,className,text)=>{const e=document.createElement(tag);if(className)e.className=className;if(text!=null)e.textContent=String(text);return e};
 function active(){
  for(const b of document.querySelectorAll('[data-shop]')){const yes=b.dataset.shop===shop;b.dataset.active=String(yes);b.setAttribute('aria-pressed',String(yes))}
  for(const b of document.querySelectorAll('[data-channel]')){const yes=b.dataset.channel===channel;b.dataset.active=String(yes);b.setAttribute('aria-pressed',String(yes))}
  for(const b of document.querySelectorAll('[data-flow]')){const yes=b.dataset.flow===flow;b.dataset.active=String(yes);b.setAttribute('aria-pressed',String(yes))}
 }
 function detectMenu(cfg){const ids=cfg.menu.map(x=>x.id);return ids.includes('ORDER_REQUEST')?'sales':ids.includes('POLICY')?'support':'basic'}
 function loadControls(){
  const cfg=lab.get(shop,channel);
  $('assistantName').value=cfg.assistantName;$('greeting').value=cfg.greeting;
  $('tone').value=cfg.tone;$('color').value=cfg.color;$('colorCode').value=cfg.color;
  $('menuPreset').value=detectMenu(cfg);$('showStock').checked=cfg.showStock;
  $('status').textContent='';$('qaOutput').classList.remove('show');
 }
 function bubble(parent,text,user=false){
  const b=element('div',user?'bubble from-user':'bubble');
  b.textContent=text;parent.append(b);return b;
 }
 function render(){
  active();
  const cfg=lab.get(shop,channel),view=lab.preview(shop,channel,flow),f=api.FIXTURES[shop];
  $('version').textContent='Draft v'+cfg.bot_profile_version;
  $('channelTitle').textContent=channelLabels[channel];
  $('chatTitle').textContent=f.name;
  $('chatSubtitle').textContent=channelLabels[channel]+' · preview QA';
  $('chatAvatar').textContent=f.initials;
  $('phone').style.setProperty('--accent',cfg.color);
  $('capability').textContent=channel==='MESSENGER'?'Generic Template: tài liệu API, chưa live':
    channel==='ZALO_BOT'?'Rich Text / ảnh: tài liệu API, chưa live':
    channel==='ZALO_OA'?'Cần quyền OA và kiểm tra mẫu tin':
    'Widget QA do TIEN404 tự xây';
  const chat=$('chat');chat.replaceChildren(element('div','date','Hôm nay · hội thoại giả lập'));
  bubble(chat,flowQuestions[flow],true);
  const group=element('div','bubble');
  group.append(element('div','qa-stamp','SYNTHETIC · KHÔNG GỬI'));
  group.append(document.createTextNode(view.text));
  chat.append(group);
  if(view.showCard){
   const card=element('div','product-card');
   card.append(element('div','product-photo',f.product.emoji));
   const info=element('div','product-info');
   info.append(element('strong',null,f.product.name));
   info.append(element('small',null,'SKU '+f.product.sku+' · dữ liệu thử nghiệm'));
   info.append(element('div','price',view.priceLabel));
   card.append(info);
   const btns=element('div','product-buttons');
   btns.append(element('button',null,'Xem giá · mô phỏng'),element('button',null,'Đặt thử · mô phỏng'));
   for(const b of btns.children){b.type='button';b.disabled=true}
   card.append(btns);chat.append(card);
  }
  if(view.numberedFallback){
   const items=view.menu.map((a,i)=>(i+1)+' — '+a.label).join('\n');
   bubble(chat,'Gợi ý lựa chọn (dạng văn bản):\n'+items);
  }else{
   const choices=element('div','choices');
   for(const a of view.menu)choices.append(element('span',null,a.label+' · preview'));
   chat.append(choices);
  }
  renderExperience();
 }

 function renderExperience(){
  const container=$('experienceModes'),target=$('experienceOutput');
  container.replaceChildren();
  for(const mode of experience.MODES[channel]){
   const btn=element('button',null,({
     STANDARD:'Mặc định',CAROUSEL:'Carousel',QUICK_REPLIES:'Quick Replies',
     PERSISTENT_MENU:'Menu Page',WEBVIEW:'Webview',RICH_TEXT:'Rich Text',
     PHOTO_CAPTION:'Ảnh & caption',NUMBERED_MENU:'Menu đánh số',
     OA_CTA:'OA CTA',OA_MENU:'Menu OA',ZBS_TEMPLATE:'ZBS Template'
   })[mode]||mode);
   btn.type='button';btn.dataset.experience=mode;btn.dataset.active=String(mode===experienceMode);
   btn.setAttribute('aria-pressed',String(mode===experienceMode));
   btn.addEventListener('click',()=>{experienceMode=mode;renderExperience()});
   container.append(btn);
  }
  target.replaceChildren();
  const x=experience.build({studio:lab,api,shop,channel,mode:experienceMode});
  const status=$('experienceStatus');
  status.textContent=x.providerCapability==='DOCUMENTED_NOT_TESTED'?'API có tài liệu · chưa test tài khoản':
    x.providerCapability==='ACCOUNT_PERMISSION_REQUIRED'?'Cần quyền provider':
    x.providerCapability==='APPROVAL_AND_COST_GATE_REQUIRED'?'Cần duyệt mẫu và ngân sách':
    x.providerCapability==='TEXT_FALLBACK_ONLY'?'Dạng văn bản thay thế':'Chỉ mô phỏng nội bộ';
  target.append(element('div','exp-title',x.title+' · '+x.status));
  target.append(element('div','exp-message',x.message));
  if(x.cards.length){
   const scroller=element('div','exp-carousel');
   for(const card of x.cards){
    const item=element('div','exp-card');
    item.append(element('div','exp-photo',card.emoji));
    const body=element('div','exp-cardbody');
    body.append(element('strong',null,card.title));
    body.append(element('small',null,'SKU: '+card.sku+' · Sản phẩm QA'));
    body.append(element('div','exp-price',card.priceLabel));
    item.append(body);
    item.append(element('div','exp-cardbtns','Xem giá | Gặp nhân viên · không tương tác'));
    scroller.append(item);
   }
   target.append(scroller);
  }
  if(x.buttons.length){
   const choices=element('div','exp-choices');
   for(const button of x.buttons)choices.append(element('span','exp-choice',button.label+' · preview'));
   target.append(choices);
  }
  if(x.menu.length){
   const menu=element('div');
   for(const item of x.menu)menu.append(element('div','exp-menu-item',item.label+' · không phát hành'));
   target.append(menu);
  }
  if(x.webview){
   target.append(element('div','exp-webview','Website / Catalog công khai · chưa có URL xác minh · không đọc đơn riêng tư'));
  }
  if(x.richRuns.length){
   target.append(element('div','exp-rich',x.message));
   target.append(element('div','exp-warning','Rich Text dùng text_styles UTF-16 do Bot API mô tả; đây KHÔNG phải tin đã gửi.'));
  }
  if(x.photo){
   const block=element('div','exp-photo-preview');
   block.append(element('div','exp-photo',x.photo.emoji));
   block.append(element('strong',null,x.photo.caption));
   block.append(element('div','exp-warning','Ảnh biểu tượng synthetic, không có URL ảnh / không gọi sendPhoto'));
   target.append(block);
  }
  target.append(element('div','exp-warning',x.notes.join(' ')));
 }

 function save(){
  try{
   const payload={
    assistantName:$('assistantName').value,
    greeting:$('greeting').value,
    tone:$('tone').value,
    color:$('colorCode').value.toUpperCase(),
    showStock:$('showStock').checked,
    menu:menuPresets[$('menuPreset').value]
   };
   const res=lab.update(shop,channel,payload,'INTERNAL_STAFF_QA');
   $('status').textContent='Đã lưu bản nháp QA v'+res.bot_profile_version+' trong bộ nhớ. Không publish.';
   render();
  }catch(err){$('status').textContent='Không thể lưu: '+err.message}
 }
 function reset(){
  lab=api.createStudio();loadControls();render();
  $('status').textContent='Đã khôi phục toàn bộ dữ liệu demo về ba mẫu QA ban đầu.';
 }
 function exportDraft(){
  const safe=lab.exportDraft(shop,channel);
  const json=JSON.stringify(safe,null,2),blob=new Blob([json],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='TIEN404_V147_QA_'+shop+'_'+channel+'.json';
  document.body.append(a);a.click();a.remove();URL.revokeObjectURL(url);
  $('status').textContent='Đã xuất bản nháp không có credential; không phải tệp cấu hình đã được duyệt.';
 }
 function runQa(){
  const checks=['CONSULT','QUOTE','ORDER','SUPPORT'].map(f=>lab.preview(shop,channel,f));
  const passed=checks.every(x=>x.providerSends===0&&x.hostedWrites===0&&x.realAiCalls===0&&x.releaseAuthorized===false);
  $('qaOutput').textContent=(passed?'PASS':'FAIL')+' 4/4 luồng QA tổng hợp cho '+api.FIXTURES[shop].name+' · '+channelLabels[channel]+'. Chỉ kiểm thử fixture, chưa kiểm thử AI hoặc provider thật.';
  $('qaOutput').classList.add('show');
 }
 document.querySelectorAll('[data-shop]').forEach(b=>b.addEventListener('click',()=>{shop=b.dataset.shop;experienceMode='STANDARD';loadControls();render()}));
 document.querySelectorAll('[data-channel]').forEach(b=>b.addEventListener('click',()=>{channel=b.dataset.channel;experienceMode='STANDARD';loadControls();render()}));
 document.querySelectorAll('[data-flow]').forEach(b=>b.addEventListener('click',()=>{flow=b.dataset.flow;render()}));
 $('color').addEventListener('input',()=>{$('colorCode').value=$('color').value.toUpperCase()});
 $('colorCode').addEventListener('input',()=>{const s=$('colorCode').value;if(/^#[a-f0-9]{6}$/i.test(s))$('color').value=s});
 $('save').addEventListener('click',save);
 $('reset').addEventListener('click',reset);
 $('export').addEventListener('click',exportDraft);
 $('runQa').addEventListener('click',runQa);
 loadControls();render();
})();
