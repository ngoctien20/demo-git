'use strict';
// V13.4: channel-neutral, preview-only boundary. No provider SDK, SQL, or outbound calls.
// All ports MUST be supplied by a trusted server; never inject browser-controlled identities.
const CAPABILITIES=Object.freeze({
  WEBSITE_CHAT:Object.freeze({inbound:'SERVER_SESSION',outbound:'NOT_CONNECTED',nativeButtons:'WEB_OWNED'}),
  MESSENGER:Object.freeze({inbound:'PROVIDER_SIGNATURE',outbound:'NOT_CONNECTED',nativeButtons:'PROVIDER_SPECIFIC'}),
  ZALO_BOT:Object.freeze({inbound:'PROVIDER_SECRET',outbound:'NOT_CONNECTED',nativeButtons:'UNKNOWN'}),
  ZALO_OA:Object.freeze({inbound:'PROVIDER_SPECIFIC',outbound:'NOT_CONNECTED',nativeButtons:'PROVIDER_SPECIFIC'})
});
const SAFE_CODES=new Set(['UNAUTHENTICATED_INGRESS','UNKNOWN_CHANNEL','CHANNEL_BINDING_DENIED','SUBSCRIPTION_DENIED','CATALOG_SCOPE_DENIED','CATALOG_INVALID','CORE_PREVIEW_INVALID','PORT_NOT_CONNECTED']);
const validId=s=>typeof s==='string'&&s.length>=4&&s.length<=160&&/^[a-zA-Z0-9:_-]+$/.test(s);
const validSku=s=>typeof s==='string'&&s.length>=1&&s.length<=80&&/^[a-zA-Z0-9:_-]+$/.test(s);
const fail=code=>{const e=new Error(code);e.code=code;throw e;};
const isFunction=x=>typeof x==='function';
const frozen=x=>Object.freeze(x);
function createNoSendChannelBridge({authenticateIngress,resolveChannelBinding,readSubscription,readCatalog,customerPreview,clock=Date.now}={}){
  if([authenticateIngress,resolveChannelBinding,readSubscription,readCatalog,customerPreview].some(x=>!isFunction(x)))fail('PORT_NOT_CONNECTED');
  if(!isFunction(clock))fail('PORT_NOT_CONNECTED');
  async function preview(untrustedEvent){
    try{
      // Provider authentication must precede any shop/catalog lookup.
      const auth=await authenticateIngress(untrustedEvent);
      if(!auth||auth.source!=='SERVER_VERIFIED_INGRESS'||auth.verified!==true||
        !validId(auth.channelKey)||!validId(auth.providerEventId)||!validId(auth.customerRef)||
        !Number.isFinite(auth.expiresAt)||auth.expiresAt<=clock())fail('UNAUTHENTICATED_INGRESS');
      const channel=auth.channel;
      if(!Object.hasOwn(CAPABILITIES,channel))fail('UNKNOWN_CHANNEL');
      const binding=await resolveChannelBinding(frozen({channel,channelKey:auth.channelKey}));
      if(!binding||binding.source!=='SERVER_VERIFIED_BINDING'||binding.active!==true||
        binding.channel!==channel||binding.channelKey!==auth.channelKey||
        !validId(binding.tenantId)||!validId(binding.storeId))fail('CHANNEL_BINDING_DENIED');
      const scope=frozen({tenantId:binding.tenantId,storeId:binding.storeId,channel,
        channelKey:auth.channelKey,providerEventId:auth.providerEventId,customerRef:auth.customerRef});
      // Client-supplied tenant/role/store is deliberately not read.
      const subscription=await readSubscription(scope);
      if(!subscription||subscription.source!=='SERVER_VERIFIED_SUBSCRIPTION'||
         subscription.tenantId!==scope.tenantId||subscription.storeId!==scope.storeId||
         !['ACTIVE','EXPIRING'].includes(subscription.state)||
         !Number.isFinite(Date.parse(subscription.expiresAt))||
         Date.parse(subscription.expiresAt)<=clock()||
         (Array.isArray(subscription.channels)&&!subscription.channels.includes(channel)))
         fail('SUBSCRIPTION_DENIED');
      const catalog=await readCatalog(scope);
      if(!catalog||catalog.verified!==true||catalog.tenantId!==scope.tenantId||
         catalog.storeId!==scope.storeId||!Array.isArray(catalog.products)||
         catalog.products.length>100)fail('CATALOG_SCOPE_DENIED');
      const products=catalog.products.map(p=>{
        if(!p||p.tenantId!==scope.tenantId||p.storeId!==scope.storeId||
           !validSku(p.sku)||typeof p.name!=='string'||!p.name.trim()||
           p.name.length>250||!Number.isSafeInteger(p.priceVnd)||p.priceVnd<0||
           !Number.isInteger(p.stockOnHand)||p.stockOnHand<0)fail('CATALOG_INVALID');
        return frozen({sku:p.sku,name:p.name,priceVnd:p.priceVnd,stockOnHand:p.stockOnHand});
      });
      const text=typeof auth.text==='string'?auth.text.trim():'';
      if(!text||text.length>4000)fail('UNAUTHENTICATED_INGRESS');
      // This port must be an existing shared Sales Core READ-ONLY preview,
      // never a production tool caller. Network/DB writes must stay physically disconnected.
      const result=await customerPreview(frozen({scope,customerRef:auth.customerRef,text,
        catalog:frozen({products:frozen(products)}),mode:'NO_SEND_NO_WRITE'}));
      if(!result||result.previewOnly!==true||typeof result.text!=='string'||
         result.text.length>4000||result.ordersWritten!==0||
         result.externalSends!==0||result.outboxWrites!==0)fail('CORE_PREVIEW_INVALID');
      return frozen({status:'PREVIEW_READY',channel,tenantId:scope.tenantId,
        storeId:scope.storeId,previewText:result.text,
        providerCapabilities:CAPABILITIES[channel],externalSends:0,ordersWritten:0,
        outboxWrites:0,productionReady:false});
    }catch(e){
      return frozen({status:'PREVIEW_DENIED',code:SAFE_CODES.has(e.code)?e.code:'BACKEND_UNAVAILABLE',
        externalSends:0,ordersWritten:0,outboxWrites:0,productionReady:false});
    }
  }
  return frozen({preview,capabilities:CAPABILITIES,mode:'NO_SEND_NO_WRITE',
    providerConnected:false,productionReady:false});
}
module.exports={createNoSendChannelBridge,CAPABILITIES};
