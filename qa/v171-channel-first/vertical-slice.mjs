/**
 * TIEN404 V17.1-A: synthetic-only 3-channel -> trusted fixture Store -> custom Bot
 * -> read-only catalog -> mock outbound. No network, real provider auth, data or LLM.
 * The hardcoded QA HMAC keys are fake test values, NEVER real provider secrets.
 */
import {createHmac,timingSafeEqual,createHash} from 'node:crypto';
export const CONTRACT='T404_V171A_CHANNEL_CUSTOM_BOT_VERTICAL_SLICE_V1';
export const MODE='SYNTHETIC_FIXTURES_NO_NETWORK_NO_SEND';
const CHANNELS=new Set(['messenger','zalo','website']);
const INPUT=['event_id','channel','installation_ref','external_customer_ref','message_type','text','received_at'];
const isPlain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
const fail=x=>{throw Error(x);};
const require=(x,m)=>{if(!x)fail(m);};
const exact=(v,keys)=>isPlain(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const bounded=(v,pat,min=1,max=180)=>typeof v==='string'&&v.length>=min&&v.length<=max&&pat.test(v);
const QA=/^QA_[A-Z0-9_]+$/;
const freeze=Object.freeze;
const INSTALLATIONS=freeze({
 'messenger:QA_PAGE_A':freeze({tenant:'QA_TENANT_1',store:'QA_STORE_A',bot:'QA_BOT_A',status:'APPROVED',secret:'QA_SYNTHETIC_SECRET_A_ONLY'}),
 'messenger:QA_PAGE_B':freeze({tenant:'QA_TENANT_1',store:'QA_STORE_B',bot:'QA_BOT_B',status:'APPROVED',secret:'QA_SYNTHETIC_SECRET_B_ONLY'}),
 'zalo:QA_OA_B':freeze({tenant:'QA_TENANT_1',store:'QA_STORE_B',bot:'QA_BOT_B',status:'APPROVED',secret:'QA_SYNTHETIC_SECRET_OA_ONLY'}),
 'website:QA_WIDGET_A':freeze({tenant:'QA_TENANT_1',store:'QA_STORE_A',bot:'QA_BOT_A',status:'APPROVED',secret:'QA_SYNTHETIC_SECRET_WEB_ONLY'}),
 'messenger:QA_PAGE_C':freeze({tenant:'QA_TENANT_2',store:'QA_STORE_C',bot:'QA_BOT_C',status:'APPROVED',secret:'QA_SYNTHETIC_SECRET_C_ONLY'}),
 'messenger:QA_PAGE_SUSPENDED':freeze({tenant:'QA_TENANT_1',store:'QA_STORE_B',bot:'QA_BOT_B',status:'REVOKED',secret:'QA_SYNTHETIC_SECRET_REVOKED_ONLY'})
});
const PROFILES=freeze({
 QA_STORE_A:freeze({tenant:'QA_TENANT_1',store:'QA_STORE_A',id:'QA_BOT_A',version:'QA_BOT_A_V1',prompt_version:'QA_PROMPT_A_V1',knowledge_version:'QA_KNOWLEDGE_A_V1',policy_version:'QA_POLICY_V1',approval:'APPROVED',enabled:true,store_paused:false,subscription:'ACTIVE',tone:'shop',tools:freeze(['catalog_read'])}),
 QA_STORE_B:freeze({tenant:'QA_TENANT_1',store:'QA_STORE_B',id:'QA_BOT_B',version:'QA_BOT_B_V1',prompt_version:'QA_PROMPT_B_V1',knowledge_version:'QA_KNOWLEDGE_B_V1',policy_version:'QA_POLICY_V1',approval:'APPROVED',enabled:true,store_paused:false,subscription:'ACTIVE',tone:'em',tools:freeze(['catalog_read'])}),
 QA_STORE_C:freeze({tenant:'QA_TENANT_2',store:'QA_STORE_C',id:'QA_BOT_C',version:'QA_BOT_C_V1',prompt_version:'QA_PROMPT_C_V1',knowledge_version:'QA_KNOWLEDGE_C_V1',policy_version:'QA_POLICY_V1',approval:'APPROVED',enabled:true,store_paused:false,subscription:'ACTIVE',tone:'shop',tools:freeze(['catalog_read'])})
});
const CATALOG=freeze({
 QA_STORE_A:freeze({QA_SKU_001:freeze({name:'QA áo mẫu A',price_vnd:159000,stock:5})}),
 QA_STORE_B:freeze({QA_SKU_001:freeze({name:'QA vật liệu mẫu B',price_vnd:259000,stock:2})}),
 QA_STORE_C:freeze({QA_SKU_001:freeze({name:'QA hàng mẫu C',price_vnd:309000,stock:8})})
});
function validateEvent(e){
 require(exact(e,INPUT),'UNTRUSTED_EVENT_SCHEMA');
 require(bounded(e.event_id,QA,5,75),'QA_EVENT_ID_REQUIRED');
 require(CHANNELS.has(e.channel),'UNSUPPORTED_CHANNEL');
 require(bounded(e.installation_ref,QA,5,75),'QA_INSTALLATION_REQUIRED');
 require(bounded(e.external_customer_ref,QA,5,75),'QA_CUSTOMER_REQUIRED');
 require(e.message_type==='text','UNSUPPORTED_MESSAGE_TYPE');
 require(typeof e.text==='string'&&e.text.length>0&&e.text.length<=500,'UNTRUSTED_TEXT_BOUND');
 require(typeof e.received_at==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(e.received_at)&&Number.isFinite(Date.parse(e.received_at)),'INVALID_EVENT_TIME');
 return e;
}
const hash=body=>createHash('sha256').update(body).digest('hex');
export function makeSyntheticEnvelope(e){
 validateEvent(e);
 const i=INSTALLATIONS[e.channel+':'+e.installation_ref];
 require(i,'UNKNOWN_CHANNEL_INSTALLATION');
 const rawBody=JSON.stringify(e);
 return freeze({fixture_only:true,rawBody,signature:createHmac('sha256',i.secret).update(rawBody).digest('hex')});
}
function verifySyntheticEnvelope(envelope,nowMs){
 require(exact(envelope,['fixture_only','rawBody','signature'])&&envelope.fixture_only===true,'REAL_PROVIDER_EVENT_DISABLED');
 require(typeof envelope.rawBody==='string'&&Buffer.byteLength(envelope.rawBody)<=1500,'RAW_BODY_TOO_LARGE');
 let e;try{e=JSON.parse(envelope.rawBody)}catch{fail('INVALID_RAW_EVENT_JSON')}
 validateEvent(e);
 require(JSON.stringify(e)===envelope.rawBody,'NON_CANONICAL_OR_DUPLICATE_JSON_KEYS');
 const i=INSTALLATIONS[e.channel+':'+e.installation_ref];
 require(i&&i.status==='APPROVED','UNBOUND_OR_REVOKED_INSTALLATION');
 require(typeof envelope.signature==='string'&&/^[a-f0-9]{64}$/.test(envelope.signature),'INVALID_FIXTURE_SIGNATURE');
 const expected=Buffer.from(createHmac('sha256',i.secret).update(envelope.rawBody).digest('hex'),'hex');
 const given=Buffer.from(envelope.signature,'hex');
 require(given.length===expected.length&&timingSafeEqual(given,expected),'INVALID_FIXTURE_SIGNATURE');
 require(Number.isSafeInteger(nowMs)&&Math.abs(nowMs-Date.parse(e.received_at))<=300_000,'EXPIRED_OR_FUTURE_SYNTHETIC_EVENT');
 return freeze({event:e,install:i,source_hash:hash(envelope.rawBody)});
}
function resolveAndLoad(v){
 const {event,install}=v,profile=PROFILES[install.store];
 require(profile&&profile.tenant===install.tenant&&profile.store===install.store&&profile.id===install.bot,'BOT_STORE_BINDING_DENIED');
 require(profile.approval==='APPROVED'&&profile.enabled&&!profile.store_paused&&profile.subscription==='ACTIVE','BOT_OR_SUBSCRIPTION_DISABLED');
 const catalog=CATALOG[install.store];
 require(catalog,'CATALOG_STORE_SCOPE_DENIED');
 return freeze({event,tenant:install.tenant,store:install.store,profile,catalog,source_hash:v.source_hash});
}
function authorizedTool(ctx,name,targetStore){
 require(ctx&&ctx.profile&&ctx.profile.store===ctx.store&&ctx.profile.tenant===ctx.tenant,'TRUST_CONTEXT_REQUIRED');
 require(ctx.profile.tools.includes(name)&&name==='catalog_read','WRITE_OR_UNAPPROVED_TOOL_DENIED');
 require(targetStore===ctx.store,'CROSS_STORE_TOOL_DENIED');
 return ctx.catalog;
}
function syntheticAiCoreReadOnly(ctx){
 const product=authorizedTool(ctx,'catalog_read',ctx.store).QA_SKU_001;
 require(product&&Number.isSafeInteger(product.price_vnd)&&product.price_vnd>0&&Number.isSafeInteger(product.stock),'INVALID_CATALOG_PRICE_OR_STOCK');
 const text=ctx.profile.tone+': '+product.name+', '+product.price_vnd.toLocaleString('vi-VN')+'đ, còn '+product.stock+' sản phẩm.';
 return freeze({text,sku:'QA_SKU_001',price_vnd:product.price_vnd,stock:product.stock});
}
function safeMockOutbound(ctx,answer){
 require(ctx.event.installation_ref&&ctx.profile.store===ctx.store,'OUTBOUND_STORE_CONTEXT_DENIED');
 require(!/credential|secret|service_role|sk-[a-z0-9]/i.test(answer.text),'OUTPUT_SECRET_MARKER_DENIED');
 return freeze({delivery:'MOCK_ONLY_NOT_SENT',channel:ctx.event.channel,installation_ref:ctx.event.installation_ref,
 recipient_ref:ctx.event.external_customer_ref,store:ctx.store,bot_version:ctx.profile.version,
 response:answer.text,price_vnd:answer.price_vnd,stock:answer.stock});
}
export function createSyntheticSandbox(){
 const seen=new Map(),trace=[];
 function process(envelope,{now_ms=Date.parse('2026-11-17T00:00:00Z')}={}){
  const v=verifySyntheticEnvelope(envelope,now_ms),ctx=resolveAndLoad(v);
  const key=[ctx.event.channel,ctx.event.installation_ref,ctx.event.event_id].join('|');
  if(seen.has(key)){
   if(seen.get(key)!==v.source_hash)fail('CONFLICTING_EVENT_REPLAY_DENIED');
   return freeze({status:'DUPLICATE_IGNORED',outbound_sent:false,paid_model_calls:0,commerce_writes:0});
  }
  const answer=syntheticAiCoreReadOnly(ctx),outbound=safeMockOutbound(ctx,answer);
  seen.set(key,v.source_hash);
  trace.push(freeze({event_id:ctx.event.event_id,channel:ctx.event.channel,tenant:ctx.tenant,store:ctx.store,bot:ctx.profile.id,
    bot_version:ctx.profile.version,prompt_version:ctx.profile.prompt_version,knowledge_version:ctx.profile.knowledge_version,
    policy_version:ctx.profile.policy_version,verified_kind:'SYNTHETIC_HMAC_ONLY_NOT_PROVIDER_AUTH',outbound:'MOCK_ONLY'}));
  return freeze({status:'QA_READONLY_SUCCESS',trusted:freeze({tenant:ctx.tenant,store:ctx.store,bot:ctx.profile.id,bot_version:ctx.profile.version,
    prompt_version:ctx.profile.prompt_version,knowledge_version:ctx.profile.knowledge_version,policy_version:ctx.profile.policy_version}),
    outbound,paid_model_calls:0,commerce_writes:0});
 }
 function simulateToolAttempt({envelope,tool,target_store,now_ms=Date.parse('2026-11-17T00:00:00Z')}){
  const ctx=resolveAndLoad(verifySyntheticEnvelope(envelope,now_ms));
  require(typeof tool==='string'&&typeof target_store==='string','INVALID_TOOL_CALL');
  return authorizedTool(ctx,tool,target_store);
 }
 return freeze({process,simulateToolAttempt,getTrace:()=>freeze(trace.map(x=>freeze({...x}))),mode:MODE,
   runLive:()=>fail('LIVE_ADAPTER_DISABLED'),sendProvider:()=>fail('PROVIDER_SEND_DISABLED'),
   writeOrder:()=>fail('COMMERCE_WRITE_DISABLED')});
}
export function fixtureEvent({event_id='QA_EVT_001',channel='messenger',installation_ref='QA_PAGE_A',external_customer_ref='QA_CUSTOMER_X',
 text='QA giá mã QA_SKU_001',received_at='2026-11-17T00:00:00Z'}={}){
 return {event_id,channel,installation_ref,external_customer_ref,message_type:'text',text,received_at};
}
export const integrationReadiness=()=>freeze({status:'STAGING_SOURCE_ONLY_NO_HOSTED_BINDING',channel_adapters_synthetic:3,
 verified_vendor_webhook_protocols:0,live_approved_installations:0,verified_hosted_store_isolation:false,
 independent_real_privacy_approval:false,LLM_calls:0,provider_sends:0,orders_written:0,target_contract:CONTRACT,mode:MODE});
