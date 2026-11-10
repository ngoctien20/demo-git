/* No third-party dependencies: prevent indefinite "connecting" message even
 * when JavaScript module loading is blocked by a mobile browser or DNS. */
(() => {
  const start = () => {
    const status = document.getElementById('auth-status');
    const retry = document.getElementById('auth-retry');
    if (!status || !retry) return;
    let moduleReady = false;
    const setReady = () => { moduleReady = true; retry.hidden = true; };
    window.addEventListener('tien404:auth-ready', setReady, {once:true});
    window.addEventListener('tien404:auth-error', setReady, {once:true});
    retry.addEventListener('click', () => window.location.reload());
    setTimeout(() => {
      if (!moduleReady && status.textContent.includes('Đang kết nối')) {
        status.textContent = 'Đang tải dịch vụ xác thực. Kết nối có vẻ chậm; hãy kiểm tra mạng.';
      }
    }, 7500);
    setTimeout(() => {
      if (!moduleReady) {
        status.textContent = 'Không tải được dịch vụ đăng nhập. Hãy thử tải lại trang hoặc đổi mạng.';
        status.dataset.state = 'error';
        retry.hidden = false;
      }
    }, 23000);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
