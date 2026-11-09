(()=>{'use strict';
const prefix='tien404_demo_v3_';
const $=(q)=>document.querySelector(q);
const storage={get(k,f=null){try{return JSON.parse(sessionStorage.getItem(prefix+k))??f}catch{return f}},set(k,v){sessionStorage.setItem(prefix+k,JSON.stringify(v))},del(k){sessionStorage.removeItem(prefix+k)}};
const session=()=>storage.get('session');
const plans={starter:{name:'AI Starter',features:['Trợ lý AI theo kịch bản','Tư vấn và chuyển tiếp hội thoại','Báo cáo cơ bản']},business:{name:'AI Business',features:['Nâng cấp luồng tư vấn','Tích hợp dữ liệu theo phạm vi','Báo cáo vận hành nâng cao']},custom:{name:'Custom AI',features:['Khảo sát và thiết kế riêng','Tích hợp nhiều hệ thống','Bảo trì theo thỏa thuận']}};
const safeText=(el,value)=>{if(el)el.textContent=String(value??'')};
const moneyNote='Liên hệ báo giá · chưa có thanh toán thật';
const page=document.body.dataset.saasPage;
const out=$('[data-saas-output]');
function notify(text,success=false){if(!out)return;out.className=success?'saas-success':'saas-form-error';out.textContent=text;out.setAttribute('role','status')}
function saveSession(email,name){let user={email,name:name||email.split('@')[0],joined:new Date().toISOString(),role:'demo'};storage.set('session',user);return user}
function redirectHome(){location.href='dashboard.html'}
if(page==='login'||page==='register'){
 const form=$('#saas-auth');form?.addEventListener('submit',ev=>{ev.preventDefault();const data=new FormData(form),email=String(data.get('email')||'').trim().toLowerCase(),name=String(data.get('name')||'').trim();if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){notify('Vui lòng nhập email đúng định dạng.');return}if(page==='register'&&name.length<2){notify('Vui lòng nhập tên từ 2 ký tự.');return}saveSession(email,name);notify('Đã tạo phiên truy cập demo. Không có tài khoản thực được đăng ký.',true);setTimeout(redirectHome,220)});
}
if(page==='dashboard'||page==='billing'||page==='invoice'){
 const user=session();if(!user){location.replace('login.html?next='+encodeURIComponent(location.pathname.split('/').pop()));}else{document.querySelectorAll('[data-user-name]').forEach(el=>safeText(el,user.name));document.querySelectorAll('[data-user-email]').forEach(el=>safeText(el,user.email));const sub=storage.get('subscription');document.querySelectorAll('[data-user-plan]').forEach(el=>safeText(el,sub?.name||'Chưa chọn gói'));document.querySelectorAll('[data-user-status]').forEach(el=>safeText(el,sub?'Đang trải nghiệm mô phỏng':'Chưa có hợp đồng'));if(page==='invoice'){const inv=storage.get('invoice');safeText($('#invoice-id'),inv?.id||'Chưa có hóa đơn demo');safeText($('#invoice-plan'),inv?.plan||'Chưa chọn gói');safeText($('#invoice-date'),inv?.date||'—');safeText($('#invoice-status'),inv?'Mô phỏng – chưa thanh toán':'Chưa phát sinh');}if(page==='billing'){$('#cancel-demo')?.addEventListener('click',()=>{storage.del('subscription');storage.del('invoice');location.reload()})}}
}
$('#sign-out')?.addEventListener('click',()=>{storage.del('session');location.href='login.html'});
if(page==='checkout'){
 let p=new URLSearchParams(location.search).get('plan');if(!plans[p])p='starter';
 function render(){const el=$('#checkout-plan');let plan=plans[p];safeText(el,plan.name);safeText($('#checkout-features'),plan.features.join(' · '));const radio=$(`input[name="plan"][value="${p}"]`);if(radio)radio.checked=true;}
 document.querySelectorAll('input[name="plan"]').forEach(el=>el.addEventListener('change',()=>{p=el.value;history.replaceState({},'',`checkout.html?plan=${p}`);render()}));render();
 const u=session();if(u){const email=$('#checkout-email'),name=$('#checkout-name');if(email)email.value=u.email;if(name)name.value=u.name}
 $('#checkout-form')?.addEventListener('submit',e=>{e.preventDefault();const f=e.currentTarget,d=new FormData(f);let email=String(d.get('email')||'').trim(),name=String(d.get('name')||'').trim();if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)||name.length<2){notify('Vui lòng điền tên và email hợp lệ.');return}if(!f.querySelector('[name="terms"]').checked){notify('Bạn cần xác nhận đây chỉ là trải nghiệm mô phỏng.');return}
 saveSession(email,name);let sub={key:p,name:plans[p].name,created:new Date().toISOString(),status:'simulated'};storage.set('subscription',sub);let invoice={id:'DEMO-'+new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+Math.floor(Math.random()*900+100),plan:sub.name,date:new Date().toLocaleDateString('vi-VN')};storage.set('invoice',invoice);notify('Đã hoàn thành quy trình đặt gói mô phỏng. Không có giao dịch hoặc thu tiền thật.',true);setTimeout(()=>location.href='invoice.html',350);
 });
}
})();