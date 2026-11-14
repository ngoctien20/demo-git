/* TIEN404 Private Tester Portal V12.2 — staging.
 * Auth reused from existing Render Supabase client; DB RLS is the only authority.
 * All module links must be explicitly configured/verified before enabling.
 * Reports are SELF-REPORTED, never presented as automated QA PASS.
 */
import {getAuthClient} from './auth-client.js';
import {withDeadline} from './auth-runtime.mjs';
import {guideForModule} from './tester-guides.mjs';
import {DEMO_CATALOG,calculateDemo,formatVnd} from './tester-sandbox.mjs';
import {mountQaStudio} from './tester-ai-studio.mjs';

const $=id=>document.getElementById(id);
const pane=$('tp-panel'),statusNode=$('tp-status'),locked=$('tp-locked'),workspace=$('tp-workspace');
const nav=$('tp-nav');
const state={client:null,user:null,access:null,staff:null,modules:[],cases:[],runs:[],page:'home',caseId:null,epoch:0,lastCheck:0,busy:false};
const staffRoles=new Set(['super_admin','qa_manager']);
const pages={home:['Chào mừng bạn!','Hiểu TIEN404 AI và thử một tình huống bán hàng trong vài giây.'],modules:['Bài kiểm tra','Hướng dẫn từng bước cho từng chức năng đã được cấp quyền.'],data:['Dữ liệu thử nghiệm','Dữ liệu minh họa, không phải giá hoặc tồn kho của cửa hàng thật.'],practice:['Thực hành an toàn','Tính giá, kiểm tra tồn kho trên dữ liệu MẪU cục bộ — không có AI và không tạo đơn.'],progress:['Tiến độ của tôi','Báo cáo do bạn tự đánh giá, chưa phải kết luận QA tự động.'],help:['Hướng dẫn & báo lỗi','Tự xử lý các vấn đề thường gặp và báo lỗi theo bài thử.']};
function e(tag,text,cls){const n=document.createElement(tag);if(text!==undefined&&text!==null)n.textContent=String(text);if(cls)n.className=cls;return n}
function card(title){const s=e('section',null,'tp-card');if(title)s.append(e('h2',title));pane.append(s);return s}
function info(root,text,cls='tp-note'){const p=e('div',text,cls);root.append(p);return p}
function button(root,label,cb,cls='tp-secondary'){const b=e('button',label,cls);b.type='button';b.addEventListener('click',cb);root.append(b);return b}
function textDate(value){const d=new Date(value);return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('vi-VN',{dateStyle:'short',timeStyle:'short'}).format(d):'Chưa xác minh'}
function status(message,tone='info'){statusNode.textContent=message;statusNode.dataset.tone=tone}
function reset(msg){state.epoch++;state.user=null;state.access=null;state.staff=null;state.modules=[];state.cases=[];state.runs=[];pane.replaceChildren();workspace.hidden=true;locked.hidden=false;$('tp-locked-reason').textContent=msg;status(msg,'error')}
function isApproved(){return state.access?.access_status==='approved'&&Date.parse(state.access.expires_at)>Date.now()}
function isStaff(){return !!state.staff?.active&&staffRoles.has(state.staff.staff_role)}
function canSave(){return isApproved()&&!state.busy}
function latestResults(){const map=new Map();for(const row of state.runs){if(!map.has(row.case_id))map.set(row.case_id,row)}return map}
function progress(){
 const all=state.cases.filter(c=>c.readiness==='ready');
 const map=latestResults();
 const done=all.filter(c=>map.has(c.case_id)).length;
 $('tp-total').textContent=String(all.length);
 $('tp-done').textContent=String(done);
 $('tp-remaining').textContent=String(Math.max(0,all.length-done));
 $('tp-progress-bar').style.width=(all.length?Math.round(done/all.length*100):0)+'%';
 $('tp-progress-label').textContent=all.length?done+' / '+all.length+' bài có kết quả tự đánh giá.':'Chưa được giao bài nào đủ điều kiện thực hiện.';
}
function display(page){state.page=Object.hasOwn(pages,page)?page:'home';state.caseId=null;const more=$('tp-more');if(more)more.open=state.page!=='home';render();$('tp-main').focus?.()}
function render(){
 pane.replaceChildren();
 const [title,description]=pages[state.page];$('tp-heading').textContent=title;$('tp-subheading').textContent=description;
 for(const b of nav.querySelectorAll('button[data-page]')){
  b.setAttribute('aria-current',b.dataset.page===state.page?'page':'false');
 }
 progress();
 if(!isApproved()&&isStaff()){
  info(card('Quyền QA quản lý'),'Tài khoản này được xác thực là nhân sự QA. Bạn chưa được cấp quyền Tester để gửi kết quả cá nhân. Hãy mở trang quản lý người thử.');
  return;
 }
 if(state.page==='home')renderHome();
 else if(state.page==='modules')renderModules();
 else if(state.page==='data')renderData();
 else if(state.page==='practice')renderPractice();
 else if(state.page==='progress')renderProgress();
 else renderHelp();
}
function renderHome(){
 const intro=e('section',null,'tp-intro');
 intro.append(e('span','TIEN404 AI · DỰ ÁN ĐANG PHÁT TRIỂN','tp-hero-eyebrow'));
 intro.append(e('h2','Một trợ lý bán hàng cho những cửa hàng nhỏ.'));
 intro.append(e('p','TIEN404 AI hướng tới việc giúp shop tư vấn sản phẩm, trả lời khách, kiểm tra hàng và hỗ trợ xử lý đơn qua các kênh chat.'));
 intro.append(e('p','Bạn đang thử các quy tắc bán hàng bằng dữ liệu mẫu — chưa phải trò chuyện với AI thật. Bản này không chạy AI thật hoặc tạo đơn hàng. Chỉ cần thử một tình huống và cho biết bạn thấy thế nào.','tp-hero-hint'));
 const concepts=e('div',null,'tp-concepts');
 for(const [symbol,title,description] of [
  ['💬','Tư vấn','Hướng tới hỗ trợ trả lời khách nhanh'],
  ['🏷️','Giá bán','Không tự nhận giá khách đề xuất'],
  ['📦','Tồn kho','Kiểm tra trước khi nhận đơn']
 ]){
  const item=e('div',null,'tp-concept');
  item.append(e('span',symbol,'tp-concept-icon'),e('strong',title),e('small',description));
  concepts.append(item);
 }
 intro.append(concepts);
 pane.append(intro);
 if(!state.modules.some(m=>m.module_id==='sheets')){
  const lockedCard=card('Bạn đã đăng nhập, nhưng chưa có bài được giao');
  info(lockedCard,'Nhờ quản trị viên TIEN404 AI giao quyền “Dữ liệu mẫu” cho tài khoản của bạn, sau đó nhấn Tải lại ở đầu trang. Không cần tự cấu hình gì thêm.');
  return;
 }
 // Default path for expert testers: a short risk-based checklist and an optional external AI reviewer.
 mountQaStudio(pane,{state,onSaved:()=>progress()});
 const quickDetails=e('details',null,'tp-quick-details');quickDetails.id='tp-quick-details';
 quickDetails.append(e('summary','Hoặc thử nhanh 3 tình huống minh hoạ (tuỳ chọn)'));
 const box=e('section',null,'tp-card tp-quick');
 box.append(e('p','THỬ NHANH — BỔ SUNG','tp-overline'));
 box.append(e('h2','Nếu bạn là khách mua hàng, điều gì sẽ xảy ra?'));
 box.append(e('p','Chọn 1 trong 3 tình huống dưới đây. Không cần gõ SKU hoặc nhập thông tin cá nhân.','tp-quick-lead'));
 const choiceList=e('div',null,'tp-quick-choices');
 const scenarios=[
  {caseId:'SHEET-SIM-002',label:'Mua 2 áo trắng',quote:'Mình lấy 2 chiếc áo trắng nhé!',input:{sku:'QA-DEMO-01',quantity:'2'}},
  {caseId:'SHEET-SIM-004',label:'Mua nhiều hơn tồn',quote:'Mình muốn mua 26 chiếc áo trắng.',input:{sku:'QA-DEMO-01',quantity:'26'}},
  {caseId:'SHEET-SIM-009',label:'Trả giá thấp hơn',quote:'2 áo giá 100.000đ/chiếc được không?',input:{sku:'QA-DEMO-01',quantity:'2',offeredPrice:'100000'}}
 ].filter(x=>state.cases.some(c=>c.case_id===x.caseId&&c.module_id==='sheets'&&c.readiness==='ready'));
 let selected=null;
 const response=e('div',null,'tp-chat-response');response.id='tp-quick-response';response.hidden=true;
 const ask=e('p',null,'tp-chat-request'),answer=e('p',null,'tp-chat-answer');
 response.append(e('span','TÌNH HUỐNG BẠN CHỌN','tp-quick-kicker'),ask,
  e('span','KẾT QUẢ MÔ PHỎNG — KHÔNG PHẢI AI THẬT','tp-quick-kicker'),answer);
 const review=e('section',null,'tp-quick-review');review.id='tp-quick-review';review.hidden=true;
 review.append(e('p','BƯỚC 2 / 2 — CHO BIẾT Ý KIẾN','tp-overline'),
  e('h3','Bạn thấy kết quả này thế nào?'));
 const feedbackActions=e('div',null,'tp-feedback-actions');
 const noteBox=e('div',null,'tp-note-box');noteBox.hidden=true;
 const noteLabel=e('label','Điểm nào bạn thấy chưa ổn?','tp-field');
 const noteInput=e('textarea',null,'tp-textarea');noteInput.maxLength=500;
 noteInput.placeholder='Ví dụ: Câu trả lời hơi khó hiểu, chưa giống cách nhân viên tư vấn…';
 noteLabel.append(noteInput);noteBox.append(noteLabel);
 const message=e('p','', 'tp-quick-message');message.id='tp-quick-message';message.setAttribute('role','status');message.setAttribute('aria-live','polite');
 const saved=e('p','', 'tp-feedback-success');saved.id='tp-quick-saved';saved.setAttribute('role','status');saved.setAttribute('aria-live','polite');
 async function save(outcome,feedback){
  if(!selected||!canSave()){message.textContent='Phiên hoặc quyền thử nghiệm đã hết hạn. Hãy bấm Tải lại.';return}
  if(!state.cases.some(c=>c.case_id===selected.caseId&&c.readiness==='ready')){
   message.textContent='Tình huống này chưa được quản trị viên phân công.';return;
  }
  const epoch=state.epoch;state.busy=true;
  for(const control of feedbackActions.querySelectorAll('button'))control.disabled=true;
  for(const control of noteBox.querySelectorAll('button'))control.disabled=true;
  message.textContent='Đang lưu góp ý của bạn…';
  try{
   const verified=await withDeadline(state.client.auth.getUser(),12000);
   if(verified.error||verified.data?.user?.id!==state.user.id)throw Error('IDENTITY_CHANGED');
   const result=await withDeadline(state.client.from('tien404_tester_runs').insert({
    user_id:state.user.id,case_id:selected.caseId,outcome,
    feedback:feedback||null,environment:'staging',self_reported:true
   }),15000);
   if(result.error)throw Error('REPORT_NOT_SAVED');
   const readback=await withDeadline(state.client.from('tien404_tester_runs')
    .select('run_id,case_id,outcome,created_at').eq('user_id',state.user.id)
    .order('created_at',{ascending:false}).limit(200),12000);
   if(readback.error||!readback.data?.some(r=>r.case_id===selected.caseId&&r.outcome===outcome))
    throw Error('REPORT_NOT_VERIFIED');
   if(epoch!==state.epoch)return;
   state.runs=readback.data;
   progress();
   message.textContent='';
   saved.textContent='Đã nhận góp ý! Cảm ơn bạn đã giúp TIEN404 AI cải thiện. Bạn có thể thử thêm tình huống khác ở trên.';
   noteBox.hidden=true;
   feedbackActions.hidden=true;
  }catch{
   if(epoch===state.epoch)message.textContent='Chưa xác nhận lưu được góp ý. Hãy kiểm tra mạng rồi thử lại. Không tự báo Đã gửi khi hệ thống chưa xác minh.';
  }finally{
   state.busy=false;
   if(epoch===state.epoch){
    for(const control of feedbackActions.querySelectorAll('button'))control.disabled=false;
    for(const control of noteBox.querySelectorAll('button'))control.disabled=false;
   }
  }
 }
 button(feedbackActions,'👍 Dễ hiểu',()=>save('self_pass','Người thử thấy kết quả mô phỏng dễ hiểu.'),'tp-primary');
 button(feedbackActions,'💬 Cần cải thiện',()=>{
  noteBox.hidden=false;noteInput.focus();
  message.textContent='Viết một câu ngắn để nhóm dự án biết cần sửa gì.';
 });
 button(feedbackActions,'Không thử được',()=>save('blocked','Người thử không thực hiện được tình huống mô phỏng.'));
 const send=button(noteBox,'Gửi góp ý',()=>{
  const value=noteInput.value.trim();
  if(value.length<5){message.textContent='Hãy mô tả ít nhất 5 ký tự để nhóm có thể sửa lỗi.';return}
  save('self_fail',value);
 },'tp-primary');
 send.setAttribute('aria-label','Gửi góp ý cải thiện bài mô phỏng');
 review.append(feedbackActions,noteBox,message,saved);
 for(const entry of scenarios){
  const b=button(choiceList,entry.label,()=>{
   if(state.busy)return;
   selected=entry;
   for(const other of choiceList.querySelectorAll('button'))other.setAttribute('aria-pressed',other===b?'true':'false');
   const result=calculateDemo(entry.input);
   ask.textContent='Khách: “'+entry.quote+'”';
   answer.textContent=result.message;
   response.dataset.result=result.code;response.hidden=false;
   review.hidden=false;feedbackActions.hidden=false;noteBox.hidden=true;
   noteInput.value='';message.textContent='';saved.textContent='';
  },'tp-quick-choice');
  b.setAttribute('aria-pressed','false');
 }
 box.append(choiceList);
 if(scenarios.length){box.append(response,review)}
 else info(box,'Chưa có tình huống mẫu phù hợp. Hãy liên hệ quản trị viên hoặc xem bài nâng cao.');
 quickDetails.append(box);pane.append(quickDetails);
 const more=e('section',null,'tp-small-footer');
 more.append(e('p','Cần rà soát từng ca? Bộ bài chi tiết vẫn có trong mục nâng cao, không bắt buộc hoàn thành tất cả.','tp-quiet'));
 button(more,'Xem các bài kiểm tra chi tiết',()=>display('modules'));
 pane.append(more);
}
function moduleCases(id){return state.cases.filter(c=>c.module_id===id&&c.readiness==='ready')}
function renderGuidedSteps(moduleId){
 const guide=guideForModule(moduleId);if(!guide)return;
 const intro=card('Hiểu chức năng này trước khi thử');info(intro,guide.intro);
 const prep=card('Cần chuẩn bị');
 const prepList=e('ol',null,'tp-list');
 for(const item of guide.preparation)prepList.append(e('li',item));
 prep.append(prepList);
 const box=card('Làm theo từng bước');
 info(box,'Đánh dấu các bước để khỏi quên. Checklist này chỉ hiển thị trong phiên đang mở; kết quả QA chỉ được lưu khi bạn hoàn thành form của từng bài.');
 const list=e('ol',null,'tp-guide-list'),progress=e('p','0 / '+guide.steps.length+' bước đã đánh dấu','tp-quiet');
 for(const [title,description] of guide.steps){
  const li=e('li'),label=e('label',null,'tp-guide-step'),tick=e('input');
  tick.type='checkbox';tick.setAttribute('aria-label','Đã thực hiện: '+title);
  const words=e('span');words.append(e('strong',title),e('span',description,'tp-guide-description'));
  label.append(tick,words);li.append(label);list.append(li);
  tick.addEventListener('change',()=>{
   const count=list.querySelectorAll('input:checked').length;
   progress.textContent=count+' / '+guide.steps.length+' bước đã đánh dấu';
  });
 }
 box.append(list,progress);
 info(card('Nếu chưa thể thực hiện'),guide.blocked);
}

