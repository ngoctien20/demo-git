/* TIEN404 Tester Admin — staging only. No Auth Admin API keys or service_role.
 * Global tester administration depends on separately bootstrapped Supabase table.
 * A Merchant Owner alone is NOT a tester Super Admin.
 */
import {getAuthClient} from './auth-client.js';
import {withDeadline} from './auth-runtime.mjs';
import {buildTesterCsv} from './tester-report-csv.mjs';
const $=id=>document.getElementById(id);
let client=null,user=null,staff=null,loading=false,exporting=false;
const roleSet=new Set(['super_admin','qa_manager']);
const status=(t,tone='info')=>{$('ta-status').textContent=t;$('ta-status').dataset.tone=tone};
const node=(tag,text,cls)=>{const v=document.createElement(tag);if(text!==undefined&&text!==null)v.textContent=String(text);if(cls)v.className=cls;return v};
const canEdit=()=>staff?.active===true&&staff.staff_role==='super_admin';
function deny(reason){client=null;user=null;staff=null;$('ta-export').disabled=true;$('ta-protected').hidden=true;$('ta-locked').hidden=false;$('ta-locked-reason').textContent=reason;status(reason,'error')}
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
const short=id=>typeof id==='string'?(id.slice(0,8)+'…'+id.slice(-5)):'—';
const date=value=>{const d=new Date(value);return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('vi-VN',{dateStyle:'short',timeStyle:'short'}).format(d):'Chưa rõ'};
async function query(table,columns,extra){
 let req=client.from(table).select(columns);if(typeof extra==='function')req=extra(req);
 const out=await withDeadline(req,13000);if(out.error)throw Error('QA_DATA_READ_DENIED');
 return out.data||[];
}
function tableInto(target,columns,rows){
 target.replaceChildren();
 if(!rows.length){target.append(node('p','Chưa có bản ghi hoặc không được cấp quyền.','tp-quiet'));return}
 const table=node('table',null,'tp-table'),thead=node('thead'),header=node('tr');
 for(const title of columns.map(c=>c[0]))header.append(node('th',title));
 thead.append(header);table.append(thead);
 const body=node('tbody');
 for(const row of rows){
  const tr=node('tr');
  for(const [,getter] of columns){const td=node('td');const value=getter(row);
   if(value instanceof Node)td.append(value);else td.textContent=String(value??'—');
   tr.append(td);
  }body.append(tr)
 }table.append(body);target.append(table);
}
function userActionButton(label,onClick){
 const b=node('button',label,'tp-secondary');b.type='button';
 b.addEventListener('click',onClick);return b
}
async function revoke(userId){
 if(!canEdit()||!uuid(userId)){status('Không có quyền thu hồi Tester.','error');return}
 if(!confirm('Thu hồi quyền thử nghiệm của tài khoản '+short(userId)+'?'))return;
 status('Đang thu hồi quyền Tester…');
 const r=await withDeadline(client.from('tien404_tester_access').update({
  access_status:'revoked',expires_at:new Date(Date.now()-60000).toISOString(),
  approved_by:user.id,updated_at:new Date().toISOString()
 }).eq('user_id',userId),13000);
 if(r.error){status('Thu hồi thất bại. Kiểm tra quyền backend.','error');return}
 status('Đã gửi lệnh thu hồi. Đang kiểm tra readback…','ok');await refresh();
}

