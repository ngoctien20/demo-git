/* TIEN404 AI / Merchant Portal V12.2 (read-only staging).
 * Reuses tested Supabase Auth client, membership helpers, RLS and merchant lists.
 * Never performs table mutations, sends notifications or fabricates dashboard data.
 */
import {getAuthClient} from './auth-client.js';
import {approvedMemberships,scopedTenantDisplay} from './auth-helpers.mjs';
import {withDeadline} from './auth-runtime.mjs';
import {addMerchantList} from './merchant-lists.mjs';
import {mountRevenuePanel} from './merchant-revenue-v3.mjs';
import {mayOpenPanel,selectAuthorizedShop} from './merchant-portal-policy.mjs';

const byId=id=>document.getElementById(id);
const message=byId('merchant-status');
const locked=byId('merchant-login');
const protectedBox=byId('merchant-protected');
const selector=byId('merchant-shop-select');
const roleNode=byId('merchant-shop-role');
const heading=byId('merchant-heading');
const subtitle=byId('merchant-subheading');
const panel=byId('merchant-panel');
const nav=byId('merchant-nav');
const refreshButton=byId('merchant-refresh');
const logoutButton=byId('merchant-logout');
const headings={
  overview:['Tổng quan cửa hàng','Dữ liệu được đọc trực tiếp theo quyền truy cập của cửa hàng.'],
  products:['Sản phẩm & tồn kho','Tìm SKU, xem giá bán và kiểm tra hàng tồn.'],
  orders:['Đơn hàng','Theo dõi đơn chờ, đã xác nhận và đã thanh toán.'],
  customers:['Khách hàng & lịch sử mua','Tra cứu khách và xem những đơn liên kết đã được xác minh.'],
  care:['Chăm sóc khách hàng','Xem hội thoại và chuyển vấn đề cần xử lý sang nhân viên khi có công cụ được duyệt.'],
  bots:['AI Bot & kênh bán','Xem cấu hình Agent và tình trạng kết nối đã được phân quyền.'],
  reports:['Báo cáo kinh doanh','Số liệu từ báo cáo staging, không ước tính doanh thu.'],
  subscriptions:['Gói dịch vụ','Thông tin thuê bao chỉ hiển thị khi có nguồn dữ liệu được kiểm chứng.'],
  help:['Hỗ trợ TIEN404','Hướng dẫn sử dụng và yêu cầu trợ giúp về nền tảng.'],
  settings:['Tài khoản & bảo mật','Xem tài khoản đã xác thực và quản lý phiên đăng nhập.']
};
const publicBase='https://ngoctien20.github.io/demo-git/';
let client=null;
let authEpoch=0, panelEpoch=0, lastChecked=0, verificationSeq=0;
let currentUser=null, shops=[], selected=null, currentPanel='overview';
let cleanup=null;
const verifiedRoles=new Set(['owner','manager']);
const status=(text,tone='info')=>{message.textContent=text;message.dataset.tone=tone};
const isManager=()=>selected && verifiedRoles.has(selected.role);
const allowedView=view=>mayOpenPanel(selected?.role,view);
function clearPanel(){ panelEpoch++;cleanup?.();cleanup=null;panel.replaceChildren(); }
function lock(text){
  authEpoch++;verificationSeq++;clearPanel();shops=[];selected=null;currentUser=null;
  selector.replaceChildren();roleNode.textContent='';
  protectedBox.hidden=true;locked.hidden=false;
  status(text,'error');
}
function card(title){
  const section=document.createElement('section');
  section.className='mp-card';
  if(title){const h=document.createElement('h2');h.textContent=title;section.append(h)}
  panel.append(section);return section;
}
function note(parent,text,cl='mp-info'){
  const el=document.createElement('div');el.className=cl;el.textContent=text;
  parent.append(el);return el;
}
function link(parent,label,url){
  const a=document.createElement('a');a.className='mp-quiet-link';
  a.href=url;a.textContent=label;parent.append(a);return a;
}
function renderAccess(){
  for(const button of nav.querySelectorAll('button[data-panel]')){
    const view=button.dataset.panel;
    button.hidden=!allowedView(view);
    if(view===currentPanel)button.setAttribute('aria-current','page');
    else button.removeAttribute('aria-current');
  }
  roleNode.textContent='Quyền đã xác minh: '+(selected?.role||'—');
}
function scope(){
  const a=authEpoch,b=panelEpoch,shopId=selected?.id,userId=currentUser?.id;
  return {client,tenantId:shopId,current:()=>a===authEpoch&&b===panelEpoch&&
    selected?.id===shopId&&currentUser?.id===userId&&!protectedBox.hidden};
}
async function overview(container,ctx) {
  const manager=isManager();
  const specs=[['Sản phẩm','products',null],['Hết hàng','products',{stock_on_hand:0,is_active:true}]];
  if(manager)specs.push(['Đơn chờ xử lý','orders',{status:'pending'}],
    ['Đơn đã thanh toán','orders',{status:'paid'}],
    ['Khách hàng','customers',null],
    ['Hội thoại','conversations',null]);
  const root=document.createElement('div');root.className='mp-summary';
  const text=document.createElement('p');text.setAttribute('role','status');
  text.textContent='Đang đọc số liệu theo quyền của cửa hàng…';
  container.append(text,root);
  try {
    const results=await Promise.all(specs.map(async ([label,table,filter])=>{
      let q=ctx.client.from(table).select('id',{count:'exact',head:true}).eq('tenant_id',ctx.tenantId);
      if(filter)for(const [column,value] of Object.entries(filter))q=q.eq(column,value);
      const data=await withDeadline(q,12000);
      if(data.error||!Number.isSafeInteger(data.count)||data.count<0)throw Error('INVALID_COUNT');
      return [label,data.count];
    }));
    if(!ctx.current())return;
    for(const [label,count] of results){
      const stat=document.createElement('div');stat.className='mp-stat';
      const small=document.createElement('span');small.textContent=label;
      const amount=document.createElement('strong');amount.textContent=new Intl.NumberFormat('vi-VN').format(count);
      const source=document.createElement('small');source.textContent='Supabase staging · RLS';
      stat.append(small,amount,source);root.append(stat);
    }
    text.textContent='Số liệu đọc thành công từ cửa hàng đang chọn. Đơn đã thanh toán được đếm riêng với đơn chờ.';
  } catch {
    if(!ctx.current())return;
    root.replaceChildren();
    text.textContent='Không thể xác minh số liệu. Kiểm tra kết nối hoặc quyền cửa hàng. Không hiển thị số liệu mẫu.';
  }
}
function openList(table,title,description){
  const box=card(title);
  note(box,description);
  const ctx=scope();
  addMerchantList(box,table,ctx);
  // Reuse the existing tenant-scoped list UI rather than duplicating catalog/CRM query logic.
  const first=box.querySelector('section>button');
  if(first)first.click();
}
function showPanel(view,focus=false) {
  if(!selected||!allowedView(view)){clearPanel();status('Bạn không có quyền mở phân mục này.','error');return;}
  currentPanel=view;clearPanel();renderAccess();
  heading.textContent=headings[view][0];subtitle.textContent=headings[view][1];
  if(view==='overview'){
    const box=card('Hoạt động cửa hàng');note(box,'Không có số liệu giả. Dữ liệu bên dưới được tổng hợp từ Supabase staging theo tenant đã xác minh.');
    overview(box,scope());
    const next=card('Thao tác nhanh');
    const actions=document.createElement('div');actions.className='mp-actions';
    for(const [label,target] of [['Xem sản phẩm','products'],['Hỗ trợ TIEN404','help'],...(isManager()?[['Xem đơn hàng','orders'],['Xem khách hàng','customers']]:[])]){
      const b=document.createElement('button');b.type='button';b.textContent=label;
      b.addEventListener('click',()=>showPanel(target,true));actions.append(b);
    }next.append(actions);
    if(!isManager())note(card('Phân quyền'),'Tài khoản Staff hiện chỉ được xem danh mục sản phẩm. Đơn hàng, hồ sơ khách và hội thoại yêu cầu Owner hoặc Manager.');
  } else if(view==='products') {
    openList('products','Danh mục sản phẩm','Đọc giá, SKU và tồn kho từ catalog của chính cửa hàng. Chức năng chỉnh sửa yêu cầu quyền và API riêng.');
  } else if(view==='orders') {
    openList('orders','Danh sách đơn hàng','Đơn paid mới được xem là đã thanh toán. Bấm vào từng đơn để xem dòng hàng nếu hệ thống có dữ liệu.');
  } else if(view==='customers') {
    openList('customers','Hồ sơ khách mua hàng','Bấm vào khách để xem lịch sử đơn hàng liên kết. Không suy ra số điện thoại từ Zalo Chat ID.');
  } else if(view==='care') {
    openList('conversations','Hội thoại & yêu cầu chăm sóc','Xem nguồn hội thoại đã kết nối theo quyền RLS. Chức năng phản hồi hoặc giao nhân viên chưa bật.');
    note(card('Chuyển cho nhân viên'),'Đang thiết kế luồng tiếp nhận và chăm sóc khách. Không gửi tin nhắn từ giao diện staging này.');
  } else if(view==='bots') {
    openList('tenant_agent_configs','Bot đang được cấu hình','Dữ liệu cấu hình không chứng minh Bot đang được bật ở Zalo/Messenger.');
    const box=card('Ghép nối Bot với chủ cửa hàng');
    note(box,'Owner Pairing V3 đang kiểm thử. Dùng trang Tài khoản đã xác thực để kiểm tra quy trình ghép nối, chưa bật gửi tin.');
    link(box,'Mở trang Tài khoản','account.html');
  } else if(view==='reports') {
    const box=card('Báo cáo bán hàng');note(box,'Sử dụng lại báo cáo doanh thu V3 hiện có; không tự cộng doanh thu từ đơn pending.');
    const ctx=scope();
    cleanup=mountRevenuePanel(box,ctx.client,ctx.tenantId);
  } else if(view==='subscriptions') {
    const box=card('Thuê bao TIEN404');
    note(box,'BLOCKED: chưa có nguồn API Subscription/Billing được nghiệm thu cho người dùng. Không hiển thị gói hoặc hóa đơn demo như dữ liệu thật.');
    link(box,'Xem bảng giá công khai',publicBase+'pricing.html');
  } else if(view==='help'){
    const box=card('Trung tâm hỗ trợ');
    const p=document.createElement('p');p.textContent='Cần hướng dẫn kết nối Bot, nhập sản phẩm hoặc xử lý đơn? Dùng kênh liên hệ TIEN404. Ticket nội bộ chưa tích hợp, chưa ghi yêu cầu vào hệ thống.';box.append(p);
    const links=document.createElement('div');links.className='mp-actions';box.append(links);
    link(links,'Hướng dẫn và câu hỏi thường gặp',publicBase+'faq.html');
    link(links,'Liên hệ TIEN404',publicBase+'contact.html');
  } else if(view==='settings'){
    const box=card('Phiên đăng nhập & quyền cửa hàng');
    const p=document.createElement('p');p.textContent='Email tài khoản: '+(currentUser.email||'Đã xác thực')+' · Quyền cửa hàng: '+selected.role;box.append(p);
    note(box,'Đổi mật khẩu và email cần xác thực qua Supabase Auth. Không nhập mật khẩu hay recovery token vào biểu mẫu bất kỳ bên trong Dashboard.');
    link(box,'Mở trang Tài khoản','account.html');
    link(box,'Đăng nhập / khôi phục mật khẩu','login.html');
  }
  if(focus)byId('merchant-content').focus();
}
function setShop(shop){
  const verified=selectAuthorizedShop(shops,shop?.id);
  if(!verified)return;
  selected=verified;
  selector.value=shop.id;
  if(!allowedView(currentPanel))currentPanel='overview';
  showPanel(currentPanel);
}
async function revalidate(){
  if(!client){lock('Dịch vụ xác thực chưa sẵn sàng.');return;}
  const round=++verificationSeq;lastChecked=Date.now();
  const hadWorkspace=!protectedBox.hidden && !!currentUser?.id;
  // A valid session can refresh silently; never clear tenant panels before checking.
  if(!hadWorkspace){clearPanel();protectedBox.hidden=true;locked.hidden=true;}
  status(hadWorkspace?'Đang kiểm tra quyền trong nền…':'Đang kiểm tra phiên và quyền cửa hàng…');
  refreshButton.disabled=true;
  try {
    const userResult=await withDeadline(client.auth.getUser(),13000);
    if(round!==verificationSeq)return;
    const user=userResult.data?.user;
    if(userResult.error||!user?.id){lock('Không có phiên đăng nhập hợp lệ. Hãy đăng nhập để tiếp tục.');return;}
    const membership=await withDeadline(client.from('tenant_memberships')
      .select('tenant_id,user_id,role,active').eq('user_id',user.id)
      .eq('active',true).limit(50),13000);
    if(round!==verificationSeq)return;
    if(membership.error){lock('Không thể xác minh quyền cửa hàng. Dữ liệu riêng vẫn bị khóa.');return;}
    const accepted=approvedMemberships(membership.data,user.id);
    if(!accepted.length){lock('Tài khoản đã xác thực nhưng chưa được cấp quyền cửa hàng.');return;}
    const tenantIds=accepted.map(m=>m.tenant_id);
    const response=await withDeadline(client.from('tenants').select('id,name')
      .in('id',tenantIds).limit(50),13000);
    if(round!==verificationSeq)return;
    if(response.error){lock('Không đọc được danh sách cửa hàng đã cấp quyền.');return;}
    const allowed=scopedTenantDisplay(accepted,response.data);
    if(!allowed.length){lock('Không có cửa hàng nào được cấp quyền hợp lệ.');return;}
    if(hadWorkspace && currentUser?.id===user.id &&
       JSON.stringify(shops.map(t=>[t.id,t.name,t.role]).sort((a,b)=>a[0].localeCompare(b[0])))===
       JSON.stringify(allowed.map(t=>[t.id,t.name,t.role]).sort((a,b)=>a[0].localeCompare(b[0])))){
      // Selected shop, current dashboard tab, scroll and edit form remain untouched.
      status('Phiên và quyền cửa hàng vẫn hợp lệ.','ok');
      return;
    }
    const oldShop=currentUser?.id===user.id?selected?.id:null;
    authEpoch++;clearPanel();
    shops=allowed;currentUser=user;
    selector.replaceChildren();
    for(const s of shops)selector.add(new Option(s.name,s.id));
    selected=shops.find(t=>t.id===oldShop)||shops[0];
    protectedBox.hidden=false;locked.hidden=true;
    setShop(selected);
    status('Đã xác minh tài khoản và quyền truy cập cửa hàng trên Supabase staging.','ok');
  }catch{
    if(round===authEpoch)lock('Không xác minh được phiên hoặc dữ liệu. Hãy thử đăng nhập lại.');
  }finally{if(round===authEpoch)refreshButton.disabled=false}
}
selector.addEventListener('change',()=>{
  const found=shops.find(t=>t.id===selector.value);
  if(found)setShop(found);
});
nav.addEventListener('click',event=>{
  const button=event.target.closest('button[data-panel]');
  if(!button||!nav.contains(button))return;
  if(!allowedView(button.dataset.panel))return;
  showPanel(button.dataset.panel,true);
});
refreshButton.addEventListener('click',revalidate);
logoutButton.addEventListener('click',async()=>{
  const running=client;lock('Đang đăng xuất...');
  logoutButton.disabled=true;
  try{
    if(!running)throw Error('NO_AUTH');
    const {error}=await withDeadline(running.auth.signOut({scope:'local'}),13000);
    if(error)throw error;
    location.replace('login.html');
  }catch{
    status('Chưa xác nhận được đăng xuất. Dữ liệu riêng đã được khóa trên giao diện. Hãy thử lại.','error');
    logoutButton.disabled=false;
  }
});
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible'&&Date.now()-lastChecked>300000)revalidate();
});
try {
  client=await withDeadline(getAuthClient(),20500);
  client.auth.onAuthStateChange((event,session)=>{
    if(event==='SIGNED_OUT'){
      lock('Đã đăng xuất. Vui lòng đăng nhập lại.');
    } else if(event==='SIGNED_IN' && currentUser?.id && currentUser.id!==session?.user?.id){
      // Account change: remove previous tenant data before revalidating.
      lock('Đang xác minh tài khoản mới…');
      setTimeout(()=>revalidate(),0);
    } else if(event==='USER_UPDATED'){
      setTimeout(()=>revalidate(),0);
    }
    // TOKEN_REFRESHED / same-user SIGNED_IN: Supabase SDK refreshes the token;
    // the RLS-protected server still enforces tenant authorization.
  });
  await revalidate();
}catch{
  lock('Không tải được dịch vụ xác thực. Hãy thử lại khi kết nối ổn định.');
}
