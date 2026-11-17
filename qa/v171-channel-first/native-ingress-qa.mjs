/**
 * TIEN404 V17.1-B native-protocol QA-only ingress verifier.
 * NEVER deploy this fixture secret, registry or in-memory replay guard to production.
 * No network/API/database send; real provider account/installation ownership NOT proven.
 */
import {createHmac,timingSafeEqual,createHash} from 'node:crypto';
export const CONTRACT='T404_V171B_NATIVE_PROTOCOL_QA_NO_SEND_V1';
const requireOk=(c,m)=>{if(!c)throw Error(m)};
const shape=(v,keys)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const FIXTURE_SECRETS=Object.freeze({meta:'QA_ONLY_META_SECRET_NEVER_USE_REAL',zaloBot:'QA_ONLY_ZALO_BOT_HEADER_NEVER_USE_REAL'});
const INSTALLATIONS=Object.freeze({
 'meta:9900000001':Object.freeze({tenant:'QA_T1',store:'QA_STORE_A',bot:'QA_BOT_A',profile:'QA_PROFILE_A_V1'}),
 'meta:9900000002':Object.freeze({tenant:'QA_T1',store:'QA_STORE_B',bot:'QA_BOT_B',profile:'QA_PROFILE_B_V1'}),
 'zalo_bot:QA_BOT_ROUTE_A':Object.freeze({tenant:'QA_T1',store:'QA_STORE_A',bot:'QA_BOT_A',profile:'QA_PROFILE_A_V1'})
});
const CATALOG=Object.freeze({
 QA_STORE_A:Object.freeze({sku:'QA_SKU_001',price_vnd:159000,stock:5,name:'QA áo A'}),
 QA_STORE_B:Object.freeze({sku:'QA_SKU_001',price_vnd:259000,stock:2,name:'QA hàng B'})
});
const ALLOWED_HEADER=/^sha256=[0-9a-f]{64}$/;
const QA_ID=/^QA_[A-Z0-9_]{3,65}$/;
const hex=str=>createHash('sha256').update(str).digest('hex');
const compare=(expected,received)=>{if(typeof received!=='string'||received.length!==expected.length)return false;
const a=Buffer.from(expected,'utf8'),b=Buffer.from(received,'utf8');return timingSafeEqual(a,b);};
const sign=(raw,secret)=>'sha256='+createHmac('sha256',secret).update(Buffer.from(raw,'utf8')).digest('hex');
const parse=raw=>{requireOk(typeof raw==='string'&&Buffer.byteLength(raw,'utf8')<=3500&&raw.length>0,'RAW_BODY_SIZE_INVALID');try{return JSON.parse(raw)}catch{throw Error('BAD_PROVIDER_JSON')}};
const noClientAuthority=x=>{requireOk(x&&typeof x==='object'&&!Array.isArray(x),'INVALID_PROVIDER_EVENT');
for(const key of ['store_id','tenant_id','bot_id','verification_status','trusted_store','trusted_bot'])requireOk(!Object.hasOwn(x,key),'UNTRUSTED_SCOPE_CLAIM');};
export function makeMetaQaEvent({page='9900000001',sender='9900099001',mid='QA_MID_01',text='QA_SKU_001',timestamp=Date.parse('2026-11-17T00:00:00Z'),extra={}}={}){
 const body={object:'page',entry:[{id:page,messaging:[{sender:{id:sender},recipient:{id:page},timestamp,message:{mid,text}}]}],...extra};
 const raw=JSON.stringify(body);
 return Object.freeze({qa_fixture:true,provider:'meta_messenger',route:'QA_META_WEBHOOK_ROUTE',
  raw_body:raw,headers:Object.freeze({'x-hub-signature-256':sign(raw,FIXTURE_SECRETS.meta)})});
}
export function makeZaloBotQaEvent({route='QA_BOT_ROUTE_A',event_name='message.text.received',chat_id='QA_CHAT_01',mid='QA_ZMSG_01',text='QA_SKU_001',extra={}}={}){
 const raw=JSON.stringify({ok:true,result:{event_name,message:{from:{id:'QA_SENDER_01',is_bot:false},chat:{chat_type:'PRIVATE',id:chat_id},message_id:mid,text}},...extra});
 return Object.freeze({qa_fixture:true,provider:'zalo_bot',route,raw_body:raw,
  headers:Object.freeze({'x-bot-api-secret-token':FIXTURE_SECRETS.zaloBot})});
}
export function qaVerificationStatus(){
 return Object.freeze({actual_meta_app_secret_verified:false,real_meta_page_ownership_verified:false,
  actual_zalo_bot_header_verified:false,zalo_oa_signature_verified:false,hosted_store_ownership_verified:false,
  output_transport:'MOCK_ONLY',real_provider_sends:0,paid_model_calls:0,commerce_writes:0});
}
export function createNoSendNativeQa(){
 const seen=new Map(),audit=[];
 function verify(envelope,{now_ms=Date.parse('2026-11-17T00:00:00Z')}={}){
  requireOk(shape(envelope,['qa_fixture','provider','route','raw_body','headers'])&&envelope.qa_fixture===true,'NO_REAL_PROVIDER_EXECUTION');
  requireOk(typeof envelope.route==='string'&&envelope.route.length<=70&&
   envelope.headers&&typeof envelope.headers==='object'&&!Array.isArray(envelope.headers),'UNTRUSTED_ENVELOPE');
  requireOk(Number.isSafeInteger(now_ms),'INVALID_QA_CLOCK');
  const provider=envelope.provider;
  let installation,eventId,recipient,verifiedType='NONE';
  if(provider==='meta_messenger'){
   requireOk(envelope.route==='QA_META_WEBHOOK_ROUTE','WRONG_META_ROUTE');
   const header=envelope.headers['x-hub-signature-256'];
   requireOk(ALLOWED_HEADER.test(header||'')&&compare(sign(envelope.raw_body,FIXTURE_SECRETS.meta),header),'META_HMAC_FAILED');
   const data=parse(envelope.raw_body);noClientAuthority(data);
   requireOk(data.object==='page'&&Array.isArray(data.entry)&&data.entry.length===1,'INVALID_META_OBJECT');
   const entry=data.entry[0];noClientAuthority(entry);
   requireOk(typeof entry.id==='string'&&/^\d{10}$/.test(entry.id)&&Array.isArray(entry.messaging)&&entry.messaging.length===1,'META_PAGE_OR_BATCH_INVALID');
   installation=INSTALLATIONS['meta:'+entry.id];
   requireOk(installation,'META_PAGE_NOT_BOUND');
   const message=entry.messaging[0];noClientAuthority(message);
   requireOk(message.recipient?.id===entry.id&&/^\d{10}$/.test(String(message.sender?.id||'')),'META_RECIPIENT_SENDER_MISMATCH');
   requireOk(Number.isSafeInteger(message.timestamp)&&Math.abs(now_ms-message.timestamp)<=300000,'META_STALE_OR_FUTURE');
   requireOk(message.message?.is_echo!==true&&message.message?.is_deleted!==true,'META_ECHO_OR_DELETE_DENIED');
   requireOk(QA_ID.test(message.message?.mid)&&typeof message.message?.text==='string'&&
    message.message.text.length>0&&message.message.text.length<=300,'META_MESSAGE_NOT_TEXT_QA');
   noClientAuthority(message.message);
   eventId=message.message.mid;recipient=message.sender.id;verifiedType='QA_META_RAW_HMAC_PROTOCOL_ONLY';
  }else if(provider==='zalo_bot'){
   requireOk(envelope.route==='QA_BOT_ROUTE_A','ZALO_BOT_ROUTE_NOT_BOUND');
   requireOk(compare(FIXTURE_SECRETS.zaloBot,envelope.headers['x-bot-api-secret-token']),'ZALO_BOT_HEADER_AUTH_FAILED');
   const data=parse(envelope.raw_body);noClientAuthority(data);
   const e=data.result||{};noClientAuthority(e);
   requireOk(e.event_name==='message.text.received'&&
    e.message?.chat?.chat_type==='PRIVATE'&&e.message?.from?.is_bot!==true&&
    typeof e.message?.text==='string'&&e.message.text.length>0&&e.message.text.length<=300&&
    QA_ID.test(e.message.message_id)&&QA_ID.test(e.message.chat.id),'ZALO_BOT_EVENT_INVALID');
   noClientAuthority(e.message);
   installation=INSTALLATIONS['zalo_bot:'+envelope.route];
   requireOk(installation,'ZALO_BOT_INSTALLATION_NOT_BOUND');
   eventId=e.message.message_id;recipient=e.message.chat.id;verifiedType='QA_ZALO_BOT_HEADER_PROTOCOL_ONLY';
  }else if(provider==='zalo_oa'){
   throw Error('ZALO_OA_X_ZEVENT_SIGNATURE_AND_OWNERSHIP_NOT_VERIFIED');
  }else if(provider==='website'){
   throw Error('WEBSITE_SERVER_SESSION_NOT_VERIFIED');
  }else throw Error('UNSUPPORTED_PROVIDER');
  const replayKey=[provider,envelope.route,installation.store,eventId].join('|');
  const sourceHash=hex(envelope.raw_body);
  if(seen.has(replayKey)){
   requireOk(seen.get(replayKey)===sourceHash,'CONFLICTING_REPLAY_DENIED');
   return Object.freeze({status:'DUPLICATE_BLOCKED',source_verified:verifiedType,real_send:false,commerce_writes:0});
  }
  const product=CATALOG[installation.store];
  requireOk(product&&installation.bot&&installation.profile,'CUSTOM_BOT_BINDING_DENIED');
  const response=Object.freeze({status:'QA_PROTOCOL_BINDING_PASS',channel:provider,
    store:installation.store,tenant:installation.tenant,bot:installation.bot,bot_version:installation.profile,
    sku:product.sku,price_vnd:product.price_vnd,stock:product.stock,source_verified:verifiedType,
    customer_ref:recipient,reply_mode:'MOCK_ONLY_NOT_SENT',provider_signature_account_verified:false,
    hosted_rls_verified:false,real_send:false,paid_calls:0,commerce_writes:0});
  seen.set(replayKey,sourceHash);
  audit.push(Object.freeze({event_sha256:sourceHash,store:installation.store,bot:installation.bot,
   protocol:verifiedType,status:response.status,real_send:false}));
  return response;
 }
 return Object.freeze({verify,getAudit:()=>audit.map(x=>({...x})),getCapabilities:qaVerificationStatus,
  sendReal:()=>{throw Error('REAL_SEND_DISABLED')},callRealModel:()=>{throw Error('PAID_MODEL_DISABLED')},
  writeCommerce:()=>{throw Error('COMMERCE_WRITES_DISABLED')}});
}