async function reviewRequest(request,decision){
 if(!canEdit()||!request?.request_id||!request?.user_id||request.status!=='pending'){
  status('Không thể xét duyệt yêu cầu này.','error');return;
 }
 if(!['approved','rejected'].includes(decision))return;
 const shortId=short(request.user_id);
 if(!confirm(decision==='approved'
  ?'Cấp quyền TESTER 7 ngày cho '+shortId+'? Bạn sẽ phân công module an toàn riêng sau khi duyệt.'
  :'Từ chối đơn đăng ký của '+shortId+'?'))return;
 status('Đang xét duyệt yêu cầu staging…');
 try{
  const checked=await withDeadline(client.auth.getUser(),12000);
  if(checked.error||checked.data?.user?.id!==user.id)throw Error('SESSION_EXPIRED');
  const role=await withDeadline(client.from('tien404_tester_staff')
   .select('staff_role,active').eq('user_id',user.id).maybeSingle(),12000);
  if(role.error||role.data?.staff_role!=='super_admin'||!role.data.active)
   throw Error('ROLE_REVOKED');
  if(decision==='approved'){
   const now=Date.now();
   const grant=await withDeadline(client.from('tien404_tester_access').upsert({
    user_id:request.user_id,access_status:'approved',
    expires_at:new Date(now+7*86400000).toISOString(),
    approved_by:user.id,approved_at:new Date(now).toISOString(),updated_at:new Date(now).toISOString(),
    notes:'Approved from private tester request inbox'
   },{onConflict:'user_id'}),15000);
   if(grant.error)throw Error('GRANT_DENIED');
   const readback=await withDeadline(client.from('tien404_tester_access')
    .select('access_status,expires_at,approved_by')
    .eq('user_id',request.user_id).maybeSingle(),13000);
   if(readback.error||readback.data?.access_status!=='approved'
      ||Date.parse(readback.data.expires_at)<=Date.now()
      ||readback.data.approved_by!==user.id)
     throw Error('GRANT_READBACK_FAILED');
  }
  const reviewedAt=new Date().toISOString();
  const update=await withDeadline(client.from('tien404_tester_requests').update({
    status:decision,reviewed_at:reviewedAt,reviewed_by:user.id,updated_at:reviewedAt
  }).eq('request_id',request.request_id).eq('status','pending')
   .select('request_id,status').maybeSingle(),15000);
  if(update.error||update.data?.status!==decision)
   throw Error('REQUEST_UPDATE_DENIED');
  status(decision==='approved'
    ?'Đã duyệt 7 ngày và kiểm tra readback. Hãy phân công module an toàn cho Tester.'
    :'Đã từ chối đơn. Chưa cấp quyền truy cập.','ok');
  await refresh();
 }catch{status('Xét duyệt chưa hoàn tất. Kiểm tra danh sách quyền và trạng thái đơn trước khi thử lại.','error');await refresh();}
}
async function refresh(){
 if(loading||!user||!staff)return;
 loading=true;$('ta-refresh').disabled=true;
 try{
  const [access,modules,assignments,runs,audit,cases,requests]=await Promise.all([
   query('tien404_tester_access','user_id,access_status,expires_at,updated_at',r=>r.order('updated_at',{ascending:false}).limit(120)),
   query('tien404_tester_modules','module_id,title,readiness,sort_order',r=>r.order('sort_order')),
   query('tien404_tester_assignments','user_id,module_id,active',r=>r.limit(500)),
   query('tien404_tester_runs','run_id,user_id,case_id,outcome,created_at,feedback,self_reported',r=>r.order('created_at',{ascending:false}).limit(100)),
   query('tien404_tester_audit','event_type,actor_user_id,affected_user_id,created_at',r=>r.order('created_at',{ascending:false}).limit(70)),
   query('tien404_tester_cases','case_id,module_id,readiness',r=>r.limit(500)),
   query('tien404_tester_requests','request_id,user_id,desired_module,note,status,created_at,reviewed_at',r=>r.order('created_at',{ascending:false}).limit(200))
  ]);
  $('ta-access-count').textContent=String(access.length);
  $('ta-request-count').textContent=requests.filter(r=>r.status==='pending').length+' đơn chờ';
  tableInto($('ta-request-list'),[
   ['Người gửi',r=>short(r.user_id)],
   ['Ngày gửi',r=>date(r.created_at)],
   ['Muốn thử',r=>r.desired_module],
   ['Ghi chú',r=>r.note||'—'],
   ['Trạng thái',r=>r.status],
   ['Xét duyệt',r=>{
    if(!canEdit()||r.status!=='pending')return 'Chỉ xem';
    const area=node('div',null,'tp-actions');
    const grant=userActionButton('Duyệt 7 ngày',()=>reviewRequest(r,'approved'));
    const reject=userActionButton('Từ chối',()=>reviewRequest(r,'rejected'));
    area.append(grant,reject);return area;
   }]
  ],requests);
  $('ta-run-count').textContent=String(runs.length);
  $('ta-module-count').textContent=String(modules.length);
  const pending=cases.filter(c=>c.readiness==='pending').length;
  const ready=cases.filter(c=>c.readiness==='ready').length;
  $('ta-case-readiness').textContent='Danh mục QA staging: '+pending+' bài CANDIDATE (chưa mở), '+ready+' bài được gắn READY; việc được gắn READY không bảo đảm module đã sẵn sàng hoặc QA PASS.';
  $('ta-export').disabled=runs.length===0;
  const options=$('ta-module-id');options.replaceChildren();
  for(const m of modules){
   const op=node('option',m.title+' — '+(m.readiness==='ready'?'Sẵn sàng':'Chưa mở'));
   op.value=m.module_id;op.disabled=m.readiness!=='ready';options.append(op);
  }
  tableInto($('ta-access-list'),[
   ['Tài khoản',a=>short(a.user_id)],
   ['Quyền',a=>a.access_status+(new Date(a.expires_at)<=new Date()?' (hết hạn)':'')],
   ['Hết hạn',a=>date(a.expires_at)],
   ['Module',a=>assignments.filter(x=>x.user_id===a.user_id&&x.active).map(x=>x.module_id).join(', ')||'Chưa giao'],
   ['Thao tác',a=>canEdit()&&a.access_status==='approved'?
    userActionButton('Thu hồi',()=>revoke(a.user_id)):'Chỉ xem']
  ],access);
  tableInto($('ta-runs-list'),[
   ['Thời gian',r=>date(r.created_at)],
   ['Người thử',r=>short(r.user_id)],
   ['Bài thử',r=>r.case_id],
   ['Tự đánh giá',r=>r.outcome],
   ['Ghi chú',r=>r.feedback||'—']
  ],runs);
  tableInto($('ta-audit-list'),[
   ['Thời gian',r=>date(r.created_at)],
   ['Hành động',r=>r.event_type],
   ['Thực hiện',r=>short(r.actor_user_id)],
   ['Tác động',r=>short(r.affected_user_id)]
  ],audit);
  status('Đã đọc dữ liệu quyền và báo cáo từ Supabase staging theo RLS.','ok');
 }catch{status('Không tải được báo cáo. Không dùng số liệu giả thay thế.','error')}
 finally{loading=false;$('ta-refresh').disabled=false}
}
async function initialize(){
 try{
  client=await withDeadline(getAuthClient(),20000);
  const a=await withDeadline(client.auth.getUser(),15000);
  if(a.error||!a.data?.user?.id){deny('Bạn chưa đăng nhập.');return}
  user=a.data.user;
  const staffResult=await withDeadline(client.from('tien404_tester_staff').select('staff_role,active').eq('user_id',user.id).maybeSingle(),14000);
  if(staffResult.error||!staffResult.data?.active||!roleSet.has(staffResult.data.staff_role)){
   deny('Tài khoản này chưa được cấp quyền Super Admin/QA Manager Tester ở backend.');return
  }
  staff=staffResult.data;$('ta-locked').hidden=true;$('ta-protected').hidden=false;
  $('ta-role').textContent='Vai trò QA đã xác minh: '+staff.staff_role+'. '+(canEdit()?'Có thể cấp quyền và phân công.':'Chỉ xem báo cáo, không thể cấp quyền.');
  $('ta-grant-card').hidden=!canEdit();$('ta-assignment-card').hidden=!canEdit();
  client.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT')deny('Phiên đã đăng xuất.')});
  await refresh();
 }catch{deny('Không thể kiểm tra quyền nhân sự QA. Truy cập đã bị khóa.')}
}
$('ta-grant-form').addEventListener('submit',async event=>{
 event.preventDefault();if(!canEdit()){status('Không có quyền Super Admin.','error');return}
 const id=$('ta-user-id').value.trim().toLowerCase(),days=Number($('ta-days').value),notes=$('ta-notes').value.trim();
 if(!uuid(id)||!Number.isInteger(days)||days<1||days>30||notes.length>200){
  status('Auth User ID không hợp lệ hoặc thời gian cấp quyền vượt giới hạn.','error');return
 }
 const expiry=new Date(Date.now()+days*86400000).toISOString();
 status('Đang cấp quyền Tester cho tài khoản Auth đã tồn tại…');
 try{
  const r=await withDeadline(client.from('tien404_tester_access').upsert({
   user_id:id,access_status:'approved',expires_at:expiry,approved_by:user.id,
   approved_at:new Date().toISOString(),updated_at:new Date().toISOString(),
   notes:notes||null
  },{onConflict:'user_id'}),15000);
  if(r.error)throw Error('GRANT_DENIED');
  status('Yêu cầu cấp quyền đã được backend chấp nhận.','ok');await refresh();
 }catch{status('Không cấp quyền được. Xác minh người dùng đã có trong Supabase Auth và bạn có quyền Super Admin.','error')}
});
$('ta-assignment-form').addEventListener('submit',async event=>{
 event.preventDefault();if(!canEdit()){status('Không có quyền phân công.','error');return}
 const id=$('ta-assignment-id').value.trim().toLowerCase(),moduleId=$('ta-module-id').value;
 if(!uuid(id)||!moduleId){status('Thông tin phân công không hợp lệ.','error');return}
 status('Đang phân công module…');
 try{
  const r=await withDeadline(client.from('tien404_tester_assignments').upsert({
   user_id:id,module_id:moduleId,active:true
  },{onConflict:'user_id,module_id'}),15000);
  if(r.error)throw Error('ASSIGNMENT_DENIED');
  status('Đã giao module qua backend, đang đọc lại quyền.','ok');await refresh();
 }catch{status('Phân công thất bại. Người thử phải được phê duyệt và module phải hợp lệ.','error')}
});

