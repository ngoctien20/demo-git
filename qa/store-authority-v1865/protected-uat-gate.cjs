'use strict';
/**
 * V18.6.5 PROTECTED OWNER A/B UAT CONTRACT — SYNTHETIC ONLY.
 * This is a pure decision engine. NOT an HTTP endpoint, Supabase Auth verifier,
 * JWT verifier, Cloudflare Access verifier, RPC caller, or real-store-RLS test.
 * All authoritative values MUST come from injected, trusted server-side adapters.
 */
const FLAGS = Object.freeze({
  qaMode: 'SYNTHETIC_QA', liveAuth: false, liveMeta: false,
  customerDataRead: false, privateOrderRead: false,
  orderWrite: false, providerSend: false, databaseWrite: false,
});
const ALLOWED_PROBES = Object.freeze(['store.admission.check', 'page.connection.preview']);
const DENY = Object.freeze({
  BAD_INPUT: 'BAD_INPUT', PROTECTED_CONTEXT_REQUIRED: 'PROTECTED_CONTEXT_REQUIRED',
  AUTH_REQUIRED: 'AUTH_REQUIRED', ACCESS_DENIED: 'ACCESS_DENIED',
  UAT_UNAVAILABLE: 'UAT_UNAVAILABLE',
});
const ALLOWED_BODY_KEYS = new Set(['selectedStoreAlias', 'probe', 'pageAlias']);
const alias = x => typeof x === 'string' && /^[a-z][a-z0-9-]{2,40}$/.test(x);
function parseBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.getPrototypeOf(body) !== Object.prototype) return null;
  const keys=Object.keys(body);
  if (!keys.length || keys.length>3 || keys.some(k=>!ALLOWED_BODY_KEYS.has(k))) return null;
  if (!alias(body.selectedStoreAlias) || !ALLOWED_PROBES.includes(body.probe)) return null;
  if (body.probe==='page.connection.preview' && !alias(body.pageAlias)) return null;
  if (body.probe!=='page.connection.preview' && Object.hasOwn(body,'pageAlias')) return null;
  return {selectedStoreAlias:body.selectedStoreAlias, probe:body.probe, pageAlias:body.pageAlias};
}
const result=(decision,code,probe)=>Object.freeze({
  qa:'SYNTHETIC_QA', decision, code,
  ...(probe && ALLOWED_PROBES.includes(probe) ? {probe} : {}),
  storeRlsVerified:false, realOwnerSessionsVerified:false,
  canReadOrders:false, canWriteOrders:false, canSend:false,
});
const denied=(code,probe)=>result('DENY',code,probe);
function createProtectedUatGate({verifyPrivateAccessContext, resolveBackendSession, findCanonicalMembership, findPageConnection, recordSafeAudit, now=Date.now}={}){
  if (![verifyPrivateAccessContext,resolveBackendSession,findCanonicalMembership,findPageConnection,recordSafeAudit].every(x=>typeof x==='function')) throw new Error('TRUSTED_ADAPTERS_REQUIRED');
  if(typeof now!=='function')throw new Error('CLOCK_REQUIRED');
  const counts={metaCalls:0,orderReads:0,orderWrites:0,sends:0};
  // No session/user/store/page/token values in output or audit. No client-supplied authority.
  async function probe({privateContext,clientBody}={}){
    const body=parseBody(clientBody);
    let decision=body ? denied(DENY.ACCESS_DENIED,body.probe) : denied(DENY.BAD_INPUT);
    try {
      if (!body) return await finish(decision);
      // The privateContext is NOT read from the HTTP body. The real host must
      // construct it only after native Access and Auth verification.
      const access=await verifyPrivateAccessContext(privateContext);
      if(!access || access.source!=='trusted-host-runtime' || access.operatorVerified!==true ||
         access.authorized!==true || access.audience!=='private-staging-qa' ||
         access.role!=='qa-operator') return await finish(denied(DENY.PROTECTED_CONTEXT_REQUIRED,body.probe));
      const s=await resolveBackendSession(privateContext);
      if(!s || s.verifiedBy!=='trusted-auth-server' || s.status!=='active' ||
         s.issuer!=='synthetic-auth' || s.audience!=='synthetic-owner-uat' ||
         !alias(s.principalAlias) || !alias(s.sessionAlias) ||
         !Number.isSafeInteger(s.expiresAt) || s.expiresAt<=now()) return await finish(denied(DENY.AUTH_REQUIRED,body.probe));
      // Store choice is only a selector. Membership is read from trusted backend.
      const m=await findCanonicalMembership({principalAlias:s.principalAlias,selectedStoreAlias:body.selectedStoreAlias});
      if(!m || m.principalAlias!==s.principalAlias || m.storeAlias!==body.selectedStoreAlias ||
         !alias(m.tenantAlias) || m.active!==true || m.storeStatus!=='active' ||
         !['owner','manager'].includes(m.role)) return await finish(denied(DENY.ACCESS_DENIED,body.probe));
      if(body.probe==='page.connection.preview') {
        const p=await findPageConnection({pageAlias:body.pageAlias});
        if(!p || p.pageAlias!==body.pageAlias || p.storeAlias!==m.storeAlias ||
           p.tenantAlias!==m.tenantAlias || p.platform!=='messenger' ||
           p.status!=='connected' || p.qa!=='SYNTHETIC_QA') return await finish(denied(DENY.ACCESS_DENIED,body.probe));
      }
      decision=result('ALLOW','READ_ONLY_ALLOWED',body.probe);
      return await finish(decision);
    } catch { // No exception string, secret, URL or account identifier can leak.
      return await finish(denied(DENY.UAT_UNAVAILABLE,body?.probe));
    }
  }
  async function finish(outcome){
    try {
      const ok=await recordSafeAudit(Object.freeze({scope:'synthetic-v1865',decision:outcome.decision,code:outcome.code,probe:outcome.probe||'none'}));
      if(ok!==true)return denied(DENY.UAT_UNAVAILABLE,outcome.probe);
    }catch{return denied(DENY.UAT_UNAVAILABLE,outcome.probe)}
    return outcome;
  }
  return Object.freeze({flags:FLAGS,probe,getMetrics:()=>Object.freeze({...counts})});
}
module.exports={FLAGS,ALLOWED_PROBES,DENY,createProtectedUatGate};