function renderModules(){
 if(!state.modules.length){info(card('Chưa có module khả dụng'),'Quyền Tester không đồng nghĩa đã được giao bài. Hãy nhờ Super Admin bấm Giao Sheets mẫu tại Tester Admin và sau đó bấm Cập nhật.');return}
 const root=e('div',null,'tp-grid');pane.append(root);
 for(const m of state.modules){
  const box=e('section',null,'tp-card');const count=moduleCases(m.module_id).length;
  box.append(e('span','ĐƯỢC PHÉP THỬ','tp-module-badge'),e('h2',m.title),e('p',m.summary),
   e('p',count+' bài kiểm tra • '+m.setup_note,'tp-quiet'));
  button(box,'Xem '+count+' bài thử',()=>openModule(m.module_id),'tp-primary');
  root.append(box);
 }
}
function openModule(id){
 const m=state.modules.find(x=>x.module_id===id);
 if(!m)return;
 state.page='modules';pane.replaceChildren();
 $('tp-heading').textContent=m.title;$('tp-subheading').textContent=m.summary;
 const intro=card('Chuẩn bị');info(intro,m.setup_note);
 renderGuidedSteps(m.module_id);
 const safety=card('Quan trọng trước khi thử');
 info(safety,'Chỉ thử trong môi trường và kênh đã được xác minh. Nếu không có quyền Page/Bot hoặc chức năng chưa hoạt động, hãy chọn BỊ CHẶN. Không tạo đơn thật hoặc gửi tin thay chủ shop.');
 const examples=card('Bài thử của module');
 const cases=moduleCases(id);
 if(!cases.length)info(examples,'Chưa có bài an toàn nào để thực hiện.');
 for(const c of cases){
  const box=e('div',null,'tp-case');box.append(e('h3',c.title),e('p',c.instructions));
  button(box,'Bắt đầu bài này',()=>openCase(c.case_id),'tp-primary');
  examples.append(box,e('div',null,'tp-divider'));
 }
 button(pane,'Quay về danh sách bài thử',()=>render(),'tp-secondary');
}
function openCase(caseId){
 const c=state.cases.find(x=>x.case_id===caseId&&x.readiness==='ready');
 if(!c)return;
 state.caseId=caseId;pane.replaceChildren();
 $('tp-heading').textContent='Bài thử: '+c.title;
 $('tp-subheading').textContent='Mã bài '+c.case_id+' • Kết quả tự đánh giá';
 const steps=card('Các bước thao tác');steps.append(e('p',c.instructions));
 if(c.sample_prompt){
  const box=card('Câu hỏi để gửi AI');
  box.append(e('div',c.sample_prompt,'tp-prompt'));
  button(box,'Sao chép câu hỏi',async()=>{try{await navigator.clipboard.writeText(c.sample_prompt);status('Đã sao chép câu hỏi mẫu.','ok')}catch{status('Không thể sao chép tự động. Bạn có thể chọn và sao chép văn bản.', 'error')}})
 }
 if(c.module_id==='sheets')renderDemoPractice(pane);
 info(card('Kết quả mong đợi'),c.expected_result);
 const form=card('Gửi kết quả thử nghiệm');
 info(form,'Kết quả bạn gửi sẽ được ghi là TỰ ĐÁNH GIÁ, không mặc định là QA tự động PASS.');
 const label=e('label','Kết quả thực tế','tp-field');
 const select=e('select',null,'tp-select');select.id='tp-outcome';
 for(const [v,t] of [['self_pass','Đạt theo quan sát của tôi'],['self_fail','Không đạt / AI trả lời sai'],['blocked','Bị chặn, không thể thử'],['needs_review','Chưa chắc, cần kiểm tra lại']]){
  const op=e('option',t);op.value=v;select.append(op)
 }label.append(select);form.append(label);
 const note=e('label','Mô tả ngắn điều đã xảy ra (không nhập thông tin nhạy cảm)','tp-field');
 const input=e('textarea',null,'tp-textarea');input.maxLength=1500;input.placeholder='Ví dụ: Bot báo sai giá hoặc tôi chưa được quyền mở Page.';note.append(input);form.append(note);
 const saved=latestResults().get(caseId);if(saved)info(form,'Lần đánh giá gần nhất: '+textDate(saved.created_at)+' • '+saved.outcome);
 const actions=e('div',null,'tp-actions');form.append(actions);
 const submit=button(actions,'Lưu kết quả tự đánh giá',async()=>{
  if(!canSave()){status('Quyền Tester không hợp lệ hoặc phiên đang bận.','error');return}
  const body=input.value.trim();
  if(['self_fail','blocked','needs_review'].includes(select.value)&&body.length<5){status('Vui lòng mô tả lý do hoặc sự cố tối thiểu năm ký tự.','error');input.focus();return}
  const previous=state.epoch;state.busy=true;submit.disabled=true;status('Đang lưu kết quả…');
  try{
   const ret=await withDeadline(state.client.from('tien404_tester_runs').insert({
    user_id:state.user.id,case_id:c.case_id,outcome:select.value,
    feedback:body||null,environment:'staging',self_reported:true
   }),15000);
   if(ret.error)throw ret.error;
   const records=await withDeadline(state.client.from('tien404_tester_runs')
    .select('run_id,case_id,outcome,created_at').eq('user_id',state.user.id)
    .order('created_at',{ascending:false}).limit(200),12000);
   if(records.error)throw records.error;
   if(previous!==state.epoch)return;
   state.runs=records.data||[];progress();
   status('Đã lưu tự đánh giá lên Supabase staging. Chưa được QA xác minh.','ok');
   openCase(c.case_id);
  }catch{if(previous===state.epoch)status('Chưa thể lưu. Kiểm tra quyền Tester, hạn truy cập và kết nối.','error')}
  finally{state.busy=false;submit.disabled=false}
 },'tp-primary');
 button(actions,'Trở lại module',()=>openModule(c.module_id));
 info(form,'Ảnh lỗi: chưa có kho lưu ảnh riêng đã nghiệm thu. Không tải ảnh có token hoặc thông tin khách thật lên kênh công khai.');
}

