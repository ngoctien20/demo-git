/**
 * TIEN404 V17.1-D Meta Page/App read-only entitlement preflight.
 *
 * No tokens or PII are ever logged, written to disk or uploaded. Explicit opt-in
 * is required. This is not merchant ownership attestation or callback activation.
 *
 * Run locally (Node 22+):
 *   T404_META_PAGE_TOKEN=... T404_META_PAGE_ID=... T404_META_APP_ID=... \
 *     node qa/v171d-meta-authority/page-app-readonly.mjs --live-readonly
 *
 * Never paste tokens into chat, a PR, an Actions secret, or source control.
 */
import {pathToFileURL} from 'node:url';
export const CONTRACT = 'T404_V171D_META_PAGE_APP_READONLY_V1';
const DIGITS = /^\d{5,30}$/;
const GRAPH_ORIGIN = 'https://graph.facebook.com';
const GRAPH_VERSION = 'v27.0';
const denied = reason => Object.freeze({
  contract: CONTRACT,
  status:'BLOCKED',
  reason,
  page_token_can_read_page:false,
  expected_app_subscription_visible:false,
  verified_merchant_business_owner:false,
  authorized_to_change_callback:false,
  real_shadow_callback_tested:false,
  real_messenger_send_count:0,
  commerce_writes:0
});
function inputsValid({pageId,appId,token}) {
 return DIGITS.test(pageId||'')&&DIGITS.test(appId||'')&&
 typeof token==='string'&&token.length>=12&&token.length<=4096&&
 !/[\r\n]/.test(token);
}
async function graphRead({pageId,token,path,fetchImpl}) {
 const url = new URL(GRAPH_ORIGIN+'/'+GRAPH_VERSION+'/'+pageId+path);
 if(url.origin!==GRAPH_ORIGIN || url.protocol!=='https:') throw Error('INVALID_GRAPH_HOST');
 const response = await fetchImpl(url.href, {
  method:'GET',
  headers:{Authorization:'Bearer '+token,Accept:'application/json'},
  redirect:'error',
  signal:AbortSignal.timeout(12000)
 });
 if(!response||!response.ok)throw Error('GRAPH_READ_NOT_AUTHORIZED');
 const json=await response.json();
 if(!json||typeof json!=='object'||json.error)throw Error('GRAPH_RESPONSE_UNTRUSTED');
 return json;
}
export async function verifyReadOnly({pageId,appId,token,fetchImpl=fetch}) {
 if(!inputsValid({pageId,appId,token})) return denied('MISSING_OR_INVALID_PRIVATE_INPUT');
 try{
  const page=await graphRead({pageId,token,path:'?fields=id',fetchImpl});
  if(String(page.id)!==pageId)return denied('PAGE_TOKEN_SCOPE_MISMATCH');
  const subs=await graphRead({pageId,token,path:'/subscribed_apps?fields=id',fetchImpl});
  if(!Array.isArray(subs.data))return denied('SUBSCRIPTION_READ_UNAVAILABLE');
  const found=subs.data.some(x=>String(x?.id)===appId);
  return Object.freeze({
   contract:CONTRACT,status:found?'APP_SUBSCRIPTION_VISIBLE_OWNER_UNVERIFIED':'APP_SUBSCRIPTION_NOT_VISIBLE',
   reason:found?'READ_ONLY_APP_INSTALLATION_EVIDENCE_NOT_OWNER_PROOF':'APP_INSTALLATION_MISSING_OR_NOT_VISIBLE',
   page_token_can_read_page:true,
   expected_app_subscription_visible:found,
   verified_merchant_business_owner:false,
   authorized_to_change_callback:false,
   real_shadow_callback_tested:false,
   real_messenger_send_count:0,
   commerce_writes:0
  });
 }catch {
  // Deliberately NEVER include raw Graph errors, URLs, page IDs, app IDs or tokens.
  return denied('GRAPH_READ_FAILED_OR_SCOPE_NOT_GRANTED');
 }
}
function isDirectRun(){
 return !!process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href;
}
if(isDirectRun()) {
 const optIn=process.argv.slice(2);
 if(optIn.length!==1||optIn[0]!=='--live-readonly'){
  console.log(JSON.stringify(denied('EXPLICIT_LIVE_READONLY_OPT_IN_REQUIRED')));
  process.exitCode=2;
 }else{
  const result=await verifyReadOnly({
   pageId:process.env.T404_META_PAGE_ID,
   appId:process.env.T404_META_APP_ID,
   token:process.env.T404_META_PAGE_TOKEN
  });
  console.log(JSON.stringify(result,null,2));
  process.exitCode=result.expected_app_subscription_visible?0:2;
 }
}
