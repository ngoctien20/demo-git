/**
 * TIEN404 V17.22F — provider-protocol-shaped QA proof -> private Ed25519
 * issuer -> inherited exact-command Commerce NO-SEND plan.
 *
 * SOURCE ONLY, synthetic credentials and registered QA Store fixtures.
 * Meta: HMAC-SHA256 over UNCHANGED raw bytes (not parsed JSON).
 * Zalo BOT: independent shared header token, NOT per-body signature or OA.
 * This module does not call a network API, send messages, write orders or
 * authorize real provider/owner claims. Do not attach it to live n8n webhooks.
 */
import {createHash,createHmac,sign,timingSafeEqual} from 'node:crypto';
import {createPrivateQaIdentityRoute,IDENTITY_ADMISSION_CONTRACT,
 privateQaEventHash,privateQaSenderHash} from './private-channel-identity-admission.mjs';

export const F_CONTRACT='T404_V1722F_NATIVE_SHAPE_PRIVATE_ISSUER_NO_SEND_QA_V1';
const ID=/^[A-Za-z0-9_.:-]{3,128}$/;
const HEX=/^[a-f0-9]{64}$/;
const KEYS=['channel','route_ref','raw_body','headers'];
const HAS=(o,k)=>Object.hasOwn(o,k);
const plain=o=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&Object.getPrototypeOf(o)===Object.prototype;
const exact=(o,keys)=>plain(o)&&Object.keys(o).length===keys.length&&keys.every(k=>HAS(o,k));
const compare=(a,b)=>{
 if(typeof a!=='string'||typeof b!=='string')return false;
 const x=Buffer.from(a,'utf8'),y=Buffer.from(b,'utf8');
 return x.length===y.length&&timingSafeEqual(x,y);
};
const deny=reason=>Object.freeze({route:'DENY_NO_SEND',reason,admission_scope:'SYNTHETIC_ONLY',
 native_provider_verified:false,real_store_owner_verified:false,provider_sends:0,
 commerce_writes:0,model_calls:0});
const HMAC=(secret,v)=>createHmac('sha256',secret).update(v).digest('hex');
const isId=x=>typeof x==='string'&&ID.test(x);
const qaPrefix=s=>/^QA_(ORDER|LINK) /i.test(s);
const parseBody=raw=>{
 if(!Buffer.isBuffer(raw)||raw.length===0||raw.length>4096)throw Error('RAW_BODY_BUFFER_REQUIRED');
 try{
  const v=JSON.parse(raw.toString('utf8'));
  if(!plain(v))throw Error();
  return v;
 }catch{throw Error('INVALID_PROVIDER_JSON')}
};
function normalizeMeta(body,row,now){
 if(!exact(body,['object','entry'])||body.object!=='page'||!Array.isArray(body.entry)||
    body.entry.length!==1)throw Error('META_BATCH_OR_OBJECT_DENIED');
 const e=body.entry[0];
 if(!exact(e,['id','messaging'])||e.id!==row.provider_installation_id||
    !Array.isArray(e.messaging)||e.messaging.length!==1)
   throw Error('META_PAGE_INSTALLATION_OR_BATCH_DENIED');
 const msg=e.messaging[0];
 if(!exact(msg,['sender','recipient','timestamp','message'])||
   !exact(msg.sender,['id'])||!exact(msg.recipient,['id'])||
   !exact(msg.message,['mid','text'])||
   !isId(msg.sender.id)||msg.sender.id===e.id||
   msg.recipient.id!==e.id||!isId(msg.message.mid)||
   !Number.isSafeInteger(msg.timestamp)||Math.abs(msg.timestamp-now)>300000||
   typeof msg.message.text!=='string'||msg.message.text.length<1||msg.message.text.length>140)
   throw Error('META_ACTOR_TEXT_OR_EVENT_TIME_DENIED');
 return {sender_ref:msg.sender.id,message_id:msg.message.mid,
   message_text:msg.message.text,timestamp_ms:msg.timestamp};
}
function normalizeZaloBot(body,row,now){
 if(!exact(body,['ok','result'])||body.ok!==true||
    !exact(body.result,['event_name','message'])||
    body.result.event_name!=='message.text.received')
   throw Error('ZALO_BOT_EVENT_ENVELOPE_DENIED');
 const m=body.result.message;
 if(!exact(m,['from','chat','message_id','text','date'])||
    !exact(m.from,['id','is_bot'])||!exact(m.chat,['chat_type','id'])||
    m.from.is_bot!==false||m.chat.chat_type!=='PRIVATE'||
    !isId(m.from.id)||m.from.id!==m.chat.id||
    !isId(m.message_id)||!Number.isSafeInteger(m.date)||
    Math.abs(m.date-now)>300000||typeof m.text!=='string'||
    m.text.length<1||m.text.length>140)
   throw Error('ZALO_BOT_PRIVATE_ACTOR_TEXT_OR_TIME_DENIED');
 return {sender_ref:m.from.id,message_id:m.message_id,
   message_text:m.text,timestamp_ms:m.date};
}
export function createInMemoryQaReplayClaim(){
 const ledger=new Map();
 return async ({key,digest})=>{
  if(!HEX.test(key||'')||!HEX.test(digest||''))throw Error('QA_REPLAY_KEY_INVALID');
  const existing=ledger.get(key);
  if(existing!==undefined)return existing===digest?'DUPLICATE':'CONFLICT';
  ledger.set(key,digest);
  return 'CLAIMED';
 };
}

