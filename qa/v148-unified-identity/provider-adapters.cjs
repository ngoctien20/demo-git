'use strict';
/**
 * TIEN404 V14.8-04 — four native-looking SYNTHETIC adapter fixtures.
 *
 * The HMAC here is TEST-ONLY on mock provider payloads; never equate it with
 * Meta x-hub-signature-256, Zalo Bot/OA signature, or real Website session
 * authentication. Real adapter verification MUST be separately implemented
 * from respective official provider specs, secrets and ownership checks.
 *
 * Do not trust a caller-provided verified:true or store/tenant header.
 * Only a matching per-channel synthetic raw-body HMAC may enter this lab.
 * NO outbound provider sends, no DB, no AI and no real order writes.
 */
const {createHmac,timingSafeEqual}=require('node:crypto');
const {CHANNELS}=require('../v147-custom-studio/studio-core.js');
const NAMES=Object.freeze({
 MESSENGER:'page',ZALO_BOT:'bot_update',ZALO_OA:'oa_event',WEB_WIDGET:'widget_session_event'
});
const noSend=Object.freeze({provider_sends:0,hosted_writes:0,
 actual_order_writes:0,can_send:false,real_provider_auth_verified:false});
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 Object.getPrototypeOf(x)===Object.prototype;
const exact=(o,k)=>plain(o)&&Object.keys(o).length===k.length&&k.every(x=>Object.hasOwn(o,x));
const ref=x=>typeof x==='string'&&/^[a-zA-Z0-9_.:-]{3,90}$/.test(x);
const eventId=x=>typeof x==='string'&&/^[a-zA-Z0-9_.:-]{8,130}$/.test(x);
const reject=reason=>Object.freeze({status:'DENIED',trusted:false,reason,...noSend});
function adaptPayload(channel,obj){
 if(channel==='MESSENGER'){
  if(!exact(obj,['object','entry'])||obj.object!=='page'||
     !Array.isArray(obj.entry)||obj.entry.length!==1)return null;
  const a=obj.entry[0];
  if(!exact(a,['id','messaging'])||!Array.isArray(a.messaging)||a.messaging.length!==1)return null;
  const e=a.messaging[0];
  if(!exact(e,['sender','recipient','message','timestamp_ms'])||
    !exact(e.sender,['id'])||!exact(e.recipient,['id'])||
    !exact(e.message,['mid','text','is_echo'])||e.message.is_echo!==false)return null;
  return {provider_account_ref:a.id,provider_bot_ref:e.recipient.id,
    provider_user_ref:e.sender.id,provider_conversation_ref:'qa_msg_conversation_'+e.sender.id,
    event_id:e.message.mid,event_type:'message',text:e.message.text,
    timestamp_ms:e.timestamp_ms};
 }
 if(channel==='ZALO_BOT'){
  if(!exact(obj,['object','bot_id','account_id','update_id','message','timestamp_ms'])||
     obj.object!=='bot_update'||!exact(obj.message,['from','chat','text'])||
     !exact(obj.message.from,['id'])||!exact(obj.message.chat,['id']))return null;
  return {provider_account_ref:obj.account_id,provider_bot_ref:obj.bot_id,
    provider_user_ref:obj.message.from.id,provider_conversation_ref:obj.message.chat.id,
    event_id:obj.update_id,event_type:'message',text:obj.message.text,timestamp_ms:obj.timestamp_ms};
 }
 if(channel==='ZALO_OA'){
  if(!exact(obj,['object','oa_id','bot_ref','event_id','user','conversation_ref','text','timestamp_ms'])||
    obj.object!=='oa_event'||!exact(obj.user,['id']))return null;
  return {provider_account_ref:obj.oa_id,provider_bot_ref:obj.bot_ref,
    provider_user_ref:obj.user.id,provider_conversation_ref:obj.conversation_ref,
    event_id:obj.event_id,event_type:'message',text:obj.text,timestamp_ms:obj.timestamp_ms};
 }
 if(channel==='WEB_WIDGET'){
  if(!exact(obj,['object','site_id','widget_id','event_id','session','text','timestamp_ms'])||
     obj.object!=='widget_session_event'||
     !exact(obj.session,['user_ref','conversation_ref']))return null;
  return {provider_account_ref:obj.site_id,provider_bot_ref:obj.widget_id,
    provider_user_ref:obj.session.user_ref,provider_conversation_ref:obj.session.conversation_ref,
    event_id:obj.event_id,event_type:'message',text:obj.text,timestamp_ms:obj.timestamp_ms};
 }
 return null;
}
function createSyntheticAdapterLab({mode,router,providerFixtureSecrets}={}){
 if(mode!=='SYNTHETIC_PROVIDER_ENVELOPE_QA_ONLY'||
   typeof router?.processSignedFixture!=='function'||
   typeof router?.signFixture!=='function'||!providerFixtureSecrets)
  throw new Error('QA_PROVIDER_ADAPTER_CONFIG_INVALID');
 const secrets=new Map();
 for(const c of CHANNELS){
  const x=providerFixtureSecrets[c];
  if(!Buffer.isBuffer(x)||x.length<32)throw new Error('QA_PROVIDER_SECRET_NOT_CONFIGURED');
  secrets.set(c,x);
 }
 function signSyntheticProviderFixture(channel,rawBody){
  if(!CHANNELS.includes(channel)||!Buffer.isBuffer(rawBody))
   throw new Error('QA_ONLY_SIGN_INPUT_INVALID');
  return 'sha256='+createHmac('sha256',secrets.get(channel)).update(rawBody).digest('hex');
 }
 function handle({channel,rawBody,signature}={}){
  if(!CHANNELS.includes(channel)||!Buffer.isBuffer(rawBody)||
    rawBody.length<2||rawBody.length>32768||
    typeof signature!=='string'||!/^sha256=[0-9a-f]{64}$/i.test(signature))
   return reject('SYNTHETIC_PROVIDER_AUTH_MISSING');
  const wanted=createHmac('sha256',secrets.get(channel)).update(rawBody).digest();
  const supplied=Buffer.from(signature.slice(7),'hex');
  if(supplied.length!==wanted.length||!timingSafeEqual(wanted,supplied))
   return reject('SYNTHETIC_PROVIDER_AUTH_INVALID');
  let obj;try{obj=JSON.parse(rawBody.toString('utf8'));}
  catch{return reject('SYNTHETIC_PROVIDER_JSON_INVALID');}
  const event=adaptPayload(channel,obj);
  if(!event||!ref(event.provider_account_ref)||!ref(event.provider_bot_ref)||
    !ref(event.provider_user_ref)||!ref(event.provider_conversation_ref)||
    !eventId(event.event_id)||typeof event.text!=='string'||
    !Number.isSafeInteger(event.timestamp_ms))
   return reject('PROVIDER_FIXTURE_SHAPE_INVALID_OR_SCOPE_OVERRIDE');
  const normalized={channel,environment:'qa_staging',...event};
  const normalizedRaw=Buffer.from(JSON.stringify(normalized),'utf8');
  const normalizedSig=router.signFixture(channel,normalizedRaw);
  const r=router.processSignedFixture({
    channel,rawBody:normalizedRaw,signature:normalizedSig
  });
  // No actual provider evidence or sender PII in outward result.
  return Object.freeze({...r,adapter_mode:'SYNTHETIC_PROVIDER_ENVELOPE_QA_ONLY',
   real_provider_auth_verified:false,can_send:false,
   provider_sends:0,hosted_writes:0,actual_order_writes:0});
 }
 return Object.freeze({
  handle,signSyntheticProviderFixture,
  inspect:()=>Object.freeze({channels:CHANNELS.slice(),
    mode:'SYNTHETIC_PROVIDER_ENVELOPE_QA_ONLY',
    provider_documented_signatures_implemented:false,
    real_webhooks_received:0,real_provider_auth_verified:false,
    provider_sends:0,hosted_writes:0,actual_order_writes:0,can_publish:false})
 });
}
module.exports={createSyntheticAdapterLab,NAMES};
