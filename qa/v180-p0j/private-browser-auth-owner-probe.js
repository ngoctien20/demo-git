// TIEN404 V18.0-P0J — private, browser-local Auth evidence check.
// USAGE: copy this entire IIFE into the DevTools Console of the already signed-in
// https://tien404-auth-staging.onrender.com/account.html page.
// Run in two separate browser profiles, using the SAME one-time nonce.
// Do not paste any codes, JWT, user IDs, session IDs or email into chat/GitHub.
// This is NOT a signed server attestation or Store A/B authorization.
(async () => {
  'use strict';
  const TAG = 'TIEN404_P0J_LOCAL';
  const ORIGIN = 'https://tien404-auth-staging.onrender.com';
  const ISSUER = 'https://ifxlvrhyjhbzbrkdsida.supabase.co/auth/v1';
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const show = data => console.info(TAG, data);
  const blocked = reason => show({
    status: 'BLOCKED', reason, localAuthReadOnly: true,
    realServerSessionProven: false, storeOwnerVerified: false,
    canMigrate: false, canSend: false
  });

  try {
    if (location.origin !== ORIGIN ||
        !location.pathname.endsWith('/account.html')) {
      return blocked('UNTRUSTED_ORIGIN_OR_NOT_ACCOUNT_PAGE');
    }
    if (!confirm('Chỉ kiểm tra Auth và quyền owner của tài khoản QA này? Không gửi tin/đặt đơn/đổi quyền.')) {
      return blocked('OPERATOR_CONSENT_NOT_GRANTED');
    }
    if (!globalThis.crypto?.subtle || typeof crypto.randomUUID !== 'function') {
      return blocked('SECURE_BROWSER_CRYPTO_UNAVAILABLE');
    }
    const typed = prompt(
      'Nhập cùng một mã UUID tạm thời cho cả hai cửa sổ QA.\n' +
      'Ở cửa sổ A, để trống để tạo mã. Ở B, dán mã vừa tạo ở A.', ''
    );
    if (typed === null) return blocked('OPERATOR_CANCELLED');
    const sharedNonce = typed.trim() === '' ? crypto.randomUUID() : typed.trim();
    if (!UUID.test(sharedNonce)) return blocked('INVALID_ONE_TIME_NONCE');

    // This is the SAME signed-in Supabase client already shipped with the
    // verified Render Auth staging source. No new credentials or remote hosts.
    const { getAuthClient } = await import('/assets/auth-client.js');
    const sb = await getAuthClient();
    const userResp = await sb.auth.getUser();
    const uid = userResp?.data?.user?.id;
    if (userResp?.error || !UUID.test(uid || '') ||
        userResp.data.user.is_anonymous === true) {
      return blocked('AUTH_GETUSER_FAILED');
    }
    const claimResp = await sb.auth.getClaims();
    const c = claimResp?.data?.claims;
    const current = Math.floor(Date.now() / 1000);
    const validAudience = c?.aud === 'authenticated' ||
      (Array.isArray(c?.aud) && c.aud.includes('authenticated'));
    if (claimResp?.error || !c || c.iss !== ISSUER ||
        !validAudience || c.role !== 'authenticated' ||
        c.sub !== uid || !UUID.test(c.session_id || '') ||
        !Number.isFinite(c.exp) || c.exp <= current ||
        !Number.isFinite(c.iat) || c.iat > current + 60) {
      return blocked('AUTH_GETCLAIMS_SCOPE_FAILED');
    }
    // SELECT only, subject-filtered; database RLS is still the authority.
    const memberResp = await sb.from('tenant_memberships')
      .select('tenant_id,role,active')
      .eq('user_id', uid).eq('active', true).limit(50);
    if (memberResp.error || !Array.isArray(memberResp.data)) {
      return blocked('OWNER_MEMBERSHIP_RLS_READ_FAILED');
    }
    const ownerTenantIds = [...new Set(memberResp.data
      .filter(m => m.active === true && m.role === 'owner' &&
        UUID.test(m.tenant_id || ''))
      .map(m => m.tenant_id))];
    if (!ownerTenantIds.length || ownerTenantIds.length > 10) {
      return blocked('NO_SCOPED_TENANT_OWNER_MEMBERSHIP');
    }
    // One-time HMAC fingerprints allow only LOCAL A/B comparison.
    // No user_id, tenant_id, JWT, session_id or email enters output.
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(sharedNonce),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const fingerprint = async input => {
      const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(input));
      return Array.from(new Uint8Array(digest).slice(0, 20))
        .map(x => x.toString(16).padStart(2, '0')).join('');
    };
    const actorFingerprint = await fingerprint('QA_ACTOR:' + uid);
    const tenantFingerprints = (await Promise.all(ownerTenantIds
      .map(t => fingerprint('QA_TENANT_OWNER:' + t)))).sort();
    show({
      status: 'LOCAL_AUTH_AND_TENANT_OWNER_READ_OK',
      oneTimeNonce: sharedNonce,
      actorFingerprint,
      tenantOwnerFingerprints: tenantFingerprints,
      verifiedUsing: ['auth.getUser','auth.getClaims','RLS_SELECT_tenant_memberships'],
      onlyCompareLocally: true,
      serverSessionRevocationVerified: false,
      canonicalStoreMembershipVerified: false,
      crossStoreUatExecuted: false,
      canMigrate: false, canSend: false, canPublish: false
    });
  } catch {
    // Deliberately never log errors which may contain Auth client or token details.
    blocked('AUTH_CLIENT_OR_NETWORK_UNAVAILABLE');
  }
})();
