/* TIEN404 Supabase staging Auth. No demo bypass and no tenant or admin grants. */
import { normalizeEmail, isAcceptablePassword, isNewPasswordStrong,
  friendlyAuthError, containsRecoverySignal } from './auth-helpers.mjs';
import {withDeadline, isTimeout} from './auth-runtime.mjs';

const loginForm = document.getElementById('auth-login');
const requestForm = document.getElementById('auth-recovery-request');
const updateForm = document.getElementById('auth-password-update');
const state = document.getElementById('auth-status');
const heading = document.getElementById('auth-title');
const switchRecovery = document.getElementById('auth-forgot-password');
const back = document.getElementById('auth-return-login');
const goAccount = document.getElementById('auth-go-account');

let client = null;
let inRecovery = containsRecoverySignal(location.search, location.hash);
let busy = false;

const put = (message, kind = 'info') => {
  state.textContent = message;
  state.dataset.state = kind;
};
const showMode = mode => {
  loginForm.hidden = mode !== 'login';
  requestForm.hidden = mode !== 'request';
  updateForm.hidden = mode !== 'update';
  switchRecovery.hidden = mode !== 'login';
  back.hidden = mode === 'login' || mode === 'update';
  goAccount.hidden = mode !== 'signed-in';
  heading.textContent = ({
    login: 'Đăng nhập', request: 'Khôi phục mật khẩu',
    update: 'Đặt mật khẩu mới', 'signed-in': 'Đã xác thực'
  })[mode] || 'Đăng nhập';
  if (mode === 'update') inRecovery = true;
};
const withBusy = async (form, action) => {
  if (busy) return;
  busy = true;
  const button = form?.querySelector('button[type="submit"]');
  if (button) button.disabled = true;
  try { await action(); } finally {
    busy = false;
    if (button) button.disabled = false;
  }
};

showMode('login');
if (inRecovery) {
  put('Đang xác minh liên kết khôi phục mật khẩu...');
  // Redirect processing happens in the SDK. Avoid navigating to the account page.
}
try {
  const module = await import('./auth-client.js');
  client = await withDeadline(module.getAuthClient(), 20500);
  window.dispatchEvent(new Event('tien404:auth-ready'));
  put('Đang kiểm tra phiên đăng nhập...');
  // Register before reading the session: a recovery callback may otherwise be missed.
  client.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') {
      showMode('update');
      put('Liên kết khôi phục hợp lệ. Hãy đặt mật khẩu mới.','ok');
    }
    if (event === 'SIGNED_OUT' && !inRecovery) {
      showMode('login');
    }
  });

  const { data, error } = await withDeadline(client.auth.getUser(), 13000);
  if (!error && data?.user && !inRecovery) {
    showMode('signed-in');
    put('Tài khoản đã đăng nhập. Mở cổng tài khoản để tiếp tục.','ok');
  } else if (!inRecovery) {
    put('Đăng nhập bằng tài khoản staging đã được cấp quyền.');
  } else if (updateForm.hidden) {
    // If the callback URL contains a PKCE code, allow SDK exchange and event to settle.
    // Do not claim recovery success until PASSWORD_RECOVERY fires.
    put('Đang xử lý liên kết khôi phục. Nếu không xuất hiện biểu mẫu đổi mật khẩu, hãy yêu cầu liên kết mới.');
  }
} catch (error) {
  window.dispatchEvent(new Event('tien404:auth-error'));
  put(isTimeout(error) ? 'Kết nối đăng nhập quá lâu. Vui lòng thử tải lại trang hoặc đổi mạng.' : 'Không tải được dịch vụ xác thực. Vui lòng thử lại.','error');
  const retry=document.getElementById('auth-retry');
  if(retry) retry.hidden=false;
}

