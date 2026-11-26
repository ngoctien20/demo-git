/**
 * TIEN404 V17.20 — Zalo Bot replay-provenance admission contract.
 * SOURCE-ONLY / NO-SEND / NO MERCHANT AUTHORITY. Never wire to a published
 * webhook before independent hosted atomic-claim and ingress-UAT acceptance.
 *
 * Bot API X-Bot-Api-Secret-Token is a shared header secret, not a per-body
 * cryptographic signature. The host must authenticate it BEFORE this module.
 * This code cannot verify the caller's origin and makes no such claim.
 */
import {createHmac} from 'node:crypto';

export const CONTRACT='T404_V1720_ZALO_BOT_REPLAY_ADMISSION_CANDIDATE_V1';
export const SOURCE_MODE='SOURCE_ONLY_NO_EXTERNAL_IO';
const DENY=(reason)=>Object.freeze({status:'DENY',reason,bot_header_attested:false,
  provider_origin_independently_verified:false,merchant_store_verified:false,
  customer_route_approved:false,canSend:false,canWrite:false,
  external_sends:0,commerce_writes:0,model_calls:0});
const ID=/^[A-Za-z0-9_.:-]{3,128}$/;
const isPlain=o=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&
  (Object.getPrototypeOf(o)===Object.prototype||Object.getPrototypeOf(o)===null);
const prohibited=new Set(['__proto__','constructor','prototype','store_id','tenant_id','bot_id',
  'storeId','tenantId','botId','owner','admin','role','permissions','trusted_store',
  'trusted_tenant','trusted_bot','canWrite','canSend','is_verified','webhook_secret',
  'authorization','secret_token']);
const noAuthority=x=>isPlain(x)&&!Object.keys(x).some(k=>prohibited.has(k));
const mac=(key,val)=>createHmac('sha256',key).update(val,'utf8').digest('hex');
const base=Object.freeze({bot_header_attested:true,provider_origin_independently_verified:false,
  merchant_store_verified:false,customer_route_approved:false,
  canSend:false,canWrite:false,external_sends:0,commerce_writes:0,model_calls:0});
function parseEvent(body){
  if(!noAuthority(body))throw Error('INVALID_OR_FORGED_BODY');
  const size=Buffer.byteLength(JSON.stringify(body),'utf8');
  if(size<20||size>8192)throw Error('BODY_SIZE_LIMIT');
  let event=body;
  if(Object.hasOwn(body,'result')){
    if(body.ok!==true||!noAuthority(body.result)||Object.keys(body).some(k=>!['ok','result'].includes(k)))
      throw Error('INVALID_WRAPPED_PROVIDER_EVENT');
    event=body.result;
  }
  if(!noAuthority(event)||event.event_name!=='message.text.received')throw Error('UNSUPPORTED_EVENT');
  const m=event.message;
  if(!noAuthority(m)||!noAuthority(m.from)||!noAuthority(m.chat))
    throw Error('INVALID_MESSAGE_SHAPE_OR_FORGED_SCOPE');
  if(m.from.is_bot===true||m.from.isbot===true)throw Error('BOT_ECHO_DENIED');
  if(m.chat.chat_type!=='PRIVATE')throw Error('NONPRIVATE_EVENT_DENIED');
  if(m.message_type!==undefined&&!['CHAT_TEXT','TEXT'].includes(m.message_type))
    throw Error('UNSUPPORTED_MESSAGE_TYPE');
  if(typeof m.text!=='string'||m.text.length<1||m.text.length>512)
    throw Error('MESSAGE_TEXT_BOUNDS');
  const ids=[m.message_id,m.chat.id,m.from.id];
  if(ids.some(id=>typeof id!=='string'||!ID.test(id)))throw Error('INVALID_PROVIDER_IDS');
  const date=m.date;
  if(!Number.isSafeInteger(date)||date<1_000_000_000_000)
    throw Error('MISSING_OR_INVALID_PROVIDER_EVENT_TIME');
  return {message:m,eventName:event.event_name,eventTime:date};
}
/**
 * trustedIngress can ONLY be constructed inside a server-side, header-
 * authenticated handler; never bind it to a field taken from request JSON.
 * installation is an allowlisted server-side route binding, NOT from payload.
 * claimAtomic must be durable/transactional (e.g., SQL unique constraint or
 * Durable Object), and must never return CLAIMED twice for the same key.
 */
export async function admitBotEvent({
  authenticatedByIngress=false, trustedIngress=null, installation=null,
  providerBody=null, replayKey=null, claimAtomic=null, nowMs=Date.now()
}={}){
  if(authenticatedByIngress!==true||trustedIngress!=='HEADER_SECRET_VERIFIED_SERVER_SIDE')
    return DENY('HEADER_AUTH_NOT_VERIFIED');
  if(!isPlain(installation)||installation.channel!=='zalo_bot'||
     installation.status!=='STAGING_ONLY'||installation.mode!=='NO_SEND'||
     installation.readOnly!==true||installation.serverResolved!==true||
     !ID.test(installation.installationRef||''))
    return DENY('INSTALLATION_NOT_TRUSTED');
  if(typeof replayKey!=='string'||Buffer.byteLength(replayKey,'utf8')<32||
     typeof claimAtomic!=='function'||!Number.isSafeInteger(nowMs))
    return DENY('REPLAY_INFRASTRUCTURE_NOT_READY');
  let e;
  try{e=parseEvent(providerBody);}catch(err){return DENY(err.message||'INVALID_EVENT');}
  const skew=nowMs-e.eventTime;
  if(skew>300000||skew< -120000)return DENY('PROVIDER_EVENT_TIME_OUTSIDE_WINDOW');
  const eventIdentity=JSON.stringify(['zalo_bot',installation.installationRef,e.eventName,e.message.message_id]);
  const replayId=mac(replayKey,'event:v1:'+eventIdentity);
  const digest=mac(replayKey,'body:v1:'+JSON.stringify([
    e.eventName,e.message.message_id,e.message.chat.id,e.message.from.id,
    e.message.text,e.eventTime
  ]));
  // No event ID, text, raw chat ID or provider token is returned/logged.
  let claim;
  try{
    claim=await claimAtomic({key:replayId,digest,expiresAtMs:nowMs+86400000});
  }catch{return DENY('ATOMIC_REPLAY_SERVICE_UNAVAILABLE');}
  if(claim==='DUPLICATE')return Object.freeze({...base,status:'DUPLICATE_NOOP',reason:'EXACT_REPLAY'});
  if(claim==='CONFLICT')return DENY('CONFLICTING_REPLAY');
  if(claim!=='CLAIMED')return DENY('ATOMIC_REPLAY_SERVICE_UNAVAILABLE');
  return Object.freeze({...base,status:'ACCEPTED_SHADOW_ONLY',
    reason:'HEADER_AUTH_AND_FRESH_EVENT_ATOMIC_CLAIM',
    provider_event_digest:replayId.slice(0,16),
    source:'ZALO_BOT_STAGING_ONLY',next_action:'CORE_TECHNICAL_SHADOW_ONLY'});
}
/**
 * TEST ADAPTER ONLY. Not durable, cross-process, or safe for hosted use.
 * Make the backend claim uniquely atomic before any real rollout.
 */
export function createInMemoryQaClaim(){
  const seen=new Map();
  return async ({key,digest})=>{
    if(!seen.has(key)){seen.set(key,digest);return 'CLAIMED';}
    return seen.get(key)===digest?'DUPLICATE':'CONFLICT';
  };
}
