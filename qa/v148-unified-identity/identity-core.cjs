'use strict';
/**
 * TIEN404 V14.8-01/02 — Unified Identity Resolver (OFFLINE QA CONTRACT).
 *
 * Reuses the EXACT V14.7 Shop A/B/C Studio fixtures/configurations.
 * No real Meta/Zalo signature scheme is claimed. The signed fixture protocol
 * uses an internal synthetic HMAC envelope for all 4 channels solely so
 * source-level isolation, contract validation, dedupe, and policy can be tested.
 * A real provider adapter MUST independently verify its own signature/session.
 *
 * External IDs are always provider+environment+account+bot scoped.
 * Internal tenant/store/channel/bot/customer/conversation IDs are server-derived.
 * Never auto-link people on different channels by name/phone/PSID.
 * Process-local caching/replay is NOT durable across workers.
 * No HTTP, credentials, database, AI provider, Meta/Zalo send, Orders writes.
 */
const {createHmac,timingSafeEqual}=require('node:crypto');
const {createStudio,FIXTURES,CHANNELS}=require('../v147-custom-studio/studio-core.js');
const CONTRACT_VERSION='v14.8.0-candidate.1';
const MODE='OFFLINE_SIGNED_FIXTURE_ONLY';
const NO_SEND=Object.freeze({can_send:false,can_write_orders:false,
  provider_sends:0,hosted_writes:0,real_llm_calls:0,actual_order_writes:0});
const REQUIRED_EVENT=Object.freeze(['channel','environment','provider_account_ref',
 'provider_bot_ref','provider_user_ref','provider_conversation_ref',
 'event_id','event_type','text','timestamp_ms']);
const ID=/^[a-zA-Z0-9_.:-]{3,90}$/;
const EVENT=/^[a-zA-Z0-9_.:-]{8,130}$/;
const SKU=/\b[A-Z][0-9]{3,8}\b/u;
const CACHE_TTL_MS=15000;
function deny(reason,extra={}){
 return Object.freeze({contract_version:CONTRACT_VERSION, trusted:false,
  status:'DENIED', reason, ...NO_SEND,...extra});
}
function validId(v,rx=ID){return typeof v==='string'&&rx.test(v);}
function plain(v){return v!==null&&typeof v==='object'&&!Array.isArray(v)&&
 Object.getPrototypeOf(v)===Object.prototype;}
