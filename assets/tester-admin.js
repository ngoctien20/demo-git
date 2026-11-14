/* TIEN404 Tester Admin — staging only. No Auth Admin API keys or service_role.
 * Global tester administration depends on separately bootstrapped Supabase table.
 * A Merchant Owner alone is NOT a tester Super Admin.
 */
import {getAuthClient} from './auth-client.js';
import {withDeadline} from './auth-runtime.mjs';
const $=id=>document.getElementById(id);
let client=null,user=null,staff=null,loading=false;
const roleSet=new Set(['super_admin','qa_manager']);
const status=(t,tone='info')=>{$('ta-status').textContent=t;$('ta-status').dataset.tone=tone};
const node=(tag,text,cls)=>{const v=document.createElement(tag);if(text!==undefined&&text!==null)v.textContent=String(text);if(cls)v.className=cls;return v};
const canEdit=()=>staff?.active===true&&staff.staff_role==='super_admin';
function deny(reason){client=null;user=null;staff=null;$('ta-protected').hidden=true;$('ta-locked').hidden=false;$('ta-locked-reason').textContent=reason;status(reason,'error')}
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
async function refresh(){
 if(loading||!user||!staff)return;
 loading=true;$('ta-refresh').disabled=true;
 try{
  const [access,modules,assignments,runs,audit]=await Promise.all([
   query('tien404_tester_access','user_id,access_status,expires_at,updated_at',r=>r.order('updated_at',{ascending:false}).limit(120)),
   query('tien404_tester_modules','module_id,title,readiness,sort_order',r=>r.order('sort_order')),
   query('tien404_tester_assignments','user_id,module_id,active',r=>r.limit(500)),
   query('tien404_tester_runs','run_id,user_id,case_id,outcome,created_at,feedback,self_reported',r=>r.order('created_at',{ascending:false}).limit(100)),
   query('tien404_tester_audit','event_type,actor_user_id,affected_user_id,created_at',r=>r.order('created_at',{ascending:false}).limit(70))
  ]);
  $('ta-access-count').textContent=String(access.length);
  $('ta-run-count').textContent=String(runs.length);
  $('ta-module-count').textContent=String(modules.length);
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
$('ta-refresh').addEventListener('click',refresh);
initialize();
