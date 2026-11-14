/* TIEN404 V12.5 — Messenger Clone QA reviewer in private Tester Portal.
 * All AI outputs are human supplied; no model calls, no n8n webhook,
 * no real messaging, no writes beyond existing Supabase tester_runs RLS.
 */
import {withDeadline} from './auth-runtime.mjs';
import {containsSensitive} from './tester-qa-pack.mjs';
import {QA_RANDOM_CASES,drawQaCase} from './tester-random-qa-cases.mjs';

export const MESSENGER_QA_REPORT_CASE='SHEET-MESSENGER-CLONE-001';
export const MESSENGER_QA_CLONE_ID='5Sw0ZDFRvrRjEfUZ';
const suspiciousContact=/(?:\+84|0)\d{9,10}/;
const safe=t=>!containsSensitive(String(t||''))&&!suspiciousContact.test(String(t||''));
export function reviewSummary({caseItem,source,executionId,response,notes,outcome}){
 if(!caseItem||!QA_RANDOM_CASES.some(x=>x.id===caseItem.id))throw Error('CASE_INVALID');
 if(!['n8n_private','external_manual','not_run'].includes(source))throw Error('SOURCE_INVALID');
 if(!['needs_review','self_fail','blocked','self_pass'].includes(outcome))throw Error('VERDICT_INVALID');
 if(String(response).trim().length<10||String(response).length>900)throw Error('RESPONSE_INVALID');
 if(String(notes).trim().length<12||String(notes).length>500)throw Error('NOTES_INVALID');
 if(!safe(response)||!safe(notes))throw Error('SENSITIVE');
 if(source==='n8n_private'&&!/^\d{1,12}$/.test(String(executionId||'')))throw Error('EXECUTION_ID_REQUIRED');
 return [
  'MESSENGER_CLONE_QA/v1 — UNVERIFIED, SELF_REPORTED',
  'Clone n8n CANDIDATE '+MESSENGER_QA_CLONE_ID,
  'Source '+source+(source==='n8n_private'?' execution #'+executionId:''),
  'Case '+caseItem.id+' / '+caseItem.mode,
  'Prompt: '+caseItem.prompt,
  'Expected: '+caseItem.expected,
  'Manual outcome: '+outcome,
  'Observed (tester supplied): '+String(response).trim(),
  'Notes: '+String(notes).trim(),
  'AI tool calls, current Sheet read and order writes NOT independently verified.',
 ].join('\n').slice(0,2900);
}
const el=(tag,t,cls)=>{const n=document.createElement(tag);if(t!=null)n.textContent=String(t);if(cls)n.className=cls;return n};
const btn=(root,t,cb,cls='tp-secondary')=>{const n=el('button',t,cls);n.type='button';n.addEventListener('click',cb);root.append(n);return n};
const option=(select,value,t)=>{const n=el('option',t);n.value=value;select.append(n)};
const field=(root,label,ctrl)=>{const n=el('label',label,'tp-field');n.append(ctrl);root.append(n);return ctrl};
export function mountMessengerCloneQa(root,{state,onSaved=()=>{}}){
 const eligible=()=>state.access?.access_status==='approved'&&Date.parse(state.access.expires_at)>Date.now()&&
   state.modules.some(x=>x.module_id==='sheets')&&!!state.user?.id;
 if(!eligible())return null;
 const ready=state.cases.some(x=>x.case_id===MESSENGER_QA_REPORT_CASE&&x.readiness==='ready');
 let selected=null;
 const card=el('section',null,'tp-card tp-messenger-clone');card.id='tp-messenger-clone';
 card.append(el('p','V12.5 · MESSENGER CLONE QA · CHỈ DỮ LIỆU THỬ','tp-overline'),
  el('h2','Thử hội thoại Messenger bằng AI QA'),
  el('p','Bản clone n8n dùng model và phong cách hội thoại từ Messenger gốc, nhưng không gửi Facebook và không dùng đơn hàng thật. Hiện workflow CANDIDATE chưa mở cho website gọi trực tiếp.','tp-ai-description'));
 const status=el('p','Chưa chạy model. Lấy câu hỏi để thử thủ công; kết quả chỉ là tự đánh giá.','tp-ai-warning');
 status.id='tp-messenger-clone-status';status.setAttribute('role','status');
 const controls=el('div',null,'tp-ai-fields');
 const topic=el('select',null,'tp-select');topic.id='tp-messenger-clone-topic';
 for(const [id,t] of [['all','Ngẫu nhiên tất cả'],['catalog','Giá / tồn / sản phẩm'],['consult','Tư vấn'],['language','Tiếng Việt tự nhiên'],['create','Đặt đơn QA'],['edit','Sửa đơn QA'],['security','Bảo mật'],['policy','Chính sách']])option(topic,id,t);
 field(controls,'Chọn nhóm câu hỏi',topic);
 const source=el('select',null,'tp-select');source.id='tp-messenger-clone-source';
 option(source,'not_run','Chưa chạy model');
 option(source,'n8n_private','Đã thử trong n8n QA riêng');
 option(source,'external_manual','Đã thử bằng AI khác');
 field(controls,'Nguồn kiểm thử',source);
 const cardPrompt=el('div',null,'tp-qa-random-prompt');
 const prompt=el('p','Nhấn “Lấy câu hỏi” để chuẩn bị lượt kiểm thử.');prompt.id='tp-messenger-clone-prompt';
 const expected=el('p','','tp-quiet');expected.id='tp-messenger-clone-expected';
 cardPrompt.append(prompt,expected);
 const actions=el('div',null,'tp-actions');
 const draw=btn(actions,'Lấy câu hỏi ngẫu nhiên',()=>{
  selected=drawQaCase(selected?.id||null,topic.value==='all'?null:[topic.value]);
  if(!selected){status.textContent='Chưa có câu hỏi phù hợp.';return}
  prompt.textContent=selected.id+' · '+selected.prompt;
  expected.textContent='Điều cần kiểm tra: '+selected.expected;
  copy.disabled=false;send.disabled=!ready;
  status.textContent='Đã chọn câu '+selected.id+'. Chưa gọi model; nếu đã thử bằng AI, chọn nguồn và dán câu trả lời thật.';
 },'tp-primary');draw.id='tp-messenger-clone-draw';
 const copy=btn(actions,'Sao chép câu hỏi',async()=>{
  if(!selected)return;
  try{await navigator.clipboard.writeText(selected.prompt);status.textContent='Đã sao chép câu '+selected.id+'.'}
  catch{status.textContent='Thiết bị không cho sao chép tự động; hãy chọn nội dung câu hỏi trên trang để sao chép.'}
 });copy.disabled=true;copy.id='tp-messenger-clone-copy';
 if(['super_admin','qa_manager'].includes(state.staff?.staff_role)){
  const link=el('a','Mở bản Clone trong n8n (nội bộ)','tp-secondary');
  link.href='https://ngoctien20.app.n8n.cloud/workflow/'+MESSENGER_QA_CLONE_ID;
  link.target='_blank';link.rel='noopener noreferrer';
  actions.append(link);
 }
 const report=el('div',null,'tp-ai-form');
 const execution=el('input',null,'tp-input');execution.type='text';execution.placeholder='Ví dụ: 3671';execution.maxLength=12;execution.inputMode='numeric';execution.id='tp-messenger-clone-execution';
 const executionBox=field(report,'Mã execution (chỉ khi đã chạy trong n8n riêng)',execution);executionBox.hidden=true;
 const response=el('textarea',null,'tp-textarea');response.id='tp-messenger-clone-response';response.maxLength=900;response.rows=3;
 response.placeholder='Dán nguyên văn phản hồi AI đã thực sự nhận được, không đưa token/SĐT thật.';
 field(report,'Phản hồi thực tế',response);
 const notes=el('textarea',null,'tp-textarea');notes.id='tp-messenger-clone-notes';notes.rows=2;notes.maxLength=500;
 notes.placeholder='Nhận xét cụ thể, ví dụ: bot trả tồn từ memory; cần kiểm tra lượt đọc Sheet mới.';
 field(report,'Nhận xét ngắn của tester',notes);
 const outcome=el('select',null,'tp-select');outcome.id='tp-messenger-clone-outcome';
 option(outcome,'needs_review','Cần nhóm QA xem lại');
 option(outcome,'self_fail','Phát hiện lỗi (tự đánh giá)');
 option(outcome,'blocked','Chưa thể thử');
 option(outcome,'self_pass','Theo tôi là đạt (chưa xác minh độc lập)');
 field(report,'Đánh giá',outcome);
 const attest=el('input');attest.type='checkbox';attest.id='tp-messenger-clone-attest';
 const check=el('label',null,'tp-ai-attest');check.append(attest,el('span','Tôi đã bỏ dữ liệu cá nhân/credential và hiểu báo cáo này chưa tự xác minh model.'));
 report.append(check);
 const send=btn(report,'Gửi một báo cáo hội thoại QA',async()=>{
  if(!ready||!selected||state.busy)return;
  if(!attest.checked){status.textContent='Cần xác nhận đã kiểm tra nội dung và tính riêng tư.';return}
  let feedback;
  try{feedback=reviewSummary({caseItem:selected,source:source.value,executionId:execution.value,response:response.value,notes:notes.value,outcome:outcome.value})}
  catch(err){status.textContent=err?.message==='SENSITIVE'?'Nội dung có thể chứa token/SĐT. Hãy loại bỏ trước khi gửi.':
   'Chưa đủ dữ liệu báo cáo. Điền phản hồi ≥10 ký tự, nhận xét ≥12 ký tự và mã execution khi chọn n8n.';return}
  if(!eligible()){status.textContent='Quyền Tester không còn hợp lệ.';return}
  const epoch=state.epoch;state.busy=true;send.disabled=true;status.textContent='Đang ghi và xác minh báo cáo riêng…';
  try{
   const auth=await withDeadline(state.client.auth.getUser(),12000);
   if(auth.error||auth.data?.user?.id!==state.user?.id)throw Error('AUTH_CHANGED');
   if(!state.cases.some(x=>x.case_id===MESSENGER_QA_REPORT_CASE&&x.readiness==='ready'))throw Error('CASE_NOT_READY');
   const result=await withDeadline(state.client.from('tien404_tester_runs').insert({
    user_id:state.user.id,case_id:MESSENGER_QA_REPORT_CASE,outcome:outcome.value,
    feedback,environment:'staging',self_reported:true
   }).select('run_id').single(),15000);
   if(result.error||!result.data?.run_id)throw Error('INSERT_UNVERIFIED');
   const verify=await withDeadline(state.client.from('tien404_tester_runs')
    .select('run_id,case_id,feedback').eq('run_id',result.data.run_id).eq('user_id',state.user.id).maybeSingle(),12000);
   if(verify.error||verify.data?.feedback!==feedback||verify.data?.case_id!==MESSENGER_QA_REPORT_CASE)throw Error('READBACK_FAILED');
   if(state.epoch!==epoch)return;
   const latest=await withDeadline(state.client.from('tien404_tester_runs')
    .select('run_id,case_id,outcome,created_at').eq('user_id',state.user.id).order('created_at',{ascending:false}).limit(200),12000);
   if(!latest.error&&Array.isArray(latest.data))state.runs=latest.data;
   onSaved();
   status.textContent='Đã lưu báo cáo tự đánh giá '+selected.id+'. Chờ nhóm QA xác minh nguồn, công cụ và dữ liệu.';
   status.dataset.tone='ok';response.value='';notes.value='';attest.checked=false;
  }catch{
   if(state.epoch===epoch)status.textContent='Chưa xác minh lưu thành công. Xem mục Tiến độ để tránh gửi trùng.';
  }finally{
   state.busy=false;if(state.epoch===epoch)send.disabled=!ready||!selected;
  }
 },'tp-primary');send.id='tp-messenger-clone-submit';send.disabled=true;
 source.addEventListener('change',()=>{
  executionBox.hidden=source.value!=='n8n_private';
  if(executionBox.hidden)execution.value='';
 });
 if(!ready)report.append(el('p','Bài ghi báo cáo Messenger Clone chưa được duyệt trong Sheets QA. Có thể lấy câu hỏi nhưng chưa gửi được.','tp-ai-warning'));
 const advanced=el('details',null,'tp-messenger-clone-report-details');advanced.id='tp-messenger-clone-report-details';
 advanced.append(el('summary','Ghi nhận phản hồi và báo cáo sau khi thử'),report);
 card.append(controls,cardPrompt,actions,status,advanced);root.append(card);
 return card;
}
