/**
 * TIEN404 V17.22B — Proposed opt-in native QA command router.
 * SOURCE ONLY; NEVER route untrusted webhook JSON into an AI order tool.
 * The real resolver callback MUST implement provider-native verification, replay,
 * server-controlled Page/Bot-to-Store binding and channel account hashing.
 * No paid AI calls, no writes, no provider send, no live n8n workflow change.
 */
export const ROUTER_CONTRACT='T404_V1722B_EXACT_QA_ORDER_COMMAND_ROUTER_V1';
const SHAPE=['channel','route_ref','sender_ref','message_id','message_text','timestamp_ms'];
const VALID_ID=/^[A-Za-z0-9_.:-]{3,128}$/;
const HEX=/^[0-9a-f]{64}$/;
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const exact=x=>plain(x)&&Object.keys(x).length===SHAPE.length&&SHAPE.every(k=>Object.hasOwn(x,k));
const deny=reason=>Object.freeze({route:'DENY_NO_SEND',reason,provider_sends:0,commerce_writes:0,model_calls:0});
const qaPrefix=t=>/^\s*(QA_|T404_)/i.test(t||'');
const commands=[
 {type:'ORDER_PREVIEW',channels:['messenger'],re:/^QA_ORDER PREVIEW (QA_SKU_[A-Z0-9_]{1,40}) ([1-9]\d?)$/,keys:['sku','quantity']},
 {type:'ORDER_CONFIRM',channels:['messenger'],re:/^QA_ORDER CONFIRM (QA-PREV-\d{5})$/,keys:['preview_ref']},
 {type:'ORDER_STATUS',channels:['messenger','zalo_bot'],re:/^QA_ORDER STATUS (QA-ORD-\d{5})$/,keys:['order_ref']},
 {type:'LINK_START',channels:['messenger'],re:/^QA_LINK START (QA-ORD-\d{5})$/,keys:['order_ref']},
 {type:'LINK_CODE',channels:['zalo_bot'],re:/^QA_LINK CODE ([0-9]{6})$/,keys:['one_time_code']},
 {type:'LINK_CONFIRM',channels:['messenger'],re:/^QA_LINK CONFIRM (QA-LINK-\d{5}) ([0-9]{6})$/,keys:['link_ref','one_time_code']},
 {type:'LINK_REVOKE',channels:['messenger'],re:/^QA_LINK REVOKE$/,keys:[]}
];
export function createQaCommandRouter({resolveTrustedContext}={}){
 if(typeof resolveTrustedContext!=='function')throw Error('PRIVATE_TRUST_RESOLVER_REQUIRED');
 return async function route(raw){
   if(!exact(raw)||!['messenger','zalo_bot'].includes(raw.channel)||
      !VALID_ID.test(raw.route_ref)||!VALID_ID.test(raw.sender_ref)||
      !VALID_ID.test(raw.message_id)||!Number.isSafeInteger(raw.timestamp_ms)||
      typeof raw.message_text!=='string'||raw.message_text.length<1||raw.message_text.length>400)
     return deny('UNTRUSTED_MESSAGE_SHAPE');
   const isQa=qaPrefix(raw.message_text);
   if(!isQa)return Object.freeze({route:'LEGACY_UNCHANGED_NOT_EXECUTED',provider_sends:0,commerce_writes:0,model_calls:0});
   if(raw.message_text.length>140)return deny('QA_MESSAGE_TOO_LONG');
   let trusted;
   try{trusted=await resolveTrustedContext(raw)}catch{return deny('PROVIDER_OR_STORE_VERIFICATION_UNAVAILABLE');}
   if(!plain(trusted)||trusted.provider_verified!==true||
      trusted.mode!=='STAGING_QA_NO_SEND'||trusted.channel!==raw.channel||
      trusted.route_ref!==raw.route_ref||trusted.account_installed!==true||
      !VALID_ID.test(trusted.tenant)||!VALID_ID.test(trusted.store)||
      !HEX.test(trusted.actor_hash||''))return deny('UNVERIFIED_PROVIDER_OR_STORE');
   for(const c of commands){
     const m=c.re.exec(raw.message_text);
     if(!m)continue;
     if(!c.channels.includes(raw.channel))return deny('COMMAND_CHANNEL_NOT_ALLOWED');
     const params={};
     c.keys.forEach((key,i)=>params[key]=key==='quantity'?Number(m[i+1]):m[i+1]);
     return Object.freeze({route:'PRIVATE_QA_ORDER_CORE_NO_SEND',command:c.type,
       params:Object.freeze(params),tenant:trusted.tenant,store:trusted.store,
       actor_hash:trusted.actor_hash,channel:raw.channel,
       provider_sends:0,commerce_writes:0,model_calls:0});
   }
   return deny('UNKNOWN_OR_MALFORMED_QA_COMMAND');
 };
}
