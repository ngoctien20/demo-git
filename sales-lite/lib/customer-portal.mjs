// Read adapter for the existing Sales Lite service. Only the configured Supabase project verifies sessions.
import { dashboardEvents, reject } from './protocol.mjs';

const issuer = 'https://ifxlvrhyjhbzbrkdsida.supabase.co';
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export function customerPortal({ publishableKey, routes, key, fetchUser = fetch }) {
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey) || !Array.isArray(routes))
    throw Error('Staging publishable key and scoped routes required');
  const byTenant = new Map();
  for (const route of routes) {
    if (!uuid.test(route.authTenant) || byTenant.has(route.authTenant)) throw Error('Ambiguous tenant mapping');
    byTenant.set(route.authTenant, Object.freeze({...route}));
  }
  return async function read(req, url, service) {
    if (req.method !== 'GET') return [405, {error:'READ_ONLY'}];
    const params = url.searchParams, tenantId = params.get('shop'), tab = params.get('tab');
    if (![...params.keys()].every(k => ['shop','tab','period','before'].includes(k) && params.getAll(k).length === 1) ||
        !uuid.test(tenantId) || !['new','orders','revenue'].includes(tab)) return [400,{error:'BAD_REQUEST'}];
    const header = req.headers.authorization || '';
    if (!/^Bearer [A-Za-z0-9._-]{20,4096}$/.test(header)) return [401,{error:'SIGN_IN_REQUIRED'}];
    const auth = await fetchUser(issuer + '/auth/v1/user', {headers:{apikey:publishableKey,Authorization:header},
      redirect:'error',cache:'no-store',signal:AbortSignal.timeout(6000)});
    if ([401,403].includes(auth.status)) return [401,{error:'SIGN_IN_REQUIRED'}];
    if (!auth.ok) throw Error('Auth unavailable');
    const user = await auth.json(), scope = byTenant.get(tenantId);
    if (!uuid.test(user.id)) return [401,{error:'SIGN_IN_REQUIRED'}];
    if (!scope) reject('OWNER_REQUIRED');
    const makeEvent = dashboardEvents(scope, user.id, key);
    const view = await service.dashboard(makeEvent('/baocao'), {tab,period:params.get('period') || 'today',
      before:params.get('before')});
    return [200,{version:'customer-view.v1',tenant_id:tenantId,origin:'synthetic_qa',...view}];
  };
}
