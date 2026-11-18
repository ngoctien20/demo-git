/**
 * TIEN404 V14.4 — no-send/no-data staging gateway readiness.
 * Source-only until deployed to distinct staging Worker. NEVER configure a
 * production route, bindings, auth secrets, store registry or provider send.
 * Returning 423 is intentional: trusted Store RLS and Widget installation are
 * not yet hosted-verified. This is not a customer-ready chat endpoint.
 */
const GATE='V144_WIDGET_GATE_CLOSED';
const securityHeaders={
  'content-type':'application/json; charset=utf-8',
  'cache-control':'no-store',
  'x-content-type-options':'nosniff',
  'referrer-policy':'no-referrer',
  'content-security-policy':"default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  'x-frame-options':'DENY',
  'permissions-policy':'camera=(), microphone=(), geolocation=()'
};
function json(status,body){return new Response(JSON.stringify(body),{status,headers:securityHeaders});}
export default {
  async fetch(request){
    const url=new URL(request.url);
    // No CORS: an untrusted embed must never inherit privileges by origin.
    if(request.method==='GET' && url.pathname==='/__v144/health'){
      return json(200,{service:'tien404-widget-gateway',environment:'staging',
        state:'LOCKED',storeRlsVerified:false,domainVerified:false,
        sessionIssuanceEnabled:false,aiCallsEnabled:false,
        orderWritesEnabled:false,providerSendsEnabled:false,
        productionReady:false});
    }
    if(url.pathname==='/v1/widget/session'||url.pathname==='/v1/widget/message'||
       url.pathname==='/v1/widget/install'||url.pathname.startsWith('/v1/widget/')){
      return json(423,{error:GATE,productionReady:false});
    }
    if(request.method==='OPTIONS')return json(405,{error:'CORS_NOT_ENABLED'});
    return json(404,{error:'NOT_FOUND'});
  }
};
