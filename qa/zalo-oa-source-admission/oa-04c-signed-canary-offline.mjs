// TIEN404 V17.ZALO-SOURCE-04C — OFFLINE synthetic signed webhook canary.
// This is NOT a public webhook server. Do not deploy or route provider traffic here.
// Never send to Zalo, call a model, write Commerce data, or fetch arbitrary URLs.
// Native OA signature algorithm is only a candidate until signed provider byte-level UAT.
import {createHash} from 'node:crypto';
import {verifyOaMac} from './oa-admission.mjs';
const OA=/^[0-9]{5,25}$/;
const MAX=128*1024, WINDOW=5*60*1000, REPLAY_TTL=24*3600*1000;
const deny=reason=>Object.freeze({accepted:false,reason,providerVerified:false,liveTrafficAccepted:false,canSend:false,canWriteOrders:false,canActivate:false});
const pending=()=>Object.freeze({accepted:true,stage:'SYNTHETIC_RAW_SIGNATURE_VERIFIED_ONLY',
    providerVerified:false,liveTrafficAccepted:false,canSend:false,canWriteOrders:false,canActivate:false,
    providerSends:0,commerceWrites:0});

/** Private simulation-only trust dependencies:
 * resolveStagingInstallation({appId,oaId}) -> locked, PENDING_REVIEW, synthetic secret record
 * reserveReplay(digest,ttlMs) -> atomic one-use; memory adapter only in tests
 * All other public payload fields are untrusted. No forwarding to any live bot.
 */
export async function simulateOaNoSendWebhook(request,deps){
  if(!deps||deps.executionMode!=='OFFLINE_FIXTURE_ONLY'||deps.liveEnabled!==false||
      typeof deps.resolveStagingInstallation!=='function'||typeof deps.reserveReplay!=='function')
    return deny('HOSTED_OR_UNTRUSTED_ADMISSION_FORBIDDEN');
  const raw=request?.rawBody;
  if(!Buffer.isBuffer(raw)||raw.length<2||raw.length>MAX)return deny('RAW_BODY_REQUIRED');
  let e;
  try{e=JSON.parse(raw.toString('utf8'));}catch{return deny('INVALID_JSON');}
  if(!e||typeof e!=='object'||Array.isArray(e)||e.event_name!=='user_send_text'||
    !OA.test(e.app_id??'')||!OA.test(e.recipient?.id??'')||
    typeof e.sender?.id!=='string'||!e.sender.id||
    typeof e.message?.msg_id!=='string'||!e.message.msg_id||
    typeof e.message?.text!=='string'||e.message.text.length>4000||
    typeof e.timestamp!=='string'||!/^[0-9]{12,16}$/.test(e.timestamp))
    return deny('NOT_A_SUPPORTED_OA_EVENT');
  const timestamp=Number(e.timestamp), now=deps.nowMs??Date.now();
  if(!Number.isSafeInteger(timestamp)||!Number.isSafeInteger(now)||
     Math.abs(now-timestamp)>WINDOW)return deny('STALE_OR_INVALID_TIMESTAMP');
  let installation;
  try{installation=await deps.resolveStagingInstallation({appId:e.app_id,oaId:e.recipient.id});}
  catch{return deny('PRIVATE_REGISTRY_READ_FAILURE');}
  if(!installation||installation.provider!=='ZALO_OA'||
     installation.status!=='PENDING_REVIEW'||installation.noSend!==true||
     installation.catalogReadEnabled!==false||
     installation.appId!==e.app_id||installation.oaId!==e.recipient.id||
     typeof installation.id!=='string'||!installation.id||
     typeof installation.secret!=='string'||installation.secret.length<12)
    return deny('UNTRUSTED_OR_MISMATCHED_OA_INSTALLATION');
  const headers=request.headers;
  if(!headers||typeof headers!=='object'||Array.isArray(headers))return deny('OA_MAC_MISSING');
  const sig=Object.keys(headers).filter(k=>k.toLowerCase()==='x-zevent-signature');
  if(sig.length!==1)return deny('OA_MAC_MISSING_OR_AMBIGUOUS');
  if(!verifyOaMac({appId:installation.appId,secret:installation.secret,
    timestamp,rawBody:raw,signature:headers[sig[0]]}))
    return deny('OA_SIGNATURE_INVALID');
  const replayKey=createHash('sha256').update(
    JSON.stringify(['ZALO_OA_CANDIDATE',installation.id,e.event_name,e.message.msg_id])
  ).digest('hex');
  let reserved;
  try{reserved=await deps.reserveReplay(replayKey,REPLAY_TTL);}
  catch{return deny('DURABLE_REPLAY_UNAVAILABLE');}
  if(reserved!==true)return deny('DUPLICATE_OR_REPLAY');
  return pending();
}
