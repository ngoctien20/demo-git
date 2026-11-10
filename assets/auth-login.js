/* TIEN404 Supabase Auth staging login: no demo bypass, secrets or tenant authorization in client code. */
const form=document.getElementById('auth-login');
const state=document.getElementById('auth-status');
const submit=document.getElementById('auth-submit');
const put=(message,kind='info')=>{state.textContent=message;state.dataset.state=kind};
let client=null;
try{
 const module=await import('./auth-client.js');
 client=module.authClient;
 const {data,error}=await client.auth.getUser();
 if(!error && data?.user){
   location.replace('account.html');
 } else {
   put('Đăng nhập bằng tài khoản staging đã được cấp phép.');
 }
}catch(e){put('Không tải được dịch vụ đăng nhập. Vui lòng thử lại sau.','error')}
form?.addEventListener('submit',async event=>{
 event.preventDefault();
 if(!client){put('Dịch vụ đăng nhập chưa sẵn sàng.','error');return}
 const email=String(form.elements.email?.value||'').trim();
 const password=String(form.elements.password?.value||'');
 if(!email || !form.elements.email.checkValidity() || password.length<8){
   put('Kiểm tra lại email và mật khẩu (tối thiểu 8 ký tự).','error');return;
 }
 submit.disabled=true;put('Đang xác thực với Supabase...');
 try{
  const {data,error}=await client.auth.signInWithPassword({email,password});
  if(error || !data?.user || !data?.session){
   put(error?.code==='email_not_confirmed'?'Email này chưa được xác minh. Hãy kiểm tra email xác nhận.':'Email hoặc mật khẩu chưa đúng, hoặc tài khoản chưa được cấp phép.','error');
   return;
  }
  password='';
  form.elements.password.value='';
  put('Xác thực thành công. Đang mở cổng tài khoản...','ok');
  location.replace('account.html');
 }catch(e){put('Không thể kết nối máy chủ xác thực. Vui lòng thử lại.','error')}
 finally{submit.disabled=false}
});