function renderDemoPractice(root){
 const box=e('section',null,'tp-card');
 box.append(e('p','THỰC HÀNH NỘI BỘ — KHÔNG PHẢI AI SALES LIVE','tp-overline'),
            e('h2','Bộ tính thử giá và tồn kho (dữ liệu giả lập)'));
 info(box,'Bài tập chạy 100% trong trình duyệt, không kết nối n8n, Google Sheets hoặc bot Messenger/Zalo. Giá và SKU dưới đây chỉ là mẫu, KHÔNG phải dữ liệu cửa hàng thật.');
 const list=e('ul',null,'tp-list');
 for(const p of DEMO_CATALOG)list.append(e('li',p.sku+' · '+p.name+' · '+formatVnd(p.unitPrice)+' · tồn mẫu '+p.stock));
 box.append(list);
 const form=e('form',null,'tp-admin-form');
 const skuLabel=e('label','Chọn sản phẩm mẫu','tp-field');
 const sku=e('select',null,'tp-select');sku.id='tp-sim-sku';
 for(const p of [...DEMO_CATALOG,{sku:'QA-UNKNOWN',name:'Mã không tồn tại (thử lỗi)'}]){
  const op=e('option',p.sku+' — '+p.name);op.value=p.sku;sku.append(op);
 }
 skuLabel.append(sku);form.append(skuLabel);
 const qtyLabel=e('label','Số lượng yêu cầu','tp-field');
 const qty=e('input',null,'tp-input');qty.id='tp-sim-qty';qty.type='text';qty.inputMode='numeric';qty.maxLength=12;qty.value='2';qtyLabel.append(qty);form.append(qtyLabel);
 const offeredLabel=e('label','Giá khách đề xuất (tuỳ chọn)','tp-field');
 const offered=e('input',null,'tp-input');offered.id='tp-sim-offered';offered.type='text';offered.inputMode='decimal';offered.maxLength=24;offered.placeholder='Để trống hoặc nhập 159000';offeredLabel.append(offered);form.append(offeredLabel);
 const actions=e('div',null,'tp-actions');
 const run=e('button','Kiểm tra dữ liệu mẫu','tp-primary');run.type='submit';
 actions.append(run);form.append(actions);
 const result=e('p','Chưa chạy bài thực hành.','tp-note');result.id='tp-sim-result';result.setAttribute('role','status');result.setAttribute('aria-live','polite');
 form.addEventListener('submit',ev=>{
  ev.preventDefault();
  const output=calculateDemo({sku:sku.value,quantity:qty.value,offeredPrice:offered.value});
  result.textContent='Kết quả mô phỏng ['+output.code+']: '+output.message;
  result.dataset.result=output.code;
 });
 box.append(form,result);
 root.append(box);
}
function renderPractice(){
 if(!state.modules.some(m=>m.module_id==='sheets')){
  info(card('Chưa được giao bài thực hành'),'Chỉ Tester đã được phân công module Dữ liệu mẫu mới có thể thực hành. Không tự mở quyền trên trình duyệt.');return;
 }
 renderDemoPractice(pane);
 const recap=card('Cách ghi nhận kết quả');
 info(recap,'Sau khi thực hành, vào Chọn bài thử → Dữ liệu mẫu để đối chiếu bài QA và lưu phản hồi tự đánh giá. Mô phỏng này không chứng minh AI bot đã trả lời đúng.');
 button(recap,'Xem bài Sheets được giao',()=>openModule('sheets'),'tp-primary');
}
function renderData(){
 const box=card('Ví dụ minh họa cho việc đối chiếu dữ liệu');
 const hasSheets=state.modules.some(m=>m.module_id==='sheets');
 if(!hasSheets){info(box,'Bạn chưa được cấp quyền dùng module Dữ liệu thử nghiệm.');return}
 info(box,'Các giá bên dưới chỉ là VÍ DỤ TỰ TẠO, không lấy từ Google Sheets hoặc catalog đang hoạt động. Không dùng để chấm AI thực tế.');
 const list=e('ul',null,'tp-list');
 ['QA-DEMO-01: Áo thun trắng M • giá ví dụ 159.000đ • tồn ví dụ 25.',
  'QA-DEMO-02: Áo thun đen L • giá ví dụ 159.000đ • tồn ví dụ 18.',
  'Đơn QA-DEMO-ORDER-01 chỉ để minh họa cách tính: 2 × 159.000đ = 318.000đ.'].forEach(t=>list.append(e('li',t)));
 box.append(list);
 const a=e('div',null,'tp-actions');box.append(a);button(a,'Mở bài đối chiếu',()=>openModule('sheets'));
 button(a,'Thực hành tính giá / tồn mẫu',()=>display('practice'));
}
function renderProgress(){
 const cardEl=card('Nhật ký kết quả cá nhân');
 const results=latestResults();
 if(!state.cases.length){info(cardEl,'Chưa được giao bài thử.');return}
 const ul=e('ul',null,'tp-list');
 for(const c of state.cases){
  const report=results.get(c.case_id);const line=e('li');
  line.append(e('strong',c.title+' • '),e('span',report?('Đã tự đánh giá: '+report.outcome+' / '+textDate(report.created_at)):'Chưa bắt đầu'));
  button(line,report?'Thử lại':'Bắt đầu',()=>openCase(c.case_id));
  ul.append(line);
 }cardEl.append(ul);
 const report=card('Báo cáo cuối buổi');
 info(report,'Chỉ tổng hợp các kết quả bạn đã tự đánh giá. Bạn không thể đánh dấu hệ thống PASS thay QA tự động.');
 const done=state.cases.filter(x=>results.has(x.case_id)).length;
 report.append(e('p',done+'/'+state.cases.length+' bài đã có kết quả.'));
}
function renderHelp(){
 const list=card('Nếu gặp khó khăn');
 const ol=e('ol',null,'tp-list');
 ['Không đăng nhập được: kiểm tra tài khoản đã được mời và xác nhận email chưa.',
 'Không có bài thử: chủ dự án chưa phê duyệt hoặc thời hạn đã hết.',
 'Messenger chưa mở: yêu cầu quyền Messenger Page từ quản trị viên, không tìm link trên mạng.',
 'Telegram không nhận thông báo: đừng tự bật workflow gửi thật.',
 'Zalo chưa sẵn sàng: Kill Switch gửi Zalo đang tắt theo chính sách.',
 'Google Sheets chưa mở: dùng ví dụ an toàn trong mục Dữ liệu thử nghiệm.',
 'AI trả lời sai: quay về bài test, chọn Không đạt và mô tả cụ thể.',
 'Không lưu được kết quả: tải lại trang để kiểm tra quyền và phiên.'].forEach(t=>ol.append(e('li',t)));
 list.append(ol);
 info(card('Báo lỗi theo bài thử'),'Vào Chọn bài thử → chọn case → Không đạt hoặc Bị chặn → mô tả → Lưu. Không chụp/đính kèm token, mật khẩu, dữ liệu khách thật.');
}
async function load(){
 if(state.busy)return; // Do not interrupt an active self-report.
 const round=++state.epoch;state.lastCheck=Date.now();
 const hadWorkspace=!workspace.hidden && !!state.user?.id;
 if(!hadWorkspace){workspace.hidden=true;locked.hidden=true;}
 status(hadWorkspace?'Đang kiểm tra quyền trong nền…':'Đang xác thực tài khoản và quyền riêng của Tester…');$('tp-refresh').disabled=true;
 try{
  const sb=state.client||await withDeadline(getAuthClient(),17000);
  if(round!==state.epoch)return;state.client=sb;
  const auth=await withDeadline(sb.auth.getUser(),14000);
  if(round!==state.epoch)return;
  const user=auth.data?.user;
  if(auth.error||!user?.id){reset('Chưa đăng nhập hoặc phiên đã hết hạn. Đăng nhập bằng tài khoản được mời.');return}
  const [a,s]=await Promise.all([
   withDeadline(sb.from('tien404_tester_access').select('user_id,access_status,expires_at').eq('user_id',user.id).maybeSingle(),13000),
   withDeadline(sb.from('tien404_tester_staff').select('staff_role,active').eq('user_id',user.id).maybeSingle(),13000)
  ]);
  if(round!==state.epoch)return;
  if(a.error||s.error)throw Error('ACCESS_QUERY_DENIED');
  const previousSnapshot=JSON.stringify([state.user?.id,state.access,state.staff,state.modules,state.cases,state.runs]);
  state.user=user;state.access=a.data;state.staff=s.data;
  if(!isApproved()&&!isStaff()){reset('Tài khoản đã đăng nhập nhưng chưa được Super Admin phê duyệt thử nghiệm, hoặc quyền đã hết hạn.');return}
  $('tp-admin-link').hidden=!isStaff();
  $('tp-welcome-name').textContent=user.email?'Người thử được cấp quyền':'Tài khoản đã xác thực';
  $('tp-expiry').textContent=isApproved()?'Hết hạn: '+textDate(state.access.expires_at):'Quyền quản lý QA (chưa có bài cá nhân)';
  let modules=[],cases=[],runs=[];
  if(isApproved()||isStaff()){
   const assignments=await withDeadline(sb.from('tien404_tester_assignments').select('module_id,active').eq('user_id',user.id).eq('active',true),12000);
   if(assignments.error)throw Error('ASSIGNMENT_QUERY_DENIED');
   const assigned=(assignments.data||[]).map(x=>x.module_id);
   if(assigned.length){
    const m=await withDeadline(sb.from('tien404_tester_modules').select('module_id,title,summary,channel,readiness,setup_note,sort_order').eq('readiness','ready').in('module_id',assigned).order('sort_order'),12000);
    if(m.error)throw Error('MODULE_QUERY_DENIED');modules=m.data||[];
    if(modules.length){
     const c=await withDeadline(sb.from('tien404_tester_cases').select('case_id,module_id,title,instructions,sample_prompt,expected_result,readiness,sort_order').eq('readiness','ready').in('module_id',modules.map(x=>x.module_id)).order('sort_order'),12000);
     if(c.error)throw Error('CASES_QUERY_DENIED');cases=c.data||[];
    }
   }
   const results=await withDeadline(sb.from('tien404_tester_runs').select('run_id,case_id,outcome,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(200),12000);
   if(results.error)throw Error('RUNS_QUERY_DENIED');runs=results.data||[];
  }
  if(round!==state.epoch)return;
  state.modules=modules;state.cases=cases;state.runs=runs;
  const nextSnapshot=JSON.stringify([state.user?.id,state.access,state.staff,state.modules,state.cases,state.runs]);
  if(!hadWorkspace || previousSnapshot!==nextSnapshot){
    workspace.hidden=false;locked.hidden=true;render();
  }
  // Same authorized session: preserve form, scenario, pending comments and scroll.
  status('Phiên Tester hợp lệ. Bạn có thể tiếp tục bài đang thử.','ok');
 }catch{if(round===state.epoch)reset('Không thể xác minh quyền hoặc dữ liệu. Không mở bài thử khi kiểm tra quyền thất bại.')}
 finally{if(round===state.epoch)$('tp-refresh').disabled=false}
}
nav.addEventListener('click',ev=>{const b=ev.target.closest('button[data-page]');if(b&&nav.contains(b))display(b.dataset.page)});
$('tp-refresh').addEventListener('click',()=>load());
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&Date.now()-state.lastCheck>300000)load()});
getAuthClient().then(sb=>{state.client=sb;sb.auth.onAuthStateChange((event,session)=>{
 if(event==='SIGNED_OUT')reset('Phiên đã đăng xuất.');
 if(event==='SIGNED_IN'&&session?.user?.id&&state.user?.id!==session.user.id){
   if(state.user?.id)reset('Tài khoản đã thay đổi. Đang kiểm tra quyền người mới…');
   setTimeout(()=>load(),0);
 }
 if(event==='USER_UPDATED')setTimeout(()=>load(),0);
 // TOKEN_REFRESHED and same-user SIGNED_IN are routine SDK events; do not rebuild UI.
});return load()}).catch(()=>reset('Không thể tải xác thực. Hãy thử lại khi có kết nối.'));
