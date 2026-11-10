/* TIEN404 authenticated STAGING portal. This is NOT a server authorization gate.
   All tenant data queries rely on Supabase RLS / backend enforcement. */
const status=document.getElementById('account-status');
const loginLink=document.getElementById('account-login-link');
const content=document.getElementById('account-protected');
const emailNode=document.getElementById('account-email');
const cards=document.getElementById('account-tenants');
const logout=document.getElementById('account-logout');
const put=(message,kind='info')=>{status.textContent=message;status.dataset.state=kind};
const showLogin=()=>{loginLink.hidden=false;content.hidden=true};
let sb;
try{
 sb=(await import('./auth-client.js')).authClient;
 const {data,error}=await sb.auth.getUser();
 if(error || !data?.user){
   put('Chưa xác thực. Vui lòng đăng nhập để tiếp tục.','error');showLogin();
 }else{
   const user=data.user;
   emailNode.textContent=user.email||'Tài khoản đã xác thực';
   content.hidden=false;
   put('Đã xác thực tài khoản với Supabase. Đang kiểm tra quyền cửa hàng...');
   const {data:memberships,error:memberError}=await sb.from('tenant_memberships')
     .select('tenant_id,role,active').eq('user_id',user.id).eq('active',true).limit(50);
   if(memberError){
     put('Chưa xác minh được quyền cửa hàng qua cơ sở dữ liệu. Không hiển thị dữ liệu kinh doanh.','error');
   }else if(!memberships?.length){
     put('Đăng nhập thành công, nhưng tài khoản chưa được cấp quyền cho cửa hàng nào. Liên hệ quản trị viên TIEN404.','info');
   }else{
     const ids=[...new Set(memberships.map(m=>m.tenant_id))];
     const {data:tenants,error:tError}=await sb.from('tenants').select('id,name').in('id',ids).limit(50);
     if(tError){put('Đã xác minh thành viên nhưng chưa tải được tên cửa hàng. Không mở dữ liệu riêng.','error')}
     else{
       const names=new Map((tenants||[]).map(t=>[t.id,t.name]));
       memberships.forEach(m=>{
         const card=document.createElement('div');card.className='auth-tenant-card';
         const title=document.createElement('strong');title.textContent=names.get(m.tenant_id)||'Cửa hàng được phân quyền';
         const role=document.createElement('small');role.textContent='Vai trò: '+m.role;
         card.append(title,role);cards.appendChild(card);
       });
       put('Đăng nhập và kiểm tra thành viên thành công. Chức năng xem đơn hàng thật chưa được kích hoạt.','ok');
     }
   }
 }
 sb.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT'){put('Phiên đăng nhập đã kết thúc.','info');showLogin()}});
}catch(e){put('Không thể kiểm tra phiên đăng nhập. Không mở dữ liệu.','error');showLogin()}
logout?.addEventListener('click',async()=>{
 logout.disabled=true;
 try{
  if(sb)await sb.auth.signOut();
  location.replace('login.html');
 }catch(e){put('Không thể đăng xuất từ máy chủ. Vui lòng thử lại.','error');logout.disabled=false}
});
