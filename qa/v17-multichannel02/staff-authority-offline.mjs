// TIEN404 V17.MULTI-CHANNEL-02 — private Staff Authority preflight, SOURCE-ONLY.
// NO Supabase API calls, Graph calls, JWT decoding on client, DB writes or token issues.
// A positive result authorizes ONLY this synthetic offline QA preview, never customer data.
const MODE = 'OFFLINE_SYNTHETIC_STAFF_PREVIEW';
const ACTIONS = new Set(['INBOX_READ', 'INBOX_ASSIGN', 'HANDOFF_ACCEPT', 'BOT_RESUME']);
const ID = /^[a-zA-Z0-9_.:-]{2,128}$/;
const validId = x => typeof x === 'string' && ID.test(x);
const CHANNELS = new Set(['messenger','zalo_oa','zalo_bot','website_widget']);
const denied = reason => Object.freeze({
  previewAllowed: false, reason, authRealVerified: false, storeRlsVerified: false,
  noSend: true, canReadHostedInbox: false, canActivateHandoff: false,
  customerDataExposed: false, permissionChanged: false
});

/**
 * Dependencies MUST be private backend ports in any future hosted design.
 * Offline fixtures use these interfaces but can NEVER establish real authority:
 * - verifySupabaseSession({proof}) -> server-verified user + unrevoked session
 * - resolveInstallation({bindingId}) -> server-only Tenant/Store/Page binding
 * - readMerchantMembership({userId,tenantId,storeId}) -> canonical Owner/Manager
 * - readCommercialStaffAssignment({userId,tenantId,storeId}) -> Store Staff
 * - verifyPageInboxAccess({userId,pageRef,appRef}) -> provider-verified permission
 *
 * Never use public tester_staff, user_metadata, client role claims, or synthetic
 * G0.5 registry to mint production Merchant/Staff authority.
 */
export async function inspectStaffPreview(request, deps) {
  if (!deps || deps.executionMode !== MODE || deps.hostedAccessEnabled !== false ||
    !['verifySupabaseSession','resolveInstallation','readMerchantMembership',
      'readCommercialStaffAssignment','verifyPageInboxAccess']
      .every(k => typeof deps[k] === 'function')) return denied('OFFLINE_ONLY_BACKEND_PORTS_REQUIRED');
  if (!request || !validId(request.bindingId) ||
      !validId(request.storeId) || !validId(request.sessionProof) ||
      !ACTIONS.has(request.action)) return denied('INVALID_PREVIEW_REQUEST');
  const now = deps.nowMs ?? Date.now();
  if (!Number.isSafeInteger(now) || now <= 0) return denied('INVALID_CLOCK');
  let auth, install;
  try {
    auth = await deps.verifySupabaseSession({proof: request.sessionProof});
    install = await deps.resolveInstallation({bindingId: request.bindingId});
  } catch { return denied('AUTH_OR_REGISTRY_UNAVAILABLE'); }
  if (!auth || auth.source !== 'QA_SYNTHETIC_SUPABASE_AUTH' ||
      auth.verified !== true || auth.revoked !== false ||
      auth.isAnonymous !== false || !validId(auth.userId) ||
      !validId(auth.sessionId) || !Number.isSafeInteger(auth.expiresAtMs) ||
      auth.expiresAtMs <= now) return denied('SESSION_UNTRUSTED_OR_EXPIRED');
  if (!install || install.source !== 'QA_SYNTHETIC_TRUSTED_INSTALLATION' ||
      install.status !== 'active' || install.subscriptionActive !== true ||
      !CHANNELS.has(install.channel) ||
      !validId(install.tenantId) || !validId(install.storeId) ||
      !validId(install.bindingId) ||
      install.storeId !== request.storeId ||
      install.bindingId !== request.bindingId)
    return denied('STORE_INSTALLATION_SCOPE_DENIED');
  let merchant, staff;
  try {
    merchant = await deps.readMerchantMembership({
      userId: auth.userId, tenantId: install.tenantId, storeId: install.storeId
    });
    staff = await deps.readCommercialStaffAssignment({
      userId: auth.userId, tenantId: install.tenantId, storeId: install.storeId
    });
  } catch { return denied('STAFF_MEMBERSHIP_UNAVAILABLE'); }
  const basicScope = m => m && m.userId === auth.userId &&
    m.tenantId === install.tenantId && m.storeId === install.storeId &&
    m.active === true && m.revoked !== true;
  let role = null;
  let actionAllowed = false;
  const merchantValid = basicScope(merchant) &&
    merchant.source === 'QA_SYNTHETIC_MERCHANT_MEMBERSHIP' &&
    ['OWNER','MANAGER'].includes(merchant.role) &&
    Number.isSafeInteger(merchant.expiresAtMs) && merchant.expiresAtMs > now &&
    Array.isArray(merchant.permissions) && merchant.permissions.includes(request.action);
  const staffValid = basicScope(staff) &&
    staff.source === 'QA_SYNTHETIC_COMMERCIAL_STAFF_ASSIGNMENT' &&
    staff.role === 'STAFF' &&
    Number.isSafeInteger(staff.expiresAtMs) && staff.expiresAtMs > now &&
    Number.isSafeInteger(staff.assignmentVersion) && staff.assignmentVersion > 0 &&
    Array.isArray(staff.permissions) && staff.permissions.includes(request.action);
  if (merchantValid) { role = merchant.role; actionAllowed = true; }
  else if (staffValid) { role = 'STAFF'; actionAllowed = true; }
  if (!actionAllowed) return denied('NO_CANONICAL_COMMERCIAL_STORE_PERMISSION');

  if (install.channel === 'messenger' && request.action !== 'INBOX_READ') {
    if (!validId(install.pageRef) || !validId(install.appRef))
      return denied('META_PAGE_BINDING_MISSING');
    let providerRole;
    try {
      providerRole = await deps.verifyPageInboxAccess({
        userId: auth.userId, pageRef: install.pageRef, appRef: install.appRef
      });
    } catch { return denied('META_PAGE_PERMISSION_UNAVAILABLE'); }
    if (!providerRole || providerRole.source !== 'QA_SYNTHETIC_META_PAGE_ACCESS' ||
        providerRole.verified !== true || providerRole.granted !== true ||
        providerRole.userId !== auth.userId ||
        providerRole.pageRef !== install.pageRef || providerRole.appRef !== install.appRef ||
        !Number.isSafeInteger(providerRole.expiresAtMs) ||
        providerRole.expiresAtMs <= now)
      return denied('META_PAGE_INBOX_AUTHORITY_DENIED');
  }
  // This deliberately CANNOT be fed to production handoff planner as
  // TRUSTED_AUTHORIZATION — no live sessions, Page or Store RLS were verified.
  return Object.freeze({
    previewAllowed: true, reason: 'QA_SYNTHETIC_PREVIEW_ONLY',
    source: 'QA_SYNTHETIC_STAFF_PREVIEW', role,
    userId: auth.userId, tenantId: install.tenantId,
    storeId: install.storeId, bindingId: install.bindingId, channel: install.channel,
    action: request.action, expiresAtMs: Math.min(auth.expiresAtMs,
      merchantValid ? merchant.expiresAtMs : staff.expiresAtMs),
    authRealVerified: false, storeRlsVerified: false,
    canReadHostedInbox: false, canActivateHandoff: false,
    noSend: true, customerDataExposed: false, permissionChanged: false
  });
}
