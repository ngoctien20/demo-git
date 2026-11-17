// TIEN404 V17.7A — Zalo OA webhook RAW-BYTE synthetic signature compatibility.
// OA webhook docs describe X-ZEvent-Signature as:
//   "mac=" + SHA256(appId + data + timeStamp + OAsecretKey)
//   with data = JSON event string.
// This offline fixture is NOT a native provider signature or hosted proof.
// Do not route real Zalo traffic through this code or log secrets/payloads.
import {createHash,timingSafeEqual} from 'node:crypto';
import {TextDecoder} from 'node:util';

const ID=/^[0-9]{5,25}$/;
const MSGID=/^[A-Za-z0-9_-]{5,128}$/;
const SIG=/^mac=([a-f0-9]{64})$/;
const UTF8=new TextDecoder('utf-8',{fatal:true});
const rejected=reason=>Object.freeze({
  fixtureAccepted:false,reason,syntheticOnly:true,
  realSignatureVerified:false,oaOwnerVerified:false,storeRlsVerified:false,
  canSend:false,canWriteOrders:false,canPublish:false
});
const accepted=()=>Object.freeze({
  fixtureAccepted:true,reason:'SYNTHETIC_RAW_BODY_MAC_MATCH_NO_SEND',
  syntheticOnly:true,realSignatureVerified:false,oaOwnerVerified:false,
  storeRlsVerified:false,canSend:false,canWriteOrders:false,canPublish:false
});
const secureEqual=(a,b)=>{
  if(!SIG.test(a)||!SIG.test(b))return false;
  return timingSafeEqual(Buffer.from(a.slice(4),'hex'),Buffer.from(b.slice(4),'hex'));
};

/** Synthetic test helper; never call with a real secret. */
export function signSyntheticOaWebhook(rawBody,appId,secret){
  if(!Buffer.isBuffer(rawBody)||!ID.test(appId??'')||
    typeof secret!=='string'||!/^QA_ONLY_[A-Za-z0-9_-]{12,50}$/.test(secret))
    return null;
  let parsed,utf8;
  try{utf8=UTF8.decode(rawBody);parsed=JSON.parse(utf8);}catch{return null;}
  if(parsed?.app_id!==appId||typeof parsed.timestamp!=='string')return null;
  return 'mac='+createHash('sha256').update(appId+utf8+parsed.timestamp+secret,'utf8').digest('hex');
}

/** All deps are OFFLINE test doubles; expected installation comes from
 * a private server-only mapping and never from the event itself.
 * Raw bytes must be preserved unchanged by any future ingress gateway.
 */
export async function inspectSyntheticOaWebhook({rawBody,headers},expected,deps){
  if(!deps||deps.mode!=='OFFLINE_FIXTURE_ONLY'||deps.liveEnabled!==false||
     typeof deps.reserveOnce!=='function'||!expected||
     expected.offlineSecret?.startsWith('QA_ONLY_')!==true||
     !ID.test(expected.appId??'')||!ID.test(expected.oaId??'')||
     expected.noSend!==true||expected.noCommerceWrite!==true||
     !Number.isSafeInteger(deps.nowMs)||deps.nowMs<1)
    return rejected('PRIVATE_QA_WEBHOOK_GATE_MISSING');
  if(!Buffer.isBuffer(rawBody)||rawBody.length<16||rawBody.length>32768||
     !headers||typeof headers!=='object'||Array.isArray(headers))
    return rejected('BAD_RAW_BODY_OR_HEADERS');
  const sigHeaders=Object.entries(headers).filter(([k])=>k.toLowerCase()==='x-zevent-signature');
  if(sigHeaders.length!==1||typeof sigHeaders[0][1]!=='string'||
     !SIG.test(sigHeaders[0][1]))
    return rejected('NATIVE_HEADER_FORMAT_MISSING_OR_DUPLICATE');
  let parsed,text;
  try{text=UTF8.decode(rawBody);parsed=JSON.parse(text);}catch{
    return rejected('INVALID_RAW_JSON_ENCODING');
  }
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)||
    parsed.app_id!==expected.appId||
    parsed.recipient?.id!==expected.oaId||
    parsed.event_name!=='user_send_text')
    return rejected('APP_OA_EVENT_NOT_EXACTLY_BOUND');
  if(typeof parsed.timestamp!=='string'||!/^\d{13}$/.test(parsed.timestamp)||
    !Number.isSafeInteger(Number(parsed.timestamp))||
    Math.abs(deps.nowMs-Number(parsed.timestamp))>300000)
    return rejected('STALE_OR_BAD_EVENT_TIMESTAMP');
  if(!MSGID.test(parsed.message?.msg_id??'')||
     !ID.test(parsed.sender?.id??'')||
     typeof parsed.message?.text!=='string'||parsed.message.text.length===0||
     parsed.message.text.length>4096)
    return rejected('MESSAGE_SHAPE_NOT_ALLOWED');
  const calculated=signSyntheticOaWebhook(rawBody,expected.appId,expected.offlineSecret);
  if(!calculated||!secureEqual(sigHeaders[0][1],calculated))
    return rejected('RAW_BODY_MAC_MISMATCH');
  let claimed;
  try{
    const replayId=createHash('sha256').update(JSON.stringify([
      'OA_FIXTURE_NO_SEND',expected.appId,expected.oaId,parsed.message.msg_id,
      parsed.timestamp
    ])).digest('hex');
    claimed=await deps.reserveOnce(replayId);
  }catch{return rejected('DURABLE_REPLAY_SERVICE_UNAVAILABLE');}
  if(claimed!==true)return rejected('DUPLICATE_ZALO_OA_EVENT');
  return accepted();
}
