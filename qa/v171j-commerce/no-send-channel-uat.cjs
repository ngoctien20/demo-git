'use strict';
/**
 * V17.1J Messenger/Zalo no-send READ-ONLY shadow acceptance REHEARSAL.
 * Never processes actual provider messages, sends replies, calls an order
 * reader, uses active workflows, or certifies real native provider signatures.
 * All supplied "signed" flags are UNSIGNED QA fixture assertions.
 */
const VERSION='T404_V171J_NO_SEND_MULTICHANNEL_SHADOW_UAT_V1';
const DENY=x=>{throw Error(x)};
const plain=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{2,90}$/.test(x);
const ALLOWED_CHANNEL=new Set(['MESSENGER','ZALO']);
const INTENTS=new Set(['IMAGE_PRODUCT_LOOKUP','ORDER_STATUS_READ','CROSS_CHANNEL_ORDER_READ']);
const ORDER_INTENTS=new Set(['ORDER_STATUS_READ','CROSS_CHANNEL_ORDER_READ']);
function runShadowUat({tenantId,storeId,nowMs,installations,catalog,
   fixtures,channelWorkflowInventory}={}){
 if(!id(tenantId)||!id(storeId)||!Number.isSafeInteger(nowMs)||nowMs<=0||
    !Array.isArray(installations)||!installations.length||installations.length>8||
    !Array.isArray(catalog)||!catalog.length||catalog.length>100||
    !Array.isArray(fixtures)||!fixtures.length||fixtures.length>100||
    !Array.isArray(channelWorkflowInventory))
    DENY('UAT_SHADOW_SCOPE_OR_INPUT_INVALID');
 const skus=new Set(),installByKey=new Map(),result=[],seenCases=new Set(),seenEvents=new Set();
 for(const p of catalog){
  if(!plain(p)||p.tenantId!==tenantId||p.storeId!==storeId||
     !id(p.sku)||p.active!==true||skus.has(p.sku))
     DENY('UAT_CATALOG_SCOPE_INVALID');
  skus.add(p.sku);
 }
 for(const i of installations){
  if(!plain(i)||!ALLOWED_CHANNEL.has(i.channel)||
     !id(i.providerInstallationId)||i.tenantId!==tenantId||
     i.storeId!==storeId||i.stage!=='INACTIVE_QA_SHADOW'||
     i.source!=='SYNTHETIC_TEST_INSTALLATION_ONLY'||
     installByKey.has(i.channel+':'+i.providerInstallationId))
     DENY('UAT_INSTALLATION_UNTRUSTED_OR_ACTIVE');
  installByKey.set(i.channel+':'+i.providerInstallationId,i);
 }
 // These are snapshots of actual n8n workflows, not activation authority.
 // If an active workflow has send/order/marker-side-effects, never target it.
 const inventory=new Map();
 for(const w of channelWorkflowInventory){
  if(!plain(w)||!id(w.workflowId)||
    typeof w.active!=='boolean'||typeof w.hasPotentialSideEffects!=='boolean'||
    inventory.has(w.workflowId))
    DENY('UAT_WORKFLOW_INVENTORY_INVALID');
  inventory.set(w.workflowId,w);
 }
 for(const f of fixtures){
  if(!plain(f)||!id(f.caseId)||seenCases.has(f.caseId)||
     !id(f.eventId)||seenEvents.has(f.eventId)||!ALLOWED_CHANNEL.has(f.channel)||
     !id(f.providerInstallationId)||!INTENTS.has(f.intent)||
     !id(f.workflowId))
     DENY('UAT_CASE_INVALID');
  seenCases.add(f.caseId);seenEvents.add(f.eventId);
  const installation=installByKey.get(f.channel+':'+f.providerInstallationId);
  const workflow=inventory.get(f.workflowId);
  let denial=null;
  // Note: even a PASS here remains synthetic; source signed flag is untrusted.
  if(f.tenantId!==tenantId||f.storeId!==storeId)
    denial='UAT_CROSS_STORE_OR_TENANT_DENIED';
  else if(!installation)
    denial='UAT_UNBOUND_CHANNEL_INSTALLATION';
  else if(!workflow||workflow.active||workflow.hasPotentialSideEffects)
    denial='UAT_REAL_ACTIVE_OR_SIDE_EFFECT_WORKFLOW_DENIED';
  else if(f.origin!=='OFFLINE_SYNTHETIC_PROVIDER_FIXTURE_ONLY'||
          f.syntheticSignatureValid!==true)
    denial='UAT_NATIVE_PROVIDER_SIGNATURE_NOT_PRESENT';
  else if(f.intent==='IMAGE_PRODUCT_LOOKUP'){
    if(!Array.isArray(f.candidateSkus)||f.candidateSkus.length>3||
       f.candidateSkus.some(x=>!id(x)||!skus.has(x))||
       f.skuAutomaticallySelected===true)
      denial='UAT_VISION_SKU_NOT_VERIFIED_OR_AUTOSELECT_DENIED';
  }else if(ORDER_INTENTS.has(f.intent)){
    const grant=f.orderAccessGrant;
    if(!plain(grant)||grant.type!=='QA_ORDER_READ_ONLY_FIXTURE'||
       grant.tenantId!==tenantId||grant.storeId!==storeId||
       !id(grant.orderId)||grant.orderId!==f.orderId||
       grant.customerChallengeApproved!==true||
       grant.targetCustomerVerified!==true||
       !Number.isSafeInteger(grant.expiresAtMs)||grant.expiresAtMs<=nowMs)
      denial='UAT_ORDER_READER_ACCESS_GRANT_DENIED';
    else if(f.intent==='CROSS_CHANNEL_ORDER_READ'&&
       (f.sourceChannel===f.channel||!ALLOWED_CHANNEL.has(f.sourceChannel)||
        f.sourceCustomerApprovedLink!==true||
        f.targetCustomerVerifiedLink!==true||
        grant.sourceChannel!==f.sourceChannel||
        grant.targetChannel!==f.channel))
      denial='UAT_CROSS_CHANNEL_TWO_STEP_LINK_DENIED';
  }
  if(!denial&&!['READ_ONLY','SUGGEST_SKU'].includes(f.requestedAction))
    denial='UAT_SIDE_EFFECT_ACTION_FORBIDDEN';
  // The output is intentionally no customer ID, message, image URL, order contents
  // or real query capability.
  result.push(Object.freeze({caseId:f.caseId,channel:f.channel,
    intent:f.intent,decision:denial?'DENY':'SYNTHETIC_READ_ONLY_REHEARSAL',
    denialCode:denial,providerSignatureIndependentlyVerified:false,
    installationOwnerIndependentlyVerified:false,
    storeJwtRlsIndependentlyVerified:false,orderGrantIndependentlyVerified:false,
    canReadActualOrder:false,canSendProviderReply:false,canWriteOrder:false}));
 }
 return Object.freeze({version:VERSION,mode:'OFFLINE_SYNTHETIC_NO_SEND_ONLY',
   tenantId,storeId,caseCount:result.length,
   syntheticAccepts:result.filter(x=>x.decision==='SYNTHETIC_READ_ONLY_REHEARSAL').length,
   denied:result.filter(x=>x.decision==='DENY').length,
   results:Object.freeze(result),
   realProviderSignatureVerified:false,
   realProviderPageOaOwnershipVerified:false,
   hostedStoreRlsVerified:false,
   liveMessengerUatPassed:false,liveZaloUatPassed:false,
   actualOrderQueries:0,realWebhookEventsConsumed:0,
   modelCalls:0,providerSends:0,hostedWrites:0,
   canPromoteToCommerceCore:false});
}
module.exports=Object.freeze({VERSION,runShadowUat});
