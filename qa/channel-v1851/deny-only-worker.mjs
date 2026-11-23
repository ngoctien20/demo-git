/**
 * TIEN404 V18.5.1 — Cloudflare Worker STAGING CANDIDATE, permanently DENY ONLY.
 *
 * Source-only safety shell, never deployed by this PR. This module does NOT
 * import the V18.5 mock HTTP adapter (which is not approved for hosted use).
 * There is NO route to enable real chat; env flags / browser params cannot
 * unlock it. Future live protected gateway requires separate reviewed source,
 * Access JWT signature verification, D1 binding and approved deployment.
 */
const HEADERS=Object.freeze({
  'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'no-store',
  'X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'no-referrer',
  'Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'"
});
export default Object.freeze({
  async fetch(request,_env,_ctx){
    let pathname='';
    try{pathname=new URL(request.url).pathname}catch{}
    const api=pathname==='/widget/v18.5/session'||
              pathname==='/widget/v18.5/message';
    if(!api)return new Response(JSON.stringify({error:'NOT_FOUND'}),{
      status:404,headers:HEADERS
    });
    // NO CORS; NO ACCESS ASSUMPTION; NO SESSION; NO D1; NO n8n; NO SEND.
    return new Response(JSON.stringify({
      error:'STAGING_PROTECTED_GATEWAY_NOT_ADMITTED'
    }),{status:503,headers:HEADERS});
  }
});
