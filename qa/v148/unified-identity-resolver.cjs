'use strict';
/**
 * TIEN404 V14.8 Identity Resolver Candidate — SOURCE-ONLY / SIGNED SYNTHETIC ENVELOPE.
 * Uses test HMAC adapter secret (NOT an actual Meta or Zalo proof).
 * No hosted tables, webhooks, credentials, LLM, Google Sheets, provider sends or order writes.
 *
 * Trust model:
 *   test adapter uses its own server secret to sign exact raw bytes;
 *   registry selects tenant, store, bot-profile from backend-only binding, never client fields;
 *   external user IDs are scoped to provider/binding. Unknown/revoked/expired fails closed.
 * Warning: in-memory replay/cache is NOT atomic or durable across instances.
 */
const {createHmac,timingSafeEqual}=require('node:crypto');
const VERSION='V14.8-IDENTITY-CONTRACT-1.0.0';
const CHANNELS=Object.freeze({
  messenger:'meta',zalo_bot:'zalo',zalo_oa:'zalo',website_widget:'firstparty'
});
const MAX_BODY=16_384,MAX_TEXT=1600,MAX_EVENT_AGE_MS=30*60*1000;
const ID=/^[A-Za-z0-9_:.@-]{2,120}$/;
const BINDS=/^(TENANT_QA_|STORE_QA_|BINDING_QA_|BOT_QA_)[A-Za-z0-9_]+$/;
function insist(ok,code){if(!ok){const e=new Error(code);e.code=code;throw e;}}
function equalKeys(x,fields){
 return x&&typeof x==='object'&&!Array.isArray(x)&&
 Object.getPrototypeOf(x)===Object.prototype&&Object.keys(x).length===fields.length&&
 fields.every(f=>Object.hasOwn(x,f));
}
function toKey(e){return [e.channel,e.environment,e.provider,e.provider_account_ref,e.provider_bot_ref].join('|');}
function cleanText(s){return typeof s==='string'&&s.length>0&&s.length<=MAX_TEXT&& !/[\u0000-\u001f\u007f]/u.test(s);}
function safe(o){return Object.freeze(o);}
function deny(reason){return safe({trusted:false,resolution_status:'DENIED',reason,can_process:false,can_send:false,
   tenant_id:null,store_id:null,bot_profile_id:null,channel_binding_id:null,
   external_identity_id:null,conversation_id:null,fast_path:null,
   real_provider_verified:false,provider_sends:0,order_writes:0,hosted_writes:0});}