loginForm.addEventListener('submit',event => {
  event.preventDefault();
  if (!client) { put('Dịch vụ xác thực chưa sẵn sàng.','error'); return; }
  const email = normalizeEmail(loginForm.elements.email.value);
  const password = String(loginForm.elements.password.value || '');
  if (!loginForm.elements.email.checkValidity() || !email || !isAcceptablePassword(password)) {
    put('Nhập email hợp lệ và mật khẩu tối thiểu 8 ký tự.','error'); return;
  }
  withBusy(loginForm,async()=>{
    put('Đang xác thực...');
    try {
      const {data,error} = await withDeadline(client.auth.signInWithPassword({email,password}),16000);
      if (error || !data?.user || !data?.session) {
        put(friendlyAuthError(error),'error');return;
      }
      loginForm.elements.password.value = '';
      put('Đăng nhập thành công. Đang chuyển vào tài khoản...','ok');
      location.replace('account.html');
    } catch (error) {
      put(isTimeout(error) ? 'Yêu cầu đăng nhập quá lâu. Hãy kiểm tra kết nối rồi thử lại.' : 'Không kết nối được dịch vụ xác thực. Hãy thử lại.','error');
    }
  });
});

switchRecovery.addEventListener('click',()=>{
  if (busy) return;
  showMode('request');
  put('Nhập email tài khoản staging để nhận liên kết đặt lại mật khẩu.');
});
back.addEventListener('click',()=>{
  if (busy) return;
  showMode('login');
  put('Bạn có thể đăng nhập bằng mật khẩu hiện tại.');
});
requestForm.addEventListener('submit', event=>{
  event.preventDefault();
  if (!client) {put('Dịch vụ xác thực chưa sẵn sàng.','error');return}
  const email = normalizeEmail(requestForm.elements.email.value);
  if (!email || !requestForm.elements.email.checkValidity()) {
    put('Vui lòng nhập email hợp lệ.','error');return;
  }
  withBusy(requestForm, async()=>{
    put('Đang gửi yêu cầu...');
    try {
      // Use the already-allowlisted exact login.html URL. No wildcard required.
      const redirectTo = new URL('login.html',location.href).toString();
      const { error } = await withDeadline(client.auth.resetPasswordForEmail(email,{redirectTo}),16000);
      if (error && ['over_request_rate_limit','over_email_send_rate_limit'].includes(error.code)) {
        put('Quá nhiều yêu cầu. Hãy thử lại sau.','error');
      } else {
        // Never reveal whether an email is registered.
        put('Nếu email thuộc tài khoản hợp lệ, hướng dẫn khôi phục sẽ được gửi đến hộp thư.','ok');
      }
    } catch {
      put('Không gửi được yêu cầu. Hãy thử lại sau.','error');
    }
  });
});
updateForm.addEventListener('submit',event=>{
  event.preventDefault();
  if (!client || !inRecovery) {
    put('Phiên khôi phục không hợp lệ. Hãy yêu cầu liên kết mới.','error');return;
  }
  const password = String(updateForm.elements.password.value||'');
  const confirm = String(updateForm.elements.confirm.value||'');
  if (!isNewPasswordStrong(password) || password!==confirm) {
    put('Mật khẩu mới cần ít nhất 12 ký tự và hai lần nhập phải trùng nhau.','error');return;
  }
  withBusy(updateForm,async()=>{
    try {
      const { data, error } = await withDeadline(client.auth.getUser(),13000);
      if (error || !data?.user) {
        put('Liên kết đã hết hạn hoặc phiên xác thực không hợp lệ.','error');return;
      }
      const result = await withDeadline(client.auth.updateUser({password}),16000);
      if (result.error) {put(friendlyAuthError(result.error),'error');return}
      updateForm.reset();
      await withDeadline(client.auth.signOut(),13000);
      inRecovery = false;
      // Clear any code or recovery tokens from browser URL without persisting them.
      history.replaceState(null,'',location.pathname);
      showMode('login');
      put('Đã cập nhật mật khẩu. Hãy đăng nhập lại.','ok');
    } catch {
      put('Không cập nhật được mật khẩu. Hãy thử lại.','error');
    }
  });
});