function exact(v,fields){
 return plain(v)&&Object.keys(v).length===fields.length&&
  fields.every(k=>Object.hasOwn(v,k));
}
function createUnifiedQaRouter({mode,secretByChannel,bindings,studio=createStudio(),
 now=Date.now,maxReplay=5000,ttlMs=30*60*1000}={}){
 if(mode!==MODE||!secretByChannel||!Array.isArray(bindings)||
  !bindings.length||bindings.length>60||typeof studio?.get!=='function'||
  typeof now!=='function'||!Number.isInteger(maxReplay)||
  maxReplay<10||maxReplay>20000||!Number.isSafeInteger(ttlMs)||
  ttlMs<60000||ttlMs>36*3600000)
  throw new Error('QA_RESOLVER_CONFIG_INVALID');
 const secrets=new Map();
 for(const channel of CHANNELS){
  const key=secretByChannel[channel];
  if(!Buffer.isBuffer(key)||key.length<32)
   throw new Error('QA_CHANNEL_TEST_SIGNING_KEY_MISSING');
  secrets.set(channel,key);
 }
 const registry=new Map(),byId=new Map();
 for(const b of bindings){
  const keys=['id','channel','environment','provider_account_ref','provider_bot_ref',
   'tenant_id','store_id','bot_profile_id','shop','status',
   'subscription_active','verified_until_ms','configuration_version'];
  if(!exact(b,keys)||!CHANNELS.includes(b.channel)||
   b.environment!=='qa_staging'||!validId(b.id)||
   !validId(b.provider_account_ref)||!validId(b.provider_bot_ref)||
   !validId(b.bot_profile_id)||!Number.isSafeInteger(b.verified_until_ms)||
   !Number.isInteger(b.configuration_version)||b.configuration_version<1||
   typeof b.subscription_active!=='boolean'||
   !['ACTIVE','PAUSED','REVOKED'].includes(b.status)||
   !Object.hasOwn(FIXTURES,b.shop)||
   b.tenant_id!==FIXTURES[b.shop].tenantId||
   b.store_id!==FIXTURES[b.shop].storeId)
   throw new Error('QA_BINDING_REGISTRY_INVALID');
  const scope=[b.channel,b.environment,b.provider_account_ref,b.provider_bot_ref].join('|');
  if(registry.has(scope)||byId.has(b.id))
   throw new Error('QA_ACTIVE_BINDING_AMBIGUOUS');
  const snap=Object.freeze({...b});
  registry.set(scope,snap);byId.set(b.id,scope);
 }
 const storePolicies=new Map(Object.keys(FIXTURES).map(shop=>[shop,{status:'ACTIVE',subscriptionActive:true,version:1}]));
 const replay=new Map(),profileCache=new Map();
 const counts={accepted:0,denied:0,duplicates:0,cacheHit:0,cacheMiss:0};
 function signFixture(channel,rawBody){
  if(!CHANNELS.includes(channel)||!Buffer.isBuffer(rawBody))throw new Error('QA_SIGN_ARGUMENT_INVALID');
  return 'sha256='+createHmac('sha256',secrets.get(channel)).update(rawBody).digest('hex');
 }
 function verify(channel,rawBody,signature){
  if(!CHANNELS.includes(channel)||!Buffer.isBuffer(rawBody)||
   rawBody.length<2||rawBody.length>32768)return false;
  if(typeof signature!=='string'||!/^sha256=[0-9a-f]{64}$/i.test(signature))return false;
  const expected=createHmac('sha256',secrets.get(channel)).update(rawBody).digest();
  const given=Buffer.from(signature.slice(7),'hex');
  return given.length===expected.length&&timingSafeEqual(given,expected);
 }
 function profileFor(binding){
  // Authorization/binding status is NEVER read from cache.
  const fresh=studio.get(binding.shop,binding.channel);
  if(fresh.tenant_id!==binding.tenant_id||fresh.store_id!==binding.store_id||
   fresh.channel!==binding.channel||fresh.policy_version!=='GLOBAL_CORE_LOCKED'||
   fresh.approval_status!=='EXPERIMENTAL'||
   !Number.isInteger(fresh.bot_profile_version)||
   fresh.bot_profile_version<1)
   throw new Error('QA_BOT_PROFILE_SCOPE_OR_VERSION_INVALID');
  const key=binding.id+'|'+binding.configuration_version+'|'+fresh.bot_profile_version;
  const rec=profileCache.get(key);
  if(rec&&rec.expiresAt>now()){counts.cacheHit++;return rec.profile;}
  counts.cacheMiss++;
  const profile=Object.freeze({bot_profile_id:binding.bot_profile_id,
   profile_version:fresh.bot_profile_version,assistant_name:fresh.assistantName,
   greeting:fresh.greeting,tone:fresh.tone,color:fresh.color,
   show_stock:fresh.showStock,temporary_preview:true,
   shop_fixture:binding.shop});
  profileCache.set(key,{profile,expiresAt:now()+CACHE_TTL_MS});
  if(profileCache.size>500)profileCache.clear();
  return profile;
 }
 function hash(kind,parts){
  return kind+'_'+createHmac('sha256',secrets.get('MESSENGER'))
   .update(parts.join('\0')).digest('hex').slice(0,26);
 }
 function plan(text,fixture){
  const s=text.trim();
  if(/^(?:xin chào|chào|hello|hi)[.!? ]*$/iu.test(s))
   return {path:'FAST',type:'GREETING'};
  const sku=(s.match(SKU)||[])[0];
  if(/(?:đặt|mua|xác nhận đơn|sửa đơn|hủy đơn|thanh toán|chốt đơn)/iu.test(s))
   return {path:'TRANSACTION',type:'ORDER_INTENT',sku};
  if(/(?:so sánh|phù hợp|tư vấn chi tiết|khiếu nại|phức tạp)/iu.test(s))
   return {path:'AI',type:'COMPLEX_ADVICE'};
  if(sku&&/(?:bao nhiêu|giá|báo giá|còn hàng|tồn kho)/iu.test(s))
   return {path:'FAST',type:'QUOTE',sku};
  if(sku&&/(?:có|sản phẩm|mã|thông tin)/iu.test(s))
   return {path:'FAST',type:'CATALOG',sku};
  return {path:'AI',type:'UNCLASSIFIED'};
 }
 function reply(plan,profile,fixture){
  if(plan.path==='AI')return {resolution:'AI_REQUIRED_BUT_DISABLED',
    reply_type:'NO_SEND_PREVIEW',message_preview:'[QA] Cần AI Sales Core; chưa gọi mô hình.',
    ...NO_SEND};
  if(plan.path==='TRANSACTION')return {resolution:'TRANSACTION_BLOCKED_NO_WRITE',
    reply_type:'NO_SEND_PREVIEW',message_preview:'[QA] Chỉ ghi nhận ý định; chưa tạo hoặc sửa đơn.',
    ...NO_SEND};
  if(plan.type==='GREETING')return {resolution:'FAST_REPLY_READY',
    reply_type:'TEXT_PREVIEW',message_preview:profile.greeting,...NO_SEND};
  const item=FIXTURES[fixture].product;
  if(!item||item.sku!==plan.sku)return {
    resolution:'SKU_NOT_IN_TRUSTED_STORE',reply_type:'NO_SEND_PREVIEW',
    message_preview:'[QA] Không thấy mã này trong sản phẩm mẫu của cửa hàng.',
    ...NO_SEND};
  if(plan.type==='QUOTE')return {resolution:'FAST_REPLY_READY',reply_type:'TEXT_PREVIEW',
    message_preview:'[QA] '+item.name+' · '+item.priceVnd+' VND'+
       (profile.show_stock?' · còn '+item.stock+' (dữ liệu mẫu)':''),
    unit_price_vnd:item.priceVnd,stock_snapshot:profile.show_stock?item.stock:null,...NO_SEND};
  return {resolution:'FAST_REPLY_READY',reply_type:'TEXT_PREVIEW',
    message_preview:'[QA] '+item.name+' (SKU '+item.sku+').',
    ...NO_SEND};
 }
 function processSignedFixture({channel,rawBody,signature}={}){
  if(!verify(channel,rawBody,signature)){counts.denied++;return deny('SIGNED_FIXTURE_INVALID');}
  let data;try{data=JSON.parse(rawBody.toString('utf8'));}
  catch{counts.denied++;return deny('EVENT_JSON_INVALID');}
  if(!exact(data,REQUIRED_EVENT)||data.channel!==channel||
   data.environment!=='qa_staging'||
   !validId(data.provider_account_ref)||!validId(data.provider_bot_ref)||
   !validId(data.provider_user_ref)||!validId(data.provider_conversation_ref)||
   !validId(data.event_id,EVENT)||data.event_type!=='message'||
   !Number.isSafeInteger(data.timestamp_ms)||
   data.timestamp_ms>now()+120000||data.timestamp_ms<now()-3600000||
   typeof data.text!=='string'||data.text.length<1||data.text.length>2000||
   /[\u0000-\u0008\u000b-\u001f\u007f]/.test(data.text)){
   counts.denied++;return deny('NORMALIZED_EVENT_INVALID_OR_SCOPE_OVERRIDE');
  }
  const scope=[channel,data.environment,data.provider_account_ref,data.provider_bot_ref].join('|');
  const b=registry.get(scope);
  // Revocation, subscription expiry, and mapping freshness are checked BEFORE any cache or dedupe.
  if(!b||b.status!=='ACTIVE'||!b.subscription_active||
     b.verified_until_ms<=now()){
   counts.denied++;return deny('CHANNEL_BINDING_NOT_ACTIVE_OR_EXPIRED');
  }
  const storePolicy=storePolicies.get(b.shop);
  if(!storePolicy||storePolicy.status!=='ACTIVE'||!storePolicy.subscriptionActive){
   counts.denied++;return deny('STORE_PAUSED_OR_SUBSCRIPTION_EXPIRED');
  }
  let profile;try{profile=profileFor(b);}
  catch{counts.denied++;return deny('BOT_PROFILE_SCOPE_INVALID');}
  const replayKey=scope+'|'+data.event_id;
  const digest=createHmac('sha256',secrets.get(channel)).update(rawBody).digest('hex');
  const previous=replay.get(replayKey);
  if(previous&&previous.expiresAt>now()){
   counts.duplicates++;
   if(previous.digest!==digest)return deny('DUPLICATE_EVENT_PAYLOAD_CONFLICT');
   return Object.freeze({contract_version:CONTRACT_VERSION,trusted:true,status:'DUPLICATE',
     resolution_status:'REPLAY_IGNORED',channel_binding_id:b.id,...NO_SEND});
  }
  for(const [k,v] of replay)if(v.expiresAt<=now())replay.delete(k);
  if(replay.size>=maxReplay){counts.denied++;return deny('REPLAY_CACHE_CAPACITY_EXHAUSTED');}
  replay.set(replayKey,{digest,expiresAt:now()+ttlMs});
  const namespace=[channel,data.environment,b.id,
   data.provider_account_ref,data.provider_bot_ref];
  const customerId=hash('customer',[...namespace,data.provider_user_ref]);
  const conversationId=hash('conversation',[...namespace,
    data.provider_user_ref,data.provider_conversation_ref]);
  const route=plan(data.text,b.shop),preview=reply(route,profile,b.shop);
  counts.accepted++;
  return Object.freeze({
    contract_version:CONTRACT_VERSION,trusted:true,status:'RESOLVED',
    resolution_status:preview.resolution,
    tenant_id:b.tenant_id,store_id:b.store_id,
    channel_binding_id:b.id,bot_profile_id:b.bot_profile_id,
    customer_id:customerId,conversation_id:conversationId,
    channel,environment:data.environment,
    provider_namespace:channel,provider_account_ref:data.provider_account_ref,
    provider_bot_ref:data.provider_bot_ref,
    bot_profile_version:profile.profile_version,assistant_name:profile.assistant_name,
    route_path:route.path,route_type:route.type,
    policy:Object.freeze({can_process:true,can_send:false,
      can_write_orders:false,subscription_active:true,
      qa_mode:MODE}),...preview,...NO_SEND});
 }
 function qaSetBindingStatus(bindingId,status){
  if(!['ACTIVE','PAUSED','REVOKED'].includes(status)||!byId.has(bindingId))
   throw new Error('QA_STATUS_UPDATE_INVALID');
  const key=byId.get(bindingId),old=registry.get(key);
  registry.set(key,Object.freeze({...old,status,configuration_version:old.configuration_version+1}));
  // Test harness only, not a real admin endpoint.
  profileCache.clear();
 }
 function qaSetStorePolicy(shop,{status,subscriptionActive}={}){
  if(!Object.hasOwn(FIXTURES,shop)||!['ACTIVE','SUSPENDED'].includes(status)||
   typeof subscriptionActive!=='boolean')throw new Error('QA_STORE_POLICY_UPDATE_INVALID');
  const old=storePolicies.get(shop);
  storePolicies.set(shop,{status,subscriptionActive,version:old.version+1});
  profileCache.clear();
 }
 function inspect(){
  return Object.freeze({contract_version:CONTRACT_VERSION,mode:MODE,
   synthetic_channels:CHANNELS.slice(),bindings:registry.size,
   accepted:counts.accepted,rejected:counts.denied,
   duplicates:counts.duplicates,cache_hit:counts.cacheHit,
   cache_miss:counts.cacheMiss,replay_entries:replay.size,
   profile_cache_ttl_ms:CACHE_TTL_MS,
   authenticated_provider_webhooks:false,real_provider_rights_verified:false,
   real_llm_calls:0,provider_sends:0,hosted_writes:0,
   durable_replay_across_workers:false,can_publish:false});
 }
 return Object.freeze({processSignedFixture,signFixture,qaSetBindingStatus,qaSetStorePolicy,inspect});
}
module.exports={createUnifiedQaRouter,CONTRACT_VERSION,MODE};
