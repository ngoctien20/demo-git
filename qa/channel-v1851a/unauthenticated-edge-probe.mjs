/**
 * V18.5.1A edge probe: three read-only, unauthenticated GETs from CI.
 * NO tokens, NO cookies, NO credentials, NO authenticated session.
 * Does not claim real second-identity denial.
 */
export const EDGE_HOST = 'tien404-widget-gateway-v144-staging.tienmobi208.workers.dev';
export const PATHS = ['/__v1854/access-canary', '/__v144/health', '/v1/widget/session'];

export function classifyUnauthenticatedEdge({status,location='',bodySample='',path}) {
  const body = String(bodySample ?? '');
  if (status === 200 && (
    body.includes('CLOUDFLARE_ACCESS_CONTEXT_VERIFIED') ||
    body.includes('"service":"tien404-widget-gateway"') ||
    body.includes('"accessVerified":true')
  )) return {kind:'SECURITY_FAILURE_WORKER_JSON_PUBLIC',status,path,verified:false};

  if ([301,302,303,307,308].includes(status) && location) {
    let url;
    try {
      url=new URL(location,'https://'+EDGE_HOST+path);
    } catch {
      return {kind:'INCONCLUSIVE_INVALID_REDIRECT',status,path,verified:false};
    }
    const isAccessLogin = url.protocol === 'https:' && (
      url.hostname.endsWith('.cloudflareaccess.com') ||
      url.hostname === 'dash.cloudflare.com' ||
      (url.hostname === EDGE_HOST && url.pathname.startsWith('/cdn-cgi/access/'))
    );
    return {
      kind:isAccessLogin?'UNAUTHENTICATED_ACCESS_LOGIN_REDIRECT':'INCONCLUSIVE_REDIRECT',
      status,path,verified:isAccessLogin
    };
  }

  if(status===401||status===403) {
    return {kind:'UNAUTHENTICATED_BLOCKED_CAUSE_UNVERIFIED',status,path,verified:false};
  }
  if(status===200) {
    return {kind:'INCONCLUSIVE_HTML_OR_OTHER_200',status,path,verified:false};
  }
  return {kind:'INCONCLUSIVE_HTTP_STATUS',status,path,verified:false};
}

async function sampleBody(response,limit=4096) {
  if(!response.body)return '';
  const reader=response.body.getReader();
  let text='', total=0;
  try{
    while(total<limit){
      const next=await reader.read();
      if(next.done)break;
      total+=next.value.byteLength;
      text+=new TextDecoder().decode(next.value.slice(0,Math.max(0,limit-(total-next.value.byteLength))));
      if(total>=limit)break;
    }
  }finally{
    try{await reader.cancel();}catch{}
  }
  return text;
}

export async function runEdgeProbe(fetchImpl=fetch) {
  const results=[];
  for(const path of PATHS){
    try{
      const response=await fetchImpl('https://'+EDGE_HOST+path,{
        method:'GET', redirect:'manual', cache:'no-store',
        headers:{'user-agent':'TIEN404-V1851A-Anonymous-Edge-QA'},
        signal:AbortSignal.timeout(12000)
      });
      const bodySample=await sampleBody(response);
      const result=classifyUnauthenticatedEdge({
        status:response.status,
        location:response.headers.get('location')||'',
        bodySample,path
      });
      results.push(result);
    }catch{
      results.push({kind:'INCONCLUSIVE_NETWORK_OR_TIMEOUT',path,verified:false});
    }
  }
  return results;
}

if(process.env.T404_EDGE_PROBE_RUN==='1'){
  const result=await runEdgeProbe();
  // Print only status/kind and safe static paths: no headers, Location query,
  // Access cookies, user identifiers, or login challenge tokens are logged.
  for(const value of result){
    console.log('V1851A_EDGE '+JSON.stringify(value));
  }
  if(result.some(x=>x.kind==='SECURITY_FAILURE_WORKER_JSON_PUBLIC')){
    console.error('V1851A_SECURITY_STOP: worker Canary/Access data publicly accessible');
    process.exitCode=1;
  }else if(result.every(x=>x.verified===true)){
    console.log('V1851A_ANONYMOUS_ACCESS_REDIRECT_CONFIRMED');
  }else{
    console.log('V1851A_EDGE_INCONCLUSIVE_FOR_SOME_PATHS_REAL_ALTERNATE_IDENTITY_DENIAL_STILL_PENDING');
  }
}
