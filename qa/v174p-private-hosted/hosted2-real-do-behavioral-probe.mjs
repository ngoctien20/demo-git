/**
 * V17.4P-HOSTED.2 — MANUAL, BOUNDED REAL Cloudflare Durable Object behavioral acceptance.
 * NEVER invoked from CI, never turns on Access, never deploys or mutates policy.
 * Requires signed-in operator's temporary Playwright session state OUTSIDE source repo.
 * It does not prove database rows were physically removed by DO alarm; separate
 * independent hosted TTL/SQLite metrics review is mandatory.
 */
import {statSync} from 'node:fs';
import {resolve,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateConfig} from './browser-hosted-canary.mjs';

export const PROBE_CONTRACT='T404_V174P_HOSTED2_REAL_DO_BEHAVIORAL_PROBE_V1';
export const MAX_QA_REQUESTS=96;
export function validateHostedDoConfig(env={}){
 const base=validateConfig(env);
 const missing=[...base.missing];
 if(env.T404_V174P_DO_ACCEPTANCE_APPROVAL!=='BOUNDED_REAL_DO_NO_SEND')
  missing.push('EXPLICIT_REAL_DO_OPERATOR_ACCEPTANCE');
 if(env.T404_V174P_QA_MAX_REQUESTS!==String(MAX_QA_REQUESTS))
  missing.push('EXACT_NETWORK_REQUEST_BUDGET');
 if(env.T404_V174P_REAL_DO_HOSTED_BINDING_ATTESTED!=='YES')
  missing.push('INDEPENDENT_CLOUDFLARE_DO_BINDING_EVIDENCE');
 if(env.T404_V174P_QA_ROLLBACK_VERIFIED!=='YES')
  missing.push('PROVEN_HOSTED_ROLLBACK');
 return {ok:missing.length===0,missing,origin:base.origin,state:base.state,
  maximumRequests:MAX_QA_REQUESTS,hostedAlarmCleanupProvenByProbe:false};
}
function noSecrets(e){
 const m=String(e?.message||'');
 if(/(jwt|cookie|authorization|bearer|secret|token|state)/i.test(m))return 'GENERIC_QA_FAILURE';
 return m.slice(0,70)||'UNKNOWN';
}
async function main(){
 const cfg=validateHostedDoConfig(process.env);
 if(!cfg.ok)throw Error('BLOCKED_PRE_FLIGHT:'+cfg.missing.join(','));
 if(!isAbsolute(cfg.state))throw Error('BLOCKED_STATE_PATH');
 const stat=statSync(cfg.state);
 if(!stat.isFile()||stat.size<20||stat.size>1000000||
    (process.platform!=='win32'&&(stat.mode&0o077)!==0))
  throw Error('UNSAFE_PRIVATE_BROWSER_STATE');
 const {chromium}=await import('playwright');
 const browser=await chromium.launch({headless:true});
 let ctx,anonymous,requests=0;
 const outcome={contract:PROBE_CONTRACT,scope:'SYNTHETIC_NO_SEND_ONLY',
  status:'BLOCKED',edgeDenied:false,parallelReplay:false,conflictBlocked:false,
  session429:false,zeroProviderSends:false,realAlarmStorageCleanup:'NOT_PROVEN',
  hostedStoreRls:'NOT_PROVEN',merchantIdentity:'NOT_PROVEN',requestCount:0};
 try{
  anonymous=await browser.newContext({ignoreHTTPSErrors:false});
  const login=await anonymous.request.get(cfg.origin+'/qa',{timeout:12000,maxRedirects:0});
  requests++;
  outcome.edgeDenied=[302,303].includes(login.status())&&
   /^https:\/\/[a-z0-9.-]+\.cloudflareaccess\.com\//i.test(login.headers()['location']||'');
  if(!outcome.edgeDenied)throw Error('EDGE_ACCESS_NOT_PROVEN');
  await anonymous.close();anonymous=null;
  ctx=await browser.newContext({storageState:cfg.state,ignoreHTTPSErrors:false,
   acceptDownloads:false,serviceWorkers:'block'});
  async function post(path,body,jwt){
   if(requests>=MAX_QA_REQUESTS)throw Error('NETWORK_BUDGET_EXHAUSTED');
   requests++;
   const response=await ctx.request.post(cfg.origin+path,{timeout:15000,maxRedirects:0,
    headers:{Origin:cfg.origin,'Content-Type':'application/json',
      ...(jwt?{Authorization:'Bearer '+jwt}:{})},data:JSON.stringify(body)});
   const payload=await response.json().catch(()=>({status:'NO_JSON'}));
   return {http:response.status(),retryAfter:response.headers()['retry-after'],
    status:payload.status,providerSends:payload.provider_sends,modelCalls:payload.model_calls,
    commerceWrites:payload.commerce_writes,token:payload.token};
  }
  const session=await post('/v1/website/sessions',{installation_ref:'QA_WEB_WIDGET_A'});
  if(session.http!==200||!session.token)throw Error('PRIVATE_ACCESS_SESSION_UNAVAILABLE');
  const event='QA_MSG_DO_ACCEPTANCE_'+crypto.randomUUID().replaceAll('-','').toUpperCase();
  const body={installation_ref:'QA_WEB_WIDGET_A',event_id:event,
   requested_tool:'catalog_read',text:'QA synthetic concurrency'};
  const replies=await Promise.all(Array.from({length:16},
   ()=>post('/v1/website/messages',body,session.token)));
  outcome.parallelReplay=replies.filter(r=>r.status==='QA_REPLY_PREPARED').length===1&&
    replies.filter(r=>r.status==='DUPLICATE_IGNORED').length===15;
  outcome.zeroProviderSends=replies.every(r=>
   r.providerSends===0&&r.modelCalls===0&&r.commerceWrites===0);
  const conflict=await post('/v1/website/messages',{...body,text:'changed QA payload'},session.token);
  outcome.conflictBlocked=conflict.http===403;
  // Bounded test: one operator, 65 attempts maximum to catch fixed 64/min 429.
  // A prior minute bucket or slow transport may make this inconclusive, never PASS.
  const startMinute=Math.floor(Date.now()/60000);
  if(Date.now()%60000>12000)throw Error('RATE_TEST_START_NEAR_MINUTE_END');
  for(let i=0;i<65;i++){
   const result=await post('/v1/website/sessions',{installation_ref:'QA_WEB_WIDGET_A'});
   if(result.http===429&&result.retryAfter==='60'){outcome.session429=true;break;}
   if(result.http!==200)throw Error('UNEXPECTED_SESSION_RESPONSE');
   if(Math.floor(Date.now()/60000)!==startMinute)throw Error('MINUTE_BOUNDARY_INCONCLUSIVE');
  }
  if(!outcome.parallelReplay||!outcome.conflictBlocked||!outcome.session429||
      !outcome.zeroProviderSends)throw Error('HOSTED_DO_ASSERTION_FAILED');
  outcome.status='PASS_BOUNDED_BEHAVIOR_ONLY_REQUIRES_TTL_ATTESTATION';
  outcome.requestCount=requests;
  process.stdout.write(JSON.stringify(outcome)+'\n');
 }catch(e){
  process.stderr.write(JSON.stringify({contract:PROBE_CONTRACT,status:'BLOCKED',
   reason:noSecrets(e),requests,realAlarmStorageCleanup:'NOT_PROVEN'})+'\n');
  process.exitCode=1;
 }finally{await anonymous?.close();await ctx?.close();await browser.close();}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
 main().catch(e=>{process.stderr.write('BLOCKED:'+noSecrets(e)+'\n');process.exitCode=1;});
