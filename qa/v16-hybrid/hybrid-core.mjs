/**
 * TIEN404 V16.0/V16.1 — Synthetic ONLY Worker Gateway / Queue / Router.
 * Never deploy on real Messenger, Zalo or website routes.
 * NO provider send, NO paid model API, NO Commerce tool, NO data/credential writes.
 * Production needs verified per-provider raw signature adapters, persistent
 * atomic ledger/outbox, independently approved tenant resolver and Store RLS.
 */
export const CONTRACT='T404_V16_SYNTHETIC_EVENT_V1';
export const QUEUE_CONTRACT='T404_V16_SYNTHETIC_QUEUE_V1';
export const REQUIRED_MODE='SYNTHETIC_ONLY_NO_SEND';
export const QA_PATH='/__qa/v16/event';
const TEXT_SET=new Set([
 'xin chao','gio mo cua','dia chi shop','ao thun trang m gia bao nhieu',
 'tu van ao','toi muon dat hang','sua don hang','xin gia ao thun',
 'so sanh ao','can gap nhan vien'
]);
const MODEL_IDS=new Set(['gpt-6-luna','gemini-2.5-flash-lite','gpt-5-mini']);
const PROPS=['contract','channel','account_id','event_id','occurred_at','synthetic_text','synthetic'];
const CHANNELS=new Set(['messenger','zalo','website']);
const exact=(v,keys)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&
 Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const error=(code,status)=>Response.json({status:'DENIED',reason:code,no_send:true},{status});