/**
 * Every registration is internally approved for SYNTHETIC tests only.
 * secretByInstallation Map carries FAKE test keys in CI. Real provider keys,
 * Merchant proof, JWT, signing key custody, and durable replay are NOT provided.
 */
export function createNativeIssuerNoSendQa({
 registrations,secretByInstallation,trustedIssuerPrivateKey,trustedIssuerPublicKey,
 actorHmacSecret,issuerId,keyId,claimReplay,now=()=>Date.now()
}={}){
 if(!Array.isArray(registrations)||registrations.length===0||
   !(secretByInstallation instanceof Map)||
   trustedIssuerPrivateKey?.asymmetricKeyType!=='ed25519'||
   trustedIssuerPublicKey?.asymmetricKeyType!=='ed25519'||
   !Buffer.isBuffer(actorHmacSecret)||actorHmacSecret.length<32||
   !isId(issuerId)||!isId(keyId)||typeof claimReplay!=='function')
   throw Error('PRIVATE_CI_ISSUER_AND_REPLAY_REQUIRED');

 const registry=new Map();
 for(const row of registrations){
  if(!exact(row,['channel','route_ref','provider_installation_id','tenant','store','scope','status','owner_verified'])||
     !['messenger','zalo_bot'].includes(row.channel)||!isId(row.route_ref)||
     !isId(row.provider_installation_id)||!isId(row.tenant)||!isId(row.store)||
     row.scope!=='SYNTHETIC_ONLY'||row.status!=='QA_APPROVED'||row.owner_verified!==false)
    throw Error('SYNTHETIC_INSTALLATION_ONLY');
  const id=row.channel+':'+row.route_ref;
  if(registry.has(id))throw Error('DUPLICATE_INSTALLATION_SCOPE');
  const secret=secretByInstallation.get(id);
  if(typeof secret!=='string'||Buffer.byteLength(secret,'utf8')<32)
    throw Error('MISSING_PRIVATE_TEST_PROTOCOL_KEY');
  registry.set(id,Object.freeze({...row}));
 }
 const installations=[...registry.values()].map(
  ({channel,route_ref,tenant,store,scope,status,owner_verified})=>
   ({channel,route_ref,tenant,store,scope,status,owner_verified})
 );
 let accepted=0,denied=0,duplicate=0;

 async function receiveNative(envelope){
  try{
   if(!exact(envelope,KEYS)||!Buffer.isBuffer(envelope.raw_body)||
      !plain(envelope.headers)||!['messenger','zalo_bot'].includes(envelope.channel)||
      !isId(envelope.route_ref))throw Error('UNTRUSTED_TRANSPORT_INPUT');
   const row=registry.get(envelope.channel+':'+envelope.route_ref);
   if(!row)throw Error('UNKNOWN_OR_REVOKED_INSTALLATION');
   const secret=secretByInstallation.get(envelope.channel+':'+envelope.route_ref);
   if(envelope.channel==='messenger'){
    const sig=envelope.headers['x-hub-signature-256'];
    if(typeof sig!=='string'||!/^sha256=[a-f0-9]{64}$/.test(sig)||
       !compare('sha256='+HMAC(secret,envelope.raw_body),sig))
      throw Error('META_RAW_BODY_HMAC_DENIED');
   }else{
    // Zalo Bot header secret is NOT a cryptographic signature over body.
    if(!compare(secret,envelope.headers['x-bot-api-secret-token']))
      throw Error('ZALO_BOT_SHARED_HEADER_DENIED');
   }
   const nowMs=now();
   if(!Number.isSafeInteger(nowMs))throw Error('INVALID_ISSUER_TIME');
   const body=parseBody(envelope.raw_body);
   const event=envelope.channel==='messenger'?
     normalizeMeta(body,row,nowMs):normalizeZaloBot(body,row,nowMs);
   const normalized={channel:envelope.channel,route_ref:envelope.route_ref,
     sender_ref:event.sender_ref,message_id:event.message_id,
     message_text:event.message_text,timestamp_ms:event.timestamp_ms};

   if(!qaPrefix(normalized.message_text))
     return Object.freeze({...deny('NON_QA_INBOUND_UNEXECUTED'),
       route:'LEGACY_UNCHANGED_NOT_EXECUTED'});
   const idKey=HMAC(actorHmacSecret,JSON.stringify(['event',
      normalized.channel,normalized.route_ref,normalized.message_id]));
   const digest=HMAC(actorHmacSecret,envelope.raw_body);
   let claim;
   try{claim=await claimReplay({key:idKey,digest,expiresAtMs:nowMs+86400000});}
   catch{throw Error('ATOMIC_REPLAY_CLAIM_NOT_AVAILABLE')}
   if(claim==='DUPLICATE'){duplicate++;return deny('DUPLICATE_EVENT_NOOP');}
   if(claim==='CONFLICT')throw Error('CONFLICTING_EVENT_REPLAY');
   if(claim!=='CLAIMED')throw Error('ATOMIC_REPLAY_CLAIM_NOT_AVAILABLE');

   const payload={
    contract:IDENTITY_ADMISSION_CONTRACT,issuer:issuerId,key_id:keyId,
    scope:'SYNTHETIC_ONLY',channel:normalized.channel,route_ref:normalized.route_ref,
    sender_sha256:privateQaSenderHash(normalized),
    event_sha256:privateQaEventHash(normalized),
    tenant:row.tenant,store:row.store,
    actor_hash:HMAC(actorHmacSecret,JSON.stringify(['actor',
      normalized.channel,normalized.route_ref,normalized.sender_ref])),
    issued_at_ms:nowMs,expires_at_ms:nowMs+30000,
    native_verified:false,owner_verified:false,no_send:true
   };
   const receipt={payload,signature:sign(null,Buffer.from(JSON.stringify(payload)),
      trustedIssuerPrivateKey).toString('base64url')};
   // Immutable exact-version E resolver does the independent Ed25519 proof check.
   const route=createPrivateQaIdentityRoute({
    trustedPublicKey:trustedIssuerPublicKey,issuerId,keyId,installations,
    fetchPrivateReceipt:async()=>receipt,now
   });
   const plan=await route(normalized);
   if(plan.route!=='PRIVATE_QA_ORDER_CORE_NO_SEND')
     throw Error('QA_COMMAND_ROUTER_DENIED');
   accepted++;
   return Object.freeze({...plan,provider_protocol_fixture_validated:true,
     native_provider_verified:false,real_store_owner_verified:false,
     provider_origin_independently_verified:false,
     issuer_receipt_scope:'SYNTHETIC_ONLY',
     external_sends:0,order_writes:0});
  }catch(e){denied++;return deny(e instanceof Error?e.message:'UNKNOWN_QA_ADMISSION_FAILURE')}
 }
 return Object.freeze({receiveNative,getCounters:()=>Object.freeze({
   accepted,denied,duplicate,provider_sends:0,commerce_writes:0,
   model_calls:0,real_provider_owners_verified:0}),
   sendReal:()=>{throw Error('REAL_PROVIDER_SEND_DISABLED')},
   writeCommerce:()=>{throw Error('COMMERCE_WRITE_DISABLED')}
 });
}
