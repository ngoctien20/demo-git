/**
 * TIEN404 V17.7H.4 — real-provider-shaped PRIVATE OPERATOR readback bridge.
 * Reuses H.2/H.3 evidence classifications; never promotes Bot-token possession
 * into Bot Creator human ownership, Merchant Store permission or live UAT GO.
 *
 * No provider HTTP code here. A separate pinned HTTPS transport is injectable.
 * Do not submit token, Bot ID, webhook URL, raw provider JSON or logs to ChatGPT,
 * GitHub, CI, n8n execution data or any customer-facing system.
 */
import {createHash} from 'node:crypto';

const BOT_ID=/^[0-9]{8,24}$/;
const SHA=x=>createHash('sha256').update(x,'utf8').digest('hex');
const METHOD_SCOPE='OWNER_CONSENT_TWO_READONLY_METHODS_ONLY';
const hard=(reason,extra={})=>Object.freeze({
 status:'PRIVATE_READBACK_NO_GO',reason,
 providerReadbackOnly:true,storeOwnerVerified:false,
 botCreatorOwnerIndependentlyVerified:false,realSameStoreVerified:false,
 realJwtRlsVerified:false,hostedNoSendCanaryAuthorized:false,
 realProviderEventAuthorized:false,canSend:false,canSetWebhook:false,
 canDeleteWebhook:false,canGetUpdates:false,canReadOrders:false,
 canWriteOrders:false,canDeploy:false,methodCallsAttempted:0,...extra
});
const record=(status,reason,extra={})=>Object.freeze({
 ...hard(reason,extra),status
});
const response=(v,k)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&
 Object.getPrototypeOf(v)===Object.prototype&&v.ok===true&&
 v.result!==null&&typeof v.result==='object'&&!Array.isArray(v.result)&&
 Object.hasOwn(v.result,k);
const saneWebUrl=x=>{
 if(x==='')return true;
 if(typeof x!=='string'||x.length>2048)return false;
 try{
  const u=new URL(x);
  return u.protocol==='https:'&&u.hostname.length>0&&
   !u.username&&!u.password&&!u.hash;
 }catch{return false}
};

/**
 * "approval" must be issued by the human running a local private operator
 * command, not a provider/user webhook. It is execution consent, NOT proof.
 *
 * Returns ONLY hashed local comparison evidence and DENY release flags.
 * Genuine network origin can ONLY be certified by an independently reviewed
 * private transport trace; injection/mock success is not real provider evidence.
 */
export async function inspectPrivateTwoMethodBotReadback({
 expectedBotId,approval,secretBroker,transport,now=()=>Date.now()
}={}){
 if(!BOT_ID.test(expectedBotId||'')||
    approval!=='OWNER_CONSENT_TWO_READONLY_METHODS_ONLY'||
    !secretBroker||secretBroker.kind!=='LOCAL_EPHEMERAL_OPERATOR_SECRET'||
    typeof secretBroker.withSecret!=='function'||
    !transport||transport.kind!=='PINNED_ZALO_HTTPS_POST_READONLY'||
    typeof transport.postReadOnly!=='function')
  return hard('OPERATOR_APPROVAL_BOT_ID_OR_TRANSPORT_MISSING');

 let calls=0,me,wh;
 try{
  await secretBroker.withSecret(async token=>{
   if(typeof token!=='string'||token.length<20||token.length>512||
      !/^[A-Za-z0-9._:-]+$/.test(token))
    throw Error('INVALID_TOKEN_SHAPE');
   // ONLY two read-only methods in the official Bot API contract.
   calls++;me=await transport.postReadOnly('getMe',token);
   if(!response(me,'id')||String(me.result.id)!==expectedBotId||
      typeof me.result.account_name!=='string'||
      me.result.account_name.length<3||me.result.account_name.length>100)
    throw Error('GETME_ID_MISMATCH');
   calls++;wh=await transport.postReadOnly('getWebhookInfo',token);
  });
 }catch{
  // Never log transport exceptions, errors, response bodies or token URLs.
  return hard('REAL_PROVIDER_READBACK_FAILED_OR_BOT_ID_MISMATCH_REDACTED',{
   methodCallsAttempted:calls});
 }
 if(calls!==2||!response(wh,'url')||
    typeof wh.result.url!=='string'||!saneWebUrl(wh.result.url)||
    !Number.isSafeInteger(wh.result.updated_at))
  return hard('GETWEBHOOKINFO_UNTRUSTED_REDACTED',{methodCallsAttempted:calls});

 const timestamp=now();
 if(!Number.isSafeInteger(timestamp)||timestamp<=0)
  return hard('LOCAL_OPERATOR_CLOCK_INVALID',{methodCallsAttempted:calls});
 const webhookConfigured=wh.result.url.length>0;
 return record(webhookConfigured?
   'EXISTING_WEBHOOK_HARD_STOP_OWNER_UNVERIFIED':
   'PRIVATE_TWO_READONLY_RESPONSES_MATCH_BOT_OWNER_UNVERIFIED',
  webhookConfigured?'CURRENT_WEBHOOK_PRESERVE_AND_STOP':
    'PRIVATE_READBACK_REQUIRES_INDEPENDENT_OWNER_ATTESTATION',{
   methodCallsAttempted:calls,botIdSha256:SHA(expectedBotId),
   webhookConfigured,webhookUrlSha256:webhookConfigured?SHA(wh.result.url):null,
   localObservedAtMs:timestamp,expectedPrivateMethods:Object.freeze(['getMe','getWebhookInfo']),
   // These are operator-local transport outcomes, NOT independent provider/owner attestation.
   selfReportedTransportKind:'PINNED_ZALO_HTTPS_POST_READONLY',
   originalBotCreatorSessionIndependentlyAttested:false
  });
}
export const privateTwoMethodConsentScope=METHOD_SCOPE;
