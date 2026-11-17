/**
 * TIEN404 V17.7H.6 — PRIVATE LOCAL WEBHOOK URL PAIRING, NO TOKEN, NO NETWORK.
 *
 * Compares two operator-provided UI strings:
 * (1) current SAVED Zalo Bot Creator webhook URL;
 * (2) n8n Published POST Webhook Production URL, not Test URL.
 *
 * This does NOT authenticate native getWebhookInfo, owner, PSID, JWT,
 * store authority or webhook delivery. It never reads/sends/changes a Bot.
 */
import {createHash,timingSafeEqual} from 'node:crypto';

const WORKFLOW_ID='yIJk8LvJoLF40Z62';
const EXPECTED_HOST='ngoctien20.app.n8n.cloud';
const deny=reason=>Object.freeze({
 status:'LOCAL_UI_WEBHOOK_PAIRING_NO_GO',reason,
 twoUserProvidedUrlsMatched:false,providerReadbackVerified:false,
 independentlyVerifiedBotOwner:false,canonicalStoreVerified:false,
 realJwtRlsVerified:false,hostedNoSendCanaryAuthorized:false,
 realProviderEventExecuted:false,webhookConfigurationChanged:false,
 providerSends:0,commerceWrites:0,tokenUsed:false,networkCalls:0
});
const normalize=value=>{
 if(typeof value!=='string'||value.length<30||value.length>2048||
    /[%\\\r\n\t]/.test(value))
   throw Error('UNSAFE_LOCAL_WEBHOOK_URL');
 const raw=value.trim();
 if(!/^https:\/\//.test(raw))throw Error('HTTPS_REQUIRED');
 let u;
 try{u=new URL(raw);}catch{throw Error('INVALID_URL')}
 if(u.protocol!=='https:'||u.hostname!==EXPECTED_HOST||
    u.port||u.username||u.password||u.search||u.hash||
    !/^\/webhook\/[A-Za-z0-9._~/-]{8,160}$/.test(u.pathname)||
    u.pathname.includes('//')||u.pathname.split('/').some(x=>x==='..'||x==='.')||
    u.pathname.endsWith('/')||u.pathname.startsWith('/webhook-test/'))
  throw Error('PUBLISHED_POST_WEBHOOK_OR_HOST_MISMATCH');
 return u.origin+u.pathname;
};

export function comparePrivateOperatorWebhookUrls({creatorSavedUrl,n8nPublishedPostUrl}={}){
 let a,b;
 try{a=normalize(creatorSavedUrl);b=normalize(n8nPublishedPostUrl);}
 catch{return deny('INVALID_OR_TEST_ENDPOINT_REJECTED');}
 const left=createHash('sha256').update(a).digest();
 const right=createHash('sha256').update(b).digest();
 const matched=left.length===right.length&&timingSafeEqual(left,right);
 return Object.freeze({
  ...deny(matched?'VISUAL_UI_MATCH_NOT_AUTHENTICATED_PROVIDER_PROOF':
    'WEBHOOK_URL_MISMATCH_STOP_NO_CHANGE'),
  status:matched?'LOCAL_UI_URLS_MATCH_SOURCE_ONLY':'LOCAL_UI_WEBHOOK_PAIRING_NO_GO',
  twoUserProvidedUrlsMatched:matched,
  verifiedProductionWebhookWorkflowId:WORKFLOW_ID,
  // No URL, hash of URL, token or Page/Bot ID returned.
  urlContentsDisclosed:false
 });
}
export const expectedWorkflowId=WORKFLOW_ID;
