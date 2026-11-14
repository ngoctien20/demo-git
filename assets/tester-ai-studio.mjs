/* TIEN404 V12.3 Expert Tester — optional external AI, no embedded AI API.
 * User consent and Supabase RLS required for one self-reported review per submission.
 * All external-AI content stays untrusted text and never becomes admin instructions.
 */
import {AI_REVIEW_CASE_ID,runPriorityChecks,reviewPrompt,reportText,containsSensitive} from './tester-qa-pack.mjs';
import {withDeadline} from './auth-runtime.mjs';
import {mountQaSandbox} from './tester-qa-writable-sandbox.mjs';

function el(tag,text,cls){
 const node=document.createElement(tag);
 if(text!==undefined&&text!==null)node.textContent=String(text);
 if(cls)node.className=cls;
 return node;
}
function action(root,label,handler,cls='tp-secondary'){
 const b=el('button',label,cls);b.type='button';b.addEventListener('click',handler);root.append(b);return b;
}
function step(root,num,title,description){
 const block=el('div',null,'tp-ai-step');
 const head=el('div',null,'tp-ai-step-head');
 head.append(el('span',String(num),'tp-ai-number'),el('strong',title));
 block.append(head,el('p',description,'tp-quiet'));root.append(block);return block;
}
function option(select,value,label){
 const o=el('option',label);o.value=value;select.append(o);
}
export function mountQaStudio(root,{state,onSaved}){
 const approved=state.access?.access_status==='approved'&&Date.parse(state.access.expires_at)>Date.now();
 const permitted=approved&&state.modules.some(m=>m.module_id==='sheets');
 if(!permitted)return;
 const readyIds=state.cases.filter(c=>c.readiness==='ready'&&c.module_id==='sheets').map(c=>c.case_id);
 let checks=null;
 const block=el('section',null,'tp-card tp-ai-studio');block.id='tp-ai-studio';
 block.append(el('p','AI-ASSISTED QA · STAGING · BỘ DỮ LIỆU MẪU','tp-overline'),
  el('h2','Kiểm thử chuyên nghiệp, ít thao tác'),
  el('p','Chạy kiểm tra trọng yếu, đưa gói dữ liệu mẫu sang AI bạn đang dùng, sau đó gửi những vấn đề đáng xem xét. Không cần chạy cả danh sách bài thử.','tp-ai-description'));
 const stage1=step(block,1,'Chạy kiểm tra trọng yếu','Các phép tính và kỳ vọng được đối chiếu ngay trên trình duyệt, không gọi chatbot hoặc đơn hàng thật.');
 const actions=el('div',null,'tp-actions');
 const runBtn=action(actions,'Chạy bộ 8 bài trọng yếu',()=>{
  if(state.busy)return;
  checks=runPriorityChecks(readyIds);
  results.replaceChildren();
  const passed=checks.filter(c=>c.ok).length;
  resultStatus.textContent='Đã chạy '+checks.length+' bài: '+passed+' đạt đối chiếu cục bộ, '+(checks.length-passed)+' khác kỳ vọng. Đây chưa phải QA của AI SALES thật.';
  const list=el('ol',null,'tp-ai-results');
  for(const c of checks){
   const row=el('li',null,'tp-ai-result');
   row.append(el('span',(c.ok?'✓ ':'! ')+c.title+' · '+c.caseId),
              el('small',(c.ok?'Đúng kỳ vọng':'Lệch kỳ vọng')+' · '+c.expected+' → '+c.observed));
   list.append(row);
  }
  results.append(list);
  copyBtn.disabled=checks.length===0;
  previewBtn.disabled=checks.length===0;
  publishBtn.disabled=checks.length===0||!caseReady;
 },'tp-primary');
 runBtn.id='tp-ai-run';actions.append(runBtn);
 const resultStatus=el('p','Chưa chạy. Bộ kiểm tra chỉ sử dụng catalog giả lập.','tp-ai-message');resultStatus.id='tp-ai-run-status';resultStatus.setAttribute('role','status');resultStatus.setAttribute('aria-live','polite');
 const results=el('div',null,'tp-ai-results-wrap');results.id='tp-ai-results';
 stage1.append(actions,resultStatus,results);

 const stage2=step(block,2,'Nhờ AI khác phân tích','Có thể dùng ChatGPT, Claude, Gemini hoặc công cụ AI bạn thích. Chỉ sao chép dữ liệu giả lập và kết quả đã chạy.');
 const copyArea=el('div',null,'tp-actions');
 const copyBtn=action(copyArea,'Sao chép gói cho AI',async()=>{
  if(!checks?.length)return;
  const prompt=reviewPrompt(checks);
  try{
   if(!navigator.clipboard?.writeText)throw Error('NO_CLIPBOARD');
   await navigator.clipboard.writeText(prompt);
   copyStatus.textContent='Đã sao chép. Hãy dán vào AI bạn đang dùng và yêu cầu phân tích.';
  }catch{
   promptText.value=prompt;promptContainer.hidden=false;
   promptText.focus();promptText.select();
   copyStatus.textContent='Thiết bị không cho sao chép tự động. Hãy chọn toàn bộ nội dung trong ô bên dưới để sao chép thủ công.';
  }
 },'tp-primary');copyBtn.id='tp-ai-copy';copyBtn.disabled=true;
 const previewBtn=action(copyArea,'Xem nội dung gửi AI',()=>{
  if(!checks?.length)return;
  promptText.value=reviewPrompt(checks);
  promptContainer.hidden=!promptContainer.hidden;
 });previewBtn.disabled=true;
 const copyStatus=el('p','Không gửi dữ liệu tới bên thứ ba tự động.','tp-quiet');copyStatus.id='tp-ai-copy-status';copyStatus.setAttribute('role','status');
 const promptContainer=el('div',null,'tp-ai-prompt-wrap');promptContainer.hidden=true;
 const promptText=el('textarea',null,'tp-textarea');promptText.id='tp-ai-prompt';promptText.readOnly=true;promptText.rows=9;
 promptText.setAttribute('aria-label','Gói QA dữ liệu mẫu để sao chép');
 promptContainer.append(promptText);stage2.append(copyArea,copyStatus,promptContainer);
 const stage3=step(block,3,'Gửi một báo cáo có chất lượng','Dán tóm tắt nhận xét AI, tự xác minh và chọn mức ưu tiên. Báo cáo được ghi là tự đánh giá, chưa phải kết luận QA tự động.');
 const fields=el('div',null,'tp-ai-form');
 const noteLabel=el('label','Phát hiện hoặc điểm cần kiểm tra tiếp','tp-field');
 const notes=el('textarea',null,'tp-textarea');notes.id='tp-ai-notes';notes.rows=4;notes.maxLength=1800;
 notes.placeholder='Ví dụ: AI đề xuất thử đầu vào 1e9 và kiểm tra số lượng tràn số; chưa xác minh trên bot thật.';
 noteLabel.append(notes);fields.append(noteLabel);
 const split=el('div',null,'tp-ai-fields');
 const severityLabel=el('label','Độ ưu tiên','tp-field');
 const severity=el('select',null,'tp-select');severity.id='tp-ai-severity';
 option(severity,'P1','P1 · Cần kiểm tra');option(severity,'P0','P0 · Nguy cơ nghiêm trọng');option(severity,'P2','P2 · Cải thiện');severityLabel.append(severity);
 const verdictLabel=el('label','Đánh giá của bạn','tp-field');
 const verdict=el('select',null,'tp-select');verdict.id='tp-ai-verdict';
 option(verdict,'needs_review','Cần nhóm QA xem lại');option(verdict,'self_fail','Tôi đã thấy vấn đề');option(verdict,'blocked','Không thể kiểm thử');option(verdict,'self_pass','Tôi đã tự đối chiếu và thấy đạt');
 verdictLabel.append(verdict);split.append(severityLabel,verdictLabel);fields.append(split);
 const attestLabel=el('label',null,'tp-ai-attest');
 const attest=el('input');attest.type='checkbox';attest.id='tp-ai-attest';
 attestLabel.append(attest,el('span','Tôi đã xem lại nội dung và không gửi token, mật khẩu, dữ liệu khách hàng hoặc bằng chứng giả.'));fields.append(attestLabel);
 const caseReady=readyIds.includes(AI_REVIEW_CASE_ID);
 if(!caseReady)fields.append(el('p','Bài thu thập đánh giá AI chưa được quản trị viên mở. Bạn vẫn có thể chạy và sao chép gói QA.','tp-ai-warning'));
 const publishBtn=action(fields,'Gửi báo cáo cho nhóm TIEN404 AI',async()=>{
  if(!caseReady||!checks?.length||state.busy)return;
  if(!attest.checked){submitStatus.textContent='Cần xác nhận đã kiểm tra nội dung báo cáo.';return}
  if(containsSensitive(notes.value)){submitStatus.textContent='Nội dung có thể chứa thông tin nhạy cảm. Hãy xóa thông tin đó trước khi gửi.';return}
  let feedback;
  try{feedback=reportText({notes:notes.value,severity:severity.value,verdict:verdict.value,results:checks,stamp:new Date().toISOString()})}
  catch{submitStatus.textContent='Vui lòng viết nhận xét rõ ràng, từ 12 đến 1800 ký tự.';return}
  if(state.access?.access_status!=='approved'||Date.parse(state.access.expires_at)<=Date.now()){
   submitStatus.textContent='Phiên Tester đã hết hạn. Hãy nhờ quản trị viên cấp lại quyền.';return;
  }
  const epoch=state.epoch;state.busy=true;publishBtn.disabled=true;submitStatus.textContent='Đang lưu và xác minh lại báo cáo…';
  try{
   const auth=await withDeadline(state.client.auth.getUser(),12000);
   if(auth.error||!auth.data?.user?.id||auth.data.user.id!==state.user?.id)throw Error('AUTH_CHANGED');
   if(!state.cases.some(c=>c.case_id===AI_REVIEW_CASE_ID&&c.readiness==='ready'))throw Error('CASE_NOT_READY');
   const inserted=await withDeadline(state.client.from('tien404_tester_runs').insert({
     user_id:state.user.id,case_id:AI_REVIEW_CASE_ID,
     outcome:verdict.value,feedback,environment:'staging',self_reported:true
   }).select('run_id').single(),15000);
   if(inserted.error||!inserted.data?.run_id)throw Error('INSERT_NOT_VERIFIED');
   const verified=await withDeadline(state.client.from('tien404_tester_runs')
    .select('run_id,case_id,outcome,feedback,created_at')
    .eq('run_id',inserted.data.run_id).eq('user_id',state.user.id).maybeSingle(),12000);
   if(verified.error||verified.data?.feedback!==feedback||verified.data?.case_id!==AI_REVIEW_CASE_ID)throw Error('READBACK_FAILED');
   if(state.epoch!==epoch)return;
   const list=await withDeadline(state.client.from('tien404_tester_runs')
    .select('run_id,case_id,outcome,created_at').eq('user_id',state.user.id)
    .order('created_at',{ascending:false}).limit(200),12000);
   if(!list.error&&Array.isArray(list.data))state.runs=list.data;
   onSaved();
   submitStatus.textContent='Đã lưu báo cáo do bạn tự đánh giá. Nhóm TIEN404 AI sẽ cần kiểm tra bằng chứng trước khi kết luận.';
   submitStatus.dataset.tone='ok';
   notes.value='';attest.checked=false;
  }catch{
   if(state.epoch===epoch)submitStatus.textContent='Chưa xác nhận lưu thành công. Kiểm tra mạng hoặc quyền Tester, sau đó xem mục Kết quả của tôi trước khi thử gửi lại.';
  }finally{
   state.busy=false;
   if(state.epoch===epoch)publishBtn.disabled=!caseReady||!checks?.length;
  }
 },'tp-primary');publishBtn.id='tp-ai-submit';publishBtn.disabled=true;
 const submitStatus=el('p','Góp ý AI là bằng chứng tham khảo, không tự động chuyển bài thành PASS.','tp-ai-message');submitStatus.id='tp-ai-submit-status';submitStatus.setAttribute('role','status');submitStatus.setAttribute('aria-live','polite');
 fields.append(submitStatus);stage3.append(fields);
 mountQaSandbox(root,{state,onSaved});
 root.append(block);
 return block;
}
