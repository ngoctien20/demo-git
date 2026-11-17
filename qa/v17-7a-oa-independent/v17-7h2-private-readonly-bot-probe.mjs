// TIEN404 V17.7H.2 — PRIVATE OPERATOR READ-ONLY BOT API PROBE CONTRACT.
// SYNTHETIC HTTP TRANSPORT ONLY. A future separately approved operator-runner
// must supply a private managed Bot Token and real audited transport.
// This module has NO global fetch, HTTP client, file system, env read, logs,
// Supabase, Cloudflare, n8n or any webhook mutation. NEVER store tokens/URLs.
// Zalo Bot getMe and getWebhookInfo are POST requests whose Bot Token is part
// of the URL path. User-facing outputs must not contain token, URL or Bot ID.
const BOT_API='https://bot-api.zaloplatforms.com';
const TOKEN=/^QA_ONLY_[A-Za-z0-9_-]{10,50}:[A-Za-z0-9_-]{10,60}$/;
const BOT_ID=/^\d{8,24}$/;
const ACCOUNT=/^bot\.[A-Za-z0-9._-]{5,80}$/i;
const MAX_BYTES=8*1024;
const METHOD_NAMES=Object.freeze(['getMe','getWebhookInfo']);
const BLOCK=Object.freeze({
  syntheticTransportOnly:true,realProviderAccountReadbackVerified:false,
  realBotOwnerVerified:false,realMerchantStoreOwnerVerified:false,
  independentOperatorVerified:false,realStoreJwtRlsVerified:false,
  canChangeWebhook:false,canRegisterProviderCallback:false,
  canSendMessage:false,canReadCommerce:false,canWriteOrder:false,
  canPublish:false
});
const denied=(reason,extra={})=>Object.freeze({status:'NO_GO',reason,...BLOCK,...extra});
const shape=(reason,extra={})=>Object.freeze({status:'SYNTHETIC_READBACK_ONLY',reason,...BLOCK,...extra});

/**
 * Transport must be a local mock owned by the test harness and use a QA_ONLY
 * token. It receives an internal request object containing the test token path;
 * nobody may serialize/log that path. The result never exposes that URL.
 * This does NOT execute an actual Zalo request and cannot prove Bot ownership.
 */
export async function runSyntheticPrivateBotReadback(input,transport){
  if(!input||input.mode!=='OFFLINE_MOCK_READONLY'||input.noSend!==true||
     input.noMutation!==true||input.noCustomerRows!==true||
     !BOT_ID.test(input.expectedBotId??'')||
     !TOKEN.test(input.qaOnlyTestToken??'')||
     !transport||transport.mode!=='OFFLINE_FIXED_MOCK'||
     typeof transport.request!=='function'||
     Object.keys(input).some(k=>!['mode','noSend','noMutation','noCustomerRows',
       'expectedBotId','qaOnlyTestToken'].includes(k)))
    return denied('PRIVATE_READONLY_PROBE_NOT_AUTHORIZED_OR_NOT_QA_ONLY');
  let me,hook;
  const receivedMethods=[];
  for(const method of METHOD_NAMES){
    let response;
    const url=BOT_API+'/bot'+input.qaOnlyTestToken+'/'+method;
    try {
      response=await transport.request({
        method:'POST',url,body:'{}',
        headers:{'content-type':'application/json'},
        redirect:'error',retryCount:0,timeoutMs:5000
      });
    }catch{
      return denied('PRIVATE_READBACK_TRANSPORT_FAILED_REDACTED');
    }
    receivedMethods.push(method);
    // Response shape must be a small plain object; never stringify/log errors
    // because provider exceptions sometimes contain the sensitive token URL.
    if(!response||response.status!==200||typeof response.body!=='object'||
       response.body===null||Array.isArray(response.body))
      return denied('BOT_READBACK_FAILED_OR_UNTRUSTED_RESPONSE');
    let serialized;
    try{serialized=JSON.stringify(response.body)}catch{
      return denied('BOT_READBACK_FAILED_OR_UNTRUSTED_RESPONSE');
    }
    if(typeof serialized!=='string'||Buffer.byteLength(serialized,'utf8')>MAX_BYTES)
      return denied('BOT_READBACK_RESPONSE_TOO_LARGE');
    if(response.body.ok!==true||!response.body.result||
      typeof response.body.result!=='object')
      return denied('BOT_READBACK_FAILED_OR_UNTRUSTED_RESPONSE');
    if(method==='getMe')me=response.body.result;
    else hook=response.body.result;
  }
  if(receivedMethods.length!==2||receivedMethods.join(',')!=='getMe,getWebhookInfo')
    return denied('UNEXPECTED_READBACK_METHOD');
  if(String(me.id??'')!==input.expectedBotId||
     !ACCOUNT.test(me.account_name??''))
    return denied('GETME_BOT_ID_MISMATCH');
  if(typeof hook.url!=='string'||hook.url.length>2048||
     (hook.url!==''&&!/^https:\/\/[a-z0-9.-]+(?::443)?(?:\/[^\s]*)?$/i.test(hook.url))||
     !Number.isSafeInteger(hook.updated_at))
    return denied('WEBHOOK_INFO_UNTRUSTED');
  // No raw URL, Bot Token, Bot ID, account name or other provider values in
  // output, even for a successful test. Existing callback is a HARD STOP.
  if(hook.url!=='')return denied('EXISTING_WEBHOOK_DO_NOT_REPOINT',{
    syntheticGetMeMatched:true,syntheticWebhookConfigured:true
  });
  return shape('NO_WEBHOOK_IN_SYNTHETIC_FIXTURE_OWNER_STILL_UNVERIFIED',{
    syntheticGetMeMatched:true,syntheticWebhookConfigured:false,
    providerMethodsChecked:2
  });
}
export function getRealReadOnlyProbeRunbook(){
  return Object.freeze({
    status:'REAL_OPERATOR_PRIVATE_RUNNER_NOT_ADMITTED',
    requirements:Object.freeze([
      'DEDICATED_QA_BOT_CREATED_IN_BOT_CREATOR_WITH_OWNER_CONSENT',
      'INDEPENDENT_OPERATOR_AND_REVIEWER_AUTHENTICATED_PRIVATELY',
      'BOT_TOKEN_ONLY_IN_SHORT_LIVED_MANAGED_SECRET_NOT_CHAT_OR_GITHUB',
      'POST_GETME_READONLY_AND_CONFIRM_PINNED_BOT_ID',
      'POST_GETWEBHOOKINFO_READONLY_STOP_IF_EXISTING_CALLBACK',
      'REDACT_TOKEN_PATH_RESPONSE_URL_AND_PERSONAL_DATA',
      'NO_SETWEBHOOK_NO_DELETEWEBHOOK_NO_GETUPDATES_NO_SENDMESSAGE',
      'NO_COMMERCE_READ_WRITE_AND_NO_EXTERNAL_TEST_EVENT'
    ]),...BLOCK
  });
}
