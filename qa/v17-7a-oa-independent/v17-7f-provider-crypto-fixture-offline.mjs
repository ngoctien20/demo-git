// TIEN404 V17.7F — SYNTHETIC native-provider crypto compatibility.
// Meta: HMAC-SHA256(raw bytes, App Secret), X-Hub-Signature-256: sha256=...
// Zalo Bot: X-Bot-Api-Secret-Token secret header comparison; it is NOT an
// HMAC-signed body and is NOT Zalo OA's X-ZEvent-Signature.
// All secrets MUST have QA_ONLY_ prefix; never pass real provider credentials.
// NO webhook, HTTP, network, DB, credential vault, Commerce or send functionality.
import {createHmac,createHash,timingSafeEqual} from 'node:crypto';

const PROVIDERS=Object.freeze({
  MESSENGER:Object.freeze({header:'x-hub-signature-256',kind:'META_HMAC_SHA256_RAW'}),
  ZALO_BOT:Object.freeze({header:'x-bot-api-secret-token',kind:'ZALO_BOT_SHARED_HEADER'})
});
const HMAC=/^sha256=[0-9a-f]{64}$/;
const QA_SECRET=/^QA_ONLY_[A-Za-z0-9_-]{12,80}$/;
const REF=/^[A-Za-z0-9_-]{8,96}$/;
const MAX=16*1024;
const NO_GO=Object.freeze({
 sourceOnly:true,realProviderVerified:false,
 realProviderOwnerVerified:false,realPageOrBotInstallationVerified:false,
 realSignedEventReceived:false,realReplayServiceVerified:false,
 realRateLimitVerified:false,realStoreJwtRlsVerified:false,
 allowProviderSend:false,allowCommerceRead:false,
 allowOrderWrite:false,allowStockWrite:false,canPublish:false,
 canDeploy:false,actualProviderMessagesReceived:0,
 actualProviderMessagesSent:0,actualOrdersWritten:0
});
const deny=(reason)=>Object.freeze({
 shapeCandidate:false,reason,...NO_GO
});
const shape=(channel)=>Object.freeze({
 shapeCandidate:true,reason:'SYNTHETIC_PROVIDER_CRYPTO_COMPATIBILITY_ONLY',
 channel,syntheticCryptoMatched:true,...NO_GO
});
const equal=(a,b)=>{
 const aBytes=Buffer.from(a,'utf8'),bBytes=Buffer.from(b,'utf8');
 return aBytes.length===bBytes.length&&timingSafeEqual(aBytes,bBytes);
};

/** Each header key is preserved as a separate tuple; disallow HTTP headers
 * with duplicate signature values, including case variations.
 */
function singleHeader(headers,name){
 if(!Array.isArray(headers)||headers.length>40)return null;
 const matched=headers.filter(v=>Array.isArray(v)&&v.length===2&&
    typeof v[0]==='string'&&v[0].toLowerCase()===name);
 if(matched.length!==1||typeof matched[0][1]!=='string')return null;
 return matched[0][1];
}

/** Only an approved private operator test harness can supply these fixture
 * deps. The event ID and expected installation mapping are synthetic and
 * must never be interpreted as proof of native merchant ownership.
 */
