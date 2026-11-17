/**
 * V17.4P-HOSTED bounded EXTERNAL TLS Chromium canary. NEVER auto-run in CI.
 * Operates with authorized operator's ephemeral local Cloudflare Access browser state.
 * Never logs cookies, Access tokens, HMAC keys or session tokens.
 */
import {statSync} from 'node:fs';
import {resolve,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';

export function validateConfig(e){
 const missing=[];
 let origin='';
 try {
  const u=new URL(e.T404_V174P_ISSUER_ORIGIN||'');
  if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.pathname!=='/'||
   u.port||/^(localhost|127\.|0\.|\[::1\])/.test(u.hostname)||u.hostname.endsWith('.invalid')||
   u.hostname.endsWith('.pages.dev')||u.hostname==='ngoctien20.io.vn')throw Error('host');
  origin=u.origin;
 }catch{missing.push('DEDICATED_HTTPS_QA_HOST');}
 if(e.T404_V174P_CANARY_APPROVAL!=='QA_NO_SEND_ONLY')missing.push('OWNER_APPROVAL');
 if(e.T404_V174P_ACCESS_INDEPENDENTLY_VERIFIED!=='YES')missing.push('INDEPENDENT_EDGE_ACCESS_PROOF');
 if(e.T404_V174P_OPERATOR_CONFIRMED!=='YES')missing.push('AUTHENTICATED_QA_OPERATOR');
 if(e.T404_V174P_NO_REAL_DATA!=='YES')missing.push('SYNTHETIC_DATA_ONLY');
 const state=e.T404_V174P_OPERATOR_STORAGE_STATE_FILE||'';
 if(!state||!isAbsolute(state))missing.push('PRIVATE_OPERATOR_BROWSER_STATE');
 return {ok:missing.length===0,missing,origin,state};
}

async function main(){
 const cfg=validateConfig(process.env);
 if(!cfg.ok)throw Error('BLOCKED_PRE_FLIGHT:'+cfg.missing.join(','));
 const meta=statSync(cfg.state);
 if(!meta.isFile()||meta.size<20||meta.size>1000000||
    (process.platform!=='win32'&&(meta.mode&0o077)!==0))throw Error('UNSAFE_ACCESS_STATE_FILE');
 const {chromium}=await import('playwright');
 const browser=await chromium.launch({headless:true});
 let ctx,anonymous;
 const result={contract:'T404_V174P_HOSTED_BROWSER_CANARY_V1',origin:cfg.origin,
  scope:'SYNTHETIC_NO_SEND_ONLY',edgeDenied:false,qaTurns:0,storeBBlocked:false,
  orderBlocked:false,replayIgnored:false,zeroWrites:false,offOriginCalls:0,status:'BLOCKED'};
 try {
  anonymous=await browser.newContext({ignoreHTTPSErrors:false});
  const a=await anonymous.request.get(cfg.origin+'/qa',{maxRedirects:0,timeout:15000});
  const loc=a.headers()['location']||'';
  result.edgeDenied=[302,303].includes(a.status())&&
   /^https:\/\/[a-z0-9.-]+\.cloudflareaccess\.com\//i.test(loc);
  if(!result.edgeDenied)throw Error('CLOUDFLARE_EDGE_ACCESS_NOT_PROVEN');
  await anonymous.close();anonymous=null;
  ctx=await browser.newContext({viewport:{width:390,height:844},ignoreHTTPSErrors:false,
   storageState:cfg.state,acceptDownloads:false,serviceWorkers:'block'});
  await ctx.route('**/*',route=>{
   if(new URL(route.request().url()).origin!==cfg.origin){
    result.offOriginCalls++;return route.abort();
   }
   return route.continue();
  });
  const page=await ctx.newPage();
  const html=await page.goto(cfg.origin+'/qa',{waitUntil:'domcontentloaded',timeout:15000});
  if(!html||html.status()!==200||page.url()!==cfg.origin+'/qa'||
   !/CHỈ TEST/.test(await page.locator('#disclaimer').innerText()))
    throw Error('AUTHORIZED_QA_BROWSER_UNAVAILABLE');
  for(const q of ['Giá QA_SKU_001?','Tồn kho QA?','Mã sản phẩm QA?']){
   const n=await page.locator('#messages p').count();
   await page.locator('#message').fill(q);await page.locator('#form button').click();
   await page.waitForFunction(n=>document.querySelectorAll('#messages p').length>n,n,{timeout:15000});
   if(!(await page.locator('#messages p').last().innerText()).includes('QA_SKU_001'))
    throw Error('SYNTHETIC_REPLY_FAILED');
   result.qaTurns++;
  }
  const checks=await page.evaluate(async()=>{
   async function post(path,body,token){
    const r=await fetch(path,{method:'POST',credentials:'same-origin',cache:'no-store',
     headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},
     body:JSON.stringify(body)});
    return r.ok?{code:r.status,...await r.json()}:{code:r.status};
   }
   const badStore=await post('/v1/website/sessions',{installation_ref:'QA_WEB_WIDGET_B'});
   const session=await post('/v1/website/sessions',{installation_ref:'QA_WEB_WIDGET_A'});
   if(!session.token)return {badStore};
   const badOrder=await post('/v1/website/messages',{installation_ref:'QA_WEB_WIDGET_A',
    event_id:'QA_MSG_CANARY_ORDER',requested_tool:'create_order',text:'order'},session.token);
   const body={installation_ref:'QA_WEB_WIDGET_A',event_id:'QA_MSG_CANARY_DUP',
    requested_tool:'catalog_read',text:'synthetic replay'};
   const first=await post('/v1/website/messages',body,session.token);
   const second=await post('/v1/website/messages',body,session.token);
   // Do not return session token to Node, logs or reports.
   return {badStore:{code:badStore.code},badOrder:{code:badOrder.code},
    first:{status:first.status,provider_sends:first.provider_sends,
     model_calls:first.model_calls,commerce_writes:first.commerce_writes},
    second:{status:second.status,provider_sends:second.provider_sends,
     commerce_writes:second.commerce_writes}};
  });
  result.storeBBlocked=checks.badStore?.code===403;
  result.orderBlocked=checks.badOrder?.code===403;
  result.replayIgnored=checks.first?.status==='QA_REPLY_PREPARED'&&
   checks.second?.status==='DUPLICATE_IGNORED';
  result.zeroWrites=checks.first?.provider_sends===0&&checks.first?.model_calls===0&&
   checks.first?.commerce_writes===0&&checks.second?.provider_sends===0&&
   checks.second?.commerce_writes===0;
  if(!result.storeBBlocked||!result.orderBlocked||!result.replayIgnored||
     !result.zeroWrites||result.offOriginCalls!==0)throw Error('HOSTED_ASSERTION_FAILED');
  result.status='PASS_PRIVATE_SYNTHETIC_CANARY_ONLY';
  process.stdout.write(JSON.stringify(result)+'\n');
 }catch(e){
  process.stderr.write(JSON.stringify({contract:result.contract,status:'BLOCKED',
   reason:String(e.message).slice(0,110)})+'\n');process.exitCode=1;
 }finally{await ctx?.close();await anonymous?.close();await browser.close();}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 main().catch(e=>{process.stderr.write('BLOCKED:'+String(e.message).slice(0,110)+'\n');process.exitCode=1;});
}
