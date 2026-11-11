import {addMerchantList} from './merchant-lists.mjs';
import {approvedMemberships,scopedTenantDisplay} from './auth-helpers.mjs';
import {withDeadline} from './auth-runtime.mjs';
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
// Merchant overview: read-only counts from tenant-scoped RLS queries.
function addMerchantOverview(card, tenant, viewGeneration) {
  const section=document.createElement('section');
  const heading=document.createElement('h4');
  heading.textContent='Tổng quan cửa hàng';
  const refresh=document.createElement('button');
  refresh.type='button';
  refresh.className='btn btn-outline';
  refresh.textContent='Cập nhật tổng quan';
  const summary=document.createElement('p');
  summary.setAttribute('role','status');
  const grid=document.createElement('ul');
  section.append(heading,refresh,summary,grid);
  card.append(section);
  async function load() {
    if(viewGeneration!==generation || refresh.disabled)return;
    refresh.disabled=true;
    grid.replaceChildren();
    summary.textContent='Đang đọc dữ liệu staging...';
    try {
      const specs=[['Sản phẩm','products']];
      if (['owner','manager'].includes(tenant.role)) {
        specs.push(['Đơn hàng','orders'],['Khách hàng','customers'],['Hội thoại','conversations']);
      }
      const results=await Promise.all(specs.map(async ([label,table])=>{
        const response=await withDeadline(sb.from(table).select('id',{count:'exact',head:true}).eq('tenant_id',tenant.id),13000);
        if(response.error || !Number.isInteger(response.count))throw Error('count');
        return [label,response.count];
      }));
      if(viewGeneration!==generation)return;
      for(const [label,count] of results){
        const item=document.createElement('li');
        item.textContent=label+': '+count;
        grid.append(item);
      }
      summary.textContent='Dữ liệu Supabase theo quyền cửa hàng · '+new Date().toLocaleTimeString('vi-VN');
    }catch{
      if(viewGeneration!==generation)return;
      grid.replaceChildren();
      summary.textContent='Không tải được tổng quan. Dữ liệu riêng vẫn được bảo vệ.';
    }finally{
      if(viewGeneration===generation)refresh.disabled=false;
    }
  }
  refresh.addEventListener('click',load);
  load();
}
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
    const {data,error}=await withDeadline(sb.auth.getUser(),13000);
    if(current!==generation)return;
    if(error||!data?.user?.id){
      verifiedUserId=null;
      requireLogin('Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.');
      return;
    }
    const user=data.user;
    verifiedUserId=user.id;
    // Authorization remains in database: the extra filter is only defensive.
    const membershipResponse=await withDeadline(sb.from('tenant_memberships')
      .select('tenant_id,user_id,role,active')
      .eq('user_id',user.id).eq('active',true).limit(50),13000);
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
    const tenantsResponse=await withDeadline(sb.from('tenants')
      .select('id,name').in('id',ids).limit(50),13000);
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
    const workspace=document.createElement('div');
    function openTenant(t) {
      workspace.replaceChildren();
      const card=document.createElement('div');
      card.className='auth-tenant-card';
      const title=document.createElement('strong');
      title.textContent=t.name;
      const role=document.createElement('small');
      role.textContent='Quyền thành viên: '+t.role;
      const note=document.createElement('small');
      note.textContent='Dữ liệu staging · chỉ đọc';
      card.append(title,role,note);
      addMerchantOverview(card, t, current);
      const context = {client:sb, tenantId:t.id, current:()=>current===generation};
      addMerchantList(card,'products',context);
      if (['owner','manager'].includes(t.role)) {
        for (const table of ['orders','customers','conversations','tenant_agent_configs']) addMerchantList(card,table,context);
      }
      workspace.appendChild(card);
    }
    if (allowed.length>1) {
      const label=document.createElement('label');
      label.textContent='Cửa hàng đang xem';
      const picker=document.createElement('select');
      for (const t of allowed) picker.add(new Option(t.name,t.id));
      picker.addEventListener('change',()=>{
        const selected=allowed.find(t=>t.id===picker.value);
        if (current===generation && selected) openTenant(selected);
      });
      label.append(picker);
      cards.append(label);
    }
    cards.append(workspace);
    openTenant(allowed[0]);
    protectedContent.hidden=false;
    put('Xác minh phiên và quyền truy cập thành công. Chọn dữ liệu cần xem.','ok');
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
  sb=await withDeadline(import('./auth-client.js').then(module => module.getAuthClient()),20500);
  window.dispatchEvent(new Event('tien404:auth-ready'));
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
  window.dispatchEvent(new Event('tien404:auth-error'));
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
    const {error}=await withDeadline(sb.auth.signOut(),13000);
    if(error)throw error;
    location.replace('login.html');
  }catch{
    requireLogin('Không xác nhận được đăng xuất. Hãy thử lại hoặc đóng phiên từ Supabase.');
    logout.disabled=false;
  }
});