const hexToBytes=hex=>new Uint8Array(hex.match(/.{2}/g).map(x=>Number.parseInt(x,16)));
const encoder=new TextEncoder();
function validFixture(o,now){
 if(!exact(o,PROPS)||o.contract!==CONTRACT||o.synthetic!==true||
    !CHANNELS.has(o.channel)||typeof o.account_id!=='string'||
    !/^QA_[A-Z0-9_]{4,48}$/.test(o.account_id)||
    typeof o.event_id!=='string'||!/^QA-EVENT-[A-Z0-9_-]{4,48}$/.test(o.event_id)||
    typeof o.synthetic_text!=='string'||!TEXT_SET.has(o.synthetic_text)||
    typeof o.occurred_at!=='string'||!/^20\d\d-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(o.occurred_at))
    return false;
 const t=Date.parse(o.occurred_at);
 return Number.isFinite(t)&&Math.abs(now-t)<=300000;
}
export async function verifyQaHmac(raw,sig,secret){
 if(typeof sig!=='string'||!/^sha256=[a-f0-9]{64}$/.test(sig)||
    typeof secret!=='string'||secret.length<16||secret.length>128)return false;
 try {
  const key=await crypto.subtle.importKey('raw',encoder.encode(secret),
   {name:'HMAC',hash:'SHA-256'},false,['verify']);
  return await crypto.subtle.verify('HMAC',key,
   hexToBytes(sig.slice(7)),encoder.encode(raw));
 }catch{return false}
}
export async function signQaHmac(raw,secret){
 const key=await crypto.subtle.importKey('raw',encoder.encode(secret),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(raw)));
 return 'sha256='+Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
}
export async function opaqueKey(event){
 const bytes=encoder.encode(event.channel+'\0'+event.account_id+'\0'+event.event_id);
 const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
 return Array.from(hash,b=>b.toString(16).padStart(2,'0')).join('');
}
export function routePreview(text,shop){
 if(!TEXT_SET.has(text))return Object.freeze({route:'DENY_UNKNOWN_SYNTHETIC_TEXT'});
 if(/dat hang|sua don hang/.test(text))
  return Object.freeze({route:'COMMERCE_BLOCKED',requires:'OWNER_JWT_RLS_AND_CONFIRMATION'});
 if(text==='xin chao'&&typeof shop?.greeting==='string'&&shop.greeting.length<=100)
  return Object.freeze({route:'FAST_FAQ_PREVIEW',template:'TRUSTED_SHOP_GREETING'});
 if(text==='gio mo cua'||text==='dia chi shop')
  return Object.freeze({route:'FAST_FAQ_NEEDS_VERIFIED_SHOP_FACTS'});
 if(/gia|ao thun/.test(text))
  return Object.freeze({route:'FAST_CATALOG_NEEDS_LIVE_READONLY_DATA'});
 if(text==='can gap nhan vien')
  return Object.freeze({route:'SUPPORT_TICKET_PREVIEW_ONLY'});
 return Object.freeze({route:'AI_API_PREVIEW_ONLY'});
}
export function chooseModelPreview(route,models=['gpt-6-luna']){
 if(!Array.isArray(models)||models.length===0||
    models.some(m=>typeof m!=='string'||!MODEL_IDS.has(m)))
  return Object.freeze({status:'BLOCKED',reason:'TRUSTED_MODEL_ALLOWLIST_REQUIRED'});
 return Object.freeze({
  status:'PREVIEW_ONLY',
  model:route==='AI_API_PREVIEW_ONLY'?models[0]:null,
  invokeApi:false,providerTokensUsed:0
 });
}
export function costPreview({messages,inputTokens,outputTokens,inputPerMillion,outputPerMillion}){
 const a=[messages,inputTokens,outputTokens,inputPerMillion,outputPerMillion];
 if(a.some(x=>!Number.isFinite(x)||x<0)||!Number.isSafeInteger(messages)||
    !Number.isSafeInteger(inputTokens)||!Number.isSafeInteger(outputTokens))
  throw Error('INVALID_COST_ASSUMPTIONS');
 return messages*(inputTokens*inputPerMillion+outputTokens*outputPerMillion)/1000000;
}
export async function handleQaFetch(request,env,now=Date.now()){
 if(env?.V16_MODE!==REQUIRED_MODE)return error('QA_MODE_NOT_CONFIGURED',503);
 const url=new URL(request.url);
 if(url.pathname!==QA_PATH||request.method!=='POST')return error('QA_ONLY_ROUTE',404);
 if(!String(request.headers.get('content-type')||'').startsWith('application/json'))
  return error('JSON_REQUIRED',415);
 const raw=await request.text();
 if(raw.length>4096)return error('SYNTHETIC_PAYLOAD_TOO_LARGE',413);
 if(!await verifyQaHmac(raw,request.headers.get('x-t404-qa-signature'),
                        env?.QA_HMAC_SECRET))
  return error('INVALID_QA_SIGNATURE',401);
 let event;
 try{event=JSON.parse(raw)}catch{return error('JSON_INVALID',400)}
 if(!validFixture(event,now))return error('NOT_A_SYNTHETIC_FIXTURE',400);
 // Registry must be external, trusted and bound to a verified channel account.
 // The event is NEVER allowed to supply tenant/store/role/price/stock.
 if(!env.QA_REGISTRY||typeof env.QA_REGISTRY.lookup!=='function')
  return error('TRUSTED_ACCOUNT_REGISTRY_UNAVAILABLE',503);
 const shop=await env.QA_REGISTRY.lookup(event.channel,event.account_id);
 if(!exact(shop,['tenant_id','store_id','active','greeting'])||
   !/^QA_TENANT_[A-Z0-9_]+$/.test(shop.tenant_id)||
   !/^QA_STORE_[A-Z0-9_]+$/.test(shop.store_id)||shop.active!==true)
  return error('UNVERIFIED_CHANNEL_STORE_SCOPE',403);
 const scope=shop.tenant_id+':'+shop.store_id+':'+event.channel;
 if(!env.QA_LIMITS||typeof env.QA_LIMITS.admit!=='function'||
    !await env.QA_LIMITS.admit(scope,now))
  return error('SHOP_RATE_LIMIT_OR_GUARD_UNAVAILABLE',429);
 if(!env.QA_OUTBOX||typeof env.QA_OUTBOX.reserve!=='function'||
   typeof env.QA_OUTBOX.markEnqueued!=='function'||
   typeof env.QA_OUTBOX.retryable!=='function'||
   !env.QA_QUEUE||typeof env.QA_QUEUE.send!=='function')
  return error('PERSISTENT_OUTBOX_REQUIRED',503);
 const key=await opaqueKey(event);
 const message={contract:QUEUE_CONTRACT,key,scope,channel:event.channel,
  tenant_id:shop.tenant_id,store_id:shop.store_id,
  synthetic_text:event.synthetic_text,qa_only:true,
  accepted_at_ms:now};
 const reservation=await env.QA_OUTBOX.reserve(key,message);
 if(reservation==='DUPLICATE')return Response.json({status:'DUPLICATE_ACK',no_send:true},{status:202});
 if(reservation==='BUSY')return error('IN_PROGRESS_RETRY_LATER',503);
 if(reservation!=='RESERVED')return error('OUTBOX_CLAIM_FAILED',503);
 try{
  await env.QA_QUEUE.send(message);
  await env.QA_OUTBOX.markEnqueued(key);
  return Response.json({status:'QA_ACCEPTED_TO_QUEUE',no_send:true},{status:202});
 }catch{
  // If queue.send committed before the error, a duplicate delivery is possible.
  // Consumer must therefore use an independent durable idempotency key.
  await env.QA_OUTBOX.retryable(key);
  return error('QUEUE_NOT_CONFIRMED_RETRYABLE',503);
 }
}
export async function handleQaBatch(batch,env){
 if(env?.V16_MODE!==REQUIRED_MODE||!env?.QA_PREVIEWS||
    typeof env.QA_PREVIEWS.recordOnce!=='function')
  throw Error('NO_SEND_QA_MODE_REQUIRED');
 for(const msg of batch.messages){
  const x=msg.body;
  if(!exact(x,['contract','key','scope','channel','tenant_id','store_id',
      'synthetic_text','qa_only','accepted_at_ms'])||
     x.contract!==QUEUE_CONTRACT||!x.qa_only||
     !/^[a-f0-9]{64}$/.test(x.key)||!TEXT_SET.has(x.synthetic_text)||
     !CHANNELS.has(x.channel)||typeof x.scope!=='string'||
     x.scope!==x.tenant_id+':'+x.store_id+':'+x.channel){
   if(typeof msg.retry==='function')msg.retry();
   continue;
  }
  const preview=routePreview(x.synthetic_text,{
   greeting:'Xin chao tu cua hang QA'
  });
  // Mock QA-only effect; actual queue has at-least-once and no ordering
  // guarantee. Real send/order requires a separate transactional ledger.
  await env.QA_PREVIEWS.recordOnce(x.key,{
   route:preview.route,scope:x.scope,no_send:true,no_model_call:true,
   commerce_write:false
  });
  if(typeof msg.ack==='function')msg.ack();
 }
}
const prohibited=()=>{throw Error('V16_NO_LIVE_COMMERCE_OR_PROVIDER_EXECUTOR')};
export const performRealProviderSend=prohibited;
export const executeRealCommerce=prohibited;
export const callPaidModel=prohibited;
export const promoteProduction=prohibited;
