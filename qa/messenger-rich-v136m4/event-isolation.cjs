'use strict';
/**
 * TIEN404 V13.6M.4 — PER-EVENT Messenger preview / replay READINESS.
 * Offline, synthetic fixtures only. Does not persist events, call Meta,
 * write an order, deploy RLS, send a notification or authorize production.
 */
const {createHash}=require('node:crypto');
const {previewMessengerV136M3}=require('../messenger-rich-v136m3/canonical-pipeline.cjs');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAGE=/^[0-9]{5,30}$/;
const SHA=/^[a-f0-9]{64}$/;
const fail=(code)=>{const e=new Error(code);e.code=code;throw e};
const MS_DAY=86400000;
/**
 * Deterministic, in-memory-only stand-in for a future UNIQUE idempotency
 * constraint + atomic transaction. MUST NOT be used as durable production
 * replay store; state is lost on process restart.
 */
function createSyntheticReplayStore({clock=Date.now,ttlMs=7*MS_DAY,maxKeys=10000}={}){
 if(typeof clock!=='function'||!Number.isSafeInteger(ttlMs)||ttlMs<MS_DAY||
    !Number.isSafeInteger(maxKeys)||maxKeys<1||maxKeys>100000)
   fail('QA_REPLAY_STORE_CONFIG_INVALID');
 const entries=new Map();
 const verify=({tenantId,storeId,pageId,senderPsid,bindingVersion,replayKey,mode})=>{
   if(!UUID.test(tenantId||'')||!UUID.test(storeId||'')||
      !PAGE.test(pageId||'')||!PAGE.test(senderPsid||'')||
      !Number.isSafeInteger(bindingVersion)||bindingVersion<1||
      !SHA.test(replayKey||'')||mode!=='DRY_RUN')
       fail('QA_REPLAY_TRUSTED_SCOPE_REQUIRED');
 };
 return Object.freeze({
  replayCheck:async function(scope){
   verify(scope);
   const t=clock();
   if(!Number.isSafeInteger(t))fail('QA_REPLAY_CLOCK_INVALID');
   // The key includes all dimensions that must be isolated. Hash never leaks PSID.
   const digest=createHash('sha256').update([
    scope.tenantId,scope.storeId,scope.pageId,
    scope.senderPsid,String(scope.bindingVersion),scope.replayKey
   ].join('|')).digest('hex');
   const prev=entries.get(digest);
   if(prev && prev>t)
      return Object.freeze({mode:'DRY_RUN',firstSeen:false,externalWriteOccurred:false});
   if(entries.size>=maxKeys){
    for(const [key,until] of entries)if(until<=t)entries.delete(key);
   }
   if(entries.size>=maxKeys && !entries.has(digest))
      fail('QA_REPLAY_CAPACITY_EXCEEDED');
   entries.set(digest,t+ttlMs);
   return Object.freeze({mode:'DRY_RUN',firstSeen:true,externalWriteOccurred:false});
  },
  diagnostics:()=>Object.freeze({mode:'SYNTHETIC_MEMORY_ONLY',size:entries.size,
    durable:false,supportsAtomicDb:false,providerSendEnabled:false}),
 });
}
async function previewMessengerV136M4(options={}){
 if(options.mode!=='SYNTHETIC_QA_ONLY')fail('M4_OFFLINE_ONLY');
 if(typeof options.replayCheck!=='function')fail('M4_REPLAY_PORT_REQUIRED');
 const old=await previewMessengerV136M3({...options,eventIsolation:true});
 return Object.freeze({...old,
  stage:'MESSENGER_RICH_UI_V136M4',
  perEventIsolation:true,sendEnabled:false,hostedReady:false,
  durableReplayReady:false,outboxWriteEnabled:false,
  replayMode:'DRY_RUN',externalStoreUsed:false});
}
module.exports={createSyntheticReplayStore,previewMessengerV136M4};