export async function inspectSyntheticProviderReceipt(input,expected,deps){
 if(!expected||!deps||expected.mode!=='OFFLINE_SYNTHETIC_CRYPTO'||
    expected.noSend!==true||expected.noCommerceRead!==true||
    expected.noCommerceWrite!==true||expected.noDeploy!==true||
    !QA_SECRET.test(expected.qaOnlySecret??'')||
    !REF.test(expected.installationRef??'')||
    !REF.test(expected.eventRef??'')||
    !REF.test(expected.expectedProviderRef??'')||
    deps.mode!=='OFFLINE_MEMORY_ONLY'||
    typeof deps.reserveOnce!=='function'||
    !Number.isSafeInteger(deps.nowMs)||deps.nowMs<=0)
   return deny('PRIVATE_SYNTHETIC_GATE_MISSING');
 if(!input||!Object.hasOwn(PROVIDERS,input.channel))
   return deny('NO_NATIVE_PROVIDER_CANARY_FOR_THIS_CHANNEL');
 if(input.channel!==expected.channel||
    input.installationRef!==expected.installationRef||
    input.providerRef!==expected.expectedProviderRef||
    input.eventRef!==expected.eventRef)
   return deny('PROVIDER_INSTALLATION_OR_EVENT_SCOPE_MISMATCH');
 if(input.httpMethod!=='POST'||input.contentType!=='application/json'||
    !Buffer.isBuffer(input.rawBody)||input.rawBody.length===0||
    input.rawBody.length>MAX)
   return deny('HTTP_OR_RAW_BYTES_FORMAT_INVALID');
 if(!Number.isSafeInteger(input.receivedAtMs)||
    Math.abs(deps.nowMs-input.receivedAtMs)>5*60*1000)
   return deny('EVENT_RECEIPT_TIME_WINDOW_INVALID');
 const header=singleHeader(input.headers,PROVIDERS[input.channel].header);
 if(!header)return deny('MISSING_OR_DUPLICATE_NATIVE_HEADER');
 let valid=false;
 if(input.channel==='MESSENGER'){
   if(!HMAC.test(header))return deny('META_NATIVE_SIGNATURE_FORMAT_INVALID');
   const digest=createHmac('sha256',expected.qaOnlySecret)
     .update(input.rawBody).digest('hex');
   valid=equal(header,'sha256='+digest);
 } else {
   valid=equal(header,expected.qaOnlySecret);
 }
 if(!valid)return deny('PROVIDER_FIXTURE_CRYPTO_MISMATCH');
 let body;
 try{body=JSON.parse(input.rawBody.toString('utf8'));}
 catch{return deny('BODY_JSON_INVALID_AFTER_AUTH');}
 if(!body||typeof body!=='object'||Array.isArray(body))
   return deny('BODY_JSON_INVALID_AFTER_AUTH');
 const rootClientClaims=['tenantId','tenant_id','storeId','store_id',
   'price','unitPrice','expected_total','isAdmin','ownerApproved'];
 if(rootClientClaims.some(k=>Object.hasOwn(body,k)))
   return deny('PROVIDER_BODY_CANNOT_ASSIGN_STORE_OR_COMMERCE_AUTHORITY');
 if(input.channel==='MESSENGER'){
   if(body.object!=='page'||!Array.isArray(body.entry)||
      body.entry.length!==1||body.entry[0]?.id!==expected.expectedProviderRef||
      !Array.isArray(body.entry[0]?.messaging)||
      body.entry[0].messaging.length!==1||
      body.entry[0].messaging[0]?.recipient?.id!==expected.expectedProviderRef||
      body.entry[0].messaging[0]?.message?.mid!==expected.eventRef)
      return deny('META_PAGE_AND_MESSAGE_BINDING_MISMATCH');
 }else{
   // Official Zalo Bot envelope: { ok:true, result:{ event_name, message } }.
   // The previous V17.7F root event_name fixture was not the provider shape.
   const event=body.result;
   if(body.ok!==true||!event||typeof event!=='object'||
      rootClientClaims.some(k=>Object.hasOwn(event,k))||
      event.event_name!=='message.text.received'||
      event.message?.message_id!==expected.eventRef||
      typeof event.message?.text!=='string'||
      !event.message.text||event.message.text.length>4096||
      typeof event.message?.from?.id!=='string'||
      event.message?.chat?.chat_type!=='PRIVATE'||
      !Number.isSafeInteger(event.message?.date)||
      Math.abs(deps.nowMs-event.message.date)>5*60*1000)
      return deny('ZALO_BOT_TEXT_EVENT_SHAPE_INVALID');
 }
 // A mock reserve() is not hosted durable replay evidence.
 const digest=createHash('sha256').update(JSON.stringify([
   input.channel,expected.installationRef,expected.eventRef
 ])).digest('hex');
 let unique=false;
 try{unique=await deps.reserveOnce(digest);}catch{
   return deny('REPLAY_BACKEND_UNAVAILABLE');
 }
 if(unique!==true)return deny('DUPLICATE_PROVIDER_EVENT_FIXTURE');
 // Never return raw provider sender, message text, payload, secret or Store ID.
 return shape(input.channel);
}

/** HUMAN Access and provider webhook paths must remain separated.
 * Does not register any new endpoint or unlock a provider callback.
 */
export function describeSourceOnlyProviderCanary(){
 return Object.freeze({
   providerChannels:['MESSENGER','ZALO_BOT'],
   merchantEvidenceIngress:'RPC16_ACCESS_DENY_ALL_UNCHANGED',
   providerCanaryIngress:'NOT_DEPLOYED_NOT_PUBLIC',
   humanAccessNotReusedAsProviderWebhook:true,
   outboundConnections:0,commerceConnections:0,
   sourceOnly:true,realProviderVerified:false,
   canDeploy:false,canSend:false,canPublish:false
 });
}
