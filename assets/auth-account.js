/* TIEN404 account staging. Display-only; Supabase RLS is the authorization boundary.
 * No order/customer queries or writes, no user-selected tenant authority.
 */
import {approvedMemberships,scopedTenantDisplay} from './auth-helpers.mjs';
const status=document.getElementById('account-status');
const loginLink=document.getElementById('account-login-link');
const protectedContent=document.getElementById('account-protected');
const emailNode=document.getElementById('account-email');
const cards=document.getElementById('account-tenants');
const logout=document.getElementById('account-logout');
const refreshButton=document.getElementById('account-refresh');
const put=(message,kind='info')=>{status.textContent=message;status.dataset.state=kind};

let sb=null;
let generation=0;
let lastChecked=0;
let verifiedUserId=null;
let busy=false;
const resetView=()=>{
  protectedContent.hidden=true;
  cards.replaceChildren();
  emailNode.textContent='';
};
const requireLogin=message=>{
  resetView();
  loginLink.hidden=false;
  put(message,'error');
};
const revalidate=async()=>{
  if(!sb || busy)return;
  busy=true;
  const current=++generation;
  lastChecked=Date.now();
  refreshButton.disabled=true;
  resetView();
  loginLink.hidden=true;
  put('Đang xác minh phiên và quyền thành viên cửa hàng...');
  try{
    const {data,error}=await sb.auth.getUser();
    if(current!==generation)return;
    if(error||!data?.user?.id){
      verifiedUserId=null;
      requireLogin('Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.');
      return;
    }
    const user=data.user;
    verifiedUserId=user.id;
    // Authorization remains in database: the extra filter is only defensive.
    const membershipResponse=await sb.from('tenant_memberships')
      .select('tenant_id,user_id,role,active')
      .eq('user_id',user.id).eq('active',true).limit(50);
    if(current!==generation)return;
    if(membershipResponse.error){
      resetView();
      put('Không xác minh được quyền cửa hàng. Mọi dữ liệu riêng vẫn bị khóa.','error');
      return;
    }
    const memberships=approvedMemberships(membershipResponse.data,user.id);
    if(!memberships.length){
      resetView();
      put('Đăng nhập hợp lệ nhưng chưa có quyền cửa hàng. Vui lòng liên hệ quản trị viên.','info');
      return;
    }
    const ids=memberships.map(m=>m.tenant_id);
    const tenantsResponse=await sb.from('tenants')
      .select('id,name').in('id',ids).limit(50);
    if(current!==generation)return;
    if(tenantsResponse.error){
      resetView();
      put('Chưa xác minh được danh sách cửa hàng. Không hiển thị dữ liệu.','error');
      return;
    }
    const allowed=scopedTenantDisplay(memberships,tenantsResponse.data);
    if(!allowed.length){
      resetView();
      put('Không có cửa hàng nào xác minh được quyền truy cập.','error');
      return;
    }
    emailNode.textContent=user.email||'Tài khoản đã xác thực';
    for(const t of allowed){
      const card=document.createElement('div');
      card.className='auth-tenant-card';
      const title=document.createElement('strong');
      title.textContent=t.name;
      const role=document.createElement('small');
      role.textContent='Quyền thành viên: '+t.role;
      const note=document.createElement('small');
      note.textContent='Môi trường staging · chưa bật truy cập đơn hàng';
      card.append(title,role,note);
      cards.appendChild(card);
    }
    protectedContent.hidden=false;
    put('Xác minh phiên và quyền truy cập thành công. Dữ liệu đơn hàng thực vẫn chưa được mở.','ok');
  }catch{
    if(current===generation){
      resetView();
      put('Không kết nối được hệ thống xác thực. Dữ liệu đã được khóa.','error');
    }
  }finally{
    if(current===generation){busy=false;refreshButton.disabled=false}
  }
};

try{
  sb=(await import('./auth-client.js')).authClient;
  sb.auth.onAuthStateChange((event,session)=>{
    if(event==='SIGNED_OUT'){
      verifiedUserId=null;
      refreshButton.disabled=false;
      generation++;
      busy=false;
      resetView();
      requireLogin('Đã đăng xuất khỏi tài khoản.');
    }else if(event==='TOKEN_REFRESHED' || (event==='SIGNED_IN' && session?.user?.id!==verifiedUserId)){
      // Re-check role and membership after token refresh; never trust cached role.
      const next=++generation;
      busy=false;
      resetView();
      // Run after the SDK releases its auth event lock.
      setTimeout(()=>{if(next===generation) revalidate()},0);
    }
  });
  await revalidate();
}catch{
  requireLogin('Không tải được dịch vụ xác thực. Vui lòng đăng nhập lại sau.');
}
refreshButton?.addEventListener('click',revalidate);
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible' && Date.now()-lastChecked>30000){
    revalidate();
  }
});
logout?.addEventListener('click',async()=>{
  if(!sb){requireLogin('Không có phiên hợp lệ.');return}
  logout.disabled=true;
  generation++;
  resetView();
  put('Đang đăng xuất...');
  try{
    const {error}=await sb.auth.signOut();
    if(error)throw error;
    location.replace('login.html');
  }catch{
    requireLogin('Không xác nhận được đăng xuất. Hãy thử lại hoặc đóng phiên từ Supabase.');
    logout.disabled=false;
  }
});
