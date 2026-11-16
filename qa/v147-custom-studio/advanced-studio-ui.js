'use strict';
/* TIEN404 V15.2 ADV4: small, additive UI integration with the existing V14.7
 * staff-only QA browser lab. All previews are local and non-interactive.
 */
(function(){
 const base=window.T404Studio,bridge=window.T404AdvancedLabBridge,
  registry=window.T404ChannelRegistry,policy=window.T404AdvancedPresentation,
  intelligence=window.T404PresentationIntelligence,
  advanced=window.T404AdvancedStudioV4,adapters=window.T404Adv4AdapterContracts;
 if(!base||!bridge||!registry||!policy||!intelligence||!advanced||!adapters)
  throw Error('ADV4_MISSING_TRUSTED_LAB_DEPENDENCY');
 const $=id=>document.getElementById(id);
 const make=()=>advanced.createStudioIntegration({studioApi:base,registry,policy,intelligence,
  baseReader:(s,c)=>bridge.getBaseDraft(s,c)});
 let studio=make();
 const status=(text)=>{$('adv4Status').textContent=String(text)};
 function active(){return bridge.getActive()}
 function option(parent,value,name){
  const o=document.createElement('option');o.value=value;o.textContent=name;parent.append(o);
 }
 function load(){
  const {shop,channel}=active(),draft=studio.get(shop,channel),assets=studio.assets(shop);
  $('adv4Preset').value=draft.presentationPreset;
  $('adv4CTA').value=draft.ctaAction;
  for(const type of ['IMAGE','LINK']){
   const node=$(type==='IMAGE'?'adv4Media':'adv4Link'),cur=type==='IMAGE'?draft.mediaRef:draft.linkRef;
   node.replaceChildren();
   option(node,'NONE',type==='IMAGE'?'Không chọn ảnh':'Không chọn liên kết');
   for(const asset of assets.filter(a=>a.type===type))option(node,asset.ref,asset.name);
   node.value=cur;
  }
  $('adv4Scope').textContent=base.FIXTURES[shop].name+' · '+channel+' · Advanced Draft v'+draft.revision+
   ' · Bot nền v'+draft.baseBotVersion;
  render();
 }
 function render(){
  const {shop,channel}=active();
  try{
   const intent=$('adv4Intent').value;
   const modelOutput={schema_version:intelligence.SCHEMA_VERSION,intent};
   const r=adapters.build({studio,shop,channel,modelOutput});
   $('adv4Canvas').replaceChildren();
   const stamp=document.createElement('div');stamp.className='adv4-stamp';
   stamp.textContent='NO-SEND · bản xem trước';$('adv4Canvas').append(stamp);
   const text=document.createElement('p');text.className='adv4-bubble';text.textContent=r.content.text;
   $('adv4Canvas').append(text);
   const meta=document.createElement('div');meta.className='adv4-meta';
   meta.textContent='Chế độ '+r.mode+' · Thành phần '+r.preferredComponent+
    ' · Ảnh/URL chưa duyệt: chỉ hiện mã tham chiếu QA';
   $('adv4Canvas').append(meta);
   const btn=document.createElement('button');btn.type='button';btn.disabled=true;
   btn.textContent=r.action.label+' · chưa kích hoạt';btn.className='adv4-action';
   $('adv4Canvas').append(btn);
   const evidence={
    revision:r.presentationVersion,tenantId:r.tenantId,storeId:r.storeId,
    channel:r.channel,mode:r.mode,component:r.preferredComponent,
    actionId:r.action.id,requiresSignedBackend:r.action.requiresSignedBackend,
    approval:false,canSend:r.canSend,canExecute:r.canExecute,
    providerPayload:r.nativeProviderPayload,
    mediaUrl:r.content.approvedMediaUrl,linkUrl:r.content.approvedLinkUrl
   };
   $('adv4Evidence').textContent=JSON.stringify(evidence,null,2);
   $('adv4History').textContent='Lịch sử bản nháp: '+
    studio.history(shop,channel).map(x=>'v'+x.revision).join(' → ')+
    ' (chỉ bộ nhớ trang)';
  }catch(error){
   $('adv4Canvas').replaceChildren();
   $('adv4Evidence').textContent='';
   $('adv4History').textContent='';
   status('PREVIEW BỊ KHÓA · '+error.message+'. Nếu bot nền vừa thay đổi, cần đồng bộ lại bản nháp.');
  }
 }
 function save(){
  const {shop,channel}=active();
  try{
   const old=studio.get(shop,channel);
   const result=studio.save(shop,channel,{
    presentationPreset:$('adv4Preset').value,ctaAction:$('adv4CTA').value,
    mediaRef:$('adv4Media').value,linkRef:$('adv4Link').value
   },{actor:'INTERNAL_STAFF_QA',expectedRevision:old.revision,
      expectedBaseVersion:old.baseBotVersion});
   load();status('Đã lưu Advanced Draft v'+result.revision+' trong QA. Không triển khai kênh thật.');
  }catch(error){status('Không thể lưu: '+error.message)}
 }
 function rollback(){
  const {shop,channel}=active();
  try{
   const old=studio.get(shop,channel),result=studio.rollback(shop,channel,1,
    {actor:'INTERNAL_STAFF_QA',expectedRevision:old.revision});
   load();status('Hoàn tác về nội dung v1 thành Draft mới v'+result.revision+'; chưa phát hành.');
  }catch(error){status('Không thể hoàn tác: '+error.message)}
 }
 function rebase(){
  const {shop,channel}=active();
  try{
   const old=studio.get(shop,channel);
   const result=studio.rebase(shop,channel,{actor:'INTERNAL_STAFF_QA',
     expectedRevision:old.revision});
   load();status('Đã đối chiếu bot nền và lưu Advanced Draft v'+result.revision+'.');
  }catch(error){status('Không thể đồng bộ: '+error.message)}
 }
 function exportJson(){
  const {shop,channel}=active();
  const x=studio.exportDraft(shop,channel);
  $('adv4Evidence').textContent=JSON.stringify(x,null,2);
  status('Đã tạo JSON bản nháp thử nghiệm — không có credential hoặc quyền publish.');
 }
 $('adv4Save').addEventListener('click',save);
 $('adv4Rollback').addEventListener('click',rollback);
 $('adv4Rebase').addEventListener('click',rebase);
 $('adv4Export').addEventListener('click',exportJson);
 $('adv4Intent').addEventListener('change',render);
 for(const selector of ['[data-shop]','[data-channel]'])
  document.querySelectorAll(selector).forEach(el=>el.addEventListener('click',()=>{
   load();status('Đang xem cấu hình Advanced QA độc lập theo cửa hàng và kênh.');
  }));
 $('save').addEventListener('click',()=>{load();status('Bot nền đã thay đổi nếu lưu thành công. Hãy đồng bộ Advanced khi có cảnh báo.');});
 $('reset').addEventListener('click',()=>{studio=make();load();status('Đã khôi phục dữ liệu Advanced QA bộ nhớ; chưa chỉnh sửa server.');});
 load();
 Object.defineProperty(window,'T404ADV4PreviewEvidence',{value:Object.freeze({
  inspect:()=>studio.inspect(),
  getActive:()=>bridge.getActive(),
  getDraft:()=>{const {shop,channel}=active();return studio.get(shop,channel)}
 }),writable:false});
})();