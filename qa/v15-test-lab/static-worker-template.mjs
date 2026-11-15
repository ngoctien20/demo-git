/**
 * TIEN404 AI V15.0-08 Owner AI Test Lab — ISOLATED QA STATIC VIEWER.
 * The HTML is substituted from qa/v15-test-lab/index.html at deployment.
 * No API tokens, DB bindings, remote API calls, data writes, provider sends.
 */
const HTML=/*__EMBEDDED_HTML__*/;
const HEADERS={
  'content-type':'text/html; charset=utf-8',
  'cache-control':'no-store, private',
  'x-content-type-options':'nosniff',
  'referrer-policy':'no-referrer',
  'x-frame-options':'DENY',
  'permissions-policy':'geolocation=(), microphone=(), camera=(), payment=()',
  'cross-origin-resource-policy':'same-origin',
  'content-security-policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; form-action 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
};
export default {async fetch(request,env){
  const u=new URL(request.url);
  if(request.method!=='GET'&&request.method!=='HEAD')
    return new Response(JSON.stringify({ok:false,reason:'NO_WRITE_METHODS',can_send:false}),{status:405,headers:{'content-type':'application/json','cache-control':'no-store'}});
  if(u.pathname==='/health')return new Response(JSON.stringify({ok:true,version:'V15.0-08',environment:'SYNTHETIC_OFFLINE',can_send:false,has_provider_token:false,real_model_calls:0,orders_written:0,owner_authenticated:false}),{headers:{'content-type':'application/json','cache-control':'no-store'}});
  if(u.pathname!=='/'&&u.pathname!=='/index.html')return new Response('Not found',{status:404,headers:{'cache-control':'no-store'}});
  return new Response(request.method==='HEAD'?null:HTML,{status:200,headers:HEADERS});
}};
