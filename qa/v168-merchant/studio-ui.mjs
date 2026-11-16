/**
 * V16.8 local-only synthetic Merchant Setup Studio.
 * NO network calls, browser persistence, server upload or cloud credentials.
 */
import {createStagingSession,planCosts,studioConnections} from './integration.mjs';
import {parseCsv,parseXlsx,previewImport,sampleCsvForStore,MAX_SOURCE_BYTES} from './import-preview.mjs';
const session=createStagingSession();
const stores={
 A:{store:'QA_STORE_A',tenant:'QA_TENANT_1',provider:'QA_PAGE_A',channel:'MESSENGER',actor:'QA_TIEN404_SUPPORT',owner:'QA_OWNER_A',industry:'GROCERY',plan:'ECONOMY'},
 B:{store:'QA_STORE_B',tenant:'QA_TENANT_1',provider:'QA_PAGE_B',channel:'MESSENGER',actor:'QA_OWNER_B',owner:'QA_OWNER_B',industry:'FASHION',plan:'STANDARD'},
 C:{store:'QA_STORE_C',tenant:'QA_TENANT_2',provider:'QA_ZALO_C',channel:'ZALO_BOT',actor:'QA_OWNER_C',owner:'QA_OWNER_C',industry:'MATERIALS',plan:'PRIORITY'}
};
let current='A',counter=0;const $=id=>document.getElementById(id);
const info=obj=>JSON.stringify(obj,null,2);
const show=(id,v)=>{$(id).textContent=typeof v==='string'?v:info(v)};
const fmt=n=>new Intl.NumberFormat('vi-VN').format(n);
function eventScope(s,msg='xin chao'){
 return session.registry.resolveTrustedQaChannel({
  contract:'QA_VERIFIED_CHANNEL_EVENT_V1',channel:s.channel,
  account_id:s.store==='QA_STORE_A'?'QA_META_A':s.store==='QA_STORE_B'?'QA_META_B':'QA_ZALO_C',
  event_id:'QA-EVT-UI001',synthetic_text:msg});
}
function renderShop(){
 const x=stores[current],profile=session.registry.exportPublicProfile({actor_id:x.owner,store_id:x.store});
 const greeting=session.registry.route(eventScope(x)).answer_preview;
 $('scope').textContent=x.tenant+'\n'+x.store+'\n'+x.plan+' | '+x.channel;
 $('profileScope').textContent=x.tenant+' / '+x.store;
 $('industry').textContent=x.industry;
 $('botname').value=profile.bot_name;
 $('greeting').value=greeting;
 $('hours').value=current==='A'?'06:00-21:00':current==='B'?'09:00-22:00':'07:00-17:00';
 $('tone').value=current==='C'?'kỹ thuật':'thân thiện';
 $('draftResult').textContent='';
 $('importRows').replaceChildren();
 show('importResult','Không có file dữ liệu được giữ trong bộ nhớ cho Shop này.');
 $('runtimeResult').textContent='';
}
$('shop').addEventListener('change',e=>{current=e.target.value;renderShop()});
for(const b of document.querySelectorAll('.navbtn')){
 b.addEventListener('click',()=>{
  for(const s of document.querySelectorAll('[data-panel]'))s.classList.toggle('active',s.dataset.panel===b.dataset.tab);
  for(const n of document.querySelectorAll('.navbtn'))n.classList.toggle('active',n===b);
 });
}
$('saveDraft').addEventListener('click',()=>{
 const x=stores[current];
 try{
 const draft=session.registry.proposeBotChange({
  actor_id:x.actor,store_id:x.store,expected_version:1,
  patch:{bot_name:$('botname').value,greeting:$('greeting').value,tone:$('tone').value,
   business_hours:$('hours').value}
 });
 show('draftResult',{status:draft.state,store_id:x.store,candidate_version:draft.candidate_version,
  owner_approval:'REQUIRED',publish_status:'BLOCKED',no_hosted_write:true});
 }catch(e){show('draftResult',{status:'BLOCKED',code:e.message,
  advice:current==='A'?'Vui lòng kiểm tra quyền/phiên bản bản nháp':'Không có grant nhân viên TIEN404 cho Shop khác; Owner vẫn cần người phê duyệt độc lập.'})}
});
$('approveDraft').addEventListener('click',()=>{
 const x=stores[current];
 try{
  const draft=session.registry.inspectDraft(x.owner,x.store);
  if(!draft)throw Error('NO_DRAFT_TO_REVIEW');
  const result=session.registry.ownerApproveDraft({
   actor_id:x.owner,store_id:x.store,candidate_version:draft.candidate_version
  });
  show('draftResult',{state:result.state,preview:session.registry.previewApprovedDraft({
   actor_id:x.owner,store_id:x.store}),production_published:false,independent_security_QA:'NOT_RUN'});
 }catch(e){show('draftResult',{status:'BLOCKED',code:e.message,
  note:'Owner approval trong mock không làm thay đổi Bot Published.'})}
});
function renderRows(result){
 const tbody=$('importRows');tbody.replaceChildren();
 for(const row of result.rows){
  const tr=document.createElement('tr');
  for(const value of [row.row,row.sku,row.product_name,row.retail_price_vnd===null?'—':fmt(row.retail_price_vnd),
   row.stock===null?'—':fmt(row.stock),row.valid?row.status:row.reasons.join('; ')]){
   const td=document.createElement('td');td.textContent=String(value);tr.append(td);
  }tbody.append(tr);
 }
 show('importResult',{store_id:result.store_id,total:result.total,accepted:result.accepted,
  rejected:result.rejected,source:result.source,save_status:'BLOCKED_NOT_APPLIED',no_server_upload:true});
}
$('sample').addEventListener('click',()=>{
 try{
 const store=stores[current].store;
 const csv=sampleCsvForStore(store);
 const result=previewImport({store_id:store,rows:parseCsv(csv)});
 renderRows(result);
 }catch(e){show('importResult',{status:'BLOCKED',code:e.message})}
});
$('merchantFile').addEventListener('change',async e=>{
 const file=e.target.files?.[0];if(!file)return;
 e.target.value='';
 try{
  if(file.size>MAX_SOURCE_BYTES)throw Error('FILE_TOO_LARGE');
  const ext=file.name.split('.').at(-1)?.toLowerCase();
  const rows=ext==='csv'?parseCsv(await file.text()):
   ext==='xlsx'?await parseXlsx(await file.arrayBuffer()):(()=>{throw Error('ONLY_CSV_OR_XLSX')})();
  const result=previewImport({store_id:stores[current].store,rows});
  renderRows(result);
 }catch(e){$('importRows').replaceChildren();show('importResult',{status:'REJECTED',code:e.message,no_upload:true})}
});
$('exportTemplate').addEventListener('click',()=>{
 const blob=new Blob([sampleCsvForStore(stores[current].store)],{type:'text/csv;charset=utf-8'});
 const anchor=document.createElement('a'),url=URL.createObjectURL(blob);
 anchor.href=url;anchor.download='TIEN404_V168_QA_'+stores[current].store+'.csv';
 anchor.click();URL.revokeObjectURL(url);
});
for(const btn of document.querySelectorAll('.simulate')){
 btn.addEventListener('click',async()=>{
  const x=stores[current],event='QA-EVENT-UI'+String(++counter).padStart(5,'0');
  try{
    const r=await session.simulate({account:x.provider,text:btn.dataset.text,event});
    show('runtimeResult',r);
  }catch(e){show('runtimeResult',{status:'BLOCKED',code:e.message,no_send:true})}
 });
}
const c=studioConnections();
for(const item of [
 'Hybrid Gateway: '+c.gateway,
 'Merchant Registry: '+c.merchantRegistry,
 'FAQ Studio: '+c.faq.title,
 'Priority: '+c.priority.title,
 'Cost Center: '+c.costCenter,
 'Human Handoff: '+c.handoff
]){
 const div=document.createElement('div');div.textContent=item;$('connections').append(div);
}
function calculate(){
 try{
 const r=planCosts({
 shops:Number($('shops').value),messagesPerShop:Number($('messages').value),
 modelFraction:Number($('aiPercent').value)/100,orchestrationFraction:Number($('n8nPercent').value)/100,
 inputUsdPerMillion:Number($('inputPrice').value),
 outputUsdPerMillion:Number($('outputPrice').value)
 });
 const container=$('finResults');container.replaceChildren();
 for(const [label,value] of [
  ['Tổng tin nhắn',fmt(r.messages)],
  ['Lượt AI dự kiến',fmt(r.modelTurns)],
  ['n8n workflow invocations',fmt(r.n8nInvocations)],
  ['AI model USD ước tính',r.modelUsd.toFixed(2)+' USD'],
  ['AI model USD / Shop',r.perShopKnownComponentsUsd.toFixed(3)+' USD'],
  ['Clone workflow nếu 6/Shop',fmt(r.cloneComparison.workflowCloneCountHypothesis)]
 ]){
  const box=document.createElement('div'),small=document.createElement('small'),strong=document.createElement('strong');
  small.textContent=label;strong.textContent=value;box.append(small,strong);container.append(box);
 }
 show('finError',{status:'HYPOTHETICAL_ONLY',unpriced:r.orphanedInfrastructureCosts,
  current_account_invoice:'UNVERIFIED',quota_enforced:false});
 }catch(e){show('finError',{status:'INVALID_SIMULATION',code:e.message});$('finResults').replaceChildren()}
}
$('calculate').addEventListener('click',calculate);
$('createProposal').addEventListener('click',()=>{
 const name=$('newName').value.trim().toUpperCase();
 if(!/^QA_[A-Z0-9_]{3,45}$/.test(name)){
  show('newResult',{status:'BLOCKED',reason:'QA_NAME_FORMAT_REQUIRED'});return;
 }
 show('newResult',{contract:'T404_V168_SHOP_PROPOSAL_PREVIEW',
  proposed_name:name,industry:$('newIndustry').value,channel:$('newChannel').value,
  status:'WAIT_TRUSTED_ENROLLMENT',tenant_id:null,store_id:null,
  owner_authority:'NOT_VERIFIED',database_record_created:false,no_send:true});
});
renderShop();calculate();
