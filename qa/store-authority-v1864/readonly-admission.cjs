'use strict';
/**
 * TIEN404 V18.6.4: synthetic contract ONLY. No HTTP, OAuth, Supabase, n8n or Meta access.
 * This class DOES NOT verify real JWT signatures or replace trusted server Auth/RLS.
 * Session resolver and membership repository are controlled exclusively by the backend.
 */
const FLAGS = Object.freeze({
  mode: 'SYNTHETIC_QA', metaLiveApi: false, providerSend: false,
  orderWrite: false, allowPrivateOrderRead: false,
});
const OPERATIONS = Object.freeze(['authority.readonly.check', 'channel.connection.preview']);
const err = (code) => Object.assign(new Error(code), {code});
const safeKey = v => typeof v === 'string' && /^[a-z][a-z0-9_-]{1,62}$/.test(v);
const forbidden = new Set([
  'tenantId', 'tenant_id', 'storeId', 'store_id', 'principalId', 'userId',
  'role', 'isAdmin', 'verified', 'jwt', 'accessToken', 'access_token',
  'pageToken', 'page_token', 'secret', 'secretRef', 'session', 'sessionId',
  'orderId', 'order_id', 'accountId', 'account_id', 'authorization',
]);
function rejectClientPayload(payload) {
  if (payload === null || payload === undefined) return;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw err('UNEXPECTED_CLIENT_PAYLOAD');
  if (Object.keys(payload).length !== 0) {
    if (Object.keys(payload).some(key => forbidden.has(key))) throw err('CLIENT_AUTHORITY_FORBIDDEN');
    throw err('UNEXPECTED_CLIENT_PAYLOAD');
  }
}
function createReadOnlyAdmission({resolveVerifiedSession, readStoreMembership, readPageConnection, now = Date.now} = {}) {
  if (![resolveVerifiedSession, readStoreMembership, readPageConnection].every(x=>typeof x==='function')) throw err('BACKEND_DEPENDENCIES_REQUIRED');
  const counters = {externalCalls:0, providerSends:0, orderWrites:0};
  return Object.freeze({
    flags: FLAGS,
    getMetrics: () => Object.freeze({...counters}),
    async inspect({serverSessionHandle, selectedStoreKey, operation, pageId, clientBody} = {}) {
      rejectClientPayload(clientBody);
      if (!OPERATIONS.includes(operation)) throw err('READONLY_OPERATION_REQUIRED');
      if (!safeKey(selectedStoreKey)) throw err('STORE_SELECTOR_INVALID');
      if (typeof serverSessionHandle !== 'string' || !/^qa-session-[a-z0-9-]{2,48}$/.test(serverSessionHandle)) throw err('SERVER_SESSION_REQUIRED');
      if (operation === 'channel.connection.preview' && !safeKey(pageId)) throw err('PAGE_SELECTOR_INVALID');
      if (operation !== 'channel.connection.preview' && pageId !== undefined) throw err('PAGE_NOT_ALLOWED_FOR_OPERATION');
      const session = await resolveVerifiedSession(serverSessionHandle);
      if (!session || session.verificationSource !== 'backend_authoritative' ||
          session.audience !== 'tien404-synthetic-gateway' || session.issuer !== 'synthetic-qa-issuer' ||
          session.status !== 'active' || !safeKey(session.subject) ||
          typeof session.sessionId !== 'string' || !session.sessionId.length ||
          !Number.isSafeInteger(session.expiresAtMs) || session.expiresAtMs <= now()) {
        throw err('SESSION_AUTHORITY_DENIED');
      }
      // Store choice is untrusted UI selection, NEVER authorization evidence.
      const membership = await readStoreMembership(session.subject, selectedStoreKey);
      if (!membership || membership.subject !== session.subject || membership.storeKey !== selectedStoreKey ||
          !safeKey(membership.tenantKey) || !safeKey(membership.storeKey) ||
          !membership.active || membership.storeStatus !== 'active' ||
          !['owner','manager'].includes(membership.role)) throw err('STORE_AUTHORITY_DENIED');
      if (operation === 'channel.connection.preview') {
        const page = await readPageConnection(pageId);
        if (!page || page.pageKey !== pageId || page.platform !== 'messenger' ||
            page.tenantKey !== membership.tenantKey || page.storeKey !== membership.storeKey ||
            page.status !== 'connected' || page.qa !== 'SYNTHETIC_QA') throw err('PAGE_AUTHORITY_DENIED');
      }
      // For internal synthetic QA only. A real HTTP endpoint must not expose tenant/store authority records.
      return Object.freeze({decision:'READ_ONLY_ALLOWED',operation,qa:'SYNTHETIC_QA',
        selectedStoreKey,canReadOrders:false,canWriteOrders:false,canSend:false});
    },
  });
}
module.exports = {FLAGS, OPERATIONS, createReadOnlyAdmission};
