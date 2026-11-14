/* TIEN404 V12.2 — source-ready, gated Supabase signup for staging only.
 * Disabled until approved Auth redirect allowlist, email verification and abuse controls.
 * Never auto-creates shops, memberships, role claims or paid subscriptions.
 */
import {getAuthClient} from './auth-client.js';
import {normalizeEmail,isNewPasswordStrong} from './auth-helpers.mjs';
import {withDeadline} from './auth-runtime.mjs';

export const MERCHANT_SELF_SIGNUP_ENABLED=false; // RELEASE GATE: must be explicitly approved.
const form=document.getElementById('mp-register-form');
const button=document.getElementById('mp-register-submit');
const status=document.getElementById('mp-register-notice');
let busy=false;
if(!MERCHANT_SELF_SIGNUP_ENABLED){
  // Do not invite users to type credentials into a form that is not accepting registrations.
  for(const field of form.elements)field.disabled=true;
}
if(MERCHANT_SELF_SIGNUP_ENABLED){
  button.disabled=false;
  button.textContent='Tạo tài khoản staging';
  status.textContent='Đăng ký yêu cầu xác nhận email; tài khoản chỉ được dùng sau khi được cấp quyền cửa hàng.';
}
function setStatus(text,tone='info'){
  status.textContent=text;
  status.dataset.tone=tone;
}
form.addEventListener('submit',async event=>{
  event.preventDefault();
  // Deny by default. No network, email or Auth account created while the gate is closed.
  if(!MERCHANT_SELF_SIGNUP_ENABLED||busy){
    setStatus('Chức năng đăng ký chưa mở. Vui lòng liên hệ TIEN404 để được cấp quyền thử nghiệm.','error');
    return;
  }
  const name=String(form.elements.display_name.value||'').trim();
  const store=String(form.elements.store_name.value||'').trim();
  const email=normalizeEmail(form.elements.email.value);
  const pass=String(form.elements.password.value||'');
  const again=String(form.elements.password_confirm.value||'');
  if(name.length<2||name.length>80||store.length<2||store.length>120||
    !form.elements.email.checkValidity()||!email||!isNewPasswordStrong(pass)||
    pass!==again||!form.elements.terms.checked){
    setStatus('Kiểm tra tên, email, điều khoản và mật khẩu tối thiểu 12 ký tự.','error');
    return;
  }
  busy=true;button.disabled=true;
  setStatus('Đang yêu cầu tạo tài khoản…');
  try{
    const sb=await withDeadline(getAuthClient(),13000);
    // Not enabled until the exact staging URL is allowlisted in Supabase Auth settings.
    const emailRedirectTo=new URL('login.html',location.href).toString();
    const {error}=await withDeadline(sb.auth.signUp({
      email,password:pass,options:{
        emailRedirectTo,
        data:{display_name:name,requested_store_name:store}
      }
    }),20000);
    if(error)throw error;
    form.elements.password.value='';
    form.elements.password_confirm.value='';
    setStatus('Nếu email hợp lệ, hãy kiểm tra thư xác nhận. Tài khoản mới chưa có quyền cửa hàng và không được truy cập dữ liệu shop.','ok');
  }catch{
    setStatus('Không hoàn tất được đăng ký thử nghiệm. Vui lòng kiểm tra lại hoặc liên hệ TIEN404.','error');
  }finally{
    busy=false;button.disabled=!MERCHANT_SELF_SIGNUP_ENABLED;
  }
});
