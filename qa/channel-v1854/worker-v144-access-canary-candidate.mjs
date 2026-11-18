import { verifyPrivateAccess } from './cloudflare-access-context-gate.mjs';

const HEADERS={
  'content-type':'application/json; charset=utf-8',
  'cache-control':'no-store, max-age=0',
  'pragma':'no-cache',
  'x-content-type-options':'nosniff',
  'referrer-policy':'no-referrer',
  'content-security-policy':"default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  'x-frame-options':'DENY',
  'permissions-policy':'camera=(), microphone=(), geolocation=()'
};
function json(status,body){
  return new Response(JSON.stringify(body),{status,headers:HEADERS});
}

/**
 * V18.5.4 source candidate for the EXISTING V14.4 Worker only.
 * Do not upload until exact host + Access app + policy + rollback are approved.
 * It intentionally does not call n8n, D1, a service binding, an AI provider,
 * a customer record, an order, or a channel dispatcher.
 */
export default {
  async fetch(request,env,ctx){
    // Access must be verified for EVERY request, including health and errors.
    const admission=await verifyPrivateAccess(ctx,env);
    if(!admission.ok){
      return json(admission.status,{error:admission.code,productionReady:false});
    }

    const url=new URL(request.url);

    if(request.method==='GET'&&url.pathname==='/__v1854/access-canary'){
      return json(200,{
        service:'tien404-widget-gateway',
        environment:'private-staging',
        canary:'CLOUDFLARE_ACCESS_CONTEXT_VERIFIED',
        principalType:admission.principalType,
        audienceVerified:true,
        operatorAllowlisted:true,
        commerce:'LOCKED_PENDING_READONLY_ADAPTER',
        privateOrderAccess:false,
        orderWrites:0,
        providerSends:0,
        productionReady:false
      });
    }

    if(request.method==='GET'&&url.pathname==='/__v144/health'){
      return json(200,{
        service:'tien404-widget-gateway',
        environment:'staging',
        state:'LOCKED',
        accessRequired:true,
        storeRlsVerified:false,
        domainVerified:false,
        sessionIssuanceEnabled:false,
        aiCallsEnabled:false,
        orderWritesEnabled:false,
        providerSendsEnabled:false,
        productionReady:false
      });
    }

    if(url.pathname==='/v1/widget/session'||
       url.pathname==='/v1/widget/message'||
       url.pathname==='/v1/widget/install'||
       url.pathname.startsWith('/v1/widget/')){
      return json(423,{
        error:'COMMERCE_READONLY_ADAPTER_NOT_ADMITTED',
        accessVerified:true,
        productionReady:false
      });
    }

    if(request.method==='OPTIONS'){
      return json(405,{error:'CORS_DISABLED_PRIVATE_SAME_ORIGIN_ONLY'});
    }

    return json(404,{error:'NOT_FOUND'});
  }
};
