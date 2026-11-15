/* TIEN404 V13.4 — Customer Account Portal ONLY.
 * Supabase Auth + current tenant membership; no Bot, product, customer, order, financial or ticket writes.
 * UI disclosure is not authorization. Billing/profile changes require a trusted endpoint and owner approval.
 */
import {getAuthClient} from './auth-client.js';
import {approvedMemberships,scopedTenantDisplay} from './auth-helpers.mjs';
import {withDeadline} from './auth-runtime.mjs';
import {loadShopOrders,canReadShopOrders} from './merchant-order-readonly.mjs';

const byId=id=>document.getElementById(id);
const statusNode=byId('merchant-status'),locked=byId('merchant-login'),
  protectedBox=byId('merchant-protected'),selector=byId('merchant-shop-select'),
  roleNode=byId('merchant-shop-role'),panel=byId('merchant-panel'),
  nav=byId('merchant-nav'),heading=byId('merchant-heading'),subheading=byId('merchant-subheading'),
  refreshButton=byId('merchant-refresh'),logoutButton=byId('merchant-logout');
const VIEWS=Object.freeze({
 overview:['Tổng quan tài khoản','Thông tin người dùng và tình trạng gói thuê bao.'],
 orders:['Đơn hàng cửa hàng','Xem đơn thuộc cửa hàng đã xác minh. Thao tác thay đổi chờ backend an toàn.'],
 profile:['Thông tin cá nhân','Chỉ thông tin của tài khoản đã đăng nhập.'],
 subscription:['Gói đang sử dụng','Quyền sử dụng và thời hạn phải được xác minh từ hệ thống thuê bao.'],
 billing:['Thông tin thanh toán','Cập nhật thanh toán phải đi qua nhà cung cấp được phê duyệt.'],
 support:['Hỗ trợ & liên hệ','Nhân sự TIEN404 hỗ trợ cấu hình Bot và xử lý yêu cầu.']
});
const site='https://ngoctien20.github.io/demo-git/';
let client=null,currentUser=null,shops=[],selected=null,currentView='overview',epoch=0,busy=false,lastChecked=0,orderViewSeq=0;
function message(value,tone='info'){statusNode.textContent=value;statusNode.dataset.tone=tone;}
function wipe(){
  epoch++;orderViewSeq++;currentUser=null;shops=[];selected=null;selector.replaceChildren();
  roleNode.textContent='';panel.replaceChildren();protectedBox.hidden=true;locked.hidden=false;
}
function node(tag,text,className){
  const e=document.createElement(tag);if(text!==undefined&&text!==null)e.textContent=String(text);
  if(className)e.className=className;return e;
}
function block(title,body){
  const c=node('section',null,'mp-card');
  c.append(node('h2',title));
  if(body)c.append(node('p',body));
  panel.append(c);return c;
}
function info(where,value){
  where.append(node('div',value,'mp-info'));
}
function action(where,label,href){
  const a=node('a',label,'mp-quiet-link');a.href=href;where.append(a);return a;
}
function disabled(where,label,note){
  const b=node('button',label,'mp-action');b.type='button';b.disabled=true;
  b.title=note||'Chưa kết nối quy trình được xác thực';where.append(b);
}
function show(view,focus=false){
  if(!VIEWS[view]||!currentUser||!selected||protectedBox.hidden)return;
  const viewSeq=++orderViewSeq;
  currentView=view;panel.replaceChildren();
  [heading.textContent,subheading.textContent]=VIEWS[view];
  for(const button of nav.querySelectorAll('[data-panel]')){
    if(button.dataset.panel===view)button.setAttribute('aria-current','page');
    else button.removeAttribute('aria-current');
  }
  const planUnverified='Chưa kết nối nguồn xác minh Subscription/Billing. Không hiển thị gói, ngày hết hạn hoặc thanh toán giả.';
  if(view==='orders'){
    const c=block('Đơn hàng của cửa hàng','Chỉ đọc từ Supabase đã đăng nhập, chịu kiểm tra RLS. Không cho sửa giá hoặc tồn kho.');
    if(!canReadShopOrders(selected.role)){
      info(c,'Tài khoản chưa có quyền xem đơn hàng. Vui lòng liên hệ chủ cửa hàng hoặc TIEN404.');
    }else{
      const boundShop=selected.id, boundUser=currentUser.id, boundEpoch=epoch;
      const result=node('div','Đang tải danh sách đơn đã xác minh…','mp-info');
      c.append(result);
      loadShopOrders({client,tenantId:boundShop,role:selected.role}).then(orders=>{
        if(viewSeq!==orderViewSeq||boundEpoch!==epoch||selected?.id!==boundShop||
           currentUser?.id!==boundUser||protectedBox.hidden)return;
        result.replaceChildren();
        if(!orders.length){
          result.append(node('p','Chưa có đơn hàng trong cửa hàng được chọn.'));
        }else for(const order of orders){
          const card=node('article',null,'mp-card');
          card.append(node('h3','Mã đơn: '+order.id));
          card.append(node('p','Trạng thái đơn: '+order.statusLabel));
          card.append(node('p','Tổng giá trị đơn: '+order.totalLabel));
          card.append(node('p','Thời gian: '+order.createdLabel));
          result.append(card);
        }
        result.append(node('p','Trạng thái đơn không phải xác minh giao dịch thanh toán. Tiền thực thu cần đối soát với nguồn thanh toán chính thức.','mp-info'));
        disabled(c,'Xác nhận / thay đổi trạng thái đơn','Chưa có API ghi đơn, kiểm tra phiên bản, quyền và audit được nghiệm thu');
      }).catch(()=>{
        if(viewSeq!==orderViewSeq||boundEpoch!==epoch||selected?.id!==boundShop||
           currentUser?.id!==boundUser||protectedBox.hidden)return;
        result.textContent='Không xác minh được danh sách đơn. Dữ liệu vẫn bị khóa; không hiển thị mẫu thay thế.';
      });
    }
  }else if(view==='overview'){
    const c=block('Tài khoản đang đăng nhập');
    info(c,'Email: '+(currentUser.email||'Không có email được xác minh'));
    info(c,'Cửa hàng được cấp quyền: '+selected.name);
    info(c,'Vai trò tại cửa hàng: '+selected.role);
    const s=block('Gói dịch vụ');info(s,planUnverified);
    const next=node('button','Xem thông tin gói','mp-action');next.type='button';next.addEventListener('click',()=>show('subscription',true));s.append(next);
    const help=block('Vận hành Bot & đơn hàng');
    info(help,'Nhân sự TIEN404 cấu hình Bot, sản phẩm và giá. Bạn có thể xem đơn thuộc shop tại mục Đơn hàng; chức năng xác nhận đơn sẽ chỉ mở sau khi backend được nghiệm thu.');
  }else if(view==='profile'){
    const c=block('Hồ sơ cá nhân');
    info(c,'Email xác thực: '+(currentUser.email||'Không có dữ liệu'));
    const name=currentUser.user_metadata?.full_name||currentUser.user_metadata?.display_name;
    if(typeof name==='string'&&name.trim())info(c,'Tên hiển thị: '+name.trim().slice(0,100));
    info(c,'Cửa hàng: '+selected.name+' · Vai trò: '+selected.role);
    disabled(c,'Chỉnh sửa thông tin cá nhân','Chưa có API cập nhật hồ sơ an toàn và kiểm chứng email');
    action(c,'Đăng nhập và quản lý mật khẩu','login.html');
    info(c,'Chưa kích hoạt biểu mẫu thay đổi thông tin. Không nhập CCCD, mật khẩu hoặc thông tin thẻ vào trang thử nghiệm.');
  }else if(view==='subscription'){
    const c=block('Gói dịch vụ TIEN404');
    info(c,'Cửa hàng: '+selected.name);
    info(c,planUnverified);
    disabled(c,'Gia hạn / nâng cấp gói','Chưa có xác minh Subscription và luồng Billing');
    action(c,'Tìm hiểu các gói dịch vụ',site+'pricing.html');
  }else if(view==='billing'){
    const c=block('Thông tin thanh toán');
    info(c,'Chưa có nguồn thanh toán đã xác minh. Không có hóa đơn, phương thức thanh toán hoặc lịch sử giao dịch được xác nhận.');
    disabled(c,'Thay đổi thông tin thanh toán','Chỉ khả dụng sau khi tích hợp cổng thanh toán có kiểm soát');
    info(c,'Khi được kích hoạt, thao tác phải chuyển qua trang thanh toán an toàn được nhà cung cấp xác minh. TIEN404 không lưu số thẻ và mã bảo mật trong trình duyệt.');
    action(c,'Liên hệ để cập nhật thông tin thanh toán',site+'contact.html');
  }else if(view==='support'){
    const c=block('Yêu cầu hỗ trợ');
    info(c,'Muốn đổi thiết kế Bot, kết nối kênh, kiểm tra đơn hoặc hỗ trợ gói? Hãy liên hệ nhân sự TIEN404. Không có quyền tự điều khiển Bot tại đây.');
    action(c,'Liên hệ TIEN404',site+'contact.html');
    action(c,'Hướng dẫn sử dụng',site+'faq.html');
    info(c,'Ticket thực tế chưa được bật. Đường dẫn liên hệ không đồng nghĩa đã tạo ticket.');
  }
  if(focus)byId('merchant-content').focus();
}
function setShop(id){
  const s=shops.find(x=>x.id===id);if(!s)return;
  selected=s;selector.value=s.id;roleNode.textContent='Vai trò được xác minh: '+s.role;
  show(currentView);
}
async function refresh(){
  if(busy)return;busy=true;refreshButton.disabled=true;const run=++epoch;lastChecked=Date.now();
  message('Đang kiểm tra phiên và cửa hàng được cấp quyền…');
  try{
    if(!client)throw Error('AUTH_NOT_READY');
    const u=await withDeadline(client.auth.getUser(),13000);
    if(run!==epoch)return;
    const user=u.data?.user;if(u.error||!user?.id)throw Error('AUTH_REQUIRED');
    const memberships=await withDeadline(client.from('tenant_memberships').select('tenant_id,user_id,role,active')
      .eq('user_id',user.id).eq('active',true).limit(50),13000);
    if(run!==epoch)return;
    if(memberships.error)throw Error('MEMBERSHIP_UNAVAILABLE');
    const approved=approvedMemberships(memberships.data,user.id);
    if(!approved.length)throw Error('NO_ACTIVE_SHOP');
    const tenants=await withDeadline(client.from('tenants').select('id,name')
      .in('id',approved.map(x=>x.tenant_id)).limit(50),13000);
    if(run!==epoch)return;
    if(tenants.error)throw Error('TENANT_UNAVAILABLE');
    const available=scopedTenantDisplay(approved,tenants.data);
    if(!available.length)throw Error('NO_ALLOWED_SHOP');
    const oldId=currentUser?.id===user.id?selected?.id:null;
    const sameUser=currentUser?.id===user.id;
    const oldScope=JSON.stringify(shops.map(s=>[s.id,s.role,s.name]).sort((a,b)=>a[0].localeCompare(b[0])));
    const newScope=JSON.stringify(available.map(s=>[s.id,s.role,s.name]).sort((a,b)=>a[0].localeCompare(b[0])));
    if(sameUser&&oldScope===newScope&&available.some(s=>s.id===selected?.id)&&!protectedBox.hidden){
      currentUser=user;shops=available;
      message('Phiên và quyền cửa hàng vẫn hợp lệ.','ok');
      return; // Keep active tab, scroll and any unsent local UI input intact.
    }
    currentUser=user;shops=available;
    selector.replaceChildren();for(const s of shops)selector.add(new Option(s.name,s.id));
    protectedBox.hidden=false;locked.hidden=true;
    setShop(shops.find(s=>s.id===oldId)?.id||shops[0].id);
    message('Đã xác minh tài khoản và cửa hàng. Thông tin thuê bao/thanh toán chưa được kết nối.','ok');
  }catch(e){
    if(run===epoch){
      wipe();
      message(e.message==='AUTH_REQUIRED'?'Chưa có phiên đăng nhập hợp lệ.':'Không xác minh được tài khoản hoặc quyền cửa hàng. Dữ liệu vẫn bị khóa.','error');
    }
  }finally{busy=false;refreshButton.disabled=false;}
}
nav.addEventListener('click',event=>{
 const button=event.target.closest('button[data-panel]');
 if(button&&nav.contains(button)&&VIEWS[button.dataset.panel])show(button.dataset.panel,true);
});
selector.addEventListener('change',()=>setShop(selector.value));
refreshButton.addEventListener('click',refresh);
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible'&&Date.now()-lastChecked>300000)refresh();
});
logoutButton.addEventListener('click',async()=>{
 const running=client;wipe();message('Đang đăng xuất…');
 try{if(!running)throw Error('AUTH_NOT_READY');const r=await withDeadline(running.auth.signOut({scope:'local'}),13000);
  if(r.error)throw r.error;location.replace('login.html');
 }catch{message('Dữ liệu đã bị khóa, nhưng chưa xác minh được đăng xuất. Hãy thử lại.','error');}
});
try{
 client=await withDeadline(getAuthClient(),20500);
 client.auth.onAuthStateChange((event,session)=>{
  if(event==='SIGNED_OUT'){wipe();message('Đã đăng xuất.','error');}
  else if((event==='SIGNED_IN'||event==='USER_UPDATED')&&session?.user?.id!==currentUser?.id)
    setTimeout(()=>refresh(),0);
 });
 await refresh();
}catch{wipe();message('Không tải được hệ thống xác thực.','error');}