function opaque(secret,purpose,...segments){
 return purpose+'_'+createHmac('sha256',secret).update(purpose+'\0'+segments.join('\0')).digest('hex').slice(0,24);
}
function buildResolver({mode,adapterSecret,bindings,products,now=Date.now,ttlMs=60000}={}){
 insist(mode==='OFFLINE_SYNTHETIC_NO_SEND'&&Buffer.isBuffer(adapterSecret)&&adapterSecret.length>=32&&
   Array.isArray(bindings)&&bindings.length>0&&bindings.length<=30&&Array.isArray(products)&&
   typeof now==='function'&&Number.isSafeInteger(ttlMs)&&ttlMs>=100&&ttlMs<=300000,'QA_CONFIG_INVALID');
 const registry=new Map(),lookup=new Map(),catalog=new Map(),replay=new Map();
 let generation=0;const metrics={resolved:0,denied:0,replays:0,cacheHit:0,cacheMiss:0,fast:0,aiPending:0,txnBlocked:0};
 for(const b of bindings){
   insist(equalKeys(b,['id','tenant_id','store_id','bot_profile_id','channel','provider','environment',
    'provider_account_ref','provider_bot_ref','status','binding_version','config_version',
    'subscription_active','store_active','can_process','can_send','greeting','hours']), 'BINDING_SHAPE_INVALID');
   insist(['messenger','zalo_bot','zalo_oa','website_widget'].includes(b.channel) &&
     CHANNELS[b.channel]===b.provider&&b.environment==='qa'&&
     [b.id,b.tenant_id,b.store_id,b.bot_profile_id].every(v=>typeof v==='string'&&BINDS.test(v))&&
     [b.provider_account_ref,b.provider_bot_ref].every(v=>typeof v==='string'&&ID.test(v))&&
     ['active','revoked','disabled'].includes(b.status)&&
     Number.isSafeInteger(b.binding_version)&&b.binding_version>0&&
     Number.isSafeInteger(b.config_version)&&b.config_version>0&&
     typeof b.subscription_active==='boolean'&&typeof b.store_active==='boolean'&&
     typeof b.can_process==='boolean'&&b.can_send===false&&
     cleanText(b.greeting)&&cleanText(b.hours), 'BINDING_CONFIG_INVALID');
   const key=toKey(b);
   insist(!registry.has(key)&&!lookup.has(b.id),'DUPLICATE_ACTIVE_PROVIDER_BINDING');
   registry.set(key,safe({...b}));lookup.set(b.id,key);
 }
 for(const p of products){
   insist(equalKeys(p,['store_id','sku','name','price_vnd','stock','active'])&&
     typeof p.store_id==='string'&&p.store_id.startsWith('STORE_QA_')&&
     /^[A-Z][A-Z0-9]{1,19}$/.test(p.sku)&&cleanText(p.name)&&
     Number.isSafeInteger(p.price_vnd)&&p.price_vnd>=0&&p.price_vnd<=1e12&&
     Number.isSafeInteger(p.stock)&&p.stock>=0&&p.stock<=1e7&&
     typeof p.active==='boolean','QA_PRODUCT_INVALID');
   const key=p.store_id+'|'+p.sku;
   insist(!catalog.has(key),'QA_DUPLICATE_SKU');
   catalog.set(key,safe({...p}));
 }
 function policy(b){
   return b.status==='active'&&b.store_active&&b.subscription_active&&b.can_process;
 }
 function cacheGet(key){
   const rec=lookup.get(key);
   if(!rec)return null;
   const b=registry.get(rec);
   if(!b||!policy(b))return null;
   const c=cache.get(key);
   if(c&&c.version===b.binding_version&&c.generation===generation&&c.expires>now()){
     metrics.cacheHit++;return c.value;
   }
   metrics.cacheMiss++;cache.set(key,{value:b,expires:now()+ttlMs,version:b.binding_version,generation});
   return b;
 }
 const cache=new Map();
 function resolve({rawBody,signature}={}){
  let data;
  try{
   insist(Buffer.isBuffer(rawBody)&&rawBody.length>0&&rawBody.length<=MAX_BODY,'RAW_BYTES_REQUIRED');
   insist(typeof signature==='string'&&/^sha256=[a-f0-9]{64}$/i.test(signature),'SIGNATURE_MISSING');
   const given=Buffer.from(signature.slice(7),'hex');
   const expected=createHmac('sha256',adapterSecret).update(rawBody).digest();
   insist(given.length===expected.length&&timingSafeEqual(given,expected),'SYNTHETIC_ADAPTER_SIGNATURE_INVALID');
   data=JSON.parse(rawBody.toString('utf8'));
   insist(equalKeys(data,['event_id','trace_id','channel','provider','environment','provider_account_ref',
      'provider_bot_ref','provider_user_ref','provider_conversation_ref','event_type','occurred_at','text']),
     'NORMALIZED_EVENT_SHAPE_INVALID');
   insist(CHANNELS[data.channel]===data.provider&&data.environment==='qa'&&
     [data.event_id,data.trace_id,data.provider_account_ref,data.provider_bot_ref,data.provider_user_ref,
      data.provider_conversation_ref].every(x=>typeof x==='string'&&ID.test(x))&&
     data.event_type==='message'&&Number.isSafeInteger(data.occurred_at)&&
     data.occurred_at<=now()+120000&&data.occurred_at>=now()-MAX_EVENT_AGE_MS&&
     cleanText(data.text),'NORMALIZED_EVENT_INVALID');
   // Reject external attempts to pass tenant/store or auth metadata even when test-signed.
   const key=toKey(data);
   const bKey=registry.has(key)?registry.get(key).id:null;
   insist(!!bKey,'TRUSTED_BINDING_NOT_FOUND');
   const b=cacheGet(bKey);
   insist(!!b,'BINDING_REVOKED_SUBSCRIPTION_OR_STORE_INACTIVE');
   const replayKey=key+'|'+data.event_id;
   const digest=createHmac('sha256',adapterSecret).update(rawBody).digest('hex');
   const seen=replay.get(replayKey);
   if(seen&&seen.expires>now()){
     insist(seen.digest===digest,'REPLAY_EVENT_MUTATION');
     metrics.replays++;return deny('DUPLICATE_EVENT_NO_SEND');
   }
   insist(replay.size<=10000,'REPLAY_CAPACITY_EXCEEDED');
   replay.set(replayKey,{digest,expires:now()+MAX_EVENT_AGE_MS});
   const externalIdentityId=opaque(adapterSecret,'EXT_QA',b.id,data.provider_user_ref);
   const conversationId=opaque(adapterSecret,'CONV_QA',b.id,data.provider_user_ref,data.provider_conversation_ref);
   const output=safe({
    trusted:true,resolution_status:'RESOLVED',contract_version:VERSION,
    tenant_id:b.tenant_id,store_id:b.store_id,channel_binding_id:b.id,
    bot_profile_id:b.bot_profile_id,external_identity_id:externalIdentityId,
    conversation_id:conversationId,channel:data.channel,trace_id:data.trace_id,
    configuration_version:b.config_version,policy:safe({can_process:true,can_send:false}),
    can_process:true,can_send:false,real_provider_verified:false,
    provider_sends:0,order_writes:0,hosted_writes:0
   });
   metrics.resolved++;
   return output;
  }catch(error){metrics.denied++;return deny(error.code||'UNTRUSTED_OR_MALFORMED_INPUT');}
 }
 function route({rawBody,signature}={}){
   const resolved=resolve({rawBody,signature});
   if(!resolved.trusted)return resolved;
   const msg=JSON.parse(rawBody.toString('utf8'));
   const binding=registry.get(lookup.get(resolved.channel_binding_id));
   const text=msg.text.trim(),sku=(text.match(/\b[A-Z][A-Z0-9]{1,19}\b/u)||[])[0];
   const denyRoute=(code)=>safe({...resolved,fast_path:'DENIED',route:'BLOCKED',reason:code,
     reply_preview:null,real_llm_calls:0});
   // Even "Fast Path" runs strictly after verified binding+access policy.
   if(/^(?:đặt|mua|xác nhận|tạo đơn|sửa đơn|hủy đơn)\b/iu.test(text)){
     metrics.txnBlocked++;return denyRoute('TRANSACTION_REQUIRES_SEPARATE_AUTHORIZED_WRITE_GATE');
   }
   if(/^(?:xin chào|chào|hello)\b/iu.test(text)){
     metrics.fast++;return safe({...resolved,fast_path:'GREETING',route:'FAST',
        reply_preview:'[QA] '+binding.greeting,real_llm_calls:0});
   }
   if(/(?:giờ mở cửa|mấy giờ|giờ làm việc)/iu.test(text)){
     metrics.fast++;return safe({...resolved,fast_path:'HOURS',route:'FAST',
        reply_preview:'[QA] '+binding.hours,real_llm_calls:0});
   }
   if(sku&&/(?:giá|báo giá|bao nhiêu|tồn kho|còn hàng|mã|sản phẩm)/iu.test(text)){
     const p=catalog.get(resolved.store_id+'|'+sku);
     if(!p||!p.active)return denyRoute('PRODUCT_NOT_FOUND_IN_TRUSTED_STORE');
     metrics.fast++;return safe({...resolved,fast_path:'CATALOG_QUOTE',route:'FAST',
       product:safe({sku:p.sku,name:p.name,price_vnd:p.price_vnd,stock:p.stock}),
       reply_preview:'[QA] '+p.name+': '+p.price_vnd+' VND. Tồn mẫu '+p.stock+'.',
       real_llm_calls:0});
   }
   metrics.aiPending++;
   return safe({...resolved,fast_path:'COMPLEX',route:'AI_PENDING_NO_CALL',
       reply_preview:null,real_llm_calls:0});
 }
 function setFixtureStatus(bindingId,{status,subscription_active,store_active,can_process}={}){
   const key=lookup.get(bindingId);insist(!!key,'UNKNOWN_FIXTURE_BINDING');
   const old=registry.get(key);
   const next={...old};
   if(status!==undefined)next.status=status;
   if(subscription_active!==undefined)next.subscription_active=subscription_active;
   if(store_active!==undefined)next.store_active=store_active;
   if(can_process!==undefined)next.can_process=can_process;
   insist(['active','revoked','disabled'].includes(next.status)&&
     [next.subscription_active,next.store_active,next.can_process].every(x=>typeof x==='boolean'),
     'QA_STATUS_INVALID');
   next.binding_version++;registry.set(key,safe(next));generation++;cache.delete(bindingId);
   return {qaOnly:true,generation,can_send:false};
 }
 function inspect(){
   return safe({mode:'OFFLINE_SYNTHETIC_NO_SEND',contract_version:VERSION,
      knownBindings:registry.size,fixtureCatalogRows:catalog.size,
      boundStores:new Set([...registry.values()].map(x=>x.store_id)).size,
      cacheEntries:cache.size,replayEntries:replay.size,
      ...metrics,hostedReads:0,hostedWrites:0,providerSends:0,
      actualMetaZaloSignaturesVerified:false,realLlmCalls:0,
      durableReplay:false,productionReady:false});
 }
 return safe({resolve,route,inspect,setFixtureStatus});
}
module.exports={buildResolver,VERSION,CHANNELS};
