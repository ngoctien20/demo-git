'use strict';
/**
 * G0.10: private injected durable claim adapter for pinned V17.1E handler.
 *
 * This module contains NO live PostgreSQL, n8n, network, Meta, Zalo or
 * Supabase connection. The operator must provide a restricted SQL client
 * implementing claimOnce(provider,installationDigest,eventDigest,payloadDigest)
 * against the separately reviewed atomic/unique PG17 claim function.
 *
 * Attach returned claimOnce to V17.1E private config only AFTER the pinned
 * handler has verified raw-body Meta HMAC, Page and tester and parsed MID.
 * This adapter NEVER authenticates provider or owner itself.
 */
const {createHmac,timingSafeEqual}=require('node:crypto');
const CONTRACT='T404_G10_DURABLE_REPLAY_ADAPTER_V1';
const RECEIPT_ID=/^[a-f0-9]{64}$/;
const ID=/^[A-Za-z0-9_-]{4,96}$/;
const MAX_BYTES=32768;
const fail=()=>{throw Error('G10_PRIVATE_REPLAY_CLAIM_DENIED')};
const mac=(k,domain,buffer)=>createHmac('sha256',k).update(
 Buffer.from('t404-g10-no-send-v1\u0000'+domain+'\u0000','utf8')).update(buffer).digest();
/**
 * The private installationRef may be a real Page ID but is never persisted or
 * logged here. The server-held replay pepper is DISTINCT from Meta AppSecret
 * and must remain stable across workers through the entire retry window.
 * A byte payload digest is used to detect MID reuse with changed content.
 */
function createBoundClaimOnce({
 storageClient,replayPepper,installationRef,rawBody,
 provider='MESSENGER'
}={}){
 if(provider!=='MESSENGER'||typeof installationRef!=='string'||
    !ID.test(installationRef)||!Buffer.isBuffer(rawBody)||
    rawBody.length<1||rawBody.length>MAX_BYTES||
    !Buffer.isBuffer(replayPepper)||replayPepper.length<32||
    replayPepper.length>128||
    !storageClient||typeof storageClient.claimOnce!=='function')fail();
 const installationDigest=mac(replayPepper,'installation',Buffer.from(installationRef,'utf8'));
 const payloadDigest=mac(replayPepper,'payload',rawBody);
 return Object.freeze(async receiptId=>{
  if(typeof receiptId!=='string'||!RECEIPT_ID.test(receiptId))fail();
  const eventDigest=mac(replayPepper,'event',Buffer.from(receiptId,'ascii'));
  let outcome;
  try{
   // The DB adapter MUST perform a single SQL function call. It must never
   // implement a separate SELECT/rowNotExists → later INSERT sequence.
   outcome=await storageClient.claimOnce({
    provider,installationDigest:Buffer.from(installationDigest),
    eventDigest:Buffer.from(eventDigest),payloadDigest:Buffer.from(payloadDigest)
   });
  }catch{fail();}
  if(outcome==='claimed'||outcome==='duplicate')return outcome;
  // conflict, DB timeout, unknown, shape drift => V17.1E catches and returns
  // DURABLE_CLAIM_FAILED / HTTP 503, no provider send or Commerce call.
  fail();
 });
}
/** Verifies independent source counters only, NOT Page/Store ownership. */
function summarizeShadowReadiness(facts){
 if(!facts||typeof facts!=='object'||Array.isArray(facts))fail();
 const fixed=['realMessengerVerified','realLegacyProviderSendOccurred',
  'shadowBridgeInvoked','shadowCoreDeniedUnknownStore','shadowProviderSends',
  'shadowOrdersWritten','shadowModelCalls','atomicReplayConcurrentlyTested',
  'realReplayOnSignedWebhookObserved','independentStoreOwnerProven'];
 if(Object.keys(facts).length!==fixed.length||fixed.some(k=>!Object.hasOwn(facts,k)))
  fail();
 const shadowOk=facts.realMessengerVerified===true&&
  facts.realLegacyProviderSendOccurred===true&&
  facts.shadowBridgeInvoked===true&&
  facts.shadowCoreDeniedUnknownStore===true&&
  facts.shadowProviderSends===0&&facts.shadowOrdersWritten===0&&
  facts.shadowModelCalls===0;
 return Object.freeze({contract:CONTRACT,
  shadowSingleRealSignedEventVerified:shadowOk,
  atomicReplayConcurrentlyTestedInDisposableDb:facts.atomicReplayConcurrentlyTested===true,
  realProviderReplayTested:facts.realReplayOnSignedWebhookObserved===true,
  realMerchantStoreOwnerVerified:facts.independentStoreOwnerProven===true,
  status:'REAL_SHADOW_RECEIPT_ONLY__DURABLE_REPLAY_NOT_DEPLOYED__HOSTED_NO_GO',
  canPublish:false,canSend:false,canAccessRealStore:false,
  canMutateOrders:false,canChangeProviderCallback:false,canUseCredentials:false,
  canMigrateHostedRls:false,providerSendsByThisModule:0});
}
module.exports=Object.freeze({CONTRACT,createBoundClaimOnce,summarizeShadowReadiness});
