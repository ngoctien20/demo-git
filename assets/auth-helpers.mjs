// TIEN404 Supabase staging login: pure helpers only.
// These checks improve UX, never replace Supabase Auth, RLS or server-side authorization.
export function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}
export function isAcceptablePassword(value) {
  return typeof value === 'string' && value.length >= 8 && value.length <= 256;
}
export function isNewPasswordStrong(value) {
  return typeof value === 'string' && value.length >= 12 && value.length <= 256;
}
export function approvedMemberships(rows, expectedUserId) {
  if (!Array.isArray(rows) || !expectedUserId) return [];
  const seen = new Set();
  const permitted = new Set(['owner','manager','staff']);
  return rows.filter(row => {
    if (!row || row.user_id !== expectedUserId || row.active !== true ||
        !permitted.has(row.role) || typeof row.tenant_id !== 'string' ||
        seen.has(row.tenant_id)) return false;
    seen.add(row.tenant_id);
    return true;
  });
}
export function scopedTenantDisplay(memberships, visibleTenants) {
  if (!Array.isArray(memberships) || !Array.isArray(visibleTenants)) return [];
  const match = new Map(memberships.map(m => [m.tenant_id,m.role]));
  return visibleTenants.filter(t => t && match.has(t.id))
    .map(t => ({ id:t.id, name:String(t.name||'Cửa hàng staging'), role:match.get(t.id) }));
}
export function friendlyAuthError(error) {
  const code = String(error?.code || '').toLowerCase();
  if (code === 'email_not_confirmed') return 'Email chưa xác nhận. Hãy kiểm tra email hoặc liên hệ quản trị viên.';
  if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit') return 'Quá nhiều yêu cầu. Hãy thử lại sau.';
  if (code === 'weak_password') return 'Mật khẩu chưa đạt yêu cầu bảo mật.';
  return 'Không thể xác thực. Kiểm tra email, mật khẩu và quyền truy cập staging.';
}
export function containsRecoverySignal(search,hash) {
  const query = new URLSearchParams(String(search||'').replace(/^\?/,''));
  const fragment = new URLSearchParams(String(hash||'').replace(/^#/,''));
  return query.get('type') === 'recovery' || fragment.get('type') === 'recovery';
}
