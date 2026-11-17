'use strict';
/**
 * V17.6-B.1 source-adapter canary. Connects the actual V17.1L policy module
 * to deterministic QA-only, in-memory evidence ports.
 *
 * DOES NOT implement provider-native signature validation or real Auth/JWT.
 * No HTTP, DB, model, filesystem write, workflow, or outbound provider adapter.
 * The QA HMAC key is synthetic and publicly visible; NEVER use in production.
 */
const crypto = require('node:crypto');
const {createBotSecurityBoundary, VERSION} =
  require('../v171l-bot-security/zero-trust-bot-boundary.cjs');

const MODE='V176B1_OFFLINE_SYNTHETIC_HMAC_NO_SEND';
const QA_KEY='QA_ONLY_PUBLIC_TEST_VECTOR_NOT_A_PROVIDER_SECRET';
const NOW=1794900000000;
const registry=Object.freeze({
  QA_META_A:Object.freeze({source:'SERVER_TRUSTED_INSTALLATION_REGISTRY',status:'ACTIVE',
    channel:'MESSENGER',installationId:'QA_META_A',tenantId:'QA_TENANT_SHARED',
    storeId:'QA_STORE_A',botVersion:'BOT_QA_01',ownerEvidenceRef:'QA_OWNER_A',
    providerDestinationId:'QA_PAGE_A'}),
  QA_META_B:Object.freeze({source:'SERVER_TRUSTED_INSTALLATION_REGISTRY',status:'ACTIVE',
    channel:'MESSENGER',installationId:'QA_META_B',tenantId:'QA_TENANT_SHARED',
    storeId:'QA_STORE_B',botVersion:'BOT_QA_01',ownerEvidenceRef:'QA_OWNER_B',
    providerDestinationId:'QA_PAGE_B'})
});
const catalog=Object.freeze({
  QA_STORE_A:Object.freeze({sku:'SKU_A',priceVnd:159000,orderId:'ORDER_A',senderId:'QA_CUSTOMER_A'}),
  QA_STORE_B:Object.freeze({sku:'SKU_B',priceVnd:199000,orderId:'ORDER_B',senderId:'QA_CUSTOMER_B'})
});
function sign(body){return 'sha256='+crypto.createHmac('sha256',QA_KEY).update(body).digest('hex');}
function equalSignature(received,computed){
  if(typeof received!=='string'||!/^sha256=[0-9a-f]{64}$/.test(received))return false;
  const a=Buffer.from(received.slice(7),'hex'),b=Buffer.from(computed.slice(7),'hex');
  return a.length===b.length&&crypto.timingSafeEqual(a,b);
}
function createCanary({rateAllowed=true,orderConfirmed=false,serverQuoteValid=true,
    catalogAllowed=true,ownerOrderAllowed=true}={}){
  const seen=new Set();
  const counters={syntheticSignatureChecks:0,syntheticReplayClaims:0,
    syntheticQuotaChecks:0,syntheticCatalogChecks:0,syntheticOrderChecks:0,
    syntheticConfirmationChecks:0,networkCalls:0,providerSends:0,
    modelCalls:0,hostedDbReads:0,hostedDbWrites:0,orderWrites:0,stockWrites:0};
  const boundary=createBotSecurityBoundary({
    resolveInstallation:({channel,installationId})=>{
      const r=registry[installationId];
      return r&&r.channel===channel?r:null;
    },
    verifyProviderEvent:({channel,installationId,rawBody,signatureHeader,installation})=>{
      counters.syntheticSignatureChecks++;
      if(!equalSignature(signatureHeader,sign(rawBody)))return null;
      let event;
      try{event=JSON.parse(rawBody.toString('utf8'))}catch{return null}
      if(!event||event.installationId!==installationId||
          event.destinationId!==installation.providerDestinationId||
          event.channel!==channel)return null;
      return {source:'INDEPENDENT_NATIVE_PROVIDER_ADAPTER', // required source contract ONLY
        verified:true,channel,installationId,
        providerDestinationId:installation.providerDestinationId,
        providerSenderId:event.senderId,providerEventId:event.eventId,
        occurredAtMs:event.occurredAtMs,isSelfEcho:event.isSelfEcho===true};
    },
    reserveReplayOnce:({key})=>{
      counters.syntheticReplayClaims++;
      if(seen.has(key))return false;
      seen.add(key);return true;
    },
    allowRateAndCost:()=>{counters.syntheticQuotaChecks++;return rateAllowed===true;},
    verifyOrderAccess:({storeId,providerSenderId,orderId})=>{
      counters.syntheticOrderChecks++;
      return ownerOrderAllowed===true&&catalog[storeId]?.orderId===orderId&&
        catalog[storeId]?.senderId===providerSenderId;
    },
    verifyCatalogRead:({storeId,sku,query})=>{
      counters.syntheticCatalogChecks++;
      return catalogAllowed===true&&
        (!sku||sku===catalog[storeId]?.sku)&&
        (!query||typeof query==='string'&&query.length<=120);
    },
    verifyCustomerConfirmation:({storeId,providerSenderId,sku,quantity,expectedTotalVnd})=>{
      counters.syntheticConfirmationChecks++;
      return orderConfirmed===true&&catalog[storeId]?.senderId===providerSenderId&&
        catalog[storeId]?.sku===sku&&quantity===2&&
        expectedTotalVnd===catalog[storeId].priceVnd*2;
    },
    verifyServerQuote:({storeId,sku,quantity,expectedTotalVnd})=>
      serverQuoteValid===true&&catalog[storeId]?.sku===sku&&quantity===2&&
      expectedTotalVnd===catalog[storeId].priceVnd*2
  });
  function envelope({installationId='QA_META_A',eventId='QA_EVENT_01',
      senderId,occurredAtMs=NOW,bodyClaims={},badSignature=false,
      channel='MESSENGER',isSelfEcho=false}={}){
    const r=registry[installationId]||registry.QA_META_A;
    const body=Buffer.from(JSON.stringify({channel,installationId,
      destinationId:r.providerDestinationId,eventId,
      senderId:senderId||catalog[r.storeId]?.senderId||'QA_CUSTOMER_A',
      occurredAtMs,isSelfEcho,...bodyClaims}),'utf8');
    return {channel,installationId,rawBody:body,
      signatureHeader:badSignature?'sha256='+('0'.repeat(64)):sign(body),
      nowMs:NOW};
  }
  function authorize(session,tool,args={},origin='MODEL_PROPOSAL',nowMs=NOW){
    return boundary.authorizeTool({session,tool,arguments:args,origin,nowMs});
  }
  function receipt(){return Object.freeze({...counters,
    contract:MODE,policySourceVersion:VERSION,
    syntheticOnly:true,realNativeProviderProof:false,realJWT:false,
    hostedRLS:false,productionRelease:'NO_GO'});}
  return Object.freeze({MODE,boundary,envelope,authorize,receipt});
}
module.exports=Object.freeze({MODE,NOW,createCanary});
