'use strict';
/*
 * TIEN404 pre-ADV6C: signed-webhook replay and per-store AI budget contracts.
 * OFFLINE SYNTHETIC QA ONLY. No provider API, Cloudflare rule deployment,
 * model call, credential access, or database connection.
 */
const crypto=require('node:crypto');
const VERSION='T404_PRE6C_ABUSE_GATE_V1';
const fail=code=>{const e=new Error(code);e.code=code;throw e};
const ref=x=>typeof x==='string'&&x.length>0&&x.length<=128&&/^[a-zA-Z0-9:_.\/-]+$/.test(x);
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const hash=x=>crypto.createHash('sha256').update('T404:PRE6C:v1:').update(x).digest('hex');
function createAbuseGuard({mode,verifyProviderSignature,lookupBoundAccount,
   claimEventOnce,loadStoreLimits,reserveAtomicBudget,estimateTrustedCost,clock=()=>Date.now()}={}){
 if(mode!=='SYNTHETIC_NO_SEND'||[
   verifyProviderSignature,lookupBoundAccount,claimEventOnce,loadStoreLimits,
   reserveAtomicBudget,estimateTrustedCost,clock
 ].some(fn=>typeof fn!=='function'))fail('ABUSE_GUARD_SERVER_PORTS_MISSING');
 function time(){const t=clock();if(!Number.isSafeInteger(t)||t<0)fail('CLOCK_INVALID');return t}
 async function acceptWebhook({channel,rawBody,headers}={}){
   if(!['MESSENGER','ZALO_BOT','ZALO_OA'].includes(channel)||
     !Buffer.isBuffer(rawBody)||rawBody.length<2||rawBody.length>131072||
     !plain(headers))fail('WEBHOOK_ENVELOPE_INVALID');
   const verified=await verifyProviderSignature({channel,rawBody,headers});
   if(!plain(verified)||verified.channel!==channel||
     !ref(verified.account_id)||!ref(verified.event_id)||
     !Number.isSafeInteger(verified.event_time_ms)||
     Math.abs(time()-verified.event_time_ms)>300000)
     fail('PROVIDER_SIGNATURE_OR_TIMESTAMP_DENIED');
   const bound=await lookupBoundAccount({channel,account_id:verified.account_id});
   if(!plain(bound)||bound.status!=='active'||
      bound.channel!==channel||bound.account_id!==verified.account_id||
      !ref(bound.tenant_id)||!ref(bound.store_id))
     fail('TRUSTED_ACCOUNT_STORE_MAPPING_REQUIRED');
   const scoped=hash([channel,verified.account_id,verified.event_id,
     bound.tenant_id,bound.store_id].join('|'));
   // Caller MUST provide an atomic durable one-time claim in actual integration.
   if(await claimEventOnce({hash:scoped,expires_at:time()+10*60*1000})!==true)
     fail('WEBHOOK_REPLAY_OR_EVENT_STORE_FAILED');
   return Object.freeze({contract:VERSION,channel,tenant_id:bound.tenant_id,
      store_id:bound.store_id,status:'VERIFIED_EVENT_RECEIPT_ONLY',
      eventHash:scoped,accepted:true,providerSends:0,hostedWrites:0});
 }
 async function reserveAiBudget({principal,modelTier,requestId}={}){
   if(!plain(principal)||principal.auth_source!=='SERVER_VERIFIED_JWT_OR_CHANNEL_BINDING'||
     !ref(principal.tenant_id)||!ref(principal.store_id)||
     !ref(principal.subject_id)||!ref(principal.channel)||!ref(requestId)||
     !['LOW_COST','NO_MODEL'].includes(modelTier))fail('BUDGET_SCOPE_UNVERIFIED');
   const p=await loadStoreLimits({tenant_id:principal.tenant_id,store_id:principal.store_id});
   if(!plain(p)||p.active!==true||p.tenant_id!==principal.tenant_id||
     p.store_id!==principal.store_id||
     !Number.isSafeInteger(p.max_requests_per_minute)||p.max_requests_per_minute<1||
     p.max_requests_per_minute>10000||
     !Number.isSafeInteger(p.daily_cap_vnd)||p.daily_cap_vnd<0||
     p.daily_cap_vnd>1000000000)
     fail('SERVER_QUOTA_POLICY_REQUIRED');
   const estimate=await estimateTrustedCost({modelTier});
   if(!Number.isSafeInteger(estimate)||estimate<0||estimate>p.daily_cap_vnd)
     fail('COST_ESTIMATE_INVALID_OR_OVER_CAP');
   const now=time();
   const slot=Math.floor(now/60000),day=Math.floor(now/86400000);
   const fingerprint=hash([principal.tenant_id,principal.store_id,
      principal.channel,principal.subject_id].join('|'));
   const r=await reserveAtomicBudget({
     tenant_id:principal.tenant_id,store_id:principal.store_id,
     actor_hash:fingerprint,request_id:requestId,slot,day,
     max_requests:p.max_requests_per_minute,
     estimated_cost_vnd:estimate,daily_cap_vnd:p.daily_cap_vnd
   });
   if(!plain(r)||r.allowed!==true||!Number.isSafeInteger(r.remaining_requests)||
      r.remaining_requests<0||!Number.isSafeInteger(r.remaining_daily_vnd)||
      r.remaining_daily_vnd<0)fail('RATE_LIMIT_OR_AI_BUDGET_DENIED');
   return Object.freeze({
      contract:VERSION,mode:'SYNTHETIC_NO_SEND',
      status:'BUDGET_RESERVED_SYNTHETIC_NO_INFERENCE',
      tenant_id:principal.tenant_id,store_id:principal.store_id,
      costEstimateVnd:estimate,providerSends:0,realModelCalls:0,
      chargedVnd:0,hostedWrites:0
   });
 }
 return Object.freeze({
   VERSION,acceptWebhook,reserveAiBudget,
   callModel(){fail('MODEL_CALL_DISABLED')},
   dispatch(){fail('PROVIDER_SEND_DISABLED')}
 });
}
module.exports=Object.freeze({VERSION,createAbuseGuard});