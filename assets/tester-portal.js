/* TIEN404 Private Tester Portal V12.2 — staging.
 * Auth reused from existing Render Supabase client; DB RLS is the only authority.
 * All module links must be explicitly configured/verified before enabling.
 * Reports are SELF-REPORTED, never presented as automated QA PASS.
 */
import {getAuthClient} from './auth-client.js';
import {withDeadline} from './auth-runtime.mjs';
import {guideForModule} from './tester-guides.mjs';

const $=id=>document.getElementById(id);
const pane=$('tp-panel'),statusNode=$('tp-status'),locked=$('tp-locked'),workspace=$('tp-workspace');
const nav=$('tp-nav');
const state={client:null,user:null,access:null,staff:null,modules:[],cases:[],runs:[],page:'home',caseId:null,epoch:0,lastCheck:0,busy:false};
const staffRoles=new Set(['super_admin','qa_manager']);
const pages={home:['Tổng quan','Chọn bài kiểm tra được giao và tiếp tục từ lần trước.'],modules:['Bài kiểm tra','Hướng dẫn từng bước cho từng chức năng đã được cấp quyền.'],data:['Dữ liệu thử nghiệm','Dữ liệu minh họa, không phải giá hoặc tồn kho của cửa hàng thật.'],progress:['Tiến độ của tôi','Báo cáo do bạn tự đánh giá, chưa phải kết luận QA tự động.'],help:['Hướng dẫn & báo lỗi','Tự xử lý các vấn đề thường gặp và báo lỗi theo bài thử.']};
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
function display(page){state.page=Object.hasOwn(pages,page)?page:'home';state.caseId=null;render();$('tp-main').focus?.()}
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
 else if(state.page==='progress')renderProgress();
 else renderHelp();
}
function renderHome(){
 const box=card('Bắt đầu trong ba phút');
 const list=e('ol',null,'tp-list');
 ['Chọn một module được giao.','Đọc bước thực hiện và kết quả mong đợi.','Thực hiện bài thử trên đúng kênh đã được phê duyệt.','Chọn Đạt / Không đạt / Bị chặn và ghi chú.','Xem tiến độ hoặc tiếp tục bài trước.'].forEach(t=>list.append(e('li',t)));
 box.append(list);
 const actions=e('div',null,'tp-actions');box.append(actions);
 button(actions,'Chọn bài thử',()=>display('modules'),'tp-primary');
 button(actions,'Xem kết quả của tôi',()=>display('progress'));
 if(!state.modules.length)info(card('Chưa có bài được cấp quyền'),'Chủ dự án chưa phân công module an toàn cho tài khoản này. Hãy liên hệ quản trị viên.');
 else {
  const listCard=card('Những module bạn được phép thử');
  for(const m of state.modules){const box=e('div',null,'tp-compact');box.append(e('strong',m.title));button(box,'Mở hướng dẫn',()=>openModule(m.module_id));listCard.append(box)}
 }
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
 if(!state.modules.length){info(card('Chưa có module khả dụng'),'Chỉ các module đã được phê duyệt và phân công mới xuất hiện tại đây.');return}
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
 const round=++state.epoch;state.lastCheck=Date.now();workspace.hidden=true;locked.hidden=true;
 status('Đang xác thực tài khoản và quyền riêng của Tester…');$('tp-refresh').disabled=true;
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
  state.modules=modules;state.cases=cases;state.runs=runs;workspace.hidden=false;locked.hidden=true;render();
  status('Đã xác minh quyền Tester trên Supabase. Chỉ hiển thị module được phân công.','ok');
 }catch{if(round===state.epoch)reset('Không thể xác minh quyền hoặc dữ liệu. Không mở bài thử khi kiểm tra quyền thất bại.')}
 finally{if(round===state.epoch)$('tp-refresh').disabled=false}
}
nav.addEventListener('click',ev=>{const b=ev.target.closest('button[data-page]');if(b&&nav.contains(b))display(b.dataset.page)});
$('tp-refresh').addEventListener('click',()=>load());
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&Date.now()-state.lastCheck>30000)load()});
getAuthClient().then(sb=>{state.client=sb;sb.auth.onAuthStateChange((event)=>{
 if(event==='SIGNED_OUT')reset('Phiên đã đăng xuất.');
 if(event==='TOKEN_REFRESHED'||event==='USER_UPDATED')setTimeout(()=>load(),0);
});return load()}).catch(()=>reset('Không thể tải xác thực. Hãy thử lại khi có kết nối.'));