async function exportLatestCsv(){
 const control=$('ta-export');
 if(exporting||!client||!user||!staff?.active||!roleSet.has(staff.staff_role)){
  status('Không có quyền xuất báo cáo.','error');return;
 }
 exporting=true;control.disabled=true;status('Đang xác thực lại quyền trước khi tải CSV…');
 try{
  const currentUser=await withDeadline(client.auth.getUser(),12000);
  if(currentUser.error||currentUser.data?.user?.id!==user.id)throw Error('IDENTITY_CHANGED');
  const activeStaff=await withDeadline(client.from('tien404_tester_staff')
   .select('staff_role,active').eq('user_id',user.id).maybeSingle(),12000);
  if(activeStaff.error||!activeStaff.data?.active||!roleSet.has(activeStaff.data.staff_role))
   throw Error('ROLE_REVOKED');
  const report=await withDeadline(client.from('tien404_tester_runs')
   .select('created_at,run_id,user_id,case_id,outcome,feedback,self_reported')
   .order('created_at',{ascending:false}).limit(500),15000);
  if(report.error)throw Error('READ_DENIED');
  const rows=report.data||[];
  if(!rows.length){status('Chưa có báo cáo tự đánh giá để xuất.');return;}
  const blob=new Blob([buildTesterCsv(rows)],{type:'text/csv;charset=utf-8'});
  const localUrl=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=localUrl;a.download='tien404-tester-self-reports-'+new Date().toISOString().slice(0,10)+'.csv';
  document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(localUrl),4000);
  status('Đã tạo bản CSV từ '+rows.length+' lượt tự đánh giá do RLS cho phép. Chưa phải QA được xác minh.','ok');
 }catch{
  status('Không thể xuất CSV. Kiểm tra phiên, quyền nhân sự và kết nối backend.','error');
 }finally{exporting=false;control.disabled=$('ta-run-count').textContent==='0';}
}
$('ta-export').addEventListener('click',exportLatestCsv);

$('ta-refresh').addEventListener('click',refresh);
initialize();
