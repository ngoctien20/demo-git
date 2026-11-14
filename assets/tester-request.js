/* TIEN404 V12.2: staged permission request for EXISTING, verified Auth users.
 * A request never creates Auth users, access grants, module assignments or provider sends.
 * DB RLS is the final authority. No credentials or direct admin calls.
 */
import {getAuthClient} from './auth-client.js';
import {withDeadline} from './auth-runtime.mjs';
const $=id=>document.getElementById(id);
const stage=new Set(['sheets','messenger','telegram','zalo','ai_sales','commerce']);
const status=(text,tone='info')=>{$('tr-status').textContent=text;$('tr-status').dataset.tone=tone};
let client=null,user=null,busy=false;
function locked(message){
 $('tr-form').hidden=true;$('tr-authorized').hidden=true;$('tr-locked').hidden=false;
 $('tr-locked-reason').textContent=message;status(message,'error');
}
function result(text,href,label){
 const root=$('tr-result');root.replaceChildren();root.hidden=false;
 const p=document.createElement('p');p.textContent=text;root.append(p);
 if(href){const a=document.createElement('a');a.href=href;a.className='tp-button';a.textContent=label;root.append(a);}
}
async function fetchOne(table,columns){
 const response=await withDeadline(client.from(table).select(columns).eq('user_id',user.id).maybeSingle(),14000);
 if(response.error)throw Error('ACCESS_READ_DENIED');
 return response.data;
}
async function refresh(){
 if(!client||!user)return;
 $('tr-form').hidden=true;$('tr-result').hidden=true;
 try{
  const [request,access,staff]=await Promise.all([
   fetchOne('tien404_tester_requests','request_id,status,desired_module,created_at,reviewed_at'),
   fetchOne('tien404_tester_access','access_status,expires_at'),
   fetchOne('tien404_tester_staff','staff_role,active')
  ]);
  if(staff?.active&&(staff.staff_role==='super_admin'||staff.staff_role==='qa_manager')){
   result('Tài khoản này là nhân sự quản trị Tester, không cần gửi đơn xin quyền thử nghiệm.','tester-admin.html','Mở Tester Admin');
  }else if(access?.access_status==='approved'&&Date.parse(access.expires_at)>Date.now()){
   result('Bạn đã được cấp quyền thử nghiệm. Nếu chưa thấy bài, người quản lý cần phân công module.','tester.html','Mở Tester Portal');
  }else if(request?.status==='pending'){
   result('Đã nhận yêu cầu. Trạng thái: CHỜ DUYỆT. Không cần gửi lại. Bạn có thể kiểm tra ở trang này.');
  }else if(request?.status==='rejected'){
   result('Yêu cầu chưa được chấp nhận. Hãy liên hệ người quản lý dự án nếu cần trao đổi hoặc gửi lại ở đợt khác.');
  }else if(request?.status==='approved'){
   result('Yêu cầu đã được duyệt trước đó nhưng quyền có thể đã hết hạn hoặc bị thu hồi. Hãy liên hệ quản trị để gia hạn.');
  }else{
   $('tr-form').hidden=false;
   status('Tài khoản hợp lệ. Bạn có thể gửi một yêu cầu xét duyệt.','ok');
   return;
  }
  status('Đã kiểm tra trạng thái theo quyền Supabase RLS.','ok');
 }catch{result('Chưa thể tải trạng thái đăng ký do lỗi xác thực hoặc kết nối. Không gửi lại khi chưa biết kết quả.');status('Không đọc được dữ liệu xét duyệt. Vui lòng thử lại sau.','error');}
}
async function initialize(){
 try{
  client=await withDeadline(getAuthClient(),20000);
  const current=await withDeadline(client.auth.getUser(),15000);
  if(current.error||!current.data?.user){locked('Vui lòng đăng nhập bằng tài khoản đã được mời.');return;}
  user=current.data.user;
  if(!user.email_confirmed_at||user.is_anonymous){locked('Tài khoản chưa xác minh email hoặc không đủ điều kiện thử nghiệm.');return;}
  $('tr-identity').textContent=user.email||'Đã xác thực';
  $('tr-locked').hidden=true;$('tr-authorized').hidden=false;
  client.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT')locked('Phiên đã đăng xuất.');});
  await refresh();
 }catch{locked('Không thể xác thực phiên Supabase trên staging.');}
}
$('tr-form').addEventListener('submit',async e=>{
 e.preventDefault();
 if(busy||!client||!user)return;
 const desired=$('tr-module').value,note=$('tr-note').value.trim();
 if(!stage.has(desired)||note.length>400){status('Hãy chọn chức năng hợp lệ, ghi chú không quá 400 ký tự.','error');return;}
 busy=true;$('tr-submit').disabled=true;status('Đang gửi yêu cầu để quản trị viên xét duyệt…');
 try{
  const verified=await withDeadline(client.auth.getUser(),12000);
  if(verified.error||verified.data?.user?.id!==user.id||!verified.data.user.email_confirmed_at)
   throw Error('SESSION_MISMATCH');
  const response=await withDeadline(client.from('tien404_tester_requests')
   .insert({user_id:user.id,desired_module:desired,note}),15000);
  if(response.error)throw Error('REQUEST_DENIED');
  await refresh();
  status('Yêu cầu đã được lưu. Chờ quản trị viên phê duyệt, chưa có quyền Tester.','ok');
 }catch{
  status('Không thể xác nhận yêu cầu đã được lưu. Kiểm tra lại trạng thái trước khi thử lại.','error');
  await refresh();
 }finally{busy=false;$('tr-submit').disabled=false;}
});
initialize();
