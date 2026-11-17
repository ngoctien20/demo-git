// TIEN404 V17.ZALO-SOURCE-04B — Access-gated OPERATOR ONLY no-send canary.
// SOURCE CANDIDATE — NEVER DEPLOYED. No provider webhook, OAuth callback,
// token exchange, outbound fetch, DB, storage, AI, customer data or Order writes.
// Cloudflare Access MUST protect the entire Worker BEFORE any upload; this source
// also denies requests without authenticated ctx.access and exact audience.
// Zalo webhook events CANNOT use Cloudflare Access browser login. They require
// a separately approved ingress with real provider MAC, durable replay & rate gate.
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{
  'content-type':'application/json; charset=utf-8',
  'cache-control':'no-store',
  'x-content-type-options':'nosniff',
  'referrer-policy':'no-referrer',
  'content-security-policy':"default-src 'none'; frame-ancestors 'none'"
}});
const denied=(reason,status=403)=>json({
  ok:false,reason,noSend:true,noOrderWrite:true,canActivate:false
},status);
export default {
  async fetch(request,env,ctx){
    const pathname=new URL(request.url).pathname;
    // Public provider paths do not exist on the PRIVATE OPERATOR Worker.
    if(pathname.startsWith('/webhook/')||pathname.startsWith('/oauth/'))
      return denied('PROVIDER_ENDPOINT_NOT_HOSTED_HERE',404);
    if(request.method!=='GET'&&request.method!=='POST')return denied('METHOD_NOT_ALLOWED',405);
    if(env?.SOURCE04B_NO_SEND_ONLY!=='enabled')
      return denied('PRIVATE_CANARY_KILL_SWITCH_OFF');
    if(!env?.QA_ACCESS_AUD||typeof env.QA_ACCESS_AUD!=='string'||
       !ctx?.access||ctx.access.aud!==env.QA_ACCESS_AUD)
      return denied('VERIFIED_CLOUDFLARE_ACCESS_REQUIRED');
    // This worker performs no provider requests even when operator is authorized.
    // Authorization to run a real OA canary remains a separate private step.
    if(request.method==='GET'&&pathname==='/private/oa-canary/status')
      return json({
        ok:true,stage:'SOURCE_04B_OPERATOR_ACCESS_CONFIRMED_ONLY',
        privateAccessPresent:true,providerOwnershipVerified:false,
        signedProviderEventVerified:false,canReceiveProviderTraffic:false,
        canActivate:false,canSend:false,canWriteOrders:false
      });
    if(request.method==='POST'&&pathname==='/private/oa-canary/approve')
      return denied('NO_REAL_OWNER_EVIDENCE_OR_PRODUCTION_APPROVAL',423);
    return denied('PRIVATE_ROUTE_NOT_FOUND',404);
  }
};
